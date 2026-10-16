"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { recordVersion } from "@/features/history/server";
import { deleteImagesIfUnused } from "@/features/uploads/cleanup";
import { collectImageUrls } from "@/features/uploads/collect-urls";
import { deleteImages } from "@/features/uploads/server";
import { sendNewsletter } from "@/features/newsletter/send";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import {
  publishPostSchema,
  savePostSchema,
  updateCoverSchema,
  updatePostSchema,
} from "./schemas";
import { FALLBACK_SLUG, slugify, withSuffix } from "./slug";
import { makeExcerpt, readingTimeMin, type DocNode } from "./content";

// `code` is set only for refusals the editor must treat differently from a
// plain error: "not_holder" = the pen is held by someone else (co-authoring).
export type SavePostResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code?: "not_holder" };

// Columns that both saving a draft and updating a published post write.
// Why a helper: the two actions must never drift apart on excerpt/reading time.
function buildPostFields(
  title: string,
  subtitle: string | undefined,
  doc: DocNode,
  language: string | undefined,
) {
  return {
    title,
    // undefined leaves the column untouched.
    language,
    // Blank subtitle is stored as NULL; undefined is left out of the query,
    // so the column is not touched.
    subtitle: subtitle === undefined ? undefined : subtitle.trim() || null,
    // Zod already verified the document shape; the double cast only bridges
    // our local DocNode type to the generated Json type.
    content: doc as unknown as Json,
    excerpt: makeExcerpt(doc),
    reading_time_min: readingTimeMin(doc, language),
  };
}

// Safety stop for the slug retry loop; 20 collisions on one author is unrealistic.
const MAX_SLUG_ATTEMPTS = 20;

const GONE_MESSAGE = "This post is published or no longer exists. Reload the page.";

const NOT_PUBLISHED_MESSAGE =
  "This post is no longer published. Reload the page.";

function notHolderResult(): SavePostResult {
  return {
    ok: false,
    error: "You no longer have the pen. Your latest changes were not saved.",
    code: "not_holder",
  };
}

// Draft autosave for a person who is NOT the owner: a co-author. The direct
// update above touched 0 rows (a co-author has no UPDATE policy on posts), so
// the text goes through save_shared_post, which checks author and pen itself.
async function saveAsCoauthor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
  fields: ReturnType<typeof buildPostFields>,
  expectedStatus: "draft" | "published",
): Promise<SavePostResult> {
  const isDraft = expectedStatus === "draft";
  // Why this lookup: the owner of a solo post that was published in another
  // tab also gets 0 rows, and must keep the old message (not "pen lost").
  const { data: post, error: lookupError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("savePost lookup failed:", lookupError);
    reportError("savePost lookup", lookupError);
    return { ok: false, error: "Could not save your draft. Please try again." };
  }
  if (!post || post.author_id === userId) {
    return { ok: false, error: isDraft ? GONE_MESSAGE : NOT_PUBLISHED_MESSAGE };
  }

  const { error } = await supabase.rpc("save_shared_post", {
    p_post_id: id,
    p_title: fields.title,
    // The function turns a blank subtitle into NULL itself; the generated
    // type does not allow null here, so an empty string is sent instead.
    p_subtitle: fields.subtitle ?? "",
    p_content: fields.content,
    p_excerpt: fields.excerpt,
    p_reading_time_min: fields.reading_time_min,
    p_expected_status: expectedStatus,
    // A blank value keeps the stored language (the function treats it so).
    p_language: fields.language ?? "",
  });

  if (!error) return { ok: true, id };

  // Expected refusals (migrations 0010 to 0012): shown, never reported.
  if (error.message.includes("collab_editor_published")) {
    return {
      ok: false,
      error: "Editors can only edit while the story is a draft.",
    };
  }
  if (error.message.includes("collab_not_holder")) return notHolderResult();
  if (error.message.includes("collab_not_allowed")) {
    return { ok: false, error: "You can no longer edit this post." };
  }
  if (error.message.includes("collab_status_changed")) {
    return {
      ok: false,
      error: isDraft
        ? "This post was published in the meantime. Reload the page."
        : "This post was unpublished in the meantime. Reload the page.",
    };
  }

  console.error("savePost shared failed:", error);
  reportError("savePost shared", error);
  return { ok: false, error: "Could not save your draft. Please try again." };
}

// Creates a draft (no `id`) or updates an existing draft (with `id`).
// Takes `unknown` on purpose: the input comes from the browser, so Zod is
// the only thing that decides what is valid.
export async function savePost(input: unknown): Promise<SavePostResult> {
  const user = await requireUser("/write");

  const parsed = savePostSchema.safeParse(input);
  if (!parsed.success) {
    console.error(
      "savePost validation failed:",
      JSON.stringify(parsed.error.issues, null, 2),
    );
    return { ok: false, error: "Please check your title and content." };
  }

  const { id, title, subtitle, language, content } = parsed.data;
  // Typed assignment instead of a cast: if TiptapNode ever stops matching
  // DocNode, tsc will tell us.
  const doc: DocNode = content;

  const fields = buildPostFields(title, subtitle, doc, language);

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "save_post");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // UPDATE: touches only title/content/excerpt/reading time. Slug, status and
  // published_at are never changed by autosave (the Publish dialog owns them).
  if (id) {
    const { data, error } = await supabase
      .from("posts")
      .update(fields)
      .eq("id", id)
      .eq("author_id", user.id)
      // Only a draft is autosaved. A stale tab must never write into a post
      // that was published in the meantime (published posts use Update).
      .eq("status", "draft")
      .select("id");

    if (error) {
      // The guard trigger of migration 0012: the owner of a shared post does
      // not hold the pen. Expected, so it is not reported.
      if (error.message.includes("collab_not_holder")) return notHolderResult();
      console.error("savePost update failed:", error);
      reportError("savePost update", error);
      return { ok: false, error: "Could not save your draft. Please try again." };
    }
    if (!data || data.length === 0) {
      // A suspended account gets 0 rows (restrictive policy), not an error.
      if (await isSuspended()) {
        return { ok: false, error: SUSPENDED_MESSAGE };
      }
      // Not the owner (or not a draft any more): maybe a co-author.
      return saveAsCoauthor(supabase, user.id, id, fields, "draft");
    }
    return { ok: true, id: data[0].id };
  }

  // INSERT: the slug is fixed at the first save; on a unique violation
  // (23505 on unique (author_id, slug)) retry with -2, -3, ...
  const base = slugify(title) || FALLBACK_SLUG;

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        ...fields,
        slug: withSuffix(base, attempt),
        status: "draft",
      })
      .select("id")
      .single();

    if (!error) return { ok: true, id: data.id };
    if (error.code !== "23505") {
      if (await isSuspended()) {
        return { ok: false, error: SUSPENDED_MESSAGE };
      }
      reportError("savePost insert", error);
      return { ok: false, error: "Could not create your draft. Please try again." };
    }
  }

  return { ok: false, error: "Could not create your draft. Please try again." };
}

export type DeletePostResult = { ok: true } | { ok: false; error: string };

// Deletes one of the author's own posts (draft or published). Permanent.
// Takes `unknown` on purpose: the id comes from the browser.
export async function deletePost(id: unknown): Promise<DeletePostResult> {
  const user = await requireUser("/me/posts");

  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    return { ok: false, error: "This post could not be found." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // The images of this post, read before it is gone (cleaned up afterwards).
  const { data: before } = await supabase
    .from("posts")
    .select("cover_image_url, content")
    .eq("id", parsedId.data)
    .eq("author_id", user.id)
    .maybeSingle();

  // Filtering by author_id as well keeps the intent visible; RLS also only
  // lets authors delete their own rows.
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", parsedId.data)
    .eq("author_id", user.id);

  if (error) {
    console.error("deletePost failed:", error);
    reportError("deletePost", error);
    return { ok: false, error: "Could not delete this post. Please try again." };
  }

  // Deleted (its old versions went with it): remove the images that nothing
  // else uses. An image shared with another post is kept.
  if (before) {
    await deleteImagesIfUnused(supabase, [
      before.cover_image_url,
      ...collectImageUrls(before.content),
    ]);
  }

  // A post that is already gone (for example deleted in another tab) also
  // counts as done: the list is refreshed either way.
  revalidatePath("/me/posts");
  return { ok: true };
}

export type PublishPostResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

// Publishes one of the author's drafts under the given slug. The title is
// checked on the stored row, so the editor must save pending changes first.
export async function publishPost(input: unknown): Promise<PublishPostResult> {
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  const user = await requireUser("/me/posts");

  const parsed = publishPostSchema.safeParse(input);
  if (!parsed.success) {
    const slugProblem = parsed.error.issues.some(
      (issue) => issue.path[0] === "slug",
    );
    const coverProblem = parsed.error.issues.some(
      (issue) => issue.path[0] === "coverImageUrl",
    );
    const tagsProblem = parsed.error.issues.some(
      (issue) => issue.path[0] === "tags",
    );
    return {
      ok: false,
      error: slugProblem
        ? "The address can only use lowercase letters, numbers and single hyphens."
        : coverProblem
          ? "The cover image is not valid. Remove it and try again."
          : tagsProblem
            ? "Topics use letters, numbers and hyphens, 2 to 30 characters each, up to 5 topics."
            : "This post could not be found.",
    };
  }
  const { id, slug, coverImageUrl, tags, emailSubscribers } = parsed.data;

  // An editor the author allowed to publish takes its own path.
  if (await isPublishingEditor(id, user.id)) {
    return publishAsEditor(id, slug);
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { data: post, error: loadError } = await supabase
    .from("posts")
    .select("title, status")
    .eq("id", id)
    .eq("author_id", user.id)
    .maybeSingle();

  if (loadError) {
    console.error("publishPost load failed:", loadError);
    reportError("publishPost load", loadError);
    return { ok: false, error: "Could not publish this post. Please try again." };
  }
  if (!post) {
    return { ok: false, error: "This post could not be found." };
  }
  if (post.status === "hidden") {
    return {
      ok: false,
      error: "This post was hidden by moderation and cannot be published.",
    };
  }
  if (post.status !== "draft") {
    return { ok: false, error: "This post is already published." };
  }
  // The database does not require a title, so this is the only check.
  if (post.title.trim() === "") {
    return { ok: false, error: "Add a title before publishing." };
  }

  const publishedAt = new Date().toISOString();

  // Same retry idea as the first save: on a unique violation (23505 on
  // unique (author_id, slug)) try slug-2, slug-3, ...
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const finalSlug = withSuffix(slug, attempt);
    const { data, error } = await supabase
      .from("posts")
      .update({
        status: "published",
        published_at: publishedAt,
        slug: finalSlug,
        // The dialog decides the cover each time: no cover chosen = no cover.
        cover_image_url: coverImageUrl ?? null,
        // Written in the same update that sets the status.
        tags: tags ?? [],
      })
      .eq("id", id)
      .eq("author_id", user.id)
      // Guard against a double click or another tab publishing it first.
      .eq("status", "draft")
      .select("id");

    if (error) {
      if (error.code === "23505") continue;
      console.error("publishPost update failed:", error);
      reportError("publishPost update", error);
      return { ok: false, error: "Could not publish this post. Please try again." };
    }
    if (!data || data.length === 0) {
      return { ok: false, error: "This post is no longer a draft." };
    }

    // A version of the text at the moment of publishing (best effort).
    await recordVersion(supabase, id, "publish");

    // Newsletter: one queue row per story, ever (unique post_id). An unticked
    // box writes a "skipped" row, so a later republish can never send. Best
    // effort: a failure here must not fail a publish that worked. The mails
    // go out after the response (after), so the author does not wait; what
    // does not finish is continued by the daily cron job.
    try {
      const admin = createAdminClient();
      if (admin) {
        const { data: sendId, error: queueError } = await admin.rpc(
          "queue_newsletter_send",
          {
            p_post: id,
            p_skip: emailSubscribers !== true,
          },
        );
        if (queueError) {
          reportError("publishPost newsletter queue", queueError);
        } else if (sendId && emailSubscribers === true) {
          after(() => sendNewsletter(sendId));
        }
      }
    } catch {
      console.error("publishPost newsletter queue threw");
    }

    revalidatePath("/me/posts");
    for (const tag of tags ?? []) {
      revalidatePath(`/tag/${tag}`);
    }
    return { ok: true, slug: finalSlug };
  }

  return {
    ok: false,
    error: "Could not find a free address for this post. Try a different one.",
  };
}

// True when this person is an accepted editor whom the author allowed to
// publish this story (migration 0098). An owner never matches.
async function isPublishingEditor(
  postId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_collaborators")
    .select("can_publish")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("role", "editor")
    .eq("status", "accepted")
    .maybeSingle();
  if (error) {
    console.error("isPublishingEditor failed:", error);
    reportError("isPublishingEditor", error);
    return false;
  }
  return data?.can_publish === true;
}

// An editor publishes a draft that is not theirs. Slug, cover and topics stay
// as the author left them; no newsletter and no schedule. The database
// function checks every right again.
async function publishAsEditor(
  postId: string,
  slug: string,
): Promise<PublishPostResult> {
  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const finalSlug = withSuffix(slug, attempt);
    const { error } = await supabase.rpc("editor_publish_post", {
      p_post_id: postId,
      p_slug: finalSlug,
    });

    if (!error) {
      // A version of the text at the moment of publishing (best effort).
      await recordVersion(supabase, postId, "publish");
      revalidatePath("/me/posts");
      revalidatePath("/", "layout");
      return { ok: true, slug: finalSlug };
    }
    if (error.code === "23505") continue;

    // Expected refusals: shown, never reported.
    if (error.message.includes("account_suspended")) {
      return { ok: false, error: SUSPENDED_MESSAGE };
    }
    if (error.message.includes("collab_not_holder")) {
      return {
        ok: false,
        error: "You no longer have the pen. Your text was saved.",
      };
    }
    if (error.message.includes("collab_not_allowed")) {
      return {
        ok: false,
        error: "The author has not allowed you to publish this story.",
      };
    }
    if (error.message.includes("collab_not_draft")) {
      return { ok: false, error: "This story is no longer a draft." };
    }
    if (error.message.includes("collab_post_hidden")) {
      return {
        ok: false,
        error: "This story was hidden by moderation and cannot be published.",
      };
    }
    if (error.message.includes("collab_title_required")) {
      return { ok: false, error: "Add a title before publishing." };
    }
    if (error.message.includes("collab_bad_input")) {
      return {
        ok: false,
        error:
          "The address can only use lowercase letters, numbers and single hyphens.",
      };
    }

    console.error("publishAsEditor failed:", error);
    reportError("publishAsEditor", error);
    return { ok: false, error: "Could not publish this story. Please try again." };
  }

  return {
    ok: false,
    error: "Could not find a free address for this story. Try a different one.",
  };
}

export type UnpublishPostResult = { ok: true } | { ok: false; error: string };

// Turns a published post back into a draft. The slug is kept.
export async function unpublishPost(id: unknown): Promise<UnpublishPostResult> {
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  const user = await requireUser("/me/posts");

  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    return { ok: false, error: "This post could not be found." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase
    .from("posts")
    .update({ status: "draft", published_at: null })
    .eq("id", parsedId.data)
    .eq("author_id", user.id)
    .eq("status", "published");

  if (error) {
    console.error("unpublishPost failed:", error);
    reportError("unpublishPost", error);
    return { ok: false, error: "Could not unpublish this post. Please try again." };
  }

  // A post that is already a draft (for example changed in another tab) also
  // counts as done: the list is refreshed either way.
  revalidatePath("/me/posts");
  return { ok: true };
}

export type UpdatePublishedPostResult =
  | { ok: true }
  | { ok: false; error: string; code?: "not_holder" };

// Applies the author's changes to a post that is already published. Called
// only from the Update button (published posts have no autosave). Slug,
// status and published_at are never touched, so the address stays stable.
export async function updatePublishedPost(
  input: unknown,
): Promise<UpdatePublishedPostResult> {
  const user = await requireUser("/me/posts");

  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) {
    console.error(
      "updatePublishedPost validation failed:",
      JSON.stringify(parsed.error.issues, null, 2),
    );
    return { ok: false, error: "Please check your title and content." };
  }

  const { id, title, subtitle, language, content } = parsed.data;
  // A published post must keep a title (the database does not enforce it).
  if (title.trim() === "") {
    return { ok: false, error: "Add a title before updating." };
  }

  const doc: DocNode = content;
  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "save_post");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const fields = buildPostFields(title, subtitle, doc, language);

  const { data, error } = await supabase
    .from("posts")
    .update(fields)
    .eq("id", id)
    .eq("author_id", user.id)
    // Only a published post: a draft is saved by savePost instead.
    .eq("status", "published")
    .select("id");

  if (error) {
    // Guard trigger (0012): the owner of a shared post does not hold the pen.
    // Expected, so it is not reported.
    if (error.message.includes("collab_not_holder")) return notHolderResult();
    console.error("updatePublishedPost failed:", error);
    reportError("updatePublishedPost", error);
    return { ok: false, error: "Could not update this post. Please try again." };
  }
  if (!data || data.length === 0) {
    // Not the owner (or not published any more): maybe a co-author.
    if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
    const shared = await saveAsCoauthor(
      supabase,
      user.id,
      id,
      fields,
      "published",
    );
    if (!shared.ok) return shared;
  }

  revalidatePath("/me/posts");
  return { ok: true };
}

export type UpdatePostCoverResult =
  | { ok: true }
  | { ok: false; error: string; code?: "not_holder" };

const COVER_NOT_HOLDER =
  "You no longer have the pen. The cover was not changed.";

// Cover change for a person who is NOT the owner: a co-author. Same idea as
// saveAsCoauthor, through set_shared_post_cover (migration 0014).
async function setCoverAsCoauthor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
  coverImageUrl: string | null,
): Promise<UpdatePostCoverResult> {
  const { data: post, error: lookupError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("updatePostCover lookup failed:", lookupError);
    reportError("updatePostCover lookup", lookupError);
    return { ok: false, error: "Could not save the cover. Please try again." };
  }
  if (!post || post.author_id === userId) {
    return { ok: false, error: NOT_PUBLISHED_MESSAGE };
  }

  const { error } = await supabase.rpc("set_shared_post_cover", {
    p_post_id: id,
    // The function turns a blank value into NULL (no cover) itself.
    p_cover_url: coverImageUrl ?? "",
  });

  if (!error) return { ok: true };

  // Expected refusals (migrations 0010, 0014): shown, never reported.
  if (error.message.includes("collab_editor_published")) {
    return {
      ok: false,
      error: "Editors can only edit while the story is a draft.",
    };
  }
  if (error.message.includes("collab_not_holder")) {
    return { ok: false, error: COVER_NOT_HOLDER, code: "not_holder" };
  }
  if (error.message.includes("collab_not_allowed")) {
    return { ok: false, error: "You can no longer edit this post." };
  }
  if (error.message.includes("collab_status_changed")) {
    return {
      ok: false,
      error: "This post was unpublished in the meantime. Reload the page.",
    };
  }

  console.error("updatePostCover shared failed:", error);
  reportError("updatePostCover shared", error);
  return { ok: false, error: "Could not save the cover. Please try again." };
}

// Changes (or removes) the cover of a post that is already published. It is
// saved right away, separate from the Update button, so unapplied text edits
// are neither published nor lost. Only the cover column is written.
export async function updatePostCover(
  input: unknown,
): Promise<UpdatePostCoverResult> {
  const user = await requireUser("/me/posts");

  const parsed = updateCoverSchema.safeParse(input);
  if (!parsed.success) {
    const coverProblem = parsed.error.issues.some(
      (issue) => issue.path[0] === "coverImageUrl",
    );
    return {
      ok: false,
      error: coverProblem
        ? "The cover image is not valid. Remove it and try again."
        : "This post could not be found.",
    };
  }
  const { id, coverImageUrl } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }
  // The cover that is about to be replaced or removed (deleted after saving).
  const { data: before } = await supabase
    .from("posts")
    .select("cover_image_url")
    .eq("id", id)
    .maybeSingle();
  const oldCover = before?.cover_image_url ?? null;

  const { data, error } = await supabase
    .from("posts")
    .update({ cover_image_url: coverImageUrl })
    .eq("id", id)
    .eq("author_id", user.id)
    // Only a published post: a draft gets its cover in the Publish dialog.
    .eq("status", "published")
    .select("id");

  if (error) {
    // Guard trigger (0014): the owner of a shared post does not hold the pen.
    if (error.message.includes("collab_not_holder")) {
      return { ok: false, error: COVER_NOT_HOLDER, code: "not_holder" };
    }
    console.error("updatePostCover failed:", error);
    reportError("updatePostCover", error);
    return { ok: false, error: "Could not save the cover. Please try again." };
  }
  if (!data || data.length === 0) {
    // Not the owner (or not published any more): maybe a co-author.
    if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
    const shared = await setCoverAsCoauthor(
      supabase,
      user.id,
      id,
      coverImageUrl,
    );
    if (!shared.ok) return shared;
  }

  // Saved: the old cover is no longer used, so it frees storage.
  if (oldCover && oldCover !== coverImageUrl) {
    await deleteImages([oldCover]);
  }

  revalidatePath("/me/posts");
  return { ok: true };
}
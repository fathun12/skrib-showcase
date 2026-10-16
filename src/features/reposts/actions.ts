"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import {
  REPOST_CAPTION_MAX,
  reportRepostCaptionSchema,
  repostCaptionSchema,
} from "./schemas";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CAPTION_ERROR = `A caption needs 1 to ${REPOST_CAPTION_MAX} characters.`;
const NOT_FOUND = "This story could not be found.";

const setRepostSchema = z.object({
  postId: z.uuid(),
  repost: z.boolean(),
  // Only used when repost is true. Checked below with repostCaptionSchema so
  // a bad caption gets its own message.
  caption: z.string().optional(),
});

const setRepostCaptionSchema = z.object({
  postId: z.uuid(),
  // null removes the caption (the repost stays).
  caption: z.string().nullable(),
});

export type SetRepostResult = { ok: true } | { ok: false; error: string };

// Writes (or clears, with null) the caption of MY repost of a post.
async function writeCaption(
  supabase: Supabase,
  userId: string,
  postId: string,
  caption: string | null,
): Promise<SetRepostResult> {
  const { data, error } = await supabase
    .from("reposts")
    .update({ caption })
    .eq("user_id", userId)
    .eq("post_id", postId)
    .select("post_id");

  if (error) {
    console.error("writeCaption failed:", error);
    reportError("writeCaption", error);
    return { ok: false, error: "Could not save the caption. Please try again." };
  }
  // No row: not reposted (any more), or the story is no longer published.
  if (!data || data.length === 0) {
    return { ok: false, error: "This repost could not be found." };
  }
  return { ok: true };
}

// Sets the wanted state ("reposted" or "not reposted") instead of toggling,
// like setLike. With a caption, reposting also sets the caption (if the
// repost already exists, the caption is replaced). Takes `unknown` on
// purpose: the input comes from the browser.
export async function setRepost(input: unknown): Promise<SetRepostResult> {
  const user = await requireUser("/");

  const parsed = setRepostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND };
  }
  const { postId, repost } = parsed.data;
  if (repost && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  let caption: string | undefined;
  if (repost && parsed.data.caption !== undefined) {
    const checked = repostCaptionSchema.safeParse(parsed.data.caption);
    if (!checked.success) return { ok: false, error: CAPTION_ERROR };
    caption = checked.data;
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "repost");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  if (repost) {
    // user_id is filled by the database from the session.
    const { error } = await supabase
      .from("reposts")
      .insert(
        caption === undefined
          ? { post_id: postId }
          : { post_id: postId, caption },
      );

    if (error && error.code === "23505") {
      // Already reposted (double click, other tab, or "Repost with caption"
      // on a plain repost). Without a caption the wanted state is reached;
      // with one, the caption is written to the existing row.
      if (caption !== undefined) {
        const written = await writeCaption(supabase, user.id, postId, caption);
        if (!written.ok) return written;
      }
    } else if (error) {
      // 42501 = RLS refused (own post, co-author, or not published);
      // 23503 = the post is gone.
      if (error.code === "42501" || error.code === "23503") {
        return { ok: false, error: "This story can't be reposted." };
      }
      console.error("setRepost (insert) failed:", error);
      reportError("setRepost insert", error);
      return { ok: false, error: "Could not repost. Please try again." };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    // The caption goes with the row.
    const { error } = await supabase
      .from("reposts")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);
    if (error) {
      console.error("setRepost (delete) failed:", error);
      reportError("setRepost delete", error);
      return { ok: false, error: "Could not undo the repost. Please try again." };
    }
  }

  // The Reposts tab of profile pages.
  revalidatePath("/[username]", "page");
  return { ok: true };
}

// Edits or removes (caption null) the caption of a repost I already made.
// Shares the "repost" rate limit rule.
export async function setRepostCaption(
  input: unknown,
): Promise<SetRepostResult> {
  const user = await requireUser("/");

  const parsed = setRepostCaptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  const { postId } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  let caption: string | null = null;
  if (parsed.data.caption !== null) {
    const checked = repostCaptionSchema.safeParse(parsed.data.caption);
    if (!checked.success) return { ok: false, error: CAPTION_ERROR };
    caption = checked.data;
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "repost");
  if (!limit.ok) return { ok: false, error: limit.error };

  const written = await writeCaption(supabase, user.id, postId, caption);
  if (!written.ok) return written;

  revalidatePath("/[username]", "page");
  return { ok: true };
}


// Reports the caption of someone else's repost. Reuses the "report" rate
// limit rule. The database copies the caption text into the report.
export async function reportRepostCaption(
  input: unknown,
): Promise<SetRepostResult> {
  const user = await requireUser("/");

  const parsed = reportRepostCaptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a reason." };
  const { reposterId, postId, reason } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  // A blank note is stored as NULL, never as '' (the database rejects '').
  const details = parsed.data.details ? parsed.data.details : null;

  if (reposterId === user.id) {
    return { ok: false, error: "You can't report your own caption." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "report");
  if (!limit.ok) return { ok: false, error: limit.error };

  // No .select() on purpose: nobody may read reports through the API.
  const { error } = await supabase
    .from("repost_caption_reports")
    .insert({ repost_user_id: reposterId, post_id: postId, reason, details });

  // 23505 = already reported by this user: the wanted state is reached.
  if (error && error.code !== "23505") {
    // 42501 = RLS refused (no caption, own repost, story not published);
    // 23503 = the repost is gone; the trigger raises repost_caption_not_found.
    if (
      error.code === "42501" ||
      error.code === "23503" ||
      error.message.includes("repost_caption_not_found")
    ) {
      return { ok: false, error: "This caption could not be found." };
    }
    console.error("reportRepostCaption failed:", error);
    reportError("reportRepostCaption", error);
    return { ok: false, error: "Could not send the report. Please try again." };
  }

  return { ok: true };
}
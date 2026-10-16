"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { deleteImagesIfUnused } from "@/features/uploads/cleanup";
import { isOwnCloudinaryImageUrl } from "@/features/uploads/validate";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import {
  createNoteSchema,
  deleteNoteSchema,
  hideNoteReplySchema,
  NOTE_EDIT_MINUTES,
  setNoteLikeSchema,
  setNoteRepostSchema,
  setReplyPolicySchema,
  updateNoteSchema,
} from "./schemas";

export type NoteResult = { ok: true } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Refreshes the lists that show notes: the feed area and the author's profile.
async function refreshNoteViews(supabase: ServerClient, userId: string) {
  revalidatePath("/");
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (data?.username) revalidatePath(`/${data.username}`);
}

// Publishes a note, or a reply when replyToId is given. Takes `unknown` on
// purpose: the input comes from the browser. author_id is filled by the
// database from the session; the database also checks the reply policy of the
// parent note.
export async function createNote(input: unknown): Promise<NoteResult> {
  const user = await requireUser("/");

  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write a note of 1 to 500 characters." };
  }
  const {
    body,
    replyPolicy,
    replyToId,
    sharedPostId,
    quoteNoteId,
    images,
    storyQuote,
  } = parsed.data;
  if (
    images &&
    !images.every((image) =>
      isOwnCloudinaryImageUrl(
        image.url,
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      ),
    )
  ) {
    return { ok: false, error: "One of the images is not allowed." };
  }
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_create");
  if (!limit.ok) return { ok: false, error: limit.error };

  // The new id is needed to attach images.
  const { data: created, error } = await supabase
    .from("notes")
    .insert({
      body,
      reply_policy: replyPolicy,
      reply_to_id: replyToId ?? null,
      shared_post_id: sharedPostId ?? null,
      quote_note_id: quoteNoteId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // 42501 = RLS refused (a suspended account, or the reply policy).
    if (error.code === "42501") {
      return {
        ok: false,
        error: replyToId
          ? "You can't reply to this note."
          : quoteNoteId
            ? "You can't quote this note."
            : sharedPostId
              ? "You can't share this story right now."
              : "You can't post a note right now.",
      };
    }
    // 23503 = the note I replied to, or the story I shared, is gone.
    if (error.code === "23503") {
      return {
        ok: false,
        error: sharedPostId
          ? "This story could not be found."
          : "This note could not be found.",
      };
    }
    console.error("createNote failed:", error);
    reportError("createNote insert", error);
    return { ok: false, error: "Could not post your note. Please try again." };
  }

  // The quote goes in before the images: if it fails nothing else was
  // attached, and if the images fail later, deleting the note removes it.
  if (storyQuote) {
    const { error: quoteError } = created
      ? await supabase
          .from("note_story_quotes")
          .insert({ note_id: created.id, quote: storyQuote })
      : { error: new Error("the new note id is missing") };
    if (quoteError) {
      console.error("createNote (story quote) failed:", quoteError);
      reportError("createNote story quote", quoteError);
      if (created) await supabase.from("notes").delete().eq("id", created.id);
      return {
        ok: false,
        error: "Could not attach the quote. Please try again.",
      };
    }
  }

  if (images && images.length > 0) {
    const { error: imageError } = created
      ? await supabase.from("note_images").insert(
          images.map((image, position) => ({
            note_id: created.id,
            position,
            url: image.url,
            width: image.width,
            height: image.height,
            alt: image.alt ? image.alt : null,
          })),
        )
      : { error: new Error("the new note id is missing") };
    if (imageError) {
      console.error("createNote (images) failed:", imageError);
      reportError("createNote images", imageError);
      // A note whose images could not be attached is removed again, so the
      // writer can try once more with the same text.
      if (created) await supabase.from("notes").delete().eq("id", created.id);
      return {
        ok: false,
        error: "Could not attach your images. Please try again.",
      };
    }
  }

  await refreshNoteViews(supabase, user.id);
  if (replyToId) revalidatePath(`/notes/${replyToId}`);
  return { ok: true };
}

// Deletes one of my own notes (its replies go with it). RLS decides who may.
export async function deleteNote(input: unknown): Promise<NoteResult> {
  const user = await requireUser("/");

  const parsed = deleteNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This note could not be found." };
  }
  const { noteId } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_delete");
  if (!limit.ok) return { ok: false, error: limit.error };

  // The image addresses are read BEFORE the delete (the rows go with the
  // note). The files are removed only after the delete succeeded.
  const { data: imageRows } = await supabase
    .from("note_images")
    .select("url")
    .eq("note_id", noteId);

  const { data: deleted, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .select("id, reply_to_id");

  if (error) {
    console.error("deleteNote failed:", error);
    reportError("deleteNote delete", error);
    return { ok: false, error: "Could not delete this note. Please try again." };
  }
  // RLS hides rows from a delete instead of raising an error.
  if (!deleted || deleted.length === 0) {
    return { ok: false, error: "You can't delete this note." };
  }

  await refreshNoteViews(supabase, user.id);
  // Best effort: deletes the files that nothing else uses (a saved report
  // copy still keeps its images). Images of replies that went with the note
  // are left to the admin sweep.
  await deleteImagesIfUnused(
    supabase,
    (imageRows ?? []).map((row) => row.url),
  );
  // The note's own page becomes a 404, and the parent page loses a reply.
  revalidatePath(`/notes/${noteId}`);
  const parentId = deleted[0].reply_to_id;
  if (parentId) revalidatePath(`/notes/${parentId}`);
  return { ok: true };
}

// Sets the wanted state ("liked" or "not liked") instead of toggling, so a
// double click or a second tab can never flip it by accident.
export async function setNoteLike(input: unknown): Promise<NoteResult> {
  const user = await requireUser("/");

  const parsed = setNoteLikeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This note could not be found." };
  }
  const { noteId, like } = parsed.data;
  if (like && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_like");
  if (!limit.ok) return { ok: false, error: limit.error };

  // RLS shows only notes the viewer may see; its author is needed to refresh
  // the lists afterwards.
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("author_id")
    .eq("id", noteId)
    .eq("status", "published")
    .maybeSingle();

  if (noteError) {
    console.error("setNoteLike (note) failed:", noteError);
    reportError("setNoteLike note", noteError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!note) return { ok: false, error: "This note could not be found." };

  if (like) {
    // Only note_id is granted for insert; user_id is filled by the database
    // (default auth.uid()) and checked by the insert policy.
    const { error } = await supabase
      .from("note_likes")
      .insert({ note_id: noteId });
    // 42501 = RLS refused (the author blocked me): a generic message, so a
    // block is not revealed. A suspended account was stopped above.
    if (error && error.code === "42501") {
      return { ok: false, error: "You can't like this note." };
    }
    // 23505 = already liked (double click, other tab): the wanted state is
    // reached, so it counts as done.
    if (error && error.code !== "23505") {
      console.error("setNoteLike (insert) failed:", error);
      reportError("setNoteLike insert", error);
      return { ok: false, error: "Could not like this note. Please try again." };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("note_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("note_id", noteId);
    if (error) {
      console.error("setNoteLike (delete) failed:", error);
      reportError("setNoteLike delete", error);
      return {
        ok: false,
        error: "Could not unlike this note. Please try again.",
      };
    }
  }

  await refreshNoteViews(supabase, note.author_id);
  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}

// Sets the wanted state ("reposted" or not), like setNoteLike. Only a
// published top-level note of somebody else can be reposted; RLS checks it
// again (also that the author did not block me).
export async function setNoteRepost(input: unknown): Promise<NoteResult> {
  const user = await requireUser("/");

  const parsed = setNoteRepostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This note could not be found." };
  }
  const { noteId, repost } = parsed.data;
  if (repost && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_repost");
  if (!limit.ok) return { ok: false, error: limit.error };

  if (repost) {
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("author_id, reply_to_id")
      .eq("id", noteId)
      .eq("status", "published")
      .maybeSingle();

    if (noteError) {
      console.error("setNoteRepost (note) failed:", noteError);
      reportError("setNoteRepost note", noteError);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
    if (!note) return { ok: false, error: "This note could not be found." };
    if (note.author_id === user.id) {
      return { ok: false, error: "You can't repost your own note." };
    }
    if (note.reply_to_id) {
      return { ok: false, error: "A reply can't be reposted." };
    }

    const { error } = await supabase
      .from("note_reposts")
      .insert({ user_id: user.id, note_id: noteId });
    // 42501 = RLS refused (the author blocked me): a generic message, so a
    // block is not revealed.
    if (error && error.code === "42501") {
      return { ok: false, error: "You can't repost this note." };
    }
    // 23505 = already reposted (double click, other tab): counts as done.
    if (error && error.code !== "23505") {
      console.error("setNoteRepost (insert) failed:", error);
      reportError("setNoteRepost insert", error);
      return {
        ok: false,
        error: "Could not repost this note. Please try again.",
      };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("note_reposts")
      .delete()
      .eq("user_id", user.id)
      .eq("note_id", noteId);
    if (error) {
      console.error("setNoteRepost (delete) failed:", error);
      reportError("setNoteRepost delete", error);
      return {
        ok: false,
        error: "Could not undo the repost. Please try again.",
      };
    }
  }

  revalidatePath("/");
  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}

// Edits the text of one of my own notes (within 30 minutes of posting; the
// database enforces the window and sets edited_at). Hashtags, mentions and
// the search index follow the new text through the database triggers.
export async function updateNote(input: unknown): Promise<NoteResult> {
  const user = await requireUser("/");

  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write a note of 1 to 500 characters." };
  }
  const { noteId, body } = parsed.data;
  // A restrictive update policy gives 0 rows and no error, so check first.
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_edit");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data: updated, error } = await supabase
    .from("notes")
    .update({ body })
    .eq("id", noteId)
    .eq("author_id", user.id)
    .select("id, reply_to_id");

  if (error) {
    if (error.message.includes("edit_window_closed")) {
      return {
        ok: false,
        error: `You can only edit a note within ${NOTE_EDIT_MINUTES} minutes of posting it.`,
      };
    }
    if (error.message.includes("note_not_editable")) {
      return { ok: false, error: "You can't edit this note." };
    }
    console.error("updateNote failed:", error);
    reportError("updateNote update", error);
    return { ok: false, error: "Could not save your changes. Please try again." };
  }
  // RLS hides rows from an update instead of raising an error.
  if (!updated || updated.length === 0) {
    return { ok: false, error: "You can't edit this note." };
  }

  await refreshNoteViews(supabase, user.id);
  revalidatePath(`/notes/${noteId}`);
  const parentId = updated[0].reply_to_id;
  if (parentId) revalidatePath(`/notes/${parentId}`);
  return { ok: true };
}

// Changes who may reply to one of my own published notes. Only the author's
// own rows match, and RLS and the column grant check it again.
export async function changeReplyPolicy(input: unknown): Promise<NoteResult> {
  const user = await requireUser("/");

  const parsed = setReplyPolicySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This note could not be found." };
  }
  const { noteId, replyPolicy } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_manage");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data: updated, error } = await supabase
    .from("notes")
    .update({ reply_policy: replyPolicy })
    .eq("id", noteId)
    .eq("author_id", user.id)
    .select("id");

  if (error) {
    console.error("changeReplyPolicy failed:", error);
    reportError("changeReplyPolicy update", error);
    return {
      ok: false,
      error: "Could not change who can reply. Please try again.",
    };
  }
  // RLS hides rows from an update instead of raising an error.
  if (!updated || updated.length === 0) {
    return { ok: false, error: "You can't change this note." };
  }

  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}

// Hides a reply under one of my notes, or shows it again. The database
// function checks that I am the author of the parent note.
export async function hideNoteReply(input: unknown): Promise<NoteResult> {
  await requireUser("/");

  const parsed = hideNoteReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This reply could not be found." };
  }
  const { noteId, parentId, hidden } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_manage");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { error } = await supabase.rpc("hide_note_reply", {
    p_note_id: noteId,
    p_hidden: hidden,
  });

  if (error) {
    // 42501 = not allowed (not my note, already in that state, or suspended).
    if (error.code === "42501") {
      return { ok: false, error: "You can't change this reply." };
    }
    console.error("hideNoteReply failed:", error);
    reportError("hideNoteReply rpc", error);
    return {
      ok: false,
      error: hidden
        ? "Could not hide this reply. Please try again."
        : "Could not show this reply. Please try again.",
    };
  }

  revalidatePath(`/notes/${parentId}`);
  revalidatePath(`/notes/${noteId}`);
  return { ok: true };
}
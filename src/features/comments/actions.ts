"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { extractPlainText, type DocNode } from "@/features/posts/content";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import {
  addCommentSchema,
  deleteCommentSchema,
  reportCommentSchema,
} from "./schemas";

export type CommentResult = { ok: true } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const POST_NOT_FOUND = "This post could not be found.";
const COMMENT_NOT_FOUND = "This comment could not be found.";

type PostPath =
  | { ok: true; path: string }
  | { ok: false; reason: "missing" | "failed" };

// Public address of a published post (owner's username + slug), used to check
// that the post exists and to refresh the article page afterwards.
async function lookupPostPath(
  supabase: ServerClient,
  postId: string,
  where: string,
): Promise<PostPath> {
  const { data: post, error } = await supabase
    .from("posts")
    .select("slug, author_id")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error(`${where} (post) failed:`, error);
    reportError(`${where} post`, error);
    return { ok: false, reason: "failed" };
  }
  if (!post) return { ok: false, reason: "missing" };

  const { data: owner, error: ownerError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", post.author_id)
    .maybeSingle();

  if (ownerError) {
    console.error(`${where} (owner) failed:`, ownerError);
    reportError(`${where} owner`, ownerError);
    return { ok: false, reason: "failed" };
  }
  if (!owner || !owner.username) return { ok: false, reason: "missing" };

  return { ok: true, path: `/${owner.username}/${post.slug}` };
}

function squash(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Respond: does the quoted text really occur in the published story? Uses the
// same plain-text helper as the excerpt and the reading time. A direct API
// insert can bypass this check (accepted residual risk, see PROJECT_SPEC).
async function quoteIsInPost(
  supabase: ServerClient,
  postId: string,
  quote: string,
): Promise<"found" | "missing" | "failed"> {
  const { data, error } = await supabase
    .from("posts")
    .select("content")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("addComment (quote check) failed:", error);
    reportError("addComment quote check", error);
    return "failed";
  }
  if (!data || !data.content || typeof data.content !== "object") {
    return "missing";
  }
  const text = squash(extractPlainText(data.content as unknown as DocNode));
  return text.includes(squash(quote)) ? "found" : "missing";
}

// Writes a comment (or a reply). Takes `unknown` on purpose: the input comes
// from the browser. The database trigger (migration 0021) enforces the reply
// rules and the cap of 20 comments per person and post.
export async function addComment(input: unknown): Promise<CommentResult> {
  await requireUser("/");

  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write a comment of 1 to 1000 characters." };
  }
  const { postId, parentId, body } = parsed.data;
  const quote = parsed.data.quote ? squash(parsed.data.quote) : null;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "comment");
  if (!limit.ok) return { ok: false, error: limit.error };

  const target = await lookupPostPath(supabase, postId, "addComment");
  if (!target.ok) {
    return {
      ok: false,
      error: target.reason === "missing" ? POST_NOT_FOUND : GENERIC_ERROR,
    };
  }

  if (quote) {
    const found = await quoteIsInPost(supabase, postId, quote);
    if (found === "failed") return { ok: false, error: GENERIC_ERROR };
    if (found === "missing") {
      return {
        ok: false,
        error: "That passage was not found in this story. Select it again.",
      };
    }
  }

  // author_id is filled by the database from the session. No .select() needed.
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, parent_id: parentId ?? null, body, quote });

  if (error) {
    // Expected refusals from the trigger: shown, never reported.
    if (error.message.includes("comment_bad_parent")) {
      return { ok: false, error: "You can't reply to that comment." };
    }
    if (error.message.includes("comment_post_limit")) {
      return {
        ok: false,
        error: "You have reached the limit of 20 comments on this post.",
      };
    }
    if (error.message.includes("comments_quote_")) {
      return { ok: false, error: "The quote must be 1 to 300 characters." };
    }
    // 42501 = RLS refused (post not published); 23503 = post is gone.
    if (error.code === "42501" || error.code === "23503") {
      return { ok: false, error: POST_NOT_FOUND };
    }
    console.error("addComment (insert) failed:", error);
    reportError("addComment insert", error);
    return { ok: false, error: "Could not post your comment. Please try again." };
  }

  revalidatePath(target.path);
  return { ok: true };
}

// Deletes a comment (its replies go with it). RLS decides who may: the writer,
// the post owner and accepted co-authors.
export async function deleteComment(input: unknown): Promise<CommentResult> {
  await requireUser("/");

  const parsed = deleteCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: COMMENT_NOT_FOUND };
  const { commentId } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "comment_delete");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data: comment, error: lookupError } = await supabase
    .from("comments")
    .select("post_id")
    .eq("id", commentId)
    .maybeSingle();

  if (lookupError) {
    console.error("deleteComment (lookup) failed:", lookupError);
    reportError("deleteComment lookup", lookupError);
    return { ok: false, error: GENERIC_ERROR };
  }
  // Already gone (deleted in another tab): the wanted state is reached.
  if (!comment) return { ok: true };

  const { data: deleted, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select("id");

  if (error) {
    console.error("deleteComment (delete) failed:", error);
    reportError("deleteComment delete", error);
    return { ok: false, error: "Could not delete this comment. Please try again." };
  }
  // RLS hides rows from a delete instead of raising an error.
  if (!deleted || deleted.length === 0) {
    return { ok: false, error: "You can't delete this comment." };
  }

  const target = await lookupPostPath(supabase, comment.post_id, "deleteComment");
  if (target.ok) revalidatePath(target.path);
  return { ok: true };
}

// Reports a comment of someone else. Reuses the "report" rate limit rule.
export async function reportComment(input: unknown): Promise<CommentResult> {
  const user = await requireUser("/");

  const parsed = reportCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a reason." };
  const { commentId, reason } = parsed.data;
  // A blank note is stored as NULL, never as '' (the database rejects '').
  const details = parsed.data.details ? parsed.data.details : null;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "report");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data: comment, error: lookupError } = await supabase
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle();

  if (lookupError) {
    console.error("reportComment (lookup) failed:", lookupError);
    reportError("reportComment lookup", lookupError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!comment) return { ok: false, error: COMMENT_NOT_FOUND };
  if (comment.author_id === user.id) {
    return { ok: false, error: "You can't report your own comment." };
  }

  // No .select() on purpose: nobody may read reports through the API.
  const { error } = await supabase
    .from("comment_reports")
    .insert({ comment_id: commentId, reason, details });

  // 23505 = already reported by this user: the wanted state is reached.
  if (error && error.code !== "23505") {
    if (error.code === "42501" || error.code === "23503") {
      return { ok: false, error: COMMENT_NOT_FOUND };
    }
    console.error("reportComment (insert) failed:", error);
    reportError("reportComment insert", error);
    return { ok: false, error: "Could not send the report. Please try again." };
  }

  return { ok: true };
}
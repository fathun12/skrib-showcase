"use server";

import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { listPublishedPostsByIds } from "@/features/posts/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import {
  addHighlightSchema,
  removeHighlightSchema,
  updateHighlightSchema,
} from "./schemas";
import { buildHighlightsMarkdown, type ExportGroup } from "./export";

export type AddHighlightResult =
  | { ok: true; id: string }
  | { ok: false; error: string };
export type RemoveHighlightResult = { ok: true } | { ok: false; error: string };
export type UpdateHighlightResult = { ok: true } | { ok: false; error: string };

// Private to the reader: nothing is revalidated, because no other page shows
// these rows. Both actions take `unknown`: the input comes from the browser.
export async function addHighlight(input: unknown): Promise<AddHighlightResult> {
  await requireUser("/");

  const parsed = addHighlightSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This passage cannot be highlighted." };
  }
  const { postId, blockIndex, startOffset, endOffset, quote, color } =
    parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "highlight");
  if (!limit.ok) return { ok: false, error: limit.error };

  // user_id is filled by the database from the session.
  const { data, error } = await supabase
    .from("highlights")
    .insert({
      post_id: postId,
      block_index: blockIndex,
      start_offset: startOffset,
      end_offset: endOffset,
      quote,
      color,
    })
    .select("id")
    .single();

  if (!error && data) return { ok: true, id: data.id };

  if (error?.code === "23505") {
    // Already saved (double click, other tab): return the existing row.
    const { data: existing } = await supabase
      .from("highlights")
      .select("id")
      .eq("post_id", postId)
      .eq("block_index", blockIndex)
      .eq("start_offset", startOffset)
      .eq("end_offset", endOffset)
      .maybeSingle();
    if (existing) return { ok: true, id: existing.id };
  }
  if (error?.message.includes("highlight_limit")) {
    return {
      ok: false,
      error: "You reached the limit of 200 highlights in this story.",
    };
  }
  if (error?.code === "42501") {
    // Either the story is not published or the account is suspended.
    if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
    return { ok: false, error: "This post could not be found." };
  }
  if (error?.code === "23503") {
    return { ok: false, error: "This post could not be found." };
  }
  console.error("addHighlight failed:", error);
  reportError("addHighlight", error ?? new Error("no row returned"));
  return { ok: false, error: "Could not save the highlight. Please try again." };
}

export async function removeHighlight(
  input: unknown,
): Promise<RemoveHighlightResult> {
  const user = await requireUser("/");

  const parsed = removeHighlightSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This highlight could not be found." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "highlight");
  if (!limit.ok) return { ok: false, error: limit.error };

  // Deleting a row that does not exist is not an error: also "done".
  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("user_id", user.id)
    .eq("id", parsed.data.id);

  if (error) {
    console.error("removeHighlight failed:", error);
    reportError("removeHighlight", error);
    return { ok: false, error: "Could not remove the highlight. Please try again." };
  }
  return { ok: true };
}

// Changes the color and/or the private note of one of the reader's own
// highlights. Nothing is revalidated: the data is private.
export async function updateHighlight(
  input: unknown,
): Promise<UpdateHighlightResult> {
  const user = await requireUser("/");

  const parsed = updateHighlightSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This highlight could not be updated." };
  }
  const { id, color, note } = parsed.data;

  // The restrictive policy of a suspended account hides the rows (no error,
  // just no row), so check it first to give a clear message.
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "highlight");
  if (!limit.ok) return { ok: false, error: limit.error };

  const patch: { color?: string; note?: string | null } = {};
  if (color !== undefined) patch.color = color;
  if (note !== undefined) patch.note = note === null || note === "" ? null : note;

  const { data, error } = await supabase
    .from("highlights")
    .update(patch)
    .eq("user_id", user.id)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("updateHighlight failed:", error);
    reportError("updateHighlight", error);
    return { ok: false, error: "Could not save your changes. Please try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "This highlight could not be found." };
  }
  return { ok: true };
}

export type ExportHighlightsResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

type ExportRow = {
  post_id: string;
  block_index: number;
  start_offset: number;
  quote: string;
  note: string | null;
  created_at: string;
};

const EXPORT_MAX = 5000;
const EXPORT_BATCH = 1000;
const EXPORT_POST_CHUNK = 40;
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://skrib.my.id"
).replace(/\/+$/, "");

// Builds the Markdown of ALL my highlights (up to 5000). Own rows only (RLS).
export async function exportHighlights(): Promise<ExportHighlightsResult> {
  const user = await requireUser("/me/highlights");
  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "highlight");
  if (!limit.ok) return { ok: false, error: limit.error };

  const rows: ExportRow[] = [];
  for (let from = 0; from < EXPORT_MAX; from += EXPORT_BATCH) {
    const { data, error } = await supabase
      .from("highlights")
      .select("post_id, block_index, start_offset, quote, note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + EXPORT_BATCH - 1);
    if (error || !data) {
      console.error("exportHighlights failed:", error);
      reportError("exportHighlights", error ?? new Error("no data returned"));
      return { ok: false, error: "Could not export your highlights. Please try again." };
    }
    rows.push(...data);
    if (data.length < EXPORT_BATCH) break;
  }

  const postIds = [...new Set(rows.map((row) => row.post_id))];
  const posts: Awaited<ReturnType<typeof listPublishedPostsByIds>> = [];
  for (let i = 0; i < postIds.length; i += EXPORT_POST_CHUNK) {
    posts.push(
      ...(await listPublishedPostsByIds(postIds.slice(i, i + EXPORT_POST_CHUNK))),
    );
  }
  const postById = new Map(posts.map((post) => [post.id, post]));

  type Bucket = {
    group: ExportGroup;
    items: { block: number; offset: number; quote: string; note: string | null; createdAt: string }[];
  };
  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    const post = postById.get(row.post_id) ?? null;
    const key = post ? post.id : "gone";
    let bucket = buckets.get(key);
    if (!bucket) {
      const username = post?.authors[0]?.username;
      bucket = {
        group: {
          title: post?.title ?? "Story no longer available",
          author: post?.authors[0]?.displayName ?? null,
          date: post ? new Date(post.publishedAt).toISOString().slice(0, 10) : null,
          url: post && username ? `${SITE_URL}/${username}/${post.slug}` : null,
          highlights: [],
        },
        items: [],
      };
      buckets.set(key, bucket);
    }
    bucket.items.push({
      block: row.block_index,
      offset: row.start_offset,
      quote: row.quote,
      note: row.note,
      createdAt: row.created_at,
    });
  }

  const groups: ExportGroup[] = [];
  for (const bucket of buckets.values()) {
    bucket.items.sort((a, b) => a.block - b.block || a.offset - b.offset);
    bucket.group.highlights = bucket.items.map(({ quote, note, createdAt }) => ({
      quote,
      note,
      createdAt,
    }));
    groups.push(bucket.group);
  }

  return { ok: true, markdown: buildHighlightsMarkdown(groups, new Date()) };
}
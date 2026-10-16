import { listPublishedPostsByIds } from "@/features/posts/queries";
import { createClient } from "@/lib/supabase/server";
import {
  classifyProgress,
  progressMark,
  type ProgressMark,
} from "./rules";

// The place where this person stopped in a story, as a share from 0 to 1.
// null = nothing to resume (no row, a failed request, or a stored value the
// rules would not accept).
export async function getReadingProgress(
  postId: string,
  userId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("progress")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (error) {
    console.error("getReadingProgress failed:", error);
    return null;
  }
  if (!data) return null;
  return classifyProgress(data.progress) === "save" ? data.progress : null;
}

export type ContinueReadingItem = {
  postId: string;
  title: string;
  href: string;
  authorName: string;
  // Whole number, 5 to 94.
  percent: number;
  minutesLeft: number;
};

const LIST_MAX = 5;
// Read a few more rows than shown: stories that were unpublished or deleted
// since are dropped, and the list should still fill up.
const ROWS_FETCHED = 15;

// The stories this person started and did not finish, newest first.
// Returns null when the request fails, so the page can hide the section
// instead of claiming there is nothing to continue.
export async function listContinueReading(
  userId: string,
): Promise<ContinueReadingItem[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("post_id, progress")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(ROWS_FETCHED);

  if (error || !data) {
    console.error("listContinueReading failed:", error);
    return null;
  }
  if (data.length === 0) return [];

  const progressByPost = new Map(data.map((row) => [row.post_id, row.progress]));
  const posts = await listPublishedPostsByIds(data.map((row) => row.post_id));

  const items: ContinueReadingItem[] = [];
  for (const post of posts) {
    const owner = post.authors[0];
    const progress = progressByPost.get(post.id);
    if (!owner || progress === undefined) continue;
    if (classifyProgress(progress) !== "save") continue;
    const mark = progressMark(post.readingTimeMin, progress);
    items.push({
      postId: post.id,
      title: post.title,
      href: `/${owner.username}/${post.slug}`,
      authorName: owner.displayName,
      percent: mark.percent,
      minutesLeft: mark.minutesLeft,
    });
    if (items.length === LIST_MAX) break;
  }
  return items;
}

// The marks for the cards of one page: one small query for all the stories
// shown. A story is in the map only when this person started it and did not
// finish it. Returns null when the request fails (the cards then keep
// showing "N min read"). Call it only for a signed-in person.
export async function getProgressByPost(
  userId: string,
  posts: { id: string; readingTimeMin: number }[],
): Promise<Map<string, ProgressMark> | null> {
  if (posts.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("post_id, progress")
    .eq("user_id", userId)
    .in(
      "post_id",
      posts.map((post) => post.id),
    );

  if (error || !data) {
    console.error("getProgressByPost failed:", error);
    return null;
  }

  const minutesById = new Map(posts.map((post) => [post.id, post.readingTimeMin]));
  const marks = new Map<string, ProgressMark>();
  for (const row of data) {
    const readingTimeMin = minutesById.get(row.post_id);
    if (readingTimeMin === undefined) continue;
    if (classifyProgress(row.progress) !== "save") continue;
    marks.set(row.post_id, progressMark(readingTimeMin, row.progress));
  }
  return marks;
}
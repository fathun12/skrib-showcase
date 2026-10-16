import {
  loadPostsInOrder,
  type PublishedPostListItem,
} from "@/features/posts/queries";
import { createClient } from "@/lib/supabase/server";

// How many recent posts with a shared topic are looked at before the best
// ones are picked (the database cannot count shared topics for us here).
const CANDIDATE_LIMIT = 30;

type Options = {
  // The article that is being read: never listed.
  postId: string;
  // Its topics. No topics means no related stories.
  tags: string[];
  // Posts by this person are left out ("More from" already shows them).
  authorId: string;
  // Posts already shown elsewhere on the page.
  excludeIds?: string[];
  limit?: number;
};

// Published posts that share at least one topic with the article. Best
// first: more shared topics, then newest. Returns [] on any failure, so the
// article page simply shows no section.
export async function listRelatedPosts({
  postId,
  tags,
  authorId,
  excludeIds = [],
  limit = 3,
}: Options): Promise<PublishedPostListItem[]> {
  if (tags.length === 0) return [];

  const supabase = await createClient();
  // `overlaps` is the array operator &&: the post has any of these topics.
  const { data, error } = await supabase
    .from("posts")
    .select("id, tags")
    .eq("status", "published")
    .overlaps("tags", tags)
    .neq("id", postId)
    .neq("author_id", authorId)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (error || !data) {
    if (error) console.error("listRelatedPosts failed:", error);
    return [];
  }

  const skip = new Set(excludeIds);
  const candidates = data
    .filter((row) => !skip.has(row.id))
    .map((row) => ({
      id: row.id,
      shared: row.tags.filter((tag) => tags.includes(tag)).length,
    }));

  // The list is already newest first, and sort() is stable, so posts with
  // the same number of shared topics stay newest first.
  candidates.sort((a, b) => b.shared - a.shared);

  return loadPostsInOrder(
    supabase,
    candidates.slice(0, limit).map((candidate) => candidate.id),
  );
}
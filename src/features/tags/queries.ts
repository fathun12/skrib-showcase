import {
  FEED_PAGE_SIZE,
  loadPostsInOrder,
  parseCursor,
  type FeedPage,
  type FeedPost,
} from "@/features/posts/queries";
import { createClient } from "@/lib/supabase/server";
import { isValidTag } from "@/ui/tags";

export type TagCount = { tag: string; count: number };

// Popular topics (empty prefix) or topics that start with `prefix`, most
// used first. The database function caps the limit at 50. Returns null when
// the call fails, so a caller can hide the section instead of showing "none".
export async function getTagCounts(
  prefix = "",
  limit = 12,
): Promise<TagCount[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tag_counts", {
    p_prefix: prefix,
    p_limit: limit,
  });

  if (error || !data) {
    console.error("getTagCounts failed:", error);
    return null;
  }
  return data.map((row) => ({ tag: row.tag, count: row.post_count }));
}

// Number of published posts with this topic (heading of the tag page).
// Returns null when the call fails.
export async function getTagPostCount(tag: string): Promise<number | null> {
  if (!isValidTag(tag)) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .contains("tags", [tag]);

  if (error) {
    console.error("getTagPostCount failed:", error);
    return null;
  }
  return count ?? 0;
}

// One page of published posts with this topic, newest first, with the same
// keyset cursor as the home feed (published_at desc, then id desc). The tag
// belongs to the post, so a co-author's posts need no special handling.
export async function listPostsByTag(
  tag: string,
  rawCursor?: string,
): Promise<FeedPage> {
  // The tag comes from the URL: anything that is not a valid tag has no posts.
  if (!isValidTag(tag)) return { posts: [], nextCursor: null };

  const supabase = await createClient();

  const base = supabase
    .from("posts")
    .select("id")
    .eq("status", "published")
    .contains("tags", [tag]);

  // parseCursor has already checked the date and the uuid, so nothing else
  // can end up inside this filter text.
  const after = parseCursor(rawCursor);
  const filtered = after
    ? base.or(
        `published_at.lt.${after.publishedAt},and(published_at.eq.${after.publishedAt},id.lt.${after.id})`,
      )
    : base;

  const { data, error } = await filtered
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    // One extra row tells us whether another page exists.
    .limit(FEED_PAGE_SIZE + 1);

  if (error || !data || data.length === 0) {
    if (error) console.error("listPostsByTag failed:", error);
    return { posts: [], nextCursor: null };
  }

  const ids = data.map((row) => row.id);
  const hasMore = ids.length > FEED_PAGE_SIZE;
  const items = await loadPostsInOrder(
    supabase,
    hasMore ? ids.slice(0, FEED_PAGE_SIZE) : ids,
  );

  const posts: FeedPost[] = [];
  for (const item of items) {
    const owner = item.authors[0];
    if (!owner) continue;
    posts.push({
      id: item.id,
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt,
      coverImageUrl: item.coverImageUrl,
      readingTimeMin: item.readingTimeMin,
      publishedAt: item.publishedAt,
      authors: item.authors,
      author: owner,
    });
  }

  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? `${last.publishedAt}_${last.id}` : null;

  return { posts, nextCursor };
}
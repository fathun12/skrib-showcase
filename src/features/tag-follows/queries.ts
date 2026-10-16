import {
  FEED_PAGE_SIZE,
  loadPostsInOrder,
  parseCursor,
  type FeedPage,
  type FeedPost,
} from "@/features/posts/queries";
import { createClient } from "@/lib/supabase/server";
import { isValidTag } from "@/ui/tags";

// The generated types say the arguments of get_topics_feed are never null,
// but the database function accepts null (first page). `never` fits every
// argument type, so null is passed as is (same trick as in posts/queries).
const NULL_ARG = null as unknown as never;

// The topics this person follows, newest follow first. Returns null when the
// call fails, so a caller can hide the part instead of showing "none".
export async function listFollowedTags(
  userId: string,
): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tag_follows")
    .select("tag")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("listFollowedTags failed:", error);
    return null;
  }
  return data.map((row) => row.tag);
}

// Whether this person follows the topic (the button on the topic page).
export async function isFollowingTag(
  userId: string,
  tag: string,
): Promise<boolean> {
  if (!isValidTag(tag)) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tag_follows")
    .select("tag")
    .eq("user_id", userId)
    .eq("tag", tag)
    .maybeSingle();

  if (error) {
    console.error("isFollowingTag failed:", error);
    return false;
  }
  return data !== null;
}

// One page of the Topics tab: published posts with at least one followed
// topic, newest first, with the same keyset cursor as the home feed.
export async function listTopicsFeed(rawCursor?: string): Promise<FeedPage> {
  const supabase = await createClient();

  // parseCursor has already checked the date and the uuid.
  const after = parseCursor(rawCursor);
  const { data, error } = await supabase.rpc("get_topics_feed", {
    p_after_at: after?.publishedAt ?? NULL_ARG,
    p_after_id: after?.id ?? NULL_ARG,
    // One extra row tells us whether another page exists.
    p_limit: FEED_PAGE_SIZE + 1,
  });

  if (error || !data || data.length === 0) {
    if (error) console.error("listTopicsFeed failed:", error);
    return { posts: [], nextCursor: null };
  }

  const ids = data.map((row) => row.post_id);
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
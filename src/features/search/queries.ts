import {
  FEED_PAGE_SIZE,
  loadPostsInOrder,
  type FeedPost,
} from "@/features/posts/queries";
import { createClient } from "@/lib/supabase/server";

// Limits live here, so the page and the query share one rule (decision D12:
// anonymous visitors may search, so the cost is bounded by these caps).
export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 100;
export const SEARCH_MAX_PAGE = 10;

export type SearchPage = {
  posts: FeedPost[];
  // True when another page of results exists.
  hasMore: boolean;
};

// Trims the text and cuts it at 100 characters (by code point, so an emoji
// is never split in half).
export function cleanSearchQuery(raw: string | undefined): string {
  if (!raw) return "";
  return Array.from(raw.trim()).slice(0, SEARCH_QUERY_MAX).join("").trim();
}

// The page number from the address: an integer from 1 to 10, else 1.
export function parseSearchPage(raw: string | undefined): number {
  if (!raw || !/^\d{1,2}$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 && page <= SEARCH_MAX_PAGE ? page : 1;
}

// One page of search results, best match first. A query shorter than 2
// characters means "no search": nothing is asked from the database.
// Returns null when the search fails (the page then shows an error).
// The words are never logged here: only the error object is.
export async function searchPosts(
  rawQuery: string | undefined,
  page: number,
): Promise<SearchPage | null> {
  const query = cleanSearchQuery(rawQuery);
  if (query.length < SEARCH_QUERY_MIN) return { posts: [], hasMore: false };

  const safePage = Number.isInteger(page)
    ? Math.min(Math.max(page, 1), SEARCH_MAX_PAGE)
    : 1;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_posts", {
    p_query: query,
    // One extra row tells us whether another page exists.
    p_limit: FEED_PAGE_SIZE + 1,
    p_offset: (safePage - 1) * FEED_PAGE_SIZE,
  });

  if (error || !data) {
    console.error("searchPosts failed:", error);
    return null;
  }
  if (data.length === 0) return { posts: [], hasMore: false };

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

  return { posts, hasMore };
}
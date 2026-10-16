import { createClient } from "@/lib/supabase/server";

// Rows per request. Supabase returns at most 1000 rows per request by
// default, so the posts are read page by page.
const PAGE_SIZE = 1000;
// A sitemap may hold 50,000 URLs. Posts plus their authors' profile pages
// stay under that with 20,000 posts. Older posts beyond this are left out.
const MAX_POSTS = 20_000;
// Author ids per profile lookup (keeps the request URL short).
const ID_CHUNK = 100;

export type SitemapPost = {
  username: string;
  slug: string;
  // ISO date string.
  lastModified: string;
};

export type SitemapData = {
  posts: SitemapPost[];
  // Only authors with at least one published post (an empty profile page is
  // not worth indexing).
  usernames: string[];
};

const EMPTY: SitemapData = { posts: [], usernames: [] };

type PostRow = {
  id: string;
  author_id: string;
  slug: string;
  updated_at: string | null;
  published_at: string | null;
};

// Everything the sitemap lists: published posts (newest first) and the
// profiles that own them. Usernames and slugs only contain [a-z0-9_-], so
// they need no URL encoding.
export async function listSitemapData(): Promise<SitemapData> {
  const supabase = await createClient();

  const rows: PostRow[] = [];
  for (let from = 0; from < MAX_POSTS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("posts")
      .select("id, author_id, slug, updated_at, published_at")
      .eq("status", "published")
      // Same rule as the feed: a published post without a date is ignored.
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      // Second sort key keeps the paging stable for equal dates.
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data) {
      console.error("listSitemapData (posts) failed:", error);
      return EMPTY;
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const usernameById = new Map<string, string>();
  for (let i = 0; i < authorIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", authorIds.slice(i, i + ID_CHUNK));

    if (error || !data) {
      console.error("listSitemapData (profiles) failed:", error);
      return EMPTY;
    }
    for (const profile of data) {
      if (profile.username) usernameById.set(profile.id, profile.username);
    }
  }

  const posts: SitemapPost[] = [];
  for (const row of rows) {
    const username = usernameById.get(row.author_id);
    // updated_at changes on every Update; published_at is the fallback.
    const lastModified = row.updated_at ?? row.published_at;
    if (!username || !lastModified) continue;
    posts.push({ username, slug: row.slug, lastModified });
  }

  const usernames = new Set(posts.map((post) => post.username));

  // Accepted co-authors count too: their profile page lists the shared post.
  // The database function takes at most 100 post ids per call.
  for (let i = 0; i < rows.length; i += ID_CHUNK) {
    const { data, error } = await supabase.rpc("get_post_coauthors", {
      p_post_ids: rows.slice(i, i + ID_CHUNK).map((row) => row.id),
    });

    if (error || !data) {
      // The owners' pages are still listed; only co-author pages are missed.
      console.error("listSitemapData (co-authors) failed:", error);
      break;
    }
    for (const coauthor of data) usernames.add(coauthor.username);
  }

  return { posts, usernames: [...usernames] };
}


export type SitemapSeries = { username: string; slug: string };

// Topics that have published posts, most used first. The database function
// caps the limit at 50, so only the 50 biggest topics are listed.
export async function listSitemapTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tag_counts", {
    p_prefix: "",
    p_limit: 50,
  });

  if (error || !data) {
    console.error("listSitemapTags failed:", error);
    return [];
  }
  return data.map((row) => row.tag);
}

// Series with at least one published story, with the username of their
// author (the series page is /<username>/series/<slug>). A series without a
// published story is a 404 for visitors, so it is left out.
export async function listSitemapSeries(): Promise<SitemapSeries[]> {
  const supabase = await createClient();

  const { data: links, error } = await supabase
    .from("series_posts")
    .select("series_id, posts!inner(status)")
    .eq("posts.status", "published")
    .limit(MAX_POSTS);

  if (error || !links) {
    console.error("listSitemapSeries (links) failed:", error);
    return [];
  }

  const seriesIds = [...new Set(links.map((link) => link.series_id))];
  const rows: { slug: string; author_id: string }[] = [];
  for (let i = 0; i < seriesIds.length; i += ID_CHUNK) {
    const { data, error: seriesError } = await supabase
      .from("series")
      .select("slug, author_id")
      .in("id", seriesIds.slice(i, i + ID_CHUNK));

    if (seriesError || !data) {
      console.error("listSitemapSeries (series) failed:", seriesError);
      return [];
    }
    rows.push(...data);
  }

  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const usernameById = new Map<string, string>();
  for (let i = 0; i < authorIds.length; i += ID_CHUNK) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", authorIds.slice(i, i + ID_CHUNK));

    if (profileError || !data) {
      console.error("listSitemapSeries (profiles) failed:", profileError);
      return [];
    }
    for (const profile of data) {
      if (profile.username) usernameById.set(profile.id, profile.username);
    }
  }

  const result: SitemapSeries[] = [];
  for (const row of rows) {
    const username = usernameById.get(row.author_id);
    if (username) result.push({ username, slug: row.slug });
  }
  return result;
}
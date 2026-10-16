import { cache } from "react";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

export type Series = {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
};

export type SeriesListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  postCount: number;
};

// null when the series does not exist or the query failed.
export const getSeriesBySlug = cache(
  async (authorId: string, slug: string): Promise<Series | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("series")
      .select("id, author_id, slug, title, description, cover_image_url")
      .eq("author_id", authorId)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error("getSeriesBySlug failed:", error);
      reportError("getSeriesBySlug", error);
      return null;
    }
    if (!data) return null;
    return {
      id: data.id,
      authorId: data.author_id,
      slug: data.slug,
      title: data.title,
      description: data.description,
      coverUrl: data.cover_image_url,
    };
  },
);

// Ids of the published posts of a series, in the order the author set.
// null when the query failed.
export async function listSeriesPostIds(
  seriesId: string,
): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series_posts")
    .select("post_id, posts!inner(status)")
    .eq("series_id", seriesId)
    .eq("posts.status", "published")
    .order("position", { ascending: true });
  if (error) {
    console.error("listSeriesPostIds failed:", error);
    reportError("listSeriesPostIds", error);
    return null;
  }
  return (data ?? []).map((row) => row.post_id);
}

// The series of an author that have at least one published post, newest
// first. null when a query failed.
export async function listSeriesByAuthor(
  authorId: string,
): Promise<SeriesListItem[] | null> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("series")
    .select("id, slug, title, description, cover_image_url")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listSeriesByAuthor failed:", error);
    reportError("listSeriesByAuthor", error);
    return null;
  }
  if (!rows || rows.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from("series_posts")
    .select("series_id, posts!inner(status)")
    .in(
      "series_id",
      rows.map((row) => row.id),
    )
    .eq("posts.status", "published");
  if (linkError) {
    console.error("listSeriesByAuthor counts failed:", linkError);
    reportError("listSeriesByAuthor counts", linkError);
    return null;
  }

  const counts = new Map<string, number>();
  for (const link of links ?? []) {
    counts.set(link.series_id, (counts.get(link.series_id) ?? 0) + 1);
  }
  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverUrl: row.cover_image_url,
      postCount: counts.get(row.id) ?? 0,
    }))
    .filter((item) => item.postCount > 0);
}

export type SeriesNav = {
  series: { slug: string; title: string };
  position: number;
  total: number;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

// Where a published post sits in its series, among the published posts only.
// null when the post is in no series or a query failed.
export async function getSeriesNav(postId: string): Promise<SeriesNav | null> {
  const supabase = await createClient();
  const { data: link, error } = await supabase
    .from("series_posts")
    .select("series_id, series!inner(slug, title)")
    .eq("post_id", postId)
    .maybeSingle();
  if (error) {
    console.error("getSeriesNav failed:", error);
    reportError("getSeriesNav", error);
    return null;
  }
  if (!link) return null;

  const { data: rows, error: listError } = await supabase
    .from("series_posts")
    .select("post_id, posts!inner(slug, title)")
    .eq("series_id", link.series_id)
    .eq("posts.status", "published")
    .order("position", { ascending: true });
  if (listError) {
    console.error("getSeriesNav list failed:", listError);
    reportError("getSeriesNav list", listError);
    return null;
  }

  const list = rows ?? [];
  const index = list.findIndex((row) => row.post_id === postId);
  if (index === -1) return null;
  const pick = (row: (typeof list)[number] | undefined) =>
    row ? { slug: row.posts.slug, title: row.posts.title } : null;

  return {
    series: { slug: link.series.slug, title: link.series.title },
    position: index + 1,
    total: list.length,
    prev: pick(list[index - 1]),
    next: pick(list[index + 1]),
  };
}

export type OwnSeries = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  postCount: number;
};

// All series of the signed-in author, drafts counted too. null on a failure.
export async function listOwnSeries(
  userId: string,
): Promise<OwnSeries[] | null> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("series")
    .select("id, slug, title, description, cover_image_url")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listOwnSeries failed:", error);
    reportError("listOwnSeries", error);
    return null;
  }
  if (!rows || rows.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from("series_posts")
    .select("series_id")
    .in(
      "series_id",
      rows.map((row) => row.id),
    );
  if (linkError) {
    console.error("listOwnSeries counts failed:", linkError);
    reportError("listOwnSeries counts", linkError);
    return null;
  }
  const counts = new Map<string, number>();
  for (const link of links ?? []) {
    counts.set(link.series_id, (counts.get(link.series_id) ?? 0) + 1);
  }
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_image_url,
    postCount: counts.get(row.id) ?? 0,
  }));
}

export async function getOwnSeries(
  userId: string,
  id: string,
): Promise<Series | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series")
    .select("id, author_id, slug, title, description, cover_image_url")
    .eq("id", id)
    .eq("author_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getOwnSeries failed:", error);
    reportError("getOwnSeries", error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    authorId: data.author_id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    coverUrl: data.cover_image_url,
  };
}

export type OwnSeriesItem = {
  postId: string;
  title: string;
  slug: string;
  status: string;
  coverUrl: string | null;
};

// Every story of a series in order, whatever its status. null on a failure.
export async function listOwnSeriesItems(
  seriesId: string,
): Promise<OwnSeriesItem[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("series_posts")
    .select("post_id, posts!inner(title, slug, status, cover_image_url)")
    .eq("series_id", seriesId)
    .order("position", { ascending: true });
  if (error) {
    console.error("listOwnSeriesItems failed:", error);
    reportError("listOwnSeriesItems", error);
    return null;
  }
  return (data ?? []).map((row) => ({
    postId: row.post_id,
    title: row.posts.title,
    slug: row.posts.slug,
    status: row.posts.status,
    coverUrl: row.posts.cover_image_url,
  }));
}

export type SeriesCandidate = { id: string; title: string; status: string };

// Own drafts and published stories that are in no series yet (up to 200).
export async function listSeriesCandidates(
  userId: string,
): Promise<SeriesCandidate[] | null> {
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, title, status")
    .eq("author_id", userId)
    .in("status", ["draft", "published"])
    .limit(200);
  if (error) {
    console.error("listSeriesCandidates failed:", error);
    reportError("listSeriesCandidates", error);
    return null;
  }
  if (!posts || posts.length === 0) return [];

  const { data: taken, error: takenError } = await supabase
    .from("series_posts")
    .select("post_id")
    .in(
      "post_id",
      posts.map((post) => post.id),
    );
  if (takenError) {
    console.error("listSeriesCandidates taken failed:", takenError);
    reportError("listSeriesCandidates taken", takenError);
    return null;
  }
  const used = new Set((taken ?? []).map((row) => row.post_id));
  return posts
    .filter((post) => !used.has(post.id))
    .sort((a, b) => a.title.localeCompare(b.title));
}
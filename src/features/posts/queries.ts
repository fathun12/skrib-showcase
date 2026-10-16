import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { filterHiddenForYou } from "@/features/foryou/queries";
import { safeAvatarUrl } from "@/features/uploads/avatar";
import { isOwnCloudinaryImageUrl } from "@/features/uploads/validate";
import { docSchema, type TiptapNode } from "./schemas";

// The list pages show at most this many posts (no pagination yet).
const LIST_LIMIT = 100;

// A valid but empty Tiptap document, used if stored content is unreadable.
// Exported so getEditablePost (features/collab) falls back to the same value.
export const EMPTY_DOC: TiptapNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

// A cover URL read from the database is only handed on when it is an image on
// our own Cloudinary account. RLS lets an author write `cover_image_url`
// directly, and next/image refuses other hosts, so everything that reaches a
// card or the article page goes through here.
function safeCoverUrl(url: string | null): string | null {
  return url &&
    isOwnCloudinaryImageUrl(url, process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)
    ? url
    : null;
}

export type OwnPost = {
  id: string;
  title: string;
  // Empty string when the post has no subtitle (the column is NULL).
  subtitle: string;
  content: TiptapNode;
  status: "draft" | "published";
  slug: string;
   // Language code of the post, like "en" or "id".
  language: string;
  // Own Cloudinary URL, or null when the post has no cover.
  coverImageUrl: string | null;
  //   // ISO time a draft is set to publish, or null.
  scheduledFor: string | null;
  // Topics of the post (empty array when none).
  tags: string[];
};

// Loads one post (draft or published) that belongs to `authorId`.
// Returns null when the id is malformed, the post does not exist, or it is
// not the author's. RLS already blocks other people's drafts; the explicit
// author filter keeps the intent visible in code.
export async function getOwnPost(
  id: string,
  authorId: string,
): Promise<OwnPost | null> {
  // `id` comes from the URL: validate before it reaches Postgres, otherwise
  // a garbage id would raise a database error instead of a clean "not found".
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, subtitle, content, language, status, slug, cover_image_url, tags, scheduled_for",
    )
    .eq("id", id)
    .eq("author_id", authorId)
    .maybeSingle();

  if (error || !data) return null;

  const parsed = docSchema.safeParse(data.content);
  return {
    id: data.id,
    title: data.title,
    subtitle: data.subtitle ?? "",
    content: parsed.success ? parsed.data : EMPTY_DOC,
    // The column is a plain string in the DB; narrow it instead of casting.
    status: data.status === "published" ? "published" : "draft",
    slug: data.slug,
    language: data.language,
    coverImageUrl: data.cover_image_url,
    tags: data.tags,
    scheduledFor: data.scheduled_for,
  };
}

export type OwnPostListItem = {
  id: string;
  title: string;
  slug: string;
  // Last edit for drafts; publish date for published posts.
  date: string;
  // ISO time a draft is set to publish, or null.
  scheduledFor: string | null;
};

// Lists the author's posts with one status, newest first.
export async function listOwnPosts(
  authorId: string,
  status: "draft" | "published" | "hidden",
): Promise<OwnPostListItem[]> {
  const supabase = await createClient();
  const orderBy = status === "published" ? "published_at" : "updated_at";

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, updated_at, published_at, scheduled_for")
    .eq("author_id", authorId)
    .eq("status", status)
    .order(orderBy, { ascending: false })
    .limit(LIST_LIMIT);

  if (error || !data) {
    console.error("listOwnPosts failed:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    date:
      (status === "published" ? row.published_at : null) ?? row.updated_at,
    scheduledFor: row.scheduled_for,
  }));
}

export type PublishedPost = {
  id: string;
  authorId: string;
  title: string;
  // Empty string when the post has no subtitle (the column is NULL).
  subtitle: string;
  content: TiptapNode;
  excerpt: string;
  coverImageUrl: string | null;
  readingTimeMin: number;
  // Topics of the post (empty array when none).
  tags: string[];
  language: string;
  // ISO date string; falls back to created_at if published_at is missing.
  publishedAt: string;
  // Owner first, then accepted co-authors by acceptance time.
  authors: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
  }[];
  author: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    bio: string;
  };
  // Accepted editors whose "Edited by" credit the author chose to show.
  editors: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
  }[];
};

// Accepted co-authors of a published post, ordered by acceptance time. The
// database function only returns accepted people on published posts. On an
// error the article still renders, with the owner alone.
async function getCoauthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
): Promise<
  { displayName: string; username: string; avatarUrl: string | null }[]
> {
  const { data, error } = await supabase.rpc("get_post_coauthors", {
    p_post_ids: [postId],
  });

  if (error || !data) {
    console.error("getCoauthors failed:", error);
    return [];
  }

  return data.map((row) => ({
    displayName: row.display_name,
    username: row.username,
    avatarUrl: safeAvatarUrl(row.avatar_url),
  }));
}

// Accepted editors of a published post whose author chose to show the credit
// (the database function leaves the others out). On an error the article still
// renders, without the "Edited by" line.
async function getEditors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
): Promise<
  { displayName: string; username: string; avatarUrl: string | null }[]
> {
  const { data, error } = await supabase.rpc("get_post_editors", {
    p_post_ids: [postId],
  });

  if (error || !data) {
    console.error("getEditors failed:", error);
    return [];
  }

  return data.map((row) => ({
    displayName: row.display_name,
    username: row.username,
    avatarUrl: safeAvatarUrl(row.avatar_url),
  }));
}

// Loads one published post for the public article page.
// Returns null when the author or the post does not exist, or the post is
// not published (a draft or an unpublished post must look like a 404).
// Wrapped in cache() so the page and generateMetadata (step 15) share one
// database round trip within the same request.
export const getPublishedPost = cache(
  async (username: string, slug: string): Promise<PublishedPost | null> => {
    const supabase = await createClient();

    // Usernames are stored lowercase; looking up the lowercase form means
    // /Alice/... and /alice/... both work, without a redirect.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (profileError) {
      console.error("getPublishedPost (profile) failed:", profileError);
      return null;
    }
    if (!profile || !profile.username) return null;

    // The explicit status filter hides the author's own drafts from the
    // public URL (RLS alone would let the author see them).
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select(
        "id, title, subtitle, content, excerpt, language, cover_image_url, reading_time_min, published_at, created_at, tags",
      )
      .eq("author_id", profile.id)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (postError) {
      console.error("getPublishedPost (post) failed:", postError);
      return null;
    }
    if (!post) return null;

    const parsed = docSchema.safeParse(post.content);
    return {
      id: post.id,
      authorId: profile.id,
      title: post.title,
      subtitle: post.subtitle ?? "",
      content: parsed.success ? parsed.data : EMPTY_DOC,
      excerpt: post.excerpt ?? "",
      coverImageUrl: safeCoverUrl(post.cover_image_url),
      readingTimeMin: post.reading_time_min ?? 1,
      tags: post.tags,
      language: post.language,
      publishedAt: post.published_at ?? post.created_at,
      authors: [
        {
          displayName: profile.display_name,
          username: profile.username,
          avatarUrl: safeAvatarUrl(profile.avatar_url),
        },
        ...(await getCoauthors(supabase, post.id)),
      ],
      editors: await getEditors(supabase, post.id),
      author: {
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: safeAvatarUrl(profile.avatar_url),
        bio: profile.bio ?? "",
      },
    };
  },
);

type Byline = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
};
type Supabase = Awaited<ReturnType<typeof createClient>>;

// The generated types say the arguments of get_published_post_ids are never
// null, but the database function accepts null (no author filter, first page,
// nothing excluded). `never` fits every argument type, so null is passed as is.
const NULL_ARG = null as unknown as never;

// One page of published post ids in final order (newest first). A post matches
// when its owner OR an accepted co-author is in `authorIds` (null = everyone).
async function getPostIdPage(
  supabase: Supabase,
  args: {
    authorIds: string[] | null;
    after: { publishedAt: string; id: string } | null;
    excludeId: string | null;
    limit: number;
  },
): Promise<string[] | null> {
  const { data, error } = await supabase.rpc("get_published_post_ids", {
    p_author_ids: args.authorIds ?? NULL_ARG,
    p_after_at: args.after?.publishedAt ?? NULL_ARG,
    p_after_id: args.after?.id ?? NULL_ARG,
    p_exclude_id: args.excludeId ?? NULL_ARG,
    p_limit: args.limit,
  });

  if (error || !data) {
    console.error("getPostIdPage failed:", error);
    return null;
  }
  return data.map((row) => row.post_id);
}

// Owner first, then accepted co-authors (by acceptance time), for many posts
// with one database call. `owners` maps post id -> its owner.
async function getBylinesByPost(
  supabase: Supabase,
  owners: Map<string, Byline>,
): Promise<Map<string, Byline[]>> {
  const result = new Map<string, Byline[]>();
  for (const [postId, owner] of owners) result.set(postId, [owner]);
  if (owners.size === 0) return result;

  const { data, error } = await supabase.rpc("get_post_coauthors", {
    p_post_ids: [...owners.keys()],
  });
  if (error || !data) {
    console.error("getBylinesByPost failed:", error);
    return result;
  }

  for (const row of data) {
    result.get(row.post_id)?.push({
      displayName: row.display_name,
      username: row.username,
      avatarUrl: safeAvatarUrl(row.avatar_url),
    });
  }
  return result;
}

export type PublishedPostListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  readingTimeMin: number;
  // ISO date string; falls back to created_at if published_at is missing.
  publishedAt: string;
  // Owner first, then accepted co-authors.
  authors: Byline[];
};

// Loads the posts with these ids and returns them in the SAME order as `ids`
// (an `in` query does not keep the order).
export async function loadPostsInOrder(
  supabase: Supabase,
  ids: string[],
): Promise<PublishedPostListItem[]> {
  if (ids.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, slug, excerpt, cover_image_url, reading_time_min, published_at, created_at",
    )
    .in("id", ids)
    .eq("status", "published");

  if (error || !rows) {
    console.error("loadPostsInOrder failed:", error);
    return [];
  }

  const ownerIds = [...new Set(rows.map((row) => row.author_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ownerIds);

  if (profilesError || !profiles) {
    console.error("loadPostsInOrder (profiles) failed:", profilesError);
    return [];
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const owners = new Map<string, Byline>();
  for (const row of rows) {
    const owner = profileById.get(row.author_id);
    if (!owner || !owner.username) continue;
    owners.set(row.id, {
      displayName: owner.display_name,
      username: owner.username,
      avatarUrl: safeAvatarUrl(owner.avatar_url),
    });
  }

  const bylines = await getBylinesByPost(supabase, owners);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const items: PublishedPostListItem[] = [];
  for (const id of ids) {
    const row = rowById.get(id);
    const authors = bylines.get(id);
    if (!row || !authors) continue;
    items.push({
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt ?? "",
      coverImageUrl: safeCoverUrl(row.cover_image_url),
      readingTimeMin: row.reading_time_min ?? 1,
      publishedAt: row.published_at ?? row.created_at,
      authors,
    });
  }
  return items;
}

// Lists the posts of one person, newest first: posts they own AND posts where
// they are an accepted co-author. Only published posts, so drafts stay out of
// the public profile page.
export async function listPublishedPostsByAuthor(
  authorId: string,
  options: { excludeId?: string; limit?: number } = {},
): Promise<PublishedPostListItem[]> {
  const supabase = await createClient();

  const ids = await getPostIdPage(supabase, {
    authorIds: [authorId],
    after: null,
    // Used by the article page to leave out the post that is being read.
    excludeId: options.excludeId ?? null,
    limit: options.limit ?? LIST_LIMIT,
  });
  if (!ids) return [];

  return loadPostsInOrder(supabase, ids);
}

// The Popular tab: the best-scoring published posts of the last 14 days
// (score and window are in the database function, migration 0020).
export async function listPopularPosts(): Promise<PublishedPostListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_popular_post_ids", {
    p_days: 14,
    p_limit: 30,
  });
  if (error || !data) {
    console.error("listPopularPosts failed:", error);
    return [];
  }
  return loadPostsInOrder(
    supabase,
    data.map((row) => row.post_id),
  );
}

// The For you tab: posts that match the topics and authors this person likes,
// saves, reads or follows (database function of migration 0094). When there
// are few, the Popular posts fill the rest. `personalized` is false when
// nothing could be matched (a new reader).
export async function listForYouPosts(): Promise<{
  posts: PublishedPostListItem[];
  personalized: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_for_you_post_ids", {
    p_days: 60,
    p_limit: 30,
  });
  if (error) console.error("listForYouPosts failed:", error);

  const mine =
    data && !error
      ? await loadPostsInOrder(
          supabase,
          data.map((row) => row.post_id),
        )
      : [];
  if (mine.length >= 10) return { posts: mine, personalized: true };

  // The filler comes from Popular, so it must follow the same rules as the
  // database ranking: nothing of mine, nothing I already liked, saved or
  // read to the end.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const skip = new Set(mine.map((post) => post.id));
  if (uid) {
    const [liked, saved, readDone, own] = await Promise.all([
      supabase.from("likes").select("post_id").eq("user_id", uid),
      supabase.from("bookmarks").select("post_id").eq("user_id", uid),
      supabase
        .from("reading_progress")
        .select("post_id")
        .eq("user_id", uid)
        .gte("progress", 0.9),
      supabase.from("posts").select("id").eq("author_id", uid),
    ]);
    for (const row of liked.data ?? []) skip.add(row.post_id);
    for (const row of saved.data ?? []) skip.add(row.post_id);
    for (const row of readDone.data ?? []) skip.add(row.post_id);
    for (const row of own.data ?? []) skip.add(row.id);
  }

  const popular = await listPopularPosts();
  const fresh = popular.filter((post) => !skip.has(post.id));
  // Hidden authors and topics stay out of the filler too.
  return {
    posts: [...mine, ...(uid ? await filterHiddenForYou(uid, fresh) : fresh)],
    personalized: mine.length > 0,
  };
}

// Published posts for these ids, in the SAME order as `ids` (the saved list).
// Ids of unpublished or deleted posts are simply left out.
export async function listPublishedPostsByIds(
  ids: string[],
): Promise<PublishedPostListItem[]> {
  const supabase = await createClient();
  return loadPostsInOrder(supabase, ids);
}

export type FeedPost = {
  id: string;
  // Owner first, then accepted co-authors.
  authors: Byline[];
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  readingTimeMin: number;
  publishedAt: string;
  // The owner (same as authors[0]); kept until every caller uses `authors`.
  author: Byline;
};

export type FeedPage = {
  posts: FeedPost[];
  // null when this is the last page.
  nextCursor: string | null;
};

// Number of posts per home page. Lower it to 2 to test pagination with few posts.
export const FEED_PAGE_SIZE = 10;

const cursorSchema = z.object({
  publishedAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

// A cursor is "<published_at>_<id>" of the last post on the previous page.
// It comes from the URL, so it is validated; anything invalid is ignored and
// the newest page is shown instead.
export function parseCursor(raw: string | undefined) {
  if (!raw) return null;
  const split = raw.lastIndexOf("_");
  if (split === -1) return null;
  const parsed = cursorSchema.safeParse({
    publishedAt: raw.slice(0, split),
    id: raw.slice(split + 1),
  });
  return parsed.success ? parsed.data : null;
}

// Home feed: latest published posts from all authors, newest first, with a
// keyset cursor (published_at desc, then id desc) so the order is stable.
export async function listPublishedPosts(
  rawCursor?: string,
  // When given, only posts whose owner or an accepted co-author is in this
  // list (the Following tab).
  options: { authorIds?: string[] } = {},
): Promise<FeedPage> {
  // An empty list means "nobody": no query needed.
  if (options.authorIds && options.authorIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const supabase = await createClient();

  const ids = await getPostIdPage(supabase, {
    authorIds: options.authorIds ?? null,
    after: parseCursor(rawCursor),
    excludeId: null,
    // One extra row tells us whether another page exists.
    limit: FEED_PAGE_SIZE + 1,
  });
  if (!ids || ids.length === 0) return { posts: [], nextCursor: null };

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

// The newest published stories of all authors, for the site-wide RSS feed.
// Unpublished and hidden stories are already left out by the database
// function behind getPostIdPage.
export async function listRecentPublishedPosts(
  limit: number,
): Promise<PublishedPostListItem[]> {
  const supabase = await createClient();

  const ids = await getPostIdPage(supabase, {
    authorIds: null,
    after: null,
    excludeId: null,
    limit,
  });
  if (!ids || ids.length === 0) return [];

  return loadPostsInOrder(supabase, ids);
}

export type FollowingFeedPost = FeedPost & {
  // Set when the post is here because someone I follow reposted it.
  repostedBy: Byline | null;
  // The reposter's caption, when they wrote one.
  repostCaption: string | null;
  // Id of the person who reposted (needed to report the caption).
  reposterId: string | null;
};

export type FollowingFeedPage = {
  posts: FollowingFeedPost[];
  // null when this is the last page.
  nextCursor: string | null;
};

// The Following tab: posts of the people I follow AND posts they reposted,
// one row per post, newest event first (the database function is in
// migration 0024). The cursor is "<event_at>_<post id>".
export async function listFollowingFeed(
  rawCursor: string | undefined,
  authorIds: string[],
): Promise<FollowingFeedPage> {
  // An empty list means "nobody": no query needed.
  if (authorIds.length === 0) return { posts: [], nextCursor: null };

  const supabase = await createClient();
  const after = parseCursor(rawCursor);

  const { data, error } = await supabase.rpc("get_following_feed", {
    p_author_ids: authorIds,
    p_after_at: after?.publishedAt ?? NULL_ARG,
    p_after_id: after?.id ?? NULL_ARG,
    // One extra row tells us whether another page exists.
    p_limit: FEED_PAGE_SIZE + 1,
  });
  if (error || !data) {
    console.error("listFollowingFeed failed:", error);
    return { posts: [], nextCursor: null };
  }
  if (data.length === 0) return { posts: [], nextCursor: null };

  const hasMore = data.length > FEED_PAGE_SIZE;
  const rows = hasMore ? data.slice(0, FEED_PAGE_SIZE) : data;

  const items = await loadPostsInOrder(
    supabase,
    rows.map((row) => row.post_id),
  );
  const itemById = new Map(items.map((item) => [item.id, item]));

  // Names of the people who reposted (one query for all of them).
  const reposterIds = [
    ...new Set(rows.flatMap((row) => (row.reposter_id ? [row.reposter_id] : []))),
  ];
  const reposters = new Map<string, Byline>();
  if (reposterIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", reposterIds);
    if (profilesError) {
      console.error("listFollowingFeed (profiles) failed:", profilesError);
    }
    for (const profile of profiles ?? []) {
      if (!profile.username) continue;
      reposters.set(profile.id, {
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: safeAvatarUrl(profile.avatar_url),
      });
    }
  }

  // Captions of those reposts (one query). Pairs are matched in code, since
  // the query may return a few extra (reposter, post) pairs.
  const captions = new Map<string, string>();
  const repostedRows = rows.filter((row) => row.reposter_id);
  if (repostedRows.length > 0) {
    const { data: captionRows, error: captionError } = await supabase
      .from("reposts")
      .select("user_id, post_id, caption")
      .in(
        "post_id",
        repostedRows.map((row) => row.post_id),
      )
      .in("user_id", reposterIds)
      .not("caption", "is", null);
    if (captionError) {
      console.error("listFollowingFeed (captions) failed:", captionError);
    }
    for (const c of captionRows ?? []) {
      if (c.caption) captions.set(`${c.user_id}_${c.post_id}`, c.caption);
    }
  }

  const posts: FollowingFeedPost[] = [];
  for (const row of rows) {
    const item = itemById.get(row.post_id);
    const owner = item?.authors[0];
    // An unpublished or deleted post drops out silently.
    if (!item || !owner) continue;
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
      repostedBy: row.reposter_id
        ? (reposters.get(row.reposter_id) ?? null)
        : null,
      repostCaption: row.reposter_id
        ? (captions.get(`${row.reposter_id}_${row.post_id}`) ?? null)
        : null,
      reposterId: row.reposter_id ?? null,
    });
  }

  const lastRow = rows[rows.length - 1];
  const nextCursor =
    hasMore && lastRow ? `${lastRow.event_at}_${lastRow.post_id}` : null;

  return { posts, nextCursor };
}
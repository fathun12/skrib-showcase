import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";

// At most this many top-level comments per post (no pagination yet).
const TOP_LEVEL_LIMIT = 100;
// Replies of those comments (each person has at most 20 comments per post).
const REPLY_LIMIT = 500;
// Profile ids per lookup (keeps the request URL short, like the sitemap).
const ID_CHUNK = 100;

export type CommentAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type CommentItem = {
  id: string;
  body: string;
  // Respond: the quoted passage (top-level comments only), plain text.
  quote: string | null;
  createdAt: string;
  author: CommentAuthor;
  // Lowercase usernames this comment mentions (from the database).
  mentions: string[];
};

export type CommentThread = CommentItem & { replies: CommentItem[] };

type CommentRow = {
  id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  quote?: string | null;
  created_at: string;
};

// Comments of one published post: top-level comments oldest first, each with
// its replies (oldest first). Returns null when a request fails, so the page
// can say so instead of showing "no comments yet".
export async function listComments(
  postId: string,
): Promise<CommentThread[] | null> {
  const supabase = await createClient();

  const { data: tops, error } = await supabase
    .from("comments")
    .select("id, parent_id, author_id, body, quote, created_at")
    .eq("post_id", postId)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .limit(TOP_LEVEL_LIMIT);

  if (error || !tops) {
    console.error("listComments failed:", error);
    return null;
  }
  if (tops.length === 0) return [];

  const { data: replies, error: repliesError } = await supabase
    .from("comments")
    .select("id, parent_id, author_id, body, created_at")
    .in(
      "parent_id",
      tops.map((row) => row.id),
    )
    .order("created_at", { ascending: true })
    .limit(REPLY_LIMIT);

  if (repliesError || !replies) {
    console.error("listComments (replies) failed:", repliesError);
    return null;
  }

  // One small lookup per 100 writers.
  const authorIds = [
    ...new Set([...tops, ...replies].map((row) => row.author_id)),
  ];
  const authors = new Map<string, CommentAuthor>();
  for (let i = 0; i < authorIds.length; i += ID_CHUNK) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", authorIds.slice(i, i + ID_CHUNK));

    if (profilesError || !profiles) {
      console.error("listComments (profiles) failed:", profilesError);
      return null;
    }
    for (const profile of profiles) {
      // No username = onboarding not finished: no profile to link to.
      if (!profile.username) continue;
      authors.set(profile.id, {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: safeAvatarUrl(profile.avatar_url),
      });
    }
  }

  // Who each comment mentions, in chunks of 100 like the profile lookup. A
  // failure only means the mentions show as plain text.
  const commentIds = [...tops, ...replies].map((row) => row.id);
  const mentionedIds = new Map<string, string[]>();
  for (let i = 0; i < commentIds.length; i += ID_CHUNK) {
    const { data: mentionRows, error: mentionError } = await supabase
      .from("comment_mentions")
      .select("comment_id, user_id")
      .in("comment_id", commentIds.slice(i, i + ID_CHUNK));
    if (mentionError) {
      console.error("listComments (mentions) failed:", mentionError);
      continue;
    }
    for (const row of mentionRows ?? []) {
      const list = mentionedIds.get(row.comment_id) ?? [];
      list.push(row.user_id);
      mentionedIds.set(row.comment_id, list);
    }
  }
  const mentionedProfileIds = [...new Set([...mentionedIds.values()].flat())];
  const usernames = new Map<string, string>();
  for (let i = 0; i < mentionedProfileIds.length; i += ID_CHUNK) {
    const { data: nameRows, error: nameError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", mentionedProfileIds.slice(i, i + ID_CHUNK));
    if (nameError) {
      console.error("listComments (mention names) failed:", nameError);
      continue;
    }
    for (const row of nameRows ?? []) {
      if (row.username) usernames.set(row.id, row.username);
    }
  }
  const mentionsByComment = new Map<string, string[]>();
  for (const [commentId, ids] of mentionedIds) {
    const names = ids.flatMap((id) => {
      const name = usernames.get(id);
      return name ? [name] : [];
    });
    if (names.length > 0) mentionsByComment.set(commentId, names);
  }

  function toItem(row: CommentRow): CommentItem | null {
    const author = authors.get(row.author_id);
    if (!author) return null;
    return {
      id: row.id,
      body: row.body,
      quote: row.quote ?? null,
      createdAt: row.created_at,
      author,
      mentions: mentionsByComment.get(row.id) ?? [],
    };
  }

  const repliesByParent = new Map<string, CommentItem[]>();
  for (const row of replies) {
    const item = toItem(row);
    if (!item || !row.parent_id) continue;
    const list = repliesByParent.get(row.parent_id) ?? [];
    list.push(item);
    repliesByParent.set(row.parent_id, list);
  }

  const threads: CommentThread[] = [];
  for (const row of tops) {
    const item = toItem(row);
    if (!item) continue;
    threads.push({ ...item, replies: repliesByParent.get(row.id) ?? [] });
  }
  return threads;
}

// Comment counts (replies included) for several posts in one request.
// Posts without comments are not in the map: use `?? 0`. Returns null when
// the request fails, so the page hides the number instead of showing a false 0.
export async function getCommentCounts(
  postIds: string[],
): Promise<Map<string, number> | null> {
  if (postIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_comment_counts", {
    post_ids: postIds,
  });

  if (error || !data) {
    console.error("getCommentCounts failed:", error);
    return null;
  }
  return new Map(data.map((row) => [row.post_id, row.comment_count]));
}
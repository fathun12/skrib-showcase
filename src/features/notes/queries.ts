import { z } from "zod";
import { listFollowingIds } from "@/features/follows/queries";
import {
  cleanSearchQuery,
  SEARCH_MAX_PAGE,
  SEARCH_QUERY_MIN,
} from "@/features/search/queries";
import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";
import { isValidTag } from "@/ui/tags";
import type { NoteReplyPolicy } from "./schemas";

// Notes per page. One more is fetched to know whether another page exists.
const NOTE_PAGE = 20;
// Profile ids per lookup (keeps the request URL short).
const ID_CHUNK = 100;

export type NoteAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// A published story shared into a note.
export type NoteSharedStory = {
  title: string;
  slug: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  coverUrl: string | null;
  excerpt: string;
  readingMinutes: number | null;
};

// The note a quote note quotes. One level only: the quoted note's own quote
// is never loaded. "deleted" = the quoted note was deleted; "unavailable" =
// it is hidden by a moderator, or its author is muted or blocked.
export type NoteQuote =
  | {
      state: "available";
      id: string;
      body: string;
      createdAt: string;
      author: NoteAuthor;
    }
  | { state: "deleted" }
  | { state: "unavailable" };

// published = public; hidden = hidden by a moderator; hidden_by_author =
// hidden by the author of the note it replies to.
export type NoteStatus = "published" | "hidden" | "hidden_by_author";

// One image of a note (alt is "" when the writer gave no description).
export type NoteImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

export type NoteItem = {
  id: string;
  body: string;
  createdAt: string;
  replyPolicy: NoteReplyPolicy;
  // false = hidden: only its author sees it (and admins).
  published: boolean;
  status: NoteStatus;
  // true = this note is a reply to another note.
  isReply: boolean;
  // When the text was last edited (null = never).
  editedAt: string | null;
  author: NoteAuthor;
  // null = no story shared, or the story is gone or not published.
  sharedStory: NoteSharedStory | null;
  // true = the note shares a story the viewer cannot see (hidden or
  // unpublished). A deleted story sets shared_post_id to null: nothing shows.
  storyUnavailable: boolean;
  // The passage quoted from the shared story (null: none, or the story is
  // not available).
  storyQuote: string | null;
  // null = this note does not quote another note.
  quote: NoteQuote | null;
  // null = the count could not be loaded (the button hides the number).
  likeCount: number | null;
  // null = the count could not be loaded.
  replyCount: number | null;
  // null = the count could not be loaded.
  repostCount: number | null;
  // Whether the viewer has liked it (false for a signed-out visitor).
  liked: boolean;
  // Whether the viewer has reposted it (false for a signed-out visitor).
  reposted: boolean;
  // Set only in the Following list: the person I follow who reposted it.
  repostedBy: NoteAuthor | null;
  // Lowercase usernames of the people this note mentions (they get links).
  mentions: string[];
  // Up to 4 images, in order (empty = none).
  images: NoteImage[];
};

export type NoteLookup =
  | { status: "found"; note: NoteItem }
  | { status: "missing" }
  | { status: "error" };

// Why the viewer can or cannot reply to a note.
export type ReplyAccess =
  | "allowed"
  | "signed_out"
  | "nobody"
  | "following_only";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type NoteRow = {
  id: string;
  author_id: string;
  body: string;
  reply_policy: string;
  status: string;
  created_at: string;
  shared_post_id: string | null;
  quote_note_id: string | null;
  quote_removed: boolean;
  reply_to_id: string | null;
  edited_at: string | null;
};

type SharedPostRow = {
  id: string;
  author_id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  excerpt: string | null;
  reading_time_min: number | null;
};

type QuotedRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

const NOTE_COLUMNS =
  "id, author_id, body, reply_policy, status, created_at, shared_post_id, quote_note_id, quote_removed, reply_to_id, edited_at";

// "(id1,id2)" for a PostgREST not-in filter. The ids come from the database.
function inList(ids: string[]): string {
  return `(${ids.join(",")})`;
}

// Authors whose notes the viewer must not see in lists: people he muted and
// people who blocked him. A failed lookup returns an empty list (the notes
// are public anyway) and is logged.
async function hiddenAuthorIds(
  supabase: ServerClient,
  viewerId: string | null,
): Promise<string[]> {
  if (!viewerId) return [];
  const { data, error } = await supabase.rpc("my_hidden_note_authors");
  if (error || !data) {
    console.error("hiddenAuthorIds failed:", error);
    return [];
  }
  return data;
}

function toStatus(value: string): NoteStatus {
  return value === "hidden" || value === "hidden_by_author"
    ? value
    : "published";
}

function toPolicy(value: string): NoteReplyPolicy {
  return value === "following" || value === "nobody" ? value : "everyone";
}

// Like counts and the viewer's own likes for several notes, two requests.
async function loadLikes(
  supabase: ServerClient,
  noteIds: string[],
  viewerId: string | null,
): Promise<{ counts: Map<string, number> | null; liked: Set<string> }> {
  const [countsResult, likedResult] = await Promise.all([
    supabase.rpc("get_note_like_counts", { note_ids: noteIds }),
    viewerId
      ? supabase
          .from("note_likes")
          .select("note_id")
          .eq("user_id", viewerId)
          .in("note_id", noteIds)
      : Promise.resolve({ data: [] as { note_id: string }[], error: null }),
  ]);

  let counts: Map<string, number> | null = null;
  if (countsResult.error || !countsResult.data) {
    console.error("notes (like counts) failed:", countsResult.error);
  } else {
    counts = new Map(
      countsResult.data.map((row) => [row.note_id, row.like_count]),
    );
  }

  if (likedResult.error) {
    console.error("notes (own likes) failed:", likedResult.error);
  }
  const liked = new Set((likedResult.data ?? []).map((row) => row.note_id));
  return { counts, liked };
}

// Repost counts and the viewer's own reposts for several notes, two requests.
async function loadReposts(
  supabase: ServerClient,
  noteIds: string[],
  viewerId: string | null,
): Promise<{ counts: Map<string, number> | null; reposted: Set<string> }> {
  const [countsResult, repostedResult] = await Promise.all([
    supabase.rpc("get_note_repost_counts", { note_ids: noteIds }),
    viewerId
      ? supabase
          .from("note_reposts")
          .select("note_id")
          .eq("user_id", viewerId)
          .in("note_id", noteIds)
      : Promise.resolve({ data: [] as { note_id: string }[], error: null }),
  ]);

  let counts: Map<string, number> | null = null;
  if (countsResult.error || !countsResult.data) {
    console.error("notes (repost counts) failed:", countsResult.error);
  } else {
    counts = new Map(
      countsResult.data.map((row) => [row.note_id, Number(row.repost_count)]),
    );
  }

  if (repostedResult.error) {
    console.error("notes (own reposts) failed:", repostedResult.error);
  }
  const reposted = new Set(
    (repostedResult.data ?? []).map((row) => row.note_id),
  );
  return { counts, reposted };
}

// Published replies per note. Notes without replies are absent from the map.
async function loadReplyCounts(
  supabase: ServerClient,
  noteIds: string[],
): Promise<Map<string, number> | null> {
  const { data, error } = await supabase.rpc("get_note_reply_counts", {
    note_ids: noteIds,
  });
  if (error || !data) {
    console.error("notes (reply counts) failed:", error);
    return null;
  }
  return new Map(data.map((row) => [row.note_id, row.reply_count]));
}

// The usernames mentioned in these notes. note_mentions is filled by the
// database (only people who exist, never someone who blocked the author), so
// only these names become links. A failed lookup leaves the mentions as plain
// text; the notes still show.
async function loadMentions(
  supabase: ServerClient,
  noteIds: string[],
): Promise<Map<string, string[]>> {
  const byNote = new Map<string, string[]>();
  const { data: rows, error } = await supabase
    .from("note_mentions")
    .select("note_id, user_id")
    .in("note_id", noteIds);
  if (error || !rows) {
    console.error("notes (mentions) failed:", error);
    return byNote;
  }
  if (rows.length === 0) return byNote;

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds);
  if (profileError || !profiles) {
    console.error("notes (mention profiles) failed:", profileError);
    return byNote;
  }
  const names = new Map<string, string>();
  for (const profile of profiles) {
    if (profile.username) names.set(profile.id, profile.username);
  }
  for (const row of rows) {
    const name = names.get(row.user_id);
    if (!name) continue;
    byNote.set(row.note_id, [...(byNote.get(row.note_id) ?? []), name]);
  }
  return byNote;
}

// The images of these notes, in order. A failed lookup leaves the notes
// without images (they still show) and is logged.
async function loadNoteImages(
  supabase: ServerClient,
  noteIds: string[],
): Promise<Map<string, NoteImage[]>> {
  const byNote = new Map<string, NoteImage[]>();
  for (let i = 0; i < noteIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("note_images")
      .select("note_id, position, url, width, height, alt")
      .in("note_id", noteIds.slice(i, i + ID_CHUNK))
      .order("position", { ascending: true });
    if (error || !data) {
      console.error("notes (images) failed:", error);
      continue;
    }
    for (const row of data) {
      byNote.set(row.note_id, [
        ...(byNote.get(row.note_id) ?? []),
        {
          url: row.url,
          width: row.width,
          height: row.height,
          alt: row.alt ?? "",
        },
      ]);
    }
  }
  return byNote;
}

// The published stories shared by these notes. A story that is gone or not
// published is simply absent. A failed lookup also leaves it out (the note
// itself still shows).
async function loadSharedPosts(
  supabase: ServerClient,
  rows: NoteRow[],
): Promise<Map<string, SharedPostRow>> {
  const postIds = [
    ...new Set(
      rows.flatMap((row) => (row.shared_post_id ? [row.shared_post_id] : [])),
    ),
  ];
  const posts = new Map<string, SharedPostRow>();
  for (let i = 0; i < postIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, author_id, slug, title, cover_image_url, excerpt, reading_time_min",
      )
      .eq("status", "published")
      .in("id", postIds.slice(i, i + ID_CHUNK));

    if (error || !data) {
      console.error("notes (shared stories) failed:", error);
      continue;
    }
    for (const post of data) posts.set(post.id, post);
  }
  return posts;
}

// The passages quoted from shared stories, by note id. RLS shows a quote only
// while the note and its story are visible. A failed load leaves the notes
// without a quote and is logged.
async function loadStoryQuotes(
  supabase: ServerClient,
  rows: NoteRow[],
): Promise<Map<string, string>> {
  const noteIds = rows.flatMap((row) => (row.shared_post_id ? [row.id] : []));
  const quotes = new Map<string, string>();
  for (let i = 0; i < noteIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("note_story_quotes")
      .select("note_id, quote")
      .in("note_id", noteIds.slice(i, i + ID_CHUNK));

    if (error || !data) {
      console.error("notes (story quotes) failed:", error);
      continue;
    }
    for (const row of data) quotes.set(row.note_id, row.quote);
  }
  return quotes;
}

// The published notes that these notes quote. A quoted note that is hidden,
// or whose author the viewer muted or who blocked the viewer, is simply
// absent (the card then shows "not available"). A failed lookup also leaves
// it out (the note itself still shows).
async function loadQuotedNotes(
  supabase: ServerClient,
  rows: NoteRow[],
  viewerId: string | null,
): Promise<Map<string, QuotedRow>> {
  const quotedIds = [
    ...new Set(
      rows.flatMap((row) => (row.quote_note_id ? [row.quote_note_id] : [])),
    ),
  ];
  const quoted = new Map<string, QuotedRow>();
  if (quotedIds.length === 0) return quoted;

  const hidden = new Set(await hiddenAuthorIds(supabase, viewerId));
  for (let i = 0; i < quotedIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("notes")
      .select("id, author_id, body, created_at")
      .eq("status", "published")
      .in("id", quotedIds.slice(i, i + ID_CHUNK));

    if (error || !data) {
      console.error("notes (quoted notes) failed:", error);
      continue;
    }
    for (const note of data) {
      if (!hidden.has(note.author_id)) quoted.set(note.id, note);
    }
  }
  return quoted;
}

function toQuote(
  row: NoteRow,
  quoted: Map<string, QuotedRow>,
  authors: Map<string, NoteAuthor>,
): NoteQuote | null {
  if (row.quote_removed) return { state: "deleted" };
  if (!row.quote_note_id) return null;
  const note = quoted.get(row.quote_note_id);
  const author = note ? authors.get(note.author_id) : undefined;
  if (!note || !author) return { state: "unavailable" };
  return {
    state: "available",
    id: note.id,
    body: note.body,
    createdAt: note.created_at,
    author,
  };
}

// Adds the author profile, the shared story, the quote, the likes, the
// reposts and the reply counts to each row. `repostedBy` maps a note id to
// the person who reposted it (Following list only). Returns null when the
// profile lookup fails.
async function toItems(
  supabase: ServerClient,
  rows: NoteRow[],
  viewerId: string | null,
  repostedBy: ReadonlyMap<string, string> = new Map(),
): Promise<NoteItem[] | null> {
  if (rows.length === 0) return [];

  const [sharedPosts, quotedNotes] = await Promise.all([
    loadSharedPosts(supabase, rows),
    loadQuotedNotes(supabase, rows, viewerId),
  ]);

  const storyQuotes = await loadStoryQuotes(supabase, rows);

  // The authors of the notes, of the shared stories and of the quoted notes,
  // and the people who reposted.
  const authorIds = [
    ...new Set([
      ...rows.map((row) => row.author_id),
      ...[...sharedPosts.values()].map((post) => post.author_id),
      ...[...quotedNotes.values()].map((note) => note.author_id),
      ...repostedBy.values(),
    ]),
  ];
  const authors = new Map<string, NoteAuthor>();
  for (let i = 0; i < authorIds.length; i += ID_CHUNK) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", authorIds.slice(i, i + ID_CHUNK));

    if (error || !profiles) {
      console.error("notes (profiles) failed:", error);
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

  const noteIds = rows.map((row) => row.id);
  const [likes, reposts, replyCounts, mentionsByNote, imagesByNote] =
    await Promise.all([
      loadLikes(supabase, noteIds, viewerId),
      loadReposts(supabase, noteIds, viewerId),
      loadReplyCounts(supabase, noteIds),
      loadMentions(supabase, noteIds),
      loadNoteImages(supabase, noteIds),
    ]);

  const items: NoteItem[] = [];
  for (const row of rows) {
    const author = authors.get(row.author_id);
    if (!author) continue;

    const post = row.shared_post_id
      ? sharedPosts.get(row.shared_post_id)
      : undefined;
    const postAuthor = post ? authors.get(post.author_id) : undefined;
    const reposterId = repostedBy.get(row.id);

    items.push({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      replyPolicy: toPolicy(row.reply_policy),
      published: row.status === "published",
      status: toStatus(row.status),
      isReply: row.reply_to_id !== null,
      editedAt: row.edited_at,
      author,
      sharedStory:
        post && postAuthor
          ? {
              title: post.title,
              slug: post.slug,
              authorUsername: postAuthor.username,
              authorDisplayName: postAuthor.displayName,
              authorAvatarUrl: postAuthor.avatarUrl,
              coverUrl: post.cover_image_url,
              excerpt: post.excerpt ?? "",
              readingMinutes: post.reading_time_min,
            }
          : null,
      storyUnavailable: row.shared_post_id !== null && !post,
      storyQuote: post ? (storyQuotes.get(row.id) ?? null) : null,
      quote: toQuote(row, quotedNotes, authors),
      likeCount: likes.counts ? (likes.counts.get(row.id) ?? 0) : null,
      replyCount: replyCounts ? (replyCounts.get(row.id) ?? 0) : null,
      repostCount: reposts.counts ? (reposts.counts.get(row.id) ?? 0) : null,
      liked: likes.liked.has(row.id),
      reposted: reposts.reposted.has(row.id),
      repostedBy: reposterId ? (authors.get(reposterId) ?? null) : null,
      mentions: mentionsByNote.get(row.id) ?? [],
      images: imagesByNote.get(row.id) ?? [],
    });
  }
  return items;
}

// One page of notes, and where the next page starts (null = no more).
export type NotePage = { items: NoteItem[]; nextCursor: string | null };

type Cursor = { at: string; id: string };

const CURSOR_AT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

// A cursor is "<created_at>|<id>" of the last note shown. The strict check
// also keeps odd text out of the filter string built below.
function parseCursor(raw: string): Cursor | null {
  const [at, id, extra] = raw.split("|");
  if (extra !== undefined || !at || !id) return null;
  if (!CURSOR_AT.test(at) || !z.uuid().safeParse(id).success) return null;
  return { at, id };
}

// The rows after the cursor, in the order of the list: "older" for lists
// that run newest first, "newer" for lists that run oldest first.
function cursorFilter(cursor: Cursor, direction: "older" | "newer"): string {
  const op = direction === "older" ? "lt" : "gt";
  return `created_at.${op}.${cursor.at},and(created_at.eq.${cursor.at},id.${op}.${cursor.id})`;
}

// Cuts the extra row, builds the next cursor from the last row shown, and
// adds profiles, likes and counts. Returns null when a request fails.
async function toPage(
  supabase: ServerClient,
  rows: NoteRow[],
  viewerId: string | null,
): Promise<NotePage | null> {
  const hasMore = rows.length > NOTE_PAGE;
  const shown = hasMore ? rows.slice(0, NOTE_PAGE) : rows;
  const last = shown[shown.length - 1];
  const items = await toItems(supabase, shown, viewerId);
  if (!items) return null;
  return {
    items,
    nextCursor: hasMore && last ? `${last.created_at}|${last.id}` : null,
  };
}

// The published rows for ranked ids, put back in the order of the ids.
async function loadNotesInOrder(
  supabase: ServerClient,
  ids: string[],
): Promise<NoteRow[] | null> {
  const { data: rows, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("status", "published")
    .in("id", ids);
  if (error || !rows) {
    console.error("loadNotesInOrder failed:", error);
    return null;
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const note = byId.get(id);
    return note ? [note] : [];
  });
}

// Newest top-level notes of everyone, one page. Returns null when a request
// fails, so the page can say so instead of showing "no notes yet".
export async function listLatestNotes(
  viewerId: string | null,
  cursorText?: string,
): Promise<NotePage | null> {
  const cursor = cursorText === undefined ? undefined : parseCursor(cursorText);
  if (cursor === null) return null;

  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const base = supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("status", "published")
    .is("reply_to_id", null);
  const visible =
    hidden.length > 0 ? base.not("author_id", "in", inList(hidden)) : base;
  const { data, error } = await (
    cursor ? visible.or(cursorFilter(cursor, "older")) : visible
  )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTE_PAGE + 1);

  if (error || !data) {
    console.error("listLatestNotes failed:", error);
    return null;
  }
  return toPage(supabase, data, viewerId);
}

// Newest top-level notes of one author (profile tab), one page.
export async function listNotesByAuthor(
  authorId: string,
  viewerId: string | null,
  cursorText?: string,
): Promise<NotePage | null> {
  const cursor = cursorText === undefined ? undefined : parseCursor(cursorText);
  if (cursor === null) return null;

  const supabase = await createClient();

  // A person who blocked the viewer shows no notes on his profile (as if he
  // had none), so the block is not revealed. A muted person shows normally.
  if (viewerId && viewerId !== authorId) {
    const { data: blocked, error: blockedError } = await supabase.rpc(
      "i_am_blocked_by",
      { p_author: authorId },
    );
    if (blockedError) {
      console.error("listNotesByAuthor (block check) failed:", blockedError);
    } else if (blocked) {
      return { items: [], nextCursor: null };
    }
  }

  const base = supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("author_id", authorId)
    .eq("status", "published")
    .is("reply_to_id", null);
  const { data, error } = await (
    cursor ? base.or(cursorFilter(cursor, "older")) : base
  )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTE_PAGE + 1);

  if (error || !data) {
    console.error("listNotesByAuthor failed:", error);
    return null;
  }
  return toPage(supabase, data, viewerId);
}

// For the first page of the Following list: a time and an id above every
// real note, so "after this" means "from the top" (the database function
// accepts null, but its generated type does not).
const TOP_AT = "9999-12-31T23:59:59Z";
const TOP_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

// Newest top-level notes of the people I follow, plus the notes of other
// people that they reposted (shown once, with the person who reposted it).
// The database function returns only ids, times and reposters, so the rows
// are loaded in a second request and put back in its order. The cursor is
// "<activity time>|<note id>": for a repost the activity time is the time of
// the repost, not the time the note was written. Returns null when a request
// fails.
export async function listFollowingNotes(
  viewerId: string,
  cursorText?: string,
): Promise<NotePage | null> {
  const cursor = cursorText === undefined ? undefined : parseCursor(cursorText);
  if (cursor === null) return null;

  const supabase = await createClient();
  // Muted people (and people who blocked me) are left out BEFORE the page is
  // cut, so every page stays full.
  const hiddenIds = await hiddenAuthorIds(supabase, viewerId);
  const hidden = new Set(hiddenIds);
  const authorIds = (await listFollowingIds(viewerId)).filter(
    (id) => !hidden.has(id),
  );
  if (authorIds.length === 0) return { items: [], nextCursor: null };

  const { data: feed, error } = await supabase.rpc("get_following_note_feed", {
    p_author_ids: authorIds,
    p_after_at: cursor?.at ?? TOP_AT,
    p_after_id: cursor?.id ?? TOP_ID,
    p_limit: NOTE_PAGE + 1,
    p_exclude: hiddenIds,
  });
  if (error || !feed) {
    console.error("listFollowingNotes failed:", error);
    return null;
  }
  if (feed.length === 0) return { items: [], nextCursor: null };

  const hasMore = feed.length > NOTE_PAGE;
  const shown = hasMore ? feed.slice(0, NOTE_PAGE) : feed;
  const last = shown[shown.length - 1];

  const ordered = await loadNotesInOrder(
    supabase,
    shown.map((row) => row.note_id),
  );
  if (!ordered) return null;

  const reposters = new Map<string, string>();
  for (const row of shown) {
    if (row.reposter_id) reposters.set(row.note_id, row.reposter_id);
  }

  const items = await toItems(supabase, ordered, viewerId, reposters);
  if (!items) return null;
  return {
    items,
    nextCursor: hasMore && last ? `${last.activity_at}|${last.note_id}` : null,
  };
}

// The Popular chip: the 30 best top-level notes of the last 7 days, ranked in
// the database (likes + replies, newest favoured). One ranked list: no cursor,
// no next page. Muted people and people who blocked the viewer are left out.
// Returns null when a request fails.
const POPULAR_DAYS = 7;
const POPULAR_LIMIT = 30;

export async function listPopularNotes(
  viewerId: string | null,
  limit: number = POPULAR_LIMIT,
): Promise<NotePage | null> {
  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const { data: ids, error } = await supabase.rpc("get_popular_note_ids", {
    p_days: POPULAR_DAYS,
    p_limit: limit,
    p_exclude: hidden,
  });
  if (error || !ids) {
    console.error("listPopularNotes failed:", error);
    return null;
  }
  if (ids.length === 0) return { items: [], nextCursor: null };

  const { data: rows, error: rowsError } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("status", "published")
    .in(
      "id",
      ids.map((row) => row.note_id),
    );
  if (rowsError || !rows) {
    console.error("listPopularNotes (rows) failed:", rowsError);
    return null;
  }

  // Put the rows back in the order of the ranking.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.flatMap((row) => {
    const note = byId.get(row.note_id);
    return note ? [note] : [];
  });
  const items = await toItems(supabase, ordered, viewerId);
  if (!items) return null;
  return { items, nextCursor: null };
}

// One note by id. RLS shows a published note to everyone, and a hidden note
// only to its author.
export async function getNote(
  noteId: string,
  viewerId: string | null,
): Promise<NoteLookup> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    console.error("getNote failed:", error);
    return { status: "error" };
  }
  if (!data) return { status: "missing" };

  const items = await toItems(supabase, [data], viewerId);
  if (!items) return { status: "error" };
  // No author profile (onboarding not finished): nothing to show.
  if (items.length === 0) return { status: "missing" };
  return { status: "found", note: items[0] };
}

// Small public summary for the page title and the share preview.
export async function getNoteSummary(
  noteId: string,
): Promise<{ body: string; displayName: string } | null> {
  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("author_id, body")
    .eq("id", noteId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !note) {
    if (error) console.error("getNoteSummary failed:", error);
    return null;
  }

  const { data: author, error: authorError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", note.author_id)
    .maybeSingle();

  if (authorError || !author) {
    if (authorError) console.error("getNoteSummary (author) failed:", authorError);
    return null;
  }
  return { body: note.body, displayName: author.display_name };
}

// The notes this one replies to, oldest (the root) first. The chain stops at a
// parent the viewer may not see (RLS).
export async function listNoteAncestors(
  noteId: string,
  viewerId: string | null,
): Promise<NoteItem[] | null> {
  const supabase = await createClient();
  const { data: chain, error } = await supabase.rpc("get_note_ancestors", {
    p_note_id: noteId,
  });

  if (error || !chain) {
    console.error("listNoteAncestors failed:", error);
    return null;
  }
  if (chain.length === 0) return [];

  // The function returns the root first (deepest level first).
  const orderedIds = chain.map((row) => row.note_id);
  const { data: rows, error: rowsError } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .in("id", orderedIds);

  if (rowsError || !rows) {
    console.error("listNoteAncestors (rows) failed:", rowsError);
    return null;
  }

  const items = await toItems(supabase, rows, viewerId);
  if (!items) return null;
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

// Published replies to a note, oldest first, one page.
export async function listReplies(
  noteId: string,
  viewerId: string | null,
  cursorText?: string,
): Promise<NotePage | null> {
  const cursor = cursorText === undefined ? undefined : parseCursor(cursorText);
  if (cursor === null) return null;

  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const base = supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("reply_to_id", noteId)
    .eq("status", "published");
  const visible =
    hidden.length > 0 ? base.not("author_id", "in", inList(hidden)) : base;
  const { data, error } = await (
    cursor ? visible.or(cursorFilter(cursor, "newer")) : visible
  )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(NOTE_PAGE + 1);

  if (error || !data) {
    console.error("listReplies failed:", error);
    return null;
  }
  return toPage(supabase, data, viewerId);
}

// May this viewer reply to this note? The database enforces the same rule
// (can_reply_to_note); this only picks the right message and form.
export async function getReplyAccess(
  note: NoteItem,
  viewerId: string | null,
): Promise<ReplyAccess> {
  if (!viewerId) return "signed_out";
  if (note.author.id === viewerId) return "allowed";
  if (note.replyPolicy === "everyone") return "allowed";
  if (note.replyPolicy === "nobody") return "nobody";

  // "following": the author must follow the viewer.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", note.author.id)
    .eq("following_id", viewerId)
    .maybeSingle();

  if (error) {
    console.error("getReplyAccess failed:", error);
    return "following_only";
  }
  return data ? "allowed" : "following_only";
}

// Replies the author of this note has hidden, oldest first. The database
// function returns rows only when the caller is the author of the parent note.
export async function listHiddenReplies(
  parentId: string,
  viewerId: string | null,
): Promise<NoteItem[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_hidden_replies", {
    p_parent_id: parentId,
  });

  if (error || !data) {
    console.error("listHiddenReplies failed:", error);
    return null;
  }

  const rows: NoteRow[] = data.map((row) => ({
    id: row.id,
    author_id: row.author_id,
    body: row.body,
    reply_policy: "everyone",
    status: "hidden_by_author",
    created_at: row.created_at,
    shared_post_id: null,
    quote_note_id: null,
    quote_removed: false,
    reply_to_id: parentId,
    edited_at: null,
  }));
  const items = await toItems(supabase, rows, viewerId);
  if (!items) return null;
  // The function sorts by date; toItems keeps the order of the rows.
  return items;
}

// Notes per page of the notes search.
const NOTE_SEARCH_PAGE = 10;

export type NoteSearchPage = { items: NoteItem[]; hasMore: boolean };

// One page of notes found by the words, best match first. A query shorter
// than 2 characters means "no search". Only top-level notes are searched.
// Muted people and people who blocked the viewer are left out. Returns null
// when a request fails. The words are never logged: only the error object is.
export async function searchNotes(
  rawQuery: string | undefined,
  page: number,
  viewerId: string | null,
): Promise<NoteSearchPage | null> {
  const query = cleanSearchQuery(rawQuery);
  if (query.length < SEARCH_QUERY_MIN) return { items: [], hasMore: false };

  const safePage = Number.isInteger(page)
    ? Math.min(Math.max(page, 1), SEARCH_MAX_PAGE)
    : 1;

  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const { data: ids, error } = await supabase.rpc("search_notes", {
    p_query: query,
    // One extra row tells us whether another page exists.
    p_limit: NOTE_SEARCH_PAGE + 1,
    p_offset: (safePage - 1) * NOTE_SEARCH_PAGE,
    p_exclude: hidden,
  });
  if (error || !ids) {
    console.error("searchNotes failed:", error);
    return null;
  }
  if (ids.length === 0) return { items: [], hasMore: false };

  const hasMore = ids.length > NOTE_SEARCH_PAGE;
  const shownIds = (hasMore ? ids.slice(0, NOTE_SEARCH_PAGE) : ids).map(
    (row) => row.note_id,
  );

  const { data: rows, error: rowsError } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("status", "published")
    .in("id", shownIds);
  if (rowsError || !rows) {
    console.error("searchNotes (rows) failed:", rowsError);
    return null;
  }

  // Put the rows back in the order of the ranking.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = shownIds.flatMap((id) => {
    const note = byId.get(id);
    return note ? [note] : [];
  });
  const items = await toItems(supabase, ordered, viewerId);
  if (!items) return null;
  return { items, hasMore };
}

// Hashtag lists. Only top-level published notes; muted people and people who
// blocked the viewer are left out. The tag comes from the address, so
// anything that is not a valid tag simply has no notes.
const POPULAR_TAG_DAYS = 30;

// Newest notes with this hashtag, one page.
export async function listTaggedNotes(
  tag: string,
  viewerId: string | null,
  cursorText?: string,
): Promise<NotePage | null> {
  if (!isValidTag(tag)) return { items: [], nextCursor: null };
  const cursor = cursorText === undefined ? undefined : parseCursor(cursorText);
  if (cursor === null) return null;

  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const { data: ids, error } = await supabase.rpc("get_tagged_note_ids", {
    p_tag: tag,
    p_after_at: cursor?.at ?? TOP_AT,
    p_after_id: cursor?.id ?? TOP_ID,
    p_limit: NOTE_PAGE + 1,
    p_exclude: hidden,
  });
  if (error || !ids) {
    console.error("listTaggedNotes failed:", error);
    return null;
  }
  if (ids.length === 0) return { items: [], nextCursor: null };

  const ordered = await loadNotesInOrder(
    supabase,
    ids.map((row) => row.note_id),
  );
  if (!ordered) return null;
  return toPage(supabase, ordered, viewerId);
}

// The best notes with this hashtag of the last 30 days: one ranked list, no
// next page.
export async function listPopularTaggedNotes(
  tag: string,
  viewerId: string | null,
): Promise<NotePage | null> {
  if (!isValidTag(tag)) return { items: [], nextCursor: null };

  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const { data: ids, error } = await supabase.rpc(
    "get_popular_tagged_note_ids",
    {
      p_tag: tag,
      p_days: POPULAR_TAG_DAYS,
      p_limit: POPULAR_LIMIT,
      p_exclude: hidden,
    },
  );
  if (error || !ids) {
    console.error("listPopularTaggedNotes failed:", error);
    return null;
  }
  if (ids.length === 0) return { items: [], nextCursor: null };

  const ordered = await loadNotesInOrder(
    supabase,
    ids.map((row) => row.note_id),
  );
  if (!ordered) return null;
  const items = await toItems(supabase, ordered, viewerId);
  if (!items) return null;
  return { items, nextCursor: null };
}

// How many notes carry this hashtag (heading of the hashtag page). Returns
// null when the call fails.
export async function getTaggedNoteCount(
  tag: string,
  viewerId: string | null,
): Promise<number | null> {
  if (!isValidTag(tag)) return 0;

  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const { data, error } = await supabase.rpc("get_note_tag_count", {
    p_tag: tag,
    p_exclude: hidden,
  });
  if (error || data === null) {
    console.error("getTaggedNoteCount failed:", error);
    return null;
  }
  return Number(data);
}

// Trending hashtags (Explore page). A tag needs several notes by several
// different people in the window, so one person cannot push a tag alone.
// The numbers are a guess: tune them when there are more people.
const TRENDING_HOURS = 48;
const TRENDING_MIN_NOTES = 3;
const TRENDING_MIN_AUTHORS = 2;

export type TrendingNoteTag = { tag: string; noteCount: number };

// Returns null when the call fails, so the page can say so instead of
// showing "nothing is trending".
export async function listTrendingNoteTags(
  viewerId: string | null,
  limit = 10,
): Promise<TrendingNoteTag[] | null> {
  const supabase = await createClient();
  const hidden = await hiddenAuthorIds(supabase, viewerId);
  const { data, error } = await supabase.rpc("get_trending_note_tags", {
    p_hours: TRENDING_HOURS,
    p_limit: limit,
    p_min_notes: TRENDING_MIN_NOTES,
    p_min_authors: TRENDING_MIN_AUTHORS,
    p_exclude: hidden,
  });
  if (error || !data) {
    console.error("listTrendingNoteTags failed:", error);
    return null;
  }
  return data.map((row) => ({
    tag: row.tag,
    noteCount: Number(row.note_count),
  }));
}
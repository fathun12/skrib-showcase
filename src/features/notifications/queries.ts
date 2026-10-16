import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";

// "Never opened the page": every event since the follow counts as new.
const NEVER = "1970-01-01T00:00:00Z";
const COUNT_CAP = 10;
const LIST_DAYS = 30;
// Stored events are fetched generously, then likes are merged per story or
// per note, and only then is the list cut to LIST_ROWS (so a run of likes
// cannot push other rows out of the list).
const LIST_EVENTS = 200;
const LIST_ROWS = 50;
const LIST_NEW_POSTS = 30;
// Enough to count at most about 10 rows after the likes are merged.
const UNREAD_EVENTS_FETCHED = 100;
// A repost caption or a note text is cut to this length in a notification row.
const CAPTION_SNIPPET = 100;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getSeenAt(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from("notification_state")
    .select("seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getSeenAt failed:", error);
    return null;
  }
  return data?.seen_at ?? NEVER;
}

// How many ROWS the unread events make on the page: every event is one row,
// except likes, where all the likes of one story (or of one note) are one row.
function countUnreadRows(
  rows: { type: string; post_id: string | null; note_id: string | null }[],
): number {
  let count = 0;
  const likedPosts = new Set<string>();
  const likedNotes = new Set<string>();
  for (const row of rows) {
    if (row.type === "like" && row.post_id) {
      if (!likedPosts.has(row.post_id)) {
        likedPosts.add(row.post_id);
        count += 1;
      }
    } else if (
      (row.type === "note_like" || row.type === "note_repost") &&
      row.note_id
    ) {
      // The likes (and the reposts) of one note are one row each.
      const key = `${row.type}:${row.note_id}`;
      if (!likedNotes.has(key)) {
        likedNotes.add(key);
        count += 1;
      }
    } else {
      count += 1;
    }
  }
  return count;
}

// People whose notes and note notifications the viewer must not see (muted,
// or they blocked him). A failed lookup returns an empty set and is logged.
async function hiddenActorIds(supabase: Supabase): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("my_hidden_note_authors");
  if (error || !data) {
    console.error("hiddenActorIds failed:", error);
    return new Set();
  }
  return new Set(data);
}

function isNoteEvent(type: string): boolean {
  return (
    type === "note_like" ||
    type === "note_reply" ||
    type === "note_mention" ||
    type === "note_repost" ||
    type === "note_quote" ||
    type === "story_share"
  );
}

// Mentions in comments and in stories: hidden when the writer is muted later.
function isMentionEvent(type: string): boolean {
  return type === "comment_mention" || type === "post_mention";
}

// Number for the bell in the header. Counts at most about 10 new rows, so the
// header shows "9+" for anything above 9. Returns 0 when a query fails.
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const seenAt = await getSeenAt(supabase, userId);
  if (seenAt === null) return 0;

  // Started now and awaited at the end, so it runs together with the two queries below.
  const newNotices = countNewNotices(supabase, userId, seenAt);

  const [events, activity] = await Promise.all([
    supabase
      .from("notifications")
      .select("type, actor_id, post_id, note_id")
      .eq("recipient_id", userId)
      .gt("created_at", seenAt)
      .order("created_at", { ascending: false })
      .limit(UNREAD_EVENTS_FETCHED),
    supabase.rpc("get_my_new_activity", {
      p_since: seenAt,
      p_limit: COUNT_CAP,
    }),
  ]);

  if (events.error || !events.data || activity.error || !activity.data) {
    console.error("getUnreadCount failed:", events.error ?? activity.error);
    return 0;
  }
  // Note events and mentions of muted people do not count (a block already
  // stops new ones).
  const hideable = (type: string) => isNoteEvent(type) || isMentionEvent(type);
  const hidden = events.data.some((row) => hideable(row.type))
    ? await hiddenActorIds(supabase)
    : new Set<string>();
  const rows = events.data.filter(
    (row) => !(hideable(row.type) && hidden.has(row.actor_id)),
  );
  return countUnreadRows(rows) + activity.data.length + (await newNotices);
}

export type Person = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

// Where a note notification points, and a short piece of the note text.
export type NoteTarget = { href: string; excerpt: string };

export type NotificationItem =
  | { kind: "follow"; at: string; actor: Person }
  | {
      kind:
        | "comment"
        | "reply"
        | "repost"
        | "credit"
        | "credit_accepted"
        | "credit_declined"
        | "comment_mention"
        | "editor_published"
        | "post_mention";
      at: string;
      actor: Person;
      post: { title: string; href: string };
    }
  | {
      // All the likes of one story in one row. `actor` is the newest liker,
      // `others` the number of other likers; with exactly one other, that
      // person is `secondActor` (named in the sentence).
      kind: "like";
      at: string;
      actor: Person;
      others: number;
      secondActor: Person | null;
      post: { title: string; href: string };
    }
  | {
      // Someone replied to my note (`note` is the REPLY, it opens its thread),
      // or mentioned me in a note (`note` is that note).
      kind: "note_reply" | "note_mention" | "note_quote" | "story_share";
      at: string;
      actor: Person;
      note: NoteTarget;
    }
  | {
      // All the likes (or all the reposts) of one note in one row (same
      // shape as story likes).
      kind: "note_like" | "note_repost";
      at: string;
      actor: Person;
      others: number;
      secondActor: Person | null;
      note: NoteTarget;
    }
  | {
      // An editor sent the draft to the author, or the author sent it to
      // the editor, with an optional note.
      kind: "handover_to_author" | "handover_to_editor";
      at: string;
      actor: Person;
      post: { title: string; href: string };
      message: string | null;
    }
  | {
      kind: "post";
      at: string;
      actor: Person;
      post: { title: string; href: string };
    }
  | {
      // Someone I follow reposted a story: "<actor> reposted <title> by <author>".
      kind: "repost_followed";
      at: string;
      actor: Person;
      author: Person;
      post: { title: string; href: string };
      // A short piece of the reposter's caption, when there is one.
      caption: string | null;
    }
  | {
      // A notice from the moderators: there is no actor (the author never
      // learns which admin decided).
      kind: "moderation";
      at: string;
      action: ModerationNoticeAction;
      subject: string | null;
      reason: string | null;
      note: string | null;
      // End of a timed suspension (ISO text); null otherwise.
      until: string | null;
    };

export type ModerationNoticeAction =
  | "hidden"
  | "deleted"
  | "restored"
  | "suspended"
  | "unsuspended"
  | "comment_deleted"
  | "series_deleted"
  | "note_hidden"
  | "note_deleted"
  | "note_restored"
  | "report_reviewed";

const NOTICE_ACTIONS = new Set<string>([
  "hidden",
  "deleted",
  "restored",
  "suspended",
  "unsuspended",
  "comment_deleted",
  "series_deleted",
  "note_hidden",
  "note_deleted",
  "note_restored",
  "report_reviewed",
]);

function isNoticeAction(value: string): value is ModerationNoticeAction {
  return NOTICE_ACTIONS.has(value);
}

const LIST_NOTICES = 20;

// Moderation notices newer than `seenAt`. Returns 0 when the query fails.
async function countNewNotices(
  supabase: Supabase,
  userId: string,
  seenAt: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("moderation_notices")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .gt("created_at", seenAt);
  if (error) {
    console.error("countNewNotices failed:", error);
    return 0;
  }
  return count ?? 0;
}

// The latest moderation notices as list rows. Returns [] when the query fails.
async function listModerationItems(
  supabase: Supabase,
  userId: string,
): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("moderation_notices")
    .select("action, subject, reason, note, expires_at, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIST_NOTICES);
  if (error || !data) {
    console.error("listModerationItems failed:", error);
    return [];
  }

  const items: NotificationItem[] = [];
  for (const n of data) {
    if (!isNoticeAction(n.action)) continue;
    items.push({
      kind: "moderation",
      at: n.created_at,
      action: n.action,
      subject: n.subject,
      reason: n.reason,
      note: n.note,
      until: n.expires_at,
    });
  }
  return items;
}

const KIND_BY_TYPE = {
  comment: "comment",
  reply: "reply",
  repost: "repost",
  credit: "credit",
  credit_accepted: "credit_accepted",
  credit_declined: "credit_declined",
  comment_mention: "comment_mention",
  editor_published: "editor_published",
  post_mention: "post_mention",
} as const;

function snippet(text: string): string {
  return text.length > CAPTION_SNIPPET
    ? `${text.slice(0, CAPTION_SNIPPET).trimEnd()}...`
    : text;
}

// A note on one line (line breaks and runs of spaces become one space).
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Everything for the notifications page, newest first: follow, like, reply
// and note events plus new stories and reposts of people I follow (last 30
// days). The likes of one story, and the likes of one note, are merged into
// one row. Returns null on failure.
export async function listNotifications(
  userId: string,
): Promise<NotificationItem[] | null> {
  const supabase = await createClient();
  const since = new Date(
    Date.now() - LIST_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [events, activity] = await Promise.all([
    supabase
      .from("notifications")
      .select("actor_id, type, post_id, note_id, message, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIST_EVENTS),
    supabase.rpc("get_my_new_activity", {
      p_since: since,
      p_limit: LIST_NEW_POSTS,
    }),
  ]);

  if (events.error || !events.data || activity.error || !activity.data) {
    console.error("listNotifications failed:", events.error ?? activity.error);
    return null;
  }

  const postIds = [
    ...new Set([
      ...events.data.flatMap((e) => (e.post_id ? [e.post_id] : [])),
      ...activity.data.map((a) => a.post_id),
    ]),
  ];

  // Published posts only: an unpublished post silently drops out.
  const { data: postRows, error: postError } =
    postIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("posts")
          .select("id, title, slug, author_id, status")
          .in("id", postIds);
  if (postError || !postRows) {
    console.error("listNotifications (posts) failed:", postError);
    return null;
  }

  // The notes named by note events. RLS shows a hidden note only to its
  // author, and the loop below keeps published notes only.
  const noteIds = [
    ...new Set(events.data.flatMap((e) => (e.note_id ? [e.note_id] : []))),
  ];
  const { data: noteRows, error: noteError } =
    noteIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("notes").select("id, body, status").in("id", noteIds);
  if (noteError || !noteRows) {
    console.error("listNotifications (notes) failed:", noteError);
    return null;
  }

  const hiddenActors =
    noteIds.length === 0 && !events.data.some((e) => isMentionEvent(e.type))
      ? new Set<string>()
      : await hiddenActorIds(supabase);

  const reposterIds = [
    ...new Set(
      activity.data.flatMap((a) => (a.reposter_id ? [a.reposter_id] : [])),
    ),
  ];

  const personIds = [
    ...new Set([
      ...events.data.map((e) => e.actor_id),
      ...postRows.map((p) => p.author_id),
      ...reposterIds,
    ]),
  ];
  const { data: profileRows, error: profileError } =
    personIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", personIds);
  if (profileError || !profileRows) {
    console.error("listNotifications (profiles) failed:", profileError);
    return null;
  }

  // Captions of the reposts in the list (one query). A failure only means
  // the rows show no caption.
  const captions = new Map<string, string>();
  if (reposterIds.length > 0) {
    const { data: captionRows, error: captionError } = await supabase
      .from("reposts")
      .select("user_id, post_id, caption")
      .in(
        "post_id",
        activity.data.flatMap((a) => (a.reposter_id ? [a.post_id] : [])),
      )
      .in("user_id", reposterIds)
      .not("caption", "is", null);
    if (captionError) {
      console.error("listNotifications (captions) failed:", captionError);
    }
    for (const c of captionRows ?? []) {
      if (c.caption) captions.set(`${c.user_id}_${c.post_id}`, c.caption);
    }
  }

  const people = new Map<string, Person>();
  for (const row of profileRows) {
    if (!row.username) continue;
    people.set(row.id, {
      displayName: row.display_name,
      username: row.username,
      avatarUrl: safeAvatarUrl(row.avatar_url),
    });
  }
  const postById = new Map(postRows.map((p) => [p.id, p]));
  const noteById = new Map(noteRows.map((n) => [n.id, n]));

  const items: NotificationItem[] = [];
  // The like row of each story, so later (older) likes can join it.
  const likeRows = new Map<string, Extract<NotificationItem, { kind: "like" }>>();
  // The same for notes.
  const noteLikeRows = new Map<
    string,
    Extract<NotificationItem, { kind: "note_like" | "note_repost" }>
  >();

  // The events are newest first, so the first like seen for a story is the
  // newest one and the next one is the "second" liker.
  for (const e of events.data) {
    const actor = people.get(e.actor_id);
    if (!actor) continue;
    if (e.type === "follow") {
      items.push({ kind: "follow", at: e.created_at, actor });
      continue;
    }

    if (
      e.type === "note_reply" ||
      e.type === "note_like" ||
      e.type === "note_mention" ||
      e.type === "note_repost" ||
      e.type === "note_quote" ||
      e.type === "story_share"
    ) {
      // Muted people (and people who blocked me) drop out silently.
      if (hiddenActors.has(e.actor_id)) continue;
      const note = e.note_id ? noteById.get(e.note_id) : undefined;
      // A hidden or deleted note drops out of the list.
      if (!note || note.status !== "published") continue;
      const target: NoteTarget = {
        href: `/notes/${note.id}`,
        excerpt: snippet(oneLine(note.body)),
      };

      if (
        e.type === "note_reply" ||
        e.type === "note_mention" ||
        e.type === "note_quote" ||
        e.type === "story_share"
      ) {
        items.push({
          kind:
            e.type === "note_mention"
              ? "note_mention"
              : e.type === "note_quote"
                ? "note_quote"
                : e.type === "story_share"
                  ? "story_share"
                  : "note_reply",
          at: e.created_at,
          actor,
          note: target,
        });
        continue;
      }

      // Likes and reposts: one row per note and per kind.
      const mergeKey = `${e.type}:${note.id}`;
      const existing = noteLikeRows.get(mergeKey);
      if (existing) {
        existing.others += 1;
        existing.secondActor = existing.others === 1 ? actor : null;
        continue;
      }
      const row: Extract<
        NotificationItem,
        { kind: "note_like" | "note_repost" }
      > = {
        kind: e.type === "note_repost" ? "note_repost" : "note_like",
        at: e.created_at,
        actor,
        others: 0,
        secondActor: null,
        note: target,
      };
      noteLikeRows.set(mergeKey, row);
      items.push(row);
      continue;
    }

    // A mention whose writer was muted after the mention drops out silently.
    if (isMentionEvent(e.type) && hiddenActors.has(e.actor_id)) continue;
    const post = e.post_id ? postById.get(e.post_id) : undefined;
    const owner = post ? people.get(post.author_id) : undefined;
    if (!post || !owner) continue;
    // An unpublished post drops out, except that the owner still sees who
    // accepted or declined a credit on a draft (that row opens the editor).
    const published = post.status === "published";
    if (
      !published &&
      e.type !== "credit_accepted" &&
      e.type !== "credit_declined" &&
      e.type !== "handover_to_author" &&
      e.type !== "handover_to_editor"
    ) {
      continue;
    }

    // Comments and replies open the comments section of the article;
    // credits open the Credits section.
    const isComment =
      e.type === "comment" ||
      e.type === "reply" ||
      e.type === "comment_mention";
    const isCredit = e.type === "credit" || e.type === "credit_accepted";
    const anchor = isComment ? "#comments" : isCredit ? "#credits" : "";
    const target = {
      title: post.title,
      href: published
        ? `/${owner.username}/${post.slug}${anchor}`
        : `/write/${post.id}`,
    };

    if (e.type === "like") {
      const existing = likeRows.get(post.id);
      if (existing) {
        existing.others += 1;
        // Exactly two likers: the second one is named; more: "N others".
        existing.secondActor = existing.others === 1 ? actor : null;
        continue;
      }
      const row: Extract<NotificationItem, { kind: "like" }> = {
        kind: "like",
        at: e.created_at,
        actor,
        others: 0,
        secondActor: null,
        post: target,
      };
      likeRows.set(post.id, row);
      items.push(row);
      continue;
    }

    if (e.type === "handover_to_author" || e.type === "handover_to_editor") {
      items.push({
        kind: e.type,
        at: e.created_at,
        actor,
        post: target,
        message: e.message,
      });
      continue;
    }

    const kind = KIND_BY_TYPE[e.type as keyof typeof KIND_BY_TYPE];
    if (!kind) continue;
    items.push({ kind, at: e.created_at, actor, post: target });
  }

  for (const n of activity.data) {
    const post = postById.get(n.post_id);
    const author = post ? people.get(post.author_id) : undefined;
    if (!post || !author || post.status !== "published") continue;
    const target = {
      title: post.title,
      href: `/${author.username}/${post.slug}`,
    };

    if (n.reposter_id) {
      const reposter = people.get(n.reposter_id);
      if (!reposter) continue;
      const caption = captions.get(`${n.reposter_id}_${n.post_id}`);
      items.push({
        kind: "repost_followed",
        at: n.event_at,
        actor: reposter,
        author,
        post: target,
        caption: caption ? snippet(caption) : null,
      });
      continue;
    }

    items.push({ kind: "post", at: n.event_at, actor: author, post: target });
  }

  items.push(...(await listModerationItems(supabase, userId)));
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, LIST_ROWS);
}


// The time the person last opened the notifications page (null when it
// cannot be read). Rows newer than this are shown as new on the page.
export async function getNotificationsSeenAt(
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();
  return getSeenAt(supabase, userId);
}
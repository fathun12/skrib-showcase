"use server";

import { getCurrentUser } from "@/features/auth/queries";
import {
  listFollowingNotes,
  listLatestNotes,
  listNotesByAuthor,
  listReplies,
  listTaggedNotes,
  type NoteItem,
} from "./queries";
import { loadMoreNotesSchema } from "./schemas";

export type LoadMoreResult =
  | { ok: true; notes: NoteItem[]; nextCursor: string | null }
  | { ok: false; error: string };

// The next page of a note list. Reads only; the viewer comes from the
// session, never from the browser.
export async function loadMoreNotes(input: unknown): Promise<LoadMoreResult> {
  const parsed = loadMoreNotesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Could not load more notes." };
  }
  const { feed, cursor } = parsed.data;

  // Popular is one ranked list without pages: there is never a next page.
  if (feed.kind === "popular") {
    return { ok: true, notes: [], nextCursor: null };
  }

  const current = await getCurrentUser();
  const viewerId = current?.id ?? null;

  const page =
    feed.kind === "latest"
      ? await listLatestNotes(viewerId, cursor)
      : feed.kind === "following"
        ? viewerId
          ? await listFollowingNotes(viewerId, cursor)
          : null
        : feed.kind === "author"
          ? await listNotesByAuthor(feed.authorId, viewerId, cursor)
          : feed.kind === "tag"
            ? await listTaggedNotes(feed.tag, viewerId, cursor)
            : await listReplies(feed.parentId, viewerId, cursor);

  if (!page) {
    return { ok: false, error: "Could not load more notes. Please try again." };
  }
  return { ok: true, notes: page.items, nextCursor: page.nextCursor };
}
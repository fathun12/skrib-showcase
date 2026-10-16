"use client";

import { useState, useTransition } from "react";
import { buttonVariants } from "@/ui/primitives/button";
import { NoteList } from "./NoteList";
import { loadMoreNotes } from "./page-actions";
import type { NoteItem } from "./queries";
import type { LoadMoreFeed } from "./schemas";

type Props = {
  // The first page, loaded by the server page.
  initialNotes: NoteItem[];
  // Where the next page starts (null = no more).
  initialCursor: string | null;
  feed: LoadMoreFeed;
  currentUserId: string | null;
  returnPath: string;
  replyModeration?: { parentId: string; hidden: boolean };
};

// A note list with a "Load more" button. The first page comes from the
// server; later pages are added here. A note that was deleted or hidden from
// the list is dropped at once (the server page also refreshes, but the pages
// added here would not).
export function NotePagedList({
  initialNotes,
  initialCursor,
  feed,
  currentUserId,
  returnPath,
  replyModeration,
}: Props) {
  const [more, setMore] = useState<NoteItem[]>([]);
  // undefined = still the cursor the server gave.
  const [laterCursor, setLaterCursor] = useState<string | null | undefined>(
    undefined,
  );
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const cursor = laterCursor === undefined ? initialCursor : laterCursor;

  const firstIds = new Set(initialNotes.map((note) => note.id));
  const notes = [
    ...initialNotes,
    ...more.filter((note) => !firstIds.has(note.id)),
  ].filter((note) => !removed.has(note.id));

  function loadMore() {
    if (!cursor || loading) return;
    setError(null);
    startLoading(async () => {
      try {
        const result = await loadMoreNotes({ feed, cursor });
        if (result.ok) {
          setMore((previous) => [...previous, ...result.notes]);
          setLaterCursor(result.nextCursor);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not load more notes. Please try again.");
      }
    });
  }

  return (
    <div>
      <NoteList
        notes={notes}
        currentUserId={currentUserId}
        returnPath={returnPath}
        replyModeration={replyModeration}
        onRemoved={(noteId) =>
          setRemoved((previous) => new Set(previous).add(noteId))
        }
      />

      {error ? (
        <p role="alert" className="pt-4 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {cursor ? (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className={`${buttonVariants({ variant: "outline", size: "sm" })} disabled:opacity-60`}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
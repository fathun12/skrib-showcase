"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { NoteRepostButton } from "@/ui/notes/NoteRepostButton";
import { QuoteNoteDialog } from "@/ui/notes/QuoteNoteDialog";
import { createNote, setNoteRepost } from "./actions";
import { NOTE_MAX, type NoteReplyPolicy } from "./schemas";
import { useMentionSuggestions } from "./useMentionSuggestions";

type Props = {
  // The note that can be reposted or quoted.
  note: {
    id: string;
    body: string;
    createdAt: string;
    author: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  signedIn: boolean;
  // false for a reply and for my own note: only Quote is offered.
  canRepost: boolean;
  initialReposted: boolean;
  // null = the count failed to load: shown as nothing.
  initialCount: number | null;
};

type RepostState = { reposted: boolean; count: number };

export function NoteRepostButtonConnected({
  note,
  returnPath,
  signedIn,
  canRepost,
  initialReposted,
  initialCount,
}: Props) {
  const router = useRouter();
  const [state, setOptimisticState] = useOptimistic<RepostState, boolean>(
    { reposted: initialReposted, count: initialCount ?? 0 },
    (current, reposted) => ({
      reposted,
      count:
        current.count +
        (reposted === current.reposted ? 0 : reposted ? 1 : -1),
    }),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [policy, setPolicy] = useState<NoteReplyPolicy>("everyone");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const mention = useMentionSuggestions();

  // Close the menu on a click or tap outside it.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function handleToggleMenu() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setMenuOpen((open) => !open);
  }

  function runRepost(reposted: boolean) {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      setOptimisticState(reposted);
      try {
        const result = await setNoteRepost({ noteId: note.id, repost: reposted });
        if (!result.ok) setError(result.error);
      } catch {
        // A network failure must not crash the page.
        setError("Could not update. Please try again.");
      }
    });
  }

  function openQuote() {
    setMenuOpen(false);
    setQuoteError(null);
    setQuoteOpen(true);
  }

  function submitQuote() {
    setQuoteError(null);
    startQuote(async () => {
      try {
        const result = await createNote({
          body: draft,
          replyPolicy: policy,
          quoteNoteId: note.id,
        });
        if (result.ok) {
          setDraft("");
          setQuoteOpen(false);
        } else {
          setQuoteError(result.error);
        }
      } catch {
        setQuoteError("Could not post your note. Please try again.");
      }
    });
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center gap-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.stopPropagation();
          setMenuOpen(false);
          // The first button in the wrapper is the trigger.
          wrapperRef.current?.querySelector("button")?.focus();
        }
      }}
      onBlur={(event) => {
        // Keyboard users who tab out of the menu close it.
        if (
          menuOpen &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setMenuOpen(false);
        }
      }}
    >
      <NoteRepostButton
        reposted={state.reposted}
        count={state.count}
        canRepost={canRepost}
        pending={pending}
        menuOpen={menuOpen}
        onToggleMenu={handleToggleMenu}
        onRepost={() => runRepost(true)}
        onQuote={openQuote}
        onUndo={() => runRepost(false)}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <QuoteNoteDialog
        open={quoteOpen}
        quoted={{
          state: "available",
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
          author: note.author,
        }}
        value={draft}
        onChange={setDraft}
        policy={policy}
        onPolicyChange={setPolicy}
        maxLength={NOTE_MAX}
        pending={quoting}
        error={quoteError}
        onSubmit={submitQuote}
        mention={mention}
        onClose={() => setQuoteOpen(false)}
      />
    </div>
  );
}
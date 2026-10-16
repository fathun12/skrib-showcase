"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import type { NoteImageData } from "@/ui/notes/NoteImageGrid";
import {
  NoteImageViewer,
  type NestedState,
  type NoteImageViewerProps,
  type RepliesState,
  type ViewerReply,
} from "@/ui/notes/NoteImageViewer";
import { createNote } from "./actions";
import { loadMoreNotes } from "./page-actions";
import { NOTE_MAX } from "./schemas";

type Props = {
  noteId: string;
  note: NoteImageViewerProps["note"];
  images: NoteImageData[];
  startIndex: number;
  replyCount?: number | null;
  noteHref: string;
  likeSlot?: ReactNode;
  signedIn: boolean;
  signInHref: string;
  onClose: () => void;
};

type ReplyTarget = { parentId: string; username: string };

const SWIPE_PX = 50;
const SWIPE_DOWN_PX = 90;
const LEADING_TAG = /^@[\w-]+\s*/;

// How many viewers are open right now. The lists of a page read it, so a list
// that did not open the viewer never steps over its history entries.
let openViewers = 0;

export function isViewerOpen(): boolean {
  return openViewers > 0;
}

// Opens the images of one note full screen: the photo on the stage with a
// caption strip, and a replies drawer that the reader opens. A reply to a
// comment goes under that comment (replies to a reply stay under the same
// parent, with the @name). Esc and a click on the empty backdrop peel one
// layer (the drawer first, then the viewer); the arrow keys and a swipe move
// between images (not while typing); a swipe down closes; Tab stays inside
// the open parts of the viewer; the page behind does not scroll; the focus
// goes back to where it was.
export function NoteImageLightbox({
  noteId,
  note,
  images,
  startIndex,
  replyCount,
  noteHref,
  likeSlot,
  signedIn,
  signInHref,
  onClose,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<ViewerReply[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [repliesState, setRepliesState] = useState<RepliesState>(
    replyCount === 0 ? "done" : "loading",
  );
  // Raised after a reply was posted: the list is loaded again.
  const [reloadKey, setReloadKey] = useState(0);
  const [nested, setNested] = useState<Record<string, NestedState>>({});
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);
  // Direct replies posted from this viewer (added to the count).
  const [posted, setPosted] = useState(0);
  // The reply that was just posted: scrolled into view and tinted for a
  // moment.
  const [freshId, setFreshId] = useState<string | null>(null);
  // Which list the new reply goes to (null = the direct replies). Set when a
  // reply is posted, used when that list has been loaded again.
  const freshIn = useRef<{ parentId: string | null } | null>(null);
  const repliesId = useId();
  const alive = useRef(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);
  const repliesOpenRef = useRef(repliesOpen);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // How many history entries the viewer owns now (0, 1, or 2 with the
  // drawer open), and where the next popstate must end (see popTo).
  const layersRef = useRef(0);
  const popTargetRef = useRef<number | null>(null);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = images.length;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    repliesOpenRef.current = repliesOpen;
  });

  useEffect(() => {
    alive.current = true;
    openViewers += 1;
    return () => {
      alive.current = false;
      openViewers -= 1;
    };
  }, []);

  // Scrolls the new reply into view, and removes its tint after a moment.
  useEffect(() => {
    if (!freshId) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById(`reply-${freshId}`)?.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
    const timer = setTimeout(() => setFreshId(null), 2200);
    return () => clearTimeout(timer);
  }, [freshId]);

  const go = useCallback(
    (step: number) => {
      setIndex((current) => Math.min(count - 1, Math.max(0, current + step)));
    },
    [count],
  );

  // History layers. While the viewer is open it owns one history entry, and
  // the replies drawer owns a second one. The Back button (and the back
  // gesture of a phone) removes one layer at a time: the drawer first, then
  // the viewer. Every way of closing goes through history.go(), and the
  // popstate handler below changes the screen.
  const pushLayer = useCallback(() => {
    window.history.pushState({ skribViewer: true }, "", window.location.href);
    layersRef.current += 1;
  }, []);

  // Goes back until only `target` layers are left (0 closes the viewer).
  const popTo = useCallback((target: number) => {
    // A Back is already on its way (a double click on X, or X and Esc): a
    // second history.go() would leave the page.
    if (popTargetRef.current !== null) return;
    const steps = layersRef.current - target;
    if (steps <= 0) return;
    popTargetRef.current = target;
    window.history.go(-steps);
    // Safety: if the browser never answers, give the screen back.
    popTimerRef.current = setTimeout(() => {
      popTimerRef.current = null;
      if (popTargetRef.current === null) return;
      popTargetRef.current = null;
      layersRef.current = target;
      if (target < 2) setRepliesOpen(false);
      if (target === 0) onCloseRef.current();
    }, 800);
  }, []);

  const openReplies = useCallback(() => {
    if (layersRef.current < 2) pushLayer();
    setRepliesOpen(true);
  }, [pushLayer]);

  const closeReplies = useCallback(() => {
    if (layersRef.current >= 2) popTo(1);
    else setRepliesOpen(false);
  }, [popTo]);

  const requestClose = useCallback(() => {
    if (layersRef.current > 0) popTo(0);
    else onCloseRef.current();
  }, [popTo]);

  useEffect(() => {
    // Strict Mode runs effects twice in development: push only once.
    if (layersRef.current === 0) pushLayer();

    function onPopState() {
      if (popTimerRef.current) {
        clearTimeout(popTimerRef.current);
        popTimerRef.current = null;
      }
      // One popstate removes one layer, or several after popTo(0).
      const target =
        popTargetRef.current ?? Math.max(0, layersRef.current - 1);
      popTargetRef.current = null;
      layersRef.current = target;
      if (target < 2) setRepliesOpen(false);
      if (target === 1) {
        requestAnimationFrame(() => toggleRef.current?.focus());
      }
      if (target === 0) onCloseRef.current();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pushLayer]);

  // The direct replies: loaded once, and again after a reply was posted.
  useEffect(() => {
    if (replyCount === 0 && reloadKey === 0) return;
    let cancelled = false;
    loadMoreNotes({ feed: { kind: "replies", parentId: noteId } }).then(
      (result) => {
        if (cancelled) return;
        if (result.ok) {
          setReplies(result.notes);
          setHasMore(result.nextCursor !== null);
          setRepliesState("done");
          // A reply that was just posted is the last one (oldest first), as
          // long as the whole list fits on this page.
          const pending = freshIn.current;
          if (pending && pending.parentId === null) {
            freshIn.current = null;
            const newest = result.notes[result.notes.length - 1];
            if (result.nextCursor === null && newest) setFreshId(newest.id);
          }
        } else {
          setRepliesState("error");
        }
      },
      () => {
        if (!cancelled) setRepliesState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [noteId, replyCount, reloadKey]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "TEXTAREA" || target.tagName === "INPUT");

      if (event.key === "Escape") {
        event.preventDefault();
        if (repliesOpenRef.current) closeReplies();
        else requestClose();
      } else if (event.key === "ArrowLeft") {
        if (typing) return;
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        if (typing) return;
        event.preventDefault();
        go(1);
      } else if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        // The closed drawer is inert: its buttons are not part of the loop.
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), textarea:not([disabled])",
          ),
        ).filter((item) => !item.closest("[inert]"));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!dialog.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [go, closeReplies, requestClose]);

  // The replies under one comment. The old list stays visible while it
  // refreshes.
  function loadNested(parentId: string) {
    setNested((previous) => ({
      ...previous,
      [parentId]: {
        open: true,
        state: "loading",
        items: previous[parentId]?.items ?? [],
      },
    }));
    loadMoreNotes({ feed: { kind: "replies", parentId } }).then(
      (result) => {
        if (!alive.current) return;
        const pending = freshIn.current;
        if (result.ok && pending && pending.parentId === parentId) {
          freshIn.current = null;
          const newest = result.notes[result.notes.length - 1];
          if (result.nextCursor === null && newest) setFreshId(newest.id);
        }
        setNested((previous) => ({
          ...previous,
          [parentId]: {
            open: true,
            state: result.ok ? "done" : "error",
            items: result.ok ? result.notes : (previous[parentId]?.items ?? []),
          },
        }));
      },
      () => {
        if (!alive.current) return;
        setNested((previous) => ({
          ...previous,
          [parentId]: {
            open: true,
            state: "error",
            items: previous[parentId]?.items ?? [],
          },
        }));
      },
    );
  }

  function toggleNested(replyId: string) {
    const current = nested[replyId];
    if (!current) {
      loadNested(replyId);
      return;
    }
    setNested((previous) => ({
      ...previous,
      [replyId]: { ...previous[replyId], open: !previous[replyId].open },
    }));
  }

  // Fills the box with the @name and puts the cursor at the end.
  function startReplyTo(parentId: string, username: string) {
    setReplyTarget({ parentId, username });
    setReplyError(null);
    setReplyText(
      (previous) => `@${username} ${previous.replace(LEADING_TAG, "")}`,
    );
    requestAnimationFrame(() => {
      const input = replyInputRef.current;
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  async function submitReply() {
    const body = replyText.trim();
    if (!body || body.replace(LEADING_TAG, "") === "" || replying) return;
    const target = replyTarget;
    setReplyError(null);
    setReplying(true);
    try {
      const result = await createNote({
        body,
        replyPolicy: "everyone",
        replyToId: target?.parentId ?? noteId,
      });
      if (!alive.current) return;
      if (result.ok) {
        setReplyText("");
        setReplyTarget(null);
        // Remember where the new reply goes: it is shown when that list has
        // been loaded again.
        freshIn.current = { parentId: target?.parentId ?? null };
        if (target) loadNested(target.parentId);
        else setPosted((total) => total + 1);
        // The list is loaded again so the counts under each comment are right.
        setReloadKey((key) => key + 1);
      } else {
        setReplyError(result.error);
      }
    } catch {
      if (alive.current) {
        setReplyError("Could not post your reply. Please try again.");
      }
    } finally {
      if (alive.current) setReplying(false);
    }
  }

  // The empty backdrop and a swipe down peel one layer.
  function peelLayer() {
    if (repliesOpen) closeReplies();
    else requestClose();
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    // Two fingers (pinch) are not a swipe.
    touchStart.current =
      event.touches.length === 1 && touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    } else if (dy >= SWIPE_DOWN_PX && dy > Math.abs(dx) * 1.5) {
      peelLayer();
    }
  }

  return (
    <NoteImageViewer
      note={note}
      images={images}
      index={index}
      likeSlot={likeSlot}
      replyTotal={(replyCount ?? 0) + posted}
      noteHref={noteHref}
      repliesOpen={repliesOpen}
      repliesId={repliesId}
      onToggleReplies={() => (repliesOpen ? closeReplies() : openReplies())}
      onCloseReplies={closeReplies}
      toggleRef={toggleRef}
      replies={replies}
      repliesState={repliesState}
      hasMoreReplies={hasMore}
      freshId={freshId}
      nested={nested}
      onToggleNested={toggleNested}
      onReplyTo={startReplyTo}
      replyTarget={replyTarget}
      onCancelTarget={() => setReplyTarget(null)}
      signedIn={signedIn}
      signInHref={signInHref}
      replyValue={replyText}
      onReplyChange={setReplyText}
      onReplySubmit={() => void submitReply()}
      replyPending={replying}
      replyError={replyError}
      replyMax={NOTE_MAX}
      replyInputRef={replyInputRef}
      onPrev={index > 0 ? () => go(-1) : undefined}
      onNext={index < count - 1 ? () => go(1) : undefined}
      onClose={requestClose}
      onBackdropClick={peelLayer}
      dialogRef={dialogRef}
      closeRef={closeRef}
      stageHandlers={{ onTouchStart, onTouchEnd }}
    />
  );
}
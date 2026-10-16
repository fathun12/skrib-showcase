"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveVersion } from "@/features/history/actions";
import { savePost, updatePublishedPost } from "@/features/posts/actions";
import type { TiptapNode } from "@/features/posts/schemas";
import type { SaveStatusState } from "@/ui/editor/SaveStatus";

const DEBOUNCE_MS = 2000;
// One automatic retry after a rejected save. A rejected call still counts as a
// hit and the rate-limit window is 60 s, so we wait a little longer than that.
const RETRY_MS = 65_000;
// A draft asks for an automatic version at most this often (the database
// applies the same 10-minute rule, this only saves needless requests).
const VERSION_EVERY_MS = 10 * 60 * 1000;

type Snapshot = {
  title: string;
  subtitle: string;
  language: string;
  content: TiptapNode;
};

// auto:   drafts. Saves by itself 2 seconds after the last edit.
// manual: published posts. Nothing is saved until flushNow() is called (the
//         Update button), so readers never see half-finished edits.
export type AutosaveMode = "auto" | "manual";

// Result of "save everything right now" (used by Publish and Update).
// empty: nothing was ever saved (blank editor), so there is no post id yet.
// error: the newest content could not be saved.
export type FlushResult =
  | { ok: true; id: string }
  | { ok: false; reason: "empty" | "error" };

export function useAutosave(
  initialId: string | undefined,
  mode: AutosaveMode = "auto",
  // Called when the server refuses a save because the caller does not hold
  // the pen (co-authoring). The editor decides what to show.
  onNotHolder?: () => void,
) {
  const manual = mode === "manual";
  const onNotHolderRef = useRef(onNotHolder);
  useEffect(() => {
    onNotHolderRef.current = onNotHolder;
  });
  const [status, setStatus] = useState<SaveStatusState>("idle");
  // The server's message for the last failed save (null when none).
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // True when the last save failed and its text is still kept for another try
  // (drives the Retry button). Reset whenever a new save starts.
  const [retryable, setRetryable] = useState(false);

  // The post id: known on /write/[id], learned after the first save on /write.
  const idRef = useRef(initialId);
  // The same id as state, so the editor can enable buttons that need it
  // (Collaborators) once the first save has created the post.
  const [postId, setPostId] = useState(initialId);
  // Newest content that is not saved yet. Only the newest matters.
  const pendingRef = useRef<Snapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guarantees two saves never run in parallel (also protects the very first
  // save: later saves wait until the id from the insert is known).
  const runningRef = useRef(false);
  // The promise of the running save loop, so callers can wait for it.
  // Resolves to true when everything pending was saved, false on an error.
  const runningPromiseRef = useRef<Promise<boolean> | null>(null);
  // True after the one automatic retry was scheduled; reset by a successful
  // save or by new typing.
  const retryUsedRef = useRef(false);
  // When this tab last asked for an automatic version (0 = never).
  const lastVersionRef = useRef(0);

  const runLoop = useCallback(async (): Promise<boolean> => {
    runningRef.current = true;
    try {
      while (pendingRef.current) {
        const snapshot = pendingRef.current;
        pendingRef.current = null;
        setStatus("saving");
        setErrorMessage(null);
        setRetryable(false);

        const input = {
          id: idRef.current,
          title: snapshot.title,
          subtitle: snapshot.subtitle,
          language: snapshot.language,
          content: snapshot.content,
        };
        // manual -> apply to the live post; auto -> save the draft.
        const result:
          | { ok: true; id?: string }
          | { ok: false; error: string; code?: "not_holder" } = manual
          ? await updatePublishedPost(input)
          : await savePost(input);

        if (!result.ok && result.code === "not_holder") {
          // The pen is not ours. Retrying, or saving newer text, would only be
          // refused again, so everything pending is dropped; the editor keeps
          // the typed text so it can be copied.
          pendingRef.current = null;
          retryUsedRef.current = true;
          setErrorMessage(result.error);
          setStatus("error");
          onNotHolderRef.current?.();
          return false;
        }

        if (!result.ok) {
          // Keep it for a retry, unless newer content arrived meanwhile.
          if (!pendingRef.current) pendingRef.current = snapshot;
          setErrorMessage(result.error);
          setRetryable(true);
          setStatus("error");
          return false;
        }

        if (!idRef.current && result.id) {
          idRef.current = result.id;
          setPostId(result.id);
          // Documented to integrate with the Next.js router, and it does not
          // remount the editor (so the cursor stays where it is).
          window.history.replaceState(null, "", `/write/${result.id}`);
        }
      }
      retryUsedRef.current = false;
      setStatus("saved");

      // Version history (best effort, never blocks saving). Update always
      // asks for a version; a draft asks at most every 10 minutes.
      const versionPostId = idRef.current;
      if (versionPostId) {
        const now = Date.now();
        if (manual || now - lastVersionRef.current >= VERSION_EVERY_MS) {
          lastVersionRef.current = now;
          void saveVersion({
            postId: versionPostId,
            reason: manual ? "update" : "auto",
          }).catch(() => undefined);
        }
      }
      return true;
    } finally {
      runningRef.current = false;
    }
  }, [manual]);

  // Starts the save loop, or joins the one that is already running.
  const flush = useCallback((): Promise<boolean> => {
    if (runningPromiseRef.current) return runningPromiseRef.current;
    const promise: Promise<boolean> = runLoop().finally(() => {
      if (runningPromiseRef.current === promise) {
        runningPromiseRef.current = null;
      }
    });
    runningPromiseRef.current = promise;
    return promise;
  }, [runLoop]);

  // Saves everything now and waits until it is done. The Publish button calls
  // this first, because publishPost reads the title from the stored row; in
  // manual mode the Update button calls it to apply the changes.
  const flushNow = useCallback(async (): Promise<FlushResult> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      if (pendingRef.current || runningPromiseRef.current) {
        if (!(await flush())) return { ok: false, reason: "error" };
        // Something newer may have arrived just as the loop was finishing.
        if (pendingRef.current && !(await flush())) {
          return { ok: false, reason: "error" };
        }
      }
    } catch (error) {
      console.error("flushNow failed:", error);
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
      return { ok: false, reason: "error" };
    }
    if (!idRef.current) return { ok: false, reason: "empty" };
    return { ok: true, id: idRef.current };
  }, [flush]);

  const schedule = useCallback(
    (snapshot: Snapshot, isBlank: boolean) => {
      if (manual) {
        // A published post always has an id. Only remember the newest content
        // and mark it as not applied yet; no timer, no network.
        pendingRef.current = snapshot;
        setErrorMessage(null);
        setStatus("dirty");
        return;
      }
      if (!idRef.current && isBlank) {
        // Nothing worth saving yet: never create an empty draft, and drop a
        // pending save if the author deleted everything again.
        if (timerRef.current) clearTimeout(timerRef.current);
        pendingRef.current = null;
        setStatus("idle");
        return;
      }
      pendingRef.current = snapshot;
      setErrorMessage(null);
      setStatus("dirty");
      retryUsedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush, manual],
  );

  // Leaving the page through an in-app link unmounts the editor. For a draft:
  // save right away instead of waiting for the timer. For a published post
  // (manual mode) do NOT save: half-finished edits must never go live without
  // the author pressing Update.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!manual && pendingRef.current) void flush();
    };
  }, [flush, manual]);

  // A rejected autosave is not retried by itself otherwise: the text would stay
  // only in memory until the author types again. Retry once, drafts only.
  useEffect(() => {
    if (manual || status !== "error" || retryUsedRef.current) return;
    if (!pendingRef.current) return;
    retryUsedRef.current = true;
    const timer = setTimeout(() => {
      void flush();
    }, RETRY_MS);
    return () => clearTimeout(timer);
  }, [status, flush, manual]);

  // Closing the tab or refreshing: ask the browser to show its own "leave
  // site?" dialog, but only while something is unsaved or still being saved.
  // Browsers ignore custom text here, so there is no message to set.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingRef.current || runningRef.current) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Drops text that is not saved yet and cancels the timer. Used when the pen
  // is lost: a save now would overwrite the new holder's text. Returns true
  // when there was something to drop (the editor then offers to copy it).
  const discardPending = useCallback((): boolean => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const hadPending = pendingRef.current !== null;
    pendingRef.current = null;
    if (hadPending) {
      setErrorMessage("Pen lost: your latest changes were not saved.");
      setRetryable(false);
      setStatus("error");
    }
    return hadPending;
  }, []);

  // The Retry button of the save status: saves the text that failed to save,
  // right now. Nothing kept (pen lost, text dropped): nothing to do.
  const retry = useCallback(async (): Promise<void> => {
    if (!pendingRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      await flush();
    } catch (error) {
      console.error("retry failed:", error);
      setRetryable(false);
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }, [flush]);

  return {
    status,
    errorMessage,
    schedule,
    flushNow,
    postId,
    discardPending,
    canRetry: status === "error" && retryable,
    retry,
  };
}
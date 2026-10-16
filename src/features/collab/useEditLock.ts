"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestTurn, respondTurn, sendHandover } from "./actions";
import { HEARTBEAT_INTERVAL_MS, VIEWER_POLL_INTERVAL_MS } from "./constants";
import {
  acquireLock,
  getLockState,
  heartbeatLock,
  releaseLock,
  type LockState,
} from "./lock";
import {
  fetchPostVersion,
  fetchSharedText,
  type SharedText,
} from "./remote-post";

// off:         the post is not shared (or has no id yet). No lock calls at all.
// starting:    the first acquire / state read is running.
// editing:     we hold the pen.
// viewing:     somebody else holds it, or it is free. Read-only.
// unavailable: the lock could not be reached or we are not allowed.
export type EditLockMode =
  | "off"
  | "starting"
  | "editing"
  | "viewing"
  | "unavailable";

type Phase = Exclude<EditLockMode, "off">;
type State = { phase: Phase; lock: LockState | null; lost: boolean };

type Options = {
  postId: string | undefined;
  // True when the post has at least one accepted co-author.
  enabled: boolean;
  // False when the whole page is read-only: the viewer then never takes the
  // pen and never asks for a turn.
  canAcquire: boolean;
  // Called with the latest text from the server: when we take the pen, and
  // while viewing whenever the text changed. Must not count as typing.
  onFreshText: (text: SharedText) => void;
  // Runs before the pen is given back (Done, leaving the page). Return false
  // when the last text could not be saved: the pen is then kept (Done only).
  beforeRelease?: () => Promise<boolean>;
  // Called when the heartbeat says the pen is no longer ours (or we are no
  // longer allowed). Use it to stop saving and to keep the unsaved text.
  onLost?: () => void;
};

// Only the fields the screen reacts to. Time counters change on every poll
// and would cause a re-render each time for nothing.
function sameLock(a: LockState | null, b: LockState): boolean {
  return (
    a !== null &&
    a.holderId === b.holderId &&
    a.free === b.free &&
    a.isHolder === b.isHolder &&
    a.requestedById === b.requestedById &&
    a.iRequested === b.iRequested &&
    // The wait after "Not now" ends by itself; the screen must notice that.
    a.cooldownSeconds > 0 === b.cooldownSeconds > 0
  );
}

export function useEditLock({
  postId,
  enabled,
  canAcquire,
  onFreshText,
  beforeRelease,
  onLost,
}: Options) {
  const active = enabled && postId !== undefined;

  const [state, setState] = useState<State>({
    phase: "starting",
    lock: null,
    lost: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<Phase>("starting");
  // True while Done or Hand over is running. The viewer poll must not read the
  // pen we are just giving away as "handed over to us".
  const transitionRef = useRef(false);
  // True when the text changed since the last heartbeat. This is what keeps a
  // typist from losing the pen to the automatic transfer.
  const editedRef = useRef(false);
  // Version (updated_at) of the text the editor currently shows.
  const knownVersionRef = useRef<string | null>(null);
  const onFreshRef = useRef(onFreshText);
  const beforeReleaseRef = useRef(beforeRelease);
  const onLostRef = useRef(onLost);

  useEffect(() => {
    onFreshRef.current = onFreshText;
    beforeReleaseRef.current = beforeRelease;
    onLostRef.current = onLost;
  });

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  // Loads the latest text and hands it to the editor when it is new.
  // Returns false when the text could not be loaded.
  const applyFreshText = useCallback(async (id: string): Promise<boolean> => {
    const text = await fetchSharedText(id);
    if (!text) return false;
    if (text.updatedAt !== knownVersionRef.current) {
      knownVersionRef.current = text.updatedAt;
      onFreshRef.current(text);
    }
    return true;
  }, []);

  // Viewer: one cheap version check, the full text only when it changed.
  const refreshIfChanged = useCallback(
    async (id: string): Promise<void> => {
      const version = await fetchPostVersion(id);
      if (version === null || version === knownVersionRef.current) return;
      await applyFreshText(id);
    },
    [applyFreshText],
  );

  // 1. Start: take the pen (owner) or just read the state (viewer).
  useEffect(() => {
    if (!active || !postId) return;
    const id = postId;
    let cancelled = false;

    const first = canAcquire ? acquireLock(id) : getLockState(id);
    void first.then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ phase: "unavailable", lock: null, lost: false });
        return;
      }
      if (canAcquire && result.state.isHolder) {
        // Fresh text BEFORE the editor becomes editable (spec rule 4).
        const loaded = await applyFreshText(id);
        if (cancelled) return;
        if (!loaded) {
          await releaseLock(id);
          if (cancelled) return;
          setState({ phase: "unavailable", lock: null, lost: false });
          return;
        }
        setState({ phase: "editing", lock: result.state, lost: false });
        return;
      }
      setState({ phase: "viewing", lock: result.state, lost: false });
    });

    return () => {
      cancelled = true;
    };
  }, [active, postId, canAcquire, applyFreshText]);

  // 2. Holder: heartbeat every 30 s, and at once when the tab is visible again.
  useEffect(() => {
    if (!active || !postId || state.phase !== "editing") return;
    const id = postId;
    let cancelled = false;
    let inFlight = false;

    function beat() {
      if (inFlight) return;
      inFlight = true;
      const edited = editedRef.current;
      editedRef.current = false;

      void heartbeatLock(id, edited).then((result) => {
        inFlight = false;
        if (cancelled) return;

        if (!result.ok) {
          if (result.reason === "failed") {
            // Network trouble: keep the "I typed" mark for the next beat.
            if (edited) editedRef.current = true;
            return;
          }
          // Not allowed any more (for example removed as co-author).
          onLostRef.current?.();
          setState({ phase: "unavailable", lock: null, lost: true });
          return;
        }

        if (!result.state.isHolder) {
          onLostRef.current?.();
          setState({ phase: "viewing", lock: result.state, lost: true });
          return;
        }

        const lock = result.state;
        setState((prev) =>
          prev.phase === "editing" && sameLock(prev.lock, lock)
            ? prev
            : { phase: "editing", lock, lost: false },
        );
      });
    }

    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") beat();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, postId, state.phase]);

  // 3. Viewer: every 10 s read the lock state and the text (read-only view).
  useEffect(() => {
    if (!active || !postId || state.phase !== "viewing") return;
    const id = postId;
    let cancelled = false;
    let inFlight = false;

    function poll() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;

      void getLockState(id).then(async (result) => {
        if (cancelled) {
          inFlight = false;
          return;
        }
        if (!result.ok) {
          inFlight = false;
          if (result.reason !== "failed") {
            setState({ phase: "unavailable", lock: null, lost: false });
          }
          return;
        }
        const lock = result.state;
        const handedToUs =
          canAcquire &&
          lock.isHolder &&
          !lock.free &&
          !transitionRef.current;

        if (handedToUs) {
          // The pen moved to us while we were reading along (hand over, or
          // the automatic transfer). Fresh text BEFORE the editor becomes
          // editable (spec rule 4).
          const loaded = await applyFreshText(id);
          inFlight = false;
          if (cancelled) return;
          if (loaded && !transitionRef.current) {
            setState({ phase: "editing", lock, lost: false });
            return;
          }
          // The text could not be loaded: stay read-only, the next poll tries
          // again.
        } else {
          await refreshIfChanged(id);
          inFlight = false;
          if (cancelled) return;
        }
        setState((prev) =>
          prev.phase === "viewing" && sameLock(prev.lock, lock)
            ? prev
            : { phase: "viewing", lock, lost: prev.lost },
        );
      });
    }

    const timer = setInterval(poll, VIEWER_POLL_INTERVAL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, postId, state.phase, canAcquire, applyFreshText, refreshIfChanged]);

  // 4. Leaving the page (in-app navigation or unmount): save, then give the
  // pen back. Best effort. Closing the tab cannot do this reliably; the 120 s
  // expiry on the server is the real safety net.
  useEffect(() => {
    if (!active || !postId) return;
    const id = postId;
    return () => {
      if (phaseRef.current !== "editing") return;
      const before = beforeReleaseRef.current;
      void (before ? before().catch(() => false) : Promise.resolve(true)).then(
        () => releaseLock(id),
      );
    };
  }, [active, postId]);

  // The editor calls this when the text changed (feeds the next heartbeat).
  const noteEdit = useCallback(() => {
    editedRef.current = true;
  }, []);

  // Viewer -> holder (the "Start editing" button). Never automatic.
  const startEditing = useCallback(async (): Promise<void> => {
    if (!postId || !canAcquire) return;
    setBusy(true);
    setError(null);
    try {
      const result = await acquireLock(postId);
      if (!result.ok) {
        setError("Couldn't take the pen. Please try again.");
        return;
      }
      if (!result.state.isHolder) {
        // Somebody was faster.
        setState({ phase: "viewing", lock: result.state, lost: false });
        return;
      }
      const loaded = await applyFreshText(postId);
      if (!loaded) {
        await releaseLock(postId);
        setError("Couldn't load the latest text. Please try again.");
        return;
      }
      setState({ phase: "editing", lock: result.state, lost: false });
    } finally {
      setBusy(false);
    }
  }, [postId, canAcquire, applyFreshText]);

  // Holder -> viewer (the "Done" button). Saves first; keeps the pen when the
  // save fails. Returns true when the pen was given back.
  const done = useCallback(async (): Promise<boolean> => {
    if (!postId || phaseRef.current !== "editing") return true;
    setBusy(true);
    setError(null);
    transitionRef.current = true;
    try {
      const before = beforeReleaseRef.current;
      const saved = before ? await before() : true;
      if (!saved) {
        setError("Couldn't save your latest changes, so the pen was kept. Try again.");
        return false;
      }
      // Leave "editing" first so a late heartbeat cannot report a lost pen.
      setState({ phase: "viewing", lock: null, lost: false });
      await releaseLock(postId);
      const result = await getLockState(postId);
      if (result.ok) {
        const lock = result.state;
        setState((prev) =>
          prev.phase === "viewing" ? { ...prev, lock } : prev,
        );
      }
      return true;
    } finally {
      transitionRef.current = false;
      setBusy(false);
    }
  }, [postId]);

  // Viewer: ask the holder for a turn (the "Request turn" button).
  const askForTurn = useCallback(async (): Promise<void> => {
    if (!postId || !canAcquire) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestTurn({ postId });
      if (!result.ok) setError(result.error);
      // Whatever the answer was, the state tells the truth (for example
      // "free", or a wait after "Not now").
      const fresh = await getLockState(postId);
      if (fresh.ok) {
        const lock = fresh.state;
        setState((prev) =>
          prev.phase === "viewing" ? { ...prev, lock } : prev,
        );
      }
    } catch (e) {
      console.error("askForTurn failed:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [postId, canAcquire]);

  // Holder: give the pen to the person who asked ("Hand over"). The text is
  // saved first; when that fails the pen is kept. Rule: the save finishes
  // BEFORE respondTurn is called.
  const handOver = useCallback(async (): Promise<void> => {
    if (!postId || phaseRef.current !== "editing") return;
    setBusy(true);
    setError(null);
    transitionRef.current = true;
    try {
      const before = beforeReleaseRef.current;
      const saved = before ? await before() : true;
      if (!saved) {
        setError("Couldn't save your latest changes, so the pen was kept. Try again.");
        return;
      }
      // Leave "editing" first: nothing can be typed or saved after this.
      setState((prev) => ({ phase: "viewing", lock: prev.lock, lost: false }));

      const result = await respondTurn({ postId, handOver: true });
      const fresh = await getLockState(postId);
      const lock = fresh.ok ? fresh.state : null;

      if (result.ok) {
        setState({ phase: "viewing", lock, lost: false });
        return;
      }
      setError(result.error);
      if (lock && lock.isHolder && !lock.free) {
        // The pen is still ours: carry on typing.
        setState({ phase: "editing", lock, lost: false });
      } else {
        // The pen moved in the meantime. The text was saved before.
        setState({ phase: "viewing", lock, lost: true });
      }
    } catch (e) {
      console.error("handOver failed:", e);
      setError("Something went wrong. Please try again.");
      setState((prev) =>
        prev.phase === "viewing" ? { ...prev, phase: "editing" } : prev,
      );
    } finally {
      transitionRef.current = false;
      setBusy(false);
    }
  }, [postId]);

  // Holder: send the story to the other side (editor <-> author) with a note.
  // The text is saved first; the database then saves a labelled version, gives
  // the pen back and writes the notification. Returns true when it worked.
  const sendTo = useCallback(
    async (note: string): Promise<boolean> => {
      if (!postId || phaseRef.current !== "editing") return false;
      setBusy(true);
      setError(null);
      transitionRef.current = true;
      try {
        const before = beforeReleaseRef.current;
        const saved = before ? await before() : true;
        if (!saved) {
          setError(
            "Couldn't save your latest changes, so the pen was kept. Try again.",
          );
          return false;
        }
        // Leave "editing" first: nothing can be typed or saved after this.
        setState((prev) => ({ phase: "viewing", lock: prev.lock, lost: false }));

        const result = await sendHandover({ postId, note });
        const fresh = await getLockState(postId);
        const lock = fresh.ok ? fresh.state : null;

        if (result.ok) {
          setState({ phase: "viewing", lock, lost: false });
          return true;
        }
        setError(result.error);
        if (lock && lock.isHolder && !lock.free) {
          // The pen is still ours: carry on typing.
          setState({ phase: "editing", lock, lost: false });
        } else {
          // The pen moved in the meantime. The text was saved before.
          setState({ phase: "viewing", lock, lost: true });
        }
        return false;
      } catch (e) {
        console.error("sendTo failed:", e);
        setError("Something went wrong. Please try again.");
        setState((prev) =>
          prev.phase === "viewing" ? { ...prev, phase: "editing" } : prev,
        );
        return false;
      } finally {
        transitionRef.current = false;
        setBusy(false);
      }
    },
    [postId],
  );

  // Holder: keep the pen for now ("Not now"). The person who asked must wait
  // two minutes before asking again.
  const refuseTurn = useCallback(async (): Promise<void> => {
    if (!postId || phaseRef.current !== "editing") return;
    setBusy(true);
    setError(null);
    try {
      const result = await respondTurn({ postId, handOver: false });
      if (!result.ok) setError(result.error);
      const fresh = await getLockState(postId);
      if (fresh.ok && fresh.state.isHolder && !fresh.state.free) {
        const lock = fresh.state;
        setState({ phase: "editing", lock, lost: false });
      }
      // If the pen moved meanwhile, the next heartbeat reports it.
    } catch (e) {
      console.error("refuseTurn failed:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [postId]);

  // The server refused a save because we are not the holder, and the next
  // heartbeat has not noticed yet. Leave "editing" at once so nothing else is
  // saved. The heartbeat effect stops, and the screen shows "You lost the pen".
  const markLost = useCallback(() => {
    if (phaseRef.current !== "editing") return;
    setState({ phase: "viewing", lock: null, lost: true });
  }, []);

  return {
    mode: (active ? state.phase : "off") as EditLockMode,
    // Name of the current holder (null when free or unknown).
    holderName: state.lock?.holderName ?? null,
    // Unknown state counts as free: right after Done the pen really is free.
    free: state.lock ? state.lock.free : true,
    // We were the holder and lost the pen (stays true until we take it again).
    lost: state.lost,
    busy,
    error,
    // The turn request, for the banner. pending: somebody asked (the holder
    // sees who). byMe: it was me. waitSeconds > 0: I was told "Not now".
    request: {
      pending: state.lock !== null && state.lock.requestedById !== null,
      byMe: state.lock?.iRequested ?? false,
      byName: state.lock?.requestedByName ?? null,
      waitSeconds: state.lock?.cooldownSeconds ?? 0,
    },
    noteEdit,
    markLost,
    startEditing,
    done,
    askForTurn,
    handOver,
    refuseTurn,
    sendTo,
  };
}
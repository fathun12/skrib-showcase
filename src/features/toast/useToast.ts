"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MS = 4000;

// One toast at a time: show() replaces the current message and restarts the
// timer. Use with <Toast message={message} open={open} onClose={dismiss} />
// from ui/primitives/toast.
export function useToast(duration = DEFAULT_MS) {
  const [state, setState] = useState({ message: "", open: false });
  const timer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setState((previous) => ({ ...previous, open: false }));
  }, []);

  const show = useCallback(
    (message: string) => {
      window.clearTimeout(timer.current);
      setState({ message, open: true });
      timer.current = window.setTimeout(() => {
        setState((previous) => ({ ...previous, open: false }));
      }, duration);
    },
    [duration],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { message: state.message, open: state.open, show, dismiss };
}
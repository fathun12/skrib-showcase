"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// State of the typewriter button. It only has an effect inside focus mode:
// outside it the editor behaves as always, and the choice is remembered while
// the page stays open.
export function useTypewriter(focusMode: boolean) {
  const [on, setOn] = useState(false);
  // What the editor extension reads on every scroll request.
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = focusMode && on;
  }, [focusMode, on]);

  const toggle = useCallback(() => setOn((value) => !value), []);

  return { on, toggle, enabledRef };
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MentionSuggestion } from "@/ui/notes/MentionTextarea";
import { loadMentionSuggestions } from "./mention-actions";

const DEBOUNCE_MS = 200;

// Loads the @mention suggestions after a short pause in typing. Hand the
// result to <MentionTextarea mention={...}>.
export function useMentionSuggestions() {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the newest request may update the list.
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      requestId.current += 1;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // What was typed after an @ (null = no mention is being typed).
  const onQuery = useCallback((prefix: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    requestId.current += 1;
    const current = requestId.current;

    if (prefix === null) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const result = await loadMentionSuggestions(prefix);
        if (current !== requestId.current) return;
        setSuggestions(result.ok ? result.suggestions : []);
      } catch {
        if (current === requestId.current) setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { suggestions, onQuery };
}
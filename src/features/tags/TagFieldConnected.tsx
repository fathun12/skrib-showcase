"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TagField, type TagSuggestionItem } from "@/ui/editor/TagField";
import { loadTagSuggestions } from "./actions";

const DEBOUNCE_MS = 250;

type Props = {
  tags: string[];
  error?: string | null;
  disabled?: boolean;
  onChange: (tags: string[]) => void;
};

// TagField plus suggestions from the database: the popular topics are loaded
// once when this mounts (when its dialog opens), then matching topics follow
// what the author types, after a short pause.
export function TagFieldConnected({ tags, error, disabled, onChange }: Props) {
  const [popular, setPopular] = useState<TagSuggestionItem[]>([]);
  // null = nothing typed, show the popular topics.
  const [matches, setMatches] = useState<TagSuggestionItem[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the newest request may update the list.
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void loadTagSuggestions("").then((result) => {
      if (!cancelled && result.ok) setPopular(result.suggestions);
    });
    return () => {
      cancelled = true;
      requestId.current += 1;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleQuery = useCallback((prefix: string) => {
    if (timer.current) clearTimeout(timer.current);
    requestId.current += 1;
    const current = requestId.current;

    if (prefix.trim() === "") {
      setMatches(null);
      return;
    }
    timer.current = setTimeout(async () => {
      const result = await loadTagSuggestions(prefix);
      if (current !== requestId.current) return;
      setMatches(result.ok ? result.suggestions : []);
    }, DEBOUNCE_MS);
  }, []);

  return (
    <TagField
      tags={tags}
      suggestions={matches ?? popular}
      suggestionsLabel={matches === null ? "Popular topics" : "Matching topics"}
      error={error}
      disabled={disabled}
      onChange={onChange}
      onQuery={handleQuery}
    />
  );
}
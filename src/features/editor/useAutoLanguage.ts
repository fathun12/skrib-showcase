"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { detectLanguage } from "@/features/posts/detect-language";
import type { LanguageCode } from "@/features/posts/languages";

// A draft with less text than this (characters) counts as "just started".
const START_LIMIT = 200;
// Wait this long after the last keystroke before guessing.
const DELAY_MS = 1500;

type Options = {
  editor: TiptapEditor | null;
  // Only drafts are guessed; a published post never changes language by itself.
  enabled: boolean;
  // Nobody without the pen may change anything.
  locked: boolean;
  // Title and subtitle, added to the body text.
  getExtraText: () => string;
  getLanguage: () => string;
  onDetected: (code: LanguageCode) => void;
};

// Guesses the language while the author types in a new draft. A manual choice
// calls stop(), and then nothing changes by itself any more.
export function useAutoLanguage(options: Options) {
  const { editor, enabled } = options;
  const optionsRef = useRef(options);
  const activeRef = useRef(false);
  const decidedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    optionsRef.current = options;
  });

  // Decided once, when the editor exists: is this a draft that just started?
  useEffect(() => {
    if (!editor || decidedRef.current) return;
    decidedRef.current = true;
    activeRef.current =
      enabled && editor.getText().trim().length < START_LIMIT;
  }, [editor, enabled]);

  useEffect(() => {
    if (!editor) return;

    const detectNow = async () => {
      const current = optionsRef.current;
      if (editor.isDestroyed || !activeRef.current || current.locked) return;
      const text = `${current.getExtraText()} ${editor.getText()}`;
      const found = await detectLanguage(text);
      // The author may have picked a language while we were guessing.
      if (!found || !activeRef.current) return;
      const now = optionsRef.current.getLanguage();
      if (found === now) return;
      if (found === "id" && now === "ms") return;
      setAuto(true);
      optionsRef.current.onDetected(found);
    };

    const onUpdate = () => {
      if (!activeRef.current || optionsRef.current.locked) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void detectNow();
      }, DELAY_MS);
    };

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [editor]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setAuto(false);
  }, []);

  return { auto, stop };
}
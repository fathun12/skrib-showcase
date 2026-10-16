"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import { FindBar } from "@/ui/editor/FindBar";
import { scrollParent } from "./typewriter-extension";

type Props = {
  editor: TiptapEditor;
  // The text to look for when the bar opens (the selected text, or empty).
  seed: string;
  canReplace: boolean;
  focusMode: boolean;
  onClose: () => void;
};

// The bar is mounted fresh every time it opens (the parent changes its key),
// so its fields start clean and the highlights are removed when it unmounts.
export function FindBarConnected({
  editor,
  seed,
  canReplace,
  focusMode,
  onClose,
}: Props) {
  const [query, setQuery] = useState(seed);
  const [replacement, setReplacement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribes to the extension's storage; a change re-renders the bar.
  const state = useEditorState({
    editor,
    selector: (context) => {
      const find = context.editor.storage.findAndReplace;
      return {
        resultCount: find.results.length,
        currentIndex: find.currentIndex,
        caseSensitive: find.caseSensitive,
        wholeWord: find.wholeWord,
      };
    },
  });

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.select();
    if (seed) editor.commands.setSearchTerm(seed);
    return () => {
      if (!editor.isDestroyed) editor.commands.clearSearch();
    };
  }, [editor, seed]);

  // Keeps the selected result on screen. The extension only moves the
  // highlight; it does not scroll.
  useEffect(() => {
    const index = state.currentIndex;
    if (index === null) return;
    const frame = requestAnimationFrame(() => {
      const hit = editor.storage.findAndReplace.results[index];
      if (!hit) return;
      try {
        const top = editor.view.coordsAtPos(hit.from).top;
        if (top >= 120 && top <= window.innerHeight - 160) return;
        const container = scrollParent(editor.view.dom);
        if (container) {
          const area = container.getBoundingClientRect();
          container.scrollTop += top - (area.top + area.height * 0.35);
        } else {
          window.scrollBy(0, top - window.innerHeight * 0.35);
        }
      } catch {
        // The position is gone (the text changed): nothing to show.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, state.currentIndex, state.resultCount]);

  function handleQueryChange(value: string) {
    setQuery(value);
    editor.commands.setSearchTerm(value);
  }

  function replaceCurrent() {
    if (!canReplace || state.resultCount === 0) return;
    editor.commands.setReplaceTerm(replacement);
    if (state.currentIndex === null) editor.commands.goToNextResult();
    editor.commands.replace();
  }

  function replaceEverything() {
    if (!canReplace || state.resultCount === 0) return;
    editor.commands.setReplaceTerm(replacement);
    editor.commands.replaceAll();
  }

  return (
    <FindBar
      query={query}
      replacement={replacement}
      caseSensitive={state.caseSensitive}
      wholeWord={state.wholeWord}
      resultCount={state.resultCount}
      currentIndex={state.currentIndex}
      canReplace={canReplace}
      focusMode={focusMode}
      queryRef={inputRef}
      onQueryChange={handleQueryChange}
      onReplacementChange={setReplacement}
      onToggleCase={() => editor.commands.setCaseSensitive(!state.caseSensitive)}
      onToggleWholeWord={() => editor.commands.setWholeWord(!state.wholeWord)}
      onNext={() => editor.commands.goToNextResult()}
      onPrevious={() => editor.commands.goToPreviousResult()}
      onReplace={replaceCurrent}
      onReplaceAll={replaceEverything}
      onClose={onClose}
    />
  );
}
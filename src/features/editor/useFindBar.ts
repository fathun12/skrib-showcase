"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";

// A selection longer than this is not used as the search text.
const SEED_MAX = 60;

// State of the find bar, and the Ctrl+F (Cmd+F) key that opens it. The key is
// taken over only while the cursor is in the text or in the bar itself; in the
// title, the subtitle or outside the editor the browser's own find stays.
export function useFindBar(editor: TiptapEditor | null) {
  const [open, setOpen] = useState(false);
  // A new number mounts a fresh bar (clean fields, new seed).
  const [session, setSession] = useState(0);
  const [seed, setSeed] = useState("");

  const openBar = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { from, to, empty } = editor.state.selection;
    const picked = empty
      ? ""
      : editor.state.doc.textBetween(from, to, " ").trim();
    setSeed(picked.length > 0 && picked.length <= SEED_MAX ? picked : "");
    setSession((value) => value + 1);
    setOpen(true);
  }, [editor]);

  const closeBar = useCallback(() => {
    setOpen(false);
    if (editor && !editor.isDestroyed) editor.commands.focus();
  }, [editor]);

  useEffect(() => {
    const current = editor;
    if (!current) return;

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "f" ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.defaultPrevented ||
        !current ||
        current.isDestroyed
      ) {
        return;
      }
      const active = document.activeElement;
      const bar =
        active instanceof Element
          ? active.closest<HTMLElement>("[data-find-bar]")
          : null;
      const inEditor = active !== null && current.view.dom.contains(active);
      if (!bar && !inEditor) return;

      event.preventDefault();
      if (bar) {
        // Already in the bar: only select the search text again.
        const input = bar.querySelector<HTMLInputElement>("input");
        input?.focus();
        input?.select();
        return;
      }
      openBar();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, openBar]);

  return { open, session, seed, openBar, closeBar };
}
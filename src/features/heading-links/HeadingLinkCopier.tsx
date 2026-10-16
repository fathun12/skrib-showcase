"use client";

import { useEffect, useRef, useState } from "react";

const ANCHOR_SELECTOR = "[data-reading-body] a.heading-anchor";
const SHOW_MS = 2000;

// Copies the link of a section when its "#" is clicked, and says so. The link
// itself is a real <a href="#h-..."> drawn on the server, so without
// JavaScript it still jumps to the section. The click is NOT cancelled: the
// page scrolls and the address bar gets the same link that is copied.
export function HeadingLinkCopier() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest(ANCHOR_SELECTOR);
      const href = anchor?.getAttribute("href");
      if (!href) return;

      // Absolute link without any query string of the current address.
      const url = `${window.location.origin}${window.location.pathname}${href}`;
      void navigator.clipboard?.writeText(url).then(
        () => {
          setMessage("Link copied");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setMessage(null), SHOW_MS);
        },
        () => {
          // Clipboard blocked: the address bar already holds the link.
        },
      );
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div role="status">
      {message ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-lg sm:bottom-6">
          {message}
        </div>
      ) : null}
    </div>
  );
}
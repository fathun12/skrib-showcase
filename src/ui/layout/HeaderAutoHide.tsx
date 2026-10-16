"use client";

import { useEffect } from "react";

// Always show the header this close to the top of the page.
const SHOW_NEAR_TOP = 80;
// Ignore tiny movements (a trackpad, a bounce at the end of the page).
const MIN_DELTA = 8;

// Hides the sticky header while the reader scrolls down and shows it again on
// the way up or near the top. It only sets an attribute on <html>; the header
// moves with a CSS transform (see Header.tsx), so nothing is positioned from
// JavaScript and nothing can lag behind the scroll.
export function HeaderAutoHide() {
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    let frame: number | undefined;

    function apply() {
      frame = undefined;
      const y = window.scrollY;
      if (y < SHOW_NEAR_TOP) {
        root.removeAttribute("data-header-hidden");
        lastY = y;
        return;
      }
      const delta = y - lastY;
      if (Math.abs(delta) < MIN_DELTA) return;
      if (delta > 0) root.setAttribute("data-header-hidden", "true");
      else root.removeAttribute("data-header-hidden");
      lastY = y;
    }

    function onScroll() {
      if (frame === undefined) frame = window.requestAnimationFrame(apply);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      root.removeAttribute("data-header-hidden");
    };
  }, []);

  return null;
}
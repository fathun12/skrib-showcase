"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/ui/layout/MobileNav";
import { isEditorPath } from "@/ui/layout/mobile-nav-paths";

// Above this distance from the top of the page the bar may shrink.
const SHRINK_AFTER = 48;
// Scroll movements smaller than this (px) are ignored (no flicker).
const STEP = 6;

// Owns what the bar needs to know: the current path and the scroll
// direction. Scrolling down shrinks the bar, scrolling up (or being near
// the top) restores it. No bar at all on the editor pages.
export function MobileNavConnected({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    function update() {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < SHRINK_AFTER) {
        setCompact(false);
        lastY = y;
      } else if (delta > STEP) {
        setCompact(true);
        lastY = y;
      } else if (delta < -STEP) {
        setCompact(false);
        lastY = y;
      }
    }

    function onScroll() {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (isEditorPath(pathname)) return null;

  return (
    <MobileNav
      pathname={pathname}
      compact={compact}
      unreadCount={unreadCount}
    />
  );
}
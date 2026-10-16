"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The pill fades this long after the scrolling stops.
const HIDE_AFTER_MS = 2500;

type Props = { readingTimeMin: number };

// A thin line on the top edge that grows while the article body is read, and
// a small "~N min left" pill that shows only while scrolling. Only the body is
// measured (not the comments). Both are hidden from screen readers.
export function ReadingProgress({ readingTimeMin }: Props) {
  const [progress, setProgress] = useState(0);
  const [measurable, setMeasurable] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>("[data-reading-body]");
    if (!body) return;

    let frame = 0;
    let hideTimer = 0;

    const measure = () => {
      frame = 0;
      const rect = body.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const range = rect.height - window.innerHeight;
      // A body shorter than the screen has nothing to measure.
      if (range <= 0) {
        setMeasurable(false);
        setProgress(0);
        return;
      }
      setMeasurable(true);
      setProgress(Math.min(1, Math.max(0, (window.scrollY - top) / range)));
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    const onScroll = () => {
      schedule();
      setScrolling(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setScrolling(false), HIDE_AFTER_MS);
    };

    schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    // Images that load later change the height of the body.
    const observer = new ResizeObserver(schedule);
    observer.observe(body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      window.clearTimeout(hideTimer);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  if (!measurable) return null;

  const minutesLeft = Math.ceil(readingTimeMin * (1 - progress));

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-50 h-[3px]"
      >
        <div
          className="h-full w-full origin-left bg-primary"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      {minutesLeft > 0 ? (
        <div
          aria-hidden="true"
          className={cn(
            // bottom-24 keeps it above the floating bottom bar on phones.
            "pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-surface/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none sm:bottom-6",
            scrolling ? "opacity-100" : "opacity-0",
          )}
        >
          ~{minutesLeft} min left
        </div>
      ) : null}
    </>
  );
}
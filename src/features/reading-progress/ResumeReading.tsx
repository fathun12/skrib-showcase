"use client";

import { useEffect, useRef, useState } from "react";
import { ResumeBanner } from "@/ui/post/ResumeBanner";
import { classifyProgress, roundProgress } from "./rules";

// The place is saved this long after the scrolling stops.
const SAVE_DELAY_MS = 3000;
// A smaller move than this (1% of the story) is not worth a request.
const MIN_CHANGE = 0.01;
const ENDPOINT = "/api/reading-progress";

// Where the reader is in the article BODY, from 0 to 1. The same measure as
// ReadingProgress (the line on top). null = the body is shorter than the
// screen, so there is nothing to measure.
export function measureBody(): number | null {
  const body = document.querySelector<HTMLElement>("[data-reading-body]");
  if (!body) return null;
  const rect = body.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const range = rect.height - window.innerHeight;
  if (range <= 0) return null;
  return Math.min(1, Math.max(0, (window.scrollY - top) / range));
}

function send(method: "POST" | "DELETE", payload: object) {
  // keepalive lets the request finish while the page is closing. Failures are
  // ignored on purpose: a lost place is not worth an error message.
  void fetch(ENDPOINT, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

type Props = {
  postId: string;
  // The saved place (0 to 1) or null when there is nothing to resume.
  initialProgress: number | null;
};

export function ResumeReading({ postId, initialProgress }: Props) {
  const [asking, setAsking] = useState(initialProgress !== null);
  // While the question is open nothing is saved, so an accidental scroll
  // cannot overwrite the saved place before the reader has answered.
  const askingRef = useRef(initialProgress !== null);
  const lastSaved = useRef<number | null>(initialProgress);
  const latest = useRef<number | null>(null);

  useEffect(() => {
    let timer = 0;
    let frame = 0;

    const flush = () => {
      window.clearTimeout(timer);
      if (askingRef.current) return;
      const raw = latest.current;
      if (raw === null) return;
      const value = roundProgress(raw);
      if (classifyProgress(value) === "ignore") return;
      if (
        lastSaved.current !== null &&
        Math.abs(value - lastSaved.current) < MIN_CHANGE
      ) {
        return;
      }
      lastSaved.current = value;
      send("POST", { postId, progress: value });
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          const value = measureBody();
          if (value !== null) latest.current = value;
        });
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, SAVE_DELAY_MS);
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      if (frame !== 0) cancelAnimationFrame(frame);
      // Leaving the article inside the app (no page hide): save the last place.
      flush();
    };
  }, [postId]);

  function closeQuestion() {
    askingRef.current = false;
    setAsking(false);
  }

  function handleContinue() {
    const body = document.querySelector<HTMLElement>("[data-reading-body]");
    if (body && initialProgress !== null) {
      const rect = body.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const range = rect.height - window.innerHeight;
      if (range > 0) {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({
          top: top + initialProgress * range,
          behavior: reduce ? "auto" : "smooth",
        });
      }
    }
    closeQuestion();
  }

  function handleStartOver() {
    lastSaved.current = null;
    send("DELETE", { postId });
    closeQuestion();
  }

  if (!asking || initialProgress === null) return null;

  return (
    <ResumeBanner
      percent={Math.round(initialProgress * 100)}
      onContinue={handleContinue}
      onStartOver={handleStartOver}
    />
  );
}
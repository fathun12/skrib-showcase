"use client";

import { useEffect } from "react";
import { measureBody } from "@/features/reading-progress/ResumeReading";
import { createClient } from "@/lib/supabase/client";

// Counts only, nothing about the reader is stored (PROJECT_SPEC.md, Insights).
// A VIEW = 8 seconds on the story with the tab visible. A READ = the same
// visit, scrolled past 85% of the article body (the measure of reading
// progress). Once per story per tab (sessionStorage). The database ignores
// unpublished stories and the story's own authors.
const VIEW_AFTER_SECONDS = 8;
const READ_AT = 0.85;

type Kind = "view" | "read";

function flagKey(postId: string, kind: Kind): string {
  return `skrib:stat:${kind}:${postId}`;
}

function wasSent(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSent(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: the counter may count again after a reload. Fine.
  }
}

export function PostStatsBeacon({ postId }: { postId: string }) {
  useEffect(() => {
    // Automated browsers are not readers.
    if (navigator.webdriver) return;

    let viewSent = wasSent(flagKey(postId, "view"));
    let readSent = wasSent(flagKey(postId, "read"));
    if (viewSent && readSent) return;

    const supabase = createClient();
    let visibleSeconds = 0;

    // Failures are silent on purpose: a lost count is not worth a message.
    const send = (kind: Kind) => {
      markSent(flagKey(postId, kind));
      void Promise.resolve(
        supabase.rpc("record_post_event", { p_post_id: postId, p_kind: kind }),
      ).catch(() => {});
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      if (!viewSent) {
        visibleSeconds += 1;
        if (visibleSeconds < VIEW_AFTER_SECONDS) return;
        viewSent = true;
        send("view");
      }

      if (!readSent) {
        const progress = measureBody();
        // null = the whole body fits on the screen.
        if (progress === null || progress >= READ_AT) {
          readSent = true;
          send("read");
        }
      }

      if (viewSent && readSent) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [postId]);

  return null;
}
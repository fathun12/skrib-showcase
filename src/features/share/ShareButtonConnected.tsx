"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_URL } from "@/lib/site";
import { ShareButton } from "@/ui/post/ShareButton";

type Props = {
  // Canonical article path, for example "/alice/my-story".
  path: string;
  title: string;
};

export function ShareButtonConnected({ path, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop the timer if the page is left while "Copied" is showing.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link.");
    }
  }

  async function handleShare() {
    const url = `${SITE_URL}${path}`;
    setError(null);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        // The reader closed the share sheet: not an error.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Any other failure: fall back to copying the link.
      }
    }
    await copyLink(url);
  }

  return (
    <div className="flex items-center gap-3">
      <ShareButton onShare={handleShare} copied={copied} />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
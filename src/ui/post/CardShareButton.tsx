"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

type Props = {
  // Canonical article path, for example "/alice/my-story".
  path: string;
  title: string;
};

// Small icon-only Share button for the footer line of a post card. Uses the
// share sheet when the browser has one, otherwise copies the link.
export function CardShareButton({ path, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleShare() {
    const url = `${window.location.origin}${path}`;
    setFailed(false);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        // The reader closed the share sheet: not an error.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share this post"
        className="relative z-10 -m-1 inline-flex items-center rounded-full p-1 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        {copied ? (
          <Check className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
      {failed ? (
        <span role="alert" className="text-xs text-destructive">
          Could not copy
        </span>
      ) : null}
    </>
  );
}
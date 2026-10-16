"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HighlightColor } from "@/ui/editor/colors";
import { Tooltip } from "@/ui/primitives/tooltip";
import { MarkedText } from "@/ui/highlights/MarkedText";

export type HighlightRowProps = {
  quote: string;
  // The private note, or null.
  note: string | null;
  color: HighlightColor;
  // Link to the story at this highlight; null when the story is not available.
  href: string | null;
  // The searched text (already cleaned); its occurrences are shown in bold.
  term?: string;
};

const LONG_QUOTE = 220;

// One highlight in a flat list: the quote on a rounded marker in the highlight
// color (the same --hl-* tokens as the article), and the private note under it
// in small muted text with a lock. No box, no line.
export function HighlightRow({
  quote,
  note,
  color,
  href,
  term = "",
}: HighlightRowProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isLong = quote.length > LONG_QUOTE;

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(quote);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the text can still be selected by hand.
    }
  }

  const text = (
    <p
      className={cn(
        "font-serif text-lg leading-8 text-foreground",
        isLong && !expanded && "line-clamp-3",
      )}
    >
      <span
        className="rounded-md px-1 py-0.5 box-decoration-clone"
        style={{ backgroundColor: `var(--hl-${color})` }}
      >
        <MarkedText text={quote} term={term} />
      </span>
    </p>
  );

  return (
    <li className="group flex gap-3">
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block rounded-sm hover:opacity-80">
            {text}
          </Link>
        ) : (
          text
        )}
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
        {note ? (
          <p
            className="mt-2.5 border-l-2 pl-3 text-sm whitespace-pre-wrap text-muted-foreground"
            style={{
              borderColor: `color-mix(in srgb, var(--hl-${color}), var(--foreground) 20%)`,
            }}
          >
            <span className="sr-only">Private note: </span>
            <MarkedText text={note} term={term} />
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Tooltip label={copied ? "Copied" : "Copy quote"}>
          <button
            type="button"
            onClick={copyQuote}
            aria-label={copied ? "Copied" : "Copy quote"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
          </button>
        </Tooltip>
        {href ? (
          <Tooltip label="Open in story">
            <Link
              href={href}
              aria-label="Open in story"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Tooltip>
        ) : null}
      </div>
    </li>
  );
}
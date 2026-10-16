"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  // True when the row is newer than the last time the page was opened.
  isNew: boolean;
  children: ReactNode;
};

// One row of the notifications list. A new row is tinted and has a dot until
// it is clicked, tapped or focused. The mark exists on screen only: the page
// marks everything as seen when it opens (MarkSeen), so after a refresh or a
// new visit no row is new.
// The state takes `isNew` once and ignores later changes on purpose: marking
// everything as seen makes the server render the page again with the new
// time, and that must not remove the mark.
export function NotificationRow({ isNew, children }: Props) {
  const [fresh, setFresh] = useState(isNew);

  return (
    <li
      onClick={() => setFresh(false)}
      onFocus={() => setFresh(false)}
      className={cn(
        "relative flex items-center gap-3 px-3 py-4 transition-colors duration-300 motion-reduce:transition-none",
        fresh && "bg-primary/10",
      )}
    >
      {fresh ? (
        <>
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-0.5 size-1.5 -translate-y-1/2 rounded-full bg-primary"
          />
          <span className="sr-only">New. </span>
        </>
      ) : null}
      {children}
    </li>
  );
}
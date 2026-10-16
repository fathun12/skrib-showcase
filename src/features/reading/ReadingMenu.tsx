"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import {
  ReadingMenuPanel,
  type ReadingTocItem,
} from "@/ui/post/ReadingMenuPanel";
import { useReading } from "./ReadingPage";
import { SIZE_MAX, isDefaultReading } from "./settings";

// The "..." button in the info row of the article and its dropdown.
type Props = {
  // Headings for the "On this page" section (empty: the section is hidden).
  headings?: ReadingTocItem[];
};

export function ReadingMenu({ headings }: Props) {
  const { settings, update, reset } = useReading();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on a click or tap outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          // The first button in the wrapper is the "..." button.
          wrapperRef.current?.querySelector("button")?.focus();
        }
      }}
      onBlur={(event) => {
        // Keyboard users who tab out close it. Safari does not focus buttons
        // on click (relatedTarget is null), so only a real target counts.
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Reading options"
        className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </button>

      {open ? (
        <ReadingMenuPanel
          size={settings.size}
          sizeMax={SIZE_MAX}
          width={settings.width}
          sepia={settings.sepia}
          progress={settings.progress}
          sans={settings.sans}
          isDefault={isDefaultReading(settings)}
          headings={headings}
          onNavigate={() => setOpen(false)}
          onSizeChange={(size) => update({ size })}
          onWidthChange={(width) => update({ width })}
          onSepiaChange={(sepia) => update({ sepia })}
          onProgressChange={(progress) => update({ progress })}
          onSansChange={(sans) => update({ sans })}
          onReset={reset}
        />
      ) : null}
    </div>
  );
}
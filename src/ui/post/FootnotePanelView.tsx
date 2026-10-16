import type { Ref } from "react";
import { ArrowDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FootnotePanelMode = "margin" | "sheet";

export type FootnotePanelViewProps = {
  id: string;
  title: string;
  // "margin": a panel in the empty space beside the article, placed with
  // top, left (DOCUMENT coordinates: it scrolls with the text) and maxHeight.
  // "sheet": a fixed card at the bottom of the screen.
  mode: FootnotePanelMode;
  top: number;
  left: number;
  maxHeight: number;
  // The address of the note at the end of the article.
  goToHref: string;
  panelRef?: Ref<HTMLDivElement>;
  // The note text is put here by the parent (copied nodes, links included).
  bodyRef?: Ref<HTMLDivElement>;
  onGoToNote: () => void;
  onClose: () => void;
};

// A footnote that stays open until the reader clicks outside it. Props only:
// the opening, closing and placing live in features/footnote-preview.
export function FootnotePanelView({
  id,
  title,
  mode,
  top,
  left,
  maxHeight,
  goToHref,
  panelRef,
  bodyRef,
  onGoToNote,
  onClose,
}: FootnotePanelViewProps) {
  return (
    <div
      id={id}
      ref={panelRef}
      role="region"
      aria-label={title}
      tabIndex={-1}
      style={mode === "margin" ? { top, left, maxHeight } : undefined}
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-background/95 text-sm text-foreground shadow-lg outline-none backdrop-blur",
        mode === "margin"
          ? // absolute (not fixed): the panel scrolls together with the text.
            // z-30: it passes UNDER the sticky header (z-40).
            "absolute z-30 w-72"
          : // bottom-24 keeps it above the floating bottom bar on phones.
            "fixed z-50 inset-x-3 bottom-24 max-h-[45vh] sm:inset-x-auto sm:left-1/2 sm:w-md sm:-translate-x-1/2",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 pr-1.5 pl-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close note"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 leading-relaxed wrap-break-word [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_p+p]:mt-2"
      />
      <div className="border-t border-border px-2 py-1.5">
        <a
          href={goToHref}
          onClick={onGoToNote}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowDown className="size-3.5" aria-hidden="true" />
          Go to note
        </a>
      </div>
    </div>
  );
}
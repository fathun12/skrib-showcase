import type { Ref } from "react";
import { Lock, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_SWATCH,
  type HighlightColor,
} from "@/ui/editor/colors";
import { Button } from "@/ui/primitives/button";

export type HighlightPanelMode = "margin" | "sheet";

export type HighlightPanelViewProps = {
  id: string;
  // "margin": beside the article, placed with top, left (DOCUMENT
  // coordinates: it scrolls with the text) and maxHeight. "sheet": a fixed
  // card at the bottom of the screen.
  mode: HighlightPanelMode;
  top: number;
  left: number;
  maxHeight: number;
  color: HighlightColor;
  // The text in the note box (the draft).
  note: string;
  noteMax: number;
  // True when the draft differs from the saved note.
  dirty: boolean;
  // Share as card is offered for 20 to 280 characters.
  canCard: boolean;
  // What is busy now (a label), or null. Everything is disabled while busy.
  busy: string | null;
  error: string | null;
  noteRef?: Ref<HTMLTextAreaElement>;
  onColor: (color: HighlightColor) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
  onShare: () => void;
  onDelete: () => void;
  onClose: () => void;
};

// The private note of one highlight, in the margin of the article. Props only:
// the saving, closing and placing live in features/highlights.
// data-highlight-ui: the document click handler of ReaderTools ignores it.
export function HighlightPanelView({
  id,
  mode,
  top,
  left,
  maxHeight,
  color,
  note,
  noteMax,
  dirty,
  canCard,
  busy,
  error,
  noteRef,
  onColor,
  onNoteChange,
  onSave,
  onShare,
  onDelete,
  onClose,
}: HighlightPanelViewProps) {
  const disabled = busy !== null;
  return (
    <div
      id={id}
      role="region"
      aria-label="Private note"
      data-highlight-ui
      style={{
        borderLeftColor: HIGHLIGHT_SWATCH[color],
        ...(mode === "margin" ? { top, left, maxHeight } : {}),
      }}
      className={cn(
        "flex flex-col overflow-y-auto rounded-2xl border border-l-4 border-border bg-background/95 text-sm text-foreground shadow-lg outline-none backdrop-blur",
        mode === "margin"
          ? // absolute (not fixed): the panel scrolls together with the text.
            // z-30: it passes UNDER the sticky header (z-40).
            "absolute z-30 w-72"
          : // bottom-24 keeps it above the floating bottom bar on phones.
            "fixed z-50 inset-x-3 bottom-24 max-h-[60vh] sm:inset-x-auto sm:left-1/2 sm:w-md sm:-translate-x-1/2",
      )}
    >
      <div className="flex items-center justify-between gap-2 py-2 pr-1.5 pl-4">
        <div
          role="group"
          aria-label="Highlight color"
          className="flex items-center gap-2"
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Highlight ${c}`}
              aria-pressed={c === color}
              onClick={() => onColor(c)}
              disabled={disabled}
              className={cn(
                "size-5 rounded-full border border-border/60 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none",
                c === color &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: HIGHLIGHT_SWATCH[c] }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close note"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-4">
        <textarea
          ref={noteRef}
          value={note}
          maxLength={noteMax}
          rows={4}
          placeholder="Add a private note"
          aria-label="Private note"
          onChange={(event) => onNoteChange(event.target.value)}
          className="w-full resize-none bg-transparent leading-relaxed wrap-break-word outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3" aria-hidden="true" />
          Only you can see this
        </span>
        {note.length >= noteMax - 100 ? (
          <span aria-hidden="true">
            {note.length}/{noteMax}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="px-4 pb-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        {canCard ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onShare}
            disabled={disabled}
          >
            {busy === "card" ? "Making card..." : "Share as card"}
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="Delete highlight"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-full px-4"
          onClick={onSave}
          disabled={disabled || !dirty}
        >
          {busy === "save" ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
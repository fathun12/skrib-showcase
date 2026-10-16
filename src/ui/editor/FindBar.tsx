import type { KeyboardEvent, Ref } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/ui/primitives/tooltip";

export type FindBarProps = {
  query: string;
  replacement: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  resultCount: number;
  // Index of the selected result, or null when none is selected.
  currentIndex: number | null;
  // False when the editor is read-only: the replace row is hidden.
  canReplace: boolean;
  // In focus mode a pill sits in the top right corner, so the bar sits lower.
  focusMode?: boolean;
  queryRef?: Ref<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onToggleCase: () => void;
  onToggleWholeWord: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
};

const FIELD =
  "h-9 min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/15";
const ICON_BUTTON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 disabled:hover:bg-transparent";
const TEXT_BUTTON =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 disabled:hover:bg-transparent";

// The find and replace bar of the editor. Props only: the search itself lives
// in features/editor/FindBarConnected.tsx.
export function FindBar({
  query,
  replacement,
  caseSensitive,
  wholeWord,
  resultCount,
  currentIndex,
  canReplace,
  focusMode = false,
  queryRef,
  onQueryChange,
  onReplacementChange,
  onToggleCase,
  onToggleWholeWord,
  onNext,
  onPrevious,
  onReplace,
  onReplaceAll,
  onClose,
}: FindBarProps) {
  const counter =
    query === ""
      ? ""
      : resultCount === 0
        ? "No results"
        : `${(currentIndex ?? 0) + 1} of ${resultCount}`;

  function onQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) onPrevious();
    else onNext();
  }

  function onReplaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onReplace();
  }

  function onRootKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    // preventDefault: the focus mode Esc handler skips a handled Esc.
    event.preventDefault();
    onClose();
  }

  return (
    <div
      role="search"
      aria-label="Find and replace"
      data-find-bar=""
      onKeyDown={onRootKeyDown}
      className={cn(
        "sticky z-20 mb-4 w-full rounded-2xl border border-border bg-background/90 p-2 shadow-lg backdrop-blur sm:max-w-md",
        focusMode ? "top-14 sm:top-3" : "top-20",
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={queryRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onQueryKeyDown}
            placeholder="Find"
            aria-label="Find"
            autoComplete="off"
            spellCheck={false}
            className={cn(FIELD, "pl-9")}
          />
        </div>
        <span
          aria-live="polite"
          className="w-16 shrink-0 text-center text-xs text-muted-foreground"
        >
          {counter}
        </span>
        <button
          type="button"
          onClick={onPrevious}
          disabled={resultCount === 0}
          aria-label="Previous result"
          className={ICON_BUTTON}
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={resultCount === 0}
          aria-label="Next result"
          className={ICON_BUTTON}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close find and replace"
          className={ICON_BUTTON}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {canReplace ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            type="text"
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            onKeyDown={onReplaceKeyDown}
            placeholder="Replace with"
            aria-label="Replace with"
            autoComplete="off"
            spellCheck={false}
            className={FIELD}
          />
          <button
            type="button"
            onClick={onReplace}
            disabled={resultCount === 0}
            className={TEXT_BUTTON}
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onReplaceAll}
            disabled={resultCount === 0}
            className={TEXT_BUTTON}
          >
            All
          </button>
        </div>
      ) : null}

      <div className="mt-1.5 flex items-center gap-1.5">
        <Tooltip label="Match case">
          <button
            type="button"
            onClick={onToggleCase}
            aria-pressed={caseSensitive}
            aria-label="Match case"
            className={cn(TEXT_BUTTON, caseSensitive && "bg-accent text-primary")}
          >
            Aa
          </button>
        </Tooltip>
        <Tooltip label="Whole word">
          <button
            type="button"
            onClick={onToggleWholeWord}
            aria-pressed={wholeWord}
            aria-label="Whole word"
            className={cn(TEXT_BUTTON, wholeWord && "bg-accent text-primary")}
          >
            Word
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
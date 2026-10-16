import {
  Headphones,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none";

export type ListenButtonViewProps = {
  // True while the article is being read or paused.
  active: boolean;
  onClick: () => void;
};

// The button in the info row, next to the "..." reading options.
export function ListenButtonView({ active, onClick }: ListenButtonViewProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Stop listening" : "Listen to this article"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
        active ? "bg-accent text-primary" : "text-muted-foreground",
      )}
    >
      <Headphones className="size-5" aria-hidden="true" />
    </button>
  );
}

export type ListenBarViewProps = {
  playing: boolean;
  // Zero-based index of the block being read, and how many there are.
  index: number;
  total: number;
  rate: number;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRate: () => void;
  onClose: () => void;
};

// The floating pill with the controls. It sits above the "~N min left" pill
// and the floating bottom bar of phones.
export function ListenBarView({
  playing,
  index,
  total,
  rate,
  onToggle,
  onPrev,
  onNext,
  onRate,
  onClose,
}: ListenBarViewProps) {
  return (
    <div
      role="group"
      aria-label="Listening controls"
      className="fixed bottom-36 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-surface/90 px-1.5 py-1.5 shadow-lg backdrop-blur-md sm:bottom-16"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={index <= 0}
        aria-label="Previous paragraph"
        className={ICON_BUTTON}
      >
        <SkipBack className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(ICON_BUTTON, "bg-foreground text-background hover:bg-foreground/90")}
      >
        {playing ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next paragraph"
        className={ICON_BUTTON}
      >
        <SkipForward className="size-4" aria-hidden="true" />
      </button>
      <span
        aria-live="off"
        className="px-2 text-xs tabular-nums text-muted-foreground"
      >
        {index + 1} / {total}
      </span>
      <button
        type="button"
        onClick={onRate}
        aria-label={`Speed ${rate}x, change`}
        className="inline-flex h-9 min-w-11 items-center justify-center rounded-full px-2 text-xs font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        {rate}x
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={ICON_BUTTON}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
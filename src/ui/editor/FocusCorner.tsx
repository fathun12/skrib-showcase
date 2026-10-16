import type { ReactNode } from "react";
import { AlignVerticalJustifyCenter, Minimize2 } from "lucide-react";
import { SaveStatus, type SaveStatusState } from "./SaveStatus";
import { Tooltip } from "@/ui/primitives/tooltip";

type Props = {
  saveState: SaveStatusState;
  errorMessage?: string | null;
  // Shows a Retry button next to a failed save.
  onRetry?: () => void;
  // The word count (a dim line).
  stats?: ReactNode;
  // Typewriter scroll: keeps the line you type in the middle of the screen.
  typewriter?: boolean;
  onToggleTypewriter?: () => void;
  onExit: () => void;
};

// The only thing left on screen in focus mode: a small pill at the top right
// (the top, not the bottom: a phone keyboard covers the bottom, and there is
// no Esc key there). Dim while typing, fully bright when the save failed.
export function FocusCorner({
  saveState,
  errorMessage,
  onRetry,
  stats,
  typewriter = false,
  onToggleTypewriter,
  onExit,
}: Props) {
  return (
    <div
      className={`fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full bg-background/70 px-3 py-1 text-xs backdrop-blur transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none ${
        saveState === "error" ? "opacity-100" : "opacity-60"
      }`}
    >
      {stats}
      <SaveStatus
        state={saveState}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
      {onToggleTypewriter ? (
        <Tooltip label="Typewriter scroll: keeps your line centered">
        <button
          type="button"
          onClick={onToggleTypewriter}
          aria-pressed={typewriter}
          aria-label="Typewriter scroll"
          className={`rounded-full p-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${
            typewriter ? "bg-accent text-primary" : ""
          }`}
        >
          <AlignVerticalJustifyCenter className="size-4" aria-hidden="true" />
        </button>
        </Tooltip>
      ) : null}
      <Tooltip label="Exit focus mode (Esc)">
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit focus mode (Esc)"
        className="rounded-full p-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Minimize2 className="size-4" aria-hidden="true" />
      </button>
      </Tooltip>
    </div>
  );
}
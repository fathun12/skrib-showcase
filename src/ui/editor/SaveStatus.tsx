export type SaveStatusState = "idle" | "dirty" | "saving" | "saved" | "error";

type Props = {
  state: SaveStatusState;
  // Overrides the default text of the "error" state (used for published
  // posts, where nothing is retried automatically).
  errorMessage?: string | null;
  // Shows a Retry button next to the error text. Leave it out when there is
  // nothing to retry.
  onRetry?: () => void;
};

const LABELS: Record<SaveStatusState, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving...",
  saved: "Saved",
  error: "Couldn't save. We'll try again when you keep writing.",
};

export function SaveStatus({ state, errorMessage, onRetry }: Props) {
  const text =
    state === "error" && errorMessage ? errorMessage : LABELS[state];
  const showRetry = state === "error" && onRetry !== undefined;

  return (
    // Fixed height so the text appearing/disappearing never shifts the page.
    <div className="flex h-5 items-center justify-end gap-2">
      <p
        role="status"
        aria-live="polite"
        className={`text-right text-sm ${
          state === "error" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {text}
      </p>
      {showRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-5 shrink-0 items-center rounded-full border border-border px-2.5 text-xs font-medium leading-none text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
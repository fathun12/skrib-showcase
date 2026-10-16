export type HiddenNoticeProps = {
  message: string;
  onUndo: () => void;
  undoDisabled?: boolean;
  error?: string | null;
};

// The thin lavender row that replaces a story card after "Hide stories ...".
export function HiddenNotice({
  message,
  onUndo,
  undoDisabled = false,
  error,
}: HiddenNoticeProps) {
  return (
    <div role="status" className="my-4 rounded-xl bg-accent px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 flex-1 wrap-break-word">{message}</p>
        <button
          type="button"
          onClick={onUndo}
          disabled={undoDisabled}
          className="shrink-0 rounded-full px-3 py-1 font-medium text-primary transition-colors hover:bg-background/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 motion-reduce:transition-none"
        >
          Undo
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
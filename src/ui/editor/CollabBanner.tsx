import { buttonVariants } from "@/ui/primitives/button";

// What the banner says. The editor decides which one applies.
export type CollabBannerState =
  | "starting"
  | "editing"
  | "turn"
  | "other"
  | "requested"
  | "free"
  | "lost"
  | "reload"
  | "unavailable";

type Props = {
  state: CollabBannerState;
  // Name of the person who holds the pen (state "other").
  holderName?: string | null;
  // Disables the buttons while a request is running.
  busy?: boolean;
  // Short message about a failed action, shown under the banner text.
  error?: string | null;
  // "Start editing" (states "free" and "lost"). Leave it out when the viewer
  // is not allowed to take the pen: the button is then not shown.
  onStart?: () => void;
  // "Done" (state "editing"): gives the pen back.
  onDone?: () => void;
  // State "editing": sends the story to the other side (editor <-> author).
  // Leave it out when there is nobody to send it to.
  onSendHandover?: () => void;
  sendLabel?: string;
  // State "turn": somebody asked for the pen. Their name, and the two answers:
  // hand the pen over, or keep it for now ("Not now").
  requesterName?: string | null;
  onHandOver?: () => void;
  onRefuse?: () => void;
  // State "other": "Request turn". Leave it out when the viewer cannot take
  // the pen. requestNote says why asking is not possible right now (the
  // button is then disabled).
  onRequest?: () => void;
  requestNote?: string | null;
  // State "reload": the post got co-authors after this page was opened.
  onReload?: () => void;
  // States "lost" and "reload" with typing that was not saved: offers to copy it.
  onCopyUnsaved?: () => void;
  copied?: boolean;
};

export function CollabBanner({
  state,
  holderName,
  busy = false,
  error,
  onStart,
  onDone,
  onSendHandover,
  sendLabel = "Send",
  requesterName,
  onHandOver,
  onRefuse,
  onRequest,
  requestNote,
  onReload,
  onCopyUnsaved,
  copied = false,
}: Props) {
  const isProblem =
    state === "lost" || state === "reload" || state === "unavailable";

  let text: string;
  switch (state) {
    case "starting":
      text = "Checking who is editing...";
      break;
    case "editing":
      text = "You have the pen. Others can read along, but they can't type.";
      break;
    case "turn":
      text = `${requesterName ?? "Another author"} would like a turn. If you stay idle for about a minute, the pen passes to them by itself.`;
      break;
    case "other":
      text = `Being edited by ${holderName ?? "another author"}. You can read along; the text updates by itself.`;
      break;
    case "requested":
      text = `Request sent to ${holderName ?? "the author"}. You get the pen when they hand it over, or by itself after about a minute if they stay idle.`;
      break;
    case "free":
      text = "Nobody is editing right now.";
      break;
    case "lost":
      text = onCopyUnsaved
        ? "You lost the pen. Your latest typing was not saved."
        : "You lost the pen. Your text up to that moment is saved.";
      break;
    case "reload":
      text = onCopyUnsaved
        ? "This post now has co-authors. Your latest typing was not saved. Reload the page to continue."
        : "This post now has co-authors. Reload the page to continue.";
      break;
    case "unavailable":
      text = "Couldn't reach the editing lock. Reload the page to try again.";
      break;
  }

  const showStart = (state === "free" || state === "lost") && onStart;
  const showDone = state === "editing" && onDone;
  const showSend = state === "editing" && onSendHandover;
  const showTurnButtons = state === "turn" && onHandOver && onRefuse;
  const showRequest = state === "other" && onRequest;
  const showCopy = (state === "lost" || state === "reload") && onCopyUnsaved;
  const showReload = state === "reload" && onReload;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm ${
        isProblem
          ? "border-destructive/40 bg-surface text-destructive"
          : "border-border bg-accent text-foreground"
      }`}
    >
      <div className="min-w-0">
        <p>{text}</p>
        {state === "other" && requestNote && (
          <p className="mt-1 text-muted-foreground">{requestNote}</p>
        )}
        {error && <p className="mt-1 text-destructive">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showCopy && (
          <button
            type="button"
            disabled={copied}
            onClick={onCopyUnsaved}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {copied ? "Copied" : "Copy my unsaved text"}
          </button>
        )}
        {showStart && (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            {busy ? "Starting..." : "Start editing"}
          </button>
        )}
        {showSend && (
          <button
            type="button"
            disabled={busy}
            onClick={onSendHandover}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            {sendLabel}
          </button>
        )}
        {showDone && (
          <button
            type="button"
            disabled={busy}
            onClick={onDone}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {busy ? "Saving..." : "Done"}
          </button>
        )}
        {showTurnButtons && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onRefuse}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Not now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onHandOver}
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              {busy ? "Handing over..." : "Hand over"}
            </button>
          </>
        )}
        {showRequest && (
          <button
            type="button"
            disabled={busy || Boolean(requestNote)}
            onClick={onRequest}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {busy ? "Asking..." : "Request turn"}
          </button>
        )}
        {showReload && (
          <button
            type="button"
            onClick={onReload}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );
}
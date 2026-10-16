import { Button, buttonVariants } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { fieldClass } from "@/ui/primitives/field";
import {
  MentionTextarea,
  type MentionTextareaProps,
} from "@/ui/notes/MentionTextarea";

export type RespondDialogProps = {
  open: boolean;
  // The quoted passage, shown on top as plain text.
  quote: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  pending?: boolean;
  error?: string | null;
  // True after the response was posted.
  sent?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  // @mention suggestions (optional), loaded by the parent.
  mention?: MentionTextareaProps["mention"];
};

export function RespondDialog({
  open,
  quote,
  value,
  onChange,
  maxLength,
  pending = false,
  error,
  sent = false,
  onSubmit,
  onClose,
  mention,
}: RespondDialogProps) {
  const empty = value.trim() === "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-send.
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending && !empty && !sent) onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {sent ? "Response posted" : "Respond to this passage"}
            </DialogTitle>
            <DialogDescription>
              {sent
                ? "Your response is public and now appears in the comments."
                : "Your response is a public comment. The passage is shown above your text."}
            </DialogDescription>
          </DialogHeader>

          <blockquote className="max-h-40 overflow-y-auto rounded-xl border-l-2 border-primary/60 bg-muted/50 px-3.5 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Responding to
            </p>
            <p className="mt-1 font-serif text-sm leading-relaxed wrap-break-word whitespace-pre-wrap italic">
              {quote}
            </p>
          </blockquote>

          {sent ? null : (
            <div className="relative">
              <MentionTextarea
                label="Your response"
                value={value}
                onChange={onChange}
                maxLength={maxLength}
                mention={mention}
                rows={4}
                disabled={pending}
                autoFocus
                placeholder="Write your response..."
                className={`${fieldClass} min-h-28 w-full resize-none pb-7 disabled:opacity-60`}
              />
              <span
                aria-hidden="true"
                className="absolute right-3 bottom-2 text-xs text-muted-foreground"
              >
                {value.length}/{maxLength}
              </span>
            </div>
          )}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            {sent ? (
              <>
                <Button type="button" variant="ghost" onClick={onClose}>
                  Done
                </Button>
                <a
                  href="#comments"
                  onClick={onClose}
                  className={buttonVariants({
                    className: "h-9 rounded-full px-5",
                  })}
                >
                  View in comments
                </a>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || empty}>
                  {pending ? "Posting..." : "Post response"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
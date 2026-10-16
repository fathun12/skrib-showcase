import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { labelClass } from "@/ui/primitives/field";

const NOTE_MAX = 280;

type Props = {
  open: boolean;
  // Who receives the story.
  target: "author" | "editor";
  note: string;
  sending?: boolean;
  // Error of the last send.
  error?: string | null;
  onNoteChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
};

export function HandoverDialog({
  open,
  target,
  note,
  sending = false,
  error,
  onNoteChange,
  onSend,
  onClose,
}: Props) {
  const toAuthor = target === "author";
  const title = toAuthor ? "Send to author" : "Send to editor";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-send.
        if (!next && !sending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sending) onSend();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {toAuthor
                ? "Your text is saved and the pen is released. The author gets a notification with your note. A version called “Edited” is kept in History, so they can compare."
                : "Your text is saved and the pen is released. Your editor gets a notification with your note. A version called “Before edit” is kept in History, so you can compare and restore it."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label htmlFor="handover-note" className={labelClass}>
              Note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id="handover-note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              maxLength={NOTE_MAX}
              rows={4}
              disabled={sending}
              placeholder={
                toAuthor
                  ? "For example: fixed the punctuation, please check the second paragraph."
                  : "For example: please fix the punctuation and tighten the intro."
              }
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60"
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length} / {NOTE_MAX}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={sending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
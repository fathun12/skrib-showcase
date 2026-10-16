import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { fieldClass, labelClass } from "@/ui/primitives/field";

export type RepostCaptionDialogProps = {
  open: boolean;
  // "Repost with caption" for a new repost, "Edit caption" for an existing one.
  title: string;
  submitLabel: string;
  caption: string;
  max: number;
  pending?: boolean;
  error?: string | null;
  // Shown only when the repost already has a caption.
  canRemove: boolean;
  onCaptionChange: (caption: string) => void;
  onSubmit: () => void;
  onRemove: () => void;
  onClose: () => void;
};

export function RepostCaptionDialog({
  open,
  title,
  submitLabel,
  caption,
  max,
  pending = false,
  error,
  canRemove,
  onCaptionChange,
  onSubmit,
  onRemove,
  onClose,
}: RepostCaptionDialogProps) {
  const empty = caption.trim().length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-send.
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Your note is public. It is shown above the story to people who
              see your repost.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label htmlFor="repost-caption" className={labelClass}>
              Caption
            </label>
            <div className="relative">
              <textarea
                id="repost-caption"
                value={caption}
                maxLength={max}
                rows={3}
                disabled={pending}
                onChange={(event) => onCaptionChange(event.target.value)}
                placeholder="Why is this worth reading?"
                className={`${fieldClass} resize-none pb-7`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground"
              >
                {caption.length}/{max}
              </span>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            {canRemove ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                disabled={pending}
                onClick={onRemove}
              >
                Remove caption
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || empty}
              onClick={onSubmit}
            >
              {pending ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
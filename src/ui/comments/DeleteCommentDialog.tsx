import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

export type DeleteCommentDialogProps = {
  open: boolean;
  // True when the comment has replies: they are deleted too.
  hasReplies: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteCommentDialog({
  open,
  hasReplies,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: DeleteCommentDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-delete.
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <div className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Delete this comment?</DialogTitle>
            <DialogDescription>
              {hasReplies
                ? "This also deletes all replies to it. It can't be undone."
                : "It can't be undone."}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
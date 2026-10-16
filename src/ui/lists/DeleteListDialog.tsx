import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

export type DeleteListDialogProps = {
  open: boolean;
  name: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteListDialog({
  open,
  name,
  pending = false,
  error,
  onConfirm,
  onClose,
}: DeleteListDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete this list?</DialogTitle>
          <DialogDescription>
            &ldquo;{name}&rdquo; is removed. Your stories stay in Saved; only
            the list is deleted.
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
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting..." : "Delete list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
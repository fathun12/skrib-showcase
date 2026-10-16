import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

export type UnsubscribeDialogProps = {
  open: boolean;
  authorName: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function UnsubscribeDialog({
  open,
  authorName,
  pending = false,
  error,
  onConfirm,
  onClose,
}: UnsubscribeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Unsubscribe from {authorName}?</DialogTitle>
            <DialogDescription>
              You will stop getting new stories from {authorName} by email. You
              can subscribe again anytime.
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
            <Button type="button" disabled={pending} onClick={onConfirm}>
              {pending ? "Unsubscribing..." : "Unsubscribe"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
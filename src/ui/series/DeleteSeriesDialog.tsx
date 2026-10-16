"use client";

import { useState, useTransition } from "react";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  title: string;
  // On success the action redirects and never returns.
  onDelete: (input: { id: string }) => Promise<{ ok: false; error: string }>;
};

// Controlled on purpose: it is opened from the "..." menu of the series page.
export function DeleteSeriesDialog({
  open,
  onOpenChange,
  seriesId,
  title,
  onDelete,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await onDelete({ id: seriesId });
      setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete this series?</DialogTitle>
          <DialogDescription>
            &ldquo;{title}&rdquo; is removed. Your stories stay where they are;
            only the grouping is deleted.
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
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Deleting..." : "Delete series"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
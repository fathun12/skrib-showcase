import type { ReactNode } from "react";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { CoverField } from "./CoverField";

type Props = {
  open: boolean;
  coverUrl?: string | null;
  uploading?: boolean;
  // True while a change (cover or topics) is being saved to the post.
  saving?: boolean;
  error?: string | null;
  // The topics field, only for the owner (a co-author does not get it).
  tagField?: ReactNode;
  // The pin row, only for the owner.
  pinField?: ReactNode;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onClose: () => void;
};

// Details of a published post: the cover and, for the owner, the topics.
// Every change is saved right away, so there is no confirm button, only Done.
// (The file keeps its old name; the editor still imports it as CoverDialog.)
export function CoverDialog({
  open,
  coverUrl,
  uploading = false,
  saving = false,
  error,
  tagField,
  pinField,
  onSelect,
  onRemove,
  onClose,
}: Props) {
  const busy = uploading || saving;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-save.
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <div className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Details</DialogTitle>
            <DialogDescription>
              {tagField
                ? "Changes to the cover and the topics go live right away. They do not need the Update button."
                : "Changes to the cover go live right away. They do not need the Update button."}
            </DialogDescription>
          </DialogHeader>

          <CoverField
            coverUrl={coverUrl}
            uploading={uploading}
            error={error}
            disabled={saving}
            onSelect={onSelect}
            onRemove={onRemove}
          />

          {tagField}

          {pinField}

          <DialogFooter>
            <Button type="button" disabled={busy} onClick={onClose}>
              {busy ? "Saving..." : "Done"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
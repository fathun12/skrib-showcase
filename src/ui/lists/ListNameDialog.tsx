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

export type ListNameDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  value: string;
  maxLength: number;
  pending?: boolean;
  error?: string | null;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

// One small form for "New list" and "Rename list".
export function ListNameDialog({
  open,
  title,
  description,
  submitLabel,
  value,
  maxLength,
  pending = false,
  error,
  onValueChange,
  onSubmit,
  onClose,
}: ListNameDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-save.
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="grid gap-1.5">
            <label htmlFor="list-name" className={labelClass}>
              Name
            </label>
            <div className="relative">
              <input
                id="list-name"
                type="text"
                value={value}
                maxLength={maxLength}
                disabled={pending}
                placeholder="Read later"
                onChange={(event) => onValueChange(event.target.value)}
                className={`${fieldClass} pr-14`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground"
              >
                {value.length}/{maxLength}
              </span>
            </div>
          </div>

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
              type="submit"
              disabled={pending || value.trim().length === 0}
            >
              {pending ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
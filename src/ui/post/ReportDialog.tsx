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
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASON_VALUES,
  type ReportReason,
} from "./report-reasons";

export type ReportDialogProps = {
  open: boolean;
  // Defaults are for reporting a post.
  title?: string;
  description?: string;
  reason: ReportReason | null;
  details: string;
  pending?: boolean;
  // True after the report was received: the dialog shows a thank-you.
  sent?: boolean;
  error?: string | null;
  onReasonChange: (reason: ReportReason) => void;
  onDetailsChange: (details: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function ReportDialog({
  open,
  title = "Report this post",
  description = "Tell us what is wrong. The author will not see who reported it.",
  reason,
  details,
  pending = false,
  sent = false,
  error,
  onReasonChange,
  onDetailsChange,
  onSubmit,
  onClose,
}: ReportDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-send.
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={false}>
        {sent ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Thanks for the report</DialogTitle>
              <DialogDescription>
                We received it and will take a look.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <fieldset className="grid gap-2" disabled={pending}>
              <legend className="sr-only">Reason</legend>
              {REPORT_REASON_VALUES.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/60 has-checked:border-primary/60 has-checked:bg-accent has-focus-visible:ring-4 has-focus-visible:ring-primary/15"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => onReasonChange(value)}
                    className="size-4 accent-primary"
                  />
                  <span>{REPORT_REASON_LABELS[value]}</span>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-1.5">
              <label htmlFor="report-details" className={labelClass}>
                Details{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <textarea
                  id="report-details"
                  value={details}
                  maxLength={REPORT_DETAILS_MAX}
                  rows={3}
                  disabled={pending}
                  onChange={(event) => onDetailsChange(event.target.value)}
                  className={`${fieldClass} resize-none pb-7`}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground"
                >
                  {details.length}/{REPORT_DETAILS_MAX}
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
                type="button"
                disabled={pending || reason === null}
                onClick={onSubmit}
              >
                {pending ? "Sending..." : "Send report"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
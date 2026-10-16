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
import { POLICY_OPTIONS, type NoteComposerPolicy } from "./NoteComposer";
import {
  MentionTextarea,
  type MentionTextareaProps,
} from "@/ui/notes/MentionTextarea";
import { NoteQuoteEmbed, type NoteQuoteData } from "./NoteQuoteEmbed";

export type QuoteNoteDialogProps = {
  open: boolean;
  // The note being quoted, shown as a preview under the text box.
  quoted: NoteQuoteData;
  value: string;
  onChange: (value: string) => void;
  policy: NoteComposerPolicy;
  onPolicyChange: (policy: NoteComposerPolicy) => void;
  maxLength: number;
  pending?: boolean;
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
  // @mention suggestions (optional), loaded by the parent.
  mention?: MentionTextareaProps["mention"];
};

export function QuoteNoteDialog({
  open,
  quoted,
  value,
  onChange,
  policy,
  onPolicyChange,
  maxLength,
  pending = false,
  error,
  onSubmit,
  onClose,
  mention,
}: QuoteNoteDialogProps) {
  const empty = value.trim().length === 0;

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
            <DialogTitle>Quote note</DialogTitle>
            <DialogDescription>
              Your note is public. It shows the quoted note under your text.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label htmlFor="quote-note-text" className={labelClass}>
              Your note
            </label>
            <div className="relative">
              <MentionTextarea
                id="quote-note-text"
                value={value}
                onChange={onChange}
                maxLength={maxLength}
                mention={mention}
                rows={4}
                disabled={pending}
                placeholder="Add your thoughts..."
                className={`${fieldClass} resize-none pb-7`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground"
              >
                {value.length}/{maxLength}
              </span>
            </div>
            <NoteQuoteEmbed quote={quoted} interactive={false} />
          </div>

          <label className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Who can reply</span>
            <select
              value={policy}
              disabled={pending}
              onChange={(event) =>
                onPolicyChange(event.target.value as NoteComposerPolicy)
              }
              className={`${fieldClass} w-auto py-1.5`}
            >
              {POLICY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

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
              disabled={pending || empty}
              onClick={onSubmit}
            >
              {pending ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
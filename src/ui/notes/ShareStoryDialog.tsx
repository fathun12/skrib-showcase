import { cn } from "@/lib/utils";
import {
  POLICY_OPTIONS,
  type NoteComposerPolicy,
} from "@/ui/notes/NoteComposer";
import { StoryEmbed, type NoteStoryData } from "@/ui/notes/StoryEmbed";
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

export type ShareStoryDialogProps = {
  open: boolean;
  story: NoteStoryData;
  // A passage quoted from the story (null or missing: a plain share).
  quote?: string | null;
  caption: string;
  maxLength: number;
  policy: NoteComposerPolicy;
  pending?: boolean;
  error?: string | null;
  onCaptionChange: (caption: string) => void;
  onPolicyChange: (policy: NoteComposerPolicy) => void;
  // Shown only when a quote is set.
  onRemoveQuote?: () => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function ShareStoryDialog({
  open,
  story,
  quote,
  caption,
  maxLength,
  policy,
  pending = false,
  error,
  onCaptionChange,
  onPolicyChange,
  onRemoveQuote,
  onSubmit,
  onClose,
}: ShareStoryDialogProps) {
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
            <DialogTitle>Share to a note</DialogTitle>
            <DialogDescription>
              Your note is public and shows this story.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label htmlFor="share-story-caption" className={labelClass}>
              Your thought
            </label>
            <div className="relative">
              <textarea
                id="share-story-caption"
                value={caption}
                maxLength={maxLength}
                rows={4}
                disabled={pending}
                onChange={(event) => onCaptionChange(event.target.value)}
                placeholder="Why is this worth reading?"
                className={cn(fieldClass, "resize-none pb-7")}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground"
              >
                {caption.length}/{maxLength}
              </span>
            </div>
          </div>

          <div className="-mt-2">
            <StoryEmbed story={story} quote={quote} interactive={false} />
            {quote && onRemoveQuote ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 rounded-full"
                disabled={pending}
                onClick={onRemoveQuote}
              >
                Remove quote
              </Button>
            ) : null}
          </div>

          <label className="flex items-center gap-2">
            <span
              className={cn(labelClass, "font-normal text-muted-foreground")}
            >
              Who can reply
            </span>
            <select
              value={policy}
              disabled={pending}
              onChange={(event) =>
                onPolicyChange(event.target.value as NoteComposerPolicy)
              }
              className={cn(fieldClass, "w-auto py-1.5")}
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
              {pending ? "Sharing..." : "Share"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
  title: string;
  slug: string;
  // Max length of the address (the limit lives in features/, so it comes in as a prop).
  slugMaxLength?: number;
  username: string;
  pending?: boolean;
  error?: string | null;
  // Cover image (optional). The upload itself happens in the parent.
  coverUrl?: string | null;
  coverUploading?: boolean;
  coverError?: string | null;
  // The topics field. It comes from the parent because it loads suggestions
  // from the database, and ui/ does not import from features/.
  tagField?: ReactNode;
  // Newsletter: how many people get an email. The checkbox shows only when
  // this is above 0 and onEmailSubscribersChange is given.
  subscriberCount?: number;
  emailSubscribers?: boolean;
  onEmailSubscribersChange?: (value: boolean) => void;
  // Gentle suggestions computed by the parent (images without alt text, no
  // cover, no topics, a short title). They never block Publish.
  checks?: string[];
  // "Now / Schedule" row, built by the parent.
  scheduleField?: ReactNode;
  // Texts that change when the story is scheduled instead of published.
  // The editor path: the cover stays as the author left it.
  hideCover?: boolean;
  // Replaces the sentence under the title.
  description?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  emailNote?: string;
  onCoverSelect: (file: File) => void;
  onCoverRemove: () => void;
  onSlugChange: (value: string) => void;
  onSlugBlur: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PublishDialog({
  open,
  title,
  slug,
  slugMaxLength,
  username,
  pending = false,
  error,
  coverUrl,
  coverUploading = false,
  coverError,
  tagField,
  subscriberCount = 0,
  emailSubscribers = true,
  onEmailSubscribersChange,
  checks = [],
  scheduleField,
  hideCover = false,
  description,
  confirmLabel = "Publish",
  pendingLabel = "Publishing...",
  emailNote,
  onCoverSelect,
  onCoverRemove,
  onSlugChange,
  onSlugBlur,
  onConfirm,
  onCancel,
}: Props) {
  const busy = pending || coverUploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never while publishing.
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) onConfirm();
          }}
        >
          <DialogHeader>
            <DialogTitle>Publish post</DialogTitle>
            <DialogDescription>
              {description ?? "Your post will be public at the address below."}
            </DialogDescription>
          </DialogHeader>

          {/* Only this part scrolls, so the buttons below always stay in
              view. The small negative margin and padding keep the focus
              ring of the fields from being clipped. */}
          <div className="-mx-1.5 grid max-h-[calc(100dvh-16rem)] gap-4 overflow-y-auto px-1.5">
            <div>
              <p className="text-sm font-medium">Title</p>
              <p className="font-serif text-lg font-semibold leading-snug">
                {title}
              </p>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="publish-slug" className="text-sm font-medium">
                Address
              </label>
              <div className="flex items-center rounded-xl border border-border bg-muted/40 px-3.5 text-sm transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/15">
                <span className="shrink-0 text-muted-foreground">
                  /{username}/
                </span>
                <input
                  id="publish-slug"
                  type="text"
                  value={slug}
                  onChange={(event) => onSlugChange(event.target.value)}
                  onBlur={onSlugBlur}
                  disabled={pending}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={slugMaxLength}
                  className="min-w-0 flex-1 bg-transparent py-2 outline-none"
                />
              </div>
            </div>

            {!hideCover && (
              <CoverField
                coverUrl={coverUrl}
                uploading={coverUploading}
                error={coverError}
                disabled={pending}
                onSelect={onCoverSelect}
                onRemove={onCoverRemove}
              />
            )}

            {tagField}

            {scheduleField}

            {checks.length > 0 ? (
              <details className="group rounded-xl border border-border bg-muted/40 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span className="font-medium">
                    Worth a look{" "}
                    <span className="font-normal text-muted-foreground">
                      ({checks.length})
                    </span>
                  </span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="pb-3 text-muted-foreground">
                  <p className="px-3.5 pb-1 text-xs">
                    None of these stop you from publishing.
                  </p>
                  <ul className="list-disc space-y-0.5 pr-3.5 pl-9">
                    {checks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {subscriberCount > 0 && onEmailSubscribersChange ? (
              <label className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={emailSubscribers}
                  onChange={(event) =>
                    onEmailSubscribersChange(event.target.checked)
                  }
                  disabled={pending}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="font-medium">
                  {`Email ${subscriberCount} ${
                    subscriberCount === 1 ? "subscriber" : "subscribers"
                  }`}
                </span>
                <span className="text-muted-foreground">
                  {emailNote ?? "Sent once, right after publishing."}
                </span>
              </label>
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
              <Button type="submit" disabled={busy}>
                {pending ? pendingLabel : confirmLabel}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
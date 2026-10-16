import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

export type HistoryItem = {
  id: string;
  createdAt: string;
  reason: string;
  savedByName: string | null;
  title: string;
  wordCount: number;
};

export type HistoryPreview = {
  createdAt: string;
  title: string;
  subtitle: string;
  language: string;
  paragraphs: string[];
};

type Props = {
  open: boolean;
  // null = not loaded yet (or the load failed, see loadError).
  items: HistoryItem[] | null;
  loading?: boolean;
  loadError?: string | null;
  selectedId: string | null;
  preview: HistoryPreview | null;
  previewLoading?: boolean;
  previewError?: string | null;
  restoring?: boolean;
  // Error of the last restore.
  error?: string | null;
  // True for a published post: a restore still needs the Update button.
  published?: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRestore: () => void;
  onClose: () => void;
};

const REASON_LABELS: Record<string, string> = {
  auto: "Automatic",
  publish: "Published",
  update: "Updated",
  restore: "Before a restore",
  before_edit: "Before edit",
  edited: "Edited",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function HistoryDialog({
  open,
  items,
  loading = false,
  loadError,
  selectedId,
  preview,
  previewLoading = false,
  previewError,
  restoring = false,
  error,
  published = false,
  onSelect,
  onBack,
  onRestore,
  onClose,
}: Props) {
  const detail = selectedId !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-restore.
        if (!next && !restoring) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>
              {detail && preview
                ? `Version of ${formatWhen(preview.createdAt)}`
                : "History"}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? "Check the text, then restore it if it is the one you want. Your current text is kept as a version first."
                : "Earlier versions of this post. They are saved while you write, and whenever you publish or update."}
            </DialogDescription>
          </DialogHeader>

          {!detail && (
            <div className="grid gap-2">
              {loading && (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
              {loadError && (
                <p role="alert" className="text-sm text-destructive">
                  {loadError}
                </p>
              )}
              {items && items.length === 0 && (
                <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
                  No versions yet. The first one appears after you have written
                  for a while.
                </p>
              )}
              {items && items.length > 0 && (
                <ul className="grid max-h-80 gap-2 overflow-y-auto">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        className="w-full rounded-xl border border-border/70 px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
                      >
                        <p className="text-sm font-medium">
                          {formatWhen(item.createdAt)}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {REASON_LABELS[item.reason] ?? item.reason}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate font-serif text-base">
                          {item.title.trim() || "Untitled"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.wordCount.toLocaleString("en-US")} words
                          {item.savedByName ? ` · ${item.savedByName}` : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {detail && (
            <div className="grid gap-2">
              {previewLoading && (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
              {previewError && (
                <p role="alert" className="text-sm text-destructive">
                  {previewError}
                </p>
              )}
              {preview && (
                <div
                  lang={preview.language}
                  className="max-h-80 overflow-y-auto rounded-xl bg-muted/40 px-5 py-4 ring-1 ring-border/60 ring-inset"
                >
                  <p className="font-serif text-lg leading-snug font-bold">
                    {preview.title.trim() || "Untitled"}
                  </p>
                  {preview.subtitle ? (
                    <p className="mt-1 font-serif text-muted-foreground">
                      {preview.subtitle}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 text-sm leading-relaxed">
                    {preview.paragraphs.length === 0 ? (
                      <p className="text-muted-foreground">No text.</p>
                    ) : (
                      preview.paragraphs.map((text, index) => (
                        <p key={index} className="wrap-break-word">
                          {text}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              )}
              {published && preview && (
                <p className="text-xs text-muted-foreground">
                  This post is published. After restoring, press Update to make
                  it live.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            {detail ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={restoring}
                  onClick={onBack}
                >
                  All versions
                </Button>
                <Button
                  type="button"
                  disabled={restoring || preview === null}
                  onClick={onRestore}
                >
                  {restoring ? "Restoring..." : "Restore this version"}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
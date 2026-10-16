import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type RepostButtonProps = {
  reposted: boolean;
  count: number;
  // True when the viewer's own repost has an (old) caption.
  hasCaption: boolean;
  // False for the authors of the story: they can only share it to a note.
  canRepost: boolean;
  pending?: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  // "Repost" (no caption).
  onRepost: () => void;
  onUndo: () => void;
  // "Edit caption": only for a repost that already has a caption.
  onEditCaption: () => void;
  onShareToNote: () => void;
};

const ITEM_CLASS =
  "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

// The trigger button plus a small menu. The menu is positioned against the
// nearest `relative` parent (the connected component supplies it) and is
// opened, closed and dismissed there.
export function RepostButton({
  reposted,
  count,
  hasCaption,
  canRepost,
  pending,
  menuOpen,
  onToggleMenu,
  onRepost,
  onUndo,
  onEditCaption,
  onShareToNote,
}: RepostButtonProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleMenu}
        disabled={pending}
        aria-expanded={menuOpen}
        aria-label={
          !canRepost
            ? `Share options (${count} reposts)`
            : reposted
              ? `Reposted, options (${count})`
              : `Repost or share this story (${count})`
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none",
          reposted ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Repeat2 className="size-5" aria-hidden="true" />
        <span>{count}</span>
      </button>

      {menuOpen ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1 text-foreground shadow-md">
          {canRepost && reposted && hasCaption ? (
            <button type="button" onClick={onEditCaption} className={ITEM_CLASS}>
              Edit caption
            </button>
          ) : null}
          {canRepost ? (
            reposted ? (
              <button type="button" onClick={onUndo} className={ITEM_CLASS}>
                Undo repost
              </button>
            ) : (
              <button type="button" onClick={onRepost} className={ITEM_CLASS}>
                Repost
              </button>
            )
          ) : null}
          {canRepost ? (
            <div role="separator" className="my-1 h-px bg-border" />
          ) : null}
          <button type="button" onClick={onShareToNote} className={ITEM_CLASS}>
            Share to a note...
          </button>
        </div>
      ) : null}
    </>
  );
}
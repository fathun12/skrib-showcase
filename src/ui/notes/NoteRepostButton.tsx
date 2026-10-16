import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoteRepostButtonProps = {
  reposted: boolean;
  count: number;
  // false for a reply and for my own note: only Quote is offered.
  canRepost: boolean;
  pending?: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onRepost: () => void;
  onQuote: () => void;
  onUndo: () => void;
};

const ITEM_CLASS =
  "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

// The trigger plus a small menu. The menu is placed against the nearest
// `relative` parent (the connected component supplies it).
export function NoteRepostButton({
  reposted,
  count,
  canRepost,
  pending,
  menuOpen,
  onToggleMenu,
  onRepost,
  onQuote,
  onUndo,
}: NoteRepostButtonProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleMenu}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={
          reposted ? `Reposted, options (${count})` : `Repost or quote (${count})`
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none",
          reposted ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Repeat2 className="size-5" aria-hidden="true" />
        {count > 0 ? <span className="tabular-nums">{count}</span> : null}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute top-full left-0 z-20 mt-1 w-44 rounded-xl border border-border bg-background/95 p-1 backdrop-blur"
        >
          {canRepost ? (
            reposted ? (
              <button
                type="button"
                role="menuitem"
                onClick={onUndo}
                className={ITEM_CLASS}
              >
                Undo repost
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={onRepost}
                className={ITEM_CLASS}
              >
                Repost
              </button>
            )
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={onQuote}
            className={ITEM_CLASS}
          >
            Quote
          </button>
        </div>
      ) : null}
    </>
  );
}
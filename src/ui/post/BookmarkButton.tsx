import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookmarkButtonProps = {
  saved: boolean;
  pending?: boolean;
  onToggle: () => void;
};

export function BookmarkButton({ saved, pending, onToggle }: BookmarkButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this post"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none",
        saved ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Bookmark className={cn("size-5", saved && "fill-current")} aria-hidden="true" />
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
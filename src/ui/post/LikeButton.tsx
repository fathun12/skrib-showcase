import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export type LikeButtonProps = {
  liked: boolean;
  count: number;
  pending?: boolean;
  onToggle: () => void;
  // Only used in the accessible name ("Like this note").
  subject?: "post" | "note";
};

export function LikeButton({
  liked,
  count,
  pending,
  onToggle,
  subject = "post",
}: LikeButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? `Unlike this ${subject}` : `Like this ${subject}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none",
        liked ? "text-like" : "text-muted-foreground",
      )}
    >
      <Heart className={cn("size-5", liked && "fill-current")} aria-hidden="true" />
      <span>{count}</span>
    </button>
  );
}
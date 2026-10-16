import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShareButtonProps = {
  onShare: () => void;
  // True for a moment after the link was copied.
  copied?: boolean;
};

export function ShareButton({ onShare, copied }: ShareButtonProps) {
  return (
    <>
      <button
        type="button"
        onClick={onShare}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
          copied ? "text-primary" : "text-muted-foreground",
        )}
      >
        {copied ? (
          <Check className="size-5" aria-hidden="true" />
        ) : (
          <Share2 className="size-5" aria-hidden="true" />
        )}
        <span>{copied ? "Copied" : "Share"}</span>
      </button>
      {/* Read aloud by screen readers when the link was copied. */}
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}
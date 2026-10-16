import { MessageCircle } from "lucide-react";

export type CommentCountLinkProps = {
  // Hidden when undefined (the count request failed: no false 0).
  count?: number;
};

// Jumps to the comments section further down the same page.
export function CommentCountLink({ count }: CommentCountLinkProps) {
  return (
    <a
      href="#comments"
      aria-label={
        count === undefined ? "Go to comments" : `Go to comments (${count})`
      }
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <MessageCircle className="size-5" aria-hidden="true" />
      <span>{count ?? "Comments"}</span>
    </a>
  );
}
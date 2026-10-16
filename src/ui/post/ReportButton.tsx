import { Flag } from "lucide-react";

export type ReportButtonProps = {
  onClick: () => void;
  // What a screen reader announces; defaults to reporting a post.
  ariaLabel?: string;
};

export function ReportButton({
  onClick,
  ariaLabel = "Report this post",
}: ReportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <Flag className="size-4" aria-hidden="true" />
      <span>Report</span>
    </button>
  );
}
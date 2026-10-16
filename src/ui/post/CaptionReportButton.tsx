import { Flag } from "lucide-react";

export type CaptionReportButtonProps = {
  onClick: () => void;
};

// Small icon-only button next to a repost caption.
export function CaptionReportButton({ onClick }: CaptionReportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Report this caption"
      className="inline-flex shrink-0 items-center rounded-full p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <Flag className="size-3.5" aria-hidden="true" />
    </button>
  );
}
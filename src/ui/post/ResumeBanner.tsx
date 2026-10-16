import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";

type Props = {
  // Whole number from 5 to 94.
  percent: number;
  onContinue: () => void;
  onStartOver: () => void;
};

// The question at the top of an article: go on where the reader stopped, or
// start over. Fixed below the site header, away from the "min left" pill.
export function ResumeBanner({ percent, onContinue, onStartOver }: Props) {
  return (
    <div
      role="region"
      aria-label="Continue reading"
      className="fixed inset-x-4 top-20 z-30 mx-auto flex max-w-md flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-md backdrop-blur-sm"
    >
      <p className="text-sm">
        Continue where you left off?{" "}
        <span className="text-muted-foreground">{percent}% read</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStartOver}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Start over
        </button>
        <button
          type="button"
          onClick={onContinue}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
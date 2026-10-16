import { cn } from "@/lib/utils";

// A small ring that shows how much of a story was read. Decorative: the
// numbers are always written next to it (and in an aria-label on the card).
export function ProgressRing({
  percent,
  className,
}: {
  // 0 to 100.
  percent: number;
  className?: string;
}) {
  const radius = 5.5;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 -rotate-90", className)}
    >
      <circle
        cx="7"
        cy="7"
        r={radius}
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <circle
        cx="7"
        cy="7"
        r={radius}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
      />
    </svg>
  );
}
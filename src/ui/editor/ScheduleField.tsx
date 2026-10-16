import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";

export type PublishMode = "now" | "schedule";

type Props = {
  mode: PublishMode;
  onModeChange: (mode: PublishMode) => void;
  // The chosen day, YYYY-MM-DD.
  date: string;
  onDateChange: (date: string) => void;
  minDate: string;
  maxDate: string;
  // "16 Oct, around 07:00" for the chosen day, or "" when it is not valid.
  whenLabel: string;
  // The label of a schedule that is already saved, or null.
  existingLabel: string | null;
  onCancelExisting: () => void;
  cancelling?: boolean;
  disabled?: boolean;
};

// One row in the Publish dialog: publish now, or on a chosen day. The day has
// no clock time on purpose: the daily job starts in the morning.
export function ScheduleField({
  mode,
  onModeChange,
  date,
  onDateChange,
  minDate,
  maxDate,
  whenLabel,
  existingLabel,
  onCancelExisting,
  cancelling = false,
  disabled = false,
}: Props) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">When</p>
        <div
          role="group"
          aria-label="When to publish"
          className="flex h-8 items-center rounded-full bg-muted/60 p-0.5 text-xs"
        >
          {(["now", "schedule"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              disabled={disabled}
              onClick={() => onModeChange(option)}
              className={cn(
                "inline-flex h-7 items-center rounded-full px-3.5 outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                mode === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "now" ? "Now" : "Schedule"}
            </button>
          ))}
        </div>
      </div>

      {mode === "schedule" ? (
        <div className="grid gap-1.5">
          <label htmlFor="schedule-date" className="sr-only">
            Day to publish
          </label>
          <div className="flex items-center rounded-xl border border-border bg-muted/40 px-3.5 text-sm transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/15">
            <input
              id="schedule-date"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              disabled={disabled}
              onChange={(event) => onDateChange(event.target.value)}
              style={{ colorScheme: "light dark" }}
              className="min-w-0 flex-1 bg-transparent py-2 outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {whenLabel
              ? `Publishes on ${whenLabel}. It can start up to an hour later.`
              : "Pick a day from tomorrow on."}
          </p>
        </div>
      ) : null}

      {existingLabel ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Currently scheduled for {existingLabel}.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || cancelling}
            onClick={onCancelExisting}
          >
            {cancelling ? "Cancelling..." : "Cancel schedule"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
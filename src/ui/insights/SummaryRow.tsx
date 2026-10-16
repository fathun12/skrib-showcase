import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type SummaryTrend = "up" | "down" | "flat";

export type SummaryItem = {
  label: string;
  // Already formatted by the page (for example "1,204" or "38%").
  value: string;
  // For example "+12%", or null when the previous period has no data.
  change: string | null;
  trend: SummaryTrend;
};

export type SummaryRowProps = {
  items: SummaryItem[];
  // One line under the row, for example "Change against the previous 30 days."
  note: string;
};

// Four large numbers in a flat row (no boxes). The change against the
// previous period is quiet; only a rise uses the primary color.
export function SummaryRow({ items, note }: SummaryRowProps) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 sm:grid-cols-4">
        {items.map((item) => {
          const Icon =
            item.trend === "up"
              ? ArrowUpRight
              : item.trend === "down"
                ? ArrowDownRight
                : Minus;
          return (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 font-serif text-3xl font-bold tracking-tight tabular-nums">
                {item.value}
              </dd>
              <dd className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {item.change === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">
                      No data for the previous period
                    </span>
                  </>
                ) : (
                  <>
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        item.trend === "up" && "text-primary",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "tabular-nums",
                        item.trend === "up" && "text-primary",
                      )}
                    >
                      {item.change}
                    </span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
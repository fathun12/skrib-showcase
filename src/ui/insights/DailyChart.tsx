"use client";

import { useState, type PointerEvent } from "react";

export type DailyChartDay = {
  // "YYYY-MM-DD" (the Asia/Jakarta day).
  day: string;
  views: number;
  reads: number;
};

export type DailyChartProps = { days: DailyChartDay[] };

const WIDTH = 640;
const HEIGHT = 220;
const MIN_BAR = 3;

const longDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const shortDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

// A round top for the scale: 4, 5, 10, 20, 50, 100, ...
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const unit = value / pow;
  const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return step * pow;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

// Views per day as soft bars, reads drawn over them in the full primary
// color. One inline SVG, no chart library. A day without views is a thin
// baseline. Hover or tap a day for its numbers; a hidden table gives the same
// numbers to screen readers.
export function DailyChart({ days }: DailyChartProps) {
  const [active, setActive] = useState<number | null>(null);
  if (days.length === 0) return null;

  const count = days.length;
  const peak = niceMax(
    Math.max(...days.map((day) => Math.max(day.views, day.reads))),
  );
  const slot = WIDTH / count;
  const barWidth = Math.max(2, slot * 0.62);
  const radius = Math.min(3, barWidth / 2);
  const totalViews = days.reduce((sum, day) => sum + day.views, 0);
  const totalReads = days.reduce((sum, day) => sum + day.reads, 0);

  const barHeight = (value: number) =>
    value <= 0 ? 0 : Math.max(MIN_BAR, (value / peak) * (HEIGHT - 4));

  function onDown(event: PointerEvent<SVGRectElement>, index: number) {
    // A second tap on the same day (touch) closes the tooltip.
    setActive((current) =>
      event.pointerType !== "mouse" && current === index ? null : index,
    );
  }

  const activeDay = active === null ? null : days[active];
  const percent = active === null ? 0 : ((active + 0.5) / count) * 100;
  const tooltipPosition =
    percent < 15
      ? "left-0"
      : percent > 85
        ? "right-0"
        : "-translate-x-1/2";

  return (
    <figure className="m-0">
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary/25" />
          Views
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Reads
        </span>
        <span className="ml-auto tabular-nums">
          Up to {formatCount(peak)} a day
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Daily views and reads. ${formatCount(totalViews)} views and ${formatCount(totalReads)} reads in ${count} days.`}
          className="block h-auto w-full touch-pan-y"
        >
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT - 0.5}
            y2={HEIGHT - 0.5}
            className="stroke-border"
            strokeWidth={1}
          />
          {days.map((day, index) => {
            const x = index * slot + (slot - barWidth) / 2;
            const viewsHeight = barHeight(day.views);
            const readsHeight = barHeight(day.reads);
            return (
              <g key={day.day}>
                {viewsHeight === 0 ? (
                  <rect
                    x={x}
                    y={HEIGHT - 1.5}
                    width={barWidth}
                    height={1.5}
                    rx={0.75}
                    className="fill-border"
                  />
                ) : (
                  <rect
                    x={x}
                    y={HEIGHT - viewsHeight}
                    width={barWidth}
                    height={viewsHeight}
                    rx={radius}
                    className={active === index ? "fill-primary/45" : "fill-primary/25"}
                  />
                )}
                {readsHeight > 0 ? (
                  <rect
                    x={x}
                    y={HEIGHT - readsHeight}
                    width={barWidth}
                    height={readsHeight}
                    rx={radius}
                    className="fill-primary"
                  />
                ) : null}
                <rect
                  x={index * slot}
                  y={0}
                  width={slot}
                  height={HEIGHT}
                  className="fill-transparent"
                  onPointerEnter={() => setActive(index)}
                  onPointerDown={(event) => onDown(event, index)}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") setActive(null);
                  }}
                />
              </g>
            );
          })}
        </svg>

        {activeDay ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-background px-2 py-1 text-xs whitespace-nowrap ${tooltipPosition}`}
            style={
              percent >= 15 && percent <= 85 ? { left: `${percent}%` } : undefined
            }
          >
            <p className="font-medium text-foreground">
              {longDay.format(parseDay(activeDay.day))}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {formatCount(activeDay.views)} views, {formatCount(activeDay.reads)} reads
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{shortDay.format(parseDay(days[0].day))}</span>
        <span>{shortDay.format(parseDay(days[Math.floor((count - 1) / 2)].day))}</span>
        <span>{shortDay.format(parseDay(days[count - 1].day))}</span>
      </div>

      <table className="sr-only">
        <caption>Views and reads per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Views</th>
            <th scope="col">Reads</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{longDay.format(parseDay(day.day))}</th>
              <td>{day.views}</td>
              <td>{day.reads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
import type { DayStats, StorySort, StoryStats, Totals } from "./schemas";

// Pure helpers for the Insights page: no data access here.

export function sumDays(days: DayStats[]): Totals {
  const total: Totals = {
    views: 0,
    reads: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    followers: 0,
  };
  for (const day of days) {
    total.views += day.views;
    total.reads += day.reads;
    total.likes += day.likes;
    total.comments += day.comments;
    total.saves += day.saves;
    total.followers += day.followers;
  }
  return total;
}

// Reads divided by views, from 0 to 1. null when there are no views.
export function readRate(totals: Pick<Totals, "views" | "reads">): number | null {
  if (totals.views <= 0) return null;
  return Math.min(1, totals.reads / totals.views);
}

// Change in percent against the previous period. null when the previous
// period had nothing (the page shows an em dash).
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Change of a rate in percentage points. null when either side has no rate.
export function ratePointChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 100);
}

export function sortStories(
  stories: StoryStats[],
  sort: StorySort,
): StoryStats[] {
  const newest = (a: StoryStats, b: StoryStats) =>
    Date.parse(b.published_at) - Date.parse(a.published_at);
  const list = [...stories];
  if (sort === "views") {
    return list.sort((a, b) => b.views - a.views || b.reads - a.reads || newest(a, b));
  }
  if (sort === "reads") {
    return list.sort((a, b) => b.reads - a.reads || b.views - a.views || newest(a, b));
  }
  return list.sort(newest);
}
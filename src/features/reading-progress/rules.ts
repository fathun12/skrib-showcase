// The rules for a reading place, in one pure module shared by the browser,
// the route handler and the database check (migration 0033).

// Below this share of the story nothing is worth resuming.
export const RESUME_MIN = 0.05;
// From this share on the story counts as finished.
export const FINISHED_MIN = 0.95;

export type ProgressKind = "ignore" | "save" | "finished";

// Three decimals are plenty (0.1% of a story) and keep the stored value
// the same as the value that was classified.
export function roundProgress(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// Classify a ROUNDED value (see roundProgress).
export function classifyProgress(value: number): ProgressKind {
  if (!Number.isFinite(value) || value < RESUME_MIN) return "ignore";
  if (value >= FINISHED_MIN) return "finished";
  return "save";
}

// What a card or a list row shows for a story that was started.
export type ProgressMark = {
  // Whole number, 5 to 94.
  percent: number;
  minutesLeft: number;
};

// The one place where "percent" and "minutes left" are worked out. Call it
// only with a value that classifyProgress calls "save".
export function progressMark(
  readingTimeMin: number,
  progress: number,
): ProgressMark {
  return {
    percent: Math.round(progress * 100),
    minutesLeft: Math.max(1, Math.ceil(readingTimeMin * (1 - progress))),
  };
}
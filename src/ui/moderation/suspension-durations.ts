// One list for the suspension durations and one way to print the end time.
export type SuspensionDays = 1 | 7 | 30 | null;

export const SUSPENSION_DURATIONS: { days: SuspensionDays; label: string }[] = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: null, label: "Until lifted" },
];

// Fixed time zone: server and browser must print the same text.
const END_FORMAT = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatSuspensionEnd(iso: string): string {
  return `${END_FORMAT.format(new Date(iso))} UTC`;
}
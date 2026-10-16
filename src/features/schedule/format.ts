// The cron job (vercel.json) runs once a day at 00:00 UTC, and Vercel can
// start it up to an hour late. A scheduled story therefore carries a DAY, and
// the time stored is 00:00 UTC of that day.
const DAY = 86_400_000;

// The first and last day that can be picked (YYYY-MM-DD, UTC). Reads the
// clock, so call it from an event handler, never while rendering.
export function scheduleRange(): { min: string; max: string } {
  const now = Date.now();
  const tomorrow = Math.floor(now / DAY) * DAY + DAY;
  // Too close to midnight: the database wants at least a minute of margin.
  const first = tomorrow - now < 5 * 60_000 ? tomorrow + DAY : tomorrow;
  return {
    min: new Date(first).toISOString().slice(0, 10),
    max: new Date(first + 360 * DAY).toISOString().slice(0, 10),
  };
}

// "16 Oct, around 07:00": the day and the time the cron starts, in the
// reader's own time zone. Empty when the date is not valid.
export function scheduleLabel(date: string): string {
  const instant = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(instant.getTime())) return "";
  const day = instant.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const time = instant.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, around ${time}`;
}
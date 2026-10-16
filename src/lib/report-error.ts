import * as Sentry from "@sentry/nextjs";

// Reports an unexpected failure that an action handled itself: the action
// returned { ok: false } instead of throwing, so Sentry would never see it.
//
// Only the error code and a short message are sent, never the whole object.
// A Postgres error also carries `details` (for a constraint error that can be
// the full row, so the text of a post) and `hint`. That would break the
// promises on the privacy page.
export function reportError(where: string, error: unknown): void {
  const code = readString(error, "code");
  const message = (readString(error, "message") ?? "unknown error").slice(0, 200);

  Sentry.captureException(
    new Error(`${where} failed${code ? ` [${code}]` : ""}: ${message}`),
    {
      tags: { action: where },
      // One issue per action and error code, not one per stack trace.
      fingerprint: ["action-error", where, code ?? "no-code"],
    },
  );
}

function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}
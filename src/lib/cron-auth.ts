import { timingSafeEqual } from "node:crypto";

// The header must be exactly "Bearer <CRON_SECRET>" (Vercel sends it on its
// own). Without the secret set, nothing is allowed. Compared in constant time.
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
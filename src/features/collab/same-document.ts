// Compares two Tiptap documents by value, ignoring the order of object keys.
// Why: Postgres jsonb does not keep key order, so the same document read from
// the database and from the editor can differ as plain strings.

function sortKeys(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = (value as Record<string, unknown>)[key];
  }
  return out;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? sortKeys(v) : v,
  );
}

export function sameDocument(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
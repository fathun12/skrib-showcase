// Pure helpers, no database access. The server action handles collisions.
export const FALLBACK_SLUG = "untitled";
const MAX_SLUG_LENGTH = 80;

// Why: URLs must be plain lowercase ASCII, so we strip accents and symbols.
// Titles with no Latin letters or digits (e.g. only Arabic or Chinese) fall back to "untitled".
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || FALLBACK_SLUG;
}

// attempt 1 -> "my-post", attempt 2 -> "my-post-2", attempt 3 -> "my-post-3"
export function withSuffix(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}
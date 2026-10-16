// Pure helpers for topics (tags). Single source of truth for the Zod schema,
// the editor field and the pages. Keep the pattern in sync with the CHECK
// constraint `posts_tags_format` (migration 0036).

export const TAG_MAX_COUNT = 5;
export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 30;

// One tag: 2 to 30 characters of a-z, 0-9 and hyphens, no hyphen at either end.
const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/;

export function isValidTag(value: string): boolean {
  return TAG_PATTERN.test(value);
}

// Shared cleanup. Accents are dropped first so "café" becomes "cafe" and not
// "caf". Non-Latin letters are not supported in v1 and are dropped.
function toSlugText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "");
}

// Turns what the author typed into a tag, or null when nothing usable is left.
export function normalizeTag(raw: string): string | null {
  // Cutting at the maximum can leave a trailing hyphen: trim it again.
  const slug = toSlugText(raw.trim())
    .slice(0, TAG_MAX_LENGTH)
    .replace(/-+$/, "");
  return slug.length >= TAG_MIN_LENGTH ? slug : null;
}

// For the suggestion box: the same cleanup, but a partial word is fine
// ("machine-" stays as typed).
export function normalizeTagPrefix(raw: string): string {
  return toSlugText(raw.trim()).slice(0, TAG_MAX_LENGTH);
}

// "machine-learning" is shown as "machine learning".
export function tagLabel(tag: string): string {
  return tag.replace(/-/g, " ");
}
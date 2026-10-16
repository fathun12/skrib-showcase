// Plain sync helper (no "use server"). Turns what the author typed into a safe
// href, or null when it is not acceptable. Only http, https and mailto pass,
// the same rule that schemas.ts enforces on the server.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Any "scheme:" such as javascript:, data: or ftp:. A port like
// "localhost:3000" is not a scheme, hence the digit lookahead.
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

function isValidWebUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // A dot (or localhost) filters out typos like "asdf".
    return url.hostname.includes(".") || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function normalizeLinkUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;

  if (/^mailto:/i.test(value)) {
    return EMAIL.test(value.slice("mailto:".length)) ? value : null;
  }
  if (EMAIL.test(value)) return `mailto:${value}`;
  if (/^https?:/i.test(value)) return isValidWebUrl(value) ? value : null;
  if (OTHER_SCHEME.test(value)) return null;

  const withScheme = `https://${value}`;
  return isValidWebUrl(withScheme) ? withScheme : null;
}
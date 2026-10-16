// Pure helper (no network, no React). The ONLY rule for "is this image URL
// allowed": it must be an https URL on our own Cloudinary account.
const MAX_URL_LENGTH = 500;

export function isOwnCloudinaryImageUrl(
  url: string,
  cloudName: string | undefined,
): boolean {
  // No cloud name configured: refuse everything (fail closed).
  if (!cloudName || url.length > MAX_URL_LENGTH) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // `new URL` resolves "../" and credentials tricks like
  // https://res.cloudinary.com@evil.com/..., so the checks below see the real host and path.
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === "res.cloudinary.com" &&
    parsed.port === "" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.pathname.startsWith(`/${cloudName}/image/upload/`)
  );
}

// Avatars may also be the Google profile photo (Sign in with Google stores its
// address). Mirrors the lh3.googleusercontent.com/a/** pattern in next.config.ts.
const GOOGLE_AVATAR_HOST = "lh3.googleusercontent.com";

export function isAllowedAvatarUrl(
  url: string,
  cloudName: string | undefined,
): boolean {
  if (isOwnCloudinaryImageUrl(url, cloudName)) return true;
  if (url.length > MAX_URL_LENGTH) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return (
    parsed.protocol === "https:" &&
    parsed.hostname === GOOGLE_AVATAR_HOST &&
    parsed.port === "" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.pathname.startsWith("/a/")
  );
}
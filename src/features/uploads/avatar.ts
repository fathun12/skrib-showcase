import { isAllowedAvatarUrl } from "./validate";

// For every avatar address read from the database before it is handed on.
// A bad value (the owner of a profile can write the column directly) becomes
// null, so the avatar falls back to the initial letter instead of making
// next/image throw.
export function safeAvatarUrl(url: string | null | undefined): string | null {
  return url &&
    isAllowedAvatarUrl(url, process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)
    ? url
    : null;
}
// Pure helper (no network, no React): adds Cloudinary delivery options to the
// URL of an image we already uploaded. Keeping this out of `ui/` means the
// components only receive a ready-to-use URL.

type ImageOptions = {
  width?: number;
  height?: number;
  // "limit" shrinks only when larger; "fill" crops to the exact size.
  crop?: "limit" | "fill";
  // "face" centers the crop on a detected face (useful for avatars).
  gravity?: "face";
};

const CLOUDINARY_HOST = "res.cloudinary.com";
// Cloudinary delivery URLs look like:
//   https://res.cloudinary.com/<cloud>/image/upload/v123/<id>.png
const UPLOAD_SEGMENT = "/image/upload/";

// Returns a URL that serves the image in the best format (f_auto) and quality
// (q_auto), optionally resized. Any URL that is not a plain Cloudinary upload
// URL comes back unchanged, so this is safe to call on every image.
export function cloudinaryImageUrl(
  url: string,
  options: ImageOptions = {},
): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== CLOUDINARY_HOST) {
    return url;
  }

  const index = parsed.pathname.indexOf(UPLOAD_SEGMENT);
  if (index === -1) return url;

  const before = parsed.pathname.slice(0, index + UPLOAD_SEGMENT.length);
  const after = parsed.pathname.slice(index + UPLOAD_SEGMENT.length);

  // Only a plain upload URL (next part is the version, like v1790950305/) gets
  // options. If a transformation is already there, leave the URL alone.
  if (!/^v\d+\//.test(after)) return url;

  const parts = ["f_auto", "q_auto"];
  const crop = options.crop ?? (options.width && !options.height ? "limit" : undefined);
  if (crop) parts.push(`c_${crop}`);
  if (options.gravity) parts.push(`g_${options.gravity}`);
  if (options.width) parts.push(`w_${Math.round(options.width)}`);
  if (options.height) parts.push(`h_${Math.round(options.height)}`);

  parsed.pathname = `${before}${parts.join(",")}/${after}`;
  return parsed.toString();
}
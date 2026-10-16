import { v2 as cloudinary } from "cloudinary";
import { isOwnCloudinaryImageUrl } from "@/features/uploads/validate";
import { reportError } from "@/lib/report-error";

// Stored image URLs are the originals: an optional "v<digits>/" segment, then
// the public id plus the file extension.
export function publicIdFromUrl(url: string, cloudName: string): string | null {
  if (!isOwnCloudinaryImageUrl(url, cloudName)) return null;
  try {
    const path = new URL(url).pathname.slice(
      `/${cloudName}/image/upload/`.length,
    );
    const withoutVersion = path.replace(/^v\d+\//, "");
    const dot = withoutVersion.lastIndexOf(".");
    const id = dot > 0 ? withoutVersion.slice(0, dot) : withoutVersion;
    return id ? decodeURIComponent(id) : null;
  } catch {
    return null;
  }
}

// Configures the Cloudinary admin client. Returns the cloud name, or null when
// an environment variable is missing.
export function configureCloudinary(): string | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return cloudName;
}

// Best effort: deletes images on OUR Cloudinary account by their stored URL
// (anything else is ignored). Call it only AFTER the database change that
// stopped using them succeeded. Never throws and never shows anything to the
// person: a failure only leaves an orphan for the admin sweep, and is reported.
export async function deleteImages(
  urls: Array<string | null | undefined>,
): Promise<void> {
  try {
    const cloudName = configureCloudinary();
    if (!cloudName) {
      reportError("deleteImages env", new Error("missing Cloudinary env vars"));
      return;
    }

    const ids = new Set<string>();
    for (const url of urls) {
      if (!url) continue;
      const id = publicIdFromUrl(url, cloudName);
      if (id) ids.add(id);
    }

    const all = [...ids];
    for (let i = 0; i < all.length; i += 50) {
      await cloudinary.api.delete_resources(all.slice(i, i + 50));
    }
  } catch (error) {
    console.error("deleteImages failed:", error);
    reportError("deleteImages", error);
  }
}
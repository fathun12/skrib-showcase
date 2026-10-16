import { signUpload } from "./actions";
import { compressImage } from "./compress";

// 5 MB, checked on the file AFTER it was shrunk in the browser. The file goes
// straight to Cloudinary, so our server never sees it.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// What the browser is willing to read and shrink.
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type UploadKind = "post" | "cover" | "avatar" | "note";

export type UploadImageResult =
  | { ok: true; url: string; width: number; height: number }
  | { ok: false; error: string };

type CloudinaryResponse = {
  secure_url?: string;
  width?: number;
  height?: number;
  error?: { message?: string };
};

// Uploads one image straight to Cloudinary and returns its public URL.
// Never throws: every failure comes back as { ok: false, error }.
export async function uploadImage(
  original: File,
  kind: UploadKind,
): Promise<UploadImageResult> {
  if (!ALLOWED_TYPES.includes(original.type)) {
    return { ok: false, error: "Only JPG, PNG, or WebP images are allowed." };
  }
  if (original.size > MAX_INPUT_BYTES) {
    return { ok: false, error: "The image must be 20 MB or smaller." };
  }

  // Smaller file = less of the Cloudinary storage quota.
  const file = await compressImage(original, kind);
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "The image must be 5 MB or smaller." };
  }

  const signed = await signUpload({ kind });
  if (!signed.ok) {
    return { ok: false, error: signed.error };
  }

  // These fields must match what the server signed, exactly.
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("allowed_formats", signed.allowedFormats);
  form.append("tags", signed.tags);
  form.append("transformation", signed.transformation);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
      { method: "POST", body: form },
    );
    const data = (await response.json().catch(() => null)) as
      | CloudinaryResponse
      | null;

    if (!response.ok || !data?.secure_url) {
      console.error("uploadImage: Cloudinary rejected the upload", {
        status: response.status,
        message: data?.error?.message,
      });
      return {
        ok: false,
        error: "The image could not be uploaded. Check the file and try again.",
      };
    }

    return {
      ok: true,
      url: data.secure_url,
      width: data.width ?? 0,
      height: data.height ?? 0,
    };
  } catch (error) {
    console.error("uploadImage: network error", error);
    return {
      ok: false,
      error: "Network error while uploading. Please try again.",
    };
  }
}
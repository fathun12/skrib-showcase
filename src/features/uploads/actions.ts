"use server";

import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

// Only these kinds of images may be uploaded. Avatar and cover are used in
// later steps; they are accepted now so the action does not change again.
const signUploadSchema = z.object({
  kind: z.enum(["post", "cover", "avatar", "note"]),
});

// Cloudinary format names (jpg covers JPEG files). GIF is left out on purpose
// (optional in the spec).
const ALLOWED_FORMATS = "jpg,png,webp";

// Cloudinary applies this to the file BEFORE storing it, so the stored
// original (what counts against the storage quota) cannot be huge even if
// someone skips the shrinking in the browser. c_limit only ever shrinks.
const INCOMING_TRANSFORMATION = {
  post: "c_limit,w_1920,h_1920",
  cover: "c_limit,w_1920,h_1920",
  avatar: "c_limit,w_512,h_512",
  note: "c_limit,w_1600,h_1600",
} as const;

export type SignUploadResult =
  | {
      ok: true;
      cloudName: string;
      // The API key is not secret: Cloudinary expects it in the browser request.
      apiKey: string;
      timestamp: number;
      signature: string;
      // The browser must send these two values exactly as returned, because
      // they are part of the signature.
      allowedFormats: string;
      tags: string;
      transformation: string;
    }
  | { ok: false; error: string };

// Gives the signed-in user a one-hour permission to upload ONE kind of image
// straight to Cloudinary. The API secret never leaves the server.
// Takes `unknown` on purpose: the input comes from the browser.
export async function signUpload(input: unknown): Promise<SignUploadResult> {
  await requireUser("/write");

  // Cloudinary is not behind RLS, so the check lives here.
  if (await isSuspended()) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const parsed = signUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This kind of image is not supported." };
  }

  const supabase = await createClient();
  // Note images have their own limit (rule note_image_upload, migration 0078).
  const limit = await checkRateLimit(
    supabase,
    parsed.data.kind === "note" ? "note_image_upload" : "upload",
  );
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    // Logs only whether each value exists, never the values themselves.
    console.error("signUpload: missing Cloudinary env vars", {
      cloudName: Boolean(cloudName),
      apiKey: Boolean(apiKey),
      apiSecret: Boolean(apiSecret),
    });
    // A fixed message on purpose: nothing from the environment is sent.
    reportError("signUpload env", new Error("missing Cloudinary env vars"));
    return {
      ok: false,
      error: "Image upload is not available right now. Please try again later.",
    };
  }

  const timestamp = Math.round(Date.now() / 1000);
  const tags = parsed.data.kind;
  const transformation = INCOMING_TRANSFORMATION[parsed.data.kind];

  try {
    // Every parameter the browser sends (except file, cloud_name,
    // resource_type and api_key) must be in this object.
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, allowed_formats: ALLOWED_FORMATS, tags, transformation },
      apiSecret,
    );

    return {
      ok: true,
      cloudName,
      apiKey,
      timestamp,
      signature,
      allowedFormats: ALLOWED_FORMATS,
      tags,
      transformation,
    };
  } catch (error) {
    console.error("signUpload failed:", error);
    reportError("signUpload", error);
    return {
      ok: false,
      error: "Could not prepare the upload. Please try again.",
    };
  }
}
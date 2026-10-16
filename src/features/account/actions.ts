"use server";

import { v2 as cloudinary } from "cloudinary";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { publicIdFromUrl } from "@/features/uploads/server";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const deleteAccountSchema = z.object({
  confirmation: z.string().max(100),
});

// Only the failure case is ever returned: on success the action redirects.
export type DeleteAccountResult = { ok: false; error: string };

const GENERIC_ERROR = "Could not delete your account. Please try again.";

// Best effort: the account is already gone, so a failure here only leaves
// orphaned images. It is reported and never shown to the person.
async function deleteCloudinaryImages(urls: string[]) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    reportError(
      "deleteAccount images env",
      new Error("missing Cloudinary env vars"),
    );
    return;
  }

  const ids = new Set<string>();
  for (const url of urls) {
    const id = publicIdFromUrl(url, cloudName);
    if (id) ids.add(id);
  }
  if (ids.size === 0) return;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const all = [...ids];
  for (let i = 0; i < all.length; i += 50) {
    try {
      await cloudinary.api.delete_resources(all.slice(i, i + 50));
    } catch (error) {
      console.error("deleteAccount images failed:", error);
      reportError("deleteAccount images", error);
    }
  }
}

// Permanently deletes the signed-in account. Takes `unknown` on purpose: the
// input comes from the browser.
export async function deleteAccount(
  input: unknown,
): Promise<DeleteAccountResult> {
  const user = await requireUser("/settings");

  const parsed = deleteAccountSchema.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.confirmation.trim().toLowerCase() !==
      user.profile.username.toLowerCase()
  ) {
    return { ok: false, error: "Type your username exactly to confirm." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "delete_account");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // 1. Collect the image URLs while the account still exists (kept in memory).
  const { data: urlRows, error: urlError } =
    await supabase.rpc("list_my_image_urls");
  if (urlError) {
    console.error("deleteAccount urls failed:", urlError);
    reportError("deleteAccount urls", urlError);
    return { ok: false, error: GENERIC_ERROR };
  }
  const urls = (urlRows ?? []).map((row) => row.url);

  // 2. Delete the account. The function refuses admins and posts with co-authors.
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    if (error.message.includes("account_is_admin")) {
      return {
        ok: false,
        error:
          "An administrator account cannot be deleted here. Ask the site owner to remove the admin role first.",
      };
    }
    if (error.message.includes("account_has_coauthors")) {
      return {
        ok: false,
        error:
          "One of your posts has co-authors. Remove the co-authors from those posts first, then try again.",
      };
    }
    console.error("deleteAccount failed:", error);
    reportError("deleteAccount", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  // 3. The account is gone: clean up the images, then leave.
  await deleteCloudinaryImages(urls);

  try {
    await supabase.auth.signOut();
  } catch {
    // The user no longer exists, so the next request is signed out anyway.
  }

  revalidatePath("/", "layout");
  redirect("/account-deleted");
}
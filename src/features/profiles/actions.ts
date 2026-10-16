"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { ownCloudinaryImageUrl } from "@/features/uploads/schemas";
import { deleteImages } from "@/features/uploads/server";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { BIO_MAX, DISPLAY_NAME_MAX } from "./limits";

// The submitted values are sent back so the form can refill its fields
// (React resets uncontrolled fields after an action finishes).
export type ProfileFormState = {
  error: string | null;
  saved: boolean;
  displayName?: string;
  bio?: string;
};

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(DISPLAY_NAME_MAX, `Name is too long (max ${DISPLAY_NAME_MAX} characters).`),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `Bio is too long (max ${BIO_MAX} characters).`),
});

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser("/settings");

  const displayName = String(formData.get("displayName") ?? "");
  const bio = String(formData.get("bio") ?? "");

  const parsed = profileSchema.safeParse({ displayName, bio });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0].message,
      saved: false,
      displayName,
      bio,
    };
  }

  // The avatar field is only present when the user changed it here:
  // missing = leave the stored avatar alone, empty = remove it, otherwise it
  // must be an image on our own Cloudinary account.
  const avatarField = formData.get("avatarUrl");
  let avatarUrl: string | null | undefined;
  if (typeof avatarField === "string") {
    if (avatarField === "") {
      avatarUrl = null;
    } else {
      const checked = ownCloudinaryImageUrl.safeParse(avatarField);
      if (!checked.success) {
        return {
          error: "The profile picture is not valid. Remove it and try again.",
          saved: false,
          displayName,
          bio,
        };
      }
      avatarUrl = checked.data;
    }
  }

  // Only display_name, bio and (when changed) avatar_url are touched: the
  // username is not editable here. RLS also limits updates to the user's own row.
  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "profile_update");
  if (!limit.ok) {
    return { error: limit.error, saved: false, displayName, bio };
  }

  // The picture that is about to be replaced or removed (deleted after saving).
  let oldAvatar: string | null = null;
  if (avatarUrl !== undefined) {
    const { data: current } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    oldAvatar = current?.avatar_url ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio === "" ? null : parsed.data.bio,
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfile failed:", error);
    reportError("updateProfile", error);
    return {
      error: "Could not save your profile. Please try again.",
      saved: false,
      displayName,
      bio,
    };
  }

  // Saved: the old picture is no longer used, so it frees storage.
  if (oldAvatar && oldAvatar !== avatarUrl) {
    await deleteImages([oldAvatar]);
  }

  revalidatePath(`/${user.profile.username}`);
  return {
    error: null,
    saved: true,
    displayName: parsed.data.displayName,
    bio: parsed.data.bio,
  };
}
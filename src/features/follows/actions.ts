"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const setFollowSchema = z.object({
  profileId: z.uuid(),
  follow: z.boolean(),
});

export type SetFollowResult = { ok: true } | { ok: false; error: string };

// Sets the wanted state ("follow" or "not follow") instead of toggling, so a
// double click or a second tab can never flip it by accident.
// Takes `unknown` on purpose: the input comes from the browser.
export async function setFollow(input: unknown): Promise<SetFollowResult> {
  const user = await requireUser("/");

  const parsed = setFollowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This profile could not be found." };
  }
  const { profileId, follow } = parsed.data;
  if (follow && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  if (profileId === user.id) {
    return { ok: false, error: "You can't follow yourself." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "follow");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // The username is needed to refresh the profile page afterwards.
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", profileId)
    .maybeSingle();

  if (targetError) {
    console.error("setFollow (profile) failed:", targetError);
    reportError("setFollow profile", targetError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!target || !target.username) {
    return { ok: false, error: "This profile could not be found." };
  }

  if (follow) {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: profileId });
    // 23505 = already following (double click, other tab): the wanted state
    // is reached, so it counts as done.
    if (error && error.code !== "23505") {
      console.error("setFollow (insert) failed:", error);
      reportError("setFollow insert", error);
      return { ok: false, error: "Could not follow. Please try again." };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", profileId);
    if (error) {
      console.error("setFollow (delete) failed:", error);
      reportError("setFollow delete", error);
      return { ok: false, error: "Could not unfollow. Please try again." };
    }
  }

  // Refreshes the follower count and the button on the profile page.
  revalidatePath(`/${target.username}`);
  return { ok: true };
}
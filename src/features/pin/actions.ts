"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

// postId null means "unpin".
const pinSchema = z.object({ postId: z.uuid().nullable() });

export type PinResult =
  | { ok: true; pinned: boolean }
  | { ok: false; error: string };

// The id of the story pinned on my profile, or null.
export async function getMyPinnedPost(): Promise<string | null> {
  const user = await requireUser("/me/posts");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("pinned_post_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getMyPinnedPost failed:", error);
    return null;
  }
  return data?.pinned_post_id ?? null;
}

// Pins one of my published stories to my profile (one at a time), or removes
// the pin. The database function checks ownership, the published status and
// the suspension.
export async function setPinnedPost(input: unknown): Promise<PinResult> {
  await requireUser("/me/posts");

  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This story could not be found." };
  }

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) return { ok: false, error: limit.error };

  // The function accepts null (unpin); the generated type does not show that.
  const { data, error } = await supabase.rpc("set_pinned_post", {
    p_post: parsed.data.postId as string,
  });

  if (error) {
    if (error.message.includes("account_suspended")) {
      return { ok: false, error: SUSPENDED_MESSAGE };
    }
    console.error("setPinnedPost failed:", error);
    reportError("setPinnedPost", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  if (data === "pinned") return { ok: true, pinned: true };
  if (data === "unpinned") return { ok: true, pinned: false };
  return { ok: false, error: "Only your own published stories can be pinned." };
}
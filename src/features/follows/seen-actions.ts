"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

// Remembers that the user has now opened the Following tab, so the dot on
// the tab goes away. The bell is not touched.
export async function markFollowingSeen(): Promise<{ ok: boolean }> {
  const user = await requireUser("/");
  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "following_seen");
  if (!limit.ok) return { ok: false };

  const now = new Date().toISOString();

  // Update first; if there is no row yet (first visit), insert one.
  const { data, error } = await supabase
    .from("following_state")
    .update({ seen_at: now })
    .eq("user_id", user.id)
    .select("user_id");
  if (error) {
    console.error("markFollowingSeen (update) failed:", error);
    reportError("markFollowingSeen update", error);
    return { ok: false };
  }

  if (data.length === 0) {
    const { error: insertError } = await supabase
      .from("following_state")
      .insert({ seen_at: now });
    // 23505 = another tab inserted it first: also fine.
    if (insertError && insertError.code !== "23505") {
      console.error("markFollowingSeen (insert) failed:", insertError);
      reportError("markFollowingSeen insert", insertError);
      return { ok: false };
    }
  }

  revalidatePath("/");
  return { ok: true };
}
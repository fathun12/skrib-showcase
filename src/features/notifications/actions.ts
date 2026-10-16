"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

// Remembers that the user has now seen everything. The bell in the header
// (in the root layout) is refreshed by revalidatePath.
export async function markNotificationsSeen(): Promise<{ ok: boolean }> {
  const user = await requireUser("/me/notifications");
  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "notifications_seen");
  if (!limit.ok) return { ok: false };

  const now = new Date().toISOString();

  // Update first; if there is no row yet (first visit), insert one.
  const { data, error } = await supabase
    .from("notification_state")
    .update({ seen_at: now })
    .eq("user_id", user.id)
    .select("user_id");
  if (error) {
    console.error("markNotificationsSeen (update) failed:", error);
    reportError("markNotificationsSeen update", error);
    return { ok: false };
  }

  if (data.length === 0) {
    const { error: insertError } = await supabase
      .from("notification_state")
      .insert({ seen_at: now });
    // 23505 = another tab inserted it first: also fine.
    if (insertError && insertError.code !== "23505") {
      console.error("markNotificationsSeen (insert) failed:", insertError);
      reportError("markNotificationsSeen insert", insertError);
      return { ok: false };
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
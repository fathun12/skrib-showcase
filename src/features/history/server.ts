import { reportError } from "@/lib/report-error";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type VersionReason = "auto" | "publish" | "update" | "restore";

// Asks the database to keep a version of the post as it is stored now. The
// database decides whether to write one (at most one automatic version every
// 10 minutes, never an identical copy). Best effort: a failure never blocks
// saving or publishing. Returns true when the call itself worked.
export async function recordVersion(
  supabase: ServerClient,
  postId: string,
  reason: VersionReason,
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("save_post_version", {
      p_post_id: postId,
      p_reason: reason,
    });
    if (!error) return true;
    // Expected: someone without the pen on a shared post. Not reported.
    if (error.message.includes("history_not_allowed")) return false;
    console.error("recordVersion failed:", error);
    reportError("recordVersion", error);
    return false;
  } catch (error) {
    console.error("recordVersion threw:", error);
    reportError("recordVersion", error);
    return false;
  }
}
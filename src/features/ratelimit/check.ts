import { reportError } from "@/lib/report-error";
import type { createClient } from "@/lib/supabase/server";

// Must match the rows of private.rate_limit_rules (migration 0007). A typo
// here is caught by tsc; a missing row would make the database function raise.
export type RateLimitAction =
  | "save_post"
  | "upload"
  | "follow"
  | "like"
  | "post_admin"
  | "profile_update"
  | "onboarding"
  | "report"
  | "collab_invite"
  | "collab_respond"
  | "collab_turn"
  | "bookmark"
  | "notifications_seen"
  | "comment"
  | "comment_delete"
  | "following_seen"
  | "repost"
  | "credit_invite"
  | "credit_respond"
  | "reading_progress"
  | "post_history"
  | "notifications_count"
  | "tag_suggest"
  | "tag_follow"
  | "delete_account"
  | "sweep_images"
  | "create_series"
  | "edit_series"
  | "highlight"
  | "note_create"
  | "note_delete"
  | "note_like"
  | "note_report"
  | "note_manage"
  | "note_mention_suggest"
  | "note_repost"
  | "note_edit"
  | "note_image_upload"
  | "post_handover"
  | "foryou_hide"
  | "list_manage";

export type RateLimitResult = { ok: true } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Counts this call for the signed-in user and says whether it may go on.
// Pass the same client the action already uses, so auth.uid() inside the
// database function reads the user's own session.
// Fails open: if the check itself breaks, the action goes through and the
// problem is logged. Rate limiting must never take the whole app down.
export async function checkRateLimit(
  supabase: ServerClient,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_action: action,
    });

    if (error || !data || data.length === 0) {
      console.error("checkRateLimit failed:", action, error);
      // The action still goes through (fail open), but now somebody notices.
      reportError(
        `checkRateLimit ${action}`,
        error ?? new Error("empty result from check_rate_limit"),
      );
      return { ok: true };
    }

    const row = data[0];
    if (row.allowed) return { ok: true };

    const seconds = row.retry_after_seconds;
    return {
      ok: false,
      error: `You're doing that too fast. Try again in ${seconds} ${
        seconds === 1 ? "second" : "seconds"
      }.`,
    };
  } catch (e) {
    console.error("checkRateLimit threw:", action, e);
    reportError(`checkRateLimit ${action}`, e);
    return { ok: true };
  }
}
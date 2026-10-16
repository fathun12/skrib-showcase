"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";

const reportSchema = z.object({
  postId: z.uuid(),
  reason: z.enum(REPORT_REASON_VALUES),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
});

export type ReportPostResult = { ok: true } | { ok: false; error: string };

// Reports one published post. Takes `unknown` on purpose: the input comes
// from the browser.
export async function reportPost(input: unknown): Promise<ReportPostResult> {
  const user = await requireUser("/");

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please choose a reason." };
  }
  const { postId, reason } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  // A blank note is stored as NULL, never as '' (the database rejects '').
  const details = parsed.data.details ? parsed.data.details : null;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "report");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // Only a published post can be reported (RLS checks this again on insert).
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();

  if (postError) {
    console.error("reportPost (post) failed:", postError);
    reportError("reportPost post", postError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!post) {
    return { ok: false, error: "This post could not be found." };
  }
  if (post.author_id === user.id) {
    return { ok: false, error: "You can't report your own post." };
  }

  // No .select() here on purpose: nobody may read reports through the API,
  // and a returning insert would need the SELECT right.
  const { error } = await supabase
    .from("reports")
    .insert({ post_id: postId, reason, details });

  // 23505 = already reported by this user (double click, other tab): the
  // wanted state is reached, so it counts as done.
  if (error && error.code !== "23505") {
    console.error("reportPost (insert) failed:", error);
    reportError("reportPost insert", error);
    return { ok: false, error: "Could not send the report. Please try again." };
  }

  return { ok: true };
}
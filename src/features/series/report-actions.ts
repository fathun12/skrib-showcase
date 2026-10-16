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
  seriesId: z.uuid(),
  reason: z.enum(REPORT_REASON_VALUES),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
});

export type ReportSeriesResult = { ok: true } | { ok: false; error: string };

// Reports one series. Takes `unknown` on purpose: the input comes from the
// browser. The database policy checks again on insert: a series of someone
// else with at least one published story.
export async function reportSeries(
  input: unknown,
): Promise<ReportSeriesResult> {
  const user = await requireUser("/");

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please choose a reason." };
  }
  const { seriesId, reason } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  // A blank note is stored as NULL, never as '' (the database rejects '').
  const details = parsed.data.details ? parsed.data.details : null;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "report");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { data: series, error: seriesError } = await supabase
    .from("series")
    .select("author_id")
    .eq("id", seriesId)
    .maybeSingle();
  if (seriesError) {
    console.error("reportSeries (series) failed:", seriesError);
    reportError("reportSeries series", seriesError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!series) {
    return { ok: false, error: "This series could not be found." };
  }
  if (series.author_id === user.id) {
    return { ok: false, error: "You can't report your own series." };
  }

  // No .select() here on purpose: nobody may read reports through the API.
  const { error } = await supabase
    .from("series_reports")
    .insert({ series_id: seriesId, reason, details });

  // 23505 = already reported by this user: the wanted state is reached.
  if (error && error.code === "23505") return { ok: true };
  // 42501 = the policy refused: the series has no published story (anymore).
  if (error && error.code === "42501") {
    return { ok: false, error: "This series could not be found." };
  }
  if (error) {
    console.error("reportSeries (insert) failed:", error);
    reportError("reportSeries insert", error);
    return { ok: false, error: "Could not send the report. Please try again." };
  }

  return { ok: true };
}
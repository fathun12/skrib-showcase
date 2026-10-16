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

const reportNoteSchema = z.object({
  noteId: z.uuid(),
  reason: z.enum(REPORT_REASON_VALUES),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
});

export type ReportNoteResult = { ok: true } | { ok: false; error: string };

// Reports one note. Takes `unknown` on purpose: the input comes from the
// browser. The database function report_note checks again and writes the
// evidence snapshot itself; nobody can read or change reports through the API.
export async function reportNote(input: unknown): Promise<ReportNoteResult> {
  await requireUser("/");

  const parsed = reportNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please choose a reason." };
  }
  const { noteId, reason } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  // A blank detail is sent as nothing, never as an empty string.
  const details = parsed.data.details || undefined;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_report");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // The result is null when this user already reported the note: the wanted
  // state is reached, so it counts as done.
  const { error } = await supabase.rpc("report_note", {
    p_note_id: noteId,
    p_reason: reason,
    p_details: details,
  });

  if (error) {
    if (error.code === "42501") {
      return { ok: false, error: SUSPENDED_MESSAGE };
    }
    if (error.message.includes("own_note")) {
      return { ok: false, error: "You can't report your own note." };
    }
    if (error.message.includes("note_not_found")) {
      return { ok: false, error: "This note could not be found." };
    }
    if (error.message.includes("invalid_reason")) {
      return { ok: false, error: "Please choose a reason." };
    }
    if (error.message.includes("invalid_details")) {
      return { ok: false, error: "The details are too long." };
    }
    console.error("reportNote failed:", error);
    reportError("reportNote", error);
    return { ok: false, error: "Could not send the report. Please try again." };
  }

  return { ok: true };
}
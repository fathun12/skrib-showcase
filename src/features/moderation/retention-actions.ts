"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin } from "@/features/moderation/queries";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

export type RetentionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_ALLOWED = "You are not allowed to do this.";
const TEXT_MAX = 500;

const legalHoldSchema = z.object({
  noteId: z.uuid(),
  hold: z.boolean(),
  // A note is required: it goes into the moderation log.
  note: z.string().trim().min(1).max(TEXT_MAX),
});

// Puts or releases the legal hold on every report of one note.
// Takes `unknown` on purpose: the input comes from the browser.
export async function setNoteLegalHold(
  input: unknown,
): Promise<RetentionResult> {
  const parsed = legalHoldSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write a short note first (up to 500 characters)." };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: NOT_ALLOWED };
  }

  const { noteId, hold, note } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_note_legal_hold", {
    p_note_id: noteId,
    p_hold: hold,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("note_required")) {
      return { ok: false, error: "Write a short note first." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    if (error.message.includes("no_reports")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "There are no reports for this note." };
    }
    console.error("setNoteLegalHold failed:", error);
    reportError("setNoteLegalHold", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/admin/moderation", "layout");
  return { ok: true };
}

export type PurgePreview = {
  // Decided, past their date, no hold: the next purge deletes these.
  purgeable: number;
  // Reports on legal hold (any status).
  onHold: number;
  // Decided, not on hold, date still in the future.
  waiting: number;
};

const previewSchema = z
  .array(
    z.object({
      purgeable: z.number(),
      on_hold: z.number(),
      waiting: z.number(),
    }),
  )
  .min(1);

export async function previewNoteReportPurge(): Promise<
  { ok: true; preview: PurgePreview } | { ok: false; error: string }
> {
  if (!(await isAdmin())) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_preview_note_report_purge");
  if (error) {
    console.error("previewNoteReportPurge failed:", error);
    reportError("previewNoteReportPurge", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  const parsed = previewSchema.safeParse(data);
  if (!parsed.success) {
    console.error("previewNoteReportPurge bad shape:", parsed.error);
    return { ok: false, error: GENERIC_ERROR };
  }
  const row = parsed.data[0];
  return {
    ok: true,
    preview: {
      purgeable: row.purgeable,
      onHold: row.on_hold,
      waiting: row.waiting,
    },
  };
}

export async function purgeNoteReports(): Promise<
  { ok: true; deleted: number } | { ok: false; error: string }
> {
  if (!(await isAdmin())) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_purge_note_reports");
  if (error) {
    console.error("purgeNoteReports failed:", error);
    reportError("purgeNoteReports", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  const parsed = z.number().safeParse(data);
  if (!parsed.success) {
    console.error("purgeNoteReports bad shape:", parsed.error);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/admin/moderation", "layout");
  return { ok: true, deleted: parsed.data };
}

const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((value) => value || undefined);

const disclosureSchema = z.object({
  receivedOn: z.iso.date(),
  requester: z.string().trim().min(1).max(200),
  reference: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  kind: z.enum(["subscriber_info", "traffic_data", "content", "other"]),
  summary: z.string().trim().min(1).max(1000),
  noteId: optionalUuid,
  userId: optionalUuid,
});

// Adds one row to the disclosure log. The log is append only: there is no
// action to edit or delete a row.
export async function addDisclosure(input: unknown): Promise<RetentionResult> {
  const parsed = disclosureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Check the form: date, who asked, the kind and a summary are required.",
    };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: NOT_ALLOWED };
  }

  const { receivedOn, requester, reference, kind, summary, noteId, userId } =
    parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_disclosure", {
    p_received_on: receivedOn,
    p_requester: requester,
    p_kind: kind,
    p_summary: summary,
    p_reference: reference,
    p_note_id: noteId,
    p_user_id: userId,
  });

  if (error) {
    if (error.message.includes("invalid_date")) {
      return { ok: false, error: "The date cannot be in the future." };
    }
    console.error("addDisclosure failed:", error);
    reportError("addDisclosure", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/admin/moderation", "layout");
  return { ok: true };
}
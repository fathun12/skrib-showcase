import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const parentSchema = z
  .object({
    author_username: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
  })
  .nullable();

const rowSchema = z.object({
  note_id: z.uuid(),
  note_status: z.string(),
  author_id: z.uuid().nullable(),
  author_username: z.string().nullable(),
  author_display_name: z.string().nullable(),
  note_text: z.string().nullable(),
  written_at: z.string().nullable(),
  parent: parentSchema,
  // The quoted note saved in the report copy (null or missing: none).
  note_quote: parentSchema.optional(),
  // The images saved in the report copy (null or missing: none, or a copy
  // saved before migration 0078).
  note_images: z
    .array(
      z.object({
        url: z.string(),
        alt: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  // The shared story and the passage quoted from it, as saved when the note
  // was reported (null or missing: none, or a copy saved before migration 0080).
  note_story: z
    .object({
      title: z.string().nullable().optional(),
      author_username: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  note_story_quote: z.string().nullable().optional(),
  report_count: z.number(),
  reasons: z.array(z.string()),
  latest_report_at: z.string(),
  legal_hold: z.boolean(),
  retain_until: z.string().nullable(),
  reports: z.array(
    z.object({
      reason: z.string(),
      details: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});

export type NoteReportGroup = {
  noteId: string;
  // published, hidden, hidden_by_author, or deleted (the writer removed it).
  status: string;
  // The text and the writer come from the copy saved at report time.
  text: string;
  authorName: string;
  authorUsername: string | null;
  writtenAt: string | null;
  parent: { authorUsername: string | null; text: string } | null;
  // The images of the note, as saved when it was reported (empty: none).
  images: { url: string; alt: string }[];
  // The note this note quotes, as saved when it was reported.
  quote: { authorUsername: string | null; text: string } | null;
  // The story the note shares, as saved when it was reported.
  story: { title: string; authorUsername: string | null } | null;
  storyQuote: string | null;
  reportCount: number;
  reasons: string[];
  latestReportAt: string;
  // Legal hold on any report of this note; retain_until is the latest date.
  legalHold: boolean;
  retainUntil: string | null;
  reports: { reason: string; details: string | null; createdAt: string }[];
};

export type NoteReportView = "open" | "resolved" | "dismissed";

// Reports on notes with the given status, grouped by note. Returns null on a failed load.
export async function listNoteReportGroups(
  view: NoteReportView = "open",
): Promise<NoteReportGroup[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_note_reports", {
    p_status: view,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) {
    console.error("listNoteReportGroups failed:", error);
    return null;
  }

  const parsed = z.array(rowSchema).safeParse(data);
  if (!parsed.success) {
    console.error("listNoteReportGroups bad shape:", parsed.error);
    return null;
  }

  return parsed.data.map((row) => ({
    noteId: row.note_id,
    status: row.note_status,
    text: row.note_text ?? "",
    authorName:
      row.author_display_name ?? row.author_username ?? "Unknown account",
    authorUsername: row.author_username,
    writtenAt: row.written_at,
    parent: row.parent
      ? {
          authorUsername: row.parent.author_username ?? null,
          text: row.parent.text ?? "",
        }
      : null,
    quote: row.note_quote
      ? {
          authorUsername: row.note_quote.author_username ?? null,
          text: row.note_quote.text ?? "",
        }
      : null,
    images: (row.note_images ?? []).map((image) => ({
      url: image.url,
      alt: image.alt ?? "",
    })),
    story:
      row.note_story && row.note_story.title
        ? {
            title: row.note_story.title,
            authorUsername: row.note_story.author_username ?? null,
          }
        : null,
    storyQuote: row.note_story_quote ?? null,
    reportCount: row.report_count,
    reasons: row.reasons,
    latestReportAt: row.latest_report_at,
    legalHold: row.legal_hold,
    retainUntil: row.retain_until,
    reports: row.reports.map((r) => ({
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
    })),
  }));
}
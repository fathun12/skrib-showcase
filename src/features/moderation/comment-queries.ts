import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  comment_id: z.uuid(),
  comment_snippet: z.string(),
  comment_quote: z.string().nullable(),
  comment_author_id: z.uuid(),
  author_username: z.string().nullable(),
  author_display_name: z.string(),
  post_id: z.uuid(),
  post_title: z.string(),
  post_slug: z.string(),
  post_owner_username: z.string().nullable(),
  report_count: z.number(),
  reasons: z.array(z.string()),
  latest_report_at: z.string(),
  reports: z.array(
    z.object({
      reason: z.string(),
      details: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});

export type CommentReportGroup = {
  commentId: string;
  snippet: string;
  // Respond: the passage the comment quotes (plain text), or null.
  quote: string | null;
  authorName: string;
  authorUsername: string | null;
  postTitle: string;
  // Public address of the post; null when the owner has no username.
  postHref: string | null;
  reportCount: number;
  reasons: string[];
  latestReportAt: string;
  reports: { reason: string; details: string | null; createdAt: string }[];
};

// Open reports on comments, grouped by comment. Returns null on a failed load.
export async function listCommentReportGroups(): Promise<
  CommentReportGroup[] | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_comment_reports", {
    p_status: "open",
    p_limit: 50,
    p_offset: 0,
  });
  if (error) {
    console.error("listCommentReportGroups failed:", error);
    return null;
  }

  const parsed = z.array(rowSchema).safeParse(data);
  if (!parsed.success) {
    console.error("listCommentReportGroups bad shape:", parsed.error);
    return null;
  }

  return parsed.data.map((row) => ({
    commentId: row.comment_id,
    snippet: row.comment_snippet,
    quote: row.comment_quote,
    authorName: row.author_display_name,
    authorUsername: row.author_username,
    postTitle: row.post_title,
    postHref: row.post_owner_username
      ? `/${row.post_owner_username}/${row.post_slug}`
      : null,
    reportCount: row.report_count,
    reasons: row.reasons,
    latestReportAt: row.latest_report_at,
    reports: row.reports.map((r) => ({
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
    })),
  }));
}
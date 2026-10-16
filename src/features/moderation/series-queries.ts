import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  series_id: z.uuid(),
  series_title: z.string(),
  series_description: z.string().nullable(),
  series_slug: z.string(),
  author_id: z.uuid(),
  author_username: z.string().nullable(),
  author_display_name: z.string(),
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

export type SeriesReportGroup = {
  seriesId: string;
  title: string;
  description: string | null;
  authorName: string;
  authorUsername: string | null;
  // Public address of the series; null when the author has no username.
  seriesHref: string | null;
  reportCount: number;
  reasons: string[];
  latestReportAt: string;
  reports: { reason: string; details: string | null; createdAt: string }[];
};

// Open reports on series, grouped by series. Returns null on a failed load.
export async function listSeriesReportGroups(): Promise<
  SeriesReportGroup[] | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_series_reports", {
    p_status: "open",
    p_limit: 50,
    p_offset: 0,
  });
  if (error) {
    console.error("listSeriesReportGroups failed:", error);
    return null;
  }

  const parsed = z.array(rowSchema).safeParse(data);
  if (!parsed.success) {
    console.error("listSeriesReportGroups bad shape:", parsed.error);
    return null;
  }

  return parsed.data.map((row) => ({
    seriesId: row.series_id,
    title: row.series_title,
    description: row.series_description,
    authorName: row.author_display_name,
    authorUsername: row.author_username,
    seriesHref: row.author_username
      ? `/${row.author_username}/series/${row.series_slug}`
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
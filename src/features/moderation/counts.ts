import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  posts: z.number(),
  comments: z.number(),
  series: z.number(),
});

export type OpenReportCounts = {
  posts: number;
  comments: number;
  series: number;
  notes: number;
  total: number;
};

// Open reports that wait for an admin decision, counted per item (the same
// grouping the tabs use). Admin only: the database refuses anybody else, so
// only call this after the admin check. cache() lets the layout and the
// moderation page share one query per request. null when the load fails: the
// badges then simply do not show.
export const getOpenReportCounts = cache(
  async (): Promise<OpenReportCounts | null> => {
    const supabase = await createClient();
    const [main, noteCount] = await Promise.all([
      supabase.rpc("admin_open_report_counts"),
      supabase.rpc("admin_open_note_report_count"),
    ]);
    if (main.error) {
      console.error("getOpenReportCounts failed:", main.error);
      return null;
    }

    const parsed = z.array(rowSchema).safeParse(main.data);
    const row = parsed.success ? parsed.data[0] : undefined;
    if (!row) {
      console.error("getOpenReportCounts bad shape");
      return null;
    }

    // A failed note count must not hide the other badges.
    if (noteCount.error) {
      console.error("getOpenReportCounts (notes) failed:", noteCount.error);
    }
    const notes = typeof noteCount.data === "number" ? noteCount.data : 0;

    return { ...row, notes, total: row.posts + row.comments + row.series + notes };
  },
);
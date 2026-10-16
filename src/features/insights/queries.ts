import { createClient } from "@/lib/supabase/server";
import { insightsSchema, type Insights, type InsightRange } from "./schemas";

// The numbers of the signed-in author for the last `days` days. The database
// function takes NO user id: it uses the session, so nobody can ask for the
// numbers of another author. Returns null when the request fails or the
// answer has an unexpected shape.
export async function getAuthorInsights(
  days: InsightRange,
): Promise<Insights | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_author_insights", {
    p_days: days,
  });

  if (error || data === null) {
    console.error("getAuthorInsights failed:", error);
    return null;
  }

  const parsed = insightsSchema.safeParse(data);
  if (!parsed.success) {
    console.error("getAuthorInsights: unexpected shape");
    return null;
  }
  return parsed.data;
}
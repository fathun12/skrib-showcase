import { createClient } from "@/lib/supabase/server";

// A corrected spelling of the words typed in the highlights search, built
// from the reader's OWN highlights and notes (migration 0100; RLS keeps it
// to their rows). Null when nothing is wrong, the text is too short or the
// call fails.
export async function suggestHighlightQuery(
  query: string,
): Promise<string | null> {
  if (query.trim().length < 2) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suggest_highlight_query", {
    p_query: query,
  });
  if (error) {
    console.error("suggestHighlightQuery failed:", error);
    return null;
  }
  return typeof data === "string" && data.trim() !== "" ? data : null;
}
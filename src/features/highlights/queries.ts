import { createClient } from "@/lib/supabase/server";
import { isHighlightColor, type HighlightColor } from "@/ui/editor/colors";

export type HighlightItem = {
  id: string;
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  quote: string;
  color: HighlightColor;
  // The private note of this highlight, or null.
  note: string | null;
};

// The highlights this person made in one story (private: the database only
// returns their own rows). Returns null when the request fails, so the page
// simply shows no highlights.
export async function listMyHighlights(
  postId: string,
  userId: string,
): Promise<HighlightItem[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("highlights")
    .select("id, block_index, start_offset, end_offset, quote, color, note")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) {
    console.error("listMyHighlights failed:", error);
    return null;
  }
  return data.map((row) => ({
    id: row.id,
    blockIndex: row.block_index,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    quote: row.quote,
    // A name the app does not know (a color removed later) falls back to yellow.
    color: isHighlightColor(row.color) ? row.color : "yellow",
    note: row.note,
  }));
}
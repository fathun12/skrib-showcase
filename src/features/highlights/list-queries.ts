import { createClient } from "@/lib/supabase/server";
import { isHighlightColor, type HighlightColor } from "@/ui/editor/colors";
import { HIGHLIGHT_PAGE_SIZE, type HighlightFilters } from "./schemas";

export type HighlightRowData = {
  id: string;
  postId: string;
  blockIndex: number;
  startOffset: number;
  quote: string;
  color: HighlightColor;
  note: string | null;
  createdAt: string;
};

// Removes characters that have a meaning in an `or` filter or an `ilike`.
export function cleanSearchTerm(raw: string): string {
  return raw.replace(/[%_\\,()"]/g, " ").replace(/\s+/g, " ").trim();
}

// One page of my highlights in ALL stories, newest first (RLS: own rows only).
// Returns null when the request fails.
export async function listMyHighlightRows(
  userId: string,
  filters: HighlightFilters,
): Promise<{ rows: HighlightRowData[]; hasMore: boolean } | null> {
  const supabase = await createClient();

  let query = supabase
    .from("highlights")
    .select("id, post_id, block_index, start_offset, quote, color, note, created_at")
    .eq("user_id", userId);

  if (filters.color) query = query.eq("color", filters.color);
  if (filters.notesOnly) query = query.not("note", "is", null);
  const term = cleanSearchTerm(filters.q);
  if (term) query = query.or(`quote.ilike.%${term}%,note.ilike.%${term}%`);

  // range() is inclusive: PAGE_SIZE + 1 rows tell us if there is a next page.
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(filters.offset, filters.offset + HIGHLIGHT_PAGE_SIZE);

  if (error || !data) {
    console.error("listMyHighlightRows failed:", error);
    return null;
  }

  return {
    hasMore: data.length > HIGHLIGHT_PAGE_SIZE,
    rows: data.slice(0, HIGHLIGHT_PAGE_SIZE).map((row) => ({
      id: row.id,
      postId: row.post_id,
      blockIndex: row.block_index,
      startOffset: row.start_offset,
      quote: row.quote,
      color: isHighlightColor(row.color) ? row.color : ("yellow" as const),
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}


// One highlight for the "Remember this?" card. The pick depends on the day
// number (UTC), so it is the same all day and moves on tomorrow; days walk
// through the whole list before a quote comes back. Needs at least 3
// highlights, otherwise the card would be a repeat of the list below it.
export async function getRememberedHighlight(
  userId: string,
): Promise<HighlightRowData | null> {
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError || count === null || count < 3) return null;

  const day = Math.floor(Date.now() / 86_400_000);
  const index = day % count;

  const { data, error } = await supabase
    .from("highlights")
    .select("id, post_id, block_index, start_offset, quote, color, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(index, index);
  const row = data?.[0];
  if (error || !row) return null;

  return {
    id: row.id,
    postId: row.post_id,
    blockIndex: row.block_index,
    startOffset: row.start_offset,
    quote: row.quote,
    color: isHighlightColor(row.color) ? row.color : ("yellow" as const),
    note: row.note,
    createdAt: row.created_at,
  };
}
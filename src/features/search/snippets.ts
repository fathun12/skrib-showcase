import { createClient } from "@/lib/supabase/server";
import { SEARCH_QUERY_MIN } from "./queries";

// A piece of a snippet: the matched words have match = true. The database
// wraps them in U+E000 and U+E001 (private-use characters that cannot occur
// in a story), so the text is split here and rendered as plain React text.
export type SnippetPart = { text: string; match: boolean };

const OPEN = "\uE000";
const CLOSE = "\uE001";

export function splitSnippet(raw: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let match = false;
  for (const piece of raw.split(/([\uE000\uE001])/)) {
    if (piece === OPEN) match = true;
    else if (piece === CLOSE) match = false;
    else if (piece !== "") parts.push({ text: piece, match });
  }
  return parts;
}

// Snippets for the stories of one result page, with ONE database call.
// Only a snippet that really contains a matched word is returned; for the
// others (a match in the title or the topics only) the card keeps its
// excerpt. Never throws: a failure returns an empty map.
export async function searchSnippets(
  ids: string[],
  query: string,
): Promise<Map<string, SnippetPart[]>> {
  const snippets = new Map<string, SnippetPart[]>();
  if (ids.length === 0 || query.length < SEARCH_QUERY_MIN) return snippets;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_post_snippets", {
    p_post_ids: ids,
    p_query: query,
  });
  if (error || !data) {
    console.error("searchSnippets failed:", error);
    return snippets;
  }

  for (const row of data) {
    const parts = splitSnippet(row.snippet ?? "");
    if (parts.some((part) => part.match)) snippets.set(row.post_id, parts);
  }
  return snippets;
}

// A corrected spelling of the search words, or null (nothing to correct, a
// failure, or a query that is too short).
export async function suggestSearchQuery(
  query: string,
): Promise<string | null> {
  if (query.length < SEARCH_QUERY_MIN) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suggest_search_query", {
    p_query: query,
  });
  if (error) {
    console.error("suggestSearchQuery failed:", error);
    return null;
  }
  return typeof data === "string" && data.trim() !== "" ? data : null;
}
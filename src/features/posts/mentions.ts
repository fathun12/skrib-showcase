import { createClient } from "@/lib/supabase/server";
import type { TiptapNode } from "./schemas";

// A story can name many people; only this many are looked up.
const MAX_IDS = 50;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collect(node: TiptapNode, ids: Set<string>): void {
  if (ids.size >= MAX_IDS) return;
  if (node.type === "mention") {
    const id = node.attrs?.id;
    if (typeof id === "string" && UUID.test(id)) ids.add(id);
  }
  for (const child of node.content ?? []) collect(child, ids);
}

// The user ids named by the mention nodes of a story (distinct).
export function listMentionIds(doc: TiptapNode): string[] {
  const ids = new Set<string>();
  collect(doc, ids);
  return [...ids];
}

// The CURRENT username of each mentioned account, by user id, so a link
// still works after a username change. An account that no longer exists is
// not in the result. Returns undefined when the lookup fails (the reader
// then uses the name each mention was written with).
export async function getMentionNames(
  doc: TiptapNode,
): Promise<Record<string, string> | undefined> {
  const ids = listMentionIds(doc);
  if (ids.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", ids);
  if (error || !data) {
    console.error("getMentionNames failed:", error);
    return undefined;
  }

  const names: Record<string, string> = {};
  for (const row of data) {
    if (row.username) names[row.id] = row.username;
  }
  return names;
}
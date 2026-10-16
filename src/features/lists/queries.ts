import { createClient } from "@/lib/supabase/server";

export type MyLists = {
  lists: { id: string; name: string }[];
  // List id to the ids of the stories in it.
  members: Map<string, Set<string>>;
};

// The lists of this reader and what is in them, oldest list first. Saved is
// capped at 100 stories and lists at 20, so two plain queries are enough.
// Returns null when a request fails, so the page can leave the chips out.
export async function getMyLists(userId: string): Promise<MyLists | null> {
  const supabase = await createClient();
  const [lists, items] = await Promise.all([
    supabase
      .from("bookmark_lists")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("bookmark_list_items")
      .select("list_id, post_id")
      .eq("user_id", userId),
  ]);
  if (lists.error || items.error) {
    console.error("getMyLists failed:", lists.error ?? items.error);
    return null;
  }

  const members = new Map<string, Set<string>>();
  for (const row of items.data ?? []) {
    const set = members.get(row.list_id) ?? new Set<string>();
    set.add(row.post_id);
    members.set(row.list_id, set);
  }
  return { lists: lists.data ?? [], members };
}
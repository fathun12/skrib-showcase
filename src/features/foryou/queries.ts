import { createClient } from "@/lib/supabase/server";
import { tagLabel } from "@/ui/tags";

export type ForYouHide = {
  id: string;
  kind: "author" | "topic";
  label: string;
};

// What this reader hid, newest first, with readable names. null on failure.
export async function listForYouHides(
  userId: string,
): Promise<ForYouHide[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foryou_hides")
    .select("id, author_id, tag, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) {
    console.error("listForYouHides failed:", error);
    return null;
  }

  const authorIds = data.flatMap((row) => (row.author_id ? [row.author_id] : []));
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", authorIds);
    if (profilesError) {
      console.error("listForYouHides (profiles) failed:", profilesError);
      return null;
    }
    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.display_name || profile.username || "Unknown author");
    }
  }

  return data.map((row) =>
    row.author_id
      ? {
          id: row.id,
          kind: "author" as const,
          label: names.get(row.author_id) ?? "Unknown author",
        }
      : { id: row.id, kind: "topic" as const, label: tagLabel(row.tag ?? "") },
  );
}

// Topics of these posts, for the menu on the cards. Empty map on failure.
export async function getTagsByPost(
  postIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (postIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, tags")
    .in("id", postIds);
  if (error) {
    console.error("getTagsByPost failed:", error);
    return map;
  }
  for (const row of data ?? []) map.set(row.id, row.tags ?? []);
  return map;
}

// Removes the posts of hidden authors and hidden topics (used for the filler
// that tops up the For you tab). On failure the posts are returned unchanged.
export async function filterHiddenForYou<
  T extends { id: string; authors: { username: string }[] },
>(userId: string, posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const supabase = await createClient();
  const { data: hides, error } = await supabase
    .from("foryou_hides")
    .select("author_id, tag")
    .eq("user_id", userId);
  if (error) {
    console.error("filterHiddenForYou failed:", error);
    return posts;
  }
  if (!hides || hides.length === 0) return posts;

  const hiddenTags = new Set(hides.flatMap((h) => (h.tag ? [h.tag] : [])));
  const authorIds = hides.flatMap((h) => (h.author_id ? [h.author_id] : []));
  const hiddenNames = new Set<string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("username")
      .in("id", authorIds);
    for (const profile of profiles ?? []) {
      if (profile.username) hiddenNames.add(profile.username);
    }
  }
  const tags =
    hiddenTags.size > 0
      ? await getTagsByPost(posts.map((post) => post.id))
      : new Map<string, string[]>();

  return posts.filter((post) => {
    const owner = post.authors[0];
    if (owner && hiddenNames.has(owner.username)) return false;
    return !(tags.get(post.id) ?? []).some((tag) => hiddenTags.has(tag));
  });
}
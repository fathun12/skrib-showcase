import { createClient } from "@/lib/supabase/server";

const REPOST_LIST_LIMIT = 100;

export type RepostInfo = {
  count: number;
  reposted: boolean;
  // The viewer's own caption (null: no caption, or not reposted).
  caption: string | null;
};

// Repost count of one post, plus whether the viewer reposted it and with
// which caption (always false / null for a signed-out visitor).
export async function getRepostInfo(
  postId: string,
  viewerId: string | null,
): Promise<RepostInfo> {
  const supabase = await createClient();

  const [countResult, mineResult] = await Promise.all([
    supabase
      .from("reposts")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId),
    viewerId
      ? supabase
          .from("reposts")
          .select("caption")
          .eq("post_id", postId)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (countResult.error || mineResult.error) {
    console.error(
      "getRepostInfo failed:",
      countResult.error ?? mineResult.error,
    );
    return { count: 0, reposted: false, caption: null };
  }

  return {
    count: countResult.count ?? 0,
    reposted: mineResult.data !== null,
    caption: mineResult.data?.caption ?? null,
  };
}

// Repost counts for several posts in one request (the post cards). Posts
// without reposts are not in the map: use `?? 0`. Returns null when the
// request fails, so a card hides the number instead of showing a false 0.
export async function getRepostCounts(
  postIds: string[],
): Promise<Map<string, number> | null> {
  if (postIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_repost_counts", {
    post_ids: postIds,
  });

  if (error || !data) {
    console.error("getRepostCounts failed:", error);
    return null;
  }
  return new Map(data.map((row) => [row.post_id, row.repost_count]));
}

// Ids of the posts this person reposted, newest first (the Reposts tab).
// Returns null when the request fails, so the page can say so.
export async function listRepostedPostIds(
  userId: string,
): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reposts")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(REPOST_LIST_LIMIT);

  if (error || !data) {
    console.error("listRepostedPostIds failed:", error);
    return null;
  }
  return data.map((row) => row.post_id);
}

// Captions of this person's reposts among the given posts (the Reposts tab).
// Posts without a caption are not in the map. Returns an empty map when the
// request fails (the cards then simply show no caption).
export async function listRepostCaptions(
  userId: string,
  postIds: string[],
): Promise<Map<string, string>> {
  if (postIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reposts")
    .select("post_id, caption")
    .eq("user_id", userId)
    .in("post_id", postIds)
    .not("caption", "is", null);

  if (error || !data) {
    console.error("listRepostCaptions failed:", error);
    return new Map();
  }
  const captions = new Map<string, string>();
  for (const row of data) {
    if (row.caption) captions.set(row.post_id, row.caption);
  }
  return captions;
}
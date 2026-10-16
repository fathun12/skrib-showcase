import { createClient } from "@/lib/supabase/server";

export type LikeInfo = { count: number; liked: boolean };

// Like count of one post, plus whether the viewer has liked it (always false
// for a signed-out visitor). `head: true` returns only the count, no rows.
export async function getLikeInfo(
  postId: string,
  viewerId: string | null,
): Promise<LikeInfo> {
  const supabase = await createClient();

  const [countResult, likedResult] = await Promise.all([
    supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId),
    viewerId
      ? supabase
          .from("likes")
          .select("user_id")
          .eq("post_id", postId)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (countResult.error || likedResult.error) {
    console.error(
      "getLikeInfo failed:",
      countResult.error ?? likedResult.error,
    );
    return { count: 0, liked: false };
  }

  return { count: countResult.count ?? 0, liked: likedResult.data !== null };
}

// Like counts for several posts in one request (the post cards). Posts
// without likes are not in the map: use `?? 0`. Returns null when the
// request fails, so a card hides the number instead of showing a false 0.
export async function getLikeCounts(
  postIds: string[],
): Promise<Map<string, number> | null> {
  if (postIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_like_counts", {
    post_ids: postIds,
  });

  if (error || !data) {
    console.error("getLikeCounts failed:", error);
    return null;
  }
  return new Map(data.map((row) => [row.post_id, row.like_count]));
}
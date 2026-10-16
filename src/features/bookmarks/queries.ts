import { createClient } from "@/lib/supabase/server";

const SAVED_LIMIT = 100;

// Whether the viewer has saved this post (false for a signed-out visitor).
export async function isBookmarked(
  postId: string,
  viewerId: string | null,
): Promise<boolean> {
  if (!viewerId) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", viewerId)
    .eq("post_id", postId)
    .maybeSingle();

  if (error) {
    console.error("isBookmarked failed:", error);
    return false;
  }
  return data !== null;
}

// Ids of the posts this user saved, newest saved first. Returns null when
// the request fails, so the page can say so instead of showing "nothing saved".
export async function listSavedPostIds(
  userId: string,
): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(SAVED_LIMIT);

  if (error || !data) {
    console.error("listSavedPostIds failed:", error);
    return null;
  }
  return data.map((row) => row.post_id);
}
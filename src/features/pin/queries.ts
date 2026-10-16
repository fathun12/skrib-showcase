import { createClient } from "@/lib/supabase/server";

// The id of the story pinned on this profile, or null. The column is public
// (select is granted to everybody); the page still checks that the story is
// published and belongs to this author.
export async function getPinnedPostId(
  profileId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("pinned_post_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("getPinnedPostId failed:", error);
    return null;
  }
  return data?.pinned_post_id ?? null;
}
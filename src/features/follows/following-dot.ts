import { createClient } from "@/lib/supabase/server";

// "Never opened the Following tab": every new post since the follow counts.
const NEVER = "1970-01-01T00:00:00Z";

// True when someone I follow published something after I last opened the
// Following tab. Returns false when a query fails (no false dot).
export async function hasNewFollowingPosts(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: state, error: stateError } = await supabase
    .from("following_state")
    .select("seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (stateError) {
    console.error("hasNewFollowingPosts (state) failed:", stateError);
    return false;
  }

  // get_my_new_activity covers new stories of people I follow and new
  // reposts by them (ignoring anything older than the follow), so one row
  // back means "something new".
  const { data, error } = await supabase.rpc("get_my_new_activity", {
    p_since: state?.seen_at ?? NEVER,
    p_limit: 1,
  });
  if (error || !data) {
    console.error("hasNewFollowingPosts failed:", error);
    return false;
  }
  return data.length > 0;
}
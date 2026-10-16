import { createClient } from "@/lib/supabase/server";
import { safeAvatarUrl } from "@/features/uploads/avatar";
import {
  listFollowingIds,
  type FollowProfile,
} from "@/features/follows/queries";

// How many of the newest published stories are looked at.
const RECENT_STORIES = 60;

// Authors to suggest in the home sidebar: the people with the most stories
// among the newest ones, without the reader and without anyone the reader
// already follows. Returns null when a query fails, so the sidebar can hide
// the section instead of showing "none".
export async function listSuggestedAuthors(
  viewerId: string | null,
  limit = 3,
): Promise<FollowProfile[] | null> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("posts")
    .select("author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(RECENT_STORIES);

  if (error || !rows) {
    console.error("listSuggestedAuthors failed:", error);
    return null;
  }

  const skip = new Set<string>(
    viewerId ? [viewerId, ...(await listFollowingIds(viewerId))] : [],
  );

  // Stories per author. The sort is stable, so authors with the same count
  // keep the order of their newest story.
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (skip.has(row.author_id)) continue;
    counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
  }
  // A few extra ids, in case some profiles have no username yet.
  const ids = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit + 3)
    .map(([id]) => id);
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .in("id", ids);

  if (profilesError || !profiles) {
    console.error("listSuggestedAuthors (profiles) failed:", profilesError);
    return null;
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const result: FollowProfile[] = [];
  for (const id of ids) {
    const profile = profileById.get(id);
    // No username means onboarding is not finished: no page to link to.
    if (!profile || !profile.username) continue;
    result.push({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: safeAvatarUrl(profile.avatar_url),
      bio: profile.bio ?? "",
    });
    if (result.length === limit) break;
  }
  return result;
}
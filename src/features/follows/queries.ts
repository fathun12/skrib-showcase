import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { safeAvatarUrl } from "@/features/uploads/avatar";

// The follower / following pages show at most this many people (no
// pagination yet, same as the other lists).
const LIST_LIMIT = 100;

export type FollowCounts = { followers: number; following: number };

// Followers = rows where this profile is being followed; following = rows
// where this profile is the follower. `head: true` returns only the count,
// no rows. cache() lets the profile page and anything else in the same
// request share one round trip.
export const getFollowCounts = cache(
  async (profileId: string): Promise<FollowCounts> => {
    const supabase = await createClient();
    const [followers, following] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId),
    ]);

    if (followers.error || following.error) {
      console.error(
        "getFollowCounts failed:",
        followers.error ?? following.error,
      );
      return { followers: 0, following: 0 };
    }
    return {
      followers: followers.count ?? 0,
      following: following.count ?? 0,
    };
  },
);

export type FollowProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
};

type Direction = "followers" | "following";

// Two small queries (like the feed): the follow rows, then the profiles.
// The order of the follow rows (newest first) is kept.
async function listFollowProfiles(
  profileId: string,
  direction: Direction,
): Promise<FollowProfile[]> {
  const supabase = await createClient();
  // Followers of P: rows with following_id = P, we want the follower_id.
  // Following of P: rows with follower_id = P, we want the following_id.
  const filterColumn = direction === "followers" ? "following_id" : "follower_id";
  const otherColumn = direction === "followers" ? "follower_id" : "following_id";

  const { data: rows, error } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .eq(filterColumn, profileId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error || !rows) {
    console.error(`listFollowProfiles (${direction}) failed:`, error);
    return [];
  }
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row[otherColumn]);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .in("id", ids);

  if (profilesError || !profiles) {
    console.error(
      `listFollowProfiles (${direction}, profiles) failed:`,
      profilesError,
    );
    return [];
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const result: FollowProfile[] = [];
  for (const id of ids) {
    const profile = profileById.get(id);
    // A profile without a username has not finished onboarding: no page to link to.
    if (!profile || !profile.username) continue;
    result.push({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: safeAvatarUrl(profile.avatar_url),
      bio: profile.bio ?? "",
    });
  }
  return result;
}

export function listFollowers(profileId: string) {
  return listFollowProfiles(profileId, "followers");
}

export function listFollowing(profileId: string) {
  return listFollowProfiles(profileId, "following");
}

// Does `followerId` follow `followingId`? One row at most (primary key).
export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) {
    console.error("isFollowing failed:", error);
    return false;
  }
  return data !== null;
}

// The Following tab asks the database for posts by these authors in one
// request, so the list is capped to keep the request small. The newest
// follows come first; older follows beyond the cap are left out.
const FOLLOWING_FEED_AUTHOR_LIMIT = 100;

// Ids of the people `followerId` follows (for the Following tab).
export async function listFollowingIds(followerId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .order("created_at", { ascending: false })
    .limit(FOLLOWING_FEED_AUTHOR_LIMIT);

  if (error || !data) {
    console.error("listFollowingIds failed:", error);
    return [];
  }
  return data.map((row) => row.following_id);
}
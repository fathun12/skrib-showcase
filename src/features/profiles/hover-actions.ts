"use server";

import { getCurrentUser } from "@/features/auth/queries";
import { getFollowCounts, isFollowing } from "@/features/follows/queries";
import { getProfileByUsername } from "@/features/profiles/queries";
import { USERNAME_REGEX } from "@/lib/constants";
import type { HoverProfile } from "@/ui/profile/hover-card-context";

// Public fields only, plus the viewer's own follow state. Takes `unknown` on
// purpose: the input comes from the browser, and only a valid username passes.
export async function getHoverProfile(
  input: unknown,
): Promise<HoverProfile | null> {
  if (typeof input !== "string") return null;
  const username = input.toLowerCase();
  if (!USERNAME_REGEX.test(username)) return null;

  const profile = await getProfileByUsername(username);
  if (!profile) return null;

  const current = await getCurrentUser();
  const signedIn = Boolean(current?.profile?.username);
  const isSelf = current?.id === profile.id;

  const [counts, following] = await Promise.all([
    getFollowCounts(profile.id),
    current && signedIn && !isSelf
      ? isFollowing(current.id, profile.id)
      : Promise.resolve(false),
  ]);

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    followers: counts.followers,
    signedIn,
    isSelf,
    following,
  };
}
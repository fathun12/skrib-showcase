import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { safeAvatarUrl } from "@/features/uploads/avatar";

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
};

// Loads a public profile by username. Returns null when it does not exist or
// the user has not finished onboarding (no username yet).
// Usernames are stored lowercase, so the lookup lowercases the URL segment:
// /Alice and /alice both work, without a redirect.
export const getProfileByUsername = cache(
  async (username: string): Promise<PublicProfile | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("getProfileByUsername failed:", error);
      return null;
    }
    if (!data || !data.username) return null;

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatarUrl: safeAvatarUrl(data.avatar_url),
      bio: data.bio ?? "",
    };
  },
);
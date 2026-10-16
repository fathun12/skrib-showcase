import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeAvatarUrl } from "@/features/uploads/avatar";

// Returns the signed-in user with their profile, or null if signed out.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    // Header and Preview read the avatar from here.
    profile: profile
      ? { ...profile, avatar_url: safeAvatarUrl(profile.avatar_url) }
      : null,
  };
});

// For protected pages: pass the page's own path so the user returns to it after login.
export async function requireUser(nextPath: string) {
  const current = await getCurrentUser();
  if (!current) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  const { profile } = current;
  if (!profile?.username) {
    redirect(`/onboarding?next=${encodeURIComponent(nextPath)}`);
  }
  // Why: the checks above only narrow local variables. Returning a new object
  // gives callers the narrowed types (profile is not null, username is a string).
  return {
    id: current.id,
    email: current.email,
    profile: { ...profile, username: profile.username },
  };
}
import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";
import type { ProfileListItem } from "@/ui/profile/ProfileList";

const PEOPLE_LIMIT = 3;

// A username is 3 to 30 characters of a-z, 0-9, _ and - (src/lib/constants).
// Only a typed text of that shape is searched, so every character that acts as
// a wildcard in a LIKE pattern (% and *) or as an escape (\) never reaches the
// database; only _ is left to escape.
const USERNAME_QUERY = /^[a-z0-9_-]{2,30}$/;

// People whose username starts with the typed text, at most three, for the
// section above the stories on the search page. Public profile fields only.
// Returns [] for anything that is not a possible username prefix (a phrase
// with spaces, a symbol, one letter), without calling the database.
export async function searchPeople(
  rawQuery: string,
): Promise<ProfileListItem[]> {
  const query = rawQuery.trim().toLowerCase();
  if (!USERNAME_QUERY.test(query)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .ilike("username", `${query.replace(/_/g, "\\_")}%`)
    .order("username")
    .limit(PEOPLE_LIMIT);

  if (error || !data) {
    // The words are never logged, only the error object.
    console.error("searchPeople failed:", error);
    return [];
  }

  const people: ProfileListItem[] = [];
  for (const row of data) {
    // A profile without a username has not finished onboarding.
    if (!row.username) continue;
    people.push({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: safeAvatarUrl(row.avatar_url),
      bio: row.bio,
    });
  }
  return people;
}
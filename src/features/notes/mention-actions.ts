"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { listFollowingIds } from "@/features/follows/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { safeAvatarUrl } from "@/features/uploads/avatar";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import type { MentionSuggestion } from "@/ui/notes/NoteComposer";

const SUGGESTION_COUNT = 5;
// Rows read per group before the muted and blocking people are left out.
const CANDIDATES = 20;

// What was typed after the @: a username prefix (0 to 30 characters).
const prefixSchema = z.string().max(30);
const USERNAME_PREFIX = /^[a-z0-9_-]*$/;

export type MentionSuggestionsResult =
  // The id is needed by the story editor (the mention node stores it).
  | { ok: true; suggestions: (MentionSuggestion & { id: string })[] }
  | { ok: false; error: string };

// Usernames that start with what the author typed after the @, people the
// author follows first. An empty prefix gives the people the author follows.
// Signed-in only and rate limited, because it reaches the database on every
// pause in typing. Public profile fields only; muted people and people who
// blocked the author are left out.
export async function loadMentionSuggestions(
  input: unknown,
): Promise<MentionSuggestionsResult> {
  const user = await requireUser("/");

  const parsed = prefixSchema.safeParse(input);
  const prefix = parsed.success ? parsed.data.toLowerCase() : null;
  if (prefix === null || !USERNAME_PREFIX.test(prefix)) {
    return { ok: false, error: "Suggestions are not available right now." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_mention_suggest");
  if (!limit.ok) return { ok: false, error: limit.error };

  const [hiddenResult, followingIds] = await Promise.all([
    supabase.rpc("my_hidden_note_authors"),
    listFollowingIds(user.id),
  ]);
  if (hiddenResult.error) {
    console.error("loadMentionSuggestions (hidden) failed:", hiddenResult.error);
  }
  const hidden = new Set(hiddenResult.data ?? []);
  const followed = [...new Set(followingIds)];

  // No prefix and nobody followed: nothing to suggest yet.
  if (prefix === "" && followed.length === 0) {
    return { ok: true, suggestions: [] };
  }

  // Only _ is a wildcard of LIKE that the prefix rule lets through.
  const pattern = `${prefix.replace(/_/g, "\\_")}%`;
  const select = () =>
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .neq("id", user.id)
      .not("username", "is", null);

  // Two groups, asked separately: the followed people always get their own
  // slots, even when many other usernames share the prefix.
  const [followedResult, othersResult] = await Promise.all([
    followed.length === 0
      ? null
      : (prefix === ""
          ? select().in("id", followed)
          : select().in("id", followed).ilike("username", pattern)
        )
          .order("username")
          .limit(CANDIDATES),
    prefix === ""
      ? null
      : select().ilike("username", pattern).order("username").limit(CANDIDATES),
  ]);

  const failure = followedResult?.error ?? othersResult?.error ?? null;
  if (failure) {
    console.error("loadMentionSuggestions failed:", failure);
    reportError("loadMentionSuggestions", failure);
    return { ok: false, error: "Suggestions are not available right now." };
  }

  // Followed people first, then the rest; each group stays A to Z.
  const rows = [...(followedResult?.data ?? []), ...(othersResult?.data ?? [])];
  const seen = new Set<string>();
  const people: typeof rows = [];
  for (const row of rows) {
    if (!row.username || hidden.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    people.push(row);
  }

  return {
    ok: true,
    suggestions: people.slice(0, SUGGESTION_COUNT).map((row) => ({
      id: row.id,
      username: row.username ?? "",
      displayName: row.display_name,
      avatarUrl: safeAvatarUrl(row.avatar_url),
    })),
  };
}
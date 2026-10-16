import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";

export type NoteRelation = { blocked: boolean; muted: boolean };

// Whether the viewer blocked or muted this profile (for the profile menu).
// A failed lookup counts as "no" and is logged.
export async function getNoteRelation(
  viewerId: string,
  profileId: string,
): Promise<NoteRelation> {
  const supabase = await createClient();
  const [blocked, muted] = await Promise.all([
    supabase
      .from("note_blocks")
      .select("blocked_id")
      .eq("blocker_id", viewerId)
      .eq("blocked_id", profileId)
      .maybeSingle(),
    supabase
      .from("note_mutes")
      .select("muted_id")
      .eq("muter_id", viewerId)
      .eq("muted_id", profileId)
      .maybeSingle(),
  ]);
  if (blocked.error) console.error("getNoteRelation (block) failed:", blocked.error);
  if (muted.error) console.error("getNoteRelation (mute) failed:", muted.error);
  return { blocked: Boolean(blocked.data), muted: Boolean(muted.data) };
}

export type RelatedPerson = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type NoteRelations = {
  blocked: RelatedPerson[];
  muted: RelatedPerson[];
};

// Profile ids per lookup (keeps the request URL short).
const ID_CHUNK = 100;
// Most people shown per list.
const LIST_LIMIT = 200;

// The people I blocked and the people I muted, newest first. Returns null
// when a request fails. A person without a username (onboarding not
// finished) is left out.
export async function listNoteRelations(
  viewerId: string,
): Promise<NoteRelations | null> {
  const supabase = await createClient();
  const [blocks, mutes] = await Promise.all([
    supabase
      .from("note_blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("note_mutes")
      .select("muted_id, created_at")
      .eq("muter_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
  ]);
  if (blocks.error || !blocks.data || mutes.error || !mutes.data) {
    console.error("listNoteRelations failed:", blocks.error ?? mutes.error);
    return null;
  }

  const blockedIds = blocks.data.map((row) => row.blocked_id);
  const mutedIds = mutes.data.map((row) => row.muted_id);
  const allIds = [...new Set([...blockedIds, ...mutedIds])];

  const people = new Map<string, RelatedPerson>();
  for (let i = 0; i < allIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", allIds.slice(i, i + ID_CHUNK));
    if (error || !data) {
      console.error("listNoteRelations (profiles) failed:", error);
      return null;
    }
    for (const profile of data) {
      if (!profile.username) continue;
      people.set(profile.id, {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: safeAvatarUrl(profile.avatar_url),
      });
    }
  }

  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const person = people.get(id);
      return person ? [person] : [];
    });
  return { blocked: pick(blockedIds), muted: pick(mutedIds) };
}
import { z } from "zod";
import { safeAvatarUrl } from "@/features/uploads/avatar";
import { createClient } from "@/lib/supabase/server";
import { creditRoleText } from "./constants";

export type CreditStatus = "pending" | "accepted";

// One row of the owner's Credits dialog. A person with an account has
// username, displayName and avatarUrl; a person without one has only `name`
// (and maybe `link`).
export type Credit = {
  id: string;
  role: string;
  roleOther: string | null;
  status: CreditStatus;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  name: string | null;
  link: string | null;
  createdAt: string;
};

// The credits of one post, for the owner's dialog (pending and accepted).
// RLS shows the owner every row. Returns null when a query fails, so the
// dialog can say so instead of showing an empty list.
export async function listCredits(postId: string): Promise<Credit[] | null> {
  if (!z.uuid().safeParse(postId).success) return null;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("post_credits")
    .select("id, user_id, name, link, role, role_other, status, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !rows) {
    console.error("listCredits failed:", error);
    return null;
  }
  if (rows.length === 0) return [];

  const userIds = rows.flatMap((row) => (row.user_id ? [row.user_id] : []));
  const profileById = new Map<
    string,
    { username: string | null; display_name: string; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);

    if (profilesError || !profiles) {
      console.error("listCredits (profiles) failed:", profilesError);
      return null;
    }
    for (const p of profiles) profileById.set(p.id, p);
  }

  const result: Credit[] = [];
  for (const row of rows) {
    const profile = row.user_id ? profileById.get(row.user_id) : undefined;
    // A person with an account but no profile username cannot be shown.
    if (row.user_id && !profile?.username) continue;
    result.push({
      id: row.id,
      role: row.role,
      roleOther: row.role_other,
      status: row.status === "accepted" ? "accepted" : "pending",
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile ? safeAvatarUrl(profile.avatar_url) : null,
      name: row.name,
      link: row.link,
      createdAt: row.created_at,
    });
  }
  return result;
}

// One accepted credit, ready to show on the public article page.
export type PublicCredit = {
  id: string;
  // Ready-made text: the fixed label, or the short custom text.
  roleText: string;
  // A person with an account has username and displayName; a person without
  // one has only `name` (and maybe `link`).
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  name: string | null;
  link: string | null;
};

// Accepted credits of a PUBLISHED post (the database function enforces both).
// Returns an empty list when the query fails: the section is simply hidden.
export async function getPostCredits(postId: string): Promise<PublicCredit[]> {
  if (!z.uuid().safeParse(postId).success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_post_credits", {
    p_post_id: postId,
  });

  if (error || !data) {
    console.error("getPostCredits failed:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.credit_id,
    roleText: creditRoleText(row.role, row.role_other ?? null),
    username: row.username ?? null,
    displayName: row.display_name ?? null,
    avatarUrl: safeAvatarUrl(row.avatar_url ?? null),
    name: row.name ?? null,
    link: row.link ?? null,
  }));
}

// One pending invitation of the signed-in person.
export type MyCreditInvite = {
  creditId: string;
  postTitle: string;
  ownerName: string;
  ownerUsername: string;
  // Ready-made text: the fixed label, or the short custom text.
  roleText: string;
  createdAt: string;
};

// Pending credit invitations of the signed-in person (never a draft body).
// Returns null when the query fails, so the page can say so.
export async function listMyCreditInvites(): Promise<MyCreditInvite[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_credit_invites");

  if (error || !data) {
    console.error("listMyCreditInvites failed:", error);
    return null;
  }

  return data.map((row) => ({
    creditId: row.credit_id,
    postTitle: row.post_title,
    ownerName: row.owner_display_name,
    ownerUsername: row.owner_username,
    roleText: creditRoleText(row.role, row.role_other ?? null),
    createdAt: row.created_at,
  }));
}
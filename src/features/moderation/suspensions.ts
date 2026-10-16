import { createClient } from "@/lib/supabase/server";

export type SuspendedUser = {
  userId: string;
  username: string | null;
  displayName: string;
  reason: string;
  note: string | null;
  suspendedAt: string;
  // null = until an admin lifts it.
  expiresAt: string | null;
};

// Active suspensions, newest first. null on an error (already logged).
export async function listSuspended(): Promise<SuspendedUser[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_suspended", {
    p_limit: 100,
    p_offset: 0,
  });
  if (error || !data) {
    console.error("listSuspended failed:", error);
    return null;
  }
  return data.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    reason: row.reason,
    note: row.note,
    suspendedAt: row.suspended_at,
    expiresAt: row.expires_at,
  }));
}
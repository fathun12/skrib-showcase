// Browser-side calls to the edit-lock functions of migration 0010.
// These run in the BROWSER on purpose (COLLAB_SPEC section 6, rule 9): the
// heartbeat and the polling happen every few seconds, and a Server Action per
// call would mean a Vercel invocation per call. The database functions check
// who is calling, so the browser client is safe here.
// Import this file only from client components.

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

// One row of get_lock_state; all the lock functions return the same shape.
type LockRow =
  Database["public"]["Functions"]["get_lock_state"]["Returns"][number];

export type LockState = {
  holderId: string | null;
  holderName: string | null;
  // The caller holds the pen.
  isHolder: boolean;
  // Nobody holds the pen, or the holder has been silent for 120 seconds.
  free: boolean;
  requestedById: string | null;
  requestedByName: string | null;
  // The caller is the person who asked for a turn.
  iRequested: boolean;
  requestAgeSeconds: number | null;
  holderIdleSeconds: number | null;
  // Seconds left of the wait after a "Not now" (0 = no wait).
  cooldownSeconds: number;
};

export type LockResult =
  | { ok: true; state: LockState }
  | { ok: false; reason: "not_allowed" | "signed_out" | "failed" };

function toLockState(row: LockRow): LockState {
  return {
    holderId: row.holder_id ?? null,
    holderName: row.holder_display_name ?? null,
    isHolder: row.is_holder === true,
    free: row.free === true,
    requestedById: row.requested_by ?? null,
    requestedByName: row.requested_by_display_name ?? null,
    iRequested: row.i_requested === true,
    requestAgeSeconds: row.request_age_seconds ?? null,
    holderIdleSeconds: row.holder_idle_seconds ?? null,
    cooldownSeconds: row.cooldown_seconds ?? 0,
  };
}

function toResult(
  data: LockRow[] | null,
  error: { message: string } | null,
  where: string,
): LockResult {
  if (error) {
    // The database functions raise these plain messages (migration 0010).
    if (error.message.includes("collab_not_allowed")) {
      return { ok: false, reason: "not_allowed" };
    }
    if (error.message.includes("not signed in")) {
      return { ok: false, reason: "signed_out" };
    }
    console.error(`${where} failed:`, error);
    return { ok: false, reason: "failed" };
  }

  const row = data?.[0];
  if (!row) {
    console.error(`${where}: empty result`);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, state: toLockState(row) };
}

// Reads the state. Also moves the pen when an automatic transfer is due.
export async function getLockState(postId: string): Promise<LockResult> {
  try {
    const { data, error } = await createClient().rpc("get_lock_state", {
      p_post_id: postId,
    });
    return toResult(data, error, "getLockState");
  } catch (error) {
    console.error("getLockState threw:", error);
    return { ok: false, reason: "failed" };
  }
}

// Takes the pen when it is free (or already ours). Otherwise nothing changes
// and the returned state shows who holds it.
export async function acquireLock(postId: string): Promise<LockResult> {
  try {
    const { data, error } = await createClient().rpc("acquire_edit_lock", {
      p_post_id: postId,
    });
    return toResult(data, error, "acquireLock");
  } catch (error) {
    console.error("acquireLock threw:", error);
    return { ok: false, reason: "failed" };
  }
}

// "I am still here". `edited` is true only when the text changed since the
// last heartbeat; this is what keeps a typist from losing the pen.
export async function heartbeatLock(
  postId: string,
  edited: boolean,
): Promise<LockResult> {
  try {
    const { data, error } = await createClient().rpc("heartbeat_edit_lock", {
      p_post_id: postId,
      p_edited: edited,
    });
    return toResult(data, error, "heartbeatLock");
  } catch (error) {
    console.error("heartbeatLock threw:", error);
    return { ok: false, reason: "failed" };
  }
}

// Gives the pen back. Best effort: if it fails, the pen expires by itself
// after 120 seconds.
export async function releaseLock(postId: string): Promise<void> {
  try {
    const { error } = await createClient().rpc("release_edit_lock", {
      p_post_id: postId,
    });
    if (error) console.error("releaseLock failed:", error);
  } catch (error) {
    console.error("releaseLock threw:", error);
  }
}
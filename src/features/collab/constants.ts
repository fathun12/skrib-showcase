// Co-authoring limits and timings (COLLAB_SPEC sections 2 and 5).
// MAX_COAUTHORS and MAX_PENDING_INVITES_RECEIVED must match the trigger
// private.check_collaborator_insert in supabase/migrations/0009_collaborators.sql.
// The timings below are the real ones: the lock client (lock.ts, useEditLock)
// uses them AND the SQL functions of migrations 0010 to 0013 hard-code them,
// so change both places together. A pen without a heartbeat for 120 s is
// free. A request is granted automatically when the holder has not answered
// for 60 s and has not typed for 60 s. After "Not now" the same person cannot
// ask again for 120 s. Rate limits (migration 0009 and 0013): collab_invite
// 20 per 3600 s, collab_respond 30 per 600 s, collab_turn 20 per 600 s.

export const MAX_COAUTHORS = 3;
// Must match the editor cap in private.check_collaborator_insert (migration 0095).
export const MAX_EDITORS = 2;
export const MAX_PENDING_INVITES_RECEIVED = 20;

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const VIEWER_POLL_INTERVAL_MS = 10_000;
export const LOCK_EXPIRY_SECONDS = 120;
export const TURN_AUTO_TRANSFER_SECONDS = 60;
export const REQUEST_COOLDOWN_SECONDS = 120;
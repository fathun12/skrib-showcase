"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { listCollaborators, type Collaborator } from "./queries";
import {
  inviteSchema,
  leaveSchema,
  loadCollaboratorsSchema,
  removeCollaboratorSchema,
  requestTurnSchema,
  respondInviteSchema,
  respondTurnSchema,
  setEditorCanPublishSchema,
  setEditorCreditSchema,
  handoverSchema,
} from "./schemas";

export type CollabResult = { ok: true } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const GENERIC_ERROR = "Something went wrong. Please try again.";

// The trigger in migration 0009 raises these codes as the error message.
// They are expected refusals, so they are shown to the user and not reported.
const INVITE_TRIGGER_ERRORS: Record<string, string> = {
  collab_self: "You can't invite yourself.",
  collab_not_onboarded:
    "That person hasn't finished setting up their account yet.",
  collab_post_limit:
    "A post can have at most 3 people besides the author, counting pending invitations.",
  collab_editor_limit:
    "A post can have at most 2 editors, counting pending invitations.",
  collab_invitee_limit:
    "That person has too many pending invitations right now.",
  collab_post_not_found: "This post could not be found.",
};

function inviteTriggerMessage(message: string): string | null {
  for (const [code, text] of Object.entries(INVITE_TRIGGER_ERRORS)) {
    if (message.includes(code)) return text;
  }
  return null;
}

// true = the user owns the post, false = not the owner or no such post,
// null = the lookup itself failed (already logged and reported).
async function ownsPost(
  supabase: ServerClient,
  postId: string,
  userId: string,
  where: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("author_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`${where} (post) failed:`, error);
    reportError(`${where} post`, error);
    return null;
  }
  return data !== null;
}

// The owner invites a person by username. All the limits (3 per post, 20
// pending per person, not yourself, finished onboarding) live in the database
// trigger; the checks here only give friendlier messages.
// Takes `unknown` on purpose: the input comes from the browser.
export async function inviteCollaborator(
  input: unknown,
): Promise<CollabResult> {
  const user = await requireUser("/");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please enter a valid username." };
  }
  const { postId, username, role, showCredit } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  if (username === user.profile.username) {
    return { ok: false, error: "You can't invite yourself." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_invite");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const owns = await ownsPost(supabase, postId, user.id, "inviteCollaborator");
  if (owns === null) return { ok: false, error: GENERIC_ERROR };
  if (!owns) {
    return {
      ok: false,
      error: "Only the author of a post can invite co-authors.",
    };
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (targetError) {
    console.error("inviteCollaborator (profile) failed:", targetError);
    reportError("inviteCollaborator profile", targetError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!target) {
    return { ok: false, error: "No one with that username was found." };
  }

  // invited_by and status are filled by the database, never sent from here.
  const { error } = await supabase
    .from("post_collaborators")
    .insert({
      post_id: postId,
      user_id: target.id,
      role,
      // The credit switch only exists for an editor.
      show_credit: role === "editor" ? showCredit : true,
    });

  if (error) {
    // 23505 = this person already has a row for this post.
    if (error.code === "23505") {
      return { ok: false, error: "That person is already invited." };
    }
    const friendly = inviteTriggerMessage(error.message);
    if (friendly) return { ok: false, error: friendly };

    console.error("inviteCollaborator (insert) failed:", error);
    reportError("inviteCollaborator insert", error);
    return { ok: false, error: "Could not send the invitation. Please try again." };
  }

  return { ok: true };
}

// The owner switches "Edited by" on or off for an editor. Goes through the
// database function set_editor_credit (migration 0096): nobody has an UPDATE
// right on post_collaborators.
export async function setEditorCredit(input: unknown): Promise<CollabResult> {
  await requireUser("/");

  const parsed = setEditorCreditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This editor could not be found." };
  }
  const { postId, userId, showCredit } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("set_editor_credit", {
    p_post_id: postId,
    p_user_id: userId,
    p_show_credit: showCredit,
  });

  if (error) {
    if (error.message.includes("collab_not_allowed")) {
      return { ok: false, error: "Only the author of a post can change this." };
    }
    if (error.message.includes("collab_editor_not_found")) {
      return { ok: false, error: "This editor could not be found." };
    }
    console.error("setEditorCredit failed:", error);
    reportError("setEditorCredit rpc", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  // "Edited by" shows on the article page.
  revalidatePath("/", "layout");
  return { ok: true };
}

// The owner allows or forbids an editor to publish this story (migration
// 0098). Goes through the database function: nobody has an UPDATE right.
export async function setEditorCanPublish(
  input: unknown,
): Promise<CollabResult> {
  await requireUser("/");

  const parsed = setEditorCanPublishSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This editor could not be found." };
  }
  const { postId, userId, canPublish } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("set_editor_can_publish", {
    p_post_id: postId,
    p_user_id: userId,
    p_can_publish: canPublish,
  });

  if (error) {
    if (error.message.includes("collab_not_allowed")) {
      return { ok: false, error: "Only the author of a post can change this." };
    }
    if (error.message.includes("collab_editor_not_found")) {
      return { ok: false, error: "This editor could not be found." };
    }
    console.error("setEditorCanPublish failed:", error);
    reportError("setEditorCanPublish rpc", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/me/posts");
  return { ok: true };
}

// The owner removes a co-author (or cancels a pending invitation).
export async function removeCollaborator(
  input: unknown,
): Promise<CollabResult> {
  const user = await requireUser("/");

  const parsed = removeCollaboratorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This person could not be found." };
  }
  const { postId, userId } = parsed.data;

  if (userId === user.id) {
    return { ok: false, error: "Use Leave to remove yourself." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const owns = await ownsPost(supabase, postId, user.id, "removeCollaborator");
  if (owns === null) return { ok: false, error: GENERIC_ERROR };
  if (!owns) {
    return {
      ok: false,
      error: "Only the author of a post can remove co-authors.",
    };
  }

  // Deleting a row that does not exist is not an error: also "done".
  const { error } = await supabase
    .from("post_collaborators")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (error) {
    console.error("removeCollaborator (delete) failed:", error);
    reportError("removeCollaborator delete", error);
    return { ok: false, error: "Could not remove this person. Please try again." };
  }

  // The byline shows on the article, profiles and feeds; the pen is freed by
  // the trigger of migration 0017.
  revalidatePath("/me/posts");
  revalidatePath("/", "layout");
  return { ok: true };
}

// A co-author leaves a post they accepted. The pen is released by the trigger
// of migration 0017.
export async function leavePost(input: unknown): Promise<CollabResult> {
  const user = await requireUser("/");

  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }
  const { postId } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase
    .from("post_collaborators")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("status", "accepted");

  if (error) {
    console.error("leavePost (delete) failed:", error);
    reportError("leavePost delete", error);
    return { ok: false, error: "Could not leave this post. Please try again." };
  }

  revalidatePath("/me/posts");
  // The name disappears from the article, profiles and feeds.
  revalidatePath("/", "layout");
  return { ok: true };
}

// Accept or decline an invitation. Goes through the database function
// respond_invite: people have no UPDATE right on the table.
export async function respondInvite(input: unknown): Promise<CollabResult> {
  await requireUser("/");

  const parsed = respondInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This invitation could not be found." };
  }
  const { postId, accept } = parsed.data;
  if (accept && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("respond_invite", {
    p_post_id: postId,
    p_accept: accept,
  });

  if (error) {
    if (error.message.includes("collab_invite_not_found")) {
      return { ok: false, error: "This invitation is no longer available." };
    }
    console.error("respondInvite failed:", error);
    reportError("respondInvite rpc", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/me/posts");
  return { ok: true };
}

export type LoadCollaboratorsResult =
  | { ok: true; collaborators: Collaborator[] }
  | { ok: false; error: string };

// Reads the list for the Collaborators dialog. A Server Action (and not a
// query in a Server Component) because the dialog opens on a click, in the
// browser. RLS shows the owner every row of the post.
export async function loadCollaborators(
  input: unknown,
): Promise<LoadCollaboratorsResult> {
  await requireUser("/");

  const parsed = loadCollaboratorsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }

  const collaborators = await listCollaborators(parsed.data.postId);
  if (!collaborators) {
    return { ok: false, error: "Could not load the list. Please try again." };
  }
  return { ok: true, collaborators };
}

export type TurnResult =
  | { ok: true }
  // code "free": nobody holds the pen any more (the app offers Start editing).
  // code "not_holder": the caller does not hold the pen (it may have moved).
  | { ok: false; error: string; code?: "free" | "not_holder" };

// The functions of migration 0010 raise these plain messages. They are
// expected refusals: shown to the user, never sent to Sentry.
const TURN_ERRORS: Record<string, string> = {
  collab_not_allowed: "You can no longer edit this post.",
  collab_already_holder: "You already have the pen.",
  collab_request_pending:
    "Someone else already asked for a turn. Please wait a moment.",
  collab_request_cooldown:
    "The author said not now. You can ask again in a couple of minutes.",
  collab_no_request: "That request is no longer there.",
};

function turnMessage(message: string): string | null {
  for (const [code, text] of Object.entries(TURN_ERRORS)) {
    if (message.includes(code)) return text;
  }
  return null;
}

// A co-author (or the owner) asks the person who holds the pen for a turn.
// The state afterwards is read by the browser with getLockState.
export async function requestTurn(input: unknown): Promise<TurnResult> {
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  await requireUser("/");

  const parsed = requestTurnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }
  const { postId } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_turn");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("request_turn", { p_post_id: postId });
  if (!error) return { ok: true };

  if (error.message.includes("collab_lock_free")) {
    return {
      ok: false,
      error: "Nobody is editing right now. You can start editing.",
      code: "free",
    };
  }
  const friendly = turnMessage(error.message);
  if (friendly) return { ok: false, error: friendly };

  console.error("requestTurn failed:", error);
  reportError("requestTurn rpc", error);
  return { ok: false, error: GENERIC_ERROR };
}

// The pen holder answers a request: hand the pen over, or "Not now" (the
// person must wait 120 s before asking again). The editor saves the text
// BEFORE it calls this with handOver true (COLLAB_SPEC section 6, rule 6).
export async function respondTurn(input: unknown): Promise<TurnResult> {
  await requireUser("/");

  const parsed = respondTurnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }
  const { postId, handOver } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "collab_turn");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("respond_turn", {
    p_post_id: postId,
    p_hand_over: handOver,
  });
  if (!error) return { ok: true };

  if (error.message.includes("collab_not_holder")) {
    return {
      ok: false,
      error: "You no longer have the pen.",
      code: "not_holder",
    };
  }
  const friendly = turnMessage(error.message);
  if (friendly) return { ok: false, error: friendly };

  console.error("respondTurn failed:", error);
  reportError("respondTurn rpc", error);
  return { ok: false, error: GENERIC_ERROR };
}

// The editor or the author sends the story to the other side with an optional
// note (migration 0097). The database saves a labelled version, gives the pen
// back and writes the notification. The editor saves the text BEFORE this call.
export async function sendHandover(input: unknown): Promise<TurnResult> {
  await requireUser("/");

  const parsed = handoverSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The note can be at most 280 characters." };
  }
  const { postId, note } = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_handover");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("handover_post", {
    p_post_id: postId,
    p_message: note ?? "",
  });
  if (!error) {
    revalidatePath("/me/posts");
    return { ok: true };
  }

  // Expected refusals: shown, never reported.
  if (error.message.includes("account_suspended")) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }
  if (error.message.includes("collab_not_holder")) {
    return {
      ok: false,
      error: "You no longer have the pen. Your text was saved.",
      code: "not_holder",
    };
  }
  if (error.message.includes("collab_handover_published")) {
    return { ok: false, error: "A published story cannot be handed over." };
  }
  if (error.message.includes("collab_no_editor")) {
    return {
      ok: false,
      error: "This story has no accepted editor yet.",
    };
  }
  if (error.message.includes("collab_not_allowed")) {
    return { ok: false, error: "You can't hand over this story." };
  }
  if (error.message.includes("collab_bad_input")) {
    return { ok: false, error: "The note can be at most 280 characters." };
  }

  console.error("sendHandover failed:", error);
  reportError("sendHandover rpc", error);
  return { ok: false, error: GENERIC_ERROR };
}
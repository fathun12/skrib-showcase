"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const relationSchema = z.object({
  profileId: z.uuid(),
  on: z.boolean(),
});

export type NoteRelationResult = { ok: true } | { ok: false; error: string };

// Sets the wanted state (on or off) instead of toggling, like setFollow.
// Takes `unknown` on purpose: the input comes from the browser.
async function setRelation(
  kind: "block" | "mute",
  input: unknown,
): Promise<NoteRelationResult> {
  const user = await requireUser("/");

  const parsed = relationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This profile could not be found." };
  }
  const { profileId, on } = parsed.data;

  if (profileId === user.id) {
    return {
      ok: false,
      error:
        kind === "block"
          ? "You can't block yourself."
          : "You can't mute yourself.",
    };
  }
  // Undoing is always allowed, also while suspended.
  if (on && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "note_manage");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", profileId)
    .maybeSingle();
  if (targetError) {
    console.error(`set note ${kind} (profile) failed:`, targetError);
    reportError(`set note ${kind} profile`, targetError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!target || !target.username) {
    return { ok: false, error: "This profile could not be found." };
  }

  if (kind === "block") {
    const { error } = on
      ? await supabase
          .from("note_blocks")
          .insert({ blocker_id: user.id, blocked_id: profileId })
      : await supabase
          .from("note_blocks")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", profileId);
    // 23505 = already blocked (double click, other tab): the wanted state is
    // reached, so it counts as done. Deleting a missing row is also "done".
    if (error && error.code !== "23505") {
      console.error("set note block failed:", error);
      reportError("set note block", error);
      return {
        ok: false,
        error: on
          ? "Could not block. Please try again."
          : "Could not unblock. Please try again.",
      };
    }
  } else {
    const { error } = on
      ? await supabase
          .from("note_mutes")
          .insert({ muter_id: user.id, muted_id: profileId })
      : await supabase
          .from("note_mutes")
          .delete()
          .eq("muter_id", user.id)
          .eq("muted_id", profileId);
    if (error && error.code !== "23505") {
      console.error("set note mute failed:", error);
      reportError("set note mute", error);
      return {
        ok: false,
        error: on
          ? "Could not mute. Please try again."
          : "Could not unmute. Please try again.",
      };
    }
  }

  revalidatePath(`/${target.username}`);
  revalidatePath("/");
  revalidatePath("/me/blocked");
  return { ok: true };
}

export async function setNoteBlock(input: unknown): Promise<NoteRelationResult> {
  return setRelation("block", input);
}

export async function setNoteMute(input: unknown): Promise<NoteRelationResult> {
  return setRelation("mute", input);
}
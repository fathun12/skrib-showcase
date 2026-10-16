"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { listCredits, type Credit } from "./queries";
import {
  addCreditSchema,
  loadCreditsSchema,
  removeCreditSchema,
  respondCreditSchema,
} from "./schemas";

export type CreditResult = { ok: true } | { ok: false; error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const GENERIC_ERROR = "Something went wrong. Please try again.";

// The trigger in migration 0025 raises these codes as the error message.
// They are expected refusals, so they are shown to the user and not reported.
const CREDIT_TRIGGER_ERRORS: Record<string, string> = {
  credit_self: "You can't credit yourself.",
  credit_not_onboarded:
    "That person hasn't finished setting up their account yet.",
  credit_is_coauthor:
    "Co-authors are already shown as authors, so they can't be credited.",
  credit_post_limit:
    "A post can have at most 20 credits, counting pending invitations.",
  credit_invitee_limit: "That person has too many pending invitations right now.",
  credit_post_not_found: "This post could not be found.",
};

function creditTriggerMessage(message: string): string | null {
  for (const [code, text] of Object.entries(CREDIT_TRIGGER_ERRORS)) {
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

// The owner credits a person: by username (needs acceptance) or by plain
// name (shown at once). Limits live in the database trigger; the checks here
// only give friendlier messages.
// Takes `unknown` on purpose: the input comes from the browser.
export async function addCredit(input: unknown): Promise<CreditResult> {
  const user = await requireUser("/");

  const parsed = addCreditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Please check the details: choose a role (\"Other\" needs a short text) and use a valid name, username or link.",
    };
  }
  const data = parsed.data;
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };

  if (data.kind === "user" && data.username === user.profile.username) {
    return { ok: false, error: "You can't credit yourself." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "credit_invite");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const owns = await ownsPost(supabase, data.postId, user.id, "addCredit");
  if (owns === null) return { ok: false, error: GENERIC_ERROR };
  if (!owns) {
    return {
      ok: false,
      error: "Only the author of a post can add credits.",
    };
  }

  const role = data.role;
  const roleOther = role === "other" ? (data.roleOther ?? null) : null;

  let insertError: { code?: string; message: string } | null = null;

  if (data.kind === "user") {
    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (targetError) {
      console.error("addCredit (profile) failed:", targetError);
      reportError("addCredit profile", targetError);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!target) {
      return { ok: false, error: "No one with that username was found." };
    }

    // invited_by and status are filled by the database, never sent from here.
    const { error } = await supabase.from("post_credits").insert({
      post_id: data.postId,
      user_id: target.id,
      role,
      role_other: roleOther,
    });
    insertError = error;
  } else {
    const { error } = await supabase.from("post_credits").insert({
      post_id: data.postId,
      name: data.name,
      link: data.link ?? null,
      role,
      role_other: roleOther,
    });
    insertError = error;
  }

  if (insertError) {
    // 23505 = this person (or name) already has a row for this post.
    if (insertError.code === "23505") {
      return { ok: false, error: "That person is already credited." };
    }
    const friendly = creditTriggerMessage(insertError.message);
    if (friendly) return { ok: false, error: friendly };

    console.error("addCredit (insert) failed:", insertError);
    reportError("addCredit insert", insertError);
    return { ok: false, error: "Could not add the credit. Please try again." };
  }

  // A credit by name is shown at once.
  revalidatePath("/", "layout");
  return { ok: true };
}

// Removes a credit: the post owner removes anyone, a credited person removes
// themself (resigns or cancels). Row level security decides who may; deleting
// a row that does not exist is not an error: also "done".
export async function removeCredit(input: unknown): Promise<CreditResult> {
  await requireUser("/");

  const parsed = removeCreditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This credit could not be found." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "credit_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase
    .from("post_credits")
    .delete()
    .eq("id", parsed.data.creditId);

  if (error) {
    console.error("removeCredit failed:", error);
    reportError("removeCredit delete", error);
    return { ok: false, error: "Could not remove the credit. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// Accept or decline a credit invitation. Goes through the database function
// respond_credit: people have no UPDATE right on the table.
export async function respondCredit(input: unknown): Promise<CreditResult> {
  await requireUser("/");

  const parsed = respondCreditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This invitation could not be found." };
  }
  const { creditId, accept } = parsed.data;
  if (accept && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "credit_respond");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase.rpc("respond_credit", {
    p_credit_id: creditId,
    p_accept: accept,
  });

  if (error) {
    if (error.message.includes("credit_not_found")) {
      return { ok: false, error: "This invitation is no longer available." };
    }
    console.error("respondCredit failed:", error);
    reportError("respondCredit rpc", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export type LoadCreditsResult =
  | { ok: true; credits: Credit[] }
  | { ok: false; error: string };

// Reads the list for the Credits dialog. A Server Action (and not a query in
// a Server Component) because the dialog opens on a click, in the browser.
// RLS shows the owner every row of the post.
export async function loadCredits(input: unknown): Promise<LoadCreditsResult> {
  await requireUser("/");

  const parsed = loadCreditsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }

  const credits = await listCredits(parsed.data.postId);
  if (!credits) {
    return { ok: false, error: "Could not load the list. Please try again." };
  }
  return { ok: true, credits };
}
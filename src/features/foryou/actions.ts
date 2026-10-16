"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { isValidTag } from "@/ui/tags";

// Same username shape as the profile rule; the value is lowercased below.
const hideSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("author"),
    username: z.string().regex(/^[a-zA-Z0-9_-]{3,30}$/),
  }),
  z.object({
    kind: z.literal("topic"),
    tag: z.string().refine(isValidTag),
  }),
]);

const unhideSchema = z.object({ id: z.uuid() });

export type HideResult =
  | { ok: true; id: string }
  | { ok: false; error: string };
export type UnhideResult = { ok: true } | { ok: false; error: string };

// Hides an author or a topic from the For you tab. Takes `unknown` on purpose:
// the input comes from the browser.
export async function hideFromForYou(input: unknown): Promise<HideResult> {
  const user = await requireUser("/");

  const parsed = hideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That could not be hidden." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "foryou_hide");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  let authorId: string | null = null;
  let tag: string | null = null;
  if (parsed.data.kind === "author") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username.toLowerCase())
      .maybeSingle();
    if (profileError) {
      console.error("hideFromForYou (profile) failed:", profileError);
      reportError("hideFromForYou profile", profileError);
      return { ok: false, error: "Could not save. Please try again." };
    }
    if (!profile) {
      return { ok: false, error: "That author could not be found." };
    }
    authorId = profile.id;
  } else {
    tag = parsed.data.tag;
  }

  // user_id is filled by the database from the session.
  const { data, error } = await supabase
    .from("foryou_hides")
    .insert({ author_id: authorId, tag })
    .select("id")
    .single();

  if (error) {
    // 23505 = already hidden (double click, other tab): return the old row.
    if (error.code === "23505") {
      const base = supabase
        .from("foryou_hides")
        .select("id")
        .eq("user_id", user.id);
      const { data: existing } = await (authorId
        ? base.eq("author_id", authorId)
        : base.eq("tag", tag ?? "")
      ).maybeSingle();
      if (existing) return { ok: true, id: existing.id };
    }
    // Only granted columns are written, so 42501 is the suspended-account policy.
    if (error.code === "42501") {
      return { ok: false, error: "You can't change this right now." };
    }
    if (error.code === "23514") {
      return {
        ok: false,
        error: "You can hide up to 100 things. Remove one in Settings first.",
      };
    }
    if (error.code === "23503") {
      return { ok: false, error: "That author could not be found." };
    }
    console.error("hideFromForYou (insert) failed:", error);
    reportError("hideFromForYou insert", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  // No revalidatePath here: it would refresh the For you page, the hidden
  // card would drop out of the list, and its Undo row with it. Settings is
  // dynamic and always reads fresh data.
  return { ok: true, id: data.id };
}

// Brings an author or topic back into For you.
export async function unhideForYou(input: unknown): Promise<UnhideResult> {
  const user = await requireUser("/");

  const parsed = unhideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That could not be found." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "foryou_hide");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // Deleting a row that does not exist is not an error: also "done".
  const { error } = await supabase
    .from("foryou_hides")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) {
    console.error("unhideForYou failed:", error);
    reportError("unhideForYou", error);
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}
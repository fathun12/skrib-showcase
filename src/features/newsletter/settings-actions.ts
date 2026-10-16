"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ enabled: z.boolean() });

export type SetNewsletterEnabledResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: string };

// The author setting "Allow email subscribers". Only the column
// newsletter_enabled is named (it has its own column grant) and RLS limits
// the update to the user's own row.
export async function setNewsletterEnabled(
  input: unknown,
): Promise<SetNewsletterEnabledResult> {
  const user = await requireUser("/settings");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "profile_update");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data, error } = await supabase
    .from("profiles")
    .update({ newsletter_enabled: parsed.data.enabled })
    .eq("id", user.id)
    .select("id");

  if (error) {
    reportError("setNewsletterEnabled", error);
    return { ok: false, error: "Could not save this setting. Please try again." };
  }
  // A policy can refuse an update without an error: 0 rows is a failure.
  if (!data || data.length === 0) {
    return { ok: false, error: "Could not save this setting. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath(`/${user.profile.username}`);
  return { ok: true, enabled: parsed.data.enabled };
}
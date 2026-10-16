"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ authorId: z.uuid() });

export type UnsubscribeMyResult = { ok: true } | { ok: false; error: string };

const GENERIC = "Could not unsubscribe right now. Please try again.";

// A signed-in reader leaves an author's newsletter. The database function
// uses auth.uid(), so it can only ever touch the caller's own subscription.
// No suspension check on purpose: this cancels, it does not write.
export async function unsubscribeMyNewsletter(
  input: unknown,
): Promise<UnsubscribeMyResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to manage your subscription." };

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "follow");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { error } = await supabase.rpc("unsubscribe_my_newsletter", {
    p_author: parsed.data.authorId,
  });
  if (error) {
    reportError("unsubscribeMyNewsletter", error);
    return { ok: false, error: GENERIC };
  }
  // The answers "unsubscribed" and "none" both mean: not subscribed now.
  return { ok: true };
}
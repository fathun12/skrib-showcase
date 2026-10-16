"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { isValidTag } from "@/ui/tags";

const setTagFollowSchema = z.object({
  tag: z.string().refine((value) => isValidTag(value)),
  follow: z.boolean(),
});

export type SetTagFollowResult = { ok: true } | { ok: false; error: string };

// Sets the wanted state (follow or not) instead of toggling, like setFollow,
// so a double click or a second tab cannot flip it by accident.
// Takes `unknown` on purpose: the input comes from the browser.
export async function setTagFollow(input: unknown): Promise<SetTagFollowResult> {
  await requireUser("/");

  const parsed = setTagFollowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This topic could not be found." };
  }
  const { tag, follow } = parsed.data;
  if (follow && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "tag_follow");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  if (follow) {
    // user_id is filled by the database from the session; only `tag` may be
    // sent (the insert grant is limited to that column).
    const { error } = await supabase.from("tag_follows").insert({ tag });
    // 23505 = already following (double click, other tab): the wanted state
    // is reached, so it counts as done.
    if (error && error.code !== "23505") {
      // The trigger of migration 0038 raises this at 50 followed topics.
      if (error.message.includes("tag_follow_limit")) {
        return { ok: false, error: "You can follow up to 50 topics." };
      }
      console.error("setTagFollow (insert) failed:", error);
      reportError("setTagFollow insert", error);
      return { ok: false, error: "Could not follow. Please try again." };
    }
  } else {
    // Row level security limits this to the caller's own row. Deleting a row
    // that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("tag_follows")
      .delete()
      .eq("tag", tag);
    if (error) {
      console.error("setTagFollow (delete) failed:", error);
      reportError("setTagFollow delete", error);
      return { ok: false, error: "Could not unfollow. Please try again." };
    }
  }

  // Refreshes the button on the topic page and the Topics tab on Home.
  revalidatePath(`/tag/${tag}`);
  revalidatePath("/");
  return { ok: true };
}
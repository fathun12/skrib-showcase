"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { publishPostSchema } from "@/features/posts/schemas";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

// The same fields as the Publish button, plus the chosen day (YYYY-MM-DD).
const scheduleSchema = publishPostSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ScheduleResult =
  | { ok: true; scheduledFor: string }
  | { ok: false; error: string };

export type CancelScheduleResult = { ok: true } | { ok: false; error: string };

const NOT_HOLDER =
  "Someone else holds the pen for this post. Try again when you have it.";
const GENERIC = "Could not save the schedule. Please try again.";

// Sets a draft to publish on a day (the daily cron job publishes it). The
// address, cover, topics and the newsletter choice are saved with it. The
// database function checks the owner, the title, the day and the address.
export async function schedulePost(input: unknown): Promise<ScheduleResult> {
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  await requireUser("/me/posts");

  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the address, the cover, the topics and the day.",
    };
  }
  const { id, slug, coverImageUrl, tags, emailSubscribers, date } = parsed.data;
  const when = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "Pick a valid day." };
  }

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data, error } = await supabase.rpc("schedule_post", {
    p_post: id,
    p_when: when.toISOString(),
    p_slug: slug,
    p_cover: coverImageUrl ?? undefined,
    p_tags: tags ?? [],
    p_email: emailSubscribers === true,
  });

  if (error) {
    if (error.message.includes("account_suspended")) {
      return { ok: false, error: SUSPENDED_MESSAGE };
    }
    if (error.message.includes("collab_not_holder")) {
      return { ok: false, error: NOT_HOLDER };
    }
    console.error("schedulePost failed:", error);
    reportError("schedulePost", error);
    return { ok: false, error: GENERIC };
  }

  switch (data) {
    case "scheduled":
      revalidatePath("/me/posts");
      return { ok: true, scheduledFor: when.toISOString() };
    case "no_title":
      return { ok: false, error: "Add a title before scheduling." };
    case "bad_time":
      return {
        ok: false,
        error: "Pick a day from tomorrow on, within the next year.",
      };
    case "bad_slug":
      return {
        ok: false,
        error:
          "The address can only use lowercase letters, numbers and single hyphens.",
      };
    case "slug_taken":
      return {
        ok: false,
        error: "You already have a story at this address. Try a different one.",
      };
    case "not_allowed":
      return { ok: false, error: "This post is no longer a draft." };
    default:
      return { ok: false, error: GENERIC };
  }
}

// Removes the schedule: the post stays a draft.
export async function cancelSchedule(
  postId: unknown,
): Promise<CancelScheduleResult> {
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  await requireUser("/me/posts");

  const parsedId = z.uuid().safeParse(postId);
  if (!parsedId.success) {
    return { ok: false, error: "This post could not be found." };
  }

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) return { ok: false, error: limit.error };

  const { data, error } = await supabase.rpc("schedule_post", {
    p_post: parsedId.data,
  });

  if (error) {
    if (error.message.includes("account_suspended")) {
      return { ok: false, error: SUSPENDED_MESSAGE };
    }
    if (error.message.includes("collab_not_holder")) {
      return { ok: false, error: NOT_HOLDER };
    }
    console.error("cancelSchedule failed:", error);
    reportError("cancelSchedule", error);
    return { ok: false, error: GENERIC };
  }

  if (data === "cancelled") {
    revalidatePath("/me/posts");
    return { ok: true };
  }
  return { ok: false, error: "This post is no longer a draft." };
}
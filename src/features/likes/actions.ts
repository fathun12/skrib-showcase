"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const setLikeSchema = z.object({
  postId: z.uuid(),
  like: z.boolean(),
});

export type SetLikeResult = { ok: true } | { ok: false; error: string };

// Sets the wanted state ("liked" or "not liked") instead of toggling, so a
// double click or a second tab can never flip it by accident.
// Takes `unknown` on purpose: the input comes from the browser.
export async function setLike(input: unknown): Promise<SetLikeResult> {
  const user = await requireUser("/");

  const parsed = setLikeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }
  const { postId, like } = parsed.data;
  if (like && (await isSuspended())) {
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  const supabase = await createClient();

  // Right after requireUser and the Zod parse, before any other query.
  const limit = await checkRateLimit(supabase, "like");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // The post must be published (RLS also enforces this for new likes). Its
  // address is needed to refresh the article page afterwards.
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("slug, author_id")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();

  if (postError) {
    console.error("setLike (post) failed:", postError);
    reportError("setLike post", postError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!post) {
    return { ok: false, error: "This post could not be found." };
  }

  const { data: author, error: authorError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", post.author_id)
    .maybeSingle();

  if (authorError) {
    console.error("setLike (author) failed:", authorError);
    reportError("setLike author", authorError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!author || !author.username) {
    return { ok: false, error: "This post could not be found." };
  }

  if (like) {
    const { error } = await supabase
      .from("likes")
      .insert({ user_id: user.id, post_id: postId });
    // 23505 = already liked (double click, other tab): the wanted state is
    // reached, so it counts as done.
    if (error && error.code !== "23505") {
      console.error("setLike (insert) failed:", error);
      reportError("setLike insert", error);
      return { ok: false, error: "Could not like this post. Please try again." };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);
    if (error) {
      console.error("setLike (delete) failed:", error);
      reportError("setLike delete", error);
      return { ok: false, error: "Could not unlike this post. Please try again." };
    }
  }

  // Refreshes the count and the heart on the article page.
  revalidatePath(`/${author.username}/${post.slug}`);
  return { ok: true };
}
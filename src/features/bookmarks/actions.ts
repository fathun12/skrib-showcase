"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const setBookmarkSchema = z.object({
  postId: z.uuid(),
  save: z.boolean(),
});

export type SetBookmarkResult = { ok: true } | { ok: false; error: string };

// Sets the wanted state ("saved" or "not saved") instead of toggling, like
// setLike. Takes `unknown` on purpose: the input comes from the browser.
export async function setBookmark(input: unknown): Promise<SetBookmarkResult> {
  const user = await requireUser("/");

  const parsed = setBookmarkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This post could not be found." };
  }
  const { postId, save } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "bookmark");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  if (save) {
    // user_id is filled by the database from the session.
    const { error } = await supabase
      .from("bookmarks")
      .insert({ post_id: postId });
    // 23505 = already saved (double click, other tab): the wanted state is
    // reached, so it counts as done.
    if (error && error.code !== "23505") {
      // 42501 = RLS refused (post not published); 23503 = post is gone.
      if (error.code === "42501" || error.code === "23503") {
        return { ok: false, error: "This post could not be found." };
      }
      console.error("setBookmark (insert) failed:", error);
      reportError("setBookmark insert", error);
      return { ok: false, error: "Could not save this post. Please try again." };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);
    if (error) {
      console.error("setBookmark (delete) failed:", error);
      reportError("setBookmark delete", error);
      return { ok: false, error: "Could not remove this post. Please try again." };
    }
  }

  revalidatePath("/me/saved");
  return { ok: true };
}
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { normalizeTagPrefix } from "@/ui/tags";
import { tagPrefixSchema, updateTagsSchema } from "./schemas";

export type UpdatePostTagsResult =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

const NOT_YOURS = "This post is no longer yours or published. Reload the page.";
const SAVE_FAILED = "Could not save the topics. Please try again.";

// Changes the topics of a post that is already published. Saved right away,
// like the cover. Only the owner may do it (a co-author has no UPDATE policy
// on posts), and the pen is not needed: the guard trigger of 0012/0014 does
// not watch the `tags` column.
export async function updatePostTags(
  input: unknown,
): Promise<UpdatePostTagsResult> {
  const user = await requireUser("/me/posts");

  const parsed = updateTagsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Topics use letters, numbers and hyphens, 2 to 30 characters each, up to 5 topics.",
    };
  }
  const { id, tags } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "post_admin");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // The old topics and the slug are needed to refresh the right pages.
  const { data: before, error: loadError } = await supabase
    .from("posts")
    .select("slug, tags")
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "published")
    .maybeSingle();

  if (loadError) {
    console.error("updatePostTags load failed:", loadError);
    reportError("updatePostTags load", loadError);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!before) {
    return { ok: false, error: NOT_YOURS };
  }

  const { data, error } = await supabase
    .from("posts")
    .update({ tags })
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "published")
    .select("id");

  if (error) {
    console.error("updatePostTags failed:", error);
    reportError("updatePostTags", error);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: NOT_YOURS };
  }

  // Only the topics that were added or removed change a tag page.
  const changed = [...new Set([...before.tags, ...tags])].filter(
    (tag) => before.tags.includes(tag) !== tags.includes(tag),
  );
  revalidatePath("/me/posts");
  revalidatePath(`/${user.profile.username}/${before.slug}`);
  for (const tag of changed) {
    revalidatePath(`/tag/${tag}`);
  }
  return { ok: true, tags };
}

export type TagSuggestion = { tag: string; count: number };

export type LoadTagSuggestionsResult =
  | { ok: true; suggestions: TagSuggestion[] }
  | { ok: false; error: string };

// Popular topics (empty prefix) or topics that start with what the author
// typed. Signed-in only and rate limited, because it reaches the database on
// every pause in typing.
export async function loadTagSuggestions(
  prefix: unknown,
): Promise<LoadTagSuggestionsResult> {
  await requireUser("/me/posts");

  const parsed = tagPrefixSchema.safeParse(prefix);
  if (!parsed.success) {
    return { ok: false, error: "Suggestions are not available right now." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "tag_suggest");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { data, error } = await supabase.rpc("get_tag_counts", {
    p_prefix: normalizeTagPrefix(parsed.data),
    p_limit: 10,
  });

  if (error) {
    console.error("loadTagSuggestions failed:", error);
    reportError("loadTagSuggestions", error);
    return { ok: false, error: "Suggestions are not available right now." };
  }

  return {
    ok: true,
    suggestions: (data ?? []).map((row) => ({
      tag: row.tag,
      count: row.post_count,
    })),
  };
}
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { isSuspended, SUSPENDED_MESSAGE } from "@/features/moderation/guard";
import { checkRateLimit } from "@/features/ratelimit/check";
import { ownCloudinaryImageUrl } from "@/features/uploads/schemas";
import { deleteImages } from "@/features/uploads/server";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { slugifyTitle } from "./slug";

export type SeriesActionResult = { ok: true } | { ok: false; error: string };
// Actions that redirect on success only ever return the failure.
export type SeriesFailure = { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

const titleSchema = z
  .string()
  .trim()
  .min(1, "Give the series a title.")
  .max(80, "The title can have at most 80 characters.");
const descriptionSchema = z
  .string()
  .trim()
  .max(300, "The description can have at most 300 characters.")
  .transform((value) => (value === "" ? null : value));

const createSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  // undefined = leave as it is (update) or no cover (create); null = remove.
  coverUrl: ownCloudinaryImageUrl.nullable().optional(),
});
const updateSchema = createSchema.extend({ id: z.uuid() });
const deleteSchema = z.object({ id: z.uuid() });
const memberSchema = z.object({ seriesId: z.uuid(), postId: z.uuid() });
const moveSchema = memberSchema.extend({ direction: z.enum(["up", "down"]) });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the fields and try again.";
}

type Prepared =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
    }
  | { ok: false; error: string };

// Sign-in, suspension and rate limit, shared by every action that writes.
async function prepare(
  action: "create_series" | "edit_series",
  path: string,
): Promise<Prepared> {
  const user = await requireUser(path);
  if (await isSuspended()) return { ok: false, error: SUSPENDED_MESSAGE };
  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, action);
  if (!limit.ok) return { ok: false, error: limit.error };
  return { ok: true, supabase, userId: user.id };
}

export async function createSeries(input: unknown): Promise<SeriesFailure> {
  const parsed = createSchema.safeParse(input);
  const ctx = await prepare("create_series", "/me/series");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const base = slugifyTitle(parsed.data.title);
  // The address is unique per author: on a clash a number is added.
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await ctx.supabase
      .from("series")
      .insert({
        author_id: ctx.userId,
        slug,
        title: parsed.data.title,
        description: parsed.data.description,
        cover_image_url: parsed.data.coverUrl ?? null,
      })
      .select("id")
      .single();
    if (!error && data) {
      revalidatePath("/me/series");
      redirect(`/me/series/${data.id}`);
    }
    if (error?.code === "23505") continue;
    console.error("createSeries failed:", error);
    reportError("createSeries", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: false, error: GENERIC_ERROR };
}

export async function updateSeries(input: unknown): Promise<SeriesActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, title, description, coverUrl } = parsed.data;
  const ctx = await prepare("edit_series", `/me/series/${id}`);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // The cover that is about to be replaced or removed (deleted after saving).
  let oldCover: string | null = null;
  if (coverUrl !== undefined) {
    const { data: before } = await ctx.supabase
      .from("series")
      .select("cover_image_url")
      .eq("id", id)
      .eq("author_id", ctx.userId)
      .maybeSingle();
    oldCover = before?.cover_image_url ?? null;
  }

  const { data, error } = await ctx.supabase
    .from("series")
    .update({
      title,
      description,
      // undefined leaves the cover as it is; null removes it.
      ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
    })
    .eq("id", id)
    .eq("author_id", ctx.userId)
    .select("id");
  if (error) {
    console.error("updateSeries failed:", error);
    reportError("updateSeries", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Series not found." };
  }
  // Saved: the old cover is no longer used, so it frees storage.
  if (oldCover && oldCover !== coverUrl) {
    await deleteImages([oldCover]);
  }

  revalidatePath(`/me/series/${id}`);
  revalidatePath("/me/series");
  return { ok: true };
}

// Deleting is allowed for a suspended account, like deleting its own posts.
export async function deleteSeries(input: unknown): Promise<SeriesFailure> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const user = await requireUser(`/me/series/${parsed.data.id}`);
  const supabase = await createClient();

  // The cover goes with the series (the stories stay).
  const { data: before } = await supabase
    .from("series")
    .select("cover_image_url")
    .eq("id", parsed.data.id)
    .eq("author_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("series")
    .delete()
    .eq("id", parsed.data.id)
    .eq("author_id", user.id);
  if (error) {
    console.error("deleteSeries failed:", error);
    reportError("deleteSeries", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  // Deleted: the cover is no longer used, so it frees storage.
  await deleteImages([before?.cover_image_url]);

  revalidatePath("/me/series");
  redirect("/me/series");
}

export async function addPostToSeries(
  input: unknown,
): Promise<SeriesActionResult> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { seriesId, postId } = parsed.data;
  const ctx = await prepare("edit_series", `/me/series/${seriesId}`);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: series } = await ctx.supabase
    .from("series")
    .select("id")
    .eq("id", seriesId)
    .eq("author_id", ctx.userId)
    .maybeSingle();
  if (!series) return { ok: false, error: "Series not found." };

  const { data: post } = await ctx.supabase
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .eq("author_id", ctx.userId)
    .maybeSingle();
  if (!post) return { ok: false, error: "Story not found." };
  if (post.status === "hidden") {
    return {
      ok: false,
      error: "A story hidden by moderation cannot be added to a series.",
    };
  }

  const { data: last } = await ctx.supabase
    .from("series_posts")
    .select("position")
    .eq("series_id", seriesId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("series_posts").insert({
    post_id: postId,
    series_id: seriesId,
    position: (last?.position ?? 0) + 1,
  });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "This story is already in a series. Remove it there first.",
      };
    }
    console.error("addPostToSeries failed:", error);
    reportError("addPostToSeries", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath(`/me/series/${seriesId}`);
  return { ok: true };
}

// Removing is allowed for a suspended account.
export async function removePostFromSeries(
  input: unknown,
): Promise<SeriesActionResult> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { seriesId, postId } = parsed.data;
  await requireUser(`/me/series/${seriesId}`);
  const supabase = await createClient();

  const { error } = await supabase
    .from("series_posts")
    .delete()
    .eq("series_id", seriesId)
    .eq("post_id", postId);
  if (error) {
    console.error("removePostFromSeries failed:", error);
    reportError("removePostFromSeries", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath(`/me/series/${seriesId}`);
  return { ok: true };
}

export async function moveSeriesPost(
  input: unknown,
): Promise<SeriesActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { seriesId, postId, direction } = parsed.data;
  const ctx = await prepare("edit_series", `/me/series/${seriesId}`);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: series } = await ctx.supabase
    .from("series")
    .select("id")
    .eq("id", seriesId)
    .eq("author_id", ctx.userId)
    .maybeSingle();
  if (!series) return { ok: false, error: "Series not found." };

  const { data: rows, error } = await ctx.supabase
    .from("series_posts")
    .select("post_id, position")
    .eq("series_id", seriesId)
    .order("position", { ascending: true })
    .order("post_id", { ascending: true });
  if (error || !rows) {
    console.error("moveSeriesPost read failed:", error);
    reportError("moveSeriesPost read", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const order = rows.map((row) => row.post_id);
  const from = order.indexOf(postId);
  if (from === -1) return { ok: false, error: "Story not found." };
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= order.length) return { ok: true };
  [order[from], order[to]] = [order[to], order[from]];

  // Renumber 1..n and write only the rows whose number changed.
  const current = new Map(rows.map((row) => [row.post_id, row.position]));
  for (let index = 0; index < order.length; index++) {
    const id = order[index];
    const position = index + 1;
    if (current.get(id) === position) continue;
    const { error: updateError } = await ctx.supabase
      .from("series_posts")
      .update({ position })
      .eq("series_id", seriesId)
      .eq("post_id", id);
    if (updateError) {
      console.error("moveSeriesPost write failed:", updateError);
      reportError("moveSeriesPost write", updateError);
      return { ok: false, error: GENERIC_ERROR };
    }
  }
  revalidatePath(`/me/series/${seriesId}`);
  return { ok: true };
}
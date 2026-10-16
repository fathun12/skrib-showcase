"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { LIST_NAME_MAX } from "./limits";

const nameSchema = z.string().trim().min(1).max(LIST_NAME_MAX);
const loadSchema = z.object({ postId: z.uuid() });
const createSchema = z.object({
  name: nameSchema,
  postId: z.uuid().optional(),
});
const membershipSchema = z.object({
  listId: z.uuid(),
  postId: z.uuid(),
  member: z.boolean(),
});
const renameSchema = z.object({ id: z.uuid(), name: nameSchema });
const deleteSchema = z.object({ id: z.uuid() });

export type ListForPost = { id: string; name: string; member: boolean };
export type LoadListsResult =
  | { ok: true; lists: ListForPost[] }
  | { ok: false; error: string };
export type CreateListResult =
  | {
      ok: true;
      list: { id: string; name: string };
      // False when the list was made but adding the story did not work.
      added: boolean;
    }
  | { ok: false; error: string };
export type ListActionResult = { ok: true } | { ok: false; error: string };

type DbError = { code: string; message: string };

// Turns a database error into a short sentence; unexpected ones are reported.
function writeFailure(where: string, error: DbError): string {
  if (error.code === "23505") return "You already have a list with that name.";
  if (error.code === "23514") {
    return error.message.includes("bookmark_list_limit")
      ? "You can have up to 20 lists."
      : "Use 1 to 40 characters.";
  }
  if (error.code === "23503") return "That story or list could not be found.";
  // Only granted columns are written, so 42501 is the suspended-account policy.
  if (error.code === "42501") return "You can't change this right now.";
  console.error(`${where} failed:`, error);
  reportError(where, error);
  return "Could not save. Please try again.";
}

function readFailure(where: string, error: DbError): string {
  console.error(`${where} failed:`, error);
  reportError(where, error);
  return "Could not load your lists.";
}

// The lists of this reader, and which of them hold this story. Called when the
// popover opens. Takes `unknown` on purpose: the input comes from the browser.
export async function loadListsForPost(
  input: unknown,
): Promise<LoadListsResult> {
  const user = await requireUser("/");

  const parsed = loadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That story could not be found." };
  }

  const supabase = await createClient();
  const [lists, items] = await Promise.all([
    supabase
      .from("bookmark_lists")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("bookmark_list_items")
      .select("list_id")
      .eq("user_id", user.id)
      .eq("post_id", parsed.data.postId),
  ]);
  if (lists.error) {
    return { ok: false, error: readFailure("loadListsForPost lists", lists.error) };
  }
  if (items.error) {
    return { ok: false, error: readFailure("loadListsForPost items", items.error) };
  }

  const member = new Set((items.data ?? []).map((row) => row.list_id));
  return {
    ok: true,
    lists: (lists.data ?? []).map((list) => ({
      id: list.id,
      name: list.name,
      member: member.has(list.id),
    })),
  };
}

// Makes a list, and puts the story in it when a story id is given.
export async function createList(input: unknown): Promise<CreateListResult> {
  await requireUser("/");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Use 1 to 40 characters." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "list_manage");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  // user_id is filled by the database from the session.
  const { data, error } = await supabase
    .from("bookmark_lists")
    .insert({ name: parsed.data.name })
    .select("id, name")
    .single();
  if (error) {
    return { ok: false, error: writeFailure("createList insert", error) };
  }

  let added = false;
  if (parsed.data.postId) {
    const { error: itemError } = await supabase
      .from("bookmark_list_items")
      .insert({ list_id: data.id, post_id: parsed.data.postId });
    if (!itemError) {
      added = true;
    } else {
      // The list exists, so this is not a failure of the whole action.
      writeFailure("createList item", itemError);
    }
  }

  return { ok: true, list: { id: data.id, name: data.name }, added };
}

// Sets the wanted state ("in the list" or not) instead of toggling.
export async function setListMembership(
  input: unknown,
): Promise<ListActionResult> {
  const user = await requireUser("/");

  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That story or list could not be found." };
  }
  const { listId, postId, member } = parsed.data;

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "list_manage");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  if (member) {
    const { error } = await supabase
      .from("bookmark_list_items")
      .insert({ list_id: listId, post_id: postId });
    // 23505 = already in the list: the wanted state is reached.
    if (error && error.code !== "23505") {
      return { ok: false, error: writeFailure("setListMembership insert", error) };
    }
  } else {
    // Deleting a row that does not exist is not an error: also "done".
    const { error } = await supabase
      .from("bookmark_list_items")
      .delete()
      .eq("list_id", listId)
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) {
      return { ok: false, error: writeFailure("setListMembership delete", error) };
    }
  }

  return { ok: true };
}

export async function renameList(input: unknown): Promise<ListActionResult> {
  const user = await requireUser("/");

  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Use 1 to 40 characters." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "list_manage");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase
    .from("bookmark_lists")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) {
    return { ok: false, error: writeFailure("renameList", error) };
  }
  return { ok: true };
}

// Deletes the list only; the stories stay in Saved.
export async function deleteList(input: unknown): Promise<ListActionResult> {
  const user = await requireUser("/");

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That list could not be found." };
  }

  const supabase = await createClient();

  const limit = await checkRateLimit(supabase, "list_manage");
  if (!limit.ok) {
    return { ok: false, error: limit.error };
  }

  const { error } = await supabase
    .from("bookmark_lists")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) {
    return { ok: false, error: writeFailure("deleteList", error) };
  }
  return { ok: true };
}
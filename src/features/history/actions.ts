"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import { docSchema, type TiptapNode } from "@/features/posts/schemas";
import { checkRateLimit } from "@/features/ratelimit/check";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import { recordVersion } from "./server";

const NOT_ALLOWED = "You can't use the history of this post right now.";
const GENERIC = "Something went wrong. Please try again.";

const saveSchema = z.object({
  postId: z.uuid(),
  reason: z.enum(["auto", "update", "restore"]),
});

// Called by the editor: after a save (auto, update) and right before a
// restore. Takes `unknown` on purpose: the input comes from the browser.
export async function saveVersion(input: unknown): Promise<{ ok: boolean }> {
  await requireUser("/");

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "post_history");
  if (!limit.ok) return { ok: false };

  const ok = await recordVersion(supabase, parsed.data.postId, parsed.data.reason);
  return { ok };
}

export type VersionListItem = {
  id: string;
  createdAt: string;
  reason: string;
  savedByName: string | null;
  title: string;
  wordCount: number;
};

export type LoadVersionsResult =
  | { ok: true; versions: VersionListItem[] }
  | { ok: false; error: string };

const listSchema = z.object({ postId: z.uuid() });

// The list for the History dialog (no text, so it stays small).
export async function loadVersions(input: unknown): Promise<LoadVersionsResult> {
  await requireUser("/");

  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_post_versions", {
    p_post_id: parsed.data.postId,
  });

  if (error || !data) {
    if (error?.message.includes("history_not_allowed")) {
      return { ok: false, error: NOT_ALLOWED };
    }
    console.error("loadVersions failed:", error);
    reportError("loadVersions", error ?? new Error("empty result"));
    return { ok: false, error: GENERIC };
  }

  return {
    ok: true,
    versions: data.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      reason: row.reason,
      savedByName: row.saved_by_name ?? null,
      title: row.title,
      wordCount: row.word_count,
    })),
  };
}

export type VersionDetail = {
  id: string;
  createdAt: string;
  title: string;
  subtitle: string;
  language: string;
  content: TiptapNode;
};

export type LoadVersionResult =
  | { ok: true; version: VersionDetail }
  | { ok: false; error: string };

const oneSchema = z.object({ versionId: z.uuid() });

// One version in full, for the preview and for Restore.
export async function loadVersion(input: unknown): Promise<LoadVersionResult> {
  await requireUser("/");

  const parsed = oneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_post_version", {
    p_version_id: parsed.data.versionId,
  });

  if (error || !data) {
    if (error?.message.includes("history_not_allowed")) {
      return { ok: false, error: NOT_ALLOWED };
    }
    console.error("loadVersion failed:", error);
    reportError("loadVersion", error ?? new Error("empty result"));
    return { ok: false, error: GENERIC };
  }

  const row = data[0];
  if (!row) return { ok: false, error: "This version no longer exists." };

  // Same check as for any stored text before it reaches the editor.
  const doc = docSchema.safeParse(row.content);
  if (!doc.success) {
    return { ok: false, error: "This version can't be shown." };
  }

  return {
    ok: true,
    version: {
      id: row.id,
      createdAt: row.created_at,
      title: row.title,
      subtitle: row.subtitle ?? "",
      language: row.language,
      content: doc.data,
    },
  };
}
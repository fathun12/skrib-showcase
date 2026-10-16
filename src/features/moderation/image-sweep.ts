"use server";

import { v2 as cloudinary } from "cloudinary";
import { checkRateLimit } from "@/features/ratelimit/check";
import {
  configureCloudinary,
  publicIdFromUrl,
} from "@/features/uploads/server";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

const TAGS = ["post", "cover", "avatar", "note"];
// An image younger than this is never touched: it may belong to a draft that
// is not saved yet.
const GRACE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const MAX_PAGES_PER_TAG = 20;
const DELETE_BATCH = 50;
// Safety brake: if most images look orphaned, something is wrong with the scan.
const BRAKE_MIN_SCANNED = 20;
const BRAKE_RATIO = 0.5;
const GENERIC_ERROR = "Could not scan the images. Please try again.";

export type ImageSweepReport = {
  scanned: number;
  used: number;
  orphans: number;
  bytes: number;
  deleted?: number;
  truncated: boolean;
  // Count and size of every image found, per upload tag.
  byTag: { tag: string; count: number; bytes: number }[];
};

export type ImageSweepResult =
  | { ok: true; report: ImageSweepReport }
  | { ok: false; error: string };

type ListPage = {
  resources?: { public_id: string; created_at: string; bytes?: number }[];
  next_cursor?: string;
};
type DeletePage = { deleted?: Record<string, string> };

// Both modes run the same scan from scratch: the delete never trusts a result
// that the browser sends back.
async function sweep(mode: "preview" | "delete"): Promise<ImageSweepResult> {
  const supabase = await createClient();

  const { data: admin } = await supabase.rpc("am_i_admin");
  if (admin !== true) {
    return { ok: false, error: "Only an administrator can do this." };
  }

  const limit = await checkRateLimit(supabase, "sweep_images");
  if (!limit.ok) return { ok: false, error: limit.error };

  const cloudName = configureCloudinary();
  if (!cloudName) {
    reportError("imageSweep env", new Error("missing Cloudinary env vars"));
    return { ok: false, error: GENERIC_ERROR };
  }

  // 1. Images in use, read BEFORE Cloudinary is listed.
  const { data: rows, error: usedError } = await supabase.rpc(
    "list_used_image_urls",
  );
  if (usedError) {
    console.error("imageSweep used failed:", usedError);
    reportError("imageSweep used", usedError);
    return { ok: false, error: GENERIC_ERROR };
  }
  const used = new Set<string>();
  for (const row of rows ?? []) {
    const id = publicIdFromUrl(row.url, cloudName);
    // Fail closed: an address we cannot read could hide an image in use.
    if (!id || id.includes("/")) {
      reportError("imageSweep url", new Error("unreadable image address"));
      return {
        ok: false,
        error:
          "An image address in the database could not be read, so nothing was scanned or deleted. See Sentry.",
      };
    }
    used.add(id);
  }

  // 2. Images in Cloudinary, found by tag.
  const orphans: string[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  let bytes = 0;
  let truncated = false;
  const perTag = new Map<string, { count: number; bytes: number }>();
  const now = Date.now();

  for (const tag of TAGS) {
    let cursor: string | undefined;
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES_PER_TAG) {
        truncated = true;
        break;
      }
      let res: ListPage;
      try {
        res = (await cloudinary.api.resources_by_tag(tag, {
          resource_type: "image",
          type: "upload",
          max_results: PAGE_SIZE,
          next_cursor: cursor,
        })) as unknown as ListPage;
      } catch (error) {
        console.error("imageSweep list failed:", error);
        reportError("imageSweep list", error);
        return { ok: false, error: GENERIC_ERROR };
      }
      for (const r of res.resources ?? []) {
        if (seen.has(r.public_id)) continue;
        seen.add(r.public_id);
        scanned++;
        const stat = perTag.get(tag) ?? { count: 0, bytes: 0 };
        stat.count++;
        stat.bytes += r.bytes ?? 0;
        perTag.set(tag, stat);
        if (used.has(r.public_id)) continue;
        const created = Date.parse(r.created_at);
        if (!Number.isFinite(created) || now - created < GRACE_MS) continue;
        orphans.push(r.public_id);
        bytes += r.bytes ?? 0;
      }
      cursor = res.next_cursor;
      if (!cursor) break;
    }
  }

  const report: ImageSweepReport = {
    scanned,
    used: used.size,
    orphans: orphans.length,
    bytes,
    truncated,
    byTag: TAGS.map((tag) => ({
      tag,
      ...(perTag.get(tag) ?? { count: 0, bytes: 0 }),
    })),
  };
  if (mode === "preview" || orphans.length === 0) {
    return { ok: true, report };
  }

  // 3. Delete.
  if (used.size === 0) {
    return {
      ok: false,
      error: "The database lists no image in use, so nothing was deleted.",
    };
  }
  if (scanned >= BRAKE_MIN_SCANNED && orphans.length / scanned > BRAKE_RATIO) {
    return {
      ok: false,
      error:
        "More than half of the images look unused, which is unexpected. Nothing was deleted.",
    };
  }

  let deleted = 0;
  for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
    try {
      const res = (await cloudinary.api.delete_resources(
        orphans.slice(i, i + DELETE_BATCH),
      )) as unknown as DeletePage;
      deleted += Object.values(res.deleted ?? {}).filter(
        (status) => status === "deleted",
      ).length;
    } catch (error) {
      console.error("imageSweep delete failed:", error);
      reportError("imageSweep delete", error);
    }
  }
  return { ok: true, report: { ...report, deleted } };
}

export async function previewImageSweep(): Promise<ImageSweepResult> {
  return sweep("preview");
}

export async function deleteOrphanImages(): Promise<ImageSweepResult> {
  return sweep("delete");
}
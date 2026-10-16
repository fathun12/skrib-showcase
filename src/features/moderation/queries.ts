import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import { EMPTY_DOC } from "@/features/posts/queries";
import { docSchema, type TiptapNode } from "@/features/posts/schemas";
import { createClient } from "@/lib/supabase/server";

// Is the signed-in user an admin? Signed-out visitors are never asked.
export const isAdmin = cache(async (): Promise<boolean> => {
  const current = await getCurrentUser();
  if (!current) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_i_admin");
  if (error) {
    console.error("isAdmin failed:", error);
    return false;
  }
  return data === true;
});

// For the admin pages: anyone who is not an admin sees a plain 404, so
// nobody can tell the page exists.
export async function requireAdmin() {
  if (!(await isAdmin())) notFound();
}

export type ReportStatus = "open" | "resolved" | "dismissed";

const reportGroupSchema = z.object({
  post_id: z.uuid(),
  post_title: z.string(),
  post_slug: z.string(),
  post_status: z.string(),
  author_id: z.uuid(),
  author_username: z.string().nullable(),
  author_display_name: z.string(),
  report_count: z.number(),
  reasons: z.array(z.string()),
  latest_report_at: z.string(),
  reports: z.array(
    z.object({
      reason: z.string(),
      details: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});

export type ReportGroup = {
  postId: string;
  title: string;
  slug: string;
  postStatus: string;
  authorId: string;
  authorUsername: string | null;
  authorName: string;
  reportCount: number;
  reasons: string[];
  latestReportAt: string;
  reports: { reason: string; details: string | null; createdAt: string }[];
};

// Reports grouped by post. Returns null when the load fails.
export async function listReportGroups(
  status: ReportStatus,
): Promise<ReportGroup[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_reports", {
    p_status: status,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) {
    console.error("listReportGroups failed:", error);
    return null;
  }

  const parsed = z.array(reportGroupSchema).safeParse(data);
  if (!parsed.success) {
    console.error("listReportGroups bad shape:", parsed.error);
    return null;
  }

  return parsed.data.map((row) => ({
    postId: row.post_id,
    title: row.post_title,
    slug: row.post_slug,
    postStatus: row.post_status,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorName: row.author_display_name,
    reportCount: row.report_count,
    reasons: row.reasons,
    latestReportAt: row.latest_report_at,
    reports: row.reports.map((r) => ({
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
    })),
  }));
}

const hiddenSchema = z.object({
  post_id: z.uuid(),
  post_title: z.string(),
  post_slug: z.string(),
  author_username: z.string().nullable(),
  author_display_name: z.string(),
  hidden_at: z.string().nullable(),
});

export type HiddenPost = {
  postId: string;
  title: string;
  authorUsername: string | null;
  authorName: string;
  hiddenAt: string | null;
};

// Posts that are hidden right now. Returns null when the load fails.
export async function listHiddenPosts(): Promise<HiddenPost[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_hidden_posts", {
    p_limit: 50,
    p_offset: 0,
  });
  if (error) {
    console.error("listHiddenPosts failed:", error);
    return null;
  }

  const parsed = z.array(hiddenSchema).safeParse(data);
  if (!parsed.success) {
    console.error("listHiddenPosts bad shape:", parsed.error);
    return null;
  }

  return parsed.data.map((row) => ({
    postId: row.post_id,
    title: row.post_title,
    authorUsername: row.author_username,
    authorName: row.author_display_name,
    hiddenAt: row.hidden_at,
  }));
}

const reviewSchema = z.object({
  post_id: z.uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  content: z.unknown(),
  status: z.string(),
  language: z.string(),
  author_id: z.uuid(),
  author_username: z.string().nullable(),
  author_display_name: z.string(),
});

export type PostForReview = {
  postId: string;
  title: string;
  subtitle: string;
  content: TiptapNode;
  status: string;
  language: string;
  authorId: string;
  authorUsername: string | null;
  authorName: string;
};

// One post whatever its status (a hidden post has no public page).
// Returns null for a bad id, a missing post or a failed load.
export async function getPostForReview(
  postId: string,
): Promise<PostForReview | null> {
  if (!z.uuid().safeParse(postId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_post", {
    p_post_id: postId,
  });
  if (error) {
    console.error("getPostForReview failed:", error);
    return null;
  }

  const parsed = z.array(reviewSchema).safeParse(data);
  const row = parsed.success ? parsed.data[0] : undefined;
  if (!row) return null;

  const doc = docSchema.safeParse(row.content);
  return {
    postId: row.post_id,
    title: row.title,
    subtitle: row.subtitle ?? "",
    content: doc.success ? doc.data : EMPTY_DOC,
    status: row.status,
    language: row.language,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorName: row.author_display_name,
  };
}

const historySchema = z.object({
  hide_count: z.number(),
  delete_count: z.number(),
});

export type AuthorHistory = { hides: number; deletes: number };

// How many posts of this author were hidden or deleted before (for the
// history line on the review page). Returns null when the load fails.
export async function getAuthorHistory(
  authorId: string,
): Promise<AuthorHistory | null> {
  if (!z.uuid().safeParse(authorId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_author_history", {
    p_author_id: authorId,
  });
  if (error) {
    console.error("getAuthorHistory failed:", error);
    return null;
  }

  const parsed = z.array(historySchema).safeParse(data);
  const row = parsed.success ? parsed.data[0] : undefined;
  if (!row) return null;

  return { hides: row.hide_count, deletes: row.delete_count };
}
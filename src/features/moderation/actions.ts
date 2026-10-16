"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendEmail } from "@/features/email/brevo";
import { buildModerationMail } from "@/features/email/moderation-mail";
import { isAdmin } from "@/features/moderation/queries";
import {
  moderationNoteSchema,
  moderationReasonSchema,
  suspensionDaysSchema,
} from "@/features/moderation/schemas";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";
import type { ReportReason } from "@/ui/post/report-reasons";

const moderateSchema = z.object({
  postId: z.uuid(),
  action: z.enum(["hide", "delete", "restore", "dismiss"]),
  reason: moderationReasonSchema.optional(),
  note: moderationNoteSchema,
});

export type ModerationAction = z.infer<typeof moderateSchema>["action"];

export type ModeratePostResult = { ok: true } | { ok: false; error: string };

// Best effort (decision D12): the database action is already committed, so
// every failure here is logged and swallowed. Never logs the address.
async function mailAuthor(input: {
  authorId: string;
  title: string;
  action:
    | "hide"
    | "delete"
    | "suspend"
    | "comment_delete"
    | "series_delete"
    | "note_hide"
    | "note_delete";
  reason: ReportReason;
  note?: string;
  // End of a timed suspension (ISO text); null or missing = until lifted.
  until?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data: address, error } = await supabase.rpc("admin_prepare_email", {
      p_user_id: input.authorId,
      p_kind: "moderation",
    });
    if (error) {
      reportError("moderatePost mail", error);
      return;
    }
    // No address: unconfirmed account, unknown kind, or the daily cap is reached.
    if (!address) return;

    const mail = buildModerationMail({
      action: input.action,
      title: input.title,
      reason: input.reason,
      note: input.note,
      until: input.until,
    });
    await sendEmail({
      to: address,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch {
    reportError("moderatePost mail", new Error("moderation mail failed"));
  }
}

// Takes `unknown` on purpose: the input comes from the browser.
export async function moderatePost(input: unknown): Promise<ModeratePostResult> {
  const parsed = moderateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This request is not valid." };
  }

  const { postId, action, reason, note } = parsed.data;
  const negative = action === "hide" || action === "delete";
  if (negative && !reason) {
    return { ok: false, error: "Choose a reason first." };
  }

  // The check lives in the action too (anybody can call an action directly).
  // The database checks again inside admin_moderate_post.
  if (!(await isAdmin())) {
    return { ok: false, error: "You are not allowed to do this." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_moderate_post", {
    p_post_id: postId,
    p_action: action,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("reason_required")) {
      return { ok: false, error: "Choose a reason first." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    if (error.message.includes("moderation_not_published")) {
      return { ok: false, error: "Only a published post can be hidden." };
    }
    if (error.message.includes("moderation_not_hidden")) {
      return { ok: false, error: "This post is not hidden." };
    }
    if (error.message.includes("post_not_found")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This post no longer exists." };
    }
    console.error("moderatePost failed:", error);
    reportError("moderatePost", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/moderation", "layout");

  // Mail only for the negative actions (D11). After a delete the post is gone,
  // so the author and the title come from the RPC result.
  const row = data?.[0];
  if (row && reason && (action === "hide" || action === "delete")) {
    await mailAuthor({
      authorId: row.author_id,
      title: row.post_title,
      action,
      reason,
      note,
    });
  }

  return { ok: true };
}

const suspendSchema = z.object({
  userId: z.uuid(),
  reason: moderationReasonSchema,
  note: moderationNoteSchema,
  // 1, 7 or 30 days; empty means until an admin lifts it.
  days: suspensionDaysSchema,
});

const unsuspendSchema = z.object({
  userId: z.uuid(),
  note: moderationNoteSchema,
});

export async function suspendUser(input: unknown): Promise<ModeratePostResult> {
  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Choose a reason first." };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: "You are not allowed to do this." };
  }

  const { userId, reason, note, days } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_suspend_user", {
    p_user_id: userId,
    p_reason: reason,
    p_note: note,
    p_days: days ?? undefined,
  });

  if (error) {
    if (error.message.includes("invalid_duration")) {
      return { ok: false, error: "Choose 1, 7 or 30 days, or until lifted." };
    }
    if (error.message.includes("cannot_suspend_admin")) {
      return { ok: false, error: "An admin cannot be suspended." };
    }
    if (error.message.includes("already_suspended")) {
      return { ok: false, error: "This account is already suspended." };
    }
    if (error.message.includes("user_not_found")) {
      return { ok: false, error: "This account no longer exists." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    console.error("suspendUser failed:", error);
    reportError("suspendUser", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/moderation", "layout");

  // The action is committed; the mail is best effort (D12). No post, so no title.
  // The function returns the end time (null = until lifted).
  const until = typeof data === "string" ? data : null;
  await mailAuthor({
    authorId: userId,
    title: "",
    action: "suspend",
    reason,
    note,
    until,
  });
  return { ok: true };
}

export async function unsuspendUser(input: unknown): Promise<ModeratePostResult> {
  const parsed = unsuspendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This request is not valid." };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: "You are not allowed to do this." };
  }

  const { userId, note } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unsuspend_user", {
    p_user_id: userId,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("not_suspended")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This account is not suspended." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    console.error("unsuspendUser failed:", error);
    reportError("unsuspendUser", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/moderation", "layout");
  return { ok: true };
}

const moderateCommentSchema = z.object({
  commentId: z.uuid(),
  action: z.enum(["delete", "dismiss"]),
  reason: moderationReasonSchema.optional(),
  note: moderationNoteSchema,
});

export async function moderateComment(
  input: unknown,
): Promise<ModeratePostResult> {
  const parsed = moderateCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This request is not valid." };
  }

  const { commentId, action, reason, note } = parsed.data;
  if (action === "delete" && !reason) {
    return { ok: false, error: "Choose a reason first." };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: "You are not allowed to do this." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_moderate_comment", {
    p_comment_id: commentId,
    p_action: action,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("reason_required")) {
      return { ok: false, error: "Choose a reason first." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    if (error.message.includes("comment_not_found")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This comment no longer exists." };
    }
    console.error("moderateComment failed:", error);
    reportError("moderateComment", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/moderation", "layout");

  // Mail only for a delete (D11). The comment is gone, so the author and the
  // snippet come from the RPC result.
  const row = data?.[0];
  if (action === "delete" && reason && row) {
    await mailAuthor({
      authorId: row.author_id,
      title: row.snippet,
      action: "comment_delete",
      reason,
      note,
    });
  }
  return { ok: true };
}

const moderateSeriesSchema = z.object({
  seriesId: z.uuid(),
  action: z.enum(["delete", "dismiss"]),
  reason: moderationReasonSchema.optional(),
  note: moderationNoteSchema,
});

export async function moderateSeries(
  input: unknown,
): Promise<ModeratePostResult> {
  const parsed = moderateSeriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This request is not valid." };
  }

  const { seriesId, action, reason, note } = parsed.data;
  if (action === "delete" && !reason) {
    return { ok: false, error: "Choose a reason first." };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: "You are not allowed to do this." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_moderate_series", {
    p_series_id: seriesId,
    p_action: action,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("reason_required")) {
      return { ok: false, error: "Choose a reason first." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    if (error.message.includes("series_not_found")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This series no longer exists." };
    }
    console.error("moderateSeries failed:", error);
    reportError("moderateSeries", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/moderation", "layout");

  // Mail only for a delete. The series is gone, so the author and the title
  // come from the RPC result.
  const row = data?.[0];
  if (action === "delete" && reason && row) {
    await mailAuthor({
      authorId: row.author_id,
      title: row.title,
      action: "series_delete",
      reason,
      note,
    });
  }
  return { ok: true };
}


const moderateNoteSchema = z.object({
  noteId: z.uuid(),
  action: z.enum(["hide", "delete", "dismiss", "restore"]),
  reason: moderationReasonSchema.optional(),
  note: moderationNoteSchema,
});

export async function moderateNote(
  input: unknown,
): Promise<ModeratePostResult> {
  const parsed = moderateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This request is not valid." };
  }

  const { noteId, action, reason, note } = parsed.data;
  if ((action === "hide" || action === "delete") && !reason) {
    return { ok: false, error: "Choose a reason first." };
  }
  if (!(await isAdmin())) {
    return { ok: false, error: "You are not allowed to do this." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_moderate_note", {
    p_note_id: noteId,
    p_action: action,
    p_reason: reason,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("reason_required")) {
      return { ok: false, error: "Choose a reason first." };
    }
    if (error.message.includes("invalid_note")) {
      return { ok: false, error: "The note is too long." };
    }
    if (error.message.includes("no_open_reports")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "These reports were already handled." };
    }
    if (error.message.includes("note_not_hidden")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This note is not hidden." };
    }
    if (error.message.includes("note_already_hidden")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This note is already hidden." };
    }
    if (error.message.includes("note_not_found")) {
      revalidatePath("/admin/moderation", "layout");
      return { ok: false, error: "This note no longer exists." };
    }
    console.error("moderateNote failed:", error);
    reportError("moderateNote", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/moderation", "layout");
  revalidatePath("/");
  revalidatePath(`/notes/${noteId}`);

  // Mail only for hide and delete (the decision), never for a dismiss. The
  // writer and the snippet come from the RPC result.
  const row = data?.[0];
  if ((action === "hide" || action === "delete") && reason && row) {
    await mailAuthor({
      authorId: row.author_id,
      title: row.snippet,
      action: action === "hide" ? "note_hide" : "note_delete",
      reason,
      note,
    });
  }
  return { ok: true };
}
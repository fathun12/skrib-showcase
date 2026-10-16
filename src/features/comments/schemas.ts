import { z } from "zod";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";

// Keep in sync with comments_body_length in migration 0021.
export const COMMENT_MAX = 1000;

// Keep in sync with comments_quote_length in migration 0069.
export const COMMENT_QUOTE_MAX = 300;

export const addCommentSchema = z
  .object({
    postId: z.uuid(),
    // Missing = top-level comment; present = reply to a top-level comment.
    parentId: z.uuid().optional(),
    // Only the ends are trimmed; line breaks inside are kept.
    body: z.string().trim().min(1).max(COMMENT_MAX),
    // Respond: a passage of the story. Checked against the story text by the
    // action. Only top-level comments carry one.
    quote: z.string().trim().min(1).max(COMMENT_QUOTE_MAX).optional(),
  })
  .refine((data) => !(data.parentId && data.quote), {
    message: "A reply cannot carry a quote.",
    path: ["quote"],
  });

export const deleteCommentSchema = z.object({
  commentId: z.uuid(),
});

export const reportCommentSchema = z.object({
  commentId: z.uuid(),
  reason: z.enum(REPORT_REASON_VALUES),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
});
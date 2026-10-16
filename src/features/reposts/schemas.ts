import { z } from "zod";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";

// Keep in sync with reposts_caption_length in migration 0027.
export const REPOST_CAPTION_MAX = 280;

// A caption is one plain paragraph: line breaks and runs of spaces become one
// space, the ends are trimmed, then 1 to 280 characters are required. The
// first max(2000) only stops a huge paste before it is processed.
// One paragraph: line breaks and runs of whitespace become one space and the
// ends are trimmed. The browser uses it too, to show the caption at once.
export function normalizeRepostCaption(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export const repostCaptionSchema = z
  .string()
  .max(2000)
  .transform(normalizeRepostCaption)
  .pipe(z.string().min(1).max(REPOST_CAPTION_MAX));

// A caption is identified by who reposted (reposterId) and which post.
export const reportRepostCaptionSchema = z.object({
  reposterId: z.uuid(),
  postId: z.uuid(),
  reason: z.enum(REPORT_REASON_VALUES),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
});
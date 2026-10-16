import type { ModerationNoticeAction } from "@/features/notifications/queries";
import { formatSuspensionEnd } from "@/ui/moderation/suspension-durations";
import {
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/ui/post/report-reasons";

type Notice = {
  action: ModerationNoticeAction;
  subject: string | null;
  reason: string | null;
  // End of a timed suspension (ISO text); only used by "suspended".
  until?: string | null;
};

const NEGATIVE = new Set<ModerationNoticeAction>([
  "hidden",
  "deleted",
  "suspended",
  "comment_deleted",
  "series_deleted",
  "note_hidden",
  "note_deleted",
]);

// The negative notices carry the line about writing to us.
export function isNegativeNotice(action: ModerationNoticeAction): boolean {
  return NEGATIVE.has(action);
}

function because(reason: string | null): string {
  if (!reason) return "";
  const label = REPORT_REASON_LABELS[reason as ReportReason];
  return label ? `: ${label.toLowerCase()}` : "";
}

// The sentence of a notice. Never names the moderator.
export function moderationSentence(notice: Notice): string {
  const subject = notice.subject?.trim() || "Untitled";
  switch (notice.action) {
    case "hidden":
      return `Your post «${subject}» was hidden${because(notice.reason)}.`;
    case "deleted":
      return `Your post «${subject}» was deleted${because(notice.reason)}.`;
    case "restored":
      return `Your post «${subject}» was restored and is public again.`;
    case "suspended": {
      const ends = notice.until
        ? ` The suspension ends on ${formatSuspensionEnd(notice.until)}.`
        : "";
      return `Your account was suspended${because(notice.reason)}.${ends} You can still read and delete your own posts.`;
    }
    case "unsuspended":
      return "Your suspension was lifted.";
    case "comment_deleted":
      return `Your comment «${subject}» was deleted${because(notice.reason)}.`;
    case "series_deleted":
      return `Your series «${subject}» was deleted${because(notice.reason)}. Your stories are not affected.`;
    case "note_hidden":
      return `Your note «${subject}» was hidden${because(notice.reason)}.`;
    case "note_deleted":
      return `Your note «${subject}» was deleted${because(notice.reason)}.`;
    case "note_restored":
      return `Your note «${subject}» was restored and is public again.`;
    case "report_reviewed":
      return "We reviewed your report about a note. Thank you.";
  }
}
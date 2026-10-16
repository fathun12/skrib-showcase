import { CONTACT_EMAIL } from "@/lib/contact";
import { SITE_URL } from "@/lib/site";
import { formatSuspensionEnd } from "@/ui/moderation/suspension-durations";
import {
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/ui/post/report-reasons";

type ModerationMailInput = {
  action:
    | "hide"
    | "delete"
    | "suspend"
    | "comment_delete"
    | "series_delete"
    | "note_hide"
    | "note_delete";
  // Post title or comment snippet. Not used for "suspend" (a whole account).
  title: string;
  reason: ReportReason;
  note?: string;
  // End of a timed suspension (ISO text); null or missing = until lifted.
  until?: string | null;
};

type Copy = {
  subject: string;
  heading: string;
  intro: string;
  detail: string;
};

// Colors and fonts follow globals.css (light theme). Mail clients ignore
// CSS variables and web fonts, so the values are written out here.
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function copyFor(input: ModerationMailInput): Copy {
  switch (input.action) {
    case "hide":
      return {
        subject: "Your post was hidden on Skrib",
        heading: "Your post was hidden",
        intro: `Your post “${input.title}” was hidden on Skrib.`,
        detail: "A hidden post is no longer visible to readers.",
      };
    case "delete":
      return {
        subject: "Your post was deleted on Skrib",
        heading: "Your post was deleted",
        intro: `Your post “${input.title}” was deleted from Skrib.`,
        detail: "A deleted post cannot be restored.",
      };
    case "suspend": {
      const end = input.until ? formatSuspensionEnd(input.until) : null;
      return {
        subject: "Your Skrib account was suspended",
        heading: "Your account was suspended",
        intro: end
          ? `Your Skrib account was suspended until ${end}.`
          : "Your Skrib account was suspended.",
        detail: end
          ? "You can still sign in, read, and delete your own posts and comments. You cannot publish, comment, like, follow or repost until the suspension ends."
          : "You can still sign in, read, and delete your own posts and comments. You cannot publish, comment, like, follow or repost until the suspension is lifted.",
      };
    }
    case "comment_delete":
      return {
        subject: "Your comment was deleted on Skrib",
        heading: "Your comment was deleted",
        intro: `Your comment “${input.title}” was deleted from Skrib.`,
        detail:
          "A deleted comment, and any replies to it, cannot be restored.",
      };
    case "note_hide":
      return {
        subject: "Your note was hidden on Skrib",
        heading: "Your note was hidden",
        intro: `Your note “${input.title}” was hidden on Skrib.`,
        detail: "A hidden note is no longer visible to other readers.",
      };
    case "note_delete":
      return {
        subject: "Your note was deleted on Skrib",
        heading: "Your note was deleted",
        intro: `Your note “${input.title}” was deleted from Skrib.`,
        detail: "A deleted note, and any replies to it, cannot be restored.",
      };
    case "series_delete":
      return {
        subject: "Your series was deleted on Skrib",
        heading: "Your series was deleted",
        intro: `Your series “${input.title}” was deleted from Skrib.`,
        detail:
          "Your stories are not affected. A deleted series cannot be restored.",
      };
  }
}

// Everything that comes from a user (title, snippet, note) is escaped.
function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildText(
  copy: Copy,
  reasonLabel: string,
  note: string | undefined,
): string {
  const lines = ["Hello,", "", copy.intro, `Reason: ${reasonLabel}`];
  if (note) lines.push(`Note from the moderators: ${note}`);
  lines.push(
    "",
    copy.detail,
    "",
    `If you think this was a mistake, write to us at ${CONTACT_EMAIL}.`,
    "",
    "The Skrib team",
  );
  return lines.join("\n");
}

function buildHtml(
  copy: Copy,
  reasonLabel: string,
  note: string | undefined,
): string {
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("About my Skrib account")}`;
  const siteLabel = SITE_URL.replace(/^https?:\/\//, "");

  const noteBlock = note
    ? `<div style="margin-top:14px;font-family:${SANS};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#6B6B66;">Note from the moderators</div>` +
      `<div style="margin-top:2px;font-family:${SANS};font-size:15px;line-height:1.5;color:#1A1A1A;">${esc(note).replaceAll("\n", "<br>")}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(copy.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 18px 4px;font-family:${SERIF};font-size:26px;font-weight:700;letter-spacing:-0.02em;color:#1A1A1A;">Skrib</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E8E6E1;border-radius:12px;padding:32px 28px;">
<h1 style="margin:0 0 14px 0;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:700;color:#1A1A1A;">${esc(copy.heading)}</h1>
<p style="margin:0 0 20px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:#1A1A1A;">${esc(copy.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#F1F0EC;border-radius:8px;padding:14px 16px;">
<div style="font-family:${SANS};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#6B6B66;">Reason</div>
<div style="margin-top:2px;font-family:${SANS};font-size:16px;font-weight:600;color:#1A1A1A;">${esc(reasonLabel)}</div>
${noteBlock}
</td></tr></table>
<p style="margin:20px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:#1A1A1A;">${esc(copy.detail)}</p>
<p style="margin:20px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:#1A1A1A;">If you think this was a mistake, tell us.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0 0;"><tr>
<td align="center" bgcolor="#4F46E5" style="border-radius:8px;"><a href="${esc(mailto)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">Write to us</a></td>
</tr></table>
<p style="margin:14px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:#6B6B66;">Or write to ${esc(CONTACT_EMAIL)}.</p>
</td></tr>
<tr><td style="padding:18px 4px 0 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:#6B6B66;">You received this email because of a moderation decision about your Skrib account.<br>The Skrib team · ${esc(siteLabel)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Subject, plain text and HTML of a moderation mail. Never names the admin.
export function buildModerationMail(input: ModerationMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const copy = copyFor(input);
  const reasonLabel = REPORT_REASON_LABELS[input.reason];
  return {
    subject: copy.subject,
    text: buildText(copy, reasonLabel, input.note),
    html: buildHtml(copy, reasonLabel, input.note),
  };
}
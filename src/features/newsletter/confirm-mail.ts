import { SITE_URL } from "@/lib/site";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// The mail that asks a visitor to confirm. It has a button, not a bare
// action: the confirm PAGE asks for one more click (mail scanners open links).
export function buildConfirmMail(input: {
  authorName: string;
  token: string;
}): { subject: string; text: string; html: string } {
  const link = `${SITE_URL}/newsletter/confirm?t=${encodeURIComponent(input.token)}`;
  const subject = `Confirm your subscription to ${input.authorName}`;
  const intro = `Confirm that you want to get new stories from ${input.authorName} by email.`;
  const ignore =
    "If you did not ask for this, ignore this email. You will not be subscribed unless you confirm.";

  const text = [
    "Hello,",
    "",
    intro,
    "",
    `Confirm: ${link}`,
    "",
    ignore,
    "",
    "The Skrib team",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 18px 4px;font-family:${SERIF};font-size:26px;font-weight:700;letter-spacing:-0.02em;color:#1A1A1A;">Skrib.</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E8E6E1;border-radius:12px;padding:32px 28px;">
<h1 style="margin:0 0 14px 0;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:700;color:#1A1A1A;">Confirm your subscription</h1>
<p style="margin:0 0 20px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:#1A1A1A;">${esc(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#4F46E5" style="border-radius:8px;"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">Confirm subscription</a></td>
</tr></table>
<p style="margin:20px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:#6B6B66;">${esc(ignore)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
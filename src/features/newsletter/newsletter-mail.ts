import { cloudinaryImageUrl } from "@/ui/cloudinary-image";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

// The excerpt is cut at a word boundary and ended with an ellipsis.
const EXCERPT_MAX = 280;

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shortExcerpt(value: string): string {
  const clean = oneLine(value);
  if (clean.length <= EXCERPT_MAX) return clean;
  const cut = clean.slice(0, EXCERPT_MAX);
  const space = cut.lastIndexOf(" ");
  const base = space > EXCERPT_MAX * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s.,;:!?-]+$/, "")}…`;
}

// The mail of one new story. One call per recipient (each has his own
// unsubscribe link). No tracking pixel; the only image is the cover.
export function buildNewsletterMail(input: {
  authorName: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  coverUrl?: string | null;
  storyUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const title = oneLine(input.title) || "A new story on Skrib";
  const subtitle = input.subtitle ? oneLine(input.subtitle) : "";
  const excerpt = input.excerpt ? shortExcerpt(input.excerpt) : "";
  const cover = input.coverUrl
    ? cloudinaryImageUrl(input.coverUrl, { width: 1200 })
    : "";
  const footer = `You are getting this because you subscribed to ${input.authorName} on Skrib.`;

  const text = [
    `${input.authorName} published a new story on Skrib.`,
    "",
    title,
    ...(subtitle ? ["", subtitle] : []),
    ...(excerpt ? ["", excerpt] : []),
    "",
    `Read on Skrib: ${input.storyUrl}`,
    "",
    footer,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n");

  const coverRow = cover
    ? `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${esc(cover)}" alt="${esc(title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`
    : "";
  const subtitleHtml = subtitle
    ? `<p style="margin:0 0 16px 0;font-family:${SERIF};font-size:18px;line-height:1.5;color:#6B6B66;">${esc(subtitle)}</p>`
    : "";
  const excerptHtml = excerpt
    ? `<p style="margin:0 0 24px 0;font-family:${SERIF};font-size:17px;line-height:1.65;color:#1A1A1A;">${esc(excerpt)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(excerpt || title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 0 18px 4px;font-family:${SERIF};font-size:26px;font-weight:700;letter-spacing:-0.02em;color:#1A1A1A;">Skrib.</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;">
${coverRow}
<tr><td style="padding:32px 28px;">
<p style="margin:0 0 10px 0;font-family:${SANS};font-size:13px;line-height:1.4;color:#6B6B66;">${esc(input.authorName)}</p>
<h1 style="margin:0 0 14px 0;font-family:${SERIF};font-size:28px;line-height:1.25;font-weight:700;color:#1A1A1A;">${esc(title)}</h1>
${subtitleHtml}${excerptHtml}<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#4F46E5" style="border-radius:8px;"><a href="${esc(input.storyUrl)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">Read on Skrib</a></td>
</tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 4px 0 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:#6B6B66;">${esc(footer)} <a href="${esc(input.unsubscribeUrl)}" style="color:#6B6B66;text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: title, text, html };
}
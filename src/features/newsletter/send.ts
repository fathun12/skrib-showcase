import { sendEmail } from "@/features/email/brevo";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildNewsletterMail } from "./newsletter-mail";

// Recipients asked from the database per round.
const BATCH_SIZE = 100;
// Mails in flight at the same time.
const PARALLEL = 5;
// Safety stop: the daily cap is far lower than 10 rounds of 100.
const MAX_ROUNDS = 10;

// Sends the story of one newsletter_sends row to its active subscribers, one
// mail per person. Server only. Never throws and never logs an address.
// Whatever is left (daily cap used up, a failed mail) stays queued and is
// picked up by the daily cron job.
export async function sendNewsletter(sendId: string): Promise<void> {
  // Local and Preview runs have no Brevo key. Stop BEFORE the database call:
  // next_newsletter_batch reserves slots from the real daily cap, and local
  // and production share one database.
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!siteUrl) return;
  const admin = createAdminClient();
  if (!admin) return;

  try {
    const { data: send } = await admin
      .from("newsletter_sends")
      .select("post_id, author_id")
      .eq("id", sendId)
      .maybeSingle();
    if (!send) return;

    const [{ data: post }, { data: author }] = await Promise.all([
      admin
        .from("posts")
        .select("title, subtitle, slug, excerpt, cover_image_url")
        .eq("id", send.post_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("username, display_name")
        .eq("id", send.author_id)
        .maybeSingle(),
    ]);
    if (!post || !author?.username) return;

    const authorName = author.display_name || author.username;
    const storyUrl = `${siteUrl}/${author.username}/${post.slug}`;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { data, error } = await admin.rpc("next_newsletter_batch", {
        p_send: sendId,
        p_limit: BATCH_SIZE,
      });
      if (error) {
        reportError("sendNewsletter batch", error);
        return;
      }
      const rows = data ?? [];
      if (rows.length === 0) return;

      const failed: string[] = [];
      for (let i = 0; i < rows.length; i += PARALLEL) {
        const chunk = rows.slice(i, i + PARALLEL);
        const results = await Promise.all(
          chunk.map(async (row) => {
            const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe?t=${row.o_token}`;
            const mail = buildNewsletterMail({
              authorName,
              title: post.title,
              subtitle: post.subtitle,
              excerpt: post.excerpt,
              coverUrl: post.cover_image_url,
              storyUrl,
              unsubscribeUrl,
            });
            const result = await sendEmail({
              to: row.o_email,
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
              headers: {
                "List-Unsubscribe": `<${siteUrl}/api/newsletter/unsubscribe?t=${row.o_token}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            });
            return result.ok ? null : row.o_subscription_id;
          }),
        );
        for (const id of results) {
          if (id) failed.push(id);
        }
      }

      if (failed.length > 0) {
        // Free the rows of the mails that did not go out, so a later run
        // tries them again, and stop: asking again now would pick them up
        // at once and use more slots.
        const { error: releaseError } = await admin.rpc(
          "release_newsletter_deliveries",
          { p_send: sendId, p_subscriptions: failed },
        );
        if (releaseError) reportError("sendNewsletter release", releaseError);
        return;
      }
    }
  } catch (error) {
    // The error name only: the message could contain an address.
    const name = error instanceof Error ? error.name : "unknown";
    reportError("sendNewsletter", new Error(`unexpected failure: ${name}`));
  }
}
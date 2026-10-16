import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendNewsletter } from "@/features/newsletter/send";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";

// Same clock as the publish pages: the mails of one run must fit in it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Unconfirmed and unsubscribed rows are kept this long, then deleted.
const KEEP_DAYS = 30;
// Safety stop: far more unfinished sends than this means something is wrong.
const MAX_SENDS_PER_RUN = 20;

// Daily job (vercel.json): continues unfinished newsletter sends (the daily
// cap or a failed mail stopped them) and deletes old subscriber rows.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let sends = 0;
  const { data: open, error: openError } = await admin
    .from("newsletter_sends")
    .select("id")
    .in("status", ["queued", "sending"])
    .order("created_at", { ascending: true })
    .limit(MAX_SENDS_PER_RUN);
  if (openError) {
    reportError("cron newsletter list", openError);
  } else {
    // One after the other: they share the same daily cap.
    for (const row of open ?? []) {
      await sendNewsletter(row.id);
      sends += 1;
    }
  }

  const cutoff = new Date(
    Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const pending = await admin
    .from("newsletter_subscriptions")
    .delete({ count: "exact" })
    .eq("status", "pending")
    .lt("created_at", cutoff);
  if (pending.error) reportError("cron newsletter cleanup pending", pending.error);

  const unsubscribed = await admin
    .from("newsletter_subscriptions")
    .delete({ count: "exact" })
    .eq("status", "unsubscribed")
    .lt("unsubscribed_at", cutoff);
  if (unsubscribed.error) {
    reportError("cron newsletter cleanup unsubscribed", unsubscribed.error);
  }

  return NextResponse.json({
    ok: true,
    sends,
    removedPending: pending.count ?? 0,
    removedUnsubscribed: unsubscribed.count ?? 0,
  });
}
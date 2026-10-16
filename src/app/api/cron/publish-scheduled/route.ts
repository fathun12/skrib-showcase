import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { recordVersion } from "@/features/history/server";
import { sendNewsletter } from "@/features/newsletter/send";
import { isCronAuthorized } from "@/lib/cron-auth";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Stories published per run. The rest waits for the next run.
const MAX_PER_RUN = 25;

// Daily job (vercel.json): publishes the drafts whose scheduled day has come,
// then does for each what the Publish button does after the update: a version,
// the newsletter queue and a refresh of the pages.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: due, error } = await admin.rpc("publish_due_posts", {
    p_limit: MAX_PER_RUN,
  });
  if (error) {
    reportError("cron publish-scheduled", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  for (const row of due ?? []) {
    // A version of the text at the moment of publishing (best effort).
    try {
      await recordVersion(admin, row.o_post_id, "publish");
    } catch (caught) {
      console.error("cron publish-scheduled version failed:", caught);
    }

    // One queue row per story, ever. Best effort, like in publishPost.
    try {
      const { data: sendId, error: queueError } = await admin.rpc(
        "queue_newsletter_send",
        { p_post: row.o_post_id, p_skip: !row.o_send_email },
      );
      if (queueError) {
        reportError("cron publish-scheduled queue", queueError);
      } else if (sendId && row.o_send_email) {
        after(() => sendNewsletter(sendId));
      }
    } catch {
      console.error("cron publish-scheduled queue threw");
    }

    for (const tag of row.o_tags ?? []) {
      revalidatePath(`/tag/${tag}`);
    }
  }
  // The word list behind "Did you mean" learns the stories published today.
  // Best effort: a failure is reported and never stops the job.
  try {
    const { error: wordsError } = await admin.rpc("refresh_search_words");
    if (wordsError) reportError("cron publish-scheduled words", wordsError);
  } catch (caught) {
    console.error("cron publish-scheduled words failed:", caught);
  }

  revalidatePath("/me/posts");

  return NextResponse.json({ ok: true, published: due?.length ?? 0 });
}
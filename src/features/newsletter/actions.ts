"use server";

import { getCurrentUser } from "@/features/auth/queries";
import { sendEmail } from "@/features/email/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
import { buildConfirmMail } from "./confirm-mail";
import { subscribeSchema } from "./schemas";

export type SubscribeResult =
  | { ok: true; state: "subscribed" | "check_inbox" }
  | { ok: false; error: string };

const GENERIC = "Could not subscribe right now. Please try again.";

// Subscribes to an author's newsletter. A signed-in reader is subscribed at
// once with the confirmed account address; a visitor gets a confirmation
// mail. Every "already done / too soon / cap reached" case answers with the
// same neutral text, so nobody can probe who is subscribed.
export async function subscribeToNewsletter(
  input: unknown,
): Promise<SubscribeResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { authorId, email, website } = parsed.data;

  // A bot filled the hidden field: pretend it worked.
  if (website && website.trim() !== "") {
    return { ok: true, state: "check_inbox" };
  }

  const user = await getCurrentUser();

  const admin = createAdminClient();
  if (!admin) {
    reportError("subscribeToNewsletter env", new Error("missing service role env"));
    return { ok: false, error: GENERIC };
  }

  const { data, error } = await admin.rpc("request_newsletter_subscription", {
    p_author: authorId,
    p_email: email ?? "",
    // The generated type says string, but the function accepts NULL (guest).
    p_user: (user?.id ?? null) as string,
  });
  if (error) {
    console.error("subscribeToNewsletter rpc failed:", error);
    reportError("subscribeToNewsletter rpc", error);
    return { ok: false, error: GENERIC };
  }

  const row = data?.[0];
  if (!row) return { ok: false, error: GENERIC };

  switch (row.o_outcome) {
    case "subscribed":
      return { ok: true, state: "subscribed" };
    case "send_confirmation": {
      if (row.o_token && row.o_email && row.o_author_name) {
        const mail = buildConfirmMail({
          authorName: row.o_author_name,
          token: row.o_token,
        });
        // sendEmail never throws and reports its own failures. A failed
        // mail still counts against the cap; the visitor can try again
        // after 24 hours (neutral text either way).
        await sendEmail({
          to: row.o_email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
      }
      return { ok: true, state: "check_inbox" };
    }
    case "wait":
      return { ok: true, state: "check_inbox" };
    case "invalid_email":
      return { ok: false, error: "Enter a valid email address." };
    case "unavailable":
      return {
        ok: false,
        error: "This author is not accepting email subscribers.",
      };
    default:
      return { ok: false, error: GENERIC };
  }
}
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report-error";

// Called by the buttons on the confirm and unsubscribe pages. The page asks
// for a click on purpose: mail scanners open links, but they do not press
// buttons. Both end with a redirect back to the page, which shows the result.
async function run(
  fn: "confirm_newsletter" | "unsubscribe_newsletter",
  path: "/newsletter/confirm" | "/newsletter/unsubscribe",
  formData: FormData,
): Promise<never> {
  const parsed = z.uuid().safeParse(formData.get("t"));
  if (!parsed.success) redirect(path);
  const token = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, { p_token: token });
  if (error) {
    console.error(`${fn} failed:`, error);
    reportError(fn, error);
    redirect(`${path}?t=${token}&r=error`);
  }
  redirect(
    data === "invalid"
      ? `${path}?t=${token}&r=invalid`
      : `${path}?t=${token}`,
  );
}

export async function confirmNewsletterAction(
  formData: FormData,
): Promise<void> {
  await run("confirm_newsletter", "/newsletter/confirm", formData);
}

export async function unsubscribeNewsletterAction(
  formData: FormData,
): Promise<void> {
  await run("unsubscribe_newsletter", "/newsletter/unsubscribe", formData);
}
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report-error";

export type TokenInfo = {
  authorName: string;
  authorUsername: string;
  status: "pending" | "active" | "unsubscribed";
};

// Looks up what a mail link points to. The token is the credential and is
// never shown back. null = unknown, malformed or a failed lookup.
export async function getNewsletterTokenInfo(
  raw: string | undefined,
): Promise<TokenInfo | null> {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_newsletter_token_info", {
    p_token: parsed.data,
  });
  if (error) {
    console.error("getNewsletterTokenInfo failed:", error);
    reportError("getNewsletterTokenInfo", error);
    return null;
  }
  const row = data?.[0];
  if (
    !row ||
    (row.o_status !== "pending" &&
      row.o_status !== "active" &&
      row.o_status !== "unsubscribed")
  ) {
    return null;
  }
  return {
    authorName: row.o_author_name,
    authorUsername: row.o_author_username,
    status: row.o_status,
  };
}
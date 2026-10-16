import { createClient } from "@/lib/supabase/server";

// Does this author accept email subscribers? anon may read this one column.
// False on any failure, so the button stays hidden instead of misleading.
export async function getNewsletterEnabled(authorId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("newsletter_enabled")
    .eq("id", authorId)
    .maybeSingle();
  if (error) {
    console.error("getNewsletterEnabled failed:", error);
    return false;
  }
  return data?.newsletter_enabled === true;
}

// Active email subscribers of the signed-in viewer (the count only, never
// the addresses). The function uses auth.uid(), so it is always the viewer's
// own list. 0 on any failure, so the Publish checkbox stays hidden.
export async function getMySubscriberCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_newsletter_subscriber_count");
  if (error) {
    console.error("getMySubscriberCount failed:", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

// Is the signed-in viewer an active email subscriber of this author? Matches
// by account or by the confirmed account address. False when signed out or on
// any failure, so the button simply stays on "Subscribe".
export async function getMyNewsletterStatus(authorId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_newsletter_status", {
    p_author: authorId,
  });
  if (error) {
    console.error("getMyNewsletterStatus failed:", error);
    return false;
  }
  return data === "active";
}
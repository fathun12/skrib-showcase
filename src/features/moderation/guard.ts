import { createClient } from "@/lib/supabase/server";

export const SUSPENDED_MESSAGE =
  "Your account is suspended, so you cannot do this. You can still read and delete your own posts.";

// True when the signed-in user is suspended. On an error it returns false:
// the database (restrictive policies) refuses the write anyway.
export async function isSuspended(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_i_suspended");
  if (error) {
    console.error("isSuspended failed:", error);
    return false;
  }
  return data === true;
}

// When the current suspension ends (ISO text). null when the account is not
// suspended, when the suspension lasts until an admin lifts it, or on an error.
export async function getSuspensionEnd(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_suspension_until");
  if (error) {
    console.error("getSuspensionEnd failed:", error);
    return null;
  }
  return data ?? null;
}
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Client with the service role key. SERVER ONLY: never import it from a
// client component and never expose the key through NEXT_PUBLIC_*.
// It bypasses RLS, so it is used only for the newsletter functions that
// are granted to service_role alone (subscribe, send, cron).
// Returns null when the key is not set (the caller says "not available").
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
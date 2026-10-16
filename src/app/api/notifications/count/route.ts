import { getCurrentUser } from "@/features/auth/queries";
import { getUnreadCount } from "@/features/notifications/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import { createClient } from "@/lib/supabase/server";

// The number for the bell, asked for by the header once a minute while a
// tab is open (HeaderLive). Never cached: it must be the current number.
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const current = await getCurrentUser();
  // Signed out: nothing to count (the header shows no bell then).
  if (!current) {
    return Response.json({ count: 0 }, { status: 401, headers: NO_STORE });
  }

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "notifications_count");
  // HeaderLive ignores any answer that is not ok and keeps the old number.
  if (!limit.ok) {
    return Response.json(
      { error: limit.error },
      { status: 429, headers: NO_STORE },
    );
  }

  const count = await getUnreadCount(current.id);
  return Response.json({ count }, { headers: NO_STORE });
}
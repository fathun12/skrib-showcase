import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import { checkRateLimit } from "@/features/ratelimit/check";
import {
  classifyProgress,
  roundProgress,
} from "@/features/reading-progress/rules";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase/server";

// A route handler (not a server action) because the browser also sends the
// place while the page is closing (fetch with keepalive), which a server
// action cannot do.
const NO_STORE = { "Cache-Control": "no-store" };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const saveSchema = z.object({
  postId: z.uuid(),
  progress: z.number().min(0).max(1),
});
const removeSchema = z.object({ postId: z.uuid() });

function reply(body: { ok: boolean; error?: string }, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

// JSON only: a cross-site form cannot send this content type without a
// preflight request, so other sites cannot write places for a reader.
async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function remove(supabase: ServerClient, userId: string, postId: string) {
  const { error } = await supabase
    .from("reading_progress")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);
  if (error) {
    console.error("reading progress delete failed:", error);
    reportError("removeReadingProgress", error);
    return reply({ ok: false }, 500);
  }
  return reply({ ok: true });
}

// Saves the place. Below 5% nothing happens; from 95% the story is finished
// and the row is removed.
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return reply({ ok: false }, 401);

  const parsed = saveSchema.safeParse(await readJson(request));
  if (!parsed.success) return reply({ ok: false }, 400);

  const { postId } = parsed.data;
  const progress = roundProgress(parsed.data.progress);
  const kind = classifyProgress(progress);
  if (kind === "ignore") return reply({ ok: true });

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "reading_progress");
  if (!limit.ok) return reply({ ok: false, error: limit.error }, 429);

  if (kind === "finished") return remove(supabase, current.id, postId);

  const { error } = await supabase.rpc("save_reading_progress", {
    p_post_id: postId,
    p_progress: progress,
  });
  if (error) {
    // 42501: the rules refused (own story, co-author, not published).
    // 23503: the story is gone. Both mean "nothing to remember".
    if (error.code === "42501" || error.code === "23503") {
      return reply({ ok: true });
    }
    console.error("saveReadingProgress failed:", error);
    reportError("saveReadingProgress", error);
    return reply({ ok: false }, 500);
  }
  return reply({ ok: true });
}

// Forgets the place ("Start over", and later the cross on the Saved list).
export async function DELETE(request: Request) {
  const current = await getCurrentUser();
  if (!current) return reply({ ok: false }, 401);

  const parsed = removeSchema.safeParse(await readJson(request));
  if (!parsed.success) return reply({ ok: false }, 400);

  const supabase = await createClient();
  const limit = await checkRateLimit(supabase, "reading_progress");
  if (!limit.ok) return reply({ ok: false, error: limit.error }, 429);

  return remove(supabase, current.id, parsed.data.postId);
}
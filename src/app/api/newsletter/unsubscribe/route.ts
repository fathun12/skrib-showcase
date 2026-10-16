import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report-error";

// One-click unsubscribe (RFC 8058): a mail app POSTs to the address in the
// List-Unsubscribe header. The token in the address is the credential.
export async function POST(request: Request) {
  const token = z
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("t"));
  if (!token.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsubscribe_newsletter", {
    p_token: token.data,
  });
  if (error) {
    console.error("unsubscribe route failed:", error);
    reportError("unsubscribe route", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json(
    { ok: data !== "invalid" },
    { status: data === "invalid" ? 400 : 200 },
  );
}
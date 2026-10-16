import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  id: z.uuid(),
  received_on: z.string(),
  requester: z.string(),
  reference: z.string().nullable(),
  kind: z.string(),
  summary: z.string(),
  note_id: z.uuid().nullable(),
  user_id: z.uuid().nullable(),
  created_at: z.string(),
});

export type DisclosureItem = {
  id: string;
  receivedOn: string;
  requester: string;
  reference: string | null;
  kind: string;
  summary: string;
  noteId: string | null;
  userId: string | null;
  createdAt: string;
};

// The disclosure log, newest first. Returns null on a failed load.
export async function listDisclosures(): Promise<DisclosureItem[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_disclosures", {
    p_limit: 100,
    p_offset: 0,
  });
  if (error) {
    console.error("listDisclosures failed:", error);
    return null;
  }
  const parsed = z.array(rowSchema).safeParse(data);
  if (!parsed.success) {
    console.error("listDisclosures bad shape:", parsed.error);
    return null;
  }
  return parsed.data.map((row) => ({
    id: row.id,
    receivedOn: row.received_on,
    requester: row.requester,
    reference: row.reference,
    kind: row.kind,
    summary: row.summary,
    noteId: row.note_id,
    userId: row.user_id,
    createdAt: row.created_at,
  }));
}
import { createClient } from "@/lib/supabase/server";

// Language of the author's most recently touched post, so a new draft starts
// with the language they used last. Null when they have no post yet.
export async function getLastLanguage(authorId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("language")
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.language;
}
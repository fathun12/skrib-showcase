// Browser-side reads of a shared post's text, used by the edit-lock hook.
// RLS lets the owner and accepted co-authors read the post (migration 0009),
// so the browser client is enough here. Import only from client components.
//
// Do not import from features/posts/queries.ts here: that file pulls in the
// server Supabase client and must not reach the browser bundle.

import type { TiptapNode } from "@/features/posts/schemas";
import { createClient } from "@/lib/supabase/client";

export type SharedText = {
  title: string;
  // Empty string when the post has no subtitle.
  subtitle: string;
  content: TiptapNode;
    language?: string;
  // Used as a version: it changes on every save.
  updatedAt: string;
};

// A cheap check (one small column) to see whether the text changed.
export async function fetchPostVersion(postId: string): Promise<string | null> {
  try {
    const { data, error } = await createClient()
      .from("posts")
      .select("updated_at")
      .eq("id", postId)
      .maybeSingle();
    if (error) {
      console.error("fetchPostVersion failed:", error);
      return null;
    }
    return data ? String(data.updated_at) : null;
  } catch (error) {
    console.error("fetchPostVersion threw:", error);
    return null;
  }
}

// Loads title, subtitle and content. Null when anything goes wrong.
export async function fetchSharedText(
  postId: string,
): Promise<SharedText | null> {
  try {
    const { data, error } = await createClient()
      .from("posts")
      .select("title, subtitle, content, language, updated_at")
      .eq("id", postId)
      .maybeSingle();
    if (error) {
      console.error("fetchSharedText failed:", error);
      return null;
    }
    if (!data) return null;

    const content = data.content;
    if (typeof content !== "object" || content === null || Array.isArray(content)) {
      console.error("fetchSharedText: content is not a document object");
      return null;
    }

    return {
      title: data.title,
      subtitle: data.subtitle ?? "",
      language: data.language,
      content: content as unknown as TiptapNode,
      updatedAt: String(data.updated_at),
    };
  } catch (error) {
    console.error("fetchSharedText threw:", error);
    return null;
  }
}
"use client";

import dynamic from "next/dynamic";
import type { OwnPost } from "@/features/posts/queries";

// Why: keeps all Tiptap code out of the bundles of pages that only read articles.
const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <p className="text-muted-foreground">Loading editor...</p>,
});

type Props = {
  // Missing on /write (new draft), present on /write/[id] (existing draft).
  initialPost?: OwnPost;
  // The viewer. Used by the Publish dialog to preview the public address.
  username: string;
  // "coauthor" and "editor" edit drafts with the pen but cannot publish.
  // Default: owner.
  role?: "owner" | "coauthor" | "editor";
  // Username of the post's author (for the View link). Default: the viewer.
  ownerUsername?: string;
  // The post has at least one accepted co-author, so it uses the edit lock.
  shared?: boolean;
  // The owner only: the post has an accepted editor to hand the story to.
  hasEditor?: boolean;
  // An editor whom the author allowed to publish this story.
  canPublish?: boolean;
  // New draft only: the language of the author's last post.
  defaultLanguage?: string;
  // Active email subscribers of the author; 0 hides the newsletter checkbox.
  subscriberCount?: number;
};

export function EditorLoader({
  initialPost,
  username,
  role,
  ownerUsername,
  shared,
  hasEditor,
  canPublish,
  defaultLanguage,
  subscriberCount,
}: Props) {
  return (
    <Editor
      initialPost={initialPost}
      username={username}
      role={role}
      ownerUsername={ownerUsername}
      shared={shared}
      hasEditor={hasEditor}
      canPublish={canPublish}
      defaultLanguage={defaultLanguage}
      subscriberCount={subscriberCount}
    />
  );
}
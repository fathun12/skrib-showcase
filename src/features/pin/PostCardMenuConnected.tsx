"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProfileMenu, type ProfileMenuItem } from "@/ui/profile/ProfileMenu";
import { setPinnedPost } from "./actions";

type Props = {
  postId: string;
  pinned: boolean;
};

// Hidden until hover or keyboard focus on a mouse device; always visible on
// touch screens (no hover there). Stays visible while the menu is open.
export const HOVER_REVEAL =
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:has-[[aria-expanded=true]]:opacity-100";

// The "..." menu on one of my own story cards: Edit and Pin / Unpin.
export function PostCardMenuConnected({ postId, pinned }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function togglePin() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setPinnedPost({
          postId: pinned ? null : postId,
        });
        if (result.ok) {
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        // A network failure must not crash the page.
        setError("Could not save. Please try again.");
      }
    });
  }

  const items: ProfileMenuItem[] = [
    { label: "Edit", onSelect: () => router.push(`/write/${postId}`) },
    {
      label: pinned ? "Unpin" : "Pin to profile",
      onSelect: togglePin,
    },
  ];

  return (
    <div className="flex flex-col items-end gap-1">
      <ProfileMenu
        items={items}
        label="Story options"
        disabled={pending}
        className={HOVER_REVEAL}
      />
      {pending ? (
        <p role="status" className="text-xs text-muted-foreground">
          Saving...
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
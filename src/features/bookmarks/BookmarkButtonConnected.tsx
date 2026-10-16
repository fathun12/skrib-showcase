"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkButton } from "@/ui/post/BookmarkButton";
import { ListPopoverConnected } from "@/features/lists/ListPopoverConnected";
import {
  removeStoryOffline,
  saveStoryOffline,
} from "@/features/offline/storyCache";
import { setBookmark } from "./actions";

type Props = {
  postId: string;
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  initialSaved: boolean;
  signedIn: boolean;
};

export function BookmarkButtonConnected({
  postId,
  returnPath,
  initialSaved,
  signedIn,
}: Props) {
  const router = useRouter();
  // Shows the new state at once; if the action fails (or ends) React falls
  // back to the real value from the server.
  const [saved, setOptimisticSaved] = useOptimistic<boolean, boolean>(
    initialSaved,
    (_current, next) => next,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    const next = !saved;
    setError(null);
    startTransition(async () => {
      setOptimisticSaved(next);
      try {
        const result = await setBookmark({ postId, save: next });
        if (!result.ok) setError(result.error);
        else if (next) void saveStoryOffline(returnPath);
        else void removeStoryOffline(returnPath);
      } catch {
        setError("Could not update. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center">
        <BookmarkButton
          saved={saved}
          pending={pending}
          onToggle={handleToggle}
        />
        {saved && signedIn ? <ListPopoverConnected postId={postId} /> : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
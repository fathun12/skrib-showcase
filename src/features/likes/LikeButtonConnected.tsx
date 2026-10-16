"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LikeButton } from "@/ui/post/LikeButton";
import { setLike } from "./actions";

type Props = {
  postId: string;
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  initialLiked: boolean;
  initialCount: number;
  signedIn: boolean;
};

type LikeState = { liked: boolean; count: number };

export function LikeButtonConnected({
  postId,
  returnPath,
  initialLiked,
  initialCount,
  signedIn,
}: Props) {
  const router = useRouter();
  // The optimistic state shows the new heart and count at once; if the action
  // fails (or when it ends) React falls back to the real values from the server.
  const [state, setOptimisticState] = useOptimistic<LikeState, boolean>(
    { liked: initialLiked, count: initialCount },
    (current, liked) => ({
      liked,
      count: current.count + (liked ? 1 : -1),
    }),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    // Logged-out visitors sign in first and come back to this article.
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    const next = !state.liked;
    setError(null);
    startTransition(async () => {
      setOptimisticState(next);
      try {
        const result = await setLike({ postId, like: next });
        if (!result.ok) setError(result.error);
      } catch {
        // A network failure must not crash the page.
        setError("Could not update. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <LikeButton
        liked={state.liked}
        count={state.count}
        pending={pending}
        onToggle={handleToggle}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
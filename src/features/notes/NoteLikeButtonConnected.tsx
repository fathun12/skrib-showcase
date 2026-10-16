"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LikeButton } from "@/ui/post/LikeButton";
import { setNoteLike } from "./actions";

export type LikeState = { liked: boolean; count: number };

type Props = {
  noteId: string;
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  initialLiked: boolean;
  // null = the count failed to load: the number is not shown as a false 0.
  initialCount: number | null;
  signedIn: boolean;
  // Called after the server accepted the like or unlike, so a parent can keep
  // two buttons of the same note in step (the card and the image viewer).
  onChange?: (next: LikeState) => void;
};

export function NoteLikeButtonConnected({
  noteId,
  returnPath,
  initialLiked,
  initialCount,
  signedIn,
  onChange,
}: Props) {
  const router = useRouter();
  // The reducer does nothing when the state already is the wanted one, so a
  // parent that passes the confirmed state down never makes the count jump
  // twice.
  const [state, setOptimisticState] = useOptimistic<LikeState, boolean>(
    { liked: initialLiked, count: initialCount ?? 0 },
    (current, liked) =>
      current.liked === liked
        ? current
        : { liked, count: current.count + (liked ? 1 : -1) },
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    const next = !state.liked;
    const nextCount = state.count + (next ? 1 : -1);
    setError(null);
    startTransition(async () => {
      setOptimisticState(next);
      try {
        const result = await setNoteLike({ noteId, like: next });
        if (result.ok) onChange?.({ liked: next, count: nextCount });
        else setError(result.error);
      } catch {
        // A network failure must not crash the page.
        setError("Could not update. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <LikeButton
        subject="note"
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
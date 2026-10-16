"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FollowButton } from "@/ui/profile/FollowButton";
import { setTagFollow } from "./actions";

type Props = {
  tag: string;
  initialFollowing: boolean;
  signedIn: boolean;
};

// Same shape as FollowButtonConnected (people), for a topic.
export function TagFollowButtonConnected({
  tag,
  initialFollowing,
  signedIn,
}: Props) {
  const router = useRouter();
  // The optimistic value shows the new state at once; if the action fails (or
  // when it ends) React falls back to the real value from the server.
  const [following, setOptimisticFollowing] = useOptimistic(initialFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    // Logged-out visitors sign in first and come back to this topic.
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/tag/${tag}`)}`);
      return;
    }

    const next = !following;
    setError(null);
    startTransition(async () => {
      setOptimisticFollowing(next);
      try {
        const result = await setTagFollow({ tag, follow: next });
        if (!result.ok) setError(result.error);
      } catch {
        // A network failure must not crash the page.
        setError("Could not update. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <FollowButton
        following={following}
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
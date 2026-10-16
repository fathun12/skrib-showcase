"use client";

import { useEffect, useState } from "react";
import { PinField } from "@/ui/pin/PinField";
import { getMyPinnedPost, setPinnedPost } from "./actions";

type Props = {
  postId: string;
  // True while the Details dialog is open: the state is read then.
  active: boolean;
};

export function PinFieldConnected({ postId, active }: Props) {
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getMyPinnedPost()
      .then((id) => {
        if (!cancelled) setPinned(id === postId);
      })
      .catch(() => {
        if (!cancelled) setPinned(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, postId]);

  async function handleToggle() {
    if (pinned === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setPinnedPost({ postId: pinned ? null : postId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPinned(result.pinned);
    } catch (caught) {
      console.error("setPinnedPost failed:", caught);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PinField
      pinned={pinned}
      busy={busy}
      error={error}
      onToggle={() => void handleToggle()}
    />
  );
}
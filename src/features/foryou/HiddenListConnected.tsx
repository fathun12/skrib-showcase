"use client";

import { useState, useTransition } from "react";
import { HiddenList, type HiddenListItem } from "@/ui/foryou/HiddenList";
import { unhideForYou } from "./actions";

export function HiddenListConnected({
  initialItems,
}: {
  initialItems: HiddenListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleUndo(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        const result = await unhideForYou({ id });
        if (result.ok) {
          setItems((current) => current.filter((item) => item.id !== id));
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not save. Please try again.");
      }
      setPendingId(null);
    });
  }

  return (
    <HiddenList
      items={items}
      pendingId={pendingId}
      error={error}
      onUndo={handleUndo}
    />
  );
}
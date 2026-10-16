"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { HiddenNotice } from "@/ui/foryou/HiddenNotice";
import { hideFromForYou, unhideForYou } from "./actions";

export type HideTarget =
  | { kind: "author"; username: string; name: string }
  | { kind: "topic"; tag: string; name: string };

type ItemApi = { hide: (target: HideTarget) => void };

const ForYouItemContext = createContext<ItemApi | null>(null);

// The menu on the card asks this wrapper to collapse the card.
export function useForYouItem(): ItemApi | null {
  return useContext(ForYouItemContext);
}

type Hidden = { id: string | null; message: string };

// Wraps one story card of the For you tab. After "Hide ..." the card turns
// into a thin row with Undo; if saving fails the card comes back.
export function ForYouItem({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Hidden | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function hide(target: HideTarget) {
    const subject =
      target.kind === "author"
        ? `stories from ${target.name}`
        : `stories about ${target.name}`;
    setError(null);
    // The card collapses at once; the id arrives when the server answers.
    setHidden({
      id: null,
      message: `Got it. You won't see ${subject} in For you.`,
    });
    startTransition(async () => {
      try {
        const result = await hideFromForYou(
          target.kind === "author"
            ? { kind: "author", username: target.username }
            : { kind: "topic", tag: target.tag },
        );
        if (result.ok) {
          setHidden((current) =>
            current ? { ...current, id: result.id } : current,
          );
        } else {
          setHidden(null);
          setError(result.error);
        }
      } catch {
        // A network failure must not crash the page.
        setHidden(null);
        setError("Could not save. Please try again.");
      }
    });
  }

  function undo() {
    const id = hidden?.id;
    if (!id) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await unhideForYou({ id });
        if (result.ok) setHidden(null);
        else setError(result.error);
      } catch {
        setError("Could not save. Please try again.");
      }
    });
  }

  if (hidden) {
    return (
      <HiddenNotice
        message={hidden.message}
        onUndo={undo}
        undoDisabled={hidden.id === null || pending}
        error={error}
      />
    );
  }

  return (
    <ForYouItemContext.Provider value={{ hide }}>
      {error ? (
        <p role="alert" className="pt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {children}
    </ForYouItemContext.Provider>
  );
}
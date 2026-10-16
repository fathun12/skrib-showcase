"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/ui/primitives/Avatar";
import { Button } from "@/ui/primitives/button";
import { setNoteBlock, setNoteMute } from "./actions";
import type { RelatedPerson } from "./queries";

type Kind = "block" | "mute";

type Props = {
  initialBlocked: RelatedPerson[];
  initialMuted: RelatedPerson[];
};

// The people I blocked and muted, each with an Undo button. Undoing is
// harmless, so there is no confirmation.
export function BlockedMutedList({ initialBlocked, initialMuted }: Props) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function undo(kind: Kind, person: RelatedPerson) {
    if (pending) return;
    setError(null);
    setBusyId(person.id);
    startTransition(async () => {
      try {
        const input = { profileId: person.id, on: false };
        const result =
          kind === "block"
            ? await setNoteBlock(input)
            : await setNoteMute(input);
        if (result.ok) {
          const drop = (list: RelatedPerson[]) =>
            list.filter((item) => item.id !== person.id);
          if (kind === "block") setBlocked(drop);
          else setMuted(drop);
        } else {
          setError(result.error);
        }
      } catch {
        // A network failure must not crash the page.
        setError("Could not update. Please try again.");
      }
      setBusyId(null);
    });
  }

  function renderSection(
    kind: Kind,
    title: string,
    description: string,
    people: RelatedPerson[],
  ) {
    return (
      <section aria-labelledby={`${kind}-heading`} className="mt-8">
        <h2
          id={`${kind}-heading`}
          className="font-serif text-xl font-bold tracking-tight"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {people.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nobody here yet.
          </p>
        ) : (
          <ul className="mt-3">
            {people.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 border-b border-border py-3"
              >
                <Avatar
                  name={person.displayName}
                  src={person.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${person.username}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {person.displayName}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    @{person.username}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => undo(kind, person)}
                >
                  {busyId === person.id
                    ? "Saving..."
                    : kind === "block"
                      ? "Unblock"
                      : "Unmute"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {renderSection(
        "mute",
        "Muted",
        "Their notes and notifications are hidden from you. They are not told.",
        muted,
      )}
      {renderSection(
        "block",
        "Blocked",
        "They can't like or reply to your notes, and your notes are hidden from them. They are not told.",
        blocked,
      )}
    </div>
  );
}
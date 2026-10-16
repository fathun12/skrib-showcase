"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NoteRelationDialog } from "@/ui/profile/NoteRelationDialog";
import { ProfileMenu, type ProfileMenuItem } from "@/ui/profile/ProfileMenu";
import { setNoteBlock, setNoteMute } from "./actions";

type Kind = "block" | "mute";

type Props = {
  profileId: string;
  username: string;
  initialBlocked: boolean;
  initialMuted: boolean;
};

// The "..." menu on someone else's profile: mute and block (Notes only).
// Turning one ON asks first; turning it OFF is harmless and happens at once.
export function NoteRelationMenuConnected({
  profileId,
  username,
  initialBlocked,
  initialMuted,
}: Props) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [confirm, setConfirm] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function apply(kind: Kind, on: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result =
          kind === "block"
            ? await setNoteBlock({ profileId, on })
            : await setNoteMute({ profileId, on });
        if (result.ok) {
          if (kind === "block") setBlocked(on);
          else setMuted(on);
          setConfirm(null);
        } else {
          setError(result.error);
        }
      } catch {
        // A network failure must not crash the page.
        setError("Could not update. Please try again.");
      }
    });
  }

  function choose(kind: Kind, isOn: boolean) {
    if (isOn) {
      apply(kind, false);
    } else {
      setError(null);
      setConfirm(kind);
    }
  }

  const items: ProfileMenuItem[] = [
    {
      label: muted ? `Unmute @${username}` : `Mute @${username}`,
      onSelect: () => choose("mute", muted),
    },
    {
      label: blocked ? `Unblock @${username}` : `Block @${username}`,
      onSelect: () => choose("block", blocked),
      destructive: !blocked,
    },
    {
      label: "Blocked and muted",
      onSelect: () => router.push("/me/blocked"),
    },
  ];

  return (
    <div className="flex flex-col items-end gap-1">
      <ProfileMenu items={items} disabled={pending} />
      {error && confirm === null ? (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <NoteRelationDialog
        open={confirm === "block"}
        title={`Block @${username}?`}
        description="They won't be able to like or reply to your notes, and your notes won't show in their lists. They won't be told."
        confirmLabel="Block"
        destructive
        pending={pending}
        error={error}
        onConfirm={() => apply("block", true)}
        onCancel={() => setConfirm(null)}
      />
      <NoteRelationDialog
        open={confirm === "mute"}
        title={`Mute @${username}?`}
        description="Their notes and notifications won't show for you. They won't be told. You can undo this anytime."
        confirmLabel="Mute"
        pending={pending}
        error={error}
        onConfirm={() => apply("mute", true)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
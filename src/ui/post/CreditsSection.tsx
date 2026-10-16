"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/ui/primitives/Avatar";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { ProfileLink } from "@/ui/profile/ProfileLink";

const MAX_STACK = 5;

export type CreditsSectionItem = {
  id: string;
  roleText: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  name: string | null;
  link: string | null;
};

export type RemoveMeResult = { ok: true } | { ok: false; error: string };

function itemName(c: CreditsSectionItem): string {
  return c.displayName ?? c.username ?? c.name ?? "Unknown";
}

// Only http(s) links are ever opened (the database checks this too).
function safeLink(link: string | null): string | null {
  return link && /^https?:\/\//i.test(link) ? link : null;
}

export type CreditsSectionProps = {
  // Accepted credits only, oldest first. Nothing is shown when empty.
  credits: CreditsSectionItem[];
  // Username of the signed-in viewer. A credited viewer sees "Remove me".
  viewerUsername?: string | null;
  onRemoveMe?: (input: { creditId: string }) => Promise<RemoveMeResult>;
};

// The Credits block at the end of an article: stacked avatars (max 5, then
// "+N") that open a dialog with everyone and their role.
export function CreditsSection({
  credits,
  viewerUsername,
  onRemoveMe,
}: CreditsSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (credits.length === 0) return null;

  const shown = credits.slice(0, MAX_STACK);
  const extra = credits.length - shown.length;

  function removeMe(creditId: string) {
    if (!onRemoveMe) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onRemoveMe({ creditId });
        if (result.ok) {
          setConfirmId(null);
          setOpen(false);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <section
      id="credits"
      aria-labelledby="credits-heading"
      className="mt-10 scroll-mt-20"
    >
      <h2
        id="credits-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Credits
      </h2>

      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex -space-x-2">
          {shown.map((c) => (
            <Avatar
              key={c.id}
              name={itemName(c)}
              src={c.avatarUrl}
              size="md"
              className="ring-2 ring-background"
            />
          ))}
          {extra > 0 ? (
            <span
              aria-hidden="true"
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium ring-2 ring-background"
            >
              +{extra}
            </span>
          ) : null}
        </span>
        <span className="text-sm text-muted-foreground">
          {credits.length} credited
        </span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
          if (!next) {
            setConfirmId(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credits</DialogTitle>
            <DialogDescription>
              People who contributed to this story.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {credits.map((c) => {
              const link = safeLink(c.link);
              const isMe =
                Boolean(onRemoveMe) &&
                Boolean(viewerUsername) &&
                c.username === viewerUsername;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={itemName(c)} src={c.avatarUrl} size="md" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">
                        {c.username ? (
                          <ProfileLink
                            username={c.username}
                            className="hover:underline"
                          >
                            {itemName(c)}
                          </ProfileLink>
                        ) : link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer nofollow ugc"
                            className="hover:underline"
                          >
                            {itemName(c)}
                          </a>
                        ) : (
                          itemName(c)
                        )}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {c.roleText}
                      </p>
                    </div>
                    {isMe && confirmId !== c.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setError(null);
                          setConfirmId(c.id);
                        }}
                      >
                        Remove me
                      </Button>
                    ) : null}
                  </div>

                  {isMe && confirmId === c.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span>Remove yourself from the credits?</span>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={isPending}
                        onClick={() => removeMe(c.id)}
                      >
                        {isPending ? "Removing..." : "Remove"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}

                  {isMe && error && confirmId === c.id ? (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";

export type InviteRow = {
  postId: string;
  title: string;
  ownerName: string;
  ownerUsername: string;
  date: string; // ISO timestamp of the invitation
  role: "coauthor" | "editor";
  // Only meaningful for an editor.
  showCredit: boolean;
};

export type InviteResult = { ok: true } | { ok: false; error: string };

type Props = {
  items: InviteRow[];
  onRespond: (input: { postId: string; accept: boolean }) => Promise<InviteResult>;
};

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function InviteList({ items, onRespond }: Props) {
  const [busy, setBusy] = useState<{ postId: string; accept: boolean } | null>(
    null,
  );
  const [error, setError] = useState<{ postId: string; message: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function respond(postId: string, accept: boolean) {
    setError(null);
    setBusy({ postId, accept });
    startTransition(async () => {
      try {
        const result = await onRespond({ postId, accept });
        if (!result.ok) setError({ postId, message: result.error });
      } catch {
        setError({
          postId,
          message: "Something went wrong. Please try again.",
        });
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const title = item.title.trim();
        const rowBusy = busy?.postId === item.postId ? busy : null;
        return (
          <li key={item.postId} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate font-serif text-lg font-semibold",
                    !title && "italic text-muted-foreground",
                  )}
                >
                  {title || "Untitled draft"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invited by {item.ownerName} (@{item.ownerUsername}) as{" "}
                  {item.role === "editor" ? "editor" : "co-author"} ·{" "}
                  {formatDay(item.date)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => respond(item.postId, true)}
                >
                  {rowBusy?.accept ? "Accepting..." : "Accept"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => respond(item.postId, false)}
                >
                  {rowBusy && !rowBusy.accept ? "Declining..." : "Decline"}
                </Button>
              </div>
            </div>

            {item.role === "editor" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                As an editor you can edit this draft while you hold the pen.
                You cannot delete the story or change it once it is
                published, and you can publish it only if the author allows
                that. You are not shown as an author.{" "}
                {item.showCredit
                  ? "The author will show “Edited by” with your name at the end of the story."
                  : "The author chose not to show your name on the story."}{" "}
                The story stays with the author, and either side can end this
                at any time. By accepting you agree to this.
              </p>
            ) : null}

            {error?.postId === item.postId && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error.message}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
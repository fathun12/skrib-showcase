"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";

export type CreditInviteRow = {
  creditId: string;
  title: string;
  ownerName: string;
  ownerUsername: string;
  roleText: string;
  date: string; // ISO timestamp of the invitation
};

export type CreditInviteResult = { ok: true } | { ok: false; error: string };

type Props = {
  items: CreditInviteRow[];
  onRespond: (input: {
    creditId: string;
    accept: boolean;
  }) => Promise<CreditInviteResult>;
};

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function CreditInviteList({ items, onRespond }: Props) {
  const [busy, setBusy] = useState<{
    creditId: string;
    accept: boolean;
  } | null>(null);
  const [error, setError] = useState<{
    creditId: string;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function respond(creditId: string, accept: boolean) {
    setError(null);
    setBusy({ creditId, accept });
    startTransition(async () => {
      try {
        const result = await onRespond({ creditId, accept });
        if (!result.ok) setError({ creditId, message: result.error });
      } catch {
        setError({
          creditId,
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
        const rowBusy = busy?.creditId === item.creditId ? busy : null;
        return (
          <li key={item.creditId} className="py-4">
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
                  {item.ownerName} (@{item.ownerUsername}) wants to credit you
                  as {item.roleText} · {formatDay(item.date)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  If you accept, your name shows under Credits when the story is
                  published. You can remove yourself at any time.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => respond(item.creditId, true)}
                >
                  {rowBusy?.accept ? "Accepting..." : "Accept"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => respond(item.creditId, false)}
                >
                  {rowBusy && !rowBusy.accept ? "Declining..." : "Decline"}
                </Button>
              </div>
            </div>

            {error?.creditId === item.creditId && (
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
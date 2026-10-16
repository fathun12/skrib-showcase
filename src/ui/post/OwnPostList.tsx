"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";

export type OwnPostRow = {
  id: string;
  title: string;
  date: string; // ISO timestamp
  href: string; // where "Edit" goes
  viewHref?: string; // public article page; only for published posts
  // Overrides the list-level dateLabel (the shared tab mixes drafts and
  // published posts).
  dateLabel?: string;
  // Small extra text after the date, for example whose post it is.
  byline?: string;
  // ISO time a draft is set to publish; shows a small "Scheduled" label.
  scheduledFor?: string | null;
};

export type PostActionResult = { ok: true } | { ok: false; error: string };
export type DeleteResult = PostActionResult;
export type UnpublishResult = PostActionResult;

type Props = {
  items: OwnPostRow[];
  dateLabel: string; // "Last edited" or "Published"
  emptyText: string;
  // Text of the first button of each row (default "Edit").
  editLabel?: string;
  // When given, each row gets a Delete button with an inline confirmation.
  onDelete?: (id: string) => Promise<DeleteResult>;
  // When given (Published tab), each row also gets an Unpublish button.
  onUnpublish?: (id: string) => Promise<UnpublishResult>;
};

type Confirming = { id: string; kind: "delete" | "unpublish" };

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function OwnPostList({
  items,
  dateLabel,
  emptyText,
  editLabel = "Edit",
  onDelete,
  onUnpublish,
}: Props) {
  // The row that is waiting for "are you sure?", if any.
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ask(id: string, kind: Confirming["kind"]) {
    setError(null);
    setConfirming({ id, kind });
  }

  function cancel() {
    setError(null);
    setConfirming(null);
  }

  function confirm() {
    if (!confirming) return;
    const { id, kind } = confirming;
    const action = kind === "delete" ? onDelete : onUnpublish;
    if (!action) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(id);
        if (result.ok) {
          setConfirming(null);
        } else {
          setError(result.error);
        }
      } catch {
        setError(
          kind === "delete"
            ? "Could not delete this post. Please try again."
            : "Could not unpublish this post. Please try again.",
        );
      }
    });
  }

  if (items.length === 0) {
    return <p className="py-10 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const title = item.title.trim();
        const rowConfirming =
          confirming?.id === item.id ? confirming.kind : null;
        return (
          <li key={item.id} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate font-serif text-lg font-semibold",
                    !title && "italic text-muted-foreground",
                  )}
                >
                  {title || "Untitled"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.dateLabel ?? dateLabel} {formatDay(item.date)}
                  {item.byline ? ` · ${item.byline}` : ""}
                  {item.scheduledFor ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      <CalendarClock className="size-3" aria-hidden="true" />
                      Scheduled · {formatDay(item.scheduledFor)}
                    </span>
                  ) : null}
                </p>
              </div>

              {rowConfirming ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {rowConfirming === "delete"
                      ? "Delete permanently?"
                      : "Unpublish? It will no longer be public."}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={confirm}
                    className={buttonVariants({
                      variant: "destructive",
                      size: "sm",
                    })}
                  >
                    {rowConfirming === "delete"
                      ? isPending
                        ? "Deleting..."
                        : "Delete"
                      : isPending
                        ? "Unpublishing..."
                        : "Unpublish"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={cancel}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={item.href}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    {editLabel}
                  </Link>
                  {item.viewHref && (
                    <Link
                      href={item.viewHref}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      View
                    </Link>
                  )}
                  {onUnpublish && (
                    <button
                      type="button"
                      onClick={() => ask(item.id, "unpublish")}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Unpublish
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => ask(item.id, "delete")}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {rowConfirming && error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
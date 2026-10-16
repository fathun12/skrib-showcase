"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { ContinueReadingItem } from "./queries";

type Props = { items: ContinueReadingItem[] };

// "Continue reading" at the top of the Saved page. The cross forgets the
// place of one story (the story itself stays untouched).
export function ContinueReadingList({ items }: Props) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function remove(postId: string) {
    setError(null);
    setRemoving(postId);
    try {
      const response = await fetch("/api/reading-progress", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!response.ok) {
        setError("Could not remove it. Please try again.");
        return;
      }
      setHidden((current) => [...current, postId]);
      router.refresh();
    } catch {
      setError("Could not remove it. Please try again.");
    } finally {
      setRemoving(null);
    }
  }

  const visible = items.filter((item) => !hidden.includes(item.postId));
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="continue-reading-heading" className="mb-10">
      <h2
        id="continue-reading-heading"
        className="mb-2 text-sm font-medium text-muted-foreground"
      >
        Continue reading
      </h2>
      <ul className="divide-y divide-border border-y border-border">
        {visible.map((item) => (
          <li key={item.postId} className="flex items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <Link
                href={item.href}
                className="line-clamp-2 font-serif text-lg font-semibold leading-snug hover:text-primary"
              >
                {item.title}
              </Link>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {item.authorName}
              </p>
              <div
                aria-hidden="true"
                className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.percent}% · {item.minutesLeft} min left
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(item.postId)}
              disabled={removing === item.postId}
              aria-label={`Remove "${item.title}" from Continue reading`}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
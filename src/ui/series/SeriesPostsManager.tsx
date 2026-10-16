"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import { fieldClass } from "@/ui/primitives/field";

type Item = {
  postId: string;
  title: string;
  status: string;
  href: string | null;
  coverUrl: string | null;
};
type Candidate = { id: string; title: string; status: string };
type Result = { ok: true } | { ok: false; error: string };

type Props = {
  seriesId: string;
  items: Item[];
  candidates: Candidate[];
  onMove: (input: {
    seriesId: string;
    postId: string;
    direction: "up" | "down";
  }) => Promise<Result>;
  onRemove: (input: { seriesId: string; postId: string }) => Promise<Result>;
  onAdd: (input: { seriesId: string; postId: string }) => Promise<Result>;
};

function statusLabel(status: string) {
  if (status === "draft") return "Draft";
  if (status === "hidden") return "Hidden";
  return null;
}

function displayTitle(title: string) {
  return title.trim() || "Untitled";
}

export function SeriesPostsManager({
  seriesId,
  items,
  candidates,
  onMove,
  onRemove,
  onAdd,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<Result>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onDone?.();
      else setError(result.error);
    });
  }

  function handleAddOpenChange(next: boolean) {
    if (pending) return;
    setAddOpen(next);
    setQuery("");
    setError(null);
  }

  const needle = query.trim().toLowerCase();
  const matches = candidates.filter((candidate) =>
    displayTitle(candidate.title).toLowerCase().includes(needle),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-bold tracking-tight">
          Stories
        </h2>
        <Button
          type="button"
          className="h-9 rounded-full px-4"
          onClick={() => setAddOpen(true)}
          disabled={pending}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add story
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          No stories in this series yet. Press Add story to start.
        </p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
          {items.map((item, index) => {
            const label = statusLabel(item.status);
            const title = displayTitle(item.title);
            return (
              <li
                key={item.postId}
                className="flex items-center gap-3 px-3 py-3"
              >
                <span className="w-5 text-center text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-accent sm:w-20">
                  {item.coverUrl ? (
                    <Image
                      src={cloudinaryImageUrl(item.coverUrl, {
                        width: 160,
                        height: 90,
                        crop: "fill",
                      })}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block truncate font-serif text-base font-semibold hover:underline"
                    >
                      {title}
                    </Link>
                  ) : (
                    <span className="block truncate font-serif text-base font-semibold">
                      {title}
                    </span>
                  )}
                  {label ? (
                    <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                      {label}
                      {item.status === "draft"
                        ? ": shown once published"
                        : ": not shown to readers"}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${title} up`}
                    disabled={pending || index === 0}
                    onClick={() =>
                      run(() =>
                        onMove({
                          seriesId,
                          postId: item.postId,
                          direction: "up",
                        }),
                      )
                    }
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${title} down`}
                    disabled={pending || index === items.length - 1}
                    onClick={() =>
                      run(() =>
                        onMove({
                          seriesId,
                          postId: item.postId,
                          direction: "down",
                        }),
                      )
                    }
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${title} from the series`}
                    disabled={pending}
                    onClick={() =>
                      run(() => onRemove({ seriesId, postId: item.postId }))
                    }
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {error && !addOpen ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Add a story</DialogTitle>
            <DialogDescription>
              Your drafts and published stories that are not in a series yet.
            </DialogDescription>
          </DialogHeader>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your stories"
            aria-label="Search your stories"
            className={fieldClass}
          />
          {candidates.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No stories available to add.
            </p>
          ) : matches.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No story matches your search.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border/70">
              {matches.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => onAdd({ seriesId, postId: candidate.id }),
                        () => handleAddOpenChange(false),
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
                  >
                    <span className="min-w-0 truncate font-serif font-semibold">
                      {displayTitle(candidate.title)}
                    </span>
                    {candidate.status === "draft" ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                        Draft
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
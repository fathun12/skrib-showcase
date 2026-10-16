"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";

type TagStat = { tag: string; count: number; bytes: number };
type Report = {
  scanned: number;
  used: number;
  orphans: number;
  bytes: number;
  deleted?: number;
  truncated: boolean;
  byTag: TagStat[];
};
type Result = { ok: true; report: Report } | { ok: false; error: string };
type Storage = { usedBytes: number; limitBytes: number };

type Props = {
  // null = Cloudinary did not tell us (shown as "not available").
  storage: Storage | null;
  onPreview: () => Promise<Result>;
  onDelete: () => Promise<Result>;
};

const TAG_LABELS: Record<string, string> = {
  post: "Article images",
  cover: "Covers",
  avatar: "Profile pictures",
  note: "Note images",
};
// Above this share the bar turns red.
const WARN_AT = 0.85;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-serif text-xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function StorageCard({ storage }: { storage: Storage | null }) {
  if (!storage) {
    return (
      <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          Storage
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The storage figure is not available right now. You can still check it
          in the Cloudinary dashboard.
        </p>
      </section>
    );
  }

  const ratio = Math.min(1, storage.usedBytes / storage.limitBytes);
  const percent = ratio * 100;
  const warn = ratio >= WARN_AT;

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          Storage
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatSize(storage.usedBytes)} of {formatSize(storage.limitBytes)}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Cloudinary storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
            warn ? "bg-destructive/80" : "bg-primary",
          )}
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>

      <p
        className={cn(
          "mt-2 text-xs",
          warn ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {percent < 10 ? percent.toFixed(1) : Math.round(percent)}% used
        {warn ? ". Almost full: scan for unused images below." : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Read from Cloudinary when this page opens. Cloudinary may update the
        figure with some delay.
      </p>
    </section>
  );
}

export function ImageSweepPanel({ storage, onPreview, onDelete }: Props) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setReport(result.report);
        // After a delete the storage figure above is read again.
        if (result.report.deleted !== undefined) router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const canDelete =
    report !== null && report.orphans > 0 && report.deleted === undefined;

  return (
    <div className="space-y-4">
      <StorageCard storage={storage} />

      <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          Unused images
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Finds images in Cloudinary that no profile, post, series, note or old
          version uses any more. Images younger than 24 hours are never
          touched. Deleting cannot be undone.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-full px-5"
            onClick={() => run(onPreview)}
            disabled={pending}
          >
            {pending ? "Working..." : report ? "Scan again" : "Scan"}
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              className="rounded-full px-5"
              onClick={() => run(onDelete)}
              disabled={pending}
            >
              Delete {report.orphans} images ({formatSize(report.bytes)})
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {report ? (
          <div className="mt-5 space-y-4" aria-live="polite">
            {report.deleted !== undefined ? (
              <p className="text-sm">
                Deleted {report.deleted} of {report.orphans} unused images.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Scanned" value={String(report.scanned)} />
                <Stat label="In use" value={String(report.used)} />
                <Stat
                  label="Unused"
                  value={
                    report.orphans === 0
                      ? "0"
                      : `${report.orphans} · ${formatSize(report.bytes)}`
                  }
                />
              </div>
            )}

            <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
              {report.byTag.map((stat) => (
                <li
                  key={stat.tag}
                  className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span>{TAG_LABELS[stat.tag] ?? stat.tag}</span>
                  <span className="text-muted-foreground">
                    {stat.count} · {formatSize(stat.bytes)}
                  </span>
                </li>
              ))}
            </ul>

            {report.truncated ? (
              <p className="text-xs text-muted-foreground">
                The list was cut off at the scan limit; run it again after
                deleting.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
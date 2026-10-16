"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/ui/primitives/button";

type Preview = { purgeable: number; onHold: number; waiting: number };
type PreviewResult =
  | { ok: true; preview: Preview }
  | { ok: false; error: string };
type PurgeResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

type Props = {
  onPreview: () => Promise<PreviewResult>;
  onPurge: () => Promise<PurgeResult>;
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-serif text-xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function NoteRetentionPanel({ onPreview, onPurge }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function check() {
    setError(null);
    setDeleted(null);
    startTransition(async () => {
      try {
        const result = await onPreview();
        if (result.ok) setPreview(result.preview);
        else setError(result.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function purge() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onPurge();
        if (result.ok) {
          setDeleted(result.deleted);
          setPreview(null);
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <details className="mb-4 rounded-lg border border-border p-4 text-sm">
      <summary className="cursor-pointer font-medium">Retention</summary>
      <p className="mt-2 text-muted-foreground">
        A decided report keeps its saved copy until its keep-until date (90
        days after a dismiss, 12 months after a hide or delete). A report on
        legal hold is never purged. Purging deletes the decided reports whose
        date has passed and cannot be undone.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-full px-5"
          onClick={check}
          disabled={pending}
        >
          {pending ? "Working..." : preview ? "Check again" : "Check"}
        </Button>
        {preview && preview.purgeable > 0 ? (
          <Button
            type="button"
            variant="danger"
            className="rounded-full px-5"
            onClick={purge}
            disabled={pending}
          >
            Delete {preview.purgeable}{" "}
            {preview.purgeable === 1 ? "report" : "reports"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-destructive">
          {error}
        </p>
      ) : null}

      <div aria-live="polite">
        {deleted !== null ? (
          <p className="mt-3">
            Deleted {deleted} {deleted === 1 ? "report" : "reports"}.
          </p>
        ) : null}
        {preview ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Ready to purge" value={preview.purgeable} />
            <Stat label="On legal hold" value={preview.onHold} />
            <Stat label="Waiting" value={preview.waiting} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ModerationDialog } from "@/ui/moderation/ModerationDialog";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";
import { buttonVariants } from "@/ui/primitives/button";

export type SeriesCardItem = {
  seriesId: string;
  title: string;
  description: string | null;
  authorName: string;
  authorUsername: string | null;
  // Public page of the series; null when the author has no username.
  seriesHref: string | null;
  dateLine: string;
  reportCount: number;
  reasons: string[];
  reports: { reason: string; details: string | null; createdAt: string }[];
};

type Props = {
  item: SeriesCardItem;
  onModerate: (input: {
    seriesId: string;
    action: "delete" | "dismiss";
    reason?: string;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const REASON_OPTIONS = REPORT_REASON_VALUES.map((value) => ({
  value,
  label: REPORT_REASON_LABELS[value],
}));

function reasonLabel(reason: string) {
  return reason.replaceAll("_", " ");
}

function formatDate(iso: string) {
  // Fixed time zone: server and browser must print the same text.
  return new Date(iso).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function SeriesModerationCard({ item, onModerate }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  function run(action: "delete" | "dismiss", reason?: string, note?: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onModerate({
          seriesId: item.seriesId,
          action,
          reason,
          note: note || undefined,
        });
        if (result.ok) setDialog(false);
        else setError(result.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <h3 className="font-serif text-lg font-bold">
        {item.seriesHref ? (
          <Link href={item.seriesHref} className="hover:underline">
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </h3>
      {item.description ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap wrap-break-word text-sm">
          {item.description}
        </p>
      ) : null}

      <p className="mt-2 text-sm text-muted-foreground">
        By {item.authorName}
        {item.authorUsername ? ` (@${item.authorUsername})` : ""}
        {` · ${item.dateLine}`}
      </p>

      <p className="mt-3 text-sm">
        <strong>
          {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
        </strong>
        {item.reasons.length > 0
          ? `: ${item.reasons.map(reasonLabel).join(", ")}`
          : ""}
      </p>

      {item.reports.length > 0 ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Show reports
          </summary>
          <ul className="mt-2 space-y-2">
            {item.reports.map((report, index) => (
              <li key={index} className="rounded-md bg-muted/50 p-2">
                <span className="font-medium">{reasonLabel(report.reason)}</span>{" "}
                <span className="text-muted-foreground">
                  · {formatDate(report.createdAt)}
                </span>
                {report.details ? (
                  <p className="mt-1 whitespace-pre-wrap wrap-break-word">
                    {report.details}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setDialog(true);
          }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "border border-border text-destructive",
          )}
        >
          Delete
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("dismiss")}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "border border-border",
          )}
        >
          Dismiss
        </button>
      </div>

      {error && !dialog ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {dialog ? (
        <ModerationDialog
          title="Delete this series"
          description="The series and its cover are deleted for good. Its stories are not affected. This cannot be undone. The author is told in the app and, when possible, by email."
          confirmLabel="Delete series"
          destructive
          reasons={REASON_OPTIONS}
          noteMax={REPORT_DETAILS_MAX}
          pending={pending}
          error={error}
          onConfirm={(reason, note) => run("delete", reason, note)}
          onCancel={() => {
            setError(null);
            setDialog(false);
          }}
        />
      ) : null}
    </li>
  );
}
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

export type CommentCardItem = {
  commentId: string;
  snippet: string;
  // Respond: the quoted passage of the story, or null.
  quote: string | null;
  authorName: string;
  authorUsername: string | null;
  postTitle: string;
  postHref: string | null;
  dateLine: string;
  reportCount: number;
  reasons: string[];
  reports: { reason: string; details: string | null; createdAt: string }[];
};

type Props = {
  item: CommentCardItem;
  onModerate: (input: {
    commentId: string;
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

export function CommentModerationCard({ item, onModerate }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  function run(action: "delete" | "dismiss", reason?: string, note?: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onModerate({
          commentId: item.commentId,
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
      {item.quote ? (
        <blockquote className="mb-3 rounded-xl border-l-2 border-primary/60 bg-muted/50 px-3.5 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Responding to (passage of the story)
          </p>
          {/* Plain text only, never HTML. */}
          <p className="mt-1 font-serif text-sm leading-relaxed break-words whitespace-pre-wrap italic">
            {item.quote}
          </p>
        </blockquote>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-sm">
        “{item.snippet}”
      </p>

      <p className="mt-2 text-sm text-muted-foreground">
        By {item.authorName}
        {item.authorUsername ? ` (@${item.authorUsername})` : ""}
        {" · On "}
        {item.postHref ? (
          <Link href={item.postHref} className="underline">
            {item.postTitle.trim() || "Untitled"}
          </Link>
        ) : (
          item.postTitle.trim() || "Untitled"
        )}
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
                  <p className="mt-1 whitespace-pre-wrap break-words">
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
          title="Delete this comment"
          description="The comment and its replies are deleted for good. This cannot be undone. The author is told in the app and, when possible, by email."
          confirmLabel="Delete comment"
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
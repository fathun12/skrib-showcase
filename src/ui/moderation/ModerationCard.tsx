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

export type ModerationActionName = "hide" | "delete" | "restore" | "dismiss";

export type ModerationCardItem = {
  postId: string;
  title: string;
  // Public page; null when the post is not public.
  href: string | null;
  authorName: string;
  authorUsername: string | null;
  statusLabel?: string;
  // Date line, already formatted.
  dateLine?: string;
  reasons?: string[];
  reports?: { reason: string; details: string | null; createdAt: string }[];
  reportCount?: number;
  // Earlier hide and delete actions on this author (review page only).
  history?: { hides: number; deletes: number } | null;
};

type Props = {
  item: ModerationCardItem;
  actions: ModerationActionName[];
  onModerate: (input: {
    postId: string;
    action: ModerationActionName;
    reason?: string;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const LABELS: Record<ModerationActionName, string> = {
  hide: "Hide",
  delete: "Delete",
  restore: "Restore",
  dismiss: "Dismiss",
};

// Hide and delete ask for a reason first; the other two run at once.
type ReasonAction = "hide" | "delete";

function needsReason(action: ModerationActionName): action is ReasonAction {
  return action === "hide" || action === "delete";
}

const DIALOG_TEXT: Record<
  ReasonAction,
  { title: string; description: string; confirm: string }
> = {
  hide: {
    title: "Hide this post",
    description:
      "It disappears from the site and the author cannot publish it again. The author is told in the app and, when possible, by email.",
    confirm: "Hide post",
  },
  delete: {
    title: "Delete this post for good",
    description:
      "Its comments, likes and reports go with it. This cannot be undone. The author is told in the app and, when possible, by email.",
    confirm: "Delete post",
  },
};

const REASON_OPTIONS = REPORT_REASON_VALUES.map((value) => ({
  value,
  label: REPORT_REASON_LABELS[value],
}));

function reasonLabel(reason: string) {
  return reason.replaceAll("_", " ");
}

function historyText(history: { hides: number; deletes: number }) {
  const total = history.hides + history.deletes;
  if (total === 0) return "No earlier moderation on this author.";
  const hides = `${history.hides} ${history.hides === 1 ? "hide" : "hides"}`;
  const deletes = `${history.deletes} ${history.deletes === 1 ? "delete" : "deletes"}`;
  return `This author: ${total} earlier ${total === 1 ? "action" : "actions"} (${hides}, ${deletes}).`;
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

export function ModerationCard({ item, actions, onModerate }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ReasonAction | null>(null);

  function run(action: ModerationActionName, reason?: string, note?: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onModerate({
          postId: item.postId,
          action,
          reason,
          note: note || undefined,
        });
        if (result.ok) setDialog(null);
        else setError(result.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function start(action: ModerationActionName) {
    if (needsReason(action)) {
      setError(null);
      setDialog(action);
    } else {
      run(action);
    }
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg font-bold">
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </h3>
        {item.statusLabel ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {item.statusLabel}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        By {item.authorName}
        {item.authorUsername ? ` (@${item.authorUsername})` : ""}
        {item.dateLine ? ` · ${item.dateLine}` : ""}
      </p>

      {item.history ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {historyText(item.history)}
        </p>
      ) : null}

      {item.reportCount !== undefined ? (
        <p className="mt-3 text-sm">
          <strong>
            {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
          </strong>
          {item.reasons && item.reasons.length > 0
            ? `: ${item.reasons.map(reasonLabel).join(", ")}`
            : ""}
        </p>
      ) : null}

      {item.reports && item.reports.length > 0 ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Show reports
          </summary>
          <ul className="mt-2 space-y-2">
            {item.reports.map((report, index) => (
              <li key={index} className="rounded-md bg-muted/50 p-2">
                <span className="font-medium">
                  {reasonLabel(report.reason)}
                </span>{" "}
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

      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={pending}
              onClick={() => start(action)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "border border-border",
                action === "delete" && "text-destructive",
              )}
            >
              {LABELS[action]}
            </button>
          ))}
        </div>
      ) : null}

      {error && !dialog ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {dialog ? (
        <ModerationDialog
          title={DIALOG_TEXT[dialog].title}
          description={DIALOG_TEXT[dialog].description}
          confirmLabel={DIALOG_TEXT[dialog].confirm}
          destructive={dialog === "delete"}
          reasons={REASON_OPTIONS}
          noteMax={REPORT_DETAILS_MAX}
          pending={pending}
          error={error}
          onConfirm={(reason, note) => run(dialog, reason, note)}
          onCancel={() => {
            setError(null);
            setDialog(null);
          }}
        />
      ) : null}
    </li>
  );
}
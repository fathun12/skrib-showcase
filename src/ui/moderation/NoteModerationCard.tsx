"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { ModerationDialog } from "@/ui/moderation/ModerationDialog";
import { NoteHoldDialog } from "@/ui/moderation/NoteHoldDialog";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";
import { buttonVariants } from "@/ui/primitives/button";

export type NoteCardItem = {
  noteId: string;
  // published, hidden, hidden_by_author, or deleted.
  status: string;
  text: string;
  authorName: string;
  authorUsername: string | null;
  writtenLine: string;
  dateLine: string;
  parent: { authorUsername: string | null; text: string } | null;
  // The note this note quotes (copy saved at report time).
  quote: { authorUsername: string | null; text: string } | null;
  // The images saved in the report copy (empty: none, or an older copy).
  images: { url: string; alt: string }[];
  // The story the note shares and the passage quoted from it (saved copy).
  story: { title: string; authorUsername: string | null } | null;
  storyQuote: string | null;
  // Public page of the note; null when it is not public (anymore).
  noteHref: string | null;
  reportCount: number;
  reasons: string[];
  reports: { reason: string; details: string | null; createdAt: string }[];
  // Legal hold on any report of this note, and the date the copy is kept to.
  legalHold: boolean;
  retainUntil: string | null;
};

type NoteAction = "hide" | "delete" | "dismiss" | "restore";
type Result = { ok: true } | { ok: false; error: string };

type Props = {
  item: NoteCardItem;
  // Open reports can be decided; resolved and dismissed are history.
  view: "open" | "resolved" | "dismissed";
  onModerate: (input: {
    noteId: string;
    action: NoteAction;
    reason?: string;
    note?: string;
  }) => Promise<Result>;
  onSetHold: (input: {
    noteId: string;
    hold: boolean;
    note: string;
  }) => Promise<Result>;
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

function statusText(status: string): string | null {
  if (status === "hidden") return "Hidden by a moderator.";
  if (status === "hidden_by_author") {
    return "Hidden by the author of the note it replies to.";
  }
  if (status === "deleted") {
    return "This note was deleted. The text below is the copy saved when it was reported.";
  }
  return null;
}

const ghostClass = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "border border-border",
);

export function NoteModerationCard({
  item,
  view,
  onModerate,
  onSetHold,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"hide" | "delete" | "hold" | null>(
    null,
  );

  const isOpen = view === "open";
  const canHide = isOpen && item.status === "published";
  const canDelete = isOpen && item.status !== "deleted";
  // Only a note hidden by a moderator can be restored, from the Resolved view.
  const canRestore = view === "resolved" && item.status === "hidden";
  const status = statusText(item.status);
  // Only addresses on our own image host are shown or linked.
  const images = item.images.filter((image) =>
    image.url.startsWith("https://res.cloudinary.com/"),
  );

  function run(action: NoteAction, reason?: string, note?: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onModerate({
          noteId: item.noteId,
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

  function setHold(note: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onSetHold({
          noteId: item.noteId,
          hold: !item.legalHold,
          note,
        });
        if (result.ok) setDialog(null);
        else setError(result.error);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function close() {
    setError(null);
    setDialog(null);
  }

  return (
    <li className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        By {item.authorName}
        {item.authorUsername ? ` (@${item.authorUsername})` : ""}
        {item.writtenLine ? ` · ${item.writtenLine}` : ""}
        {` · ${item.dateLine}`}
      </p>

      {status ? (
        <p className="mt-1 text-sm font-medium text-destructive">{status}</p>
      ) : null}

      {item.legalHold ? (
        <p className="mt-1 text-sm font-medium">
          On legal hold: the reports and the saved copy are not purged.
        </p>
      ) : null}
      {item.retainUntil ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Saved copy kept until {formatDate(item.retainUntil)}.
        </p>
      ) : null}

      {item.parent ? (
        <div className="mt-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
          <span className="font-medium">
            In reply to
            {item.parent.authorUsername ? ` @${item.parent.authorUsername}` : ""}
          </span>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap wrap-break-word">
            {item.parent.text}
          </p>
        </div>
      ) : null}

      <p className="mt-3 whitespace-pre-wrap wrap-break-word text-base">
        {item.text}
      </p>
      {item.quote ? (
        <div className="mt-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
          <span className="font-medium">
            Quoting
            {item.quote.authorUsername ? ` @${item.quote.authorUsername}` : ""}
          </span>
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap wrap-break-word">
            {item.quote.text}
          </p>
        </div>
      ) : null}
      {item.story ? (
        <div className="mt-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
          <span className="font-medium">
            Shares the story {item.story.title}
            {item.story.authorUsername ? ` by @${item.story.authorUsername}` : ""}
          </span>
          {item.storyQuote ? (
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap wrap-break-word">
              {item.storyQuote}
            </p>
          ) : null}
        </div>
      ) : null}
      {images.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            {images.length === 1 ? "1 image" : `${images.length} images`} in
            the saved copy (each opens in a new tab)
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {images.map((image, index) => (
              <li key={`${image.url}-${index}`}>
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open image ${index + 1} in a new tab`}
                  className="block rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cloudinaryImageUrl(image.url, {
                      width: 240,
                      height: 240,
                      crop: "fill",
                    })}
                    alt={image.alt}
                    loading="lazy"
                    className="size-24 rounded-md border border-border object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.noteHref ? (
        <p className="mt-1 text-sm">
          <Link href={item.noteHref} className="text-muted-foreground hover:underline">
            Open note
          </Link>
        </p>
      ) : null}

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
        {canHide ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setDialog("hide");
            }}
            className={ghostClass}
          >
            Hide
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setDialog("delete");
            }}
            className={cn(ghostClass, "text-destructive")}
          >
            Delete
          </button>
        ) : null}
        {isOpen ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("dismiss")}
            className={ghostClass}
          >
            Dismiss
          </button>
        ) : null}
        {canRestore ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("restore")}
            className={ghostClass}
          >
            Restore
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setDialog("hold");
          }}
          className={ghostClass}
        >
          {item.legalHold ? "Release hold" : "Legal hold"}
        </button>
      </div>

      {error && !dialog ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {dialog === "hide" ? (
        <ModerationDialog
          title="Hide this note"
          description="The note is hidden from everyone except its writer. The writer is told in the app and, when possible, by email."
          confirmLabel="Hide note"
          reasons={REASON_OPTIONS}
          noteMax={REPORT_DETAILS_MAX}
          pending={pending}
          error={error}
          onConfirm={(reason, note) => run("hide", reason, note)}
          onCancel={close}
        />
      ) : null}

      {dialog === "delete" ? (
        <ModerationDialog
          title="Delete this note"
          description="The note and its replies are deleted for good. The reports and the saved copy of the text stay as evidence. This cannot be undone. The writer is told in the app and, when possible, by email."
          confirmLabel="Delete note"
          destructive
          reasons={REASON_OPTIONS}
          noteMax={REPORT_DETAILS_MAX}
          pending={pending}
          error={error}
          onConfirm={(reason, note) => run("delete", reason, note)}
          onCancel={close}
        />
      ) : null}

      {dialog === "hold" ? (
        <NoteHoldDialog
          title={
            item.legalHold ? "Release the legal hold" : "Put a legal hold"
          }
          description={
            item.legalHold
              ? "After the release, the reports of this note can be purged once their keep-until date has passed. Write why."
              : "While a hold is on, the reports and the saved copy of this note are never purged. Write why, for example the reference of an official request. The note is written to the moderation log."
          }
          confirmLabel={item.legalHold ? "Release hold" : "Put on hold"}
          noteMax={REPORT_DETAILS_MAX}
          pending={pending}
          error={error}
          onConfirm={setHold}
          onCancel={close}
        />
      ) : null}
    </li>
  );
}
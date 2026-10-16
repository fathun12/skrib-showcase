"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ModerationDialog } from "@/ui/moderation/ModerationDialog";
import {
  SUSPENSION_DURATIONS,
  type SuspensionDays,
} from "@/ui/moderation/suspension-durations";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";
import { buttonVariants } from "@/ui/primitives/button";

type Result = { ok: true } | { ok: false; error: string };

const REASON_OPTIONS = REPORT_REASON_VALUES.map((value) => ({
  value,
  label: REPORT_REASON_LABELS[value],
}));

// Radio values are text: "1", "7", "30" or "lifted" (until an admin lifts it).
const DURATION_OPTIONS = SUSPENSION_DURATIONS.map((option) => ({
  value: option.days === null ? "lifted" : String(option.days),
  label: option.label,
}));

function toDays(value: string): SuspensionDays {
  if (value === "1") return 1;
  if (value === "7") return 7;
  if (value === "30") return 30;
  return null;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

type SuspendProps = {
  userId: string;
  authorName: string;
  onSuspend: (input: {
    userId: string;
    reason: string;
    note?: string;
    days: SuspensionDays;
  }) => Promise<Result>;
};

export function SuspendAuthorButton({
  userId,
  authorName,
  onSuspend,
}: SuspendProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm(reason: string, note: string, duration: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onSuspend({
          userId,
          reason,
          note: note || undefined,
          days: toDays(duration),
        });
        if (result.ok) setOpen(false);
        else setError(result.error);
      } catch {
        setError(GENERIC_ERROR);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "border border-border text-destructive",
        )}
      >
        Suspend author
      </button>

      {open ? (
        <ModerationDialog
          title={`Suspend ${authorName}`}
          description="The account can still sign in, read and delete its own posts and comments, but cannot publish, comment, like, follow or repost until the suspension ends or is lifted. Published posts stay public. The author is told in the app and, when possible, by email."
          confirmLabel="Suspend account"
          destructive
          reasons={REASON_OPTIONS}
          durations={DURATION_OPTIONS}
          defaultDuration="7"
          noteMax={REPORT_DETAILS_MAX}
          pending={pending}
          error={error}
          onConfirm={confirm}
          onCancel={() => {
            setError(null);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

type LiftProps = {
  userId: string;
  onLift: (input: { userId: string }) => Promise<Result>;
};

export function LiftSuspensionButton({ userId, onLift }: LiftProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function lift() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onLift({ userId });
        if (!result.ok) setError(result.error);
      } catch {
        setError(GENERIC_ERROR);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={lift}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "border border-border",
        )}
      >
        Lift suspension
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
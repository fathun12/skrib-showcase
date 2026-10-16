"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";

export type ModerationReasonOption = { value: string; label: string };

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  reasons: ModerationReasonOption[];
  // Optional choice of duration (suspension). Without it, no choice is shown
  // and the third argument of onConfirm is an empty string.
  durations?: ModerationReasonOption[];
  defaultDuration?: string;
  noteMax: number;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string, note: string, duration: string) => void;
  onCancel: () => void;
};

// Asks for the reason (required) and an optional note before a moderation
// action. Props only: it knows nothing about posts or Server Actions.
// The parent mounts it when needed, so every opening starts empty.
export function ModerationDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  reasons,
  durations,
  defaultDuration,
  noteMax,
  pending,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(
    defaultDuration ?? durations?.[0]?.value ?? "",
  );
  const [note, setNote] = useState("");
  const titleId = useId();
  const noteId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: the parent unmounts the dialog.
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-background p-5 text-foreground backdrop:bg-black/50"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (reason && !pending) onConfirm(reason, note.trim(), duration);
        }}
      >
        <h2 id={titleId} className="font-serif text-xl font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Reason (required)</legend>
          <div className="mt-2 space-y-1">
            {reasons.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  disabled={pending}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {durations && durations.length > 0 ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Duration</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {durations.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="duration"
                    value={option.value}
                    checked={duration === option.value}
                    onChange={() => setDuration(option.value)}
                    disabled={pending}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <label htmlFor={noteId} className="mt-4 block text-sm font-medium">
          Note for the author (optional)
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={noteMax}
          rows={3}
          disabled={pending}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {note.length}/{noteMax}
        </p>

        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "border border-border",
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason || pending}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "border border-border",
              destructive && "text-destructive",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  noteMax: number;
  pending: boolean;
  error: string | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
};

// Asks for a required note before a legal hold is put on or released.
// Props only. The parent mounts it when needed, so every opening starts empty.
export function NoteHoldDialog({
  title,
  description,
  confirmLabel,
  noteMax,
  pending,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const titleId = useId();
  const noteId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const trimmed = note.trim();

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
          if (trimmed && !pending) onConfirm(trimmed);
        }}
      >
        <h2 id={titleId} className="font-serif text-xl font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <label htmlFor={noteId} className="mt-4 block text-sm font-medium">
          Note (required)
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
            disabled={!trimmed || pending}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "border border-border",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
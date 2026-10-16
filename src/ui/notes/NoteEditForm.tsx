import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import { fieldClass } from "@/ui/primitives/field";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  maxLength: number;
  pending?: boolean;
  error?: string | null;
};

// The text of a note turned into a small editor, in place. Escape cancels,
// Ctrl or Cmd + Enter saves.
export function NoteEditForm({
  value,
  onChange,
  onSave,
  onCancel,
  maxLength,
  pending = false,
  error,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const empty = value.trim() === "";

  // Focus the box once, with the caret at the end.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
    } else if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !pending &&
      !empty
    ) {
      event.preventDefault();
      onSave();
    }
  }

  return (
    <div className="mt-1 grid gap-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          aria-label="Edit your note"
          value={value}
          maxLength={maxLength}
          rows={4}
          disabled={pending}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(fieldClass, "resize-none pb-7")}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground"
        >
          {value.length}/{maxLength}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full px-4"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-full px-5"
          disabled={pending || empty}
          onClick={onSave}
        >
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
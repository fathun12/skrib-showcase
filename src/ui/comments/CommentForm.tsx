import { Button } from "@/ui/primitives/button";
import {
  MentionTextarea,
  type MentionTextareaProps,
} from "@/ui/notes/MentionTextarea";

export type CommentFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  // Shown only when given (reply forms have a Cancel button).
  onCancel?: () => void;
  pending?: boolean;
  error?: string | null;
  maxLength: number;
  // Also the accessible name of the textarea.
  label: string;
  placeholder?: string;
  submitLabel: string;
  autoFocus?: boolean;
  // @mention suggestions (optional), loaded by the parent.
  mention?: MentionTextareaProps["mention"];
};

export function CommentForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  pending = false,
  error,
  maxLength,
  label,
  placeholder,
  submitLabel,
  autoFocus,
  mention,
}: CommentFormProps) {
  const empty = value.trim() === "";

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && !empty) onSubmit();
      }}
    >
      <MentionTextarea
        label={label}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        mention={mention}
        rows={3}
        disabled={pending}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {value.length >= maxLength * 0.8
            ? `${value.length}/${maxLength}`
            : ""}
        </p>
        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={pending || empty}>
            {pending ? "Sending..." : submitLabel}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
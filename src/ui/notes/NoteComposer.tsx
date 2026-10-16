import { ChevronDown, Globe, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";
import { Button } from "@/ui/primitives/button";
import {
  MentionTextarea,
  type MentionSuggestion,
} from "@/ui/notes/MentionTextarea";
import {
  NoteImagePicker,
  type NoteImagePickerProps,
} from "@/ui/notes/NoteImagePicker";

export type NoteComposerPolicy = "everyone" | "following" | "nobody";

export const POLICY_OPTIONS: { value: NoteComposerPolicy; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People I follow" },
  { value: "nobody", label: "Nobody" },
];

const POLICY_ICONS = {
  everyone: Globe,
  following: Users,
  nobody: Lock,
} satisfies Record<NoteComposerPolicy, typeof Globe>;

// Kept here so older imports of the type keep working.
export type { MentionSuggestion };

export type NoteComposerProps = {
  value: string;
  onChange: (value: string) => void;
  policy: NoteComposerPolicy;
  onPolicyChange: (policy: NoteComposerPolicy) => void;
  onSubmit: () => void;
  pending?: boolean;
  error?: string | null;
  maxLength: number;
  // Also the accessible name of the textarea.
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  // @mention suggestions (optional). The parent loads them: onQuery gets
  // what was typed after the @ (may be empty), or null when no mention is
  // being typed.
  mention?: {
    suggestions: MentionSuggestion[];
    onQuery: (prefix: string | null) => void;
  };
  // Images (optional): the parent uploads them, this only shows them.
  images?: NoteImagePickerProps;
  // The writer's avatar at the left of the box (optional).
  author?: { displayName: string; avatarUrl: string | null };
};

export function NoteComposer({
  value,
  onChange,
  policy,
  onPolicyChange,
  onSubmit,
  pending = false,
  error,
  maxLength,
  label = "Write a note",
  placeholder = "Share a short thought...",
  submitLabel = "Post",
  mention,
  images,
  author,
}: NoteComposerProps) {
  const empty = value.trim() === "";

  // Who can reply: a quiet button (indigo text, an icon in front, no border).
  // The list that opens is the browser's own, so it works everywhere.
  const PolicyIcon = POLICY_ICONS[policy];
  const policyControl = (
    <label className="relative inline-flex items-center rounded-full text-primary hover:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-ring">
      <PolicyIcon
        className="pointer-events-none absolute left-2.5 size-4"
        aria-hidden="true"
      />
      <select
        aria-label="Who can reply"
        value={policy}
        disabled={pending}
        onChange={(event) =>
          onPolicyChange(event.target.value as NoteComposerPolicy)
        }
        className="field-sizing-content cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pr-7 pl-8 text-sm font-medium outline-none disabled:opacity-60"
      >
        {POLICY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} can reply
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5"
        aria-hidden="true"
      />
    </label>
  );

  // Counter and Post button, at the right.
  const trailing = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "text-xs tabular-nums",
          value.length >= maxLength * 0.9
            ? "text-destructive"
            : value.length >= maxLength * 0.8
              ? "text-foreground"
              : "text-muted-foreground/70",
        )}
      >
        {value.length}/{maxLength}
      </span>
      <Button
        type="submit"
        size="lg"
        className="rounded-full px-5"
        disabled={pending || empty || images?.uploading === true}
      >
        {pending ? "Posting..." : submitLabel}
      </Button>
    </>
  );

  return (
    <form
      className="flex gap-3 border-b border-border pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending && !empty) onSubmit();
      }}
    >
      {author ? (
        <Avatar
          name={author.displayName}
          src={author.avatarUrl}
          size="md"
          className="mt-1 shrink-0"
        />
      ) : null}
      <div className="grid min-w-0 flex-1 gap-3">
        <MentionTextarea
          label={label}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          mention={mention}
          rows={2}
          disabled={pending}
          placeholder={placeholder}
          className="block max-h-72 min-h-16 w-full resize-none bg-transparent text-lg leading-relaxed text-foreground field-sizing-content placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        {images ? (
          <NoteImagePicker
            {...images}
            disabled={pending || images.disabled}
            actions={policyControl}
            trailing={trailing}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {policyControl}
            <div className="ml-auto flex items-center gap-3">{trailing}</div>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
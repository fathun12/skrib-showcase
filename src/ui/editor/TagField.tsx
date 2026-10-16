"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldBoxClass, labelClass } from "@/ui/primitives/field";
import {
  normalizeTag,
  tagLabel,
  TAG_MAX_COUNT,
  TAG_MAX_LENGTH,
  TAG_MIN_LENGTH,
} from "@/ui/tags";

export type TagSuggestionItem = { tag: string; count: number };

type Props = {
  tags: string[];
  suggestions?: TagSuggestionItem[];
  // Title above the suggestions, for example "Popular topics".
  suggestionsLabel?: string;
  // Error from the parent (for example a refused save).
  error?: string | null;
  disabled?: boolean;
  id?: string;
  onChange: (tags: string[]) => void;
  // Called with what the author is typing ("" when the box is empty), so the
  // parent can load matching suggestions.
  onQuery?: (prefix: string) => void;
};

// Chips plus a text box. Enter or a comma adds a topic, Backspace on an empty
// box removes the last one. The parent owns the list; this keeps only the
// text being typed.
export function TagField({
  tags,
  suggestions = [],
  suggestionsLabel = "Popular topics",
  error,
  disabled = false,
  id = "tag-field",
  onChange,
  onQuery,
}: Props) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const full = tags.length >= TAG_MAX_COUNT;

  function setText(value: string) {
    setDraft(value);
    onQuery?.(value);
  }

  // Adds one topic. Returns the same array when nothing was added.
  function add(raw: string, current: string[]): string[] {
    if (raw.trim() === "") return current;
    const tag = normalizeTag(raw);
    if (!tag) {
      setLocalError(
        `A topic needs ${TAG_MIN_LENGTH} to ${TAG_MAX_LENGTH} letters or numbers.`,
      );
      return current;
    }
    if (current.includes(tag)) {
      setLocalError(null);
      return current;
    }
    if (current.length >= TAG_MAX_COUNT) {
      setLocalError(`You can add up to ${TAG_MAX_COUNT} topics.`);
      return current;
    }
    setLocalError(null);
    return [...current, tag];
  }

  function commit(raw: string) {
    const next = add(raw, tags);
    if (next !== tags) onChange(next);
    if (raw.trim() === "" || next !== tags || normalizeTag(raw) !== null) {
      setText("");
    }
  }

  function handleChange(value: string) {
    setLocalError(null);
    if (!value.includes(",")) {
      setText(value);
      return;
    }
    // A comma finishes every part before it; the rest stays in the box.
    const parts = value.split(",");
    const rest = parts.pop() ?? "";
    let next = tags;
    for (const part of parts) next = add(part, next);
    if (next !== tags) onChange(next);
    setText(rest);
  }

  function remove(tag: string) {
    setLocalError(null);
    onChange(tags.filter((item) => item !== tag));
  }

  const shown = full
    ? []
    : suggestions.filter((item) => !tags.includes(item.tag));
  const message = localError ?? error;

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          Topics{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {tags.length} of {TAG_MAX_COUNT}
        </span>
      </div>

      <div
        className={cn(
          fieldBoxClass,
          "w-full flex-none flex-wrap gap-1.5 px-2.5 py-2",
          disabled && "opacity-60",
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full bg-accent py-0.5 pr-1 pl-3 text-sm text-primary"
          >
            {tagLabel(tag)}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${tagLabel(tag)}`}
              onClick={() => remove(tag)}
              className="flex size-5 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled || full}
          placeholder={
            tags.length === 0
              ? "Add a topic, then press Enter"
              : full
                ? "Limit reached"
                : undefined
          }
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              // Never submit the dialog form from here.
              event.preventDefault();
              commit(draft);
            } else if (
              event.key === "Backspace" &&
              draft === "" &&
              tags.length > 0
            ) {
              remove(tags[tags.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim() !== "") commit(draft);
          }}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      {shown.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">{suggestionsLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((item) => (
              <button
                key={item.tag}
                type="button"
                disabled={disabled}
                // Keep the focus in the box: a blur would add a half-typed topic.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(item.tag)}
                className="inline-flex items-center gap-1 rounded-full border border-border/70 py-0.5 pr-2.5 pl-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary disabled:opacity-60"
              >
                <Plus className="size-3" aria-hidden="true" />
                {tagLabel(item.tag)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
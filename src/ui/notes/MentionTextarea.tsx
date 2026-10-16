"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";

export type MentionSuggestion = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  // The parent loads the people: onQuery gets what was typed after the @
  // (may be empty), or null when no mention is being typed.
  mention?: {
    suggestions: MentionSuggestion[];
    onQuery: (prefix: string | null) => void;
  };
  id?: string;
  // Accessible name; leave out when a <label htmlFor> names the textarea.
  label?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  // Classes of the textarea itself.
  className?: string;
};

// The @word right before the caret. Keep in sync with MENTION_PATTERN in
// NoteBody.tsx (same characters before the @ and in the name).
const MENTION_TYPING = /(^|[^\p{L}\p{N}_&/@-])@([a-z0-9_-]{0,30})$/iu;

function mentionQueryAt(text: string, caret: number): string | null {
  const match = MENTION_TYPING.exec(text.slice(0, caret));
  return match ? match[2].toLowerCase() : null;
}

// A textarea with the @mention suggestion list (arrows, Enter or Tab to
// pick, Esc to close). Shared by the note composer and the quote dialog.
export function MentionTextarea({
  value,
  onChange,
  maxLength,
  mention,
  id,
  label,
  rows = 2,
  disabled = false,
  autoFocus,
  placeholder,
  className,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  // null = no @word is being typed.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  // Esc closes the list until the typed word changes.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const suggestions = mention?.suggestions ?? [];
  const open =
    mention !== undefined &&
    query !== null &&
    dismissedFor !== query &&
    suggestions.length > 0;
  const activeIndex = Math.min(active, Math.max(suggestions.length - 1, 0));

  function detect(text: string, caret: number) {
    if (!mention) return;
    const next = mentionQueryAt(text, caret);
    if (next === query) return;
    setQuery(next);
    setActive(0);
    mention.onQuery(next);
  }

  function close() {
    if (query === null) return;
    setQuery(null);
    mention?.onQuery(null);
  }

  // Replaces "@typed" before the caret with "@username " and puts the caret
  // after it.
  function pick(suggestion: MentionSuggestion) {
    const textarea = textareaRef.current;
    if (!textarea || query === null) return;
    const caret = textarea.selectionStart;
    const start = caret - query.length - 1;
    const insert = `@${suggestion.username} `;
    const next = value.slice(0, start) + insert + value.slice(caret);
    if (next.length > maxLength) return;
    onChange(next);
    close();
    const position = start + insert.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      // Closes the list only, not a dialog around the textarea.
      event.preventDefault();
      event.stopPropagation();
      setDismissedFor(query);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        aria-label={label}
        aria-autocomplete={mention ? "list" : undefined}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          detect(event.target.value, event.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          // The caret moved without typing: check the word under it again.
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            detect(
              event.currentTarget.value,
              event.currentTarget.selectionStart,
            );
          }
        }}
        onClick={(event) =>
          detect(event.currentTarget.value, event.currentTarget.selectionStart)
        }
        onBlur={close}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={className}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute top-full left-0 z-30 mt-1 w-72 max-w-full overflow-hidden rounded-xl border border-border bg-background/95 p-1 backdrop-blur"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.username}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              // mousedown (not click) keeps the focus in the textarea.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors motion-reduce:transition-none",
                index === activeIndex && "bg-accent",
              )}
            >
              <Avatar
                name={suggestion.displayName}
                src={suggestion.avatarUrl}
                size="sm"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {suggestion.displayName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{suggestion.username}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
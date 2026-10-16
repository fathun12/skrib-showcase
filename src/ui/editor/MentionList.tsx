"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";

export type MentionListItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MentionListProps = {
  items: MentionListItem[];
  onSelect: (item: MentionListItem) => void;
};

export type MentionListHandle = {
  // Returns true when the list used the key (the editor then ignores it).
  onKeyDown: (event: KeyboardEvent) => boolean;
};

// The suggestion list under the caret when a writer types @ in a story.
// Keys are forwarded by the editor (the focus never leaves the text), so this
// list handles arrows, Enter and Tab through the ref.
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ items, onSelect }, ref) {
    const [selected, setSelected] = useState(0);
    // A new list starts at the first row (adjusting state while rendering is
    // the documented way to reset state when a prop changes).
    const [seen, setSeen] = useState(items);
    if (items !== seen) {
      setSeen(items);
      setSelected(0);
    }
    const active = Math.min(selected, Math.max(items.length - 1, 0));

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown(event) {
          if (items.length === 0) return false;
          if (event.key === "ArrowDown") {
            setSelected((active + 1) % items.length);
            return true;
          }
          if (event.key === "ArrowUp") {
            setSelected((active - 1 + items.length) % items.length);
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            onSelect(items[active]);
            return true;
          }
          return false;
        },
      }),
      [items, active, onSelect],
    );

    if (items.length === 0) return null;

    return (
      <ul
        role="listbox"
        aria-label="Mention suggestions"
        className="w-72 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            role="option"
            aria-selected={index === active}
            // mousedown (not click) keeps the focus in the editor.
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => setSelected(index)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors motion-reduce:transition-none",
              index === active && "bg-accent",
            )}
          >
            <Avatar name={item.displayName} src={item.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {item.displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{item.username}
              </span>
            </span>
          </li>
        ))}
      </ul>
    );
  },
);
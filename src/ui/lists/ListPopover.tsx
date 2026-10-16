"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import { fieldClass } from "@/ui/primitives/field";
import { Tooltip } from "@/ui/primitives/tooltip";

export type ListPopoverItem = { id: string; name: string; member: boolean };

export type ListPopoverProps = {
  // null until the lists have loaded.
  lists: ListPopoverItem[] | null;
  error?: string | null;
  pendingId?: string | null;
  newName: string;
  nameMax: number;
  creating?: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (listId: string, member: boolean) => void;
  onNewNameChange: (name: string) => void;
  onCreate: () => void;
};

// The small arrow next to "Saved" and the box it opens: tick the lists this
// story belongs to, or make a new one.
export function ListPopover({
  lists,
  error,
  pendingId = null,
  newName,
  nameMax,
  creating = false,
  onOpenChange,
  onToggle,
  onNewNameChange,
  onCreate,
}: ListPopoverProps) {
  return (
    <Popover.Root onOpenChange={(open) => onOpenChange(open)}>
      <Tooltip label="Add to a list">
        <Popover.Trigger
          aria-label="Add to a list"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-popup-open:bg-accent data-popup-open:text-primary motion-reduce:transition-none"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            className={cn(
              "w-64 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none",
              "transition-[transform,opacity] duration-150 ease-out",
              "data-starting-style:scale-95 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-ending-style:opacity-0",
              "motion-reduce:transition-none",
            )}
          >
            <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
              Add to a list
            </p>

            {error ? (
              <p role="alert" className="px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {lists === null ? (
              error ? null : (
                <p
                  role="status"
                  className="px-3 py-3 text-sm text-muted-foreground"
                >
                  Loading...
                </p>
              )
            ) : lists.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                No lists yet. Create your first one below.
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {lists.map((list) => (
                  <li key={list.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent has-focus-visible:ring-4 has-focus-visible:ring-primary/15">
                      <input
                        type="checkbox"
                        checked={list.member}
                        disabled={pendingId === list.id}
                        onChange={(event) =>
                          onToggle(list.id, event.target.checked)
                        }
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {list.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="mt-1 flex items-center gap-2 border-t border-border/70 px-1 pt-2"
              onSubmit={(event) => {
                event.preventDefault();
                onCreate();
              }}
            >
              <input
                type="text"
                value={newName}
                maxLength={nameMax}
                disabled={creating}
                placeholder="New list"
                aria-label="New list name"
                onChange={(event) => onNewNameChange(event.target.value)}
                className={`${fieldClass} min-w-0 flex-1 py-2`}
              />
              <Button
                type="submit"
                size="sm"
                className="rounded-full"
                disabled={creating || newName.trim().length === 0}
              >
                Create
              </Button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ListChip = { id: string; name: string; count: number };

export type ListChipsProps = {
  lists: ListChip[];
  // Number of stories under "All".
  total: number;
  // The list being shown, or null for "All".
  activeId: string | null;
  // The "New list" button and the list menu (client components of the page).
  actions?: ReactNode;
};

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none";
const IDLE =
  "border-border text-muted-foreground hover:bg-muted hover:text-foreground";
const ACTIVE = "border-transparent bg-accent font-medium text-primary";

// The row of lists above the saved stories: All, each list, then the actions.
export function ListChips({ lists, total, activeId, actions }: ListChipsProps) {
  return (
    <nav aria-label="Your lists" className="mb-6 flex flex-wrap items-center gap-2">
      <Link
        href="/me/saved"
        aria-current={activeId === null ? "page" : undefined}
        className={cn(CHIP, activeId === null ? ACTIVE : IDLE)}
      >
        All
        <span className="text-xs font-normal text-muted-foreground">{total}</span>
      </Link>
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/me/saved?list=${list.id}`}
          aria-current={activeId === list.id ? "page" : undefined}
          className={cn(CHIP, activeId === list.id ? ACTIVE : IDLE)}
        >
          <span className="max-w-40 truncate">{list.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {list.count}
          </span>
        </Link>
      ))}
      {actions}
    </nav>
  );
}
import Link from "next/link";
import { cn } from "@/lib/utils";

export type OwnPostsTab = "drafts" | "published" | "series" | "shared";

const TABS = [
  { id: "drafts", label: "Drafts", href: "/me/posts" },
  { id: "published", label: "Published", href: "/me/posts?tab=published" },
  { id: "series", label: "Series", href: "/me/posts?tab=series" },
  { id: "shared", label: "Shared with me", href: "/me/posts?tab=shared" },
] as const;

type Props = {
  active: OwnPostsTab;
  // Pending invitations; shown as a small number on the "Shared with me" tab.
  pendingInvites?: number;
};

export function OwnPostsTabs({ active, pendingInvites = 0 }: Props) {
  return (
    <nav aria-label="Post lists" className="flex gap-6 border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 pb-3 text-sm font-medium",
            tab.id === active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.id === "shared" && pendingInvites > 0 && (
            <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              <span aria-hidden="true">{pendingInvites}</span>
              <span className="sr-only"> pending invitations</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
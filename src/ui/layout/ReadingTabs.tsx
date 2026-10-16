import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "saved", href: "/me/saved", label: "Saved" },
  { id: "highlights", href: "/me/highlights", label: "Highlights" },
] as const;

export type ReadingTabsProps = {
  active: (typeof TABS)[number]["id"];
};

// A flat two-link switch under the title of the two "my reading" pages.
export function ReadingTabs({ active }: ReadingTabsProps) {
  return (
    <nav
      aria-label="Your reading"
      className="mb-6 flex gap-5 border-b border-border text-sm"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 pb-2 transition-colors motion-reduce:transition-none",
            tab.id === active
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ProfileTab = "stories" | "notes" | "series" | "reposts";

export function ProfileTabs({
  active,
  username,
}: {
  active: ProfileTab;
  username: string;
}) {
  const tabs = [
    { id: "stories", label: "Stories", href: `/${username}` },
    { id: "notes", label: "Notes", href: `/${username}?tab=notes` },
    { id: "series", label: "Series", href: `/${username}?tab=series` },
    { id: "reposts", label: "Reposts", href: `/${username}?tab=reposts` },
  ] as const;

  return (
    <nav
      aria-label="Profile sections"
      className="mb-2 flex gap-6 border-b border-border"
    >
      {tabs.map((tab) => (
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
        </Link>
      ))}
    </nav>
  );
}
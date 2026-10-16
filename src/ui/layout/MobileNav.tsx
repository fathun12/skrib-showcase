import Link from "next/link";
import { Bell, Bookmark, FileText, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileNavProps = {
  // The current path, to mark the matching item.
  pathname: string;
  // Shorter bar without labels, used while the page is scrolled down.
  compact: boolean;
  // New notifications for the bell; 0 or missing = no badge.
  unreadCount?: number;
};

// Same order as the header on larger screens.
const ITEMS = [
  { href: "/me/posts", label: "My posts", Icon: FileText },
  { href: "/me/notifications", label: "Notifications", Icon: Bell },
  { href: "/me/saved", label: "Saved", Icon: Bookmark },
  { href: "/write", label: "Write", Icon: PenLine },
] as const;

// A floating glass bar at the bottom of the screen (below sm only). The
// glass look is blur + saturation + a light edge + inner shadows; the real
// refraction of Apple's Liquid Glass is not possible in plain CSS.
export function MobileNav({
  pathname,
  compact,
  unreadCount = 0,
}: MobileNavProps) {
  return (
    <nav
      aria-label="Quick links"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <ul
        style={{ transform: compact ? "scale(0.94)" : "none" }}
        className="origin-bottom transition-transform duration-300 ease-out motion-reduce:transition-none pointer-events-auto flex items-center gap-1 rounded-full border border-white/25 bg-background/80 p-1.5 shadow-[inset_0_1px_1px_rgb(255_255_255/0.5),inset_0_-1px_1px_rgb(0_0_0/0.12),0_8px_30px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150 supports-backdrop-filter:bg-background/45">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const isBell = href === "/me/notifications";
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  isBell && unreadCount > 0
                    ? `Notifications, ${unreadCount} new`
                    : undefined
                }
                className={cn(
                  "flex flex-col items-center rounded-full px-3 text-[11px] leading-tight transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
                  compact ? "min-w-14 py-2.5" : "min-w-17 py-1.5",
                  active
                    ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_1px_rgb(255_255_255/0.35)]"
                    : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden="true" />
                  {isBell && unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "grid transition-all duration-300 ease-out motion-reduce:transition-none",
                    compact
                      ? "grid-rows-[0fr] opacity-0"
                      : "grid-rows-[1fr] pt-0.5 opacity-100",
                  )}
                >
                  <span className="overflow-hidden whitespace-nowrap">
                    {label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
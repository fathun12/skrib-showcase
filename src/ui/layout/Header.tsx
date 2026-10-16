import Link from "next/link";
import {
  Bell,
  Bookmark,
  FileText,
  LogOut,
  PenLine,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";
import { buttonVariants } from "@/ui/primitives/button";
import { Container } from "./Container";
import { HeaderAutoHide } from "./HeaderAutoHide";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export type HeaderProps = {
  user?: {
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
  signOutAction?: () => Promise<void>;
  // New notifications for the bell; 0 or missing = no badge.
  unreadCount?: number;
  // Shows the Moderation link. Only the layout sets this, from the database.
  isAdmin?: boolean;
  // Open reports that wait for a decision; shown on the Moderation link.
  // 0 or missing = no badge.
  moderationCount?: number;
};

// On small screens (below sm) the links My posts, Notifications, Saved and
// Write are not in this header: they live in the bottom bar (MobileNav).
// The Moderation link (admins only) stays here as an icon, because the
// bottom bar has no room for a fifth item.
export function Header({
  user,
  signOutAction,
  unreadCount = 0,
  isAdmin = false,
  moderationCount = 0,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur transition-transform duration-200 motion-reduce:transition-none [html[data-focus=true]_&]:hidden [html[data-header-hidden=true]_&:not(:has(:focus-visible))]:-translate-y-full">
      <HeaderAutoHide />
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center rounded-sm">
          <Logo />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-2">
          <ThemeToggle />
          {/* Outside the signed-in branch: visitors search too. */}
          <Link
            href="/search"
            aria-label="Search"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Search className="size-4" />
          </Link>
          {user ? (
            <>
              <Link
                href="/me/posts"
                aria-label="My posts"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "max-sm:hidden",
                )}
              >
                <FileText className="size-4" />
                <span className="hidden sm:inline">My posts</span>
              </Link>
              <Link
                href="/me/notifications"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} new`
                    : "Notifications"
                }
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "relative max-sm:hidden",
                )}
              >
                <Bell className="size-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/me/saved"
                aria-label="Saved posts"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "max-sm:hidden",
                )}
              >
                <Bookmark className="size-4" />
                <span className="hidden sm:inline">Saved</span>
              </Link>
              {isAdmin ? (
                <Link
                  href="/admin/moderation"
                  aria-label={
                    moderationCount > 0
                      ? `Moderation, ${moderationCount} ${moderationCount === 1 ? "item" : "items"} waiting`
                      : "Moderation"
                  }
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "relative",
                  )}
                >
                  <ShieldCheck className="size-4" />
                  <span className="hidden sm:inline">Moderation</span>
                  {moderationCount > 0 ? (
                    <span
                      aria-hidden="true"
                      className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white max-sm:absolute max-sm:-top-1 max-sm:-right-1"
                    >
                      {moderationCount > 99 ? "99+" : moderationCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <Link
                href="/write"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "max-sm:hidden",
                )}
              >
                <PenLine className="size-4" />
                Write
              </Link>
              <Link
                href={`/${user.username}`}
                aria-label="Your profile"
                className="rounded-full"
              >
                <Avatar
                  name={user.displayName}
                  src={user.avatarUrl}
                  size="md"
                />
              </Link>
              {signOutAction && (
                <form action={signOutAction}>
                  {/* Small screens: icon only. From sm up: the text button. */}
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "sm:hidden",
                    )}
                  >
                    <LogOut className="size-4" />
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "max-sm:hidden",
                    )}
                  >
                    Sign out
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "max-sm:hidden",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
import { Compass, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type NoteFeed = "latest" | "following" | "popular";

const CHIPS: {
  feed: NoteFeed;
  label: string;
  href: string;
  signedInOnly: boolean;
}[] = [
  { feed: "latest", label: "Latest", href: "/?tab=notes", signedInOnly: false },
  {
    feed: "following",
    label: "Following",
    href: "/?tab=notes&feed=following",
    signedInOnly: true,
  },
  {
    feed: "popular",
    label: "Popular",
    href: "/?tab=notes&feed=popular",
    signedInOnly: false,
  },
];

// The lists of the Notes tab as small pills. Pure UI: the page decides which
// one is active. Following is shown only to a signed-in person.
export function NoteFeedChips({
  active,
  signedIn,
}: {
  active: NoteFeed;
  signedIn: boolean;
}) {
  return (
    <nav aria-label="Note lists" className="mb-2 flex gap-2">
      {CHIPS.filter((chip) => signedIn || !chip.signedInOnly).map((chip) => (
        <Link
          key={chip.feed}
          href={chip.href}
          aria-current={chip.feed === active ? "page" : undefined}
          className={cn(
            "inline-block rounded-full border px-3 py-1 text-sm transition-colors",
            chip.feed === active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {chip.label}
        </Link>
      ))}
      <Link
        href="/notes/explore"
        aria-label="Explore notes"
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none sm:px-3"
      >
        <Compass className="size-4" aria-hidden="true" />
        <span className="max-sm:sr-only">Explore</span>
      </Link>
      <Link
        href="/notes/search"
        aria-label="Search notes"
        className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <Search className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
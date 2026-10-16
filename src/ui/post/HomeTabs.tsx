import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollActiveTab } from "@/ui/post/ScrollActiveTab";

export type HomeTab =
  | "latest"
  | "popular"
  | "foryou"
  | "following"
  | "topics"
  | "notes";

const STORY_TABS = [
  { id: "latest", label: "Latest", href: "/" },
  { id: "popular", label: "Popular", href: "/?tab=popular" },
  { id: "foryou", label: "For you", href: "/?tab=foryou" },
  { id: "following", label: "Following", href: "/?tab=following" },
  { id: "topics", label: "Topics", href: "/?tab=topics" },
] as const;

const SWITCH_BASE =
  "rounded-full px-4 py-1 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function HomeTabs({
  active,
  signedIn,
  showFollowingDot = false,
}: {
  active: HomeTab;
  signedIn: boolean;
  // A small dot on the Following tab: someone I follow published something new.
  showFollowingDot?: boolean;
}) {
  const inNotes = active === "notes";
  // Following, Topics and For you need an account; Latest and Popular are for everyone.
  const tabs = STORY_TABS.filter(
    (tab) =>
      signedIn ||
      (tab.id !== "following" && tab.id !== "topics" && tab.id !== "foryou"),
  );
  return (
    <div>
      {/* Two kinds of content: stories and notes. */}
      <nav
        aria-label="Home sections"
        className="mb-3 inline-flex rounded-full border border-border bg-surface p-0.5 text-sm"
      >
        <Link
          href="/"
          aria-current={inNotes ? undefined : "page"}
          className={cn(
            SWITCH_BASE,
            inNotes
              ? "text-muted-foreground hover:text-foreground"
              : "bg-accent text-primary",
          )}
        >
          Stories
        </Link>
        <Link
          href="/?tab=notes"
          aria-current={inNotes ? "page" : undefined}
          className={cn(
            SWITCH_BASE,
            inNotes
              ? "bg-accent text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Notes
        </Link>
      </nav>
      {inNotes ? null : (
        // The nav is 4px wider on each side (-mx-1) and every tab has 4px of
        // side padding (px-1): the text stays aligned with the cards, and the
        // focus ring has room inside the scroll area, which would clip it.
        <nav
          aria-label="Home feed"
          className="-mx-1 flex gap-3 overflow-x-auto whitespace-nowrap shadow-[inset_0_-1px_0_var(--color-border)] sm:gap-4 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-1 pb-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                tab.id === active
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                data-label={tab.label}
                className="inline-block after:invisible after:block after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)]"
              >
                {tab.label}
              </span>
              {tab.id === "following" && showFollowingDot ? (
                <>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-primary"
                  />
                  <span className="sr-only">(new stories)</span>
                </>
              ) : null}
            </Link>
          ))}
          <ScrollActiveTab activeId={active} />
        </nav>
      )}
    </div>
  );
}
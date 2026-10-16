import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getCurrentUser } from "@/features/auth/queries";
import { NotePagedList } from "@/features/notes/NotePagedList";
import {
  listPopularNotes,
  listTrendingNoteTags,
} from "@/features/notes/queries";
import { SEARCH_QUERY_MAX } from "@/features/search/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";
import { fieldClass } from "@/ui/primitives/field";

// Like /search: not indexed at first.
export const metadata: Metadata = {
  title: "Explore notes",
  robots: { index: false },
};

const POPULAR_PREVIEW = 5;

export default async function ExploreNotesPage() {
  const current = await getCurrentUser();
  const viewerId = current?.id ?? null;

  const [trending, popular] = await Promise.all([
    listTrendingNoteTags(viewerId),
    listPopularNotes(viewerId, POPULAR_PREVIEW),
  ]);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Explore
        </h1>
        {/* A plain GET form: it works without JavaScript (Enter submits). */}
        <form
          action="/notes/search"
          method="get"
          role="search"
          className="relative mt-4"
        >
          <label htmlFor="explore-q" className="sr-only">
            Search notes
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="explore-q"
            type="search"
            name="q"
            maxLength={SEARCH_QUERY_MAX}
            enterKeyHint="search"
            placeholder="Search notes"
            className={cn(fieldClass, "pl-9")}
          />
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/?tab=notes" className="hover:underline">
            Back to Notes
          </Link>
        </p>
      </header>

      <section aria-labelledby="explore-trending" className="mb-10">
        <h2
          id="explore-trending"
          className="mb-2 font-serif text-xl font-bold"
        >
          Trending hashtags
        </h2>
        {trending === null ? (
          <p role="alert" className="py-3 text-sm text-destructive">
            Could not load the trending hashtags.
          </p>
        ) : trending.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
            Nothing is trending yet. Use a hashtag in a note to start one.
          </p>
        ) : (
          <ul>
            {trending.map((item) => (
              <li key={item.tag}>
                <Link
                  href={`/notes/tag/${item.tag}`}
                  className="block rounded-xl px-3.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  <span className="block font-medium">#{item.tag}</span>
                  <span className="block text-sm text-muted-foreground">
                    {item.noteCount} {item.noteCount === 1 ? "note" : "notes"}{" "}
                    in the last 2 days
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="explore-popular">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="explore-popular" className="font-serif text-xl font-bold">
            Popular now
          </h2>
          <Link
            href="/?tab=notes&feed=popular"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full",
            )}
          >
            See all
          </Link>
        </div>
        {popular === null ? (
          <p role="alert" className="py-6 text-sm text-destructive">
            Could not load the popular notes.
          </p>
        ) : popular.items.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
            Nothing popular in the last week yet.
          </p>
        ) : (
          <NotePagedList
            initialNotes={popular.items}
            initialCursor={null}
            feed={{ kind: "popular" }}
            currentUserId={current?.id ?? null}
            returnPath="/notes/explore"
          />
        )}
      </section>
    </div>
  );
}
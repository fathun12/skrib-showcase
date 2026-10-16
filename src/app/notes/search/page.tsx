import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/queries";
import { NotePagedList } from "@/features/notes/NotePagedList";
import { searchNotes } from "@/features/notes/queries";
import {
  cleanSearchQuery,
  parseSearchPage,
  SEARCH_MAX_PAGE,
  SEARCH_QUERY_MAX,
  SEARCH_QUERY_MIN,
} from "@/features/search/queries";
import { buttonVariants } from "@/ui/primitives/button";

// Like /search: result pages must not end up in Google.
export const metadata: Metadata = {
  title: "Search notes",
  robots: { index: false },
};

// In Next.js 16, `searchParams` is a Promise and must be awaited.
type Props = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
  }>;
};

export default async function SearchNotesPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = cleanSearchQuery(
    typeof params.q === "string" ? params.q : undefined,
  );
  const page = parseSearchPage(
    typeof params.page === "string" ? params.page : undefined,
  );
  const hasQuery = query.length >= SEARCH_QUERY_MIN;

  const current = await getCurrentUser();
  const result = await searchNotes(query, page, current?.id ?? null);
  const notes = result?.items ?? [];

  function pageHref(target: number): string {
    const base = `/notes/search?q=${encodeURIComponent(query)}`;
    return target > 1 ? `${base}&page=${target}` : base;
  }

  const showPrevious = hasQuery && page > 1;
  const showNext = result !== null && result.hasMore && page < SEARCH_MAX_PAGE;

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Search notes
        </h1>
        {/* A plain GET form: it works without JavaScript. */}
        <form
          action="/notes/search"
          method="get"
          role="search"
          className="mt-4"
        >
          <label htmlFor="search-notes-q" className="sr-only">
            Search notes
          </label>
          <div className="flex gap-2">
            <input
              id="search-notes-q"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={SEARCH_QUERY_MAX}
              placeholder="Search notes"
              className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            />
            <button
              type="submit"
              className={buttonVariants({ variant: "default" })}
            >
              Search
            </button>
          </div>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/?tab=notes" className="hover:underline">
            Back to Notes
          </Link>
          {" · "}
          <Link
            href={hasQuery ? `/search?q=${encodeURIComponent(query)}` : "/search"}
            className="hover:underline"
          >
            Search stories instead
          </Link>
        </p>
      </header>

      {!hasQuery ? (
        <p className="py-12 text-center text-muted-foreground">
          Type at least 2 characters to search the notes.
        </p>
      ) : result === null ? (
        <p role="alert" className="py-12 text-center text-destructive">
          Search is not available right now.
        </p>
      ) : notes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {page > 1
              ? "No more results."
              : `Nothing found for “${query}”.`}
          </p>
          {page > 1 ? (
            <Link
              href={pageHref(1)}
              className="mt-4 inline-block text-primary hover:underline"
            >
              Back to the first results
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Try other words, or fewer of them.
            </p>
          )}
        </div>
      ) : (
        <NotePagedList
          // A new key starts the list fresh for each query and page.
          key={`${query}|${page}`}
          initialNotes={notes}
          // This page uses Previous and Next, so "Load more" never shows.
          initialCursor={null}
          feed={{ kind: "latest" }}
          currentUserId={current?.id ?? null}
          returnPath={pageHref(page)}
        />
      )}

      {notes.length > 0 && (showPrevious || showNext) ? (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between"
        >
          {showPrevious ? (
            <Link
              href={pageHref(page - 1)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          {showNext ? (
            <Link
              href={pageHref(page + 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
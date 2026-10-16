import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/queries";
import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { getProgressByPost } from "@/features/reading-progress/queries";
import { getRepostCounts } from "@/features/reposts/queries";
import {
  cleanSearchQuery,
  parseSearchPage,
  SEARCH_MAX_PAGE,
  SEARCH_QUERY_MAX,
  SEARCH_QUERY_MIN,
  searchPosts,
} from "@/features/search/queries";
import { getTagCounts } from "@/features/tags/queries";
import { searchPeople } from "@/features/search/people";
import {
  searchSnippets,
  suggestSearchQuery,
} from "@/features/search/snippets";
import { PostCard } from "@/ui/post/PostCard";
import { ProfileList } from "@/ui/profile/ProfileList";
import { buttonVariants } from "@/ui/primitives/button";
import { tagLabel } from "@/ui/tags";

// Search result pages must not end up in Google (robots.ts does not block
// the path, because a blocked page cannot show its noindex).
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

// In Next.js 16, `searchParams` is a Promise and must be awaited. Each value
// can also be an array (`?q=a&q=b`): only plain strings are used.
type Props = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
  }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = cleanSearchQuery(
    typeof params.q === "string" ? params.q : undefined,
  );
  const page = parseSearchPage(
    typeof params.page === "string" ? params.page : undefined,
  );
  const hasQuery = query.length >= SEARCH_QUERY_MIN;

  const current = await getCurrentUser();

  const [result, popularTags, people] = await Promise.all([
    searchPosts(query, page),
    hasQuery ? Promise.resolve(null) : getTagCounts("", 12),
    // People whose username starts with the words; first page only. An empty
    // text returns nothing without calling the database.
    searchPeople(hasQuery && page === 1 ? query : ""),
  ]);

  const posts = result?.posts ?? [];

  // "Did you mean": first page only, only when nothing was found, and only
  // when the corrected words find stories (a link to an empty page helps
  // nobody).
  let suggestion: string | null = null;
  if (hasQuery && page === 1 && result !== null && posts.length === 0) {
    const candidate = await suggestSearchQuery(query);
    if (candidate) {
      const check = await searchPosts(candidate, 1);
      if (check && check.posts.length > 0) suggestion = candidate;
    }
  }

  const postIds = posts.map((post) => post.id);
  const [likeCounts, commentCounts, repostCounts, progressMarks, snippets] =
    await Promise.all([
      getLikeCounts(postIds),
      getCommentCounts(postIds),
      getRepostCounts(postIds),
      // Signed-in readers only: the "N min left" mark on started stories.
      current ? getProgressByPost(current.id, posts) : Promise.resolve(null),
      // The text around the searched words, one call for the whole page.
      searchSnippets(postIds, query),
    ]);

  function pageHref(target: number, text: string = query): string {
    const base = `/search?q=${encodeURIComponent(text)}`;
    return target > 1 ? `${base}&page=${target}` : base;
  }

  const showPrevious = hasQuery && page > 1;
  const showNext = result !== null && result.hasMore && page < SEARCH_MAX_PAGE;

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Search
        </h1>
        {/* A plain GET form: it works without JavaScript. */}
        <form action="/search" method="get" role="search" className="mt-4">
          <label htmlFor="search-q" className="sr-only">
            Search stories
          </label>
          <div className="flex gap-2">
            <input
              id="search-q"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={SEARCH_QUERY_MAX}
              placeholder="Search stories, topics and people"
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
      </header>

      {people.length > 0 ? (
        <section aria-labelledby="search-people" className="mb-8">
          <h2
            id="search-people"
            className="text-sm font-medium text-muted-foreground"
          >
            People
          </h2>
          <ProfileList items={people} emptyText="" />
        </section>
      ) : null}

      {!hasQuery ? (
        popularTags && popularTags.length > 0 ? (
          <section aria-labelledby="popular-topics">
            <h2
              id="popular-topics"
              className="mb-3 text-sm font-medium text-muted-foreground"
            >
              Popular topics
            </h2>
            <ul className="flex flex-wrap gap-2">
              {popularTags.map(({ tag }) => (
                <li key={tag}>
                  <Link
                    href={`/tag/${tag}`}
                    className="inline-block rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {tagLabel(tag)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      ) : result === null ? (
        <p className="py-16 text-center text-muted-foreground">
          Search is not available right now.
        </p>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            {page > 1
              ? "No more results."
              : people.length > 0
                ? `No stories found for “${query}”.`
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
            <>
              {suggestion ? (
                <p className="mt-3 text-base">
                  Did you mean{" "}
                  <Link
                    href={pageHref(1, suggestion)}
                    className="font-medium text-primary hover:underline"
                  >
                    {suggestion}
                  </Link>
                  ?
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                Try other words, or fewer of them.
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              title={post.title}
              excerpt={post.excerpt}
              slug={post.slug}
              coverUrl={post.coverImageUrl}
              publishedAt={post.publishedAt}
              readingTimeMin={post.readingTimeMin}
              progress={progressMarks?.get(post.id)}
              likeCount={
                likeCounts ? (likeCounts.get(post.id) ?? 0) : undefined
              }
              commentCount={
                commentCounts ? (commentCounts.get(post.id) ?? 0) : undefined
              }
              repostCount={
                repostCounts ? (repostCounts.get(post.id) ?? 0) : undefined
              }
              authors={post.authors}
              snippet={snippets.get(post.id)}
            />
          ))}
        </div>
      )}

      {posts.length > 0 && (showPrevious || showNext) ? (
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
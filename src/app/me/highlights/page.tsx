import Link from "next/link";
import { requireUser } from "@/features/auth/queries";
import { exportHighlights } from "@/features/highlights/actions";
import { ExportButton } from "@/features/highlights/ExportButton";
import { suggestHighlightQuery } from "@/features/highlights/suggest";
import {
  getRememberedHighlight,
  listMyHighlightRows,
  cleanSearchTerm,
  type HighlightRowData,
} from "@/features/highlights/list-queries";
import {
  HIGHLIGHT_PAGE_SIZE,
  parseHighlightSearchParams,
} from "@/features/highlights/schemas";
import {
  listPublishedPostsByIds,
  type PublishedPostListItem,
} from "@/features/posts/queries";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS } from "@/ui/editor/colors";
import { HighlightRow } from "@/ui/highlights/HighlightRow";
import { RememberCard } from "@/ui/highlights/RememberCard";
import { StoryGroup } from "@/ui/highlights/StoryGroup";
import { ReadingTabs } from "@/ui/layout/ReadingTabs";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Group = {
  key: string;
  post: PublishedPostListItem | null;
  rows: HighlightRowData[];
};

// Builds a /me/highlights link from the current filters plus some changes.
// An empty or null value removes that parameter.
function buildHref(
  current: Record<string, string>,
  changes: Record<string, string | null>,
): string {
  const next = { ...current, ...changes };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) qs.set(key, value);
  }
  const text = qs.toString();
  return text ? `/me/highlights?${text}` : "/me/highlights";
}

function storyPath(post: PublishedPostListItem | null): string | null {
  const username = post?.authors[0]?.username;
  return post && username ? `/${username}/${post.slug}` : null;
}

// "Author name · 12 Oct 2026 · 2 highlights". The count is only given when the
// whole list is on this page (otherwise it would be a partial number).
function storyMeta(post: PublishedPostListItem, count: number | null): string {
  const date = new Date(post.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const parts = [post.authors[0]?.displayName, date];
  if (count !== null) {
    parts.push(`${count} ${count === 1 ? "highlight" : "highlights"}`);
  }
  return parts.filter(Boolean).join(" · ");
}

// Groups the rows by story in the order the stories first appear (newest
// highlight first). A story that is not published anymore goes into one
// "no longer available" group. Inside a story: order of the text.
function groupByStory(
  rows: HighlightRowData[],
  postById: Map<string, PublishedPostListItem>,
): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const post = postById.get(row.postId) ?? null;
    const key = post ? post.id : "gone";
    let group = groups.get(key);
    if (!group) {
      group = { key, post, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  for (const group of groups.values()) {
    group.rows.sort(
      (a, b) => a.blockIndex - b.blockIndex || a.startOffset - b.startOffset,
    );
  }
  return [...groups.values()];
}

export default async function HighlightsPage({ searchParams }: PageProps) {
  const user = await requireUser("/me/highlights");
  const params = await searchParams;
  const { filters, view } = parseHighlightSearchParams(params);

  const offsetRaw = Array.isArray(params.offset)
    ? params.offset[0]
    : params.offset;
  const offset = Math.min(
    100_000,
    Math.max(0, Math.floor(Number(offsetRaw) || 0)),
  );

  const result = await listMyHighlightRows(user.id, { ...filters, offset });
  const rows = result?.rows ?? [];

  // "Did you mean": only for a text search on the first page with no result,
  // and only when the corrected words find highlights (the other filters
  // still apply). The bold uses the same cleaned text that the search used.
  let suggestion: string | null = null;
  if (filters.q && offset === 0 && result !== null && rows.length === 0) {
    const candidate = await suggestHighlightQuery(filters.q);
    if (candidate) {
      const check = await listMyHighlightRows(user.id, {
        ...filters,
        q: candidate,
        offset: 0,
      });
      if (check && check.rows.length > 0) suggestion = candidate;
    }
  }
  const searchTerm = cleanSearchTerm(filters.q);
  const posts = result
    ? await listPublishedPostsByIds([...new Set(rows.map((r) => r.postId))])
    : [];
  const postById = new Map(posts.map((post) => [post.id, post]));

  const current = {
    q: filters.q,
    color: filters.color ?? "",
    notes: filters.notesOnly ? "1" : "",
    view: view === "latest" ? "latest" : "",
  };
  const hasFilters = Boolean(filters.q || filters.color || filters.notesOnly);

  // "Remember this?" shows only on the plain first page.
  const remembered =
    !hasFilters && offset === 0 ? await getRememberedHighlight(user.id) : null;
  const rememberedPost = remembered
    ? ((await listPublishedPostsByIds([remembered.postId]))[0] ?? null)
    : null;
  const rememberedBase = storyPath(rememberedPost);

  // All results fit on this page: only then the counts are the real totals.
  const complete = offset === 0 && result !== null && !result.hasMore;
  const storyCount = new Set(
    rows.map((row) => (postById.has(row.postId) ? row.postId : "gone")),
  ).size;
  const summary =
    complete && rows.length > 0
      ? `${rows.length} ${rows.length === 1 ? "highlight" : "highlights"} in ${storyCount} ${storyCount === 1 ? "story" : "stories"}. Only you can see this page.`
      : "Only you can see this page.";

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Highlights
        </h1>
        {rows.length > 0 || hasFilters ? (
          <ExportButton exportAction={exportHighlights} />
        ) : null}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{summary}</p>
      <ReadingTabs active="highlights" />

      {remembered ? (
        <div className="mt-6">
          <RememberCard
            quote={remembered.quote}
            note={remembered.note}
            color={remembered.color}
            storyTitle={rememberedPost?.title ?? null}
            href={
              rememberedBase ? `${rememberedBase}#hl-${remembered.id}` : null
            }
          />
        </div>
      ) : null}

      <form action="/me/highlights" method="get" role="search" className="mb-4">
        {current.color ? (
          <input type="hidden" name="color" value={current.color} />
        ) : null}
        {current.notes ? (
          <input type="hidden" name="notes" value="1" />
        ) : null}
        {current.view ? (
          <input type="hidden" name="view" value="latest" />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          maxLength={80}
          placeholder="Search your highlights and notes"
          aria-label="Search your highlights and notes"
          className="w-full rounded-full bg-muted/60 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        />
      </form>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-3 rounded-full bg-muted/60 px-3">
          {HIGHLIGHT_COLORS.map((color) => {
            const active = filters.color === color;
            return (
              <Link
                key={color}
                href={buildHref(current, { color: active ? null : color })}
                aria-label={`${color} highlights`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative size-5 rounded-full outline-none after:absolute after:-inset-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
                    : "ring-1 ring-foreground/15",
                )}
                style={{
                  backgroundColor: `color-mix(in oklab, var(--hl-${color}) 85%, var(--foreground))`,
                }}
              />
            );
          })}
        </div>
        <Link
          href={buildHref(current, { notes: filters.notesOnly ? null : "1" })}
          aria-current={filters.notesOnly ? "true" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
            filters.notesOnly
              ? "bg-foreground text-background"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          With notes
        </Link>
        <div className="ml-auto flex h-8 items-center rounded-full bg-muted/60 p-0.5 text-xs">
          <Link
            href={buildHref(current, { view: null })}
            aria-current={view === "story" ? "true" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 outline-none focus-visible:outline-2 focus-visible:outline-ring",
              view === "story"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            By story
          </Link>
          <Link
            href={buildHref(current, { view: "latest" })}
            aria-current={view === "latest" ? "true" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 outline-none focus-visible:outline-2 focus-visible:outline-ring",
              view === "latest"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Latest
          </Link>
        </div>
      </div>

      {result === null ? (
        <p role="alert" className="py-4 text-sm text-destructive">
          Could not load your highlights.
        </p>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center">
          {hasFilters ? (
            <>
              <p className="text-muted-foreground">Nothing matches.</p>
              {suggestion ? (
                <p className="mt-3">
                  Did you mean{" "}
                  <Link
                    href={buildHref(current, { q: suggestion })}
                    className="font-medium text-primary hover:underline"
                  >
                    {suggestion}
                  </Link>
                  ?
                </p>
              ) : null}
              <Link
                href="/me/highlights"
                className="mt-4 inline-block text-primary hover:underline"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Select text in any story to highlight it. Your highlights will
                live here.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block text-primary hover:underline"
              >
                Browse the latest stories
              </Link>
            </>
          )}
        </div>
      ) : view === "story" ? (
        <div>
          {groupByStory(rows, postById).map((group) => {
            const base = storyPath(group.post);
            return (
              <StoryGroup
                key={group.key}
                title={group.post?.title ?? "Story no longer available"}
                href={base}
                meta={
                  group.post
                    ? storyMeta(group.post, complete ? group.rows.length : null)
                    : "The quotes stay here, but the story is not published."
                }
              >
                {group.rows.map((row) => (
                  <HighlightRow
                    key={row.id}
                    term={searchTerm}
                    quote={row.quote}
                    note={row.note}
                    color={row.color}
                    href={base ? `${base}#hl-${row.id}` : null}
                  />
                ))}
              </StoryGroup>
            );
          })}
        </div>
      ) : (
        <div className="space-y-7">
          {rows.map((row) => {
            const post = postById.get(row.postId) ?? null;
            const base = storyPath(post);
            return (
              <div key={row.id}>
                <p className="mb-2 text-xs text-muted-foreground">
                  {post ? post.title : "Story no longer available"}
                </p>
                <ul>
                  <HighlightRow
                    term={searchTerm}
                    quote={row.quote}
                    note={row.note}
                    color={row.color}
                    href={base ? `${base}#hl-${row.id}` : null}
                  />
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {result && (offset > 0 || result.hasMore) ? (
        <div className="mt-8 flex justify-between text-sm">
          {offset > 0 ? (
            <Link
              href={buildHref(current, {
                offset:
                  offset > HIGHLIGHT_PAGE_SIZE
                    ? String(offset - HIGHLIGHT_PAGE_SIZE)
                    : null,
              })}
              className="text-primary hover:underline"
            >
              Newer
            </Link>
          ) : (
            <span />
          )}
          {result.hasMore ? (
            <Link
              href={buildHref(current, {
                offset: String(offset + HIGHLIGHT_PAGE_SIZE),
              })}
              className="text-primary hover:underline"
            >
              Older
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
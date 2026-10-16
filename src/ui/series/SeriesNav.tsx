import Link from "next/link";

type NavPost = { title: string; href: string };

export function SeriesBadge({
  seriesTitle,
  seriesHref,
  position,
  total,
}: {
  seriesTitle: string;
  seriesHref: string;
  position: number;
  total: number;
}) {
  return (
    <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Link href={seriesHref} className="text-primary hover:underline">
        {seriesTitle}
      </Link>{" "}
      &middot; Part {position} of {total}
    </p>
  );
}

export function SeriesPager({
  seriesTitle,
  seriesHref,
  prev,
  next,
}: {
  seriesTitle: string;
  seriesHref: string;
  prev: NavPost | null;
  next: NavPost | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label={`More from ${seriesTitle}`}
      className="mt-12 border-t border-border pt-6"
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        More in{" "}
        <Link href={seriesHref} className="text-primary hover:underline">
          {seriesTitle}
        </Link>
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {prev ? (
          <Link href={prev.href} className="group block">
            <span className="block text-xs text-muted-foreground">
              &larr; Previous
            </span>
            <span className="mt-1 block font-serif text-lg font-semibold leading-snug text-balance group-hover:text-primary">
              {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={next.href} className="group block sm:text-right">
            <span className="block text-xs text-muted-foreground">
              Next &rarr;
            </span>
            <span className="mt-1 block font-serif text-lg font-semibold leading-snug text-balance group-hover:text-primary">
              {next.title}
            </span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
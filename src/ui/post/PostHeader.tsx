import type { ReactNode } from "react";
import { formatDate } from "@/lib/utils";
import { AuthorsByline, type BylineAuthor } from "@/ui/post/AuthorsByline";

export type PostHeaderProps = {
  title: string;
  subtitle?: string | null;
  publishedAt: string;
  readingTimeMin: number;
  // Old single-author prop, kept until every caller sends `authors`.
  author?: BylineAuthor;
  // Owner first, then accepted co-authors.
  authors?: BylineAuthor[];
  // Number of accepted credits: adds an "N credited" link to #credits.
  creditCount?: number;
  // The "..." reading options button, at the right of the byline.
  readingSlot?: ReactNode;
  // Language of the title and subtitle (the rest of the header is site text).
  lang?: string;
};

export function PostHeader({
  title,
  subtitle,
  publishedAt,
  readingTimeMin,
  author,
  authors,
  creditCount,
  readingSlot,
  lang,
}: PostHeaderProps) {
  const byline = authors ?? (author ? [author] : []);

  return (
    <header>
      <h1
        lang={lang}
        className="font-serif text-[34px] font-bold leading-[1.15] tracking-tight text-balance md:text-[46px]"
      >
        {title}
      </h1>

      {subtitle ? (
        <p
          lang={lang}
          className="mt-4 font-serif text-xl text-muted-foreground text-balance md:text-2xl"
        >
          {subtitle}
        </p>
      ) : null}

      <div className="mt-6 flex items-start justify-between gap-3">
        <AuthorsByline
          authors={byline}
          meta={
            <>
              {formatDate(publishedAt)} · {readingTimeMin} min read
              {creditCount ? (
                <>
                  {" · "}
                  <a href="#credits" className="hover:underline">
                    {creditCount} credited
                  </a>
                </>
              ) : null}
            </>
          }
        />
        {readingSlot}
      </div>
    </header>
  );
}
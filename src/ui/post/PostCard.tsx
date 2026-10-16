import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Pin, Repeat2 } from "lucide-react";
import type { BylineAuthor } from "@/ui/post/AuthorsByline";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";
import Image from "next/image";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { ProfileLink } from "@/ui/profile/ProfileLink";
import { CardShareButton } from "@/ui/post/CardShareButton";
import { ProgressRing } from "@/ui/post/ProgressRing";

// Where this reader stopped in the story. Plain data: the card never asks
// where it comes from.
export type PostCardProgress = {
  // Whole number, 5 to 94.
  percent: number;
  minutesLeft: number;
};

// A piece of a search snippet. Plain data, like PostCardProgress.
export type PostCardSnippetPart = { text: string; match: boolean };

export type PostCardProps = {
  title: string;
  excerpt: string;
  slug: string;
  coverUrl?: string | null;
  publishedAt: string;
  readingTimeMin: number;
  // Set only for a signed-in reader who started this story and did not
  // finish it. Replaces "N min read" with a ring and "M min left".
  progress?: PostCardProgress | null;
  // Hidden when undefined: likes arrive in Phase 4, no fake numbers before that.
  likeCount?: number;
  // Hidden when undefined (counts failed to load); 0 is shown.
  commentCount?: number;
  // Hidden when undefined (counts failed to load); 0 is shown.
  repostCount?: number;
  // Set on the Following tab when the post is shown because someone I follow
  // reposted it.
  repostedBy?: BylineAuthor | null;
  // The reposter's note: shown above the card (Following tab, Reposts tab).
  repostCaption?: string | null;
  // Shown next to the caption (the report button); a client component.
  captionAction?: ReactNode;
  // The "..." menu in the top right corner (own stories on my profile); a
  // client component filled by the page.
  menuSlot?: ReactNode;
  // True for the story the author pinned on the profile: a softer card with
  // a "Pinned" label, a wide cover and a larger title.
  pinned?: boolean;
  // Search only: the part of the story text around the searched words. When
  // set, it replaces the excerpt, with the matched words in bold.
  snippet?: PostCardSnippetPart[];
  // Old single-author prop, kept until every caller sends `authors`.
  author?: BylineAuthor;
  // Owner first, then accepted co-authors.
  authors?: BylineAuthor[];
};

export function PostCard({
  title,
  excerpt,
  slug,
  coverUrl,
  publishedAt,
  readingTimeMin,
  progress,
  likeCount,
  commentCount,
  repostCount,
  repostedBy,
  repostCaption,
  captionAction,
  menuSlot,
  pinned = false,
  snippet,
  author,
  authors,
}: PostCardProps) {
  const list = authors ?? (author ? [author] : []);
  const owner = list[0];
  if (!owner) return null;

  const postHref = `/${owner.username}/${slug}`;

  const byline = (
    <div className="relative z-10 flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <div className="flex -space-x-1.5">
        {list.slice(0, 4).map((a) => (
          <ProfileLink
            key={a.username}
            username={a.username}
            decorative
            className="rounded-full"
          >
            <Avatar
              name={a.displayName}
              src={a.avatarUrl}
              size="sm"
              className="ring-2 ring-background"
            />
          </ProfileLink>
        ))}
      </div>
      <span>
        {list.map((a, i) => (
          <Fragment key={a.username}>
            {i === 0 ? "" : i === list.length - 1 ? " and " : ", "}
            <ProfileLink
              username={a.username}
              className="font-medium hover:underline"
            >
              {a.displayName}
            </ProfileLink>
          </Fragment>
        ))}
      </span>
      <span className="text-muted-foreground">· {formatDate(publishedAt)}</span>
    </div>
  );

  const stats = (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {progress ? (
        <span
          className="inline-flex items-center gap-1.5 text-primary"
          aria-label={`${progress.percent}% read, ${progress.minutesLeft} ${progress.minutesLeft === 1 ? "minute" : "minutes"} left`}
        >
          <ProgressRing percent={progress.percent} />
          {progress.minutesLeft} min left
        </span>
      ) : (
        <span>{readingTimeMin} min read</span>
      )}
      {likeCount !== undefined ? (
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${likeCount} likes`}
        >
          <Heart className="size-4" aria-hidden="true" />
          {likeCount > 0 ? likeCount : null}
        </span>
      ) : null}
      {commentCount !== undefined ? (
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${commentCount} comments`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {commentCount > 0 ? commentCount : null}
        </span>
      ) : null}
      {repostCount !== undefined ? (
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${repostCount} reposts`}
        >
          <Repeat2 className="size-4" aria-hidden="true" />
          {repostCount > 0 ? repostCount : null}
        </span>
      ) : null}
      <CardShareButton path={postHref} title={title} />
    </div>
  );

  if (pinned) {
    return (
      <article className="group relative my-6 rounded-2xl bg-muted/40 p-5 sm:p-7">
        {menuSlot ? (
          <div className="absolute right-5 top-5 z-10 sm:right-7 sm:top-7">
            {menuSlot}
          </div>
        ) : null}
        <p className="flex min-h-8 items-center gap-1.5 text-xs font-medium text-primary">
          <Pin className="size-3.5" aria-hidden="true" />
          Pinned
        </p>
        {coverUrl ? (
          // The ratio reserves the exact size, so the page does not jump
          // while the image loads.
          <div className="relative mt-5 aspect-2/1 overflow-hidden rounded-xl">
            <Image
              src={cloudinaryImageUrl(coverUrl, { width: 1200 })}
              alt=""
              fill
              sizes="(min-width: 768px) 640px, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="mt-4">{byline}</div>
        <h2 className="mt-3 font-serif text-3xl font-bold leading-snug tracking-tight text-balance">
          <Link href={postHref} className="hover:text-primary">
            {title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 font-serif text-base text-muted-foreground">
          {excerpt}
        </p>
        {stats}
      </article>
    );
  }

  return (
    <article className="group relative isolate flex gap-6 border-b border-border py-8 before:absolute before:-inset-x-3 before:inset-y-2 before:-z-10 before:rounded-xl before:bg-muted before:opacity-0 before:transition-opacity group-hover:before:opacity-100">
      {menuSlot ? (
        <div className="absolute right-0 top-3 z-10">{menuSlot}</div>
      ) : null}
      <div className="min-w-0 flex-1">
        {repostedBy ? (
          <p className="relative z-10 mb-2 flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
            <Repeat2 className="size-3.5" aria-hidden="true" />
            <ProfileLink
              username={repostedBy.username}
              className="font-medium hover:underline"
            >
              {repostedBy.displayName}
            </ProfileLink>
            <span>reposted</span>
          </p>
        ) : null}
        {repostCaption ? (
          <div className="mb-3 flex items-start gap-2 border-l-2 border-border pl-3">
            <p className="min-w-0 flex-1 text-sm wrap-break-word">
              {repostCaption}
            </p>
            <span className="relative z-10">{captionAction}</span>
          </div>
        ) : null}
        {byline}

        <h2 className="mt-3 font-serif text-2xl font-bold leading-snug tracking-tight text-balance">
          <Link
            href={postHref}
            className="after:absolute after:inset-0 group-hover:text-primary"
          >
            {title}
          </Link>
        </h2>

        <p className="mt-2 line-clamp-2 font-serif text-base text-muted-foreground">
          {snippet && snippet.length > 0
            ? snippet.map((part, index) =>
                part.match ? (
                  <mark
                    key={index}
                    className="bg-transparent font-semibold text-foreground"
                  >
                    {part.text}
                  </mark>
                ) : (
                  <Fragment key={index}>{part.text}</Fragment>
                ),
              )
            : excerpt}
        </p>

        {stats}
      </div>

      {coverUrl ? (
        // The wrapper reserves the exact size, so the page does not jump
        // while the image loads.
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-40">
          <Image
            src={cloudinaryImageUrl(coverUrl, { width: 320 })}
            alt=""
            fill
            sizes="(min-width: 640px) 160px, 96px"
            className="object-cover"
          />
        </div>
      ) : null}
    </article>
  );
}
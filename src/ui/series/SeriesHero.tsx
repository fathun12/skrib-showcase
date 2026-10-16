import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { Avatar } from "@/ui/primitives/Avatar";
import { ProfileLink } from "@/ui/profile/ProfileLink";

type Props = {
  title: string;
  description: string | null;
  coverUrl: string | null;
  authorUsername: string;
  authorName: string;
  authorAvatarUrl: string | null;
  storyCount: number;
  // Part 1 of the series; null when there is nothing to read yet.
  startHref: string | null;
  // The Report button (a client component); not given to the owner.
  reportAction?: ReactNode;
};

// The top of a public series page. Without a cover it is just the text.
export function SeriesHero({
  title,
  description,
  coverUrl,
  authorUsername,
  authorName,
  authorAvatarUrl,
  storyCount,
  startHref,
  reportAction,
}: Props) {
  return (
    <header>
      {coverUrl ? (
        <div className="relative mb-8 aspect-2/1 overflow-hidden rounded-xl bg-muted">
          <Image
            src={cloudinaryImageUrl(coverUrl, {
              width: 1440,
              height: 720,
              crop: "fill",
            })}
            alt=""
            fill
            sizes="(min-width: 768px) 656px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        Series
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight text-balance md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 font-serif text-lg text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <ProfileLink
          username={authorUsername}
          decorative
          className="rounded-full"
        >
          <Avatar name={authorName} src={authorAvatarUrl} size="sm" />
        </ProfileLink>
        <span>
          by{" "}
          <ProfileLink
            username={authorUsername}
            className="font-medium hover:underline"
          >
            {authorName}
          </ProfileLink>
        </span>
        <span className="text-muted-foreground">
          &middot; {storyCount} {storyCount === 1 ? "story" : "stories"}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {startHref ? (
          <Link
            href={startHref}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Start reading
          </Link>
        ) : null}
        {reportAction}
      </div>
    </header>
  );
}
import Link from "next/link";
import { cn } from "@/lib/utils";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { storyHref } from "@/ui/notes/story-link";
import { Avatar } from "@/ui/primitives/Avatar";

// The story a note shares. Same shape as NoteSharedStory in
// features/notes/queries.ts (ui never imports features).
export type NoteStoryData = {
  title: string;
  slug: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  coverUrl: string | null;
  excerpt: string;
  readingMinutes: number | null;
};

type Props = {
  // null = the story is not available (hidden or unpublished).
  story: NoteStoryData | null;
  // A passage quoted from the story (ignored when the story is not available).
  quote?: string | null;
  // false = a plain box (previews and the admin).
  interactive?: boolean;
};

const boxClass =
  "mt-3 flex gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3 text-left";

export function StoryEmbed({ story, quote, interactive = true }: Props) {
  if (!story) {
    return (
      <div className={cn(boxClass, "text-sm text-muted-foreground")}>
        This story is not available.
      </div>
    );
  }

  // Only addresses on our own image host are drawn.
  const cover =
    story.coverUrl && story.coverUrl.startsWith("https://res.cloudinary.com/")
      ? story.coverUrl
      : null;

  const content = (
    <>
      <span className="block min-w-0 flex-1">
        {quote ? (
          <span className="mb-2.5 line-clamp-6 block border-l-2 border-border pl-3 font-serif text-base leading-relaxed text-foreground/90 italic wrap-break-word">
            {quote}
          </span>
        ) : null}
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar
            name={story.authorDisplayName}
            src={story.authorAvatarUrl}
            size="sm"
          />
          <span className="truncate">
            {story.authorDisplayName}
            {story.readingMinutes ? ` · ${story.readingMinutes} min read` : ""}
          </span>
        </span>
        <span className="mt-1.5 line-clamp-2 block font-serif text-base leading-snug font-bold">
          {story.title}
        </span>
        {story.excerpt ? (
          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
            {story.excerpt}
          </span>
        ) : null}
      </span>
      {cover ? (
        <span className="block size-16 shrink-0 overflow-hidden rounded-lg sm:size-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cloudinaryImageUrl(cover, {
              width: 192,
              height: 192,
              crop: "fill",
            })}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        </span>
      ) : null}
    </>
  );

  if (!interactive) return <div className={boxClass}>{content}</div>;

  const linkClass = cn(
    boxClass,
    "transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
  );
  const href = storyHref(story, quote);
  // A text fragment only works on a full page load, so a quote uses a plain
  // link; without a quote the client-side Link is faster.
  return quote ? (
    <a href={href} className={linkClass}>
      {content}
    </a>
  ) : (
    <Link href={href} className={linkClass}>
      {content}
    </Link>
  );
}
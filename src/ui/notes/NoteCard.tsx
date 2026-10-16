import type { ReactNode } from "react";
import Link from "next/link";
import { Flag, MessageCircle, Repeat2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { NoteBody } from "@/ui/notes/NoteBody";
import { NoteImageGrid, type NoteImageData } from "@/ui/notes/NoteImageGrid";
import { NoteQuoteEmbed, type NoteQuoteData } from "@/ui/notes/NoteQuoteEmbed";
import { StoryEmbed, type NoteStoryData } from "@/ui/notes/StoryEmbed";
import { Avatar } from "@/ui/primitives/Avatar";
import { Tooltip } from "@/ui/primitives/tooltip";
import { ProfileLink } from "@/ui/profile/ProfileLink";

export type NoteCardData = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  // Lowercase usernames this note mentions (they become profile links).
  mentions?: string[];
  // A published story shared into this note (null or missing: none).
  sharedStory?: NoteStoryData | null;
  // true = the note shares a story that is not visible (hidden or unpublished).
  storyUnavailable?: boolean;
  // A passage quoted from the shared story (null or missing: none).
  storyQuote?: string | null;
  // The note this note quotes (null or missing: none).
  quote?: NoteQuoteData | null;
  // The person who reposted this note (Following list only).
  repostedBy?: { username: string; displayName: string } | null;
  // When the text was last edited (null or missing: never edited).
  editedAt?: string | null;
  // Up to 4 images, in order (null or missing: none).
  images?: NoteImageData[] | null;
};

export type NoteCardProps = {
  note: NoteCardData;
  // The page of this note's thread. The date and the reply link point to it.
  href?: string;
  // Shown next to the like button; hidden when null or undefined.
  replyCount?: number | null;
  // The like button (a client component), shown at the left of the actions.
  likeSlot?: ReactNode;
  // The repost and quote button (a client component), after the reply link.
  repostSlot?: ReactNode;
  // Replaces the text of the note (the edit form while the note is edited).
  bodySlot?: ReactNode;
  // The Edit button is shown only when a handler is given.
  onEdit?: () => void;
  // The Delete button is shown only when a handler is given.
  onDelete?: () => void;
  // The Hide and Unhide buttons are shown only when a handler is given.
  onHide?: () => void;
  onUnhide?: () => void;
  // The Report flag is shown only when a handler is given (notes of others).
  onReport?: () => void;
  // Makes the images buttons; gets the index of the clicked image.
  onOpenImage?: (index: number) => void;
};

const actionClass =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function NoteCard({
  note,
  href,
  replyCount,
  likeSlot,
  repostSlot,
  bodySlot,
  onEdit,
  onDelete,
  onHide,
  onUnhide,
  onReport,
  onOpenImage,
}: NoteCardProps) {
  const { author } = note;
  const date = formatDate(note.createdAt);

  return (
    <article className="flex gap-3 border-b border-border py-5">
      <ProfileLink
        username={author.username}
        decorative
        className="mt-0.5 shrink-0 rounded-full"
      >
        <Avatar name={author.displayName} src={author.avatarUrl} size="md" />
      </ProfileLink>
      <div className="min-w-0 flex-1">
        {note.repostedBy ? (
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Repeat2 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">
              <ProfileLink
                username={note.repostedBy.username}
                className="font-medium hover:underline"
              >
                {note.repostedBy.displayName}
              </ProfileLink>{" "}
              reposted
            </span>
          </p>
        ) : null}
        <p className="text-sm">
          <ProfileLink
            username={author.username}
            className="font-medium hover:underline"
          >
            {author.displayName}
          </ProfileLink>
          <span className="text-muted-foreground">
            {" "}
            ·{" "}
            {href ? (
              <Link href={href} className="hover:underline">
                {date}
              </Link>
            ) : (
              date
            )}
            {note.editedAt ? (
              <span title={`Edited ${formatDate(note.editedAt)}`}>
                {" "}
                · Edited
              </span>
            ) : null}
          </span>
        </p>
        {bodySlot ?? <NoteBody text={note.body} mentions={note.mentions} />}
        {note.images && note.images.length > 0 ? (
          <NoteImageGrid images={note.images} onOpen={onOpenImage} />
        ) : null}
        {note.quote ? <NoteQuoteEmbed quote={note.quote} /> : null}
        {note.sharedStory || note.storyUnavailable ? (
          <StoryEmbed
            story={note.sharedStory ?? null}
            quote={note.storyQuote}
          />
        ) : null}
        {likeSlot ||
        repostSlot ||
        onEdit ||
        onDelete ||
        onHide ||
        onUnhide ||
        onReport ||
        (href && replyCount != null) ? (
          <div className="mt-2 -ml-3 flex items-center gap-1">
            {likeSlot}
            {href && replyCount != null ? (
              <Link
                href={href}
                className={actionClass}
                aria-label={
                  replyCount === 0
                    ? "Reply to this note"
                    : `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
                }
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                {replyCount === 0 ? "Reply" : replyCount}
              </Link>
            ) : null}
            {repostSlot}
            {onReport ? (
              <Tooltip label="Report this note">
                <button
                  type="button"
                  onClick={onReport}
                  aria-label="Report this note"
                  className={actionClass}
                >
                  <Flag className="size-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
            {onEdit ? (
              <button type="button" onClick={onEdit} className={actionClass}>
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" onClick={onDelete} className={actionClass}>
                Delete
              </button>
            ) : null}
            {onHide ? (
              <button type="button" onClick={onHide} className={actionClass}>
                Hide
              </button>
            ) : null}
            {onUnhide ? (
              <button type="button" onClick={onUnhide} className={actionClass}>
                Unhide
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
import type { HTMLAttributes, ReactNode, Ref, SyntheticEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { NoteBody } from "@/ui/notes/NoteBody";
import type { NoteImageData } from "@/ui/notes/NoteImageGrid";
import { Avatar } from "@/ui/primitives/Avatar";
import { Tooltip } from "@/ui/primitives/tooltip";
import { ProfileLink } from "@/ui/profile/ProfileLink";

type Person = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ViewerReply = {
  id: string;
  body: string;
  createdAt: string;
  author: Person;
  mentions?: string[];
  // How many replies this reply has (null = could not be loaded).
  replyCount?: number | null;
};

export type RepliesState = "loading" | "error" | "done";

// The replies under one reply: loaded when "View replies" is clicked.
export type NestedState = {
  open: boolean;
  state: RepliesState;
  items: ViewerReply[];
};

export type NoteImageViewerProps = {
  note: {
    body: string;
    createdAt: string;
    author: Person;
    mentions?: string[];
  };
  images: NoteImageData[];
  index: number;
  // The like button (a client component), shown in the caption strip.
  likeSlot?: ReactNode;
  replyTotal: number;
  noteHref: string;
  // The replies drawer: closed at first, so the photo stays the only thing
  // on the stage. Wide screens: it slides in from the right and the photo
  // narrows. Narrow screens: a sheet that rises from the bottom.
  repliesOpen: boolean;
  repliesId: string;
  onToggleReplies: () => void;
  onCloseReplies: () => void;
  toggleRef?: Ref<HTMLButtonElement>;
  replies: ViewerReply[];
  repliesState: RepliesState;
  hasMoreReplies: boolean;
  // The reply that was just posted: tinted for a moment (none when unset).
  freshId?: string | null;
  // Replies under a reply, by the id of that reply.
  nested: Record<string, NestedState>;
  onToggleNested: (replyId: string) => void;
  // Reply to a comment: the box is filled with the @name of its author.
  onReplyTo: (parentId: string, username: string) => void;
  replyTarget: { username: string } | null;
  onCancelTarget: () => void;
  // The reply box. Signed out: a sign-in link instead.
  signedIn: boolean;
  signInHref: string;
  replyValue: string;
  onReplyChange: (value: string) => void;
  onReplySubmit: () => void;
  replyPending: boolean;
  replyError: string | null;
  replyMax: number;
  replyInputRef?: Ref<HTMLTextAreaElement>;
  // Undefined at the first and the last image (the arrow is hidden).
  onPrev?: () => void;
  onNext?: () => void;
  // Closes the whole viewer (the X button).
  onClose: () => void;
  // A click on the empty backdrop: closes the drawer first, then the viewer.
  onBackdropClick: () => void;
  dialogRef?: Ref<HTMLDivElement>;
  closeRef?: Ref<HTMLButtonElement>;
  // Swipe handlers for the photo area (phones).
  stageHandlers?: Pick<
    HTMLAttributes<HTMLDivElement>,
    "onTouchStart" | "onTouchEnd"
  >;
};

const roundButton =
  "inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none";

const actionClass =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-expanded:bg-accent aria-expanded:text-foreground motion-reduce:transition-none";

const smallAction =
  "text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring";

// Reply and View replies: small to look at, about 36 px tall to tap (the
// negative margins give the extra height back).
const replyAction =
  "-mx-2 -my-2 inline-flex min-h-9 items-center px-2 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none";

// A reply row. The row of a new reply is tinted for a moment (theme color).
function rowClass(fresh: boolean) {
  return `-mx-2 rounded-lg px-2 transition-colors duration-700 motion-reduce:transition-none ${fresh ? "bg-primary/10" : ""}`;
}

// The @name at the start of a reply is a tag, not text.
const LEADING_TAG = /^@[\w-]+\s*/;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

// The name, the date, the text and the action row: shared by a comment and
// by a reply under a comment.
function ReplyContent({
  reply,
  signedIn,
  onReply,
  extra,
}: {
  reply: ViewerReply;
  signedIn: boolean;
  onReply: () => void;
  // Next to the Reply button (the View replies button of a comment).
  extra?: ReactNode;
}) {
  return (
    <>
      <p className="text-sm">
        <ProfileLink
          username={reply.author.username}
          className="font-medium hover:underline"
        >
          {reply.author.displayName}
        </ProfileLink>
        <span className="text-muted-foreground">
          {" "}
          · {formatDate(reply.createdAt)}
        </span>
      </p>
      <NoteBody text={reply.body} mentions={reply.mentions} />
      {signedIn || extra ? (
        <div className="mt-1 flex items-center gap-4">
          {signedIn ? (
            <button type="button" onClick={onReply} className={replyAction}>
              Reply
            </button>
          ) : null}
          {extra}
        </div>
      ) : null}
    </>
  );
}

// A comment. When its replies are on show, a thin rail runs down from its
// avatar and the replies sit on that rail (see ChildRow).
function ReplyRow({
  reply,
  signedIn,
  onReply,
  extra,
  below,
  rail,
  fresh,
}: {
  reply: ViewerReply;
  signedIn: boolean;
  onReply: () => void;
  extra?: ReactNode;
  // The replies under this comment, shown under its row.
  below?: ReactNode;
  // true = the replies are on show: the rail starts under the avatar.
  rail: boolean;
  fresh: boolean;
}) {
  return (
    <li id={`reply-${reply.id}`} className={rowClass(fresh)}>
      <div className="flex gap-3 pt-3">
        <div className="flex w-6 shrink-0 flex-col items-center">
          <ProfileLink
            username={reply.author.username}
            decorative
            className="shrink-0 rounded-full"
          >
            <Avatar
              name={reply.author.displayName}
              src={reply.author.avatarUrl}
              size="sm"
            />
          </ProfileLink>
          {rail ? (
            <span
              aria-hidden="true"
              className="mt-1 w-px flex-1 bg-border"
            />
          ) : null}
        </div>
        <div className={`min-w-0 flex-1 ${rail ? "pb-2" : "pb-3"}`}>
          <ReplyContent
            reply={reply}
            signedIn={signedIn}
            onReply={onReply}
            extra={extra}
          />
        </div>
      </div>
      {below}
    </li>
  );
}

// A reply under a comment: a small avatar on the rail of the comment. The
// rail goes on to the next reply, and ends at the avatar of the last one.
function ChildRow({
  reply,
  signedIn,
  onReply,
  last,
  fresh,
}: {
  reply: ViewerReply;
  signedIn: boolean;
  onReply: () => void;
  last: boolean;
  fresh: boolean;
}) {
  return (
    <li id={`reply-${reply.id}`} className={rowClass(fresh)}>
      <div className="flex gap-3">
        <div className="relative flex w-6 shrink-0 justify-center pt-2">
          <span
            aria-hidden="true"
            className={`absolute left-1/2 top-0 w-px -translate-x-1/2 bg-border ${
              last ? "h-[1.125rem]" : "h-full"
            }`}
          />
          <ProfileLink
            username={reply.author.username}
            decorative
            className="relative shrink-0 rounded-full"
          >
            <Avatar
              name={reply.author.displayName}
              src={reply.author.avatarUrl}
              size="xs"
            />
          </ProfileLink>
        </div>
        <div className="min-w-0 flex-1 pb-2 pt-2">
          <ReplyContent
            reply={reply}
            signedIn={signedIn}
            onReply={onReply}
          />
        </div>
      </div>
    </li>
  );
}

// Full-screen viewer for the images of one note: "the stage and the drawer".
// The stage is the photo on black (black in every theme, like any photo
// viewer) with one quiet caption strip under it: the author, the note, the
// like button and a Replies button. The replies live in a drawer that the
// reader opens. Props only: state, keys and focus live in
// features/notes/NoteImageLightbox.
export function NoteImageViewer({
  note,
  images,
  index,
  likeSlot,
  replyTotal,
  noteHref,
  repliesOpen,
  repliesId,
  onToggleReplies,
  onCloseReplies,
  toggleRef,
  replies,
  repliesState,
  hasMoreReplies,
  freshId,
  nested,
  onToggleNested,
  onReplyTo,
  replyTarget,
  onCancelTarget,
  signedIn,
  signInHref,
  replyValue,
  onReplyChange,
  onReplySubmit,
  replyPending,
  replyError,
  replyMax,
  replyInputRef,
  onPrev,
  onNext,
  onClose,
  onBackdropClick,
  dialogRef,
  closeRef,
  stageHandlers,
}: NoteImageViewerProps) {
  const image = images[index];
  const many = images.length > 1;
  const caption = image.alt.trim();
  const { author } = note;
  const hasBody = note.body.trim() !== "";
  // A reply that is only the @name has nothing to post.
  const hasText = replyValue.replace(LEADING_TAG, "").trim() !== "";
  const canPost = hasText && !replyPending;

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (canPost) onReplySubmit();
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={caption || `Image ${index + 1} of ${images.length}`}
      className="fixed inset-0 z-100 flex bg-black/90 backdrop-blur-sm"
    >
      {/* The stage: the photo and the caption strip. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-3 pt-16 lg:px-16 lg:pt-6"
          onClick={(event) => {
            // A click on the empty backdrop peels one layer; the photo,
            // counter, caption and arrows are marked data-keep-open.
            if (
              event.target instanceof Element &&
              event.target.closest("[data-keep-open]")
            ) {
              return;
            }
            onBackdropClick();
          }}
          {...stageHandlers}
        >
          <Tooltip label="Close image" side="bottom">
            <button
              ref={closeRef}
              type="button"
              aria-label="Close image"
              onClick={onClose}
              className={`${roundButton} absolute left-4 top-[max(1rem,env(safe-area-inset-top))]`}
            >
              <X className="size-5" aria-hidden />
            </button>
          </Tooltip>

          {many ? (
            <p
              data-keep-open
              aria-live="polite"
              className="absolute right-5 top-[max(1.5rem,env(safe-area-inset-top))] font-serif text-sm tabular-nums text-white/70 lg:left-1/2 lg:right-auto lg:-translate-x-1/2"
            >
              {index + 1} / {images.length}
            </p>
          ) : null}

          {onPrev ? (
            <Tooltip label="Previous image" side="right">
              <button
                type="button"
                data-keep-open
                aria-label="Previous image"
                onClick={onPrev}
                className={`${roundButton} absolute left-3 top-1/2 -translate-y-1/2`}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
            </Tooltip>
          ) : null}
          {onNext ? (
            <Tooltip label="Next image" side="left">
              <button
                type="button"
                data-keep-open
                aria-label="Next image"
                onClick={onNext}
                className={`${roundButton} absolute right-3 top-1/2 -translate-y-1/2`}
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </Tooltip>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-keep-open
            src={cloudinaryImageUrl(image.url, { width: 1920 })}
            alt={image.alt}
            className="min-h-0 w-full max-w-full flex-1 rounded-lg object-contain"
          />
          {caption ? (
            <p
              data-keep-open
              // The same text is already the alt of the photo.
              aria-hidden="true"
              className="mt-3 max-w-xl shrink-0 text-center text-sm text-white/80"
            >
              {caption}
            </p>
          ) : null}
        </div>

        {/* The caption strip: solid theme colors, so the text, the mentions
            and the like button read well in every theme. */}
        <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground">
          <div className="mx-auto flex max-w-3xl gap-3">
            <ProfileLink
              username={author.username}
              decorative
              className="mt-0.5 shrink-0 rounded-full"
            >
              <Avatar
                name={author.displayName}
                src={author.avatarUrl}
                size="sm"
              />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <ProfileLink
                  username={author.username}
                  className="font-medium hover:underline"
                >
                  {author.displayName}
                </ProfileLink>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatDate(note.createdAt)}
                </span>
              </p>
              {hasBody ? (
                <div className="max-h-[22dvh] overflow-y-auto lg:max-h-40">
                  <NoteBody text={note.body} mentions={note.mentions} />
                </div>
              ) : null}
              <div className="-ml-3 mt-1 flex items-center gap-1">
                {likeSlot}
                <button
                  ref={toggleRef}
                  type="button"
                  aria-expanded={repliesOpen}
                  aria-controls={repliesId}
                  onClick={onToggleReplies}
                  className={actionClass}
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  {replyTotal === 0
                    ? "Reply"
                    : plural(replyTotal, "reply", "replies")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The drawer. Wide screens: a column that grows from 0 to 24rem, so
          the photo narrows. Narrow screens: a sheet over the bottom. Closed =
          inert (no focus, hidden from screen readers). */}
      <aside
        id={repliesId}
        aria-label="Replies"
        inert={!repliesOpen}
        className={`flex min-h-0 shrink-0 flex-col overflow-hidden bg-background text-foreground max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:h-[78dvh] max-lg:rounded-t-2xl max-lg:transition-transform max-lg:duration-300 lg:transition-[width] lg:duration-300 motion-reduce:transition-none ${
          repliesOpen
            ? "max-lg:translate-y-0 max-lg:shadow-2xl lg:w-96"
            : "max-lg:translate-y-full max-lg:shadow-none lg:w-0"
        }`}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col lg:w-96 lg:border-l lg:border-border">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="font-serif text-base font-bold">
              Replies
              {replyTotal > 0 ? (
                <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
                  {replyTotal}
                </span>
              ) : null}
            </h2>
            <Link href={noteHref} className={`ml-auto ${smallAction}`}>
              Open note
            </Link>
            <Tooltip label="Close replies" side="bottom">
              <button
                type="button"
                aria-label="Close replies"
                onClick={onCloseReplies}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Tooltip>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {repliesState === "loading" ? (
              <p className="py-4 text-sm text-muted-foreground">
                Loading replies...
              </p>
            ) : repliesState === "error" ? (
              <p role="alert" className="py-4 text-sm text-destructive">
                Could not load the replies.
              </p>
            ) : replies.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No replies yet. Be the first.
              </p>
            ) : (
              <ul>
                {replies.map((reply) => {
                  const sub = nested[reply.id];
                  const count = reply.replyCount ?? 0;
                  return (
                    <ReplyRow
                      key={reply.id}
                      reply={reply}
                      signedIn={signedIn}
                      fresh={reply.id === freshId}
                      rail={sub?.open === true && sub.items.length > 0}
                      onReply={() =>
                        onReplyTo(reply.id, reply.author.username)
                      }
                      extra={
                        count > 0 || sub ? (
                          <button
                            type="button"
                            aria-expanded={sub?.open ?? false}
                            onClick={() => onToggleNested(reply.id)}
                            className={replyAction}
                          >
                            {sub?.open
                              ? "Hide replies"
                              : `View ${plural(count, "reply", "replies")}`}
                          </button>
                        ) : undefined
                      }
                      below={
                        sub?.open ? (
                          sub.items.length === 0 && sub.state === "loading" ? (
                            <p className="pb-2 pl-9 text-xs text-muted-foreground">
                              Loading...
                            </p>
                          ) : sub.items.length === 0 &&
                            sub.state === "error" ? (
                            <p
                              role="alert"
                              className="pb-2 pl-9 text-xs text-destructive"
                            >
                              Could not load the replies.
                            </p>
                          ) : (
                            <ul>
                              {sub.items.map((item, position) => (
                                <ChildRow
                                  key={item.id}
                                  reply={item}
                                  signedIn={signedIn}
                                  fresh={item.id === freshId}
                                  last={position === sub.items.length - 1}
                                  // Replies to a reply stay under the same
                                  // parent comment, with the @name.
                                  onReply={() =>
                                    onReplyTo(reply.id, item.author.username)
                                  }
                                />
                              ))}
                            </ul>
                          )
                        ) : null
                      }
                    />
                  );
                })}
              </ul>
            )}
            {repliesState === "done" && hasMoreReplies ? (
              <Link
                href={noteHref}
                className="inline-block pb-2 pt-1 text-sm text-primary hover:underline"
              >
                See all replies
              </Link>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border pb-[env(safe-area-inset-bottom)]">
            {signedIn ? (
              <>
                {replyTarget ? (
                  <div className="flex items-center justify-between gap-2 px-4 pt-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">
                      Replying to{" "}
                      <span className="font-medium text-foreground">
                        @{replyTarget.username}
                      </span>
                    </span>
                    <Tooltip label="Stop replying">
                      <button
                        type="button"
                        aria-label="Stop replying"
                        onClick={onCancelTarget}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </Tooltip>
                  </div>
                ) : null}
                <form
                  onSubmit={handleSubmit}
                  className="mx-3 my-3 flex items-end gap-2 rounded-2xl bg-muted/60 py-1 pl-4 pr-3 transition-shadow focus-within:ring-2 focus-within:ring-ring/40 motion-reduce:transition-none"
                >
                  <textarea
                    ref={replyInputRef}
                    aria-label="Write a reply"
                    value={replyValue}
                    onChange={(event) => onReplyChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.ctrlKey || event.metaKey)
                      ) {
                        event.preventDefault();
                        if (canPost) onReplySubmit();
                      }
                    }}
                    maxLength={replyMax}
                    rows={1}
                    disabled={replyPending}
                    placeholder="Add a reply..."
                    className="block max-h-28 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground field-sizing-content placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!canPost}
                    className="pb-1.5 text-sm font-medium text-primary transition-opacity hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 disabled:hover:no-underline motion-reduce:transition-none"
                  >
                    {replyPending ? "Posting..." : "Post"}
                  </button>
                </form>
              </>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                <Link
                  href={signInHref}
                  className="text-primary hover:underline"
                >
                  Sign in to reply
                </Link>
              </p>
            )}
            {replyError ? (
              <p role="alert" className="px-4 pb-3 text-sm text-destructive">
                {replyError}
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
import type { ReactNode } from "react";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";
import { ProfileLink } from "@/ui/profile/ProfileLink";
import { CommentBody } from "@/ui/comments/CommentBody";

export type CommentItemData = {
  id: string;
  body: string;
  // Respond: the quoted passage, shown above the text.
  quote?: string | null;
  createdAt: string;
  // Lowercase usernames this comment mentions (from the database).
  mentions?: readonly string[];
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export type CommentItemProps = {
  comment: CommentItemData;
  // Each action button is shown only when its handler is given.
  onReply?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  // Replies and the reply form go here, under the comment.
  children?: ReactNode;
};

const actionClass =
  "rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function CommentItem({
  comment,
  onReply,
  onDelete,
  onReport,
  children,
}: CommentItemProps) {
  const { author } = comment;

  return (
    <div className="flex gap-3">
      <ProfileLink
        username={author.username}
        decorative
        className="mt-0.5 shrink-0 rounded-full"
      >
        <Avatar name={author.displayName} src={author.avatarUrl} size="md" />
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
            · {formatDate(comment.createdAt)}
          </span>
        </p>
        {comment.quote ? (
          <blockquote className="mt-2 mb-1 rounded-xl border-l-2 border-primary/60 bg-muted/50 px-3.5 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Responding to
            </p>
            {/* Plain text only, never HTML. */}
            <p className="mt-1 font-serif text-sm leading-relaxed wrap-break-word whitespace-pre-wrap italic">
              {comment.quote}
            </p>
          </blockquote>
        ) : null}
        {/* Plain text only: line breaks kept, links are NOT clickable. */}
        <p className="mt-1 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
          <CommentBody text={comment.body} mentions={comment.mentions} />
        </p>
        {onReply || onDelete || onReport ? (
          <div className="mt-2 -ml-1.5 flex items-center gap-1">
            {onReply ? (
              <button type="button" onClick={onReply} className={actionClass}>
                Reply
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" onClick={onDelete} className={actionClass}>
                Delete
              </button>
            ) : null}
            {onReport ? (
              <button type="button" onClick={onReport} className={actionClass}>
                Report
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
import Link from "next/link";
import { requireUser } from "@/features/auth/queries";
import { respondCredit } from "@/features/credits/actions";
import { listMyCreditInvites } from "@/features/credits/queries";
import { MarkSeen } from "@/features/notifications/MarkSeen";
import {
  isNegativeNotice,
  moderationSentence,
} from "@/features/notifications/moderation-text";
import { CONTACT_EMAIL } from "@/lib/contact";
import { Shield } from "lucide-react";
import { NotificationRow } from "@/features/notifications/NotificationRow";
import {
  getNotificationsSeenAt,
  listNotifications,
} from "@/features/notifications/queries";
import { CreditInviteList } from "@/ui/post/CreditInviteList";
import { Avatar } from "@/ui/primitives/Avatar";
import { ProfileLink } from "@/ui/profile/ProfileLink";

// The sentence after the person's name, for the kinds that mention a post.
const POST_VERB = {
  like: "liked",
  repost: "reposted",
  comment: "commented on",
  reply: "replied to your comment on",
  credit: "credited you in",
  credit_accepted: "accepted your credit invitation for",
  credit_declined: "declined your credit invitation for",
  post: "published",
  repost_followed: "reposted",
  comment_mention: "mentioned you in a comment on",
  handover_to_author: "finished editing",
  handover_to_editor: "asked you to edit",
  editor_published: "published your story",
  post_mention: "mentioned you in",
} as const;

// The sentence after the person's name, for the kinds that mention a note.
const NOTE_VERB = {
  note_like: "liked",
  note_reply: "replied to",
  note_mention: "mentioned you in",
  note_repost: "reposted",
  note_quote: "quoted",
  story_share: "shared your story in",
} as const;

export default async function NotificationsPage() {
  const user = await requireUser("/me/notifications");
  const [items, invites, seenAt] = await Promise.all([
    listNotifications(user.id),
    listMyCreditInvites(),
    // Read in the same round: rows newer than this are shown as new.
    getNotificationsSeenAt(user.id),
  ]);
  const seenTime = seenAt === null ? null : new Date(seenAt).getTime();
  const hasInvites = invites !== null && invites.length > 0;

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <MarkSeen />
      <h1 className="mb-6 font-serif text-3xl font-bold tracking-tight">
        Notifications
      </h1>

      {invites === null && (
        <p role="alert" className="pb-4 text-sm text-destructive">
          Could not load your credit invitations.
        </p>
      )}

      {hasInvites && (
        <section aria-labelledby="credit-invites-heading" className="mb-8">
          <h2
            id="credit-invites-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Credit invitations
          </h2>
          <CreditInviteList
            items={invites.map((invite) => ({
              creditId: invite.creditId,
              title: invite.postTitle,
              ownerName: invite.ownerName,
              ownerUsername: invite.ownerUsername,
              roleText: invite.roleText,
              date: invite.createdAt,
            }))}
            onRespond={respondCredit}
          />
        </section>
      )}

      {items === null ? (
        <p role="alert" className="py-4 text-sm text-destructive">
          Could not load your notifications.
        </p>
      ) : items.length === 0 ? (
        hasInvites ? null : (
          <p className="py-20 text-center text-muted-foreground">
            Nothing yet. New followers, likes and stories from people you
            follow will show up here.
          </p>
        )
      ) : (
        <ul className="-mx-3 divide-y divide-border border-y border-border">
          {items.map((item, index) =>
            item.kind === "moderation" ? (
              <NotificationRow
                key={`${item.kind}-${item.at}-${index}`}
                isNew={
                  seenTime !== null && new Date(item.at).getTime() > seenTime
                }
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <Shield className="size-5" />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="wrap-break-word">{moderationSentence(item)}</p>
                  {item.note ? (
                    <p className="mt-1 text-muted-foreground wrap-break-word">
                      Note: {item.note}
                    </p>
                  ) : null}
                  {isNegativeNotice(item.action) ? (
                    <p className="mt-1 text-muted-foreground">
                      If you think this was a mistake, write to{" "}
                      <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="underline underline-offset-4"
                      >
                        {CONTACT_EMAIL}
                      </a>
                      .
                    </p>
                  ) : null}
                  <time
                    dateTime={item.at}
                    className="text-xs text-muted-foreground"
                  >
                    {new Date(item.at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </NotificationRow>
            ) : (
            <NotificationRow
              key={`${item.kind}-${item.at}-${index}`}
              isNew={
                seenTime !== null && new Date(item.at).getTime() > seenTime
              }
            >
              <ProfileLink
                username={item.actor.username}
                decorative
                className="shrink-0 rounded-full"
              >
                <Avatar
                  name={item.actor.displayName}
                  src={item.actor.avatarUrl}
                  size="md"
                />
              </ProfileLink>
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <ProfileLink
                    username={item.actor.username}
                    className="font-semibold hover:underline"
                  >
                    {item.actor.displayName}
                  </ProfileLink>{" "}
                  {item.kind === "follow" ? (
                    <>started following you</>
                  ) : (
                    <>
                      {(item.kind === "like" ||
                        item.kind === "note_like" ||
                        item.kind === "note_repost") &&
                      item.others > 0 ? (
                        <>
                          and{" "}
                          {item.secondActor ? (
                            <ProfileLink
                              username={item.secondActor.username}
                              className="font-semibold hover:underline"
                            >
                              {item.secondActor.displayName}
                            </ProfileLink>
                          ) : (
                            <>
                              {item.others}{" "}
                              {item.others === 1 ? "other" : "others"}
                            </>
                          )}{" "}
                        </>
                      ) : null}
                      {"note" in item ? (
                        <>
                          {NOTE_VERB[item.kind]}{" "}
                          <Link
                            href={item.note.href}
                            className="font-medium text-primary hover:underline"
                          >
                            {item.kind === "note_mention" ||
                            item.kind === "story_share"
                              ? "a note"
                              : "your note"}
                          </Link>
                        </>
                      ) : (
                        <>
                          {POST_VERB[item.kind]}{" "}
                          <Link
                            href={item.post.href}
                            className="font-medium text-primary hover:underline"
                          >
                            {item.post.title || "Untitled"}
                          </Link>
                        </>
                      )}
                      {item.kind === "repost_followed" ? (
                        <>
                          {" "}
                          by{" "}
                          <ProfileLink
                            username={item.author.username}
                            className="font-medium hover:underline"
                          >
                            {item.author.displayName}
                          </ProfileLink>
                        </>
                      ) : null}
                    </>
                  )}
                </p>
                {(item.kind === "handover_to_author" ||
                  item.kind === "handover_to_editor") &&
                item.message ? (
                  <p className="mt-1 text-muted-foreground wrap-break-word">
                    Note: {item.message}
                  </p>
                ) : null}
                {item.kind === "repost_followed" && item.caption ? (
                  <p className="mt-1 text-muted-foreground wrap-break-word">
                    {item.caption}
                  </p>
                ) : null}
                {"note" in item ? (
                  <p className="mt-1 text-muted-foreground wrap-break-word">
                    {item.note.excerpt}
                  </p>
                ) : null}
                <time dateTime={item.at} className="text-xs text-muted-foreground">
                  {new Date(item.at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
            </NotificationRow>
          ))}
        </ul>
      )}
    </div>
  );
}
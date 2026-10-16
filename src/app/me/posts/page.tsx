import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/features/auth/queries";
import { respondInvite } from "@/features/collab/actions";
import {
  listMyInvites,
  listSharedWithMe,
  type MyInvite,
} from "@/features/collab/queries";
import { deletePost, unpublishPost } from "@/features/posts/actions";
import { listOwnPosts } from "@/features/posts/queries";
import { NewSeriesButton } from "@/features/series/NewSeriesButton";
import { listOwnSeries } from "@/features/series/queries";
import { InviteList } from "@/ui/post/InviteList";
import { OwnPostList } from "@/ui/post/OwnPostList";
import { OwnPostsTabs, type OwnPostsTab } from "@/ui/post/OwnPostsTabs";
import { OwnSeriesGrid } from "@/ui/series/OwnSeriesGrid";

// In Next.js 16, `searchParams` is a Promise and must be awaited.
type Props = { searchParams: Promise<{ tab?: string | string[] }> };

export default async function MyPostsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  // Anything unknown falls back to the drafts tab.
  const active: OwnPostsTab =
    tab === "published"
      ? "published"
      : tab === "series"
        ? "series"
        : tab === "shared"
          ? "shared"
          : "drafts";

  const user = await requireUser("/me/posts");

  // Started first: the count also shows on the tab bar of the other tabs.
  const invitesPromise = listMyInvites();

  let invites: MyInvite[] | null;
  let content: ReactNode;

  if (active === "series") {
    const [inv, series] = await Promise.all([
      invitesPromise,
      listOwnSeries(user.id),
    ]);
    invites = inv;

    content = (
      <section aria-label="Your series" className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Group your stories in an order you choose, so readers can follow
            them one after another.
          </p>
          <NewSeriesButton />
        </div>
        {series === null ? (
          <p role="alert" className="py-4 text-sm text-destructive">
            Could not load your series.
          </p>
        ) : series.length === 0 ? (
          <p className="py-10 text-muted-foreground">
            No series yet. Press New series to create your first one.
          </p>
        ) : (
          <OwnSeriesGrid
            items={series.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              coverUrl: item.coverUrl,
              postCount: item.postCount,
              manageHref: `/me/series/${item.id}`,
              viewHref: `/${user.profile.username}/series/${item.slug}`,
            }))}
          />
        )}
      </section>
    );
  } else if (active === "shared") {
    const [inv, shared] = await Promise.all([
      invitesPromise,
      listSharedWithMe(user.id),
    ]);
    invites = inv;
    const hasInvites = inv !== null && inv.length > 0;

    content = (
      <>
        {inv === null && (
          <p role="alert" className="py-4 text-sm text-destructive">
            Could not load your invitations.
          </p>
        )}

        {hasInvites && (
          <section aria-labelledby="invites-heading" className="pt-6">
            <h2
              id="invites-heading"
              className="text-sm font-medium text-muted-foreground"
            >
              Invitations
            </h2>
            <InviteList
              items={inv.map((invite) => ({
                postId: invite.postId,
                title: invite.postTitle,
                ownerName: invite.ownerDisplayName,
                ownerUsername: invite.ownerUsername,
                date: invite.createdAt,
                role: invite.role,
                showCredit: invite.showCredit,
              }))}
              onRespond={respondInvite}
            />
          </section>
        )}

        {shared === null ? (
          <p role="alert" className="py-4 text-sm text-destructive">
            Could not load the posts shared with you.
          </p>
        ) : (
          <section aria-labelledby="shared-heading" className="pt-6">
            {hasInvites && (
              <h2
                id="shared-heading"
                className="text-sm font-medium text-muted-foreground"
              >
                Shared posts
              </h2>
            )}
            <OwnPostList
              items={shared.map((post) => ({
                id: post.id,
                title: post.title,
                date: post.date,
                href: `/write/${post.id}`,
                viewHref:
                  post.status === "published"
                    ? `/${post.ownerUsername}/${post.slug}`
                    : undefined,
                dateLabel:
                  post.status === "published" ? "Published" : "Last edited",
                byline: `${post.role === "editor" ? "Editor" : "Co-author"} on ${post.ownerDisplayName}'s post`,
              }))}
              dateLabel="Last edited"
              editLabel="Open"
              emptyText="No shared posts yet. When someone invites you to co-write or edit a post and you accept, it appears here."
            />
          </section>
        )}
      </>
    );
  } else {
    const [inv, posts, hidden] = await Promise.all([
      invitesPromise,
      listOwnPosts(user.id, active === "published" ? "published" : "draft"),
      // Shown on the Drafts tab only.
      active === "drafts" ? listOwnPosts(user.id, "hidden") : Promise.resolve([]),
    ]);
    invites = inv;

    const list = (
      <OwnPostList
        items={posts.map((post) => ({
          id: post.id,
          title: post.title,
          date: post.date,
          href: `/write/${post.id}`,
          scheduledFor: post.scheduledFor,
          // Only published posts have a public page.
          viewHref:
            active === "published"
              ? `/${user.profile.username}/${post.slug}`
              : undefined,
        }))}
        dateLabel={active === "published" ? "Published" : "Last edited"}
        onDelete={deletePost}
        // Only the Published tab can unpublish.
        onUnpublish={active === "published" ? unpublishPost : undefined}
        emptyText={
          active === "published"
            ? "No published posts yet."
            : "No drafts yet. Press Write to start one."
        }
      />
    );

    content = (
      <>
        {hidden.length > 0 && (
          <section aria-labelledby="hidden-heading" className="pt-6">
            <h2
              id="hidden-heading"
              className="text-sm font-medium text-muted-foreground"
            >
              Hidden by moderation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These posts are not public and cannot be published again. You
              can still delete them.
            </p>
            <OwnPostList
              items={hidden.map((post) => ({
                id: post.id,
                title: post.title,
                date: post.date,
                href: `/write/${post.id}`,
              }))}
              dateLabel="Last edited"
              editLabel="Details"
              onDelete={deletePost}
              emptyText=""
            />
          </section>
        )}
        {list}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Your posts
        </h1>
        <Link
          href="/me/insights"
          className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Insights
        </Link>
      </div>
      <OwnPostsTabs active={active} pendingInvites={invites?.length ?? 0} />
      {content}
    </div>
  );
}
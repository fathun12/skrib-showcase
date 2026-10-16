import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { FollowButtonConnected } from "@/features/follows/FollowButtonConnected";
import { getFollowCounts, isFollowing } from "@/features/follows/queries";
import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { NoteRelationMenuConnected } from "@/features/noteblocks/NoteRelationMenuConnected";
import {
  getMyNewsletterStatus,
  getNewsletterEnabled,
} from "@/features/newsletter/queries";
import { SubscribeConnected } from "@/features/newsletter/SubscribeConnected";
import { getPinnedPostId } from "@/features/pin/queries";
import { PostCardMenuConnected } from "@/features/pin/PostCardMenuConnected";
import { getNoteRelation } from "@/features/noteblocks/queries";
import { getProfileByUsername } from "@/features/profiles/queries";
import { getProgressByPost } from "@/features/reading-progress/queries";
import { listSeriesByAuthor } from "@/features/series/queries";
import { SeriesList } from "@/ui/series/SeriesList";
import { NotePagedList } from "@/features/notes/NotePagedList";
import { listNotesByAuthor } from "@/features/notes/queries";
import {
  listPublishedPostsByAuthor,
  listPublishedPostsByIds,
  type PublishedPostListItem,
} from "@/features/posts/queries";
import {
  getRepostCounts,
  listRepostCaptions,
  listRepostedPostIds,
} from "@/features/reposts/queries";
import { RepostCaptionReportConnected } from "@/features/reposts/RepostCaptionReportConnected";
import { PostCard } from "@/ui/post/PostCard";
import { buttonVariants } from "@/ui/primitives/button";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { DEFAULT_OG_IMAGE } from "@/lib/site";
import { ProfileHeader } from "@/ui/profile/ProfileHeader";
import { ProfileTabs, type ProfileTab } from "@/ui/profile/ProfileTabs";

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ username: string }> };
type PageProps = Props & {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  // Shares one database round trip with the page (getProfileByUsername is cached).
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Profile not found" };

  const title = `${profile.displayName} (@${profile.username})`;
  const description =
    profile.bio || `Stories by ${profile.displayName} on Skrib.`;
  const path = `/${profile.username}`;
  // Cloudinary avatars get a square face crop; other URLs (Google) come back
  // unchanged from the helper.
  const image = profile.avatarUrl
    ? cloudinaryImageUrl(profile.avatarUrl, {
        width: 400,
        height: 400,
        crop: "fill",
        gravity: "face",
      })
    : null;

  return {
    title,
    description,
    alternates: {
      canonical: path,
      // Lets feed readers find the feed from the profile address.
      types: { "application/rss+xml": `${path}/feed.xml` },
    },
    openGraph: {
      type: "profile",
      siteName: "Skrib",
      title,
      description,
      url: path,
      images: image
        ? [{ url: image, width: 400, height: 400, alt: profile.displayName }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "Skrib" }],
    },
    twitter: {
      card: image ? "summary" : "summary_large_image",
      title,
      description,
      images: [image ?? DEFAULT_OG_IMAGE],
    },
  };
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const { tab } = await searchParams;
  const activeTab: ProfileTab =
    tab === "reposts"
      ? "reposts"
      : tab === "series"
        ? "series"
        : tab === "notes"
          ? "notes"
          : "stories";

  // null covers unknown usernames and users who have not finished onboarding.
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  // Only the Series tab needs the series list.
  const seriesList =
    activeTab === "series" ? await listSeriesByAuthor(profile.id) : null;

  // Only the list of the active tab is loaded.
  const [stories, counts, repostedIds] = await Promise.all([
    activeTab === "stories"
      ? listPublishedPostsByAuthor(profile.id)
      : Promise.resolve<PublishedPostListItem[]>([]),
    getFollowCounts(profile.id),
    activeTab === "reposts" ? listRepostedPostIds(profile.id) : null,
  ]);
  // Reposted posts that were unpublished or deleted are left out silently.
  const posts =
    activeTab === "reposts"
      ? repostedIds
        ? await listPublishedPostsByIds(repostedIds)
        : []
      : stories;
  // The pinned story goes first on the Stories tab and is left out of the
  // list below it. It must be published and belong to this profile.
  const pinnedId =
    activeTab === "stories" ? await getPinnedPostId(profile.id) : null;
  const pinnedCandidate = pinnedId
    ? ((await listPublishedPostsByIds([pinnedId]))[0] ?? null)
    : null;
  const pinned =
    pinnedCandidate &&
    pinnedCandidate.authors[0]?.username === profile.username
      ? pinnedCandidate
      : null;
  const shown = pinned
    ? [pinned, ...posts.filter((post) => post.id !== pinned.id)]
    : posts;
  const postIds = shown.map((post) => post.id);
  // Signed-out visitors get null; compare ids, not usernames.
  const current = await getCurrentUser();
  const isOwnProfile = current?.id === profile.id;
  // Only the Notes tab needs the notes list.
  const notes =
    activeTab === "notes"
      ? await listNotesByAuthor(profile.id, current?.id ?? null)
      : null;
  const [
    likeCounts,
    commentCounts,
    repostCounts,
    repostCaptions,
    progressMarks,
  ] = await Promise.all([
      getLikeCounts(postIds),
      getCommentCounts(postIds),
      getRepostCounts(postIds),
      // Only the Reposts tab shows captions.
      activeTab === "reposts"
        ? listRepostCaptions(profile.id, postIds)
        : Promise.resolve(new Map<string, string>()),
      // Signed-in readers only: the "N min left" mark on started stories.
      current ? getProgressByPost(current.id, shown) : Promise.resolve(null),
    ]);

  // Only asked for a signed-in visitor on someone else's profile.
  const following =
    current && !isOwnProfile ? await isFollowing(current.id, profile.id) : false;
  // The Subscribe button shows only when the author accepts email subscribers.
  const canSubscribe = isOwnProfile
    ? false
    : await getNewsletterEnabled(profile.id);
  // Only a signed-in reader can already be subscribed.
  const initialSubscribed =
    canSubscribe && current ? await getMyNewsletterStatus(profile.id) : false;
  // Mute and block state for the "..." menu (signed in, someone else's profile).
  const relation =
    current && !isOwnProfile
      ? await getNoteRelation(current.id, profile.id)
      : null;

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <ProfileHeader
        displayName={profile.displayName}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        bio={profile.bio}
        followerCount={counts.followers}
        followingCount={counts.following}
        action={
          isOwnProfile ? (
            <Link
              href="/settings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit profile
            </Link>
          ) : (
            <div className="flex items-start gap-2">
              <FollowButtonConnected
                profileId={profile.id}
                username={profile.username}
                initialFollowing={following}
                signedIn={current !== null}
              />
              {canSubscribe ? (
                <SubscribeConnected
                  authorId={profile.id}
                  initialSubscribed={initialSubscribed}
                  authorName={profile.displayName}
                  signedInEmail={current?.email ?? null}
                  variant="button"
                />
              ) : null}
              {relation ? (
                <NoteRelationMenuConnected
                  profileId={profile.id}
                  username={profile.username}
                  initialBlocked={relation.blocked}
                  initialMuted={relation.muted}
                />
              ) : null}
            </div>
          )
        }
      />

      <ProfileTabs active={activeTab} username={profile.username} />

      {activeTab === "notes" ? (
        notes === null ? (
          <p role="alert" className="py-12 text-center text-destructive">
            Could not load the notes.
          </p>
        ) : notes.items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No notes yet.
          </p>
        ) : (
          <NotePagedList
            initialNotes={notes.items}
            initialCursor={notes.nextCursor}
            feed={{ kind: "author", authorId: profile.id }}
            currentUserId={current?.id ?? null}
            returnPath={`/${profile.username}?tab=notes`}
          />
        )
      ) : activeTab === "series" ? (
        seriesList === null ? (
          <p role="alert" className="py-12 text-center text-destructive">
            Could not load the series.
          </p>
        ) : seriesList.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No series yet.
          </p>
        ) : (
          <SeriesList items={seriesList} username={profile.username} />
        )
      ) : activeTab === "reposts" && repostedIds === null ? (
        <p role="alert" className="py-12 text-center text-destructive">
          Could not load the reposts.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {activeTab === "reposts"
            ? "No reposts yet."
            : "No published posts yet."}
        </p>
      ) : (
        <div>
          {shown.map((post) => (
            <PostCard
              key={post.id}
              pinned={post.id === pinned?.id}
              title={post.title}
              excerpt={post.excerpt}
              slug={post.slug}
              coverUrl={post.coverImageUrl}
              publishedAt={post.publishedAt}
              readingTimeMin={post.readingTimeMin}
              progress={progressMarks?.get(post.id)}
              likeCount={
                likeCounts ? (likeCounts.get(post.id) ?? 0) : undefined
              }
              commentCount={
                commentCounts ? (commentCounts.get(post.id) ?? 0) : undefined
              }
              repostCount={
                repostCounts ? (repostCounts.get(post.id) ?? 0) : undefined
              }
              repostCaption={repostCaptions.get(post.id) ?? null}
              captionAction={
                activeTab === "reposts" &&
                !isOwnProfile &&
                repostCaptions.has(post.id) ? (
                  <RepostCaptionReportConnected
                    reposterId={profile.id}
                    postId={post.id}
                    returnPath={`/${profile.username}?tab=reposts`}
                    signedIn={current !== null}
                  />
                ) : undefined
              }
              menuSlot={
                isOwnProfile &&
                activeTab === "stories" &&
                post.authors[0]?.username === profile.username ? (
                  <PostCardMenuConnected
                    postId={post.id}
                    pinned={post.id === pinned?.id}
                  />
                ) : undefined
              }
              authors={post.authors}
            />
          ))}
        </div>
      )}
    </div>
  );
}
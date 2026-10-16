import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/queries";
import { hasNewFollowingPosts } from "@/features/follows/following-dot";
import { MarkFollowingSeen } from "@/features/follows/MarkFollowingSeen";
import { listFollowingIds } from "@/features/follows/queries";
import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { getRepostCounts } from "@/features/reposts/queries";
import { NoteComposerConnected } from "@/features/notes/NoteComposerConnected";
import { NotePagedList } from "@/features/notes/NotePagedList";
import {
  listFollowingNotes,
  listLatestNotes,
  listPopularNotes,
} from "@/features/notes/queries";
import {
  listFollowingFeed,
  listForYouPosts,
  listPopularPosts,
  listPublishedPosts,
} from "@/features/posts/queries";
import { getProgressByPost } from "@/features/reading-progress/queries";
import {
  listFollowedTags,
  listTopicsFeed,
} from "@/features/tag-follows/queries";
import { getTagCounts } from "@/features/tags/queries";
import { HomeTabs, type HomeTab } from "@/ui/post/HomeTabs";
import { NoteFeedChips, type NoteFeed } from "@/ui/notes/NoteFeedChips";
import type { BylineAuthor } from "@/ui/post/AuthorsByline";
import { RepostCaptionReportConnected } from "@/features/reposts/RepostCaptionReportConnected";
import { PostCard } from "@/ui/post/PostCard";
import { buttonVariants } from "@/ui/primitives/button";
import { tagLabel } from "@/ui/tags";
import { serializeJsonLd, websiteJsonLd } from "@/features/seo/jsonld";
import { IntroStrip } from "@/ui/layout/IntroStrip";
import { HomeSidebar } from "@/ui/layout/HomeSidebar";
import { FollowButtonConnected } from "@/features/follows/FollowButtonConnected";
import { listSuggestedAuthors } from "@/features/follows/suggestions";
import { ForYouItem } from "@/features/foryou/ForYouItem";
import { ForYouMenu } from "@/features/foryou/ForYouMenu";
import { getTagsByPost } from "@/features/foryou/queries";

// The look of a topic link (same as TagList on the article page).
const TOPIC_CHIP_CLASS =
  "inline-block rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

// The home page is one address. The tabs and "older posts" links add
// ?tab= and ?cursor=, but they all point search engines to "/".
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/feed.xml" },
  },
};

// In Next.js 16, `searchParams` is a Promise and must be awaited.
type Props = {
  searchParams: Promise<{
    cursor?: string | string[];
    tab?: string | string[];
    feed?: string | string[];
  }>;
};

export default async function Home({ searchParams }: Props) {
  const { cursor, tab, feed } = await searchParams;
  const rawCursor = typeof cursor === "string" ? cursor : undefined;

  // Signed-out visitors get null.
  const current = await getCurrentUser();
  // The Following tab exists only for signed-in users; for everyone else the
  // tab value is ignored and the latest posts are shown.
  const activeTab: HomeTab =
    tab === "popular"
      ? "popular"
      : current && tab === "foryou"
        ? "foryou"
        : current && tab === "following"
        ? "following"
        : current && tab === "topics"
          ? "topics"
          : tab === "notes"
            ? "notes"
            : "latest";

  // Started now so it runs while the posts load. The Following tab itself
  // never shows the dot (it marks everything as seen instead).
  const followingDotPromise =
    current && activeTab !== "following"
      ? hasNewFollowingPosts(current.id)
      : Promise.resolve(false);

    // The Notes tab: short public posts. No stories are loaded here.
  if (activeTab === "notes") {
    // Popular is for everyone. Following is for signed-in people only; for
    // everyone else it is Latest.
    const noteFeed: NoteFeed =
      feed === "popular"
        ? "popular"
        : current && feed === "following"
          ? "following"
          : "latest";
    const notesPath =
      noteFeed === "following"
        ? "/?tab=notes&feed=following"
        : noteFeed === "popular"
          ? "/?tab=notes&feed=popular"
          : "/?tab=notes";
    const [notes, notesDot] = await Promise.all([
      noteFeed === "following" && current
        ? listFollowingNotes(current.id)
        : noteFeed === "popular"
          ? listPopularNotes(current?.id ?? null)
          : listLatestNotes(current?.id ?? null),
      followingDotPromise,
    ]);
    return (
      <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
        <h1 className="sr-only">
          {noteFeed === "following"
            ? "Notes from people you follow"
            : noteFeed === "popular"
              ? "Popular notes"
              : "Latest notes"}
        </h1>
        {current === null ? <IntroStrip /> : null}
        <HomeTabs
          active={activeTab}
          signedIn={current !== null}
          showFollowingDot={notesDot}
        />
        <div className="py-6">
          {current ? (
            <NoteComposerConnected
              author={
                current.profile
                  ? {
                      displayName:
                        current.profile.display_name ||
                        current.profile.username ||
                        "You",
                      avatarUrl: current.profile.avatar_url,
                    }
                  : undefined
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/login?next=${encodeURIComponent("/?tab=notes")}`}
                className="text-primary hover:underline"
              >
                Sign in to write a note
              </Link>
            </p>
          )}
        </div>
        <NoteFeedChips active={noteFeed} signedIn={current !== null} />
        {notes === null ? (
          <p role="alert" className="py-12 text-center text-destructive">
            Could not load the notes.
          </p>
        ) : notes.items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {noteFeed === "following"
              ? "Nothing here yet. Follow some authors and their notes will show up here."
              : noteFeed === "popular"
                ? "Nothing popular in the last week yet."
                : "No notes yet. Write the first one."}
          </p>
        ) : (
          <NotePagedList
            // A new key starts the list fresh when the chip changes.
            key={noteFeed}
            initialNotes={notes.items}
            initialCursor={notes.nextCursor}
            feed={{ kind: noteFeed }}
            currentUserId={current?.id ?? null}
            returnPath={notesPath}
          />
        )}
      </div>
    );
  }

  // Popular is one ranked list of the last 14 days: no cursor, no next page.
  const forYou = activeTab === "foryou" ? await listForYouPosts() : null;
  const { posts, nextCursor } =
    forYou
      ? { posts: forYou.posts, nextCursor: null }
      : activeTab === "popular"
      ? { posts: await listPopularPosts(), nextCursor: null }
      : activeTab === "following" && current
        ? await listFollowingFeed(rawCursor, await listFollowingIds(current.id))
        : activeTab === "topics"
          ? await listTopicsFeed(rawCursor)
          : await listPublishedPosts(rawCursor);

  // The Topics tab: the topics this person follows (shown above the list).
  // With none followed yet, popular topics are offered instead.
  const followedTags =
    activeTab === "topics" && current
      ? await listFollowedTags(current.id)
      : null;
  const suggestedTags =
    followedTags !== null && followedTags.length === 0
      ? await getTagCounts("", 12)
      : null;
  const postIds = posts.map((post) => post.id);
  // For you only: the first topic of each story, for the "Hide" menu.
  const forYouTags = forYou ? await getTagsByPost(postIds) : null;
  // The sidebar (very wide screens only): popular topics and authors to follow.
  const [sidebarTopics, sidebarAuthors] = await Promise.all([
    getTagCounts("", 8),
    listSuggestedAuthors(current?.id ?? null),
  ]);
  const [
    likeCounts,
    commentCounts,
    repostCounts,
    showFollowingDot,
    progressMarks,
  ] = await Promise.all([
    getLikeCounts(postIds),
    getCommentCounts(postIds),
    getRepostCounts(postIds),
    followingDotPromise,
    // Signed-in readers only: the "N min left" mark on started stories.
    current ? getProgressByPost(current.id, posts) : Promise.resolve(null),
  ]);

  // The pagination links keep the active tab.
  const basePath =
    activeTab === "following"
      ? "/?tab=following"
      : activeTab === "popular"
        ? "/?tab=popular"
        : activeTab === "topics"
          ? "/?tab=topics"
          : "/";
  const olderHref = nextCursor
    ? `${basePath}${basePath.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(nextCursor)}`
    : null;

  return (
    <div className="relative mx-auto max-w-180 px-4 py-10 md:px-8">
      <HomeSidebar
        topics={sidebarTopics ?? []}
        authors={(sidebarAuthors ?? []).map((author) => ({
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          action: (
            <FollowButtonConnected
              profileId={author.id}
              username={author.username}
              initialFollowing={false}
              signedIn={current !== null}
            />
          ),
        }))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd()) }}
      />
      <h1 className="sr-only">
        {activeTab === "following"
          ? "Stories from people you follow"
          : activeTab === "topics"
            ? "Stories from topics you follow"
            : activeTab === "popular"
              ? "Popular stories"
              : activeTab === "foryou"
                ? "Stories for you"
                : "Latest stories"}
      </h1>

      {current === null && !rawCursor ? <IntroStrip /> : null}

      <HomeTabs
        active={activeTab}
        signedIn={current !== null}
        showFollowingDot={showFollowingDot}
      />
      {activeTab === "following" ? <MarkFollowingSeen /> : null}
      {forYou ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {forYou.personalized
            ? "Picked from the topics and authors you like, save, read and follow."
            : "Like or save a few stories and this tab learns what you read. For now it shows what is popular."}
        </p>
      ) : null}

      {followedTags && followedTags.length > 0 ? (
        <ul
          aria-label="Topics you follow"
          className="mt-6 flex flex-wrap gap-2"
        >
          {followedTags.map((tag) => (
            <li key={tag}>
              <Link href={`/tag/${tag}`} className={TOPIC_CHIP_CLASS}>
                {tagLabel(tag)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">
            {rawCursor
              ? "No more stories."
              : activeTab === "topics"
                ? followedTags && followedTags.length > 0
                  ? "No stories in the topics you follow yet."
                  : "Nothing here yet. Follow some topics and their stories will show up here."
                : activeTab === "following"
                  ? "Nothing here yet. Follow some authors and their stories will show up here."
                  : activeTab === "popular"
                    ? "Nothing popular in the last two weeks yet."
                    : "No stories yet."}
          </p>
          <Link
            href={
              rawCursor
                ? basePath
                : activeTab !== "latest"
                  ? "/"
                  : "/write"
            }
            className="mt-4 inline-block text-primary hover:underline"
          >
            {rawCursor
              ? "Back to the newest"
              : activeTab !== "latest"
                ? "Browse the latest stories"
                : "Write the first one"}
          </Link>
          {suggestedTags && suggestedTags.length > 0 ? (
            <ul
              aria-label="Popular topics"
              className="mt-8 flex flex-wrap justify-center gap-2"
            >
              {suggestedTags.map((item) => (
                <li key={item.tag}>
                  <Link
                    href={`/tag/${item.tag}`}
                    className={TOPIC_CHIP_CLASS}
                  >
                    {tagLabel(item.tag)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div>
          {posts.map((post) => {
            const owner = post.authors[0];
            const card = (
            <PostCard
              key={post.id}
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
              repostedBy={
                "repostedBy" in post
                  ? (post.repostedBy as BylineAuthor | null)
                  : null
              }
              repostCaption={
                "repostCaption" in post
                  ? (post.repostCaption as string | null)
                  : null
              }
              captionAction={
                "repostCaption" in post &&
                post.repostCaption &&
                "reposterId" in post &&
                typeof post.reposterId === "string" ? (
                  <RepostCaptionReportConnected
                    reposterId={post.reposterId as string}
                    postId={post.id}
                    returnPath="/?tab=following"
                    // The Following tab only exists for signed-in people.
                    signedIn
                  />
                ) : undefined
              }
              authors={post.authors}
              menuSlot={
                forYou && owner ? (
                  <ForYouMenu
                    author={{
                      username: owner.username,
                      name: owner.displayName,
                    }}
                    topic={forYouTags?.get(post.id)?.[0] ?? null}
                  />
                ) : undefined
              }
            />
            );
            return forYou ? (
              <ForYouItem key={post.id}>{card}</ForYouItem>
            ) : (
              card
            );
          })}
        </div>
      )}

      {posts.length > 0 && (rawCursor || nextCursor) ? (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between"
        >
          {rawCursor ? (
            <Link
              href={basePath}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Newest
            </Link>
          ) : (
            <span />
          )}
          {olderHref ? (
            <Link
              href={olderHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Older posts
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
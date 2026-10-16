import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { CommentsSection } from "@/features/comments/CommentsSection";
import { getCommentCounts, listComments } from "@/features/comments/queries";
import { BookmarkButtonConnected } from "@/features/bookmarks/BookmarkButtonConnected";
import { isBookmarked } from "@/features/bookmarks/queries";
import { LikeButtonConnected } from "@/features/likes/LikeButtonConnected";
import { getLikeCounts, getLikeInfo } from "@/features/likes/queries";
import {
  getMyNewsletterStatus,
  getNewsletterEnabled,
} from "@/features/newsletter/queries";
import { SubscribeConnected } from "@/features/newsletter/SubscribeConnected";
import { RepostButtonConnected } from "@/features/reposts/RepostButtonConnected";
import { getRepostCounts, getRepostInfo } from "@/features/reposts/queries";
import { ReportButtonConnected } from "@/features/reports/ReportButtonConnected";
import { ReaderTools } from "@/features/highlights/ReaderTools";
import { PostStatsBeacon } from "@/features/insights/PostStatsBeacon";
import { listMyHighlights } from "@/features/highlights/queries";
import { ImageLightbox } from "@/features/lightbox/ImageLightbox";
import { HeadingLinkCopier } from "@/features/heading-links/HeadingLinkCopier";
import { FootnotePreview } from "@/features/footnote-preview/FootnotePreview";
import { getSeriesNav } from "@/features/series/queries";
import { SeriesBadge, SeriesPager } from "@/ui/series/SeriesNav";
import { ShareButtonConnected } from "@/features/share/ShareButtonConnected";
import { RelatedStories } from "@/features/tags/RelatedStories";
import { ReadingMenu } from "@/features/reading/ReadingMenu";
import { ListenConnected } from "@/features/listen/ListenConnected";
import { tocItems } from "@/features/posts/headings";
import { ReadingPage } from "@/features/reading/ReadingPage";
import { getProgressByPost } from "@/features/reading-progress/queries";
import { ResumeReadingConnected } from "@/features/reading-progress/ResumeReadingConnected";
import {
  parseReadingCookie,
  READING_COOKIE,
} from "@/features/reading/settings";
import { ArticleContent } from "@/features/posts/ArticleContent";
import { getMentionNames } from "@/features/posts/mentions";
import { ogLocale } from "@/features/posts/languages";
import { articleJsonLd, serializeJsonLd } from "@/features/seo/jsonld";
import {
  getPublishedPost,
  listPublishedPostsByAuthor,
} from "@/features/posts/queries";
import { isOwnCloudinaryImageUrl } from "@/features/uploads/validate";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { DEFAULT_OG_IMAGE } from "@/lib/site";
import { ArticleCover } from "@/ui/post/ArticleCover";
import { CommentCountLink } from "@/ui/post/CommentCountLink";
import { CreditsSection } from "@/ui/post/CreditsSection";
import { EditedBy } from "@/ui/post/EditedBy";
import { removeCredit } from "@/features/credits/actions";
import { getPostCredits } from "@/features/credits/queries";
import { PostCard } from "@/ui/post/PostCard";
import { PostHeader } from "@/ui/post/PostHeader";
import { TagList } from "@/ui/post/TagList";

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;

  // Shares one database round trip with the page (getPublishedPost is cached).
  const post = await getPublishedPost(username, slug);
  if (!post) return { title: "Post not found" };

  const description = post.excerpt || post.subtitle || undefined;
  // Canonical uses the stored (lowercase) username, so /Alice/... and
  // /alice/... point to the same address.
  const path = `/${post.author.username}/${slug}`;

  // Only our own Cloudinary images, like on the page itself; a post without
  // a cover gets the default Skrib image. 1200x630 is the usual size for link
  // previews; the cover has no alt text, so the title is used.
  const cover =
    post.coverImageUrl &&
    isOwnCloudinaryImageUrl(
      post.coverImageUrl,
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    )
      ? cloudinaryImageUrl(post.coverImageUrl, {
          width: 1200,
          height: 630,
          crop: "fill",
        })
      : DEFAULT_OG_IMAGE;

  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    // A page that sets openGraph replaces the layout's, so siteName is repeated.
    openGraph: {
      type: "article",
      siteName: "Skrib",
      locale: ogLocale(post.language),
      title: post.title,
      description,
      url: path,
      publishedTime: post.publishedAt,
      authors: post.authors.map((a) => `/${a.username}`),
      images: cover
        ? [{ url: cover, width: 1200, height: 630, alt: post.title }]
        : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { username, slug } = await params;

  // null covers every "should look like a 404" case: unknown author,
  // unknown slug, a draft, or an unpublished post.
  const post = await getPublishedPost(username, slug);
  if (!post) notFound();

  // Signed-out visitors get null.
  const current = await getCurrentUser();
  // The reading options live in a device cookie, so the first paint is right.
  const reading = parseReadingCookie(
    (await cookies()).get(READING_COOKIE)?.value,
  );
  // The owner and every accepted co-author are authors: no Report button.
  const myUsername = current?.profile?.username ?? null;
  const isAuthor =
    myUsername !== null && post.authors.some((a) => a.username === myUsername);
  // Subscribers belong to the owner of the story; authors see no line.
  const canSubscribe = isAuthor
    ? false
    : await getNewsletterEnabled(post.authorId);
  const initialSubscribed =
    canSubscribe && current
      ? await getMyNewsletterStatus(post.authorId)
      : false;

  // Up to 3 other published posts by the same author, and the like state.
  const [more, like, saved, threads, commentCounts, repost, credits, seriesNav] =
    await Promise.all([
      listPublishedPostsByAuthor(post.authorId, {
        excludeId: post.id,
        limit: 3,
      }),
      getLikeInfo(post.id, current?.id ?? null),
      isBookmarked(post.id, current?.id ?? null),
      listComments(post.id),
      getCommentCounts([post.id]),
      getRepostInfo(post.id, current?.id ?? null),
      getPostCredits(post.id),
      getSeriesNav(post.id),
    ]);
  // Current usernames of the people named in the story (no query when the
  // story names nobody).
  const mentionNames = await getMentionNames(post.content);
  const moreIds = more.map((item) => item.id);
  const [
    moreLikeCounts,
    moreCommentCounts,
    moreRepostCounts,
    moreProgress,
    myHighlights,
  ] = await Promise.all([
    getLikeCounts(moreIds),
    getCommentCounts(moreIds),
    getRepostCounts(moreIds),
    current ? getProgressByPost(current.id, more) : Promise.resolve(null),
    current ? listMyHighlights(post.id, current.id) : Promise.resolve(null),
  ]);

  // What the "Share to a note" dialog shows as a preview (the owner is first).
  const owner = post.authors[0];
  const shareStory = {
    title: post.title,
    slug,
    authorUsername: post.author.username,
    authorDisplayName: owner?.displayName ?? post.author.username,
    authorAvatarUrl: owner?.avatarUrl ?? null,
    coverUrl: post.coverImageUrl,
    excerpt: post.excerpt ?? "",
    readingMinutes: post.readingTimeMin,
  };

  // Structured data for search engines. The cover is the same 1200x630 image
  // as in the link preview; without one, the default Skrib image is used.
  const jsonLd = articleJsonLd({
    title: post.title,
    description: post.excerpt || post.subtitle || undefined,
    path: `/${post.author.username}/${slug}`,
    language: post.language,
    publishedAt: post.publishedAt,
    imageUrl:
      post.coverImageUrl &&
      isOwnCloudinaryImageUrl(
        post.coverImageUrl,
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      )
        ? cloudinaryImageUrl(post.coverImageUrl, {
            width: 1200,
            height: 630,
            crop: "fill",
          })
        : null,
    authors: post.authors,
    tags: post.tags,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ReadingPage initial={reading} readingTimeMin={post.readingTimeMin}>
        {/* Checked again here: next/image throws for a host that is not allowed. */}
        {post.coverImageUrl &&
        isOwnCloudinaryImageUrl(
          post.coverImageUrl,
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        ) ? (
          <ArticleCover src={post.coverImageUrl} />
        ) : null}
        {seriesNav ? (
          <SeriesBadge
            seriesTitle={seriesNav.series.title}
            seriesHref={`/${post.author.username}/series/${seriesNav.series.slug}`}
            position={seriesNav.position}
            total={seriesNav.total}
          />
        ) : null}
        <PostHeader
          title={post.title}
          subtitle={post.subtitle}
          publishedAt={post.publishedAt}
          readingTimeMin={post.readingTimeMin}
          authors={post.authors}
          creditCount={credits.length}
          readingSlot={
            <div className="flex items-center gap-1">
              <ListenConnected lang={post.language} />
              <ReadingMenu headings={tocItems(post.content)} />
            </div>
          }
          lang={post.language}
        />
         <div className="mt-10" lang={post.language} data-reading-body>
          <ArticleContent
            content={post.content}
            mentionNames={mentionNames}
          />
        </div>
        <TagList tags={post.tags} />
        <EditedBy editors={post.editors} />
        <CreditsSection
          credits={credits}
          viewerUsername={myUsername}
          onRemoveMe={removeCredit}
        />
        {seriesNav ? (
          <SeriesPager
            seriesTitle={seriesNav.series.title}
            seriesHref={`/${post.author.username}/series/${seriesNav.series.slug}`}
            prev={
              seriesNav.prev
                ? {
                    title: seriesNav.prev.title,
                    href: `/${post.author.username}/${seriesNav.prev.slug}`,
                  }
                : null
            }
            next={
              seriesNav.next
                ? {
                    title: seriesNav.next.title,
                    href: `/${post.author.username}/${seriesNav.next.slug}`,
                  }
                : null
            }
          />
        ) : null}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-y-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-1">
            <LikeButtonConnected
              postId={post.id}
              returnPath={`/${post.author.username}/${slug}`}
              initialLiked={like.liked}
              initialCount={like.count}
              signedIn={current !== null}
            />
            <BookmarkButtonConnected
              postId={post.id}
              returnPath={`/${post.author.username}/${slug}`}
              initialSaved={saved}
              signedIn={current !== null}
            />
            <CommentCountLink
              count={
                commentCounts ? (commentCounts.get(post.id) ?? 0) : undefined
              }
            />
            <RepostButtonConnected
              postId={post.id}
              returnPath={`/${post.author.username}/${slug}`}
              initialReposted={repost.reposted}
              initialCount={repost.count}
              initialCaption={repost.caption}
              signedIn={current !== null}
              isAuthor={isAuthor}
              story={shareStory}
            />
            <ShareButtonConnected
              path={`/${post.author.username}/${slug}`}
              title={post.title}
            />
          </div>
          {!isAuthor ? (
            <ReportButtonConnected
              postId={post.id}
              returnPath={`/${post.author.username}/${slug}`}
              signedIn={current !== null}
            />
          ) : null}
        </div>
        {canSubscribe ? (
          <SubscribeConnected
            authorId={post.authorId}
            initialSubscribed={initialSubscribed}
            authorName={post.author.displayName}
            signedInEmail={current?.email ?? null}
            variant="line"
          />
        ) : null}
      </ReadingPage>
      <ImageLightbox />
      <HeadingLinkCopier />
      <FootnotePreview />
      {!isAuthor ? <PostStatsBeacon postId={post.id} /> : null}
      <ReaderTools
        postId={post.id}
        signedIn={current !== null}
        title={post.title}
        authors={post.authors.map((a) => a.displayName).join(", ")}
        path={`/${post.author.username}/${slug}`}
        story={shareStory}
        initialHighlights={myHighlights ?? []}
      />
      {current && !isAuthor ? (
        <ResumeReadingConnected postId={post.id} userId={current.id} />
      ) : null}

      <CommentsSection
        postId={post.id}
        returnPath={`/${post.author.username}/${slug}`}
        signedIn={current !== null}
        currentUserId={current?.id ?? null}
        canModerate={isAuthor}
        threads={threads}
      />

      <RelatedStories
        postId={post.id}
        tags={post.tags}
        authorId={post.authorId}
        excludeIds={moreIds}
        viewerId={current?.id ?? null}
      />

      {more.length > 0 ? (
        <section
          aria-labelledby="more-from-author"
          className="mx-auto max-w-180 px-4 pb-10 md:px-8"
        >
          <h2
            id="more-from-author"
            className="border-b border-border pb-3 font-serif text-xl font-bold"
          >
            More from {post.author.displayName}
          </h2>
          {more.map((item) => (
            <PostCard
              key={item.id}
              title={item.title}
              excerpt={item.excerpt}
              slug={item.slug}
              coverUrl={item.coverImageUrl}
              publishedAt={item.publishedAt}
              readingTimeMin={item.readingTimeMin}
              progress={moreProgress?.get(item.id)}
              likeCount={
                moreLikeCounts ? (moreLikeCounts.get(item.id) ?? 0) : undefined
              }
              commentCount={
                moreCommentCounts
                  ? (moreCommentCounts.get(item.id) ?? 0)
                  : undefined
              }
              repostCount={
                moreRepostCounts
                  ? (moreRepostCounts.get(item.id) ?? 0)
                  : undefined
              }
              authors={item.authors}
            />
          ))}
          <Link
            href={`/${post.author.username}`}
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            See all stories
          </Link>
        </section>
      ) : null}
    </>
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { getProgressByPost } from "@/features/reading-progress/queries";
import { getRepostCounts } from "@/features/reposts/queries";
import { getTagPostCount, listPostsByTag } from "@/features/tags/queries";
import { isFollowingTag } from "@/features/tag-follows/queries";
import { TagFollowButtonConnected } from "@/features/tag-follows/TagFollowButtonConnected";
import { PostCard } from "@/ui/post/PostCard";
import { buttonVariants } from "@/ui/primitives/button";
import { isValidTag, tagLabel } from "@/ui/tags";
import { DEFAULT_OG_IMAGE } from "@/lib/site";

// In Next.js 16, `params` and `searchParams` are Promises and must be awaited.
type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
};

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { tag } = await params;
  if (!isValidTag(tag)) return { title: "Topic not found" };

  const label = tagLabel(tag);
  const title = `#${label}`;
  const description = `Stories about ${label} on Skrib.`;
  const path = `/tag/${tag}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
      types: { "application/rss+xml": `${path}/feed.xml` },
    },
    openGraph: {
      type: "website",
      siteName: "Skrib",
      title,
      description,
      url: path,
      // A page that sets openGraph replaces the layout's, so the default
      // preview image is repeated here.
      images: [
        { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "Skrib" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { tag } = await params;
  if (!isValidTag(tag)) notFound();

  const { cursor } = await searchParams;
  const rawCursor = typeof cursor === "string" ? cursor : undefined;

  const current = await getCurrentUser();

  const [{ posts, nextCursor }, total, following] = await Promise.all([
    listPostsByTag(tag, rawCursor),
    getTagPostCount(tag),
    // Signed-in readers only: the state of the Follow button.
    current ? isFollowingTag(current.id, tag) : Promise.resolve(false),
  ]);

  const postIds = posts.map((post) => post.id);
  const [likeCounts, commentCounts, repostCounts, progressMarks] =
    await Promise.all([
      getLikeCounts(postIds),
      getCommentCounts(postIds),
      getRepostCounts(postIds),
      // Signed-in readers only: the "N min left" mark on started stories.
      current ? getProgressByPost(current.id, posts) : Promise.resolve(null),
    ]);

  const label = tagLabel(tag);
  const basePath = `/tag/${tag}`;
  const olderHref = nextCursor
    ? `${basePath}?cursor=${encodeURIComponent(nextCursor)}`
    : null;

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Topic</p>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {label}
          </h1>
          {total !== null && (
            <p className="mt-1 text-sm text-muted-foreground">
              {total} {total === 1 ? "story" : "stories"}
            </p>
          )}
        </div>
        <TagFollowButtonConnected
          tag={tag}
          initialFollowing={following}
          signedIn={current !== null}
        />
      </header>

      {posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">
            {rawCursor
              ? "No more stories."
              : "No stories with this topic yet."}
          </p>
          <Link
            href={rawCursor ? basePath : "/"}
            className="mt-4 inline-block text-primary hover:underline"
          >
            {rawCursor ? "Back to the newest" : "Browse the latest stories"}
          </Link>
        </div>
      ) : (
        <div>
          {posts.map((post) => (
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
              authors={post.authors}
            />
          ))}
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
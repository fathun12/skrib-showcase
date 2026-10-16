import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { listPublishedPostsByIds } from "@/features/posts/queries";
import { getProfileByUsername } from "@/features/profiles/queries";
import { getProgressByPost } from "@/features/reading-progress/queries";
import { getRepostCounts } from "@/features/reposts/queries";
import {
  getSeriesBySlug,
  listSeriesPostIds,
} from "@/features/series/queries";
import { DEFAULT_OG_IMAGE } from "@/lib/site";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { PostCard } from "@/ui/post/PostCard";
import { ReportSeriesButtonConnected } from "@/features/series/ReportSeriesButtonConnected";
import { SeriesHero } from "@/ui/series/SeriesHero";

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ username: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Series not found" };
  const series = await getSeriesBySlug(profile.id, slug);
  if (!series) return { title: "Series not found" };

  const title = `${series.title} by ${profile.displayName}`;
  const description =
    series.description || `A series by ${profile.displayName} on Skrib.`;
  const path = `/${profile.username}/series/${series.slug}`;
  // The series cover, cropped to the usual 1200x630 share size.
  const image = series.coverUrl
    ? cloudinaryImageUrl(series.coverUrl, {
        width: 1200,
        height: 630,
        crop: "fill",
      })
    : null;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Skrib",
      title,
      description,
      url: path,
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: series.title }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "Skrib" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image ?? DEFAULT_OG_IMAGE],
    },
  };
}

export default async function SeriesPage({ params }: Props) {
  const { username, slug } = await params;

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const series = await getSeriesBySlug(profile.id, slug);
  if (!series) notFound();

  const current = await getCurrentUser();
  const isOwner = current?.id === profile.id;

  const ids = await listSeriesPostIds(series.id);
  // A series without a published post is only shown to its owner.
  if (ids !== null && ids.length === 0 && !isOwner) notFound();

  const loaded = ids && ids.length > 0 ? await listPublishedPostsByIds(ids) : [];
  const byId = new Map(loaded.map((post) => [post.id, post]));
  const posts = (ids ?? []).flatMap((id) => {
    const post = byId.get(id);
    return post ? [post] : [];
  });
  const postIds = posts.map((post) => post.id);

  const [likeCounts, commentCounts, repostCounts, progressMarks] =
    await Promise.all([
      getLikeCounts(postIds),
      getCommentCounts(postIds),
      getRepostCounts(postIds),
      current ? getProgressByPost(current.id, posts) : Promise.resolve(null),
    ]);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <SeriesHero
        title={series.title}
        description={series.description}
        coverUrl={series.coverUrl}
        authorUsername={profile.username}
        authorName={profile.displayName}
        authorAvatarUrl={profile.avatarUrl}
        storyCount={posts.length}
        startHref={
          posts.length > 0 ? `/${profile.username}/${posts[0].slug}` : null
        }
        // A report needs a published story, and nobody reports their own series.
        reportAction={
          !isOwner && posts.length > 0 ? (
            <ReportSeriesButtonConnected
              seriesId={series.id}
              returnPath={`/${profile.username}/series/${series.slug}`}
              signedIn={current !== null}
            />
          ) : undefined
        }
      />

      <div className="mt-10 border-t border-border">
        {ids === null ? (
          <p role="alert" className="py-12 text-center text-destructive">
            Could not load this series.
          </p>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No published stories in this series yet.
          </p>
        ) : (
          posts.map((post, index) => (
            <div key={post.id}>
              <p className="pt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Part {index + 1}
              </p>
              <PostCard
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
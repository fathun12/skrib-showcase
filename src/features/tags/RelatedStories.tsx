import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { getProgressByPost } from "@/features/reading-progress/queries";
import { getRepostCounts } from "@/features/reposts/queries";
import { listRelatedPosts } from "@/features/tags/related";
import { PostCard } from "@/ui/post/PostCard";

type Props = {
  postId: string;
  tags: string[];
  authorId: string;
  // Ids of the posts already shown in "More from" (no duplicates).
  excludeIds: string[];
  // The signed-in reader, for the "N min left" mark; null when signed out.
  viewerId: string | null;
};

// "Related stories" at the end of an article: other people's posts that
// share a topic. Draws nothing when there are none.
export async function RelatedStories({
  postId,
  tags,
  authorId,
  excludeIds,
  viewerId,
}: Props) {
  const related = await listRelatedPosts({
    postId,
    tags,
    authorId,
    excludeIds,
  });
  if (related.length === 0) return null;

  const ids = related.map((item) => item.id);
  const [likeCounts, commentCounts, repostCounts, progressMarks] =
    await Promise.all([
      getLikeCounts(ids),
      getCommentCounts(ids),
      getRepostCounts(ids),
      viewerId ? getProgressByPost(viewerId, related) : Promise.resolve(null),
    ]);

  return (
    <section
      aria-labelledby="related-stories"
      className="mx-auto max-w-180 px-4 pb-10 md:px-8"
    >
      <h2
        id="related-stories"
        className="border-b border-border pb-3 font-serif text-xl font-bold"
      >
        Related stories
      </h2>
      {related.map((item) => (
        <PostCard
          key={item.id}
          title={item.title}
          excerpt={item.excerpt}
          slug={item.slug}
          coverUrl={item.coverImageUrl}
          publishedAt={item.publishedAt}
          readingTimeMin={item.readingTimeMin}
          progress={progressMarks?.get(item.id)}
          likeCount={likeCounts ? (likeCounts.get(item.id) ?? 0) : undefined}
          commentCount={
            commentCounts ? (commentCounts.get(item.id) ?? 0) : undefined
          }
          repostCount={
            repostCounts ? (repostCounts.get(item.id) ?? 0) : undefined
          }
          authors={item.authors}
        />
      ))}
    </section>
  );
}
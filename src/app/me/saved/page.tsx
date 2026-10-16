import Link from "next/link";
import { requireUser } from "@/features/auth/queries";
import { listSavedPostIds } from "@/features/bookmarks/queries";
import { getCommentCounts } from "@/features/comments/queries";
import { getLikeCounts } from "@/features/likes/queries";
import { getRepostCounts } from "@/features/reposts/queries";
import { listPublishedPostsByIds } from "@/features/posts/queries";
import { ContinueReadingList } from "@/features/reading-progress/ContinueReadingList";
import {
  getProgressByPost,
  listContinueReading,
} from "@/features/reading-progress/queries";
import { ListToolbarConnected } from "@/features/lists/ListToolbarConnected";
import { getMyLists } from "@/features/lists/queries";
import { ListChips } from "@/ui/lists/ListChips";
import { PostCard } from "@/ui/post/PostCard";
import { ReadingTabs } from "@/ui/layout/ReadingTabs";
import { SavedOfflineSync } from "@/features/offline/SavedOfflineSync";

type Props = {
  searchParams: Promise<{ list?: string | string[] }>;
};

export default async function SavedPage({ searchParams }: Props) {
  const { list } = await searchParams;
  const user = await requireUser("/me/saved");

  const [ids, continueReading, myLists] = await Promise.all([
    listSavedPostIds(user.id),
    listContinueReading(user.id),
    getMyLists(user.id),
  ]);
  // Posts that were unpublished or deleted since saving are left out.
  const posts = ids ? await listPublishedPostsByIds(ids) : [];
  const postIds = posts.map((post) => post.id);
  // Addresses of ALL saved stories, so each one gets an offline copy no
  // matter which list is open.
  const offlinePaths = posts.flatMap((post) => {
    const owner = post.authors[0];
    return owner ? [`/${owner.username}/${post.slug}`] : [];
  });
  const [likeCounts, commentCounts, repostCounts, progressMarks] =
    await Promise.all([
      getLikeCounts(postIds),
      getCommentCounts(postIds),
      getRepostCounts(postIds),
      getProgressByPost(user.id, posts),
    ]);

  // An unknown or foreign list id in the address just shows "All".
  const activeList =
    typeof list === "string"
      ? (myLists?.lists.find((item) => item.id === list) ?? null)
      : null;
  const inActiveList = activeList
    ? myLists?.members.get(activeList.id)
    : undefined;
  const shown = activeList
    ? posts.filter((post) => inActiveList?.has(post.id))
    : posts;
  // Counts follow what the reader can actually see (published stories only).
  const chips = (myLists?.lists ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    count: posts.filter((post) => myLists?.members.get(item.id)?.has(post.id))
      .length,
  }));
  const showChips =
    myLists !== null && (posts.length > 0 || myLists.lists.length > 0);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight">
        Saved
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Only you can see this page.
      </p>
      <ReadingTabs active="saved" />
      <SavedOfflineSync paths={offlinePaths} />

      {showChips ? (
        <ListChips
          lists={chips}
          total={posts.length}
          activeId={activeList?.id ?? null}
          actions={<ListToolbarConnected activeList={activeList} />}
        />
      ) : null}

      {/* A failed request just hides the section. */}
      {!activeList && continueReading && continueReading.length > 0 ? (
        <ContinueReadingList items={continueReading} />
      ) : null}

      {ids === null ? (
        <p role="alert" className="py-4 text-sm text-destructive">
          Could not load your saved posts.
        </p>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">
            Nothing saved yet. Press Save under a story to keep it here.
          </p>
          <Link href="/" className="mt-4 inline-block text-primary hover:underline">
            Browse the latest stories
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          This list is empty. Open a saved story and use the arrow next to
          Saved to add it here.
        </p>
      ) : (
        <div>
          {shown.map((post) => (
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
    </div>
  );
}
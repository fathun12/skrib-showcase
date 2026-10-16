import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleContent } from "@/features/posts/ArticleContent";
import { moderatePost, suspendUser } from "@/features/moderation/actions";
import { listSuspended } from "@/features/moderation/suspensions";
import { SuspendAuthorButton } from "@/ui/moderation/SuspensionControls";
import {
  getAuthorHistory,
  getPostForReview,
  requireAdmin,
} from "@/features/moderation/queries";
import {
  ModerationCard,
  type ModerationActionName,
} from "@/ui/moderation/ModerationCard";

export const metadata: Metadata = {
  title: "Review post",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function ReviewPostPage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const post = await getPostForReview(id);
  if (!post) notFound();

  const history = await getAuthorHistory(post.authorId);
  const suspendedList = await listSuspended();
  const authorSuspended =
    suspendedList?.some((user) => user.userId === post.authorId) ?? false;

  const actions: ModerationActionName[] =
    post.status === "hidden"
      ? ["restore", "delete"]
      : post.status === "published"
        ? ["hide", "delete", "dismiss"]
        : ["delete", "dismiss"];

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
      <Link
        href="/admin/moderation"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to moderation
      </Link>

      <ul className="mt-4">
        <ModerationCard
          item={{
            postId: post.postId,
            title: post.title.trim() || "Untitled",
            href: null,
            authorName: post.authorName,
            authorUsername: post.authorUsername,
            statusLabel: post.status,
            history,
          }}
          actions={actions}
          onModerate={moderatePost}
        />
      </ul>

      <div className="mt-4">
        {authorSuspended ? (
          <p className="text-sm text-muted-foreground">
            This author is suspended. Lift it in the Suspended tab.
          </p>
        ) : (
          <SuspendAuthorButton
            userId={post.authorId}
            authorName={post.authorName}
            onSuspend={suspendUser}
          />
        )}
      </div>

      <article className="mt-10" lang={post.language}>
        <h1 className="font-serif text-4xl font-bold tracking-tight">
          {post.title.trim() || "Untitled"}
        </h1>
        {post.subtitle ? (
          <p className="mt-2 text-lg text-muted-foreground">{post.subtitle}</p>
        ) : null}
        <div className="mt-8">
          <ArticleContent content={post.content} />
        </div>
      </article>
    </div>
  );
}
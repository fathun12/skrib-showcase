import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/features/auth/queries";
import { getEditablePost } from "@/features/collab/queries";
import { readingTimeMin } from "@/features/posts/content";
import { ArticleContent } from "@/features/posts/ArticleContent";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";
import { PostHeader } from "@/ui/post/PostHeader";

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ id: string }> };

// A draft has no publish date yet; the preview shows today's date instead.
function previewDate() {
  return new Date().toISOString();
}

export default async function PreviewPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/write/${id}/preview`);

  // Null covers: malformed id, post does not exist, or the viewer is neither
  // the owner nor an accepted co-author.
  const post = await getEditablePost(id, user.id);
  if (!post) notFound();

  // Published posts have a real public page; a preview would be redundant.
  // The address belongs to the OWNER, whoever is looking.
  if (post.status === "published") {
    redirect(`/${post.owner.username}/${post.slug}`);
  }

  return (
    <div>
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-180 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:px-8">
          <Link
            href={`/write/${post.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Back to editor
          </Link>
          <p className="text-sm text-muted-foreground">
            {post.role === "owner"
              ? "Preview, only you can see this"
              : "Preview, only the authors can see this"}
          </p>
        </div>
      </div>

      <article className="mx-auto max-w-180 px-4 py-10 md:px-8">
        <PostHeader
          title={post.title.trim() || "Untitled"}
          subtitle={post.subtitle}
          publishedAt={previewDate()}
          readingTimeMin={readingTimeMin(post.content, post.language)}
          author={post.owner}
          lang={post.language}
        />
        <div className="mt-10" lang={post.language}>
          <ArticleContent content={post.content} />
        </div>
      </article>
    </div>
  );
}
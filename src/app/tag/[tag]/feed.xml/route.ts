import { buildRssFeed, rssResponse, type RssItem } from "@/features/feed/rss";
import { listPostsByTag } from "@/features/tags/queries";
import { tagLabel } from "@/ui/tags";

type Props = { params: Promise<{ tag: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { tag } = await params;

  // listPostsByTag returns nothing for an invalid tag, so an unknown tag, a
  // wrong tag and a tag without posts all end up as a 404.
  const page = await listPostsByTag(tag);
  if (page.posts.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const items: RssItem[] = page.posts.map((post) => ({
    title: post.title,
    path: `/${post.author.username}/${post.slug}`,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    authors: post.authors.map((a) => a.displayName),
  }));

  const label = tagLabel(tag);
  return rssResponse(
    buildRssFeed({
      title: `${label} on Skrib`,
      description: `The latest stories about ${label} on Skrib.`,
      path: `/tag/${tag}`,
      selfPath: `/tag/${tag}/feed.xml`,
      items,
    }),
  );
}
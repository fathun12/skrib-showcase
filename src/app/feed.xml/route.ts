import { buildRssFeed, rssResponse, type RssItem } from "@/features/feed/rss";
import { listRecentPublishedPosts } from "@/features/posts/queries";

export async function GET() {
  const posts = await listRecentPublishedPosts(20);

  const items: RssItem[] = [];
  for (const post of posts) {
    // The address of a post always uses the OWNER's username (authors[0]),
    // also for a co-authored story.
    const owner = post.authors[0];
    if (!owner) continue;
    items.push({
      title: post.title,
      path: `/${owner.username}/${post.slug}`,
      excerpt: post.excerpt,
      publishedAt: post.publishedAt,
      authors: post.authors.map((a) => a.displayName),
    });
  }

  return rssResponse(
    buildRssFeed({
      title: "Skrib",
      description: "A calm place to read and write.",
      path: "/",
      selfPath: "/feed.xml",
      items,
    }),
  );
}
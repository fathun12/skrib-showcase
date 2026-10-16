import { buildRssFeed, rssResponse, type RssItem } from "@/features/feed/rss";
import { listPublishedPostsByAuthor } from "@/features/posts/queries";
import { getProfileByUsername } from "@/features/profiles/queries";

type Props = { params: Promise<{ username: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { username } = await params;

  const profile = await getProfileByUsername(username);
  if (!profile) return new Response("Not found", { status: 404 });

  const posts = await listPublishedPostsByAuthor(profile.id, { limit: 20 });

  const items: RssItem[] = [];
  for (const post of posts) {
    // The address of a post always uses the OWNER's username (authors[0]),
    // also for a post this person only co-wrote.
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
      title: `${profile.displayName} on Skrib`,
      description: profile.bio || `Stories by ${profile.displayName} on Skrib.`,
      path: `/${profile.username}`,
      selfPath: `/${profile.username}/feed.xml`,
      items,
    }),
  );
}
import type { MetadataRoute } from "next";
import {
  listSitemapData,
  listSitemapSeries,
  listSitemapTags,
} from "@/features/seo/queries";
import { SITE_URL } from "@/lib/site";

// Home, the privacy and terms pages, every author with published posts, every
// published post, the biggest topics and the series with a published story.
// `lastModified` is only set where it is real (posts); a date that is always
// "now" would tell crawlers that everything changes constantly. Notes are
// left out on purpose: they are short and there can be very many.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ posts, usernames }, tags, series] = await Promise.all([
    listSitemapData(),
    listSitemapTags(),
    listSitemapSeries(),
  ]);

  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    ...usernames.map((username) => ({ url: `${SITE_URL}/${username}` })),
    ...posts.map((post) => ({
      url: `${SITE_URL}/${post.username}/${post.slug}`,
      lastModified: new Date(post.lastModified),
    })),
    ...tags.map((tag) => ({ url: `${SITE_URL}/tag/${tag}` })),
    ...series.map((item) => ({
      url: `${SITE_URL}/${item.username}/series/${item.slug}`,
    })),
  ];
}
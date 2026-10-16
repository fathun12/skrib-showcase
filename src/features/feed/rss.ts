import { SITE_URL } from "@/lib/site";

export type RssItem = {
  title: string;
  // Path on this site, for example /alice/my-post.
  path: string;
  excerpt: string;
  // ISO date string.
  publishedAt: string;
  authors: string[];
};

type RssFeed = {
  title: string;
  description: string;
  // Path of the page this feed belongs to.
  path: string;
  // Path of the feed itself.
  selfPath: string;
  items: RssItem[];
};

// XML 1.0 refuses most control characters, so they are dropped, and the five
// special characters are escaped. Done with a loop, not a regex, because a
// regex with control characters trips the lint rule no-control-regex.
function xmlEscape(text: string): string {
  let clean = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 || code >= 32) clean += ch;
  }
  return clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssFeed(feed: RssFeed): string {
  const newest = feed.items[0];
  const lastBuild = newest ? new Date(newest.publishedAt) : new Date();

  const items = feed.items.map((item) => {
    const url = `${SITE_URL}${item.path}`;
    return [
      "    <item>",
      `      <title>${xmlEscape(item.title)}</title>`,
      `      <link>${xmlEscape(url)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
      `      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>`,
      `      <dc:creator>${xmlEscape(item.authors.join(", "))}</dc:creator>`,
      `      <description>${xmlEscape(item.excerpt)}</description>`,
      "    </item>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${xmlEscape(feed.title)}</title>`,
    `    <link>${xmlEscape(`${SITE_URL}${feed.path}`)}</link>`,
    `    <description>${xmlEscape(feed.description)}</description>`,
    `    <atom:link href="${xmlEscape(`${SITE_URL}${feed.selfPath}`)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
    ...items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}

// A short cache lets the CDN absorb readers that poll often, and a new post
// still shows up within ten minutes.
export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
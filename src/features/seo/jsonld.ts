import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/site";
import { tagLabel } from "@/ui/tags";

type ArticleJsonLdInput = {
  title: string;
  description: string | undefined;
  // Path on this site, for example /alice/my-post.
  path: string;
  language: string;
  // ISO date string.
  publishedAt: string;
  // Absolute URL of the 1200x630 cover, or null for the default preview image.
  imageUrl: string | null;
  authors: { displayName: string; username: string }[];
  tags: string[];
};

// Structured data (schema.org BlogPosting) for one published post.
export function articleJsonLd(input: ArticleJsonLdInput) {
  const url = `${SITE_URL}${input.path}`;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    // Google advises at most 110 characters; cut by character, not by byte.
    headline: Array.from(input.title).slice(0, 110).join(""),
    ...(input.description ? { description: input.description } : {}),
    inLanguage: input.language,
    datePublished: input.publishedAt,
    image: [input.imageUrl ?? DEFAULT_OG_IMAGE],
    author: input.authors.map((author) => ({
      "@type": "Person",
      name: author.displayName,
      url: `${SITE_URL}/${author.username}`,
    })),
    publisher: { "@type": "Organization", name: "Skrib", url: SITE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(input.tags.length > 0
      ? { keywords: input.tags.map((tag) => tagLabel(tag)).join(", ") }
      : {}),
  };
}

// Structured data (schema.org WebSite) for the home page.
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Skrib",
    url: SITE_URL,
    description: "A calm place to read and write.",
  };
}

// The JSON goes inside a script tag. A title such as </script> would close the
// tag early, so every "<" is written as \u003c, which JSON still reads as "<".
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
// Address of a shared story. With a quote, a "text fragment" is added: browsers
// that support it scroll to the passage and mark it, others ignore it (the
// story simply opens). The passage must sit inside one paragraph to match.
const SHORT_QUOTE_WORDS = 12;
const EDGE_WORDS = 5;

// Text fragments need "-", "&" and "," encoded on top of the usual encoding.
function encodePart(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D");
}

export function storyHref(
  story: { authorUsername: string; slug: string },
  quote?: string | null,
): string {
  const base = `/${story.authorUsername}/${story.slug}`;
  const text = quote?.replace(/\s+/g, " ").trim();
  if (!text) return base;
  const words = text.split(" ");
  const target =
    words.length <= SHORT_QUOTE_WORDS
      ? encodePart(text)
      : `${encodePart(words.slice(0, EDGE_WORDS).join(" "))},${encodePart(words.slice(-EDGE_WORDS).join(" "))}`;
  return `${base}#:~:text=${target}`;
}
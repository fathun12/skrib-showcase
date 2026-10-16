// Plain sync helpers (NOT "use server"). Used by the save action to derive
// `excerpt` and `reading_time_min` from the Tiptap JSON document (spec §7.3).

// Minimal shape of a Tiptap/ProseMirror JSON node. Kept local so this file
// does not depend on Tiptap packages.
export type DocNode = {
  type?: string;
  text?: string;
  content?: DocNode[];
  [key: string]: unknown;
};

const WORDS_PER_MINUTE = 200;
const EXCERPT_MAX = 160;

// Block nodes get a trailing space so words from neighbouring paragraphs
// never glue together ("end.Start" -> "end. Start").
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "bulletList",
  "orderedList",
  "arabicBlock",
]);

function collect(node: DocNode, out: string[]): void {
  if (node.type === "text") {
    if (node.text) out.push(node.text);
    return;
  }
  // Footnote text is not part of the excerpt or the reading time.
  if (node.type === "footnotes") return;
  // A mention is not a text node: write it as "@label" so the name stays in
  // the excerpt and counts as one word in the reading time.
  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (typeof attrs?.label === "string" && attrs.label) {
      out.push(`@${attrs.label}`);
    }
    return;
  }
  if (node.type === "hardBreak" || node.type === "horizontalRule") {
    out.push(" ");
    return;
  }
  node.content?.forEach((child) => collect(child, out));
  if (node.type && BLOCK_TYPES.has(node.type)) out.push(" ");
}

// Empty paragraphs (e.g. the trailing node added by StarterKit) contribute
// nothing, because whitespace is collapsed and trimmed at the end.
export function extractPlainText(doc: DocNode): string {
  const out: string[] = [];
  collect(doc, out);
  return out.join("").replace(/\s+/g, " ").trim();
}

export function makeExcerpt(doc: DocNode, maxLength = EXCERPT_MAX): string {
  const text = extractPlainText(doc);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  // Cut at a word boundary when one exists near the end.
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.trimEnd() + "…";
}

// Languages written without spaces between words: counted by characters.
const CHARACTER_LANGUAGES = new Set(["ja", "zh"]);
// Rough reading speed for those languages (an estimate, easy to tune).
const CHARACTERS_PER_MINUTE = 450;

export function usesCharacters(lang?: string): boolean {
  return lang !== undefined && CHARACTER_LANGUAGES.has(lang);
}

// Number of words (characters for ja and zh), by the same rule as the
// reading time.
export function countWords(doc: DocNode, lang?: string): number {
  const text = extractPlainText(doc);
  if (!text) return 0;
  if (usesCharacters(lang)) return text.replace(/\s/g, "").length;
  return text.split(" ").length;
}

export function minutesForWords(words: number, lang?: string): number {
  const perMinute = usesCharacters(lang)
    ? CHARACTERS_PER_MINUTE
    : WORDS_PER_MINUTE;
  return Math.max(1, Math.ceil(words / perMinute));
}

export function readingTimeMin(doc: DocNode, lang?: string): number {
  return minutesForWords(countWords(doc, lang), lang);
}
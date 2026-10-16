// Headings of a post: one rule for the anchors in the article and for the
// "On this page" list, so the links always match their targets.
import type { DocNode } from "./content";
import { slugify, withSuffix } from "./slug";

export type HeadingEntry = {
  // null: the heading has no text, so it gets no anchor.
  id: string | null;
  text: string;
  level: number;
};

export type TocItem = { id: string; text: string; level: number };

// The list is hidden below this many headings (levels 2 and 3 together).
export const TOC_MIN_HEADINGS = 3;

// A prefix keeps the anchors away from other ids on the page (#comments,
// #credits, footnotes).
const ID_PREFIX = "h-";

// Same title twice gives -2, -3 (and never an id that is already taken).
function makeIdAllocator(): (text: string) => string {
  const used = new Set<string>();
  return (text) => {
    const base = `${ID_PREFIX}${slugify(text)}`;
    let attempt = 1;
    let id = base;
    while (used.has(id)) {
      attempt += 1;
      id = withSuffix(base, attempt);
    }
    used.add(id);
    return id;
  };
}

function plainText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    return typeof attrs?.label === "string" && attrs.label
      ? `@${attrs.label}`
      : "";
  }
  return (node.content ?? []).map(plainText).join("");
}

// Every heading of the document, in reading order. The article renderer takes
// the n-th entry for the n-th heading it draws.
export function listHeadings(doc: DocNode): HeadingEntry[] {
  const nextId = makeIdAllocator();
  const out: HeadingEntry[] = [];

  const visit = (node: DocNode) => {
    if (node.type === "heading") {
      const text = plainText(node).replace(/\s+/g, " ").trim();
      const attrs = node.attrs as Record<string, unknown> | undefined;
      const raw = attrs?.level;
      const level = typeof raw === "number" && raw >= 1 && raw <= 6 ? raw : 2;
      out.push({ id: text ? nextId(text) : null, text, level });
      return;
    }
    node.content?.forEach(visit);
  };

  visit(doc);
  return out;
}

// What the "On this page" list shows: levels 2 and 3 with text, or nothing
// when there are fewer than TOC_MIN_HEADINGS.
export function tocItems(doc: DocNode): TocItem[] {
  const items: TocItem[] = [];
  for (const entry of listHeadings(doc)) {
    if (entry.id && (entry.level === 2 || entry.level === 3)) {
      items.push({ id: entry.id, text: entry.text, level: entry.level });
    }
  }
  return items.length >= TOC_MIN_HEADINGS ? items : [];
}
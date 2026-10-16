// Finds the paragraphs and headings of the article that "Listen" reads, and
// the plain text of each. Pure DOM helpers, no React.

// Never read aloud: code, images with captions, footnotes, and blocks in
// another direction or in Arabic (the voice is chosen for the post language).
const SKIP = 'pre, figure, nav, .footnotes, [dir="rtl"], [lang="ar"]';

function isSkipped(el: HTMLElement, root: HTMLElement): boolean {
  // The root itself carries the post language, so it must not count.
  const hit = el.closest(SKIP);
  return hit !== null && hit !== root && root.contains(hit);
}

// The text of one block: footnote numbers and the section "#" link are left out.
export function listenText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("sup, .heading-anchor")
    .forEach((node) => node.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function collectListenItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("p, h2, h3")).filter(
    (el) => !isSkipped(el, root) && listenText(el) !== "",
  );
}
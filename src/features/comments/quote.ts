// Turns the current text selection into the plain text of a quote. Footnote
// numbers are left out (they are not part of the story text) and blocks are
// separated by a space, so the result matches `extractPlainText` on the server.
export function quoteFromSelection(selection: Selection): string {
  if (selection.rangeCount === 0 || selection.isCollapsed) return "";
  const box = document.createElement("div");
  box.appendChild(selection.getRangeAt(0).cloneContents());
  box.querySelectorAll("a.footnote-ref").forEach((el) => el.remove());
  box
    .querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, br")
    .forEach((el) => el.after(" "));
  return (box.textContent ?? "").replace(/\s+/g, " ").trim();
}
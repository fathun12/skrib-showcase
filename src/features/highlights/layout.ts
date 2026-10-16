// Turns a Range into rounded boxes, one per line of text, in coordinates
// relative to `origin` (the article body). The look follows the editor's
// highlight (.prose-article mark): radius 0.2em, inline padding 0.1em.
// Change the two numbers below to change the shape.
const RADIUS_EM = 0.2;
const PAD_X_EM = 0.1;

export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
};

type Rect = { left: number; right: number; top: number; bottom: number };

export function boxesForRange(range: Range, origin: DOMRect): Box[] {
  const root = range.commonAncestorContainer;
  const scope = root.nodeType === Node.TEXT_NODE ? root.parentNode : root;
  if (!scope) return [];

  // Only the rectangles of the text itself: a range also reports the boxes of
  // elements inside it, which would be drawn twice.
  const pieces: Rect[] = [];
  let fontSize = 20;
  let sized = false;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!range.intersectsNode(node)) continue;
    const piece = document.createRange();
    piece.selectNodeContents(node);
    if (node === range.startContainer) piece.setStart(node, range.startOffset);
    if (node === range.endContainer) piece.setEnd(node, range.endOffset);
    if (!sized && node.parentElement) {
      const parsed = parseFloat(getComputedStyle(node.parentElement).fontSize);
      if (parsed > 0) fontSize = parsed;
      sized = true;
    }
    for (const rect of Array.from(piece.getClientRects())) {
      if (rect.width > 0 && rect.height > 0) {
        pieces.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        });
      }
    }
  }

  // Join the pieces of one line (text next to italic text and so on), so the
  // corners are rounded only at the ends of the line.
  const lines: Rect[] = [];
  pieces.sort((a, b) => a.top - b.top || a.left - b.left);
  for (const piece of pieces) {
    const line = lines.find(
      (candidate) =>
        Math.min(candidate.bottom, piece.bottom) -
          Math.max(candidate.top, piece.top) >
        Math.min(candidate.bottom - candidate.top, piece.bottom - piece.top) *
          0.5,
    );
    if (line) {
      line.left = Math.min(line.left, piece.left);
      line.right = Math.max(line.right, piece.right);
      line.top = Math.min(line.top, piece.top);
      line.bottom = Math.max(line.bottom, piece.bottom);
    } else {
      lines.push({ ...piece });
    }
  }

  const pad = fontSize * PAD_X_EM;
  return lines.map((line) => ({
    left: line.left - origin.left - pad,
    top: line.top - origin.top,
    width: line.right - line.left + pad * 2,
    height: line.bottom - line.top,
    radius: fontSize * RADIUS_EM,
  }));
}
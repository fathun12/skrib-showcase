// Pure DOM helpers: turn a selection into a stable address (block number,
// character range, quoted text) and turn a stored address back into a Range.
// A "block" is a paragraph or heading of the article body. The same selector
// is used when saving and when restoring, so the numbers match.

import type { HighlightColor } from "@/ui/editor/colors";

export const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6";

export type Anchor = {
  blockIndex: number;
  start: number;
  end: number;
  quote: string;
};

export type StoredHighlight = {
  id: string;
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  quote: string;
  color: HighlightColor;
};

export function listBlocks(body: Element): Element[] {
  return Array.from(body.querySelectorAll(BLOCK_SELECTOR));
}

function blockOf(node: Node, body: Element): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  const block = element?.closest(BLOCK_SELECTOR) ?? null;
  return block && body.contains(block) ? block : null;
}

// null when the selection touches more than one block or leaves the body.
export function anchorFromRange(range: Range, body: Element): Anchor | null {
  const startBlock = blockOf(range.startContainer, body);
  const endBlock = blockOf(range.endContainer, body);
  if (!startBlock || !endBlock) return null;

  // A triple click ends at the very start of the next block: that is still
  // one block, as long as nothing of the next block is selected.
  let endsAtBlockEnd = false;
  if (endBlock !== startBlock) {
    const probe = document.createRange();
    probe.selectNodeContents(endBlock);
    probe.setEnd(range.endContainer, range.endOffset);
    if (probe.toString().length > 0) return null;
    endsAtBlockEnd = true;
  }

  const text = startBlock.textContent ?? "";
  const measure = document.createRange();
  measure.selectNodeContents(startBlock);
  measure.setEnd(range.startContainer, range.startOffset);
  let start = measure.toString().length;
  let end = text.length;
  if (!endsAtBlockEnd) {
    measure.setEnd(range.endContainer, range.endOffset);
    end = measure.toString().length;
  }

  // Leave out spaces at both ends of the passage.
  while (start < end && /\s/.test(text.charAt(start))) start += 1;
  while (end > start && /\s/.test(text.charAt(end - 1))) end -= 1;
  if (end <= start) return null;

  const blockIndex = listBlocks(body).indexOf(startBlock);
  if (blockIndex < 0) return null;
  return { blockIndex, start, end, quote: text.slice(start, end) };
}

function rangeInBlock(block: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let position = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const length = text.data.length;
    if (!startNode && start < position + length) {
      startNode = text;
      startOffset = start - position;
    }
    if (end <= position + length) {
      endNode = text;
      endOffset = end - position;
      break;
    }
    position += length;
  }
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

// Finds the passage again. If the author edited the story, the saved numbers
// may be wrong: then the quoted text is searched (same block first, then the
// whole article). null = the passage is gone, so it is simply not drawn.
export function resolveRange(
  blocks: Element[],
  item: StoredHighlight,
): Range | null {
  const block: Element | undefined = blocks[item.blockIndex];
  if (block) {
    const text = block.textContent ?? "";
    if (text.slice(item.startOffset, item.endOffset) === item.quote) {
      return rangeInBlock(block, item.startOffset, item.endOffset);
    }
  }
  const candidates = block ? [block, ...blocks] : blocks;
  for (const candidate of candidates) {
    const index = (candidate.textContent ?? "").indexOf(item.quote);
    if (index >= 0) {
      return rangeInBlock(candidate, index, index + item.quote.length);
    }
  }
  return null;
}
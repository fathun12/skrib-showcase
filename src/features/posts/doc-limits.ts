// Plain helper, no dependencies. Checked BEFORE the recursive Zod parse, so a
// hostile document cannot make the parser recurse thousands of levels deep.
export const DOC_MAX_DEPTH = 40;
export const DOC_MAX_NODES = 50_000;

// Walks the document with a loop (not recursion) and gives up as soon as it
// is too deep or has too many nodes.
export function isDocWithinLimits(value: unknown): boolean {
  const stack: { node: unknown; depth: number }[] = [
    { node: value, depth: 1 },
  ];
  let count = 0;

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    if (item.depth > DOC_MAX_DEPTH) return false;
    count += 1;
    if (count > DOC_MAX_NODES) return false;

    if (typeof item.node !== "object" || item.node === null) continue;
    const content = (item.node as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const child of content) {
        stack.push({ node: child, depth: item.depth + 1 });
      }
    }
  }
  return true;
}
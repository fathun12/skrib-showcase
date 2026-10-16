// All Cloudinary image URLs inside a stored Tiptap document (the `src` of the
// image nodes). Iterative on purpose: no recursion on stored data.
export function collectImageUrls(content: unknown): string[] {
  const urls = new Set<string>();
  const stack: unknown[] = [content];
  let steps = 0;

  while (stack.length > 0 && steps < 100_000) {
    steps++;
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    const record = node as {
      type?: unknown;
      attrs?: { src?: unknown };
      content?: unknown;
    };
    if (
      record.type === "image" &&
      typeof record.attrs?.src === "string" &&
      record.attrs.src.startsWith("https://res.cloudinary.com/")
    ) {
      urls.add(record.attrs.src);
    }
    if (Array.isArray(record.content)) {
      for (const child of record.content) stack.push(child);
    }
  }
  return [...urls];
}
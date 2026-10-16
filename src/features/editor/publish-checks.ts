// Gentle suggestions shown in the Publish dialog. Pure functions: no editor,
// no React. They never block publishing.

// The smallest shape this file needs from a Tiptap/ProseMirror JSON node.
type DocLike = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocLike[];
};

// A title shorter than this gets a hint.
export const SHORT_TITLE_CHARS = 15;

// Images whose alt text is missing or only spaces.
export function countImagesWithoutAlt(doc: DocLike): number {
  let count = 0;
  const visit = (node: DocLike) => {
    if (node.type === "image") {
      const alt = node.attrs?.alt;
      if (typeof alt !== "string" || alt.trim() === "") count += 1;
      return;
    }
    node.content?.forEach(visit);
  };
  visit(doc);
  return count;
}

type ChecksInput = {
  title: string;
  missingAlt: number;
  hasCover: boolean;
  topicCount: number;
};

// Empty list: everything looks fine and the dialog shows nothing extra.
export function buildPublishChecks(input: ChecksInput): string[] {
  const out: string[] = [];
  if (input.missingAlt > 0) {
    out.push(
      input.missingAlt === 1
        ? "1 image has no alt text"
        : `${input.missingAlt} images have no alt text`,
    );
  }
  if (!input.hasCover) out.push("No cover image yet");
  if (input.topicCount === 0) out.push("No topics yet");
  if (input.title.trim().length < SHORT_TITLE_CHARS) {
    out.push(`The title is short (under ${SHORT_TITLE_CHARS} characters)`);
  }
  return out;
}
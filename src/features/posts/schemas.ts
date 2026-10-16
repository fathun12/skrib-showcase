import { z } from "zod";
import { tagsSchema } from "@/features/tags/schemas";
import { ownCloudinaryImageUrl } from "@/features/uploads/schemas";
import { isHighlightColor, isTextColor } from "@/ui/editor/colors";
import { IMAGE_ALIGNS } from "@/ui/image-align";
import { SLUG_MAX, SUBTITLE_MAX, TITLE_MAX } from "./limits";
import { isDocWithinLimits } from "./doc-limits";
import { isLanguageCode } from "./languages";

// Why: must match the extensions in features/editor/extensions.ts.
export const ALLOWED_NODES = [
  "doc",
  "paragraph",
  "text",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "horizontalRule",
  "hardBreak",
  "image",
  "arabicBlock",
  // @mentions (migration 0101 reads attrs.id). Once a real post has one,
  // never remove it from this list: stored posts would read as empty.
  "mention",
  // Footnotes (package tiptap-footnotes). Once a real post contains these,
  // they must never be removed from this list: stored posts would read as empty.
  "footnotes",
  "footnote",
  "footnoteReference",
] as const;

// highlight and textColor: once a real post uses them, never remove them from
// this list (stored posts would read as empty).
export const ALLOWED_MARKS = [
  "bold",
  "italic",
  "underline",
  "link",
  "code",
  "highlight",
  "textColor",
] as const;

export { SLUG_MAX, SUBTITLE_MAX, TITLE_MAX };
const CONTENT_MAX_BYTES = 500_000;
// A link address longer than this is never a real link.
const HREF_MAX = 2000;

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

const markSchema = z
  .object({
    type: z.enum(ALLOWED_MARKS),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (mark) => {
      if (mark.type !== "link") return true;
      const href = mark.attrs?.href;
      // Why: blocks javascript: and data: links, which would be an XSS risk for readers.
      return (
        typeof href === "string" &&
        href.length <= HREF_MAX &&
        /^(https?:|mailto:)/i.test(href)
      );
    },
    { message: "Links must start with http, https or mailto" },
  )
  .refine(
    (mark) => {
      const color = mark.attrs?.color;
      // The reader writes this name into an HTML attribute: only names from
      // the fixed lists pass. A highlight without a color is the default one.
      if (mark.type === "textColor") return isTextColor(color);
      if (mark.type === "highlight") {
        return color === undefined || color === null || isHighlightColor(color);
      }
      return true;
    },
    { message: "Unknown color" },
  );


  const IMAGE_TEXT_MAX = 300;
const imageText = z.string().max(IMAGE_TEXT_MAX).nullish();

// Checked on the server for every image node. `src` is the security rule:
// only our own Cloudinary account (the cloud name is read at validation time).
const imageAttrsSchema = z.object({
  src: ownCloudinaryImageUrl,
  alt: imageText,
  caption: imageText,
  // The base Image node also has a title attribute; limit it like the others.
  title: imageText,
  align: z.enum(IMAGE_ALIGNS).nullish(),
});

// The reader writes these attributes into HTML, so they are kept short and
// plain (the class can only be one of the two values the package sets).
const FOOTNOTE_NODES = new Set<string>([
  "footnotes",
  "footnote",
  "footnoteReference",
]);
const footnoteText = z.string().max(100).nullish();
const footnoteAttrsSchema = z.object({
  id: footnoteText,
  "data-id": footnoteText,
  referenceNumber: footnoteText,
  href: footnoteText,
  class: z.enum(["footnote-ref", "footnotes"]).nullish(),
});

// The database reads the id and the reader writes the label into a link, so
// both are checked. The label is a username (src/lib/constants).
const mentionAttrsSchema = z.object({
  id: z.uuid(),
  label: z.string().regex(/^[a-z0-9_-]{3,30}$/),
});

const nodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z
    .object({
      type: z.enum(ALLOWED_NODES),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(nodeSchema).optional(),
      marks: z.array(markSchema).optional(),
      text: z.string().optional(),
    })
    .refine(
      (node) =>
        node.type !== "image" || imageAttrsSchema.safeParse(node.attrs).success,
      { message: "Invalid image" },
    )
    .refine(
      (node) =>
        !FOOTNOTE_NODES.has(node.type) ||
        footnoteAttrsSchema.safeParse(node.attrs ?? {}).success,
      { message: "Invalid footnote" },
    )
    .refine(
      (node) =>
        node.type !== "mention" ||
        mentionAttrsSchema.safeParse(node.attrs ?? {}).success,
      { message: "Invalid mention" },
    ),
);

// The depth and node count are checked first, before the recursive parse.
export const docSchema = z
  .unknown()
  .refine(isDocWithinLimits, { message: "Post is too complex" })
  .pipe(
    nodeSchema
      .refine((node) => node.type === "doc", { message: "Root must be a doc" })
      .refine((node) => JSON.stringify(node).length <= CONTENT_MAX_BYTES, {
        message: "Post is too long",
      }),
  );

// Input for saving a draft. No id means "create a new draft".
export const savePostSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().max(TITLE_MAX),
  // Optional so older callers keep working; undefined means "leave unchanged".
  subtitle: z.string().max(SUBTITLE_MAX).optional(),
  // Optional so older callers keep working; undefined means "leave unchanged".
  language: z.string().refine(isLanguageCode, "Unknown language").optional(),
  content: docSchema,
});

export type SavePostInput = z.infer<typeof savePostSchema>;

// Input for publishing a draft. The slug comes from the Publish dialog (the
// author may have edited it), so it is validated here, not trusted.
export const publishPostSchema = z.object({
  id: z.uuid(),
  slug: z
    .string()
    .min(1)
    .max(SLUG_MAX)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  // Optional cover chosen in the Publish dialog (own Cloudinary account only).
  coverImageUrl: ownCloudinaryImageUrl.nullish(),
  // Topics chosen in the Publish dialog. Missing means none.
  tags: tagsSchema.optional(),
  // Newsletter checkbox of the Publish dialog. Missing means "do not email".
  emailSubscribers: z.boolean().optional(),
});

export type PublishPostInput = z.infer<typeof publishPostSchema>;

// Input for changing the cover of an already published post. `null` removes
// the cover; the key itself is required so a missing value is never read as
// "remove".
export const updateCoverSchema = z.object({
  id: z.uuid(),
  coverImageUrl: ownCloudinaryImageUrl.nullable(),
});

export type UpdateCoverInput = z.infer<typeof updateCoverSchema>;

// Input for updating an already published post: the same rules as a draft
// save, but the id is required (there is no "create" here).
export const updatePostSchema = savePostSchema.extend({ id: z.uuid() });

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
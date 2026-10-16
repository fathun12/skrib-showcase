import { Mark, Node as ProseNode, mergeAttributes } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import StarterKit from "@tiptap/starter-kit";
import { Footnote, FootnoteReference, Footnotes } from "tiptap-footnotes";
import { isOwnCloudinaryImageUrl } from "@/features/uploads/validate";
import { isHighlightColor, isTextColor } from "@/ui/editor/colors";

// The shared image node (no node view): the editor and the reader agree on its
// attributes. The editor-only node view is added in a separate file later.
export const ImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // rendered: false = kept in the JSON, but not written as HTML attributes.
      caption: { default: null, rendered: false },
      align: { default: "normal", rendered: false },
    };
  },
  // Pasted HTML may contain <img> from other sites. Only our own Cloudinary
  // images become image nodes; anything else is ignored instead of making the
  // save fail later.
  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const src = element.getAttribute("src");
          return src &&
            isOwnCloudinaryImageUrl(
              src,
              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            )
            ? null
            : false;
        },
      },
    ];
  },
}).configure({ inline: false, allowBase64: false });

// Why: one shared schema, so the editor and the reader agree on what content is allowed.
// The document may end with the list of footnotes. It is optional, so every
// old post stays valid.
const FootnoteDocument = Document.extend({ content: "block+ footnotes?" });

// Highlight with a color NAME (data-color), never a raw CSS color. A pasted
// <mark> from elsewhere has no valid name and becomes the default (yellow).
const HighlightMark = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-color");
          return isHighlightColor(value) ? value : null;
        },
        renderHTML: (attributes: { color?: string | null }) =>
          attributes.color ? { "data-color": attributes.color } : {},
      },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
    arabicBlock: {
      toggleArabicBlock: () => ReturnType;
    };
  }
}

// Text color with a color NAME (data-text-color). Pasted spans without a
// valid name are not turned into this mark at all.
const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-text-color"),
        renderHTML: (attributes: { color?: string | null }) =>
          attributes.color ? { "data-text-color": attributes.color } : {},
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-text-color]",
        getAttrs: (element) =>
          isTextColor(element.getAttribute("data-text-color")) ? null : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

// Arabic block: right-to-left paragraphs for Arabic quotes inside a post of
// any language. It has no attributes: lang and dir are always written by
// renderHTML, never stored, so stored data cannot change them.
// The block holds paragraphs only (no lists, headings or images).
// Never remove "arabicBlock" from ALLOWED_NODES in schemas.ts once a real
// post uses it (stored posts would read as empty).
const ArabicBlock = ProseNode.create({
  name: "arabicBlock",
  group: "block",
  content: "paragraph+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-arabic-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-arabic-block": "",
        lang: "ar",
        dir: "rtl",
      }),
      0,
    ];
  },
  addCommands() {
    return {
      toggleArabicBlock:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});

// A person mentioned in a story: attributes `id` (the user id) and `label`
// (the username when it was written). The suggestion list is added only in
// editor-extensions.ts; the reader needs just this shared node. The database
// reads `attrs.id` (migration 0101).
export const MentionNode = Mention.configure({
  HTMLAttributes: {
    class: "mention rounded-md bg-primary/10 px-1 font-medium text-primary",
  },
  renderText: ({ node }) => `@${String(node.attrs.label ?? "")}`,
});

export const baseExtensions = [
  FootnoteDocument,
  StarterKit.configure({
    // Replaced by FootnoteDocument above.
    document: false,
    heading: { levels: [2, 3] },
    codeBlock: false,
    strike: false,
    // Why: clicking a link while editing should place the cursor, not navigate away.
    link: {
      openOnClick: false,
      autolink: true,
      // Same rule as schemas.ts. A pasted link that fails it (such as Word's
      // internal footnote links, #_ftn1) becomes plain text instead of making
      // the save fail later.
      isAllowedUri: (url, ctx) =>
        ctx.defaultValidate(url) && /^(https?:|mailto:)/i.test(url),
    },
  }),
  ImageNode,
  Footnotes,
  Footnote,
  FootnoteReference,
  HighlightMark,
  TextColorMark,
  ArabicBlock,
  MentionNode,
];
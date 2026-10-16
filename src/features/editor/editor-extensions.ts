import Typography from "@tiptap/extension-typography";
import {
  Extension,
  InputRule,
  ReactNodeViewRenderer,
  textInputRule,
} from "@tiptap/react";
import { ImageNode, MentionNode, baseExtensions } from "./extensions";
import { ImageNodeView } from "./ImageNodeView";
import { createMentionSuggestion } from "./mention-suggestion";
import { UploadPlaceholder } from "./upload-placeholder";

// Editor-only: same schema as the shared ImageNode, plus the React node view.
// It must NOT go into baseExtensions, because the reader's static renderer
// imports that list and must stay free of React node views.
const EditorImageNode = ImageNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
}).configure({ inline: false, allowBase64: false });

// Swap the shared image node for the editor version (two extensions with the
// same name would conflict).
// Editor-only shortcut (Ctrl+Alt+F) to add a footnote at the cursor. It does
// nothing inside a note, where a footnote makes no sense.
const FootnoteShortcut = Extension.create({
  name: "footnoteShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-f": () => {
        if (this.editor.isActive("footnote")) return true;
        return this.editor
          .chain()
          .focus()
          .setTextSelection(this.editor.state.selection.to)
          .addFootnote()
          .run();
      },
    };
  },
});

// En dash: "word - word" becomes "word – word". It needs a non-space character
// before the hyphen, so the start of a bullet list ("- ") is never touched.
// (The em dash comes from Typography: type --.)
const EnDash = Extension.create({
  name: "enDash",
  addInputRules() {
    return [textInputRule({ find: /\S\s(-)\s$/, replace: "–" })];
  },
});

// Words that end with a period but do not end a sentence.
const NOT_A_SENTENCE_END = new Set([
  "dll", "dsb", "dst", "dkk", "tsb", "yg", "dg", "dr", "drs", "ir", "prof",
  "no", "hlm", "mis", "vs", "etc", "mr", "mrs", "ms", "jr", "sr", "st",
  "e.g", "i.e",
  // German
  "bzw", "usw", "vgl", "ggf", "evtl", "ca", "inkl", "bspw", "nr", "str",
  "sog", "d.h", "z.b", "u.a", "z.t", "s.o", "s.u", "u.v.m",
  // French
  "cf", "p.ex", "env", "av", "apr", "mme", "mlle", "c.-à-d",
]);

// A lowercase letter typed after ". ", "! " or "? " becomes a capital.
// Backspace right after it gives the lowercase letter back (Tiptap undoes
// the last input rule).
const CapitalizeSentence = Extension.create({
  name: "capitalizeSentence",
  addInputRules() {
    return [
      new InputRule({
        find: /(\S+)([.!?])\s([a-z])$/,
        handler: ({ state, range, match }) => {
          const word = match[1].toLowerCase();
          // Single letters are initials ("J. k"), the listed words are
          // abbreviations: both leave the next letter alone.
          if (
            match[2] === "." &&
            (word.length === 1 || NOT_A_SENTENCE_END.has(word))
          ) {
            return null;
          }
          const at = range.from + match[0].length - 1;
          state.tr.insertText(match[3].toUpperCase(), at, range.to);
        },
      }),
      // The first lowercase letter of a paragraph (or list item) becomes a
      // capital. Headings are left alone. It matches only when the typed
      // letter is the whole text so far, so it never touches later words.
      new InputRule({
        find: /^([a-z])$/,
        handler: ({ state, range, match }) => {
          if (state.selection.$from.parent.type.name !== "paragraph") {
            return null;
          }
          state.tr.insertText(match[1].toUpperCase(), range.from, range.to);
        },
      }),
    ];
  },
});

// Editor-only: the shared mention node plus the @ suggestion list. The
// reader's static renderer imports baseExtensions and must not get it.
const EditorMentionNode = MentionNode.configure({
  suggestion: createMentionSuggestion(),
});

export const editorExtensions = [
  ...baseExtensions.filter(
    (extension) => extension !== ImageNode && extension !== MentionNode,
  ),
  EditorImageNode,
  EditorMentionNode,
  FootnoteShortcut,
  // Only the dash, ellipsis and quote rules are on; arrows, fractions,
  // (c), 3x4 and the rest are off so nothing surprising is replaced.
  Typography.configure({
    leftArrow: false,
    rightArrow: false,
    copyright: false,
    trademark: false,
    servicemark: false,
    registeredTrademark: false,
    oneHalf: false,
    oneQuarter: false,
    threeQuarters: false,
    plusMinus: false,
    notEqual: false,
    laquo: false,
    raquo: false,
    multiplication: false,
    superscriptTwo: false,
    superscriptThree: false,
  }),
  EnDash,
  CapitalizeSentence,
  UploadPlaceholder,
];
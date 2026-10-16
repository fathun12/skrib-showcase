"use client";

import { useState, useSyncExternalStore } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { BubbleToolbar, type BlockType } from "@/ui/editor/BubbleToolbar";
import {
  isHighlightColor,
  isTextColor,
  type HighlightColor,
  type TextColor,
} from "@/ui/editor/colors";
import { normalizeLinkUrl } from "./link-url";

// Touch screens: the phone shows its own menu (Cut, Copy...) above the
// selection and the selection handles below it. Only the browser knows this,
// so the toolbar uses the pointer type and not the real position of that menu.
function subscribeCoarse(onChange: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readCoarse = () => window.matchMedia("(pointer: coarse)").matches;
const serverCoarse = () => false;

function getBlock(editor: Editor): BlockType {
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("blockquote")) return "quote";
  if (editor.isActive("bulletList")) return "bullet";
  if (editor.isActive("orderedList")) return "ordered";
  return "paragraph";
}

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const coarse = useSyncExternalStore(
    subscribeCoarse,
    readCoarse,
    serverCoarse,
  );
  // Why: editor.isActive() alone does not re-render React; this hook subscribes to changes.
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const { from, to } = ctx.editor.state.selection;
      const href: unknown = ctx.editor.getAttributes("link").href;
      const highlightAttr: unknown = ctx.editor.getAttributes("highlight").color;
      const textColorAttr: unknown = ctx.editor.getAttributes("textColor").color;
      return {
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isLink: ctx.editor.isActive("link"),
        linkHref: typeof href === "string" ? href : "",
        selectionKey: `${from}-${to}`,
        // A highlight without a name is the default yellow one.
        activeHighlight: ctx.editor.isActive("highlight")
          ? isHighlightColor(highlightAttr)
            ? highlightAttr
            : "yellow"
          : null,
        activeTextColor: isTextColor(textColorAttr) ? textColorAttr : null,
        block: getBlock(ctx.editor),
        inFootnote: ctx.editor.isActive("footnote"),
        isArabic: ctx.editor.isActive("arabicBlock"),
      };
    },
  });

  // The link input is open only for the selection it was opened on, so it
  // closes by itself when the selection moves (same idea as the "+" menu).
  const [linkOpenFor, setLinkOpenFor] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | undefined>(undefined);
  const linkEditing = linkOpenFor === state.selectionKey;

  // Same idea for the color panel: it closes when the selection moves.
  const [colorOpenFor, setColorOpenFor] = useState<string | null>(null);
  const colorOpen = colorOpenFor === state.selectionKey;

  function applyHighlight(color: HighlightColor | null) {
    const chain = editor.chain().focus();
    if (color === null) chain.unsetHighlight().run();
    else chain.setHighlight({ color }).run();
  }

  function applyTextColor(color: TextColor | null) {
    const chain = editor.chain().focus();
    if (color === null) chain.unsetTextColor().run();
    else chain.setTextColor(color).run();
  }

  function openLink() {
    setLinkError(undefined);
    setLinkOpenFor(state.selectionKey);
  }

  function cancelLink() {
    setLinkOpenFor(null);
    editor.chain().focus().run();
  }

  function applyLink(raw: string) {
    const href = normalizeLinkUrl(raw);
    if (!href) {
      setLinkError("Enter a web address or an email address.");
      return;
    }
    // extendMarkRange: when the selection touches an existing link, edit the
    // whole link instead of splitting it.
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpenFor(null);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpenFor(null);
  }

  return (
    <BubbleMenu
      // The key makes a new menu when the pointer type changes (I did not
      // verify that Tiptap applies changed options by itself).
      key={coarse ? "coarse" : "fine"}
      editor={editor}
      options={{
        // Touch: below the selection, past the handles (56 px is a guess to
        // tune on a phone); flip puts it above when the keyboard leaves no room.
        placement: coarse ? "bottom" : "top",
        offset: coarse ? 56 : 8,
        flip: { padding: 8 },
        shift: { padding: 8 },
      }}
    >
      <BubbleToolbar
        isBold={state.isBold}
        isItalic={state.isItalic}
        isUnderline={state.isUnderline}
        isLink={state.isLink}
        block={state.block}
        linkEditing={linkEditing}
        linkUrl={state.linkHref}
        linkError={linkError}
        onBold={() => editor.chain().focus().toggleBold().run()}
        onItalic={() => editor.chain().focus().toggleItalic().run()}
        onUnderline={() => editor.chain().focus().toggleUnderline().run()}
        onLinkOpen={openLink}
        onLinkApply={applyLink}
        onLinkRemove={removeLink}
        onLinkCancel={cancelLink}
        onHeading2={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        onHeading3={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        onQuote={() => editor.chain().focus().toggleBlockquote().run()}
        onBulletList={() => editor.chain().focus().toggleBulletList().run()}
        onOrderedList={() => editor.chain().focus().toggleOrderedList().run()}
        onParagraph={() => editor.chain().focus().clearNodes().run()}
        isArabic={state.isArabic}
        onArabic={() => editor.chain().focus().toggleArabicBlock().run()}
        colorOpen={colorOpen}
        hasColor={state.activeHighlight !== null || state.activeTextColor !== null}
        activeHighlight={state.activeHighlight}
        activeTextColor={state.activeTextColor}
        onColorOpen={() => setColorOpenFor(state.selectionKey)}
        onColorClose={() => setColorOpenFor(null)}
        onHighlight={applyHighlight}
        onTextColor={applyTextColor}
        // Collapse the selection to its end first, so the selected text is
        // kept and the reference lands right after it.
        onFootnote={
          state.inFootnote
            ? undefined
            : () =>
                editor
                  .chain()
                  .focus()
                  .setTextSelection(editor.state.selection.to)
                  .addFootnote()
                  .run()
        }
      />
    </BubbleMenu>
  );
}
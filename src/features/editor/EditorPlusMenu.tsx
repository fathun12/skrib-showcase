"use client";

import { useEffect, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { PlusMenu } from "@/ui/editor/PlusMenu";

type Props = {
  editor: Editor;
  // Opens the file picker for an image (the image flow lives in useImageInsert).
  onImage: () => void;
  // True while an image uploads: the menu shows its busy state.
  imageUploading: boolean;
};

export function EditorPlusMenu({ editor, onImage, imageUploading }: Props) {
  const pos = useEditorState({
    editor,
    selector: (ctx) => ctx.editor.state.selection.from,
  });
  // Why: remembering WHERE it was opened closes the menu automatically when the cursor moves.
  const [openAt, setOpenAt] = useState<number | null>(null);
  const open = openAt === pos;

  // The keyboard and the browser scroll the page a moment AFTER the cursor
  // moves, so the "+" is placed again when things settle (debounced).
  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!editor.isDestroyed) {
          editor.commands.setMeta("plusMenu", "updatePosition");
        }
      }, 120);
    };
    update();
    const vv = window.visualViewport;
    window.addEventListener("scroll", update, { passive: true });
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [editor, pos]);

  const run = (command: () => void) => {
    command();
    setOpenAt(null);
  };

  function handleImageClick() {
    setOpenAt(null);
    onImage();
  }

  return (
    <FloatingMenu
      editor={editor}
      pluginKey="plusMenu"
      options={{ placement: "left-start", offset: 12 }}
      shouldShow={({ editor: ed, state }) => {
        const { $from, empty } = state.selection;
        // Only on an empty top-level paragraph (not inside quotes or lists).
        return (
          ed.isEditable &&
          empty &&
          $from.depth === 1 &&
          $from.parent.type.name === "paragraph" &&
          $from.parent.content.size === 0
        );
      }}
    >
      <PlusMenu
        open={open}
        onToggle={() => setOpenAt(open ? null : pos)}
        onHeading2={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        onHeading3={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        onDivider={() => run(() => editor.chain().focus().setHorizontalRule().run())}
        onArabic={() => run(() => editor.chain().focus().toggleArabicBlock().run())}
        onImage={handleImageClick}
        imageUploading={imageUploading}
      />
    </FloatingMenu>
  );
}
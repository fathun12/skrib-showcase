import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Gives the top-level block that holds the cursor the class "has-focus".
// Focus mode (Editor.tsx) dims every other top-level block with CSS and keeps
// this one bright. Outside focus mode the class does nothing. A list counts
// as one block. Editor only: the reader's renderer does not use it.
export const FocusBlock = Extension.create({
  name: "focusBlock",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("focusBlock"),
        props: {
          decorations(state) {
            const { selection, doc } = state;
            let from: number;
            let to: number;
            if (selection.$from.depth >= 1) {
              from = selection.$from.before(1);
              to = selection.$from.after(1);
            } else if (selection instanceof NodeSelection) {
              // A top-level block that is selected as a whole (an image).
              from = selection.from;
              to = selection.to;
            } else {
              return DecorationSet.empty;
            }
            return DecorationSet.create(doc, [
              Decoration.node(from, to, { class: "has-focus" }),
            ]);
          },
        },
      }),
    ];
  },
});
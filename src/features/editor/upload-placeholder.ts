import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// A grey "Uploading image..." box shown at the cursor while a file uploads.
// It is a decoration (a widget), not part of the document: it is never saved,
// never reaches autosave or the server, and disappears with the editor.
// Editor only: the reader's renderer does not use it.

const key = new PluginKey<DecorationSet>("uploadPlaceholder");

type Meta = { add: { id: string; pos: number } } | { remove: { id: string } };

// Plain DOM on purpose (no React): ProseMirror owns this element.
function createBox(): HTMLElement {
  const box = document.createElement("div");
  box.contentEditable = "false";
  box.setAttribute("role", "status");
  box.className =
    "my-2 flex select-none items-center gap-3 rounded-lg border border-border bg-accent px-4 py-6 text-sm text-muted-foreground";

  const spinner = document.createElement("span");
  spinner.setAttribute("aria-hidden", "true");
  spinner.className =
    "size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent";

  const label = document.createElement("span");
  label.textContent = "Uploading image...";

  box.append(spinner, label);
  return box;
}

export const UploadPlaceholder = Extension.create({
  name: "uploadPlaceholder",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            // Keep every box at the same place while the text changes.
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(key) as Meta | undefined;
            if (meta && "add" in meta) {
              next = next.add(tr.doc, [
                Decoration.widget(meta.add.pos, createBox, {
                  id: meta.add.id,
                  side: -1,
                }),
              ]);
            } else if (meta && "remove" in meta) {
              const id = meta.remove.id;
              next = next.remove(
                next.find(undefined, undefined, (spec) => spec.id === id),
              );
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});

// Puts a box at the cursor. It stays out of the undo history.
export function addUploadPlaceholder(editor: Editor, id: string): void {
  const { state, view } = editor;
  view.dispatch(
    state.tr
      .setMeta(key, { add: { id, pos: state.selection.from } })
      .setMeta("addToHistory", false),
  );
}

// Where the box is now (null when it is gone, for example when the
// paragraph around it was deleted).
export function findUploadPlaceholder(
  state: EditorState,
  id: string,
): number | null {
  const found = key
    .getState(state)
    ?.find(undefined, undefined, (spec) => spec.id === id);
  return found && found.length > 0 ? found[0].from : null;
}

// Safe to call twice or for an id that does not exist.
export function removeUploadPlaceholder(editor: Editor, id: string): void {
  const { state, view } = editor;
  view.dispatch(
    state.tr.setMeta(key, { remove: { id } }).setMeta("addToHistory", false),
  );
}
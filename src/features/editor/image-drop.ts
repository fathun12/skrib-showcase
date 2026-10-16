import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { ALLOWED_TYPES } from "@/features/uploads/client";

// Paste and drop of an image file into the article body. Both end in the same
// flow as the "+" menu (crop dialog, upload, placeholder), through `add`.

export type ImageDropApi = {
  // Starts the crop dialog for this file (the cursor is already in place).
  add: (file: File) => void;
  // A short message near the editor (errors).
  notice: (message: string) => void;
  // The toast of ui/primitives/toast.
  toast: (message: string) => void;
};

// The list of footnotes sits at the end of the document (node "footnotes",
// holding "footnote" nodes). Nothing is inserted there.
const FOOTNOTE_NODES = new Set(["footnotes", "footnote"]);

const isImage = (file: File) => file.type.startsWith("image/");

export function isInsideFootnote(doc: PMNode, pos: number): boolean {
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (FOOTNOTE_NODES.has($pos.node(depth).type.name)) return true;
  }
  return false;
}

// True while the dragged thing carries files (not for a dragged text).
export function hasFiles(event: { dataTransfer: DataTransfer | null }) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

// pos = null: use the cursor as it is (paste).
function handleFiles(
  api: ImageDropApi,
  view: EditorView,
  files: File[],
  pos: number | null,
): void {
  const images = files.filter((file) => ALLOWED_TYPES.includes(file.type));
  const first = images[0];
  if (!first) {
    api.toast("Only JPG, PNG, or WebP images can be added.");
    return;
  }

  const { state } = view;
  const noFootnote = "Images can't be added inside a footnote.";
  if (pos === null) {
    if (isInsideFootnote(state.doc, state.selection.from)) {
      api.toast(noFootnote);
      return;
    }
  } else {
    const selection = TextSelection.near(state.doc.resolve(pos));
    if (isInsideFootnote(state.doc, selection.from)) {
      api.toast(noFootnote);
      return;
    }
    view.dispatch(state.tr.setSelection(selection));
  }

  if (images.length > 1) api.toast("Only one image at a time.");
  api.add(first);
}

// The two ProseMirror props. They return true only when the event was
// handled, so a normal text paste and a normal drop keep working.
export function handleImagePaste(
  api: ImageDropApi,
  view: EditorView,
  event: ClipboardEvent,
): boolean {
  const data = event.clipboardData;
  if (!data || !view.editable) return false;
  const files = Array.from(data.files);
  if (!files.some(isImage)) return false;
  // Copied from a web page or a document: text comes with the picture.
  // That is a normal paste.
  if (data.getData("text/plain").trim() !== "") return false;
  handleFiles(api, view, files, null);
  return true;
}

export function handleImageDrop(
  api: ImageDropApi,
  view: EditorView,
  event: DragEvent,
): boolean {
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length === 0) return false;
  // A dropped file is always swallowed, also when it is ignored:
  // otherwise the browser would open it in this tab.
  if (!view.editable) return true;
  const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
  handleFiles(api, view, files, at ? at.pos : null);
  return true;
}
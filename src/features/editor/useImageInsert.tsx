"use client";

import { useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import type { Editor } from "@tiptap/react";
import { uploadImage } from "@/features/uploads/client";
import {
  addUploadPlaceholder,
  findUploadPlaceholder,
  removeUploadPlaceholder,
} from "./upload-placeholder";

// Loaded only when the writer picks a file, so the editor does not carry it.
const ImageCropDialog = dynamic(
  () => import("@/ui/editor/ImageCropDialog").then((m) => m.ImageCropDialog),
  { ssr: false },
);

// Shapes offered for an image inside the article (the first one is the start).
const IMAGE_RATIOS = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
];

type Options = {
  editor: Editor | null;
  // Shows (or clears, with null) a short message near the editor.
  onNotice: (message: string | null) => void;
};

// The one flow for an article image: file in, crop dialog, upload, grey
// placeholder, image node. Used by the "+" menu; paste and drop will call the
// same flow. Render `element` once, next to the editor.
export function useImageInsert({ editor, onNotice }: Options) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // The file the writer just chose, waiting in the crop dialog.
  const [pending, setPending] = useState<{ file: File; src: string } | null>(
    null,
  );

  function openPicker() {
    // One upload at a time.
    if (uploading) {
      onNotice("Wait for the current image to finish uploading.");
      return;
    }
    // Why: the file input lives outside FloatingMenu, so it is not unmounted
    // when the menu hides while the file picker is open.
    inputRef.current?.click();
  }

  // A file that arrived by paste or drop: same flow as the picker, starting
  // at the crop dialog.
  function addFromFile(file: File) {
    if (uploading) {
      onNotice("Wait for the current image to finish uploading.");
      return;
    }
    startCrop(file);
  }

  // A chosen file goes to the crop dialog first. The writer can crop it or
  // keep the original; only then does the upload below start.
  function startCrop(file: File) {
    const reader = new FileReader();
    reader.onload = () => setPending({ file, src: String(reader.result) });
    reader.onerror = () =>
      onNotice("The image could not be read. Please try another file.");
    reader.readAsDataURL(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    // Why: reset so choosing the same file twice still fires onChange.
    input.value = "";
    if (!file) return;
    startCrop(file);
  }

  async function uploadAndInsert(file: File) {
    if (!editor) return;
    const id = crypto.randomUUID();
    setUploading(true);
    onNotice(null);
    // The grey box appears at the cursor now and marks the place.
    addUploadPlaceholder(editor, id);
    try {
      const result = await uploadImage(file, "post");
      // The writer left the page while the file was uploading.
      if (editor.isDestroyed) return;
      if (!result.ok) {
        onNotice(result.error);
        return;
      }
      // The size is stored so the reader can reserve space before the image
      // loads (no layout shift). If Cloudinary reported no size (0), the
      // attributes are left out and the reader uses its fallback.
      const size =
        result.width > 0 && result.height > 0
          ? { width: result.width, height: result.height }
          : {};
      // alt starts empty; the image node view lets the author edit it.
      const imageNode = {
        type: "image",
        attrs: { src: result.url, alt: "", ...size },
      };

      // The box moved with the text, so this is where the writer asked for
      // the image, even if they clicked or typed elsewhere meanwhile.
      const pos = findUploadPlaceholder(editor.state, id);
      let placed = false;
      if (pos !== null) {
        const $pos = editor.state.doc.resolve(pos);
        // Only a top-level paragraph (or heading) can be replaced or
        // followed by an image without breaking the schema.
        if ($pos.depth === 1) {
          const { from, to } = editor.state.selection;
          const cursorHere = from >= $pos.start() && to <= $pos.end();
          const empty =
            $pos.parent.type.name === "paragraph" &&
            $pos.parent.content.size === 0;
          placed = editor.commands.insertContentAt(
            empty ? { from: $pos.before(), to: $pos.after() } : $pos.after(),
            imageNode,
            // Move the cursor only when the writer waited in that paragraph.
            { updateSelection: cursorHere },
          );
        }
      }
      // The place is gone (for example the paragraph was deleted): insert at
      // the cursor, as before.
      if (!placed) {
        editor.chain().focus().insertContent(imageNode).run();
      }
    } finally {
      // On success, on an error and on a crash: no box stays behind.
      if (!editor.isDestroyed) removeUploadPlaceholder(editor, id);
      setUploading(false);
    }
  }

  const element = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      {pending && (
        <ImageCropDialog
          file={pending.file}
          src={pending.src}
          ratios={IMAGE_RATIOS}
          title="Crop image"
          allowOriginal
          onCancel={() => setPending(null)}
          onConfirm={(chosen) => {
            setPending(null);
            void uploadAndInsert(chosen);
          }}
        />
      )}
    </>
  );

  return { uploading, openPicker, addFromFile, element };
}
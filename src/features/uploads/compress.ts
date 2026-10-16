// Shrinks an image in the browser before it goes to Cloudinary. What counts
// against the storage quota is the stored original, so it must be small.

export type CompressKind = "post" | "cover" | "avatar" | "note";

// The longest side, in pixels.
const MAX_SIDE: Record<CompressKind, number> = {
  post: 1920,
  cover: 1920,
  avatar: 512,
  note: 1600,
};

const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;
// A WebP that is already within the size limit and under this is kept as is
// (it was probably just made by the crop dialog).
const KEEP_AS_IS_BYTES = 600 * 1024;

function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be decoded."));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

// Never throws: when anything goes wrong the original file is returned and
// the upload carries on as before.
export async function compressImage(
  file: File,
  kind: CompressKind,
): Promise<File> {
  try {
    const image = await loadImage(file);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (sourceWidth < 1 || sourceHeight < 1) return file;

    const scale = Math.min(
      1,
      MAX_SIDE[kind] / Math.max(sourceWidth, sourceHeight),
    );
    if (
      scale === 1 &&
      file.type === "image/webp" &&
      file.size <= KEEP_AS_IS_BYTES
    ) {
      return file;
    }

    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;

    // White behind transparent PNGs (JPEG has no transparency).
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
    // Some browsers cannot write WebP and quietly return PNG: use JPEG then.
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
    }
    if (!blob) return file;
    // Nothing was resized and the result is not smaller: keep the original.
    if (scale === 1 && blob.size >= file.size) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}
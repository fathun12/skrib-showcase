// Pure helper (no React). The one list of image display sizes, shared by the
// save schema, the editor and the reader.
export const IMAGE_ALIGNS = ["small", "normal", "wide"] as const;

export type ImageAlign = (typeof IMAGE_ALIGNS)[number];

// Turns any stored value into a valid size. Unknown or missing values (older
// posts, bad data) become "normal".
export function toImageAlign(value: unknown): ImageAlign {
  return IMAGE_ALIGNS.find((align) => align === value) ?? "normal";
}
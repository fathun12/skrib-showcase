// The only colors a post may use. Names, not hex codes: the server accepts
// nothing else, and the real shades (light and dark) live in globals.css.
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export const TEXT_COLORS = ["red", "orange", "green", "blue", "purple"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type TextColor = (typeof TEXT_COLORS)[number];

// Preview colors for the small color dots only (selection toolbar and the
// highlight panel); the real shades (with dark mode) are the --hl-* tokens in
// globals.css, the same ones the editor uses.
export const HIGHLIGHT_SWATCH: Record<HighlightColor, string> = {
  yellow: "#FACC15",
  green: "#4ADE80",
  blue: "#60A5FA",
  pink: "#F472B6",
};

export function isHighlightColor(value: unknown): value is HighlightColor {
  return (
    typeof value === "string" &&
    (HIGHLIGHT_COLORS as readonly string[]).includes(value)
  );
}

export function isTextColor(value: unknown): value is TextColor {
  return (
    typeof value === "string" &&
    (TEXT_COLORS as readonly string[]).includes(value)
  );
}
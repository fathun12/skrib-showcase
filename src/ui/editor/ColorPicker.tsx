import { Eraser, Highlighter, Type, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  type HighlightColor,
  type TextColor,
} from "./colors";

// Preview colors for the swatches only; the real shades (with dark mode)
// are the tokens in globals.css.
const HIGHLIGHT_PREVIEW: Record<HighlightColor, string> = {
  yellow: "#FACC15",
  green: "#4ADE80",
  blue: "#60A5FA",
  pink: "#F472B6",
};
const TEXT_PREVIEW: Record<TextColor, string> = {
  red: "#DC2626",
  orange: "#EA580C",
  green: "#16A34A",
  blue: "#2563EB",
  purple: "#9333EA",
};

export type ColorPickerProps = {
  activeHighlight: string | null;
  activeTextColor: string | null;
  onHighlight: (color: HighlightColor | null) => void;
  onTextColor: (color: TextColor | null) => void;
  onClose: () => void;
};

const swatchClass =
  "size-6 rounded-full border border-background/50 focus-visible:outline-2 focus-visible:outline-ring";
const iconButtonClass =
  "inline-flex size-7 items-center justify-center rounded-md hover:bg-background/20 focus-visible:outline-2 focus-visible:outline-ring";

export function ColorPicker({
  activeHighlight,
  activeTextColor,
  onHighlight,
  onTextColor,
  onClose,
}: ColorPickerProps) {
  return (
    <div className="flex items-start gap-2 p-1">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Type className="size-4" aria-hidden="true" />
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Text color ${color}`}
              aria-pressed={activeTextColor === color}
              onClick={() => onTextColor(color)}
              className={cn(
                swatchClass,
                activeTextColor === color &&
                  "ring-2 ring-background ring-offset-1 ring-offset-foreground",
              )}
              style={{ backgroundColor: TEXT_PREVIEW[color] }}
            />
          ))}
          <button
            type="button"
            aria-label="Remove text color"
            onClick={() => onTextColor(null)}
            className={iconButtonClass}
          >
            <Eraser className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <Highlighter className="size-4" aria-hidden="true" />
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Highlight ${color}`}
              aria-pressed={activeHighlight === color}
              onClick={() => onHighlight(color)}
              className={cn(
                swatchClass,
                activeHighlight === color &&
                  "ring-2 ring-background ring-offset-1 ring-offset-foreground",
              )}
              style={{ backgroundColor: HIGHLIGHT_PREVIEW[color] }}
            />
          ))}
          <button
            type="button"
            aria-label="Remove highlight"
            onClick={() => onHighlight(null)}
            className={iconButtonClass}
          >
            <Eraser className="size-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close colors"
        onClick={onClose}
        className={iconButtonClass}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
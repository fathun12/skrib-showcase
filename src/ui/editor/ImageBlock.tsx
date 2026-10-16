import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageAlign } from "@/ui/image-align";
import { Tooltip } from "@/ui/primitives/tooltip";

// Must match the 300-character limit for alt and caption in
// features/posts/schemas.ts, otherwise autosave would reject the document.
export const IMAGE_TEXT_MAX = 300;

export type ImageBlockProps = {
  src: string;
  alt: string;
  caption: string;
  align: ImageAlign;
  // True when the image is the current node selection (clicked).
  selected: boolean;
  onAltChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onAlignChange: (value: ImageAlign) => void;
  onRemove: () => void;
};

type AlignButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function AlignButton({ label, active, onClick }: AlignButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 font-sans text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function ImageBlock({
  src,
  alt,
  caption,
  align,
  selected,
  onAltChange,
  onCaptionChange,
  onAlignChange,
  onRemove,
}: ImageBlockProps) {
  return (
    // data-align is also set by the reader, so one CSS rule in
    // .prose-article handles the "wide" breakout for both.
    <div data-align={align} className="group relative">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn("block w-full", selected && "ring-2 ring-primary")}
        />
        <div
          className={cn(
            "absolute inset-x-2 top-2 flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 p-2 font-sans shadow-sm",
            // Stays visible while an input inside it has focus.
            selected ? "flex" : "hidden group-focus-within:flex",
          )}
        >
          <div className="flex items-center gap-1">
            <AlignButton
              label="Small"
              active={align === "small"}
              onClick={() => onAlignChange("small")}
            />
            <AlignButton
              label="Normal"
              active={align === "normal"}
              onClick={() => onAlignChange("normal")}
            />
            <AlignButton
              label="Wide"
              active={align === "wide"}
              onClick={() => onAlignChange("wide")}
            />
          </div>
          <input
            type="text"
            aria-label="Alt text"
            placeholder="Alt text (describe the image)"
            defaultValue={alt}
            maxLength={IMAGE_TEXT_MAX}
            onChange={(event) => onAltChange(event.target.value)}
            className="min-w-40 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Tooltip label="Remove image">
          <button
            type="button"
            aria-label="Remove image"
            onClick={onRemove}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 className="size-4" />
          </button>
          </Tooltip>
        </div>
      </div>
      <input
        type="text"
        aria-label="Image caption"
        placeholder="Add a caption (optional)"
        defaultValue={caption}
        maxLength={IMAGE_TEXT_MAX}
        onChange={(event) => onCaptionChange(event.target.value)}
        className="mt-3 w-full bg-transparent text-center font-sans text-[13px] text-muted-foreground outline-none placeholder:text-muted-foreground/60 md:text-sm"
      />
    </div>
  );
}
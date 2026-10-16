import { useRef, type ReactNode } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { fieldClass } from "@/ui/primitives/field";

export type NoteDraftImage = {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
};

export type NoteImagePickerProps = {
  images: NoteDraftImage[];
  max: number;
  altMax: number;
  uploading: boolean;
  disabled?: boolean;
  error?: string | null;
  onPick: (files: File[]) => void;
  onRemove: (id: string) => void;
  onAltChange: (id: string, alt: string) => void;
  // Shown right after the add button (who can reply).
  actions?: ReactNode;
  // Shown at the right end of the row (counter, Post).
  trailing?: ReactNode;
};

export function NoteImagePicker({
  images,
  max,
  altMax,
  uploading,
  disabled = false,
  error,
  onPick,
  onRemove,
  onAltChange,
  actions,
  trailing,
}: NoteImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = images.length >= max;

  return (
    <div className="grid gap-2">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="grid gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cloudinaryImageUrl(image.url, {
                    width: 240,
                    height: 240,
                    crop: "fill",
                  })}
                  alt={image.alt}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove image ${index + 1}`}
                  disabled={disabled}
                  onClick={() => onRemove(image.id)}
                  className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 motion-reduce:transition-none"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <input
                type="text"
                aria-label={`Description of image ${index + 1} (optional)`}
                placeholder="Describe (optional)"
                value={image.alt}
                maxLength={altMax}
                disabled={disabled}
                onChange={(event) => onAltChange(image.id, event.target.value)}
                className={cn(fieldClass, "py-1 text-xs")}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Lets the same file be chosen again after it was removed.
            event.target.value = "";
            if (files.length > 0) onPick(files);
          }}
        />
        <button
          type="button"
          aria-label="Add images"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading || full}
          className="inline-flex size-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 motion-reduce:transition-none"
        >
          <ImagePlus className="size-5" aria-hidden="true" />
        </button>
        {uploading ? (
          <span className="text-xs text-muted-foreground">Uploading...</span>
        ) : null}
        {images.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {images.length}/{max}
          </span>
        ) : null}
        {actions}
        <div className="ml-auto flex items-center gap-3">{trailing}</div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
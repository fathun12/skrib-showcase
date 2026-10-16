"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { Button, buttonVariants } from "@/ui/primitives/button";
import { labelClass } from "@/ui/primitives/field";
// Loaded only when the writer picks a file, so no page pays for the cropper.
const ImageCropDialog = dynamic(
  () => import("./ImageCropDialog").then((m) => m.ImageCropDialog),
  { ssr: false },
);

// A cover is always shown 2:1, so the box keeps that shape (it can still be
// moved and resized freely).
const COVER_RATIOS = [{ label: "2:1", value: 2 }];

export type CoverFieldProps = {
  coverUrl?: string | null;
  uploading?: boolean;
  error?: string | null;
  // Extra reason to lock the field (for example a save is running).
  disabled?: boolean;
  // The upload itself happens in the parent.
  onSelect: (file: File) => void;
  onRemove: () => void;
};

type FileInputProps = {
  disabled: boolean;
  onSelect: (file: File) => void;
};

// Visually hidden file input, always placed inside a <label> that acts as the
// button, so no ref or click() call is needed.
function CoverFileInput({ disabled, onSelect }: FileInputProps) {
  return (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      disabled={disabled}
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        // Why: reset so choosing the same file twice still fires onChange.
        event.target.value = "";
        if (file) onSelect(file);
      }}
    />
  );
}

// The cover picker shared by the Publish dialog, the Details dialog and the
// series form: an "add" box, or a 2:1 preview with Replace and Remove.
export function CoverField({
  coverUrl,
  uploading = false,
  error,
  disabled = false,
  onSelect,
  onRemove,
}: CoverFieldProps) {
  const busy = disabled || uploading;
  // The file the writer just chose, waiting in the crop dialog.
  const [pending, setPending] = useState<{ file: File; src: string } | null>(
    null,
  );
  const [readError, setReadError] = useState<string | null>(null);
  const shownError = error ?? readError;

  // A chosen file goes to the crop dialog first; only the cropped result is
  // handed to the parent, which uploads it as before.
  function handleFile(file: File) {
    setReadError(null);
    const reader = new FileReader();
    reader.onload = () => setPending({ file, src: String(reader.result) });
    reader.onerror = () =>
      setReadError("The image could not be read. Please try another file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={labelClass}>
          Cover image{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <span className="text-xs text-muted-foreground">Shown at 2:1</span>
      </div>
      {coverUrl ? (
        <>
          <div className="aspect-2/1 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60 ring-inset">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryImageUrl(coverUrl, {
                width: 800,
                height: 400,
                crop: "fill",
              })}
              alt="Cover preview"
              className="size-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer rounded-full px-3 has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <CoverFileInput disabled={busy} onSelect={handleFile} />
              {uploading ? "Uploading..." : "Replace"}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full px-3"
              disabled={busy}
              onClick={onRemove}
            >
              Remove
            </Button>
          </div>
        </>
      ) : (
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-3 text-sm ring-1 ring-border/60 transition-colors ring-inset hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-primary/50",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <CoverFileInput disabled={busy} onSelect={handleFile} />
          <ImagePlus
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block font-medium text-foreground/80">
              {uploading ? "Uploading..." : "Add a cover image"}
            </span>
            {!uploading && (
              <span className="block text-xs text-muted-foreground">
                JPG, PNG or WebP, up to 20 MB
              </span>
            )}
          </span>
        </label>
      )}
      {shownError && (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      )}
      {pending && (
        <ImageCropDialog
          file={pending.file}
          src={pending.src}
          ratios={COVER_RATIOS}
          title="Crop cover"
          onCancel={() => setPending(null)}
          onConfirm={(cropped) => {
            setPending(null);
            onSelect(cropped);
          }}
        />
      )}
    </div>
  );
}
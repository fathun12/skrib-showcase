"use client";

import { useRef, useState, type SyntheticEvent } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

// The longest side of the saved image, in pixels.
const MAX_OUTPUT_SIDE = 1920;
// Hardly different from 0.9 to the eye, but about 30% smaller.
const OUTPUT_QUALITY = 0.82;

// value = width divided by height (2 means 2:1); undefined means free.
export type CropRatio = { label: string; value: number | undefined };

type Props = {
  file: File;
  // The chosen file as a data URL (read by the parent).
  src: string;
  // One ratio = locked (no chips). Several = chips under the image.
  ratios: CropRatio[];
  title?: string;
  // Adds a "Use original" button that skips the crop.
  allowOriginal?: boolean;
  // A round box (for avatars). The saved image is still a square.
  circular?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

function startingCrop(
  aspect: number | undefined,
  width: number,
  height: number,
): PercentCrop {
  if (!aspect) return { unit: "%", x: 5, y: 5, width: 90, height: 90 };
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
    width,
    height,
  ) as PercentCrop;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

// Cuts the chosen region out of the image in the browser and returns it as a
// new, smaller file (WebP, at most 1920 px wide, same shape as the box).
async function cropToFile(
  src: string,
  region: PercentCrop,
  originalName: string,
): Promise<File | null> {
  const image = await loadImage(src);
  const sx = (region.x / 100) * image.naturalWidth;
  const sy = (region.y / 100) * image.naturalHeight;
  const sw = (region.width / 100) * image.naturalWidth;
  const sh = (region.height / 100) * image.naturalHeight;
  if (sw < 1 || sh < 1) return null;

  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // White behind transparent PNGs (JPEG has no transparency).
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/webp", OUTPUT_QUALITY);
  // Some browsers cannot write WebP and quietly return PNG: use JPEG then.
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
  }
  if (!blob) return null;

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${extension}`, { type: blob.type });
}

const ICON_BOX = 14;

// A tiny outline of the ratio's shape (dashed square for "Free").
function RatioIcon({ value }: { value: number | undefined }) {
  const free = value === undefined;
  const width = free || value >= 1 ? ICON_BOX : Math.round(ICON_BOX * value);
  const height = free || value < 1 ? ICON_BOX : Math.round(ICON_BOX / value);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block shrink-0 rounded-[3px] border-[1.5px] border-current",
        free && "border-dashed",
      )}
      style={{ width, height }}
    />
  );
}

export function ImageCropDialog({
  file,
  src,
  ratios,
  title = "Crop image",
  allowOriginal = false,
  circular = false,
  onCancel,
  onConfirm,
}: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [ratioIndex, setRatioIndex] = useState(0);
  const [crop, setCrop] = useState<Crop>();
  // The last finished crop (in percent of the image), what "Use crop" cuts.
  const [region, setRegion] = useState<PercentCrop | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspect = ratios[ratioIndex]?.value;

  function applyCrop(next: PercentCrop) {
    setCrop(next);
    setRegion(next);
  }

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = event.currentTarget;
    applyCrop(startingCrop(aspect, width, height));
  }

  function handleRatio(index: number) {
    setRatioIndex(index);
    const image = imageRef.current;
    if (!image) return;
    applyCrop(startingCrop(ratios[index]?.value, image.width, image.height));
  }

  async function handleConfirm() {
    if (!region) return;
    setError(null);
    setWorking(true);
    try {
      const cropped = await cropToFile(src, region, file.name);
      if (cropped) onConfirm(cropped);
      else setError("The image could not be cropped. Please try again.");
    } catch {
      setError("The image could not be cropped. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Escape or a click outside closes it, but never mid-crop.
        if (!next && !working) onCancel();
      }}
    >
      {/* Below sm the dialog sits at the bottom like a sheet. */}
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] gap-4 overflow-y-auto rounded-2xl p-5 shadow-2xl ring-0 sm:max-w-xl max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Drag the box to move it. Pull a corner to resize it.
          </DialogDescription>
        </DialogHeader>

        <div className="skrib-crop flex justify-center rounded-xl bg-foreground/5 p-3">
          <ReactCrop
            crop={crop}
            onChange={(_, percent) => setCrop(percent)}
            onComplete={(_, percent) => setRegion(percent)}
            aspect={aspect}
            minWidth={40}
            keepSelection
            ruleOfThirds
            circularCrop={circular}
            disabled={working}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={src}
              alt="The image to crop"
              onLoad={handleImageLoad}
              className="block max-h-[45dvh] max-w-full rounded-md"
            />
          </ReactCrop>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Drag to move. Pull a corner to resize.
        </p>

        {ratios.length > 1 && (
          <div
            role="group"
            aria-label="Shape"
            className="mx-auto flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
          >
            {ratios.map((ratio, index) => (
              <button
                key={ratio.label}
                type="button"
                disabled={working}
                aria-pressed={index === ratioIndex}
                onClick={() => handleRatio(index)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
                  index === ratioIndex
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <RatioIcon value={ratio.value} />
                {ratio.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {allowOriginal && (
              <Button
                type="button"
                variant="ghost"
                disabled={working}
                onClick={() => onConfirm(file)}
              >
                Use original
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={working}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full px-5"
              disabled={working || !region}
              onClick={handleConfirm}
            >
              {working ? "Cropping..." : "Use crop"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
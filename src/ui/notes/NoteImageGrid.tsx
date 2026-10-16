import { cn } from "@/lib/utils";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";

export type NoteImageData = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

type Props = {
  images: NoteImageData[];
  // Without a handler the images are plain pictures (not buttons).
  onOpen?: (index: number) => void;
};

// One image keeps its OWN shape (width / height of the file), shown at most
// 320 wide and 380 tall, at the left like the text above it. Only an extreme
// shape is cropped (ratio kept between 1:2 and 2.4:1). Two to four share a
// 16:9 frame: two side by side, three as one tall and two small, four as a 2x2.
const SINGLE_MAX_WIDTH = 320;
const SINGLE_MAX_HEIGHT = 380;
// Two to four images share ONE frame as wide as the single image's maximum,
// so a note with one image and a note with several look like the same family.
const MULTI_STYLE = {
  aspectRatio: 4 / 3,
  width: SINGLE_MAX_WIDTH,
  maxWidth: "100%",
};

function singleStyle(image: NoteImageData) {
  const known = image.width > 0 && image.height > 0;
  const ratio = known
    ? Math.min(2.4, Math.max(0.5, image.width / image.height))
    : 1.5;
  let width = SINGLE_MAX_WIDTH;
  if (width / ratio > SINGLE_MAX_HEIGHT) width = SINGLE_MAX_HEIGHT * ratio;
  return { aspectRatio: ratio, width: Math.round(width), maxWidth: "100%" };
}

export function NoteImageGrid({ images, onOpen }: Props) {
  if (images.length === 0) return null;
  const single = images.length === 1;

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-xl border border-border/70",
        !single && "grid grid-cols-2 gap-0.5",
        images.length === 2 && "grid-rows-1",
        images.length >= 3 && "grid-rows-2",
      )}
      style={single ? singleStyle(images[0]) : MULTI_STYLE}
    >
      {images.map((image, index) => {
        const label = image.alt || `Image ${index + 1} of ${images.length}`;
        const cellClass = cn(
          "relative block size-full overflow-hidden bg-muted",
          images.length === 3 && index === 0 && "row-span-2",
        );
        const picture = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryImageUrl(image.url, { width: single ? 1000 : 640 })}
            alt={onOpen ? "" : image.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        );

        if (!onOpen) {
          return (
            <div key={`${image.url}-${index}`} className={cellClass}>
              {picture}
            </div>
          );
        }
        return (
          <button
            key={`${image.url}-${index}`}
            type="button"
            aria-label={`View image: ${label}`}
            onClick={() => onOpen(index)}
            className={cn(
              cellClass,
              "cursor-zoom-in transition-opacity hover:opacity-90 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
            )}
          >
            {picture}
          </button>
        );
      })}
    </div>
  );
}
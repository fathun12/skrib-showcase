import Image from "next/image";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import type { ImageAlign } from "@/ui/image-align";

export type ArticleImageProps = {
  src: string;
  alt: string;
  caption?: string;
  align: ImageAlign;
  // Intrinsic size of the uploaded image. With both, the browser reserves the
  // right amount of space before the file loads (no layout shift).
  width?: number;
  height?: number;
};

// Wide images are shown up to 960px, so 1920 covers 2x screens.
const DELIVERY_WIDTH = 1920;

// What the browser should expect for each size, so it picks a good file.
const SIZES: Record<ImageAlign, string> = {
  small: "(min-width: 768px) 480px, 100vw",
  normal: "(min-width: 768px) 720px, 100vw",
  wide: "(min-width: 1024px) 960px, 100vw",
};

export function ArticleImage({
  src,
  alt,
  caption,
  align,
  width,
  height,
}: ArticleImageProps) {
  const url = cloudinaryImageUrl(src, { width: DELIVERY_WIDTH });
  const sizes = SIZES[align];

  return (
    // data-align is the same hook the editor uses, so the one CSS rule in
    // .prose-article handles the "wide" breakout in both places.
    // data-lightbox-src is read by features/lightbox to show the big file.
    <figure data-align={align} data-lightbox-src={url}>
      {width && height ? (
        <Image
          src={url}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className="block h-auto w-full cursor-zoom-in"
        />
      ) : (
        // Older images without a stored size: no way to reserve space.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full cursor-zoom-in"
        />
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
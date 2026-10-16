import Image from "next/image";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";
import { cn } from "@/lib/utils";

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  xs: "size-5 text-[10px]",
  sm: "size-6 text-xs",
  md: "size-10 text-sm",
  lg: "size-20 text-2xl",
};

// Display size in CSS pixels, used for `sizes` and for asking Cloudinary for a
// sharp (2x) square crop.
const pixels = { xs: 20, sm: 24, md: 40, lg: 80 };

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const px = pixels[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-medium",
        sizes[size],
        className,
      )}
    >
      {src ? (
        <Image
          // Cloudinary avatars get a square face crop; other URLs (Google)
          // come back unchanged from the helper.
          src={cloudinaryImageUrl(src, {
            width: px * 2,
            height: px * 2,
            crop: "fill",
            gravity: "face",
          })}
          alt=""
          fill
          sizes={`${px}px`}
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
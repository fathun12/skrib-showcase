import Image from "next/image";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";

type Props = {
  src: string;
};

// The cover above the article title: always 2:1 (Cloudinary crops it), as wide
// as a "wide" image on large screens. The title is right below, so alt is empty.
export function ArticleCover({ src }: Props) {
  return (
    <div className="relative mb-8 aspect-2/1 overflow-hidden rounded-xl bg-muted lg:-mx-30">
      <Image
        src={cloudinaryImageUrl(src, { width: 1920, height: 960, crop: "fill" })}
        alt=""
        fill
        sizes="(min-width: 1024px) 896px, 100vw"
        className="object-cover"
      />
    </div>
  );
}
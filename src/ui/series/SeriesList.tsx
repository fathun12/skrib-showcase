import Image from "next/image";
import Link from "next/link";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";

export type SeriesListEntry = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  postCount: number;
};

// Works for any script: Array.from keeps a whole character together.
function firstLetter(title: string) {
  return Array.from(title.trim())[0]?.toUpperCase() ?? "S";
}

// A flat list like the Stories tab: one row per series, text on the left,
// a small cover on the right, thin lines between rows, no boxes.
export function SeriesList({
  items,
  username,
}: {
  items: SeriesListEntry[];
  username: string;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item, index) => (
        <li key={item.id}>
          <Link
            href={`/${username}/series/${item.slug}`}
            className="group flex items-start gap-4 py-6 sm:gap-6"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-xl font-bold leading-snug tracking-tight text-balance group-hover:text-primary">
                {item.title}
              </h3>
              {item.description ? (
                <p className="mt-1 line-clamp-2 font-serif text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">
                {item.postCount} {item.postCount === 1 ? "story" : "stories"}
              </p>
            </div>
            <div className="relative aspect-2/1 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-40">
              {item.coverUrl ? (
                <Image
                  src={cloudinaryImageUrl(item.coverUrl, {
                    width: 320,
                    height: 160,
                    crop: "fill",
                  })}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 160px, 112px"
                  loading={index === 0 ? "eager" : undefined}
                  className="object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-full items-center justify-center font-serif text-3xl font-bold text-muted-foreground"
                >
                  {firstLetter(item.title)}
                </div>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
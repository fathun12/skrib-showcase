import Image from "next/image";
import Link from "next/link";
import { cloudinaryImageUrl } from "@/ui/cloudinary-image";

export type OwnSeriesCard = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  postCount: number;
  manageHref: string;
  viewHref: string;
};

type Props = { items: OwnSeriesCard[] };

// Works for any script: Array.from keeps a whole character together.
function firstLetter(title: string) {
  return Array.from(title.trim())[0]?.toUpperCase() ?? "S";
}

// Same flat look as the public series list: text on the left, a small cover
// on the right, thin lines between rows. The whole row opens the manage page.
export function OwnSeriesGrid({ items }: Props) {
  return (
    <ul className="mt-2 divide-y divide-border">
      {items.map((item) => (
        <li
          key={item.id}
          className="group relative flex items-start gap-4 py-6 sm:gap-6"
        >
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl leading-snug font-bold tracking-tight text-balance group-hover:text-primary">
              {/* The pseudo-element stretches this link over the whole row. */}
              <Link
                href={item.manageHref}
                className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
              >
                {item.title}
              </Link>
            </h3>
            {item.description ? (
              <p className="mt-1 line-clamp-2 font-serif text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {item.postCount} {item.postCount === 1 ? "story" : "stories"}
              </span>
              <Link
                href={item.viewHref}
                className="relative z-10 hover:text-foreground hover:underline"
              >
                View
              </Link>
            </div>
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
        </li>
      ))}
    </ul>
  );
}
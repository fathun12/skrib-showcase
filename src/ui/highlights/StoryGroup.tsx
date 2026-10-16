import Link from "next/link";
import type { ReactNode } from "react";

export type StoryGroupProps = {
  title: string;
  // Link to the story; null when the story is not available.
  href: string | null;
  // Muted line under the title, like "Author name · 12 Oct 2026 · 2 highlights".
  meta: string;
  // The HighlightRow items of this story.
  children: ReactNode;
};

// One story in the "By story" view: a calm serif title, a muted line, then its
// highlights. Stories are separated by space, not by lines.
export function StoryGroup({ title, href, meta, children }: StoryGroupProps) {
  return (
    <section className="py-7 first:pt-0">
      <h2 className="font-serif text-xl font-semibold tracking-tight">
        {href ? (
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
      <ul className="mt-4 space-y-5">{children}</ul>
    </section>
  );
}
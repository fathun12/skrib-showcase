import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/ui/primitives/Avatar";
import { ProfileLink } from "@/ui/profile/ProfileLink";
import { tagLabel } from "@/ui/tags";

export type SidebarAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  // The Follow button; a client component filled by the page.
  action: ReactNode;
};

export type HomeSidebarProps = {
  topics: { tag: string; count: number }[];
  authors: SidebarAuthor[];
};

// The look of a topic link (same as TagList on the article page).
const CHIP_CLASS =
  "inline-block rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

// A column to the right of the feed, only on very wide screens. It sits
// outside the 720px column (absolute, relative to the page wrapper), so the
// feed does not move. The page wrapper must be `relative`.
export function HomeSidebar({ topics, authors }: HomeSidebarProps) {
  if (topics.length === 0 && authors.length === 0) return null;

  return (
    <div className="absolute inset-y-0 left-full ml-8 hidden w-64 pt-10 min-[1340px]:block">
      <aside aria-label="Discover" className="sticky top-20 flex flex-col gap-8">
        {authors.length > 0 ? (
          <section aria-labelledby="sidebar-authors">
            <h2 id="sidebar-authors" className="text-sm font-semibold">
              Authors to follow
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {authors.map((author) => (
                <li key={author.id} className="flex items-center gap-3">
                  <ProfileLink
                    username={author.username}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar
                      name={author.displayName}
                      src={author.avatarUrl}
                      size="sm"
                    />
                    <span className="truncate text-sm font-medium group-hover:underline">
                      {author.displayName}
                    </span>
                  </ProfileLink>
                  {author.action}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {topics.length > 0 ? (
          <section aria-labelledby="sidebar-topics">
            <h2 id="sidebar-topics" className="text-sm font-semibold">
              Popular topics
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {topics.map((item) => (
                <li key={item.tag}>
                  <Link href={`/tag/${item.tag}`} className={CHIP_CLASS}>
                    {tagLabel(item.tag)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
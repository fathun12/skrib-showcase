import Link from "next/link";

export type StoryStatsItem = {
  id: string;
  title: string;
  // Link to the story, or null.
  href: string | null;
  // Already formatted by the page, for example "Oct 13, 2026".
  dateLabel: string;
  views: number;
  reads: number;
  likes: number;
  comments: number;
  saves: number;
};

export type StoryStatsListProps = { stories: StoryStatsItem[] };

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

// A flat list of the author's stories with their numbers for the chosen
// period. Order and sorting are decided by the page. On phones the numbers
// wrap under the title.
export function StoryStatsList({ stories }: StoryStatsListProps) {
  if (stories.length === 0) return null;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {stories.map((story) => (
        <li
          key={story.id}
          className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:gap-6"
        >
          <div className="min-w-0 sm:flex-1">
            {story.href ? (
              <Link
                href={story.href}
                className="line-clamp-2 rounded-sm font-serif text-lg leading-snug font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                {story.title || "Untitled"}
              </Link>
            ) : (
              <p className="line-clamp-2 font-serif text-lg leading-snug font-semibold">
                {story.title || "Untitled"}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {story.dateLabel}
            </p>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums sm:max-w-[50%] sm:justify-end">
            <span className="text-foreground">
              {count(story.views, "view", "views")}
            </span>
            <span className="text-foreground">
              {count(story.reads, "read", "reads")}
            </span>
            <span>{count(story.likes, "like", "likes")}</span>
            <span>{count(story.comments, "comment", "comments")}</span>
            <span>{count(story.saves, "save", "saves")}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
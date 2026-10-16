import Link from "next/link";
import { tagLabel } from "@/ui/tags";

type Props = {
  tags: string[];
};

// The topics of an article, as small links to their pages. Shown at the end
// of the article body; nothing is drawn when the post has no topics.
export function TagList({ tags }: Props) {
  if (tags.length === 0) return null;

  return (
    <ul aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/tag/${tag}`}
            className="inline-block rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {tagLabel(tag)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
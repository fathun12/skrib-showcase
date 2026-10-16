import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/features/auth/queries";
import { NotePagedList } from "@/features/notes/NotePagedList";
import {
  getTaggedNoteCount,
  listPopularTaggedNotes,
  listTaggedNotes,
} from "@/features/notes/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/ui/primitives/button";
import { isValidTag } from "@/ui/tags";

// In Next.js 16, `params` and `searchParams` are Promises and must be awaited.
type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
};

// Like /search: not indexed at first.
export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { tag } = await params;
  if (!isValidTag(tag)) return { title: "Hashtag not found" };
  return { title: `#${tag} in Notes`, robots: { index: false } };
}

export default async function NoteTagPage({ params, searchParams }: Props) {
  const { tag } = await params;
  if (!isValidTag(tag)) notFound();

  const { sort } = await searchParams;
  const popular = sort === "popular";

  const current = await getCurrentUser();
  const viewerId = current?.id ?? null;

  const [notes, total] = await Promise.all([
    popular
      ? listPopularTaggedNotes(tag, viewerId)
      : listTaggedNotes(tag, viewerId),
    getTaggedNoteCount(tag, viewerId),
  ]);

  const basePath = `/notes/tag/${tag}`;
  const chips = [
    { key: "latest", label: "Latest", href: basePath },
    { key: "popular", label: "Popular", href: `${basePath}?sort=popular` },
  ];

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Hashtag</p>
        <h1 className="font-serif text-3xl font-bold tracking-tight">#{tag}</h1>
        {total !== null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? "note" : "notes"}
          </p>
        ) : null}
        <Link
          href={`/tag/${tag}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-3 gap-1.5 rounded-full",
          )}
        >
          Stories about this topic
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </header>

      <nav aria-label="Hashtag lists" className="mb-2 flex gap-2">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            aria-current={(chip.key === "popular") === popular ? "page" : undefined}
            className={cn(
              "inline-block rounded-full border px-3 py-1 text-sm transition-colors",
              (chip.key === "popular") === popular
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </nav>

      {notes === null ? (
        <p role="alert" className="py-12 text-center text-destructive">
          Could not load the notes.
        </p>
      ) : notes.items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {popular
            ? "Nothing popular with this hashtag in the last 30 days."
            : "No notes with this hashtag yet."}
        </p>
      ) : (
        <NotePagedList
          // A new key starts the list fresh when the chip changes.
          key={popular ? "popular" : "latest"}
          initialNotes={notes.items}
          initialCursor={notes.nextCursor}
          feed={popular ? { kind: "popular" } : { kind: "tag", tag }}
          currentUserId={current?.id ?? null}
          returnPath={popular ? `${basePath}?sort=popular` : basePath}
        />
      )}
    </div>
  );
}
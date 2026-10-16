import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { Avatar } from "@/ui/primitives/Avatar";

// The note a quote note quotes. Same shape as NoteQuote in
// features/notes/queries.ts (ui never imports features).
export type NoteQuoteData =
  | {
      state: "available";
      id: string;
      body: string;
      createdAt: string;
      author: {
        username: string;
        displayName: string;
        avatarUrl: string | null;
      };
    }
  | { state: "deleted" }
  | { state: "unavailable" };

const boxClass =
  "mt-3 block rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3";

type Props = {
  quote: NoteQuoteData;
  // false = a plain box (the preview inside the quote dialog).
  interactive?: boolean;
};

// One level only: the quoted note's own quote is never shown. The text is
// plain (no links inside), so the whole box can be one link.
export function NoteQuoteEmbed({ quote, interactive = true }: Props) {
  if (quote.state !== "available") {
    return (
      <div className={cn(boxClass, "text-sm text-muted-foreground")}>
        {quote.state === "deleted"
          ? "This note was deleted."
          : "This note is not available."}
      </div>
    );
  }

  const content = (
    <>
      <span className="flex items-center gap-2 text-sm">
        <Avatar
          name={quote.author.displayName}
          src={quote.author.avatarUrl}
          size="sm"
        />
        <span className="truncate font-medium">
          {quote.author.displayName}
        </span>
        <span className="truncate text-muted-foreground">
          @{quote.author.username} · {formatDate(quote.createdAt)}
        </span>
      </span>
      <span className="mt-2 line-clamp-6 block text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
        {quote.body}
      </span>
    </>
  );

  if (!interactive) return <div className={boxClass}>{content}</div>;
  return (
    <Link
      href={`/notes/${quote.id}`}
      className={cn(
        boxClass,
        "transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
      )}
    >
      {content}
    </Link>
  );
}
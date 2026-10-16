import type { HighlightColor } from "@/ui/editor/colors";
import { HighlightRow } from "./HighlightRow";

export type RememberCardProps = {
  quote: string;
  note: string | null;
  color: HighlightColor;
  // Title of the story, or null when it is not published anymore.
  storyTitle: string | null;
  // Link to the story at this highlight; null when the story is not available.
  href: string | null;
};

// A quiet card at the top of the Highlights page: one old highlight, so the
// reader meets a passage they may have forgotten.
export function RememberCard({
  quote,
  note,
  color,
  storyTitle,
  href,
}: RememberCardProps) {
  return (
    <section
      aria-label="Remember this?"
      className="mb-8 rounded-2xl bg-muted/40 p-5 sm:p-6"
    >
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground">
        Remember this?
      </p>
      <ul>
        <HighlightRow quote={quote} note={note} color={color} href={href} />
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        From {storyTitle ?? "a story that is no longer available"}
      </p>
    </section>
  );
}
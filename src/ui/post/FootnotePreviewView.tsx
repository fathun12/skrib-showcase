export type FootnotePreviewPlacement = "above" | "below";

export type FootnotePreviewViewProps = {
  id: string;
  text: string;
  // Viewport position (px) of the anchor point: the middle of the number.
  top: number;
  left: number;
  // "above": the box sits over the number; "below": under it.
  placement: FootnotePreviewPlacement;
};

// The small box that shows a footnote while the pointer rests on its number.
// Props only: finding the note and the timing live in features/footnote-preview.
// It ignores the pointer on purpose, so it never steals a hover or a click.
export function FootnotePreviewView({
  id,
  text,
  top,
  left,
  placement,
}: FootnotePreviewViewProps) {
  return (
    <div
      id={id}
      role="tooltip"
      style={{ top, left }}
      className={`pointer-events-none fixed z-50 w-80 max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-xl border border-border bg-background/90 p-3 text-sm leading-relaxed text-foreground shadow-lg backdrop-blur ${
        placement === "above" ? "-translate-y-full" : ""
      }`}
    >
      <p className="line-clamp-6 wrap-break-word">{text}</p>
    </div>
  );
}
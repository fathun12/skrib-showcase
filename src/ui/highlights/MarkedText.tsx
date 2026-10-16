import { Fragment } from "react";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Shows `text` with every occurrence of `term` in bold (ignoring case). The
// text is split, never turned into HTML. An empty term shows the text as is.
export function MarkedText({ text, term }: { text: string; term: string }) {
  const needle = term.trim();
  if (needle === "") return <>{text}</>;
  // A capture group keeps the matches in the result, at the odd positions.
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="bg-transparent font-semibold text-foreground"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
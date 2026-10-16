"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  countWords,
  minutesForWords,
  usesCharacters,
  type DocNode,
} from "@/features/posts/content";

// Count per document version and language, so a transaction that does not
// change the text (moving the cursor) does not count again.
const cache = new WeakMap<object, { lang: string; count: number }>();

function countOf(editor: Editor, lang: string): number {
  const doc = editor.state.doc;
  const known = cache.get(doc);
  if (known && known.lang === lang) return known.count;
  const count = countWords(editor.getJSON() as DocNode, lang);
  cache.set(doc, { lang, count });
  return count;
}

function Counter({ editor, lang }: { editor: Editor; lang: string }) {
  // Only this small component re-renders while typing, not the whole editor.
  const count = useEditorState({
    editor,
    selector: (ctx) => countOf(ctx.editor, lang),
  });
  const unit = usesCharacters(lang)
    ? count === 1
      ? "character"
      : "characters"
    : count === 1
      ? "word"
      : "words";
  return (
    <span className="tabular-nums">
      {count.toLocaleString("en-US")} {unit} · {minutesForWords(count, lang)}{" "}
      min read
    </span>
  );
}

// "1,240 words · 6 min read" for the top bar and the focus corner. Same rule
// as the reading time that is saved with the post. Japanese and Chinese have
// no spaces, so they count characters.
export function WordCount({
  editor,
  lang = "en",
  className,
}: {
  editor: Editor | null;
  lang?: string;
  className?: string;
}) {
  if (!editor) return null;
  return (
    <p className={className ?? "text-sm text-muted-foreground"}>
      {/* key: a new language recounts at once */}
      <Counter key={lang} editor={editor} lang={lang} />
    </p>
  );
}
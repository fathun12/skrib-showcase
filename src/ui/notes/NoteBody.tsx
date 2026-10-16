import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ProfileLink } from "@/ui/profile/ProfileLink";
import { TAG_MAX_COUNT } from "@/ui/tags";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"]+$/;

// Keep in sync with private.extract_note_tags (migration 0072): a hashtag
// starts at the beginning of the text or after a character that is not a
// letter, a number or one of _ & / # -, and has the shape of a topic
// (2 to 30 characters of a-z, 0-9 and hyphens, no hyphen at either end).
const HASHTAG_PATTERN =
  /(^|[^\p{L}\p{N}_&/#-])#([a-z0-9][a-z0-9-]{0,28}[a-z0-9])(?![\p{L}\p{N}_-])/giu;

// Keep in sync with private.extract_note_mentions (migration 0073).
export const MENTION_PATTERN =
  /(^|[^\p{L}\p{N}_&/@-])@([a-z0-9_-]{3,30})(?![\p{L}\p{N}_-])/giu;

// Turns hashtags in a piece of plain text into links. Only the first 5
// different hashtags of the note are links (like the database); `seen` is
// shared by all pieces of one note.
function renderHashtags(part: string, seen: Set<string>): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of part.matchAll(HASHTAG_PATTERN)) {
    const before = match[1];
    const raw = match[2];
    const tag = raw.toLowerCase();
    if (!seen.has(tag) && seen.size >= TAG_MAX_COUNT) continue;
    seen.add(tag);
    const start = (match.index ?? 0) + before.length;
    nodes.push(part.slice(last, start));
    nodes.push(
      <Link
        key={start}
        href={`/notes/tag/${tag}`}
        className="text-primary hover:underline focus-visible:underline"
      >
        #{raw}
      </Link>,
    );
    last = start + 1 + raw.length;
  }
  nodes.push(part.slice(last));
  return nodes;
}

// Turns @mentions into profile links, then the text around them into
// hashtag links. Only a username the database accepted (`mentions`) becomes
// a link: a person who does not exist, or yourself, stays plain text.
function renderText(
  part: string,
  seen: Set<string>,
  mentions: ReadonlySet<string>,
): ReactNode[] {
  if (mentions.size === 0) return renderHashtags(part, seen);

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of part.matchAll(MENTION_PATTERN)) {
    const before = match[1];
    const raw = match[2];
    const name = raw.toLowerCase();
    if (!mentions.has(name)) continue;
    const start = (match.index ?? 0) + before.length;
    nodes.push(
      <Fragment key={`t${last}`}>
        {renderHashtags(part.slice(last, start), seen)}
      </Fragment>,
    );
    nodes.push(
      <ProfileLink
        key={`m${start}`}
        username={name}
        className="text-primary hover:underline focus-visible:underline"
      >
        @{raw}
      </ProfileLink>,
    );
    last = start + 1 + raw.length;
  }
  nodes.push(
    <Fragment key={`t${last}`}>
      {renderHashtags(part.slice(last), seen)}
    </Fragment>,
  );
  return nodes;
}

type Props = {
  text: string;
  // Lowercase usernames this note mentions (from the database).
  mentions?: readonly string[];
};

// Plain text only (React text nodes). Links, hashtags and mentions are found
// at render time; web links get rel="nofollow noopener noreferrer"; nothing
// is ever injected as HTML.
export function NoteBody({ text, mentions }: Props) {
  // split() with one capture group puts the links at the odd positions.
  const parts = text.split(URL_PATTERN);
  const seen = new Set<string>();
  const mentioned = new Set(mentions ?? []);

  return (
    <p className="mt-1 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          return (
            <Fragment key={index}>{renderText(part, seen, mentioned)}</Fragment>
          );
        }
        const trailing = TRAILING_PUNCTUATION.exec(part)?.[0] ?? "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <Fragment key={index}>
            <a
              href={url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-primary hover:underline"
            >
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </p>
  );
}
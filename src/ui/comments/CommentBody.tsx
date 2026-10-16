import { Fragment, type ReactNode } from "react";
import { MENTION_PATTERN } from "@/ui/notes/NoteBody";
import { ProfileLink } from "@/ui/profile/ProfileLink";

type Props = {
  text: string;
  // Lowercase usernames this comment mentions (from the database).
  mentions?: readonly string[];
};

// Plain text with @mentions as profile links. Only a username the database
// accepted becomes a link; a person who does not exist stays plain text.
// Web links in the text are still NOT clickable.
export function CommentBody({ text, mentions }: Props) {
  const mentioned = new Set(mentions ?? []);
  if (mentioned.size === 0) return <>{text}</>;

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const before = match[1];
    const raw = match[2];
    const name = raw.toLowerCase();
    if (!mentioned.has(name)) continue;
    const start = (match.index ?? 0) + before.length;
    nodes.push(
      <Fragment key={`t${last}`}>{text.slice(last, start)}</Fragment>,
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
  nodes.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}
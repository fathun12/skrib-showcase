import { Fragment, type ReactNode } from "react";
import { Avatar } from "@/ui/primitives/Avatar";
import { ProfileLink } from "@/ui/profile/ProfileLink";

export type BylineAuthor = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

export type AuthorsBylineProps = {
  // Owner first, then accepted co-authors. Shows at most 4 avatars.
  authors: BylineAuthor[];
  // Second line under the names, for example "Oct 4, 2026 · 5 min read".
  meta?: ReactNode;
};

export function AuthorsByline({ authors, meta }: AuthorsBylineProps) {
  if (authors.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {authors.slice(0, 4).map((a) => (
          <ProfileLink
            key={a.username}
            username={a.username}
            decorative
            className="rounded-full"
          >
            <Avatar
              name={a.displayName}
              src={a.avatarUrl}
              size="md"
              className="ring-2 ring-background"
            />
          </ProfileLink>
        ))}
      </div>
      <div className="text-sm">
        <p>
          {authors.map((a, i) => (
            <Fragment key={a.username}>
              {i === 0 ? "" : i === authors.length - 1 ? " and " : ", "}
              <ProfileLink
                username={a.username}
                className="font-medium hover:underline"
              >
                {a.displayName}
              </ProfileLink>
            </Fragment>
          ))}
        </p>
        {meta ? <p className="text-muted-foreground">{meta}</p> : null}
      </div>
    </div>
  );
}
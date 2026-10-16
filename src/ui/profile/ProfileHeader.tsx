import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/ui/primitives/Avatar";

export type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  // Hidden when undefined: follows arrive in Phase 4 (and the follower pages
  // do not exist yet, so the links would 404).
  followerCount?: number;
  followingCount?: number;
  action?: ReactNode;
};

export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  bio,
  followerCount,
  followingCount,
  action,
}: ProfileHeaderProps) {
  return (
    <header className="flex flex-col gap-5 pb-8 sm:flex-row sm:items-start">
      <Avatar name={displayName} src={avatarUrl} size="lg" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>
          {action ? <div>{action}</div> : null}
        </div>

        {bio ? <p className="mt-4 max-w-prose">{bio}</p> : null}

        {followerCount !== undefined && followingCount !== undefined ? (
          <p className="mt-4 flex gap-5 text-sm">
            <Link href={`/${username}/followers`} className="hover:underline">
              <strong className="font-semibold">{followerCount}</strong>{" "}
              <span className="text-muted-foreground">Followers</span>
            </Link>
            <Link href={`/${username}/following`} className="hover:underline">
              <strong className="font-semibold">{followingCount}</strong>{" "}
              <span className="text-muted-foreground">Following</span>
            </Link>
          </p>
        ) : null}
      </div>
    </header>
  );
}
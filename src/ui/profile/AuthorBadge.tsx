import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/ui/primitives/Avatar";

export type AuthorBadgeProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  action?: ReactNode;
};

export function AuthorBadge({
  displayName,
  username,
  avatarUrl,
  bio,
  action,
}: AuthorBadgeProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar name={displayName} src={avatarUrl} size="md" />

      <div className="min-w-0 flex-1">
        <Link href={`/${username}`} className="block truncate text-sm font-medium hover:underline">
          {displayName}
        </Link>
        <p className="truncate text-sm text-muted-foreground">
          {bio ?? `@${username}`}
        </p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
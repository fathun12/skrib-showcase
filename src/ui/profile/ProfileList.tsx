import { Avatar } from "@/ui/primitives/Avatar";
import { ProfileLink } from "@/ui/profile/ProfileLink";

export type ProfileListItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type ProfileListProps = {
  items: ProfileListItem[];
  emptyText: string;
};

export function ProfileList({ items, emptyText }: ProfileListProps) {
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">{emptyText}</p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <ProfileLink
            username={item.username}
            className="group flex items-center gap-4 py-4"
          >
            <Avatar name={item.displayName} src={item.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium group-hover:underline">
                {item.displayName}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{item.username}
              </p>
              {item.bio ? (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {item.bio}
                </p>
              ) : null}
            </div>
          </ProfileLink>
        </li>
      ))}
    </ul>
  );
}
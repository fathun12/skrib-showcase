import { Button } from "@/ui/primitives/button";

export type FollowButtonProps = {
  following: boolean;
  pending?: boolean;
  onToggle: () => void;
};

export function FollowButton({ following, pending, onToggle }: FollowButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "outline" : "default"}
      onClick={onToggle}
      disabled={pending}
      aria-pressed={following}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
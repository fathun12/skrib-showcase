"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PreviewCard } from "@base-ui/react/preview-card";
import { Avatar } from "@/ui/primitives/Avatar";
import { FollowButton } from "@/ui/profile/FollowButton";
import {
  useHoverCardApi,
  type HoverCardApi,
  type HoverProfile,
} from "@/ui/profile/hover-card-context";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; profile: HoverProfile };

export type ProfileLinkProps = {
  username: string;
  className?: string;
  // For an avatar that sits next to a name link: no tab stop and hidden from
  // screen readers, because the name link is the accessible one.
  decorative?: boolean;
  children: ReactNode;
};

// A link to a profile. With a provider above it, resting the pointer on the
// link (or focusing it) opens a small card. Without a provider it is a plain
// link, so this component is safe to use anywhere.
export function ProfileLink({
  username,
  className,
  decorative,
  children,
}: ProfileLinkProps) {
  const api = useHoverCardApi();
  if (!api) {
    return (
      <Link
        href={`/${username}`}
        className={className}
        tabIndex={decorative ? -1 : undefined}
        aria-hidden={decorative ? true : undefined}
      >
        {children}
      </Link>
    );
  }
  return (
    <HoverLink
      api={api}
      username={username}
      className={className}
      decorative={decorative}
    >
      {children}
    </HoverLink>
  );
}

function HoverLink({
  api,
  username,
  className,
  decorative,
  children,
}: ProfileLinkProps & { api: HoverCardApi }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(open: boolean) {
    if (!open) return;
    setError(null);
    // Old data stays visible while it refreshes; the skeleton shows only the first time.
    setState((current) =>
      current.status === "ready" ? current : { status: "loading" },
    );
    api.loadProfile(username).then(
      (profile) =>
        setState(profile ? { status: "ready", profile } : { status: "missing" }),
      () => setState({ status: "missing" }),
    );
  }

  async function handleToggle(profile: HoverProfile) {
    // Signed-out visitors sign in first and come back to this profile.
    if (!profile.signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/${profile.username}`)}`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await api.setFollowing(profile, !profile.following);
      if (result.ok) setState({ status: "ready", profile: result.profile });
      else setError(result.error);
    } catch {
      setError("Could not update. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PreviewCard.Root onOpenChange={handleOpenChange}>
      <PreviewCard.Trigger
        delay={400}
        closeDelay={150}
        className={className}
        tabIndex={decorative ? -1 : undefined}
        aria-hidden={decorative ? true : undefined}
        render={<Link href={`/${username}`} />}
      >
        {children}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          <PreviewCard.Popup className="w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background/90 p-4 text-sm text-foreground shadow-lg backdrop-blur transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0">
            <CardBody
              state={state}
              pending={pending}
              error={error}
              onToggle={handleToggle}
            />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function CardBody({
  state,
  pending,
  error,
  onToggle,
}: {
  state: LoadState;
  pending: boolean;
  error: string | null;
  onToggle: (profile: HoverProfile) => void;
}) {
  if (state.status === "missing") {
    return <p className="text-muted-foreground">This profile is not available.</p>;
  }

  if (state.status !== "ready") {
    return (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const p = state.profile;
  return (
    <div>
      <div className="flex items-start gap-3">
        <Avatar name={p.displayName} src={p.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.displayName}</p>
          <p className="truncate text-muted-foreground">@{p.username}</p>
        </div>
        {p.isSelf ? null : (
          <FollowButton
            following={p.following}
            pending={pending}
            onToggle={() => onToggle(p)}
          />
        )}
      </div>
      {p.bio ? <p className="mt-3 line-clamp-4 wrap-break-word">{p.bio}</p> : null}
      <p className="mt-3 text-muted-foreground">
        {p.followers} {p.followers === 1 ? "follower" : "followers"}
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
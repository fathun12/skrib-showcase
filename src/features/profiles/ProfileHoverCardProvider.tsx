"use client";

import type { ReactNode } from "react";
import { setFollow } from "@/features/follows/actions";
import {
  HoverCardApiProvider,
  type HoverCardApi,
  type HoverProfile,
} from "@/ui/profile/hover-card-context";
import { getHoverProfile } from "./hover-actions";

// Cards are cached in the browser for a minute, so moving the pointer over the
// same name again does not ask the server again.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; profile: HoverProfile | null }>();
const inflight = new Map<string, Promise<HoverProfile | null>>();

function loadProfile(username: string): Promise<HoverProfile | null> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.profile);

  const running = inflight.get(key);
  if (running) return running;

  const request = getHoverProfile(key)
    .then((profile) => {
      cache.set(key, { at: Date.now(), profile });
      return profile;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

async function setFollowing(profile: HoverProfile, follow: boolean) {
  const result = await setFollow({ profileId: profile.id, follow });
  if (!result.ok) return { ok: false as const, error: result.error };

  const updated: HoverProfile = {
    ...profile,
    following: follow,
    followers: Math.max(0, profile.followers + (follow ? 1 : -1)),
  };
  cache.set(profile.username.toLowerCase(), { at: Date.now(), profile: updated });
  return { ok: true as const, profile: updated };
}

const api: HoverCardApi = { loadProfile, setFollowing };

export function ProfileHoverCardProvider({ children }: { children: ReactNode }) {
  return <HoverCardApiProvider value={api}>{children}</HoverCardApiProvider>;
}
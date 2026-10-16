"use client";

import { createContext, useContext } from "react";

export type HoverProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  followers: number;
  // The viewer's relation to this profile (for the Follow button).
  signedIn: boolean;
  isSelf: boolean;
  following: boolean;
};

export type HoverFollowResult =
  | { ok: true; profile: HoverProfile }
  | { ok: false; error: string };

// What the card needs from the outside world. ui/ stays pure: the real
// implementation is plugged in by features/profiles/ProfileHoverCardProvider.
export type HoverCardApi = {
  loadProfile: (username: string) => Promise<HoverProfile | null>;
  setFollowing: (
    profile: HoverProfile,
    follow: boolean,
  ) => Promise<HoverFollowResult>;
};

const HoverCardContext = createContext<HoverCardApi | null>(null);

export const HoverCardApiProvider = HoverCardContext.Provider;

export function useHoverCardApi() {
  return useContext(HoverCardContext);
}
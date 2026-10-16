"use client";

import { useEffect } from "react";
import { syncSavedOffline } from "./storyCache";

// Renders nothing. When the Saved page is open online, it quietly makes sure
// every saved story has an offline copy.
export function SavedOfflineSync({ paths }: { paths: string[] }) {
  // A string key, so the effect runs again only when the list really changes.
  const key = paths.join("\n");

  useEffect(() => {
    void syncSavedOffline(key ? key.split("\n") : []);
  }, [key]);

  return null;
}
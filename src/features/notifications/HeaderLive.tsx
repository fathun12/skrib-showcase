"use client";

import { useEffect, useState } from "react";
import { Header, type HeaderProps } from "@/ui/layout/Header";
import { MobileNavConnected } from "./MobileNavConnected";

// How often an open, visible tab asks for the new bell number.
const POLL_MS = 60_000;

// The Header with a bell number that keeps itself up to date: it asks the
// server every minute while the tab is visible, and at once when the person
// comes back to the tab. The number from the server render (props) still
// wins whenever it changes, for example after the notifications page was
// opened and everything was marked as seen.
export function HeaderLive(props: HeaderProps) {
  const { user, unreadCount = 0 } = props;
  const [count, setCount] = useState(unreadCount);
  const [lastProp, setLastProp] = useState(unreadCount);
  if (unreadCount !== lastProp) {
    setLastProp(unreadCount);
    setCount(unreadCount);
  }

  const signedIn = Boolean(user);

  useEffect(() => {
    if (!signedIn) return;
    let stopped = false;

    async function refresh() {
      try {
        const response = await fetch("/api/notifications/count", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          !stopped &&
          typeof data === "object" &&
          data !== null &&
          "count" in data &&
          typeof data.count === "number"
        ) {
          setCount(data.count);
        }
      } catch {
        // Offline or a hiccup: keep the old number, try again later.
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    const timer = window.setInterval(refreshIfVisible, POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [signedIn]);

  return (
    <>
      <Header {...props} unreadCount={count} />
      {/* Small screens: the links that left the header, with the same live
          count as the bell above. */}
      {signedIn ? <MobileNavConnected unreadCount={count} /> : null}
    </>
  );
}
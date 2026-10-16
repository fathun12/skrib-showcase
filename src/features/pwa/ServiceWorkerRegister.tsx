"use client";

import { useEffect } from "react";
import { syncCacheOwner } from "@/features/offline/storyCache";

// Registers the service worker (public/sw.js) once the page has loaded, as
// web.dev recommends, so it never competes with the first paint. Production
// only: in `next dev` a worker would only get in the way.
// `updateViaCache: "none"` is the option the Next.js PWA guide uses so that a
// new worker file is always fetched fresh.
export function ServiceWorkerRegister({ userId }: { userId: string | null }) {
  // Clears the offline story copies when a different account is signed in.
  useEffect(() => {
    syncCacheOwner(userId);
  }, [userId]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return undefined;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
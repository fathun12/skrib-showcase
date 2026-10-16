// Skrib service worker. Two jobs:
// 1. When a page cannot be loaded because the network is down, show the saved
//    copy of that story if there is one, otherwise /offline.html.
// 2. Keep the static files and images that a saved story needs.
// A story copy is added only by the page (storyCache.ts, when you press Save).
// This worker only refreshes copies that already exist, so a private page
// (login, write, settings) can never end up in the cache.
// Pattern: https://web.dev/articles/offline-fallback-page
//
// If you change offline.html, raise VERSION so browsers fetch it again.

const VERSION = 4;
const CACHE_PREFIX = "skrib-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v${VERSION}`;
const OFFLINE_URL = "/offline.html";
// Not versioned: it holds the person's saved stories. The activate step below
// only deletes caches that start with CACHE_PREFIX, so these two stay.
const STORIES_CACHE = "skrib-stories";
const ASSET_CACHE = "skrib-assets";
const MAX_ASSETS = 150;
// Story images have their own cache, so they can never push out the files
// the pages need to run.
const IMAGE_CACHE = "skrib-images";
const MAX_IMAGES = 100;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: "reload" skips the HTTP cache, so the copy comes from the network.
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      // Take over at once; safe, because only one static page is stored.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove the offline caches of older versions (and only those).
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      // Start the network request while the worker wakes up, so a page
      // visit is not slower because of this worker.
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Files a saved story needs. Everything else goes to the network untouched.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/_next/image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGES));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, MAX_ASSETS));
  }
});

async function handleNavigation(event) {
  const { request } = event;
  try {
    const response = (await event.preloadResponse) || (await fetch(request));
    // Refresh a copy that already exists (so edits by the author arrive);
    // never add a new one.
    if (response.ok && !response.redirected) {
      event.waitUntil(refreshStory(request.url, response.clone()));
    }
    return response;
  } catch {
    // Thrown only when the network fails. A real HTTP 4xx or 5xx answer is
    // a valid response and passes through normally.
    const stories = await caches.open(STORIES_CACHE);
    const saved = await stories.match(request.url);
    if (saved) return saved;
    // The home page cannot be read offline. When a copy of the Saved page
    // exists, go there instead of showing a dead end. The copies are removed
    // when someone signs out, so this never leads into another account's list.
    if (
      new URL(request.url).pathname === "/" &&
      (await stories.match("/me/saved"))
    ) {
      return Response.redirect(
        new URL("/me/saved", self.location.origin).href,
        302,
      );
    }
    const offline = await caches.open(CACHE_NAME);
    return (await offline.match(OFFLINE_URL)) || Response.error();
  }
}

async function refreshStory(url, copy) {
  const cache = await caches.open(STORIES_CACHE);
  if (await cache.match(url)) await cache.put(url, copy);
}

async function cacheFirst(request, cacheName, max) {
  // caches.match looks in every cache, so an image stored by an older
  // version of this worker (in ASSET_CACHE) is still found.
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    // Keep the newest `max` files; the oldest go first.
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - max))) {
      await cache.delete(key);
    }
  }
  return response;
}
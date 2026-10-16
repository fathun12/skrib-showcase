// Offline copies of saved stories. Used from the page (Cache API works there
// too), so a story is stored the moment you press Save, not only when opened.
export const STORIES_CACHE = "skrib-stories";
// Same name as IMAGE_CACHE in public/sw.js.
export const IMAGES_CACHE = "skrib-images";
const MAX_IMAGES_PER_STORY = 40;
const IMAGE_BATCH = 4;
const IMAGE_TIMEOUT_MS = 15_000;
const MAX_STORIES = 50;
const OWNER_KEY = "skrib-cache-owner";
const SAVED_PATH = "/me/saved";

// Set while the copies of another account are being removed, so that a refill
// (syncSavedOffline) waits for it instead of racing with it.
let ownerCleanup: Promise<unknown> = Promise.resolve();

// Images being loaded; the set keeps them alive until they finish.
const pendingImages = new Set<HTMLImageElement>();

// Loads one image the way the page would (same srcset and sizes, so the
// browser picks the same file). The service worker stores the answer.
// Always resolves: a failed or slow image must not stop the others.
function preloadImage(
  src: string,
  srcset: string | null,
  sizes: string | null,
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      pendingImages.delete(img);
      resolve();
    };
    timer = window.setTimeout(done, IMAGE_TIMEOUT_MS);
    img.onload = done;
    img.onerror = done;
    pendingImages.add(img);
    if (sizes) img.sizes = sizes;
    if (srcset) img.srcset = srcset;
    img.src = src;
  });
}

// Reads the saved HTML of a page and loads its /_next/image pictures, so that
// the ones below the fold are stored too. A few at a time.
async function cacheStoryImages(cache: Cache, path: string): Promise<void> {
  const response = await cache.match(path);
  if (!response) return;
  const doc = new DOMParser().parseFromString(
    await response.text(),
    "text/html",
  );
  const images = Array.from(
    doc.querySelectorAll<HTMLImageElement>("img[src^='/_next/image']"),
  ).slice(0, MAX_IMAGES_PER_STORY);
  for (let i = 0; i < images.length; i += IMAGE_BATCH) {
    await Promise.all(
      images.slice(i, i + IMAGE_BATCH).map((el) => {
        const src = el.getAttribute("src");
        return src
          ? preloadImage(
              src,
              el.getAttribute("srcset"),
              el.getAttribute("sizes"),
            )
          : Promise.resolve();
      }),
    );
  }
}

export async function saveStoryOffline(path: string): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(STORIES_CACHE);
    // add() rejects on a non-OK answer, so a 404 is never stored.
    await cache.add(new Request(path, { cache: "reload" }));
    await cache.add(new Request(SAVED_PATH, { cache: "reload" }));
    const keys = await cache.keys(); // oldest first
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STORIES))) {
      await cache.delete(key);
    }
    await cacheStoryImages(cache, path);
    await cacheStoryImages(cache, SAVED_PATH);
  } catch {
    // Offline copy is a bonus; saving the bookmark itself already worked.
  }
}

export async function removeStoryOffline(path: string): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(STORIES_CACHE);
    await cache.delete(path);
  } catch {
    // Nothing to remove.
  }
}

// Fills in the copies of saved stories that have none yet (for example right
// after signing in again, or for stories saved before this feature existed).
// Only missing ones are fetched, and only while online.
export async function syncSavedOffline(paths: string[]): Promise<void> {
  if (!("caches" in window) || !navigator.onLine || paths.length === 0) return;
  try {
    await ownerCleanup;
    const cache = await caches.open(STORIES_CACHE);
    for (const path of [SAVED_PATH, ...paths.slice(0, MAX_STORIES)]) {
      if (await cache.match(path)) continue;
      try {
        await cache.add(new Request(path, { cache: "reload" }));
        if (path !== SAVED_PATH) await cacheStoryImages(cache, path);
      } catch {
        // One story failing must not stop the others.
      }
    }
  } catch {
    // Offline copies are a bonus.
  }
}

// Clears the copies when the signed-in account is not the one who made them.
export function syncCacheOwner(userId: string | null): void {
  try {
    const next = userId ?? "";
    const prev = localStorage.getItem(OWNER_KEY);
    if (prev !== null && prev !== next && "caches" in window) {
      ownerCleanup = Promise.all([
        caches.delete(STORIES_CACHE),
        caches.delete(IMAGES_CACHE),
      ]);
    }
    localStorage.setItem(OWNER_KEY, next);
  } catch {
    // Storage can be blocked; then nothing is cleared and nothing breaks.
  }
}
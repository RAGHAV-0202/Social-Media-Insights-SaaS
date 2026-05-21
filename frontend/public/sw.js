// Lightweight image cache service worker.
// Strategy: cache-first for images, with a stale-while-revalidate update
// in the background. Scoped to known image hosts so we never accidentally
// cache HTML/JS or API responses.

const CACHE_NAME = "img-cache-v1";
const MAX_ENTRIES = 300;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const IMAGE_HOSTS = [
  "wsrv.nl",
  "images.weserv.nl",
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "ttwstatic.com",
  "ytimg.com",
  "pbs.twimg.com",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isImageRequest(req) {
  if (req.method !== "GET") return false;
  if (req.destination === "image") return true;
  try {
    const url = new URL(req.url);
    return IMAGE_HOSTS.some((h) => url.hostname.endsWith(h));
  } catch {
    return false;
  }
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const toDelete = keys.length - MAX_ENTRIES;
  for (let i = 0; i < toDelete; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!isImageRequest(req)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      const fetchAndStore = fetch(req)
        .then((res) => {
          // Only cache successful or opaque (cross-origin no-cors) responses.
          if (res && (res.ok || res.type === "opaque")) {
            const clone = res.clone();
            const headers = new Headers(clone.headers);
            headers.set("x-sw-cached-at", String(Date.now()));
            clone.blob().then((body) => {
              const stamped = new Response(body, {
                status: clone.status,
                statusText: clone.statusText,
                headers,
              });
              cache.put(req, stamped).then(() => trimCache(cache));
            });
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        const stampedAt = Number(cached.headers.get("x-sw-cached-at") || 0);
        const fresh = Date.now() - stampedAt < MAX_AGE_MS;
        if (fresh) {
          // Refresh in the background, return cached immediately.
          event.waitUntil(fetchAndStore);
          return cached;
        }
      }

      const networkRes = await fetchAndStore;
      return networkRes || cached || Response.error();
    })(),
  );
});

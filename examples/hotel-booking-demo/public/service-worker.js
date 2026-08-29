// information_uuid_v5=29b230b1-92c7-53b5-a046-a42eeac4f4a3
// event_uuid_v7=01a04bd0-b895-7a62-89e3-87746b5fc084 state_transition=ONLINE_SHELL -> OFFLINE_SHELL_READY occurred_at=2026-08-29T01:00:00Z
// machine-contract: cache the same-origin display shell only; never repeat, synchronize, confirm, pay, or cancel a booking in the background.
const CACHE_NAME = "fictional-kyoto-booking-v1";
const ASSETS = [
  "/",
  "/assets/app.js",
  "/assets/index.css",
  "/favicon.svg",
  "/webmcp-evals.json",
  "/service-integrations.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => response || caches.match("/"))),
  );
});

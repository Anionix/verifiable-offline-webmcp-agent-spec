// information_uuid_v5=e1847db8-7c18-59e4-9ac3-e6a951f80c8e
// event_uuid_v7=01a04a5f-5116-7b40-a1ac-c4768d00f573
// event_uuid_v7=01a04a69-2b0b-7639-8b15-190b32b1967f state_transition=OFFLINE_READY -> EVALUATION_ASSET_CACHED occurred_at=2026-08-28T22:06:43Z
// state_transition=ONLINE_FIRST_VISIT -> OFFLINE_READY occurred_at=2026-08-28T22:05:45.750Z
// machine-contract: only same-origin static assets are cached; notification tags remain UUIDv5 intent IDs and no background retry is registered.

const CACHE_NAME = "verifiable-offline-webmcp-v2";
const ASSETS = Object.freeze([
  "/",
  "/index.html",
  "/favicon.svg",
  "/styles.css",
  "/app.js",
  "/browser-store.js",
  "/webmcp-adapter.js",
  "/input-projection.js",
  "/webmcp-evals.json",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    });
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const current = windows.find((item) => "focus" in item);
    return current ? current.focus() : clients.openWindow("/");
  }));
});

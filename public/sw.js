/* NEXUS offline shell. Never cache API responses, conversations or user documents. */
const CACHE = "nexus-shell-v3";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const path = (value) => SCOPE_PATH + value;
const SHELL = [
  path("/offline.html"),
  path("/icon.svg"),
  path("/icons/icon-192.png"),
  path("/icons/icon-512.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("nexus-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(path("/offline.html"))),
    );
    return;
  }

  if (SHELL.includes(new URL(event.request.url).pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
  }
});

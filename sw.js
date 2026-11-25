/* OpenStax Algebra Practice — Offline Service Worker (GitHub Pages PWA) */
var CACHE_VERSION = "algebra-practice-v1";

var CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./engine/math_utils.js",
  "./engine/grader.js",
  "./engine/renderers.js",
  "./engine/scratchpad.js",
  "./engine/core.js",
  "./chapters/ch03_graphs.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_VERSION) return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/*
 * Network-first with automatic cache refresh & offline fallback:
 * - Online: pulls any newly pushed chapters (e.g. ch04_systems.js) immediately
 *   and saves them into the offline cache automatically.
 * - Offline: serves the cached app shell & chapter files instantly.
 */
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (networkRes) {
        if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
          var copy = networkRes.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return networkRes;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          if (cached) return cached;
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
      })
  );
});

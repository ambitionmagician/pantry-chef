"use strict";
const scopeURL = self.registration.scope;
const prefix = "pantry-chef:" + scopeURL + ":";
const cacheName = prefix + "shell-v1";
const home = new URL("index.html", scopeURL).href;
const manifest = new URL("manifest.json", scopeURL).href;
const shell = new Set([home, manifest]);

function sameScope(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.href === scopeURL || url.href === scopeURL.replace(/\/$/, "")) return true;
  return url.href.startsWith(scopeURL);
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...shell].map(url => new Request(url, {cache: "reload"})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith(prefix) && n !== cacheName).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!sameScope(url)) return;
  url.search = "";
  url.hash = "";
  const isNav = req.mode === "navigate" || req.destination === "document";
  const isScopeRoot = url.href === scopeURL || url.href === scopeURL.replace(/\/$/, "");
  const key = isNav && isScopeRoot ? home : url.href;
  if (!shell.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(key);
    if (hit) return hit;
    try {
      const response = await fetch(key);
      if (response.ok) await cache.put(key, response.clone());
      return response;
    } catch (err) {
      const fallback = await cache.match(home);
      if (fallback) return fallback;
      return new Response("You are offline. Please reopen Pantry Chef once you are connected.", {
        status: 503,
        headers: {"Content-Type": "text/plain;charset=utf-8"}
      });
    }
  })());
});

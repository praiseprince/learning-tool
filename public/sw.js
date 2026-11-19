self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if(event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    "<!doctype html><html lang=en><meta name=viewport content='width=device-width,initial-scale=1'><title>Marginalia offline</title><main><h1>Marginalia is offline</h1><p>Reconnect to your laptop and reload to open your journal.</p><a href='/'>Try again</a></main></html>",
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
});

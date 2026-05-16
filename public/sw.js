const CACHE_VERSION = "omniharness-pwa-v5";
const OFFLINE_URL = "/offline.html";
const CORE_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192-v2.png",
  "/icons/icon-512-v2.png",
  "/icons/apple-touch-icon-v2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
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
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  if (
    url.origin === self.location.origin &&
    CORE_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            return response;
          })
        );
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function hasVisibleWindowClient(clients) {
  return clients.some((client) => client.visibilityState === "visible");
}

function focusOrOpenTarget(targetUrl, clients) {
  const exactClient = clients.find((client) => {
    return "focus" in client && client.url === targetUrl.href;
  });

  if (exactClient) {
    return exactClient.focus();
  }

  const navigableClient = clients.find((client) => "navigate" in client);
  if (navigableClient) {
    return navigableClient.navigate(targetUrl.href).then((client) => client?.focus());
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl.href);
  }

  return undefined;
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const hasVisibleClient = hasVisibleWindowClient(clients);
      if (hasVisibleClient) {
        return;
      }

      let payload = {};
      try {
        payload = event.data ? event.data.json() : {};
      } catch {
        payload = {};
      }

      const title = typeof payload.title === "string" && payload.title.trim()
        ? payload.title
        : "OmniHarness";
      const options = {
        body: typeof payload.body === "string" ? payload.body : "",
        tag: typeof payload.tag === "string" ? payload.tag : "omniharness-notification",
        data: {
          url: typeof payload.url === "string" ? payload.url : "/",
        },
        icon: "/icons/icon-192-v2.png",
        badge: "/icons/icon-192-v2.png",
      };

      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => focusOrOpenTarget(targetUrl, clients)),
  );
});

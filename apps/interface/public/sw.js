const CACHE_PREFIX = "omniharness-static-";
const BUILD_HASH = "__OMNI_BUILD_HASH__";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_HASH}`;
const APP_SHELL_URL = "/app-shell.html";
const PRECACHE_ASSETS = __OMNI_PRECACHE_ASSETS__;
const STATIC_ASSET_PATHS = new Set([
  APP_SHELL_URL,
  "/manifest.webmanifest",
  "/icons/favicon-v2.png",
  "/icons/icon-192-v2.png",
  "/icons/icon-512-v2.png",
  "/icons/apple-touch-icon-v2.png",
  ...PRECACHE_ASSETS,
]);

function isSameOriginApi(url) {
  return (
    url.origin === self.location.origin
    && (url.pathname === "/api" || url.pathname.startsWith("/api/"))
  );
}

function isCacheableStaticRequest(request, url) {
  return (
    request.method === "GET"
    && url.origin === self.location.origin
    && STATIC_ASSET_PATHS.has(url.pathname)
    && !request.headers.has("authorization")
  );
}

async function fetchStaticAsset(assetPath) {
  const request = new Request(assetPath, {
    cache: "reload",
    credentials: "omit",
  });
  const response = await fetch(request);
  if (!response.ok || response.type === "opaque") {
    throw new Error(`Unable to pre-cache ${assetPath}`);
  }
  return { request, response };
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = await Promise.all(
      [...STATIC_ASSET_PATHS].map(fetchStaticAsset),
    );
    await Promise.all(
      assets.map(({ request, response }) => cache.put(request, response)),
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // A service worker is scoped to its own runner. Other runners, and all
  // runner API/SSE traffic, must always use the network unchanged.
  if (url.origin !== self.location.origin || isSameOriginApi(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match(APP_SHELL_URL)) ?? Response.error();
      }
    })());
    return;
  }

  if (!isCacheableStaticRequest(request, url)) {
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url.pathname, response.clone());
    }
    return response;
  })());
});

self.addEventListener("message", (event) => {
  if (
    event.data?.type === "SKIP_WAITING"
    || event.data?.type === "OMNI_API_REVISION_MISMATCH"
  ) {
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

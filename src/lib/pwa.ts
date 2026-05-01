const SERVICE_WORKER_URL = "/sw.js";
const DEV_CACHE_PREFIX = "omniharness-";

function isLocalhost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export function canRegisterServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator &&
    (window.isSecureContext || isLocalhost(window.location.hostname))
  );
}

export async function registerServiceWorker() {
  if (!canRegisterServiceWorker()) {
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    await unregisterDevelopmentServiceWorkers();
    return null;
  }

  try {
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  } catch (error) {
    console.error("Failed to register OmniHarness service worker", error);
    return null;
  }
}

export { SERVICE_WORKER_URL };

async function unregisterDevelopmentServiceWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(DEV_CACHE_PREFIX))
          .map((name) => window.caches.delete(name)),
      );
    }
  } catch (error) {
    console.error("Failed to clear OmniHarness development service worker state", error);
  }
}

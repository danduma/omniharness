const SERVICE_WORKER_URL = "/sw.js";

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

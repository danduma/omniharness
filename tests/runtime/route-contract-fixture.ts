import type { OmniHttpRegistry } from "@/runtime/http/registry";

export function discoverRuntimeRouteContract(registry: OmniHttpRegistry) {
  return registry
    .listRoutes()
    .map((route) => `${route.method} ${route.pathname}`)
    .sort();
}

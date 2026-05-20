import type { RuntimeSurface } from "@/server/events/named-events";
import type { OmniRuntime } from "@/runtime";

export interface CreateRuntimeRequestContextOptions {
  surface?: RuntimeSurface | string;
  runtime?: OmniRuntime | null;
}

export function createRuntimeRequestContext(options: CreateRuntimeRequestContextOptions = {}) {
  return {
    surface: options.surface ?? "web",
    runtime: options.runtime ?? null,
  };
}

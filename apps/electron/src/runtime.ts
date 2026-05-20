import { createOmniRuntime, type OmniRuntime } from "../../../src/runtime";
import { createOmniRuntimeHttpRegistry } from "../../../src/runtime/http/routes";
import { startOmniServer, type OmniServerHandle, type StartOmniServerOptions } from "../../../src/runtime/http/server";
import type { OmniHttpRegistry } from "../../../src/runtime/http/registry";

export interface ElectronRuntimeOptions {
  host?: string;
  port?: number;
  label?: string;
  staticDir?: string | null;
  createRuntime?: () => OmniRuntime;
  createRegistry?: () => OmniHttpRegistry;
  startServer?: (options: StartOmniServerOptions) => Promise<OmniServerHandle>;
}

export async function startElectronOmniRuntime(options: ElectronRuntimeOptions = {}) {
  const runtime = options.createRuntime?.() ?? createOmniRuntime({
    surface: "electron",
    label: options.label ?? "OmniHarness Desktop",
  });
  const registry = options.createRegistry?.() ?? createOmniRuntimeHttpRegistry();
  const startServerImpl = options.startServer ?? startOmniServer;

  return startServerImpl({
    host: options.host ?? "127.0.0.1",
    port: options.port ?? 0,
    surface: "electron",
    runtime,
    registry,
    staticDir: options.staticDir ?? null,
  });
}

export function resolveElectronRendererUrl(input: {
  runtimeOrigin: string;
  env?: Record<string, string | undefined>;
}) {
  const env = input.env ?? process.env;
  const configured = env.OMNI_ELECTRON_RENDERER_URL?.trim()
    || env.OMNI_SERVER_URL?.trim()
    || "";
  return configured || input.runtimeOrigin;
}

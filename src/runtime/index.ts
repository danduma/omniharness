import { emitNamedEvent } from "@/server/events/named-events";
import type {
  OmniRuntime,
  OmniRuntimeOptions,
  OmniRuntimeStartResult,
  OmniRuntimeStatus,
} from "./types";
import type { RuntimeStopReason, RuntimeSurface } from "@/server/events/named-events";

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeSurface(surface: OmniRuntimeOptions["surface"]): RuntimeSurface {
  return surface ?? "web";
}

export function createOmniRuntime(options: OmniRuntimeOptions = {}): OmniRuntime {
  const surface = normalizeSurface(options.surface);
  const label = options.label ?? surface;
  let status: OmniRuntimeStatus = "idle";
  let startedAt: string | null = null;
  let startResult: OmniRuntimeStartResult | null = null;

  return {
    surface,
    label,

    async start() {
      if (startResult && status === "running") {
        return startResult;
      }
      if (status === "starting") {
        throw new Error("Omni runtime is already starting.");
      }

      status = "starting";
      try {
        await options.hooks?.onStart?.();
        startedAt = new Date().toISOString();
        startResult = { surface, label, startedAt };
        status = "running";
        emitNamedEvent({ kind: "runtime.started", surface, label, startedAt });
        return startResult;
      } catch (error) {
        const reason = formatError(error);
        status = "failed";
        emitNamedEvent({ kind: "runtime.start_failed", surface, label, reason });
        emitNamedEvent({
          kind: "error.surfaced",
          code: "runtime.start_failed",
          message: reason,
          surface: "log",
          cause: error instanceof Error ? { name: error.name, message: error.message } : null,
        });
        throw error;
      }
    },

    async stop(reason: RuntimeStopReason = "shutdown") {
      if (status !== "running" && status !== "starting") {
        return;
      }
      status = "stopping";
      await options.hooks?.onStop?.(reason);
      status = "stopped";
      emitNamedEvent({ kind: "runtime.stopped", surface, reason });
    },

    getStatus() {
      return status;
    },

    getStartedAt() {
      return startedAt;
    },
  };
}

export type {
  OmniRuntime,
  OmniRuntimeHooks,
  OmniRuntimeOptions,
  OmniRuntimeStartResult,
  OmniRuntimeStatus,
} from "./types";

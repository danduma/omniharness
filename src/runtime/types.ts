import type { RuntimeStopReason, RuntimeSurface } from "@/server/events/named-events";

export type OmniRuntimeStatus = "idle" | "starting" | "running" | "stopping" | "stopped" | "failed";

export interface OmniRuntimeHooks {
  onStart?: () => Promise<void> | void;
  onStop?: (reason: RuntimeStopReason) => Promise<void> | void;
}

export interface OmniRuntimeOptions {
  surface?: RuntimeSurface;
  label?: string;
  hooks?: OmniRuntimeHooks;
}

export interface OmniRuntimeStartResult {
  surface: RuntimeSurface;
  label: string;
  startedAt: string;
}

export interface OmniRuntime {
  readonly surface: RuntimeSurface;
  readonly label: string;
  start(): Promise<OmniRuntimeStartResult>;
  stop(reason?: RuntimeStopReason): Promise<void>;
  getStatus(): OmniRuntimeStatus;
  getStartedAt(): string | null;
}

import type { HandoffReason, HandoffStatus } from "@/shared/handoff";

export type HandoffEvent =
  | { kind: "handoff.capture_started"; runId: string; handoffId: string; workerId: string | null; reason: HandoffReason; targetWorkerType: string }
  | { kind: "handoff.packet_ready"; runId: string; handoffId: string; revision: number; sourceSeq: number | null }
  | { kind: "handoff.packet_revised"; runId: string; handoffId: string; revision: number }
  | { kind: "handoff.launch_started"; runId: string; handoffId: string; revision: number; targetWorkerType: string }
  | { kind: "handoff.completed"; runId: string; handoffId: string; targetRunId: string; targetWorkerType: string }
  | { kind: "handoff.cancelled"; runId: string; handoffId: string; previousStatus: HandoffStatus; reason: string }
  | { kind: "handoff.failed"; runId: string; handoffId: string; stage: "capture" | "termination" | "launch" | "reconcile"; code: string; reason: string }
  | { kind: "handoff.refused"; runId: string; handoffId?: string; stage: "capture" | "launch" | "worker_insert"; code: string; reason: string };

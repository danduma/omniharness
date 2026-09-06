/**
 * Named lifecycle events emitted alongside the snapshot stream.
 *
 * See docs/architecture/lifecycle-observability-and-testing.md for the
 * design rationale. The short version:
 *
 *   - Every server-side decision that the user, the UI, or a test client
 *     might want to observe is published here as a typed event.
 *   - Events share a single monotonic id namespace with the `update`
 *     snapshot frames emitted by /api/events. That keeps SSE
 *     `Last-Event-ID` resume unambiguous.
 *   - A bounded ring buffer remembers recent emissions so reconnecting
 *     clients can replay events they missed during disconnect.
 *
 * This module is intentionally synchronous and in-process. The ring
 * resets when the server restarts; clients then bootstrap via
 * `/api/events?snapshot=1` and resume from the new cursor.
 */
import { notifyEventStreamSubscribers } from "./live-updates";
import type { HandoffEvent } from "./handoff-events";
import type { ClaudeSessionModelReason } from "@/lib/claude-session-model";
import type { GoalAction, GoalPublishedEventKind, GoalSnapshot } from "@/shared/goal-plan";
import { randomBytes } from "node:crypto";
import {
  formatEventStreamId,
  parseEventStreamId,
  type EventStreamId,
  type RuntimeStopReason,
  type RuntimeSurface,
} from "@/shared/runtime";

export type { RuntimeStopReason, RuntimeSurface } from "@/shared/runtime";

// ---------------------------------------------------------------------------
// Event union
// ---------------------------------------------------------------------------

export type SurfacedErrorCode =
  | "plan.review.leftover_state"
  | "plan.review.failed"
  | "conversation.delete.foreign_key"
  | "conversation.delete.failed"
  | "conversation.delete.worker_cancel_failed"
  | "conversation.continue.failed"
  | "conversation.delivery_refused"
  | "conversation.title_generation_failed"
  | "external_session.import_failed"
  | "process.spawn.failed"
  | "process.cwd.invalid"
  | "process.stdin.closed"
  | "process.stop.failed"
  | "process.orphaned_after_restart"
  | "recovery.gave_up"
  | "recovery.needs_user"
  | "recovery.run_failed"
  | "runtime.resource_pressure"
  | "runtime.settings_apply_failed"
  | "runtime.start_failed"
  | "runner.bridge_start_failed"
  | "runner.restarting"
  | "runner.start_failed"
  | "stream.subscriber_overflow"
  | "acp.method.failed"
  | "acp.compatibility.unsupported"
  | "account.invalid_explicit"
  | "account.login_required"
  | "account.auth.binary_missing"
  | "account.auth.spawn_failed"
  | "account.auth.failed"
  | "account.auth.timeout"
  | "account.auth.status_invalid"
  | "account.auth.isolation_failed"
  | "account.auth.unsupported_cli"
  | "account.auth.busy"
  | "account.logout.failed"
  | "account.remove.failed"
  | "account.action.active_workers"
  | "account.action.bridge_unavailable"
  | "account.purge.failed"
  | "account.purge.unsafe_path"
  | "account.delete.failed"
  | "account.quota_switch_failed"
  | "account.resolution_failed"
  | "account.secret_decryption_failed"
  | "account.migration_failed"
  | "session.provider.unknown"
  | "session.action.unsupported"
  | "queue.interrupt.refused"
  | "queue.interrupt.cancel_failed"
  | "queue.interrupt.delivery_failed"
  | "supervisor.gave_up"
  | "supervisor.wake.failed"
  | "surface.bridge_failed"
  | "worker.spawn.failed"
  | "worker.spawn.resource_exhausted"
  | "worker.failover.failed"
  | "handoff.capture_failed"
  | "handoff.summary_failed"
  | "handoff.revision_conflict"
  | "handoff.target_unavailable"
  | "handoff.source_changed"
  | "handoff.launch_failed"
  | "handoff.fork_required"
  | "handoff.packet_version_unsupported"
  | "worker.bridge.fatal_stderr"
  | "worker.environment_mismatch"
  | "worker.idle.empty_output"
  | "worker.idle.missing_output"
  | "worker.initial.empty_output"
  | "worker.initial.turn_failed"
  | "worker.observer.failed"
  | "worker.poll.failed"
  | "worker.resume.failed"
  | "worker.snapshot.invalid"
  | "worker.plan.boundary_append_failed"
  | "worker.plan.append_failed"
  | "worker.plan.diagnostic_append_failed"
  | "worker.plan.snapshot_failed"
  | "worker.plan.event_publish_failed"
  | "worker.plan.binding_hydration_failed"
  | "worker.prompt.image_attachment_unreadable"
  | "worker.output_content_unavailable"
  | "worker.model.version_unavailable"
  // The requested model's *family* is not offered at all. Substituting another
  // family is never correct, so the launch is refused instead.
  | "worker.model.family_unavailable"
  | "worker.model.pin_unsupported"
  | "goal.objective.invalid"
  | "goal.revision_conflict"
  | "goal.action.unsupported"
  | "goal.transition.invalid"
  | "goal.lease.stale"
  | "goal.acp.transport_failed"
  | "goal.reconciliation.failed"
  | "goal.validation.failed"
  | "goal.persistence.failed"
  | "goal.outbox.poisoned"
  | "goal.payload.invalid"
  | "goal.plan.derivation_failed"
  | "goal.not_found"
  | "goal.rate_limited"
  | "filesystem.directory_create_failed"
  | "codex_auth_missing"
  | "codex_auth_refresh_failed"
  | "codex_auth_unavailable"
  | "claude_gateway.install_failed"
  | "claude_gateway.oauth_failed"
  | "claude_gateway.model_discovery_failed"
  | "claude_gateway.not_ready"
  | "claude_gateway.unsupported_platform"
  | "claude_gateway.invalid_configuration"
  | "internal";

export type FailoverStage = "selection" | "handoff" | "spawn";
export type HandoffSource = "worker" | "synthetic";

export type ErrorSurface = "toast" | "banner" | "log";

export type ClaudeModelPinReason = ClaudeSessionModelReason;

export type RuntimeEvent =
  | {
      kind: "runner.stopping";
      surface: RuntimeSurface;
      reason: RuntimeStopReason;
      flushWindowMs: number;
    }
  | {
      kind: "runner.started";
      origin: string;
      bridgeUrl: string;
    }
  | {
      kind: "runner.start_failed";
      reason: string;
      host: string;
      port: number;
    }
  | {
      kind: "runner.static_ui_enabled";
      staticDir: string;
    }
  | {
      kind: "runner.static_ui_missing";
      staticDir: string | null;
      reason: "disabled" | "not_found";
    }
  | {
      kind: "runtime.started";
      surface: RuntimeSurface;
      label: string;
      startedAt: string;
    }
  | {
      kind: "runtime.start_failed";
      surface: RuntimeSurface;
      label: string;
      reason: string;
    }
  | {
      kind: "runtime.stopped";
      surface: RuntimeSurface;
      reason: RuntimeStopReason;
    }
  | {
      kind: "runtime.resource_pressure";
      level: "warning" | "critical";
      memoryFreePercent: number | null;
      diskFreeMb: number | null;
      activeAgents: number;
      poolMembers: number;
      evictedPoolMembers: number;
      reasons: string[];
    }
  | {
      kind: "runtime.settings_updated";
      keys: string[];
    }
  | {
      kind: "runtime.settings_apply_failed";
      keys: string[];
      reason: string;
    }
  | {
      kind: "runtime.idle_cleanup";
      idleMs: number;
      activeAgents: number;
      evictedPoolMembers: number;
    }
  | {
      kind: "surface.connected";
      surface: RuntimeSurface;
      label: string;
    }
  | {
      kind: "surface.disconnected";
      surface: RuntimeSurface;
      reason: string;
    }
  | {
      kind: "surface.bridge_failed";
      surface: RuntimeSurface;
      reason: string;
    }
  | {
      kind: "runner.bridge_starting";
      bridgeUrl: string;
      attempt: number;
    }
  | {
      kind: "runner.bridge_ready";
      bridgeUrl: string;
      ownership: "adopted" | "owned";
    }
  | {
      kind: "runner.bridge_unavailable";
      bridgeUrl: string;
      reason: string;
      retryInMs: number | null;
    }
  | {
      kind: "runner.bridge_lock_contended";
      bridgeUrl: string;
      ownerPid: number | null;
    }
  | {
      kind: "runner.bridge_child_exited";
      bridgeUrl: string;
      code: number | null;
      signal: string | null;
    }
  | {
      kind: "runner.renamed";
      runnerInstanceId: string;
      previousName: string;
      name: string;
    }
  | {
      kind: "runner.rekeyed";
      previousRunnerInstanceId: string;
      runnerInstanceId: string;
    };

export type AuthEvent =
  | {
      kind: "auth.session_revoked";
      sessionId: string;
      reason: "revoked" | "lru_evicted" | "password_rotated";
    }
  | {
      kind: "auth.sessions_revoked";
      reason: "revoked_all" | "password_rotated";
      count: number;
    }
  | {
      kind: "auth.password_rotated";
      sessionsKept: boolean;
    };

export type WorkerEvent =
  | { kind: "worker.spawned"; runId: string; workerId: string; workerType: string }
  | { kind: "worker.status"; runId: string; workerId: string; prev: string; next: string }
  | { kind: "worker.terminal"; runId: string; workerId: string; status: string }
  | { kind: "worker.turn_preempted"; runId: string; workerId: string; reason: "conversation_recovery" }
  | { kind: "worker.reattached"; runId: string; workerId: string }
  | { kind: "worker.recreated"; runId: string; workerId: string }
  | {
      kind: "worker.stale_status_ignored";
      runId: string;
      workerId: string;
      currentWorkerId: string;
      attemptedStatus: string;
      reason: "worker_cancelled" | "newer_worker_owns_run";
    }
  | {
      kind: "worker.stale_output_ignored";
      runId: string;
      workerId: string;
      expectedTurnGeneration: number;
      currentTurnGeneration: number | null;
      source: "entry_append" | "snapshot_batch";
    }
  | {
      kind: "worker.selection_deferred";
      runId: string;
      workerId: string;
      requestedType: string;
      reason: "worker_turn_active";
    }
  | { kind: "worker.recovery_continuation_started"; runId: string; workerId: string }
  | { kind: "worker.recovery_continuation_completed"; runId: string; workerId: string }
  | { kind: "worker.recovery_continuation_superseded"; runId: string; workerId: string }
  | {
      kind: "worker.human_input_reconciled";
      runId: string;
      workerId: string;
      interaction: "permission" | "elicitation";
      closedRequestIds: number[];
      activeRequestIds: number[];
      reason: string;
    }
  | { kind: "worker.delete_race_cancelled"; runId: string; workerId: string }
  | { kind: "worker.session_metadata_repaired"; runId: string; workerId: string }
  // A retry/edit rewound the conversation past output this worker already
  // wrote; those seqs stay on disk but drop out of the conversation view.
  | {
      kind: "worker.branch_superseded";
      runId: string;
      workerId: string;
      targetMessageId: string;
      fromSeq: number;
      throughSeq: number;
    }
  // Claude sessions inherit the CLI's own model choice unless we pin one, which
  // is how workers ended up on 1M-context variants the subscription cannot run.
  | {
      kind: "worker.model_pinned";
      workerId: string;
      requestedModel: string | null;
      selectedModel: string;
      reason: ClaudeModelPinReason;
    }
  | {
      kind: "worker.model_pin_failed";
      workerId: string;
      requestedModel: string | null;
      selectedModel: string;
      reason: string;
    }
  // The session was already on the resolved model, so nothing was set — but the
  // resolution may still be a substitution (lower version, `[1m]`-only family)
  // that the launch has to record. A silent `keep` is how a worker row ended up
  // claiming a model the session never ran.
  | {
      kind: "worker.model_kept";
      workerId: string;
      requestedModel: string | null;
      selectedModel: string;
      reason: ClaudeModelPinReason;
    }
  // Wake-up frame for the unified worker conversation stream. Carries
  // only (workerId, seq); clients fetch the entry via
  // GET /api/workers/:workerId/entries?afterSeq=. See
  // docs/architecture/worker-conversation-stream.md.
  | { kind: "worker.entry_appended"; runId: string; workerId: string; seq: number }
  | {
      kind: "worker.plan_boundary_started";
      runId: string;
      workerId: string;
      seq: number;
    }
  | {
      kind: "worker.plan_updated";
      runId: string;
      workerId: string;
      seq: number;
    }
  | {
      kind: "worker.plan_rejected";
      runId: string;
      workerId: string;
      reason:
        | "unsupported"
        | "unbound"
        | "hydrating"
        | "stale_session"
        | "missing_session"
        | "startup_session_mismatch"
        | "startup_buffer_overflow"
        | "malformed"
        | "oversized";
      sessionId: string | null;
      seq: number | null;
      measuredBytes?: number;
    }
  // Emitted when a write would have resumed numbering above a transcript head
  // that is not on disk. `healed` means the head was recovered from a fallback
  // source; `unrecoverable` means it is gone and the cursor was reset to 0.
  | {
      kind: "worker.stream_head_healed";
      runId: string;
      workerId: string;
      expectedLatestSeq: number;
      recoveredEntries: number;
    }
  | {
      kind: "worker.stream_head_unrecoverable";
      runId: string;
      workerId: string;
      expectedLatestSeq: number;
    }
  | {
      kind: "worker.failover_started";
      runId: string;
      outgoingWorkerId: string;
      outgoingType: string;
      reason: string;
    }
  | {
      kind: "worker.handoff_emitted";
      runId: string;
      outgoingWorkerId: string;
      source: HandoffSource;
    }
  | {
      kind: "worker.failover_completed";
      runId: string;
      outgoingWorkerId: string;
      newWorkerId: string;
      newType: string;
    }
  | {
      kind: "worker.failover_failed";
      runId: string;
      outgoingWorkerId: string;
      stage: FailoverStage;
      reason: string;
    };

export type SupervisorStopReason =
  | "run_terminated"
  | "run_failed"
  | "cwd_mismatch"
  | "snapshot_invalid"
  | "quota_exhausted"
  | "fatal_bridge_error"
  | "explicit";

export type SupervisorEvent =
  | { kind: "supervisor.stopped"; runId: string; reason: SupervisorStopReason }
  | { kind: "supervisor.watchdog_sweep_failed"; reason: string }
  | {
      kind: "supervisor.wake_lease_acquired";
      runId: string;
      source: "insert" | "replace_expired" | "replace_malformed";
    }
  | {
      kind: "supervisor.wake_lease_blocked";
      runId: string;
      reason: "active_lease" | "insert_conflict" | "claim_race";
    }
  | { kind: "supervisor.wake_lease_released"; runId: string }
  | {
      kind: "supervisor.wake_lease_release_skipped";
      runId: string;
      reason: "missing" | "malformed" | "not_owner";
    }
  | { kind: "supervisor.wake_lease_recovered"; runId: string; reason: "orphaned_completion" | "orphaned_pre_worker" | "orphaned_worker_session_recreated" }
  | {
      kind: "supervisor.wake_skipped";
      runId: string;
      reason: "in_flight" | "lease_blocked" | "quota_wait_future_wake" | "run_not_runnable" | "handoff_in_progress";
    }
  | { kind: "supervisor.wake_scheduled"; runId: string; delayMs: number; source: "volatile" | "lease_retry" }
  | {
      kind: "supervisor.durable_wake_schedule_failed";
      runId: string;
      reason: string;
      source: string | null;
      error: string;
    }
  | { kind: "supervisor.durable_wake_claimed"; runId: string; reason: string; source: string | null }
  | {
      // A due quota wake was claimed (and therefore deleted) but the handler
      // could not act on it. The run keeps its open incident and is left for
      // `resumeElapsedQuotaWaits` to sweep.
      kind: "supervisor.quota_wake_dropped";
      runId: string;
      reason: "run_missing" | "no_open_incident";
      status: string | null;
    }
  | {
      kind: "supervisor.quota_wake_swept";
      runId: string;
      status: string;
      action: "resumed" | "cleared" | "rescheduled";
    };

export type PlanEvent =
  | { kind: "plan.ready"; runId: string; planId: string | null }
  | { kind: "plan.review.started"; runId: string; reviewRunId: string }
  | { kind: "plan.review.finished"; runId: string; reviewRunId: string; status: string }
  | { kind: "plan.review.blocked"; runId: string; reason: string };

export type GoalEvent =
  | {
      kind: GoalPublishedEventKind;
      eventKey: string;
      runId: string;
      goalId: string;
      revision: number;
      leaseGeneration: number;
      snapshot: GoalSnapshot;
    }
  | { kind: "goal.set.started"; runId: string; goalId: string; operationId: string }
  | { kind: "goal.set.refused"; runId: string; goalId: string; operationId: string; reason: string }
  | { kind: "goal.set.failed"; runId: string; goalId: string; operationId: string; reason: string }
  | { kind: "goal.action.started"; runId: string; goalId: string; operationId: string; action: GoalAction }
  | { kind: "goal.action.completed"; runId: string; goalId: string; operationId: string; action: GoalAction; revision: number }
  | { kind: "goal.action.refused"; runId: string; goalId: string; operationId: string; action: GoalAction; reason: string }
  | { kind: "goal.action.failed"; runId: string; goalId: string; operationId: string; action: GoalAction; reason: string }
  | { kind: "goal.reconciliation.completed"; runId: string; goalId: string; workerId: string; revision: number; leaseGeneration: number }
  | { kind: "goal.reconciliation.refused"; runId: string; goalId: string; workerId: string | null; reason: string }
  | { kind: "goal.reconciliation.failed"; runId: string; goalId: string; workerId: string | null; reason: string }
  | { kind: "goal.worker_transferred"; runId: string; goalId: string; previousWorkerId: string | null; workerId: string; leaseGeneration: number }
  | { kind: "goal.stale_lease_ignored"; runId: string; goalId: string; workerId: string; leaseGeneration: number; currentLeaseGeneration: number }
  | { kind: "goal.payload_rejected"; runId: string; goalId: string; workerId: string; reason: string }
  | {
      kind: "goal.plan.derived";
      runId: string;
      goalId: string;
      source: string;
      itemCount: number;
      completedCount: number;
      revision: number;
      trigger: string;
    }
  | { kind: "goal.plan.derivation_skipped"; runId: string; goalId: string | null; reason: string }
  | { kind: "goal.plan.derivation_refused"; runId: string; goalId: string; reason: string }
  | { kind: "goal.plan.derivation_failed"; runId: string; reason: string }
  | { kind: "goal.outbox.recovery_started"; pendingCount: number }
  | { kind: "goal.outbox.recovery_completed"; publishedCount: number; poisonedCount: number }
  | { kind: "goal.outbox.retry_scheduled"; runId: string; goalId: string; revision: number; attempt: number; nextAttemptAt: string }
  | { kind: "goal.outbox.poisoned"; runId: string; goalId: string; revision: number; attempt: number; reason: string }
  | { kind: "goal.history.compacted"; operationCount: number; outboxCount: number; cutoff: string };

export type RecoveryEvent =
  | { kind: "recovery.opened"; runId: string; incidentId: string; recoveryKind: string }
  | { kind: "recovery.attempt"; runId: string; incidentId: string; attempt: number }
  | { kind: "recovery.gave_up"; runId: string; incidentId: string; attempts: number }
  | { kind: "recovery.resolved"; runId: string; incidentId: string }
  | {
      kind: "recovery.quota_wait_preserved";
      runId: string;
      incidentId: string;
      previousStatus: string;
    }
  | {
      kind: "recovery.refused";
      runId: string;
      workerId: string | null;
      reason: "run_missing" | "run_terminal" | "worker_cancelled";
      runStatus: string | null;
    };

export type AccountEvent =
  | { kind: "account.detected"; accountId: string; workerType: string; provider: string; authMode: string }
  | { kind: "account.created"; accountId: string; workerType: string | null; provider: string; authMode: string }
  | { kind: "account.updated"; accountId: string; workerType: string | null; changedKeys: string[] }
  | { kind: "account.deleted"; accountId: string; workerType: string | null }
  | { kind: "account.delete_failed"; accountId: string; workerType: string | null; reason: string }
  | { kind: "account.status_checked"; accountId: string; workerType: string | null; previousStatus?: string | null; status: string | null; source?: string; reason?: string }
  | { kind: "account.auth_started"; accountId: string; operationId: string; workerType: "claude"; previousStatus: string | null; status: "authenticating" }
  | { kind: "account.auth_terminal_ready"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.auth_verifying"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.auth_completed"; accountId: string; operationId: string; workerType: "claude"; status: "available" }
  | { kind: "account.auth_failed"; accountId: string; operationId: string; workerType: "claude"; code: string; reason: string }
  | { kind: "account.auth_cancelled"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.auth_interrupted"; accountId: string; operationId: string; workerType: "claude"; recovered: boolean }
  | { kind: "account.auth_exit_ignored"; accountId: string; operationId: string; workerType: "claude"; reason: "operation_missing" | "operation_replaced" | "operation_not_authenticating" | "cancel_owner_mismatch" }
  | { kind: "account.auth_retry_refused"; accountId: string; operationId: string | null; workerType: "claude"; reason: string }
  | { kind: "account.logout_started"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.logout_completed"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.logout_failed"; accountId: string; operationId: string; workerType: "claude"; reason: string }
  | { kind: "account.logout_refused"; accountId: string; operationId: string | null; workerType: "claude"; reason: string; blockingWorkerCount: number }
  | { kind: "account.remove_started"; accountId: string; operationId: string; workerType: string | null }
  | { kind: "account.remove_completed"; accountId: string; operationId: string; workerType: string | null; profileDataPreserved: true }
  | { kind: "account.remove_refused"; accountId: string; operationId: string | null; workerType: string | null; reason: string; blockingWorkerCount: number }
  | { kind: "account.remove_failed"; accountId: string; operationId: string; workerType: string | null; reason: string }
  | { kind: "account.purge_started"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.purge_completed"; accountId: string; operationId: string; workerType: "claude" }
  | { kind: "account.purge_refused"; accountId: string; operationId: string | null; workerType: "claude"; reason: string; blockingWorkerCount?: number }
  | { kind: "account.purge_failed"; accountId: string; operationId: string; workerType: "claude"; reason: string }
  | {
      kind: "account.credential_selected";
      accountId: string;
      runId?: string;
      workerId?: string;
      workerType: string;
      strategy: string;
      explicit: boolean;
      reason: string;
    }
  | { kind: "account.quota_exhausted"; accountId: string; runId?: string; workerId?: string; workerType: string; reason: string }
  | {
      kind: "account.switch_decision";
      runId?: string;
      workerId?: string;
      workerType: string;
      fromAccountId?: string;
      toAccountId?: string;
      strategy: string;
      reason: string;
    }
  | { kind: "account.usage_recorded"; accountId: string; runId: string; workerId?: string; workerType: string; inputTokens: number; outputTokens: number; costUsd: number }
  | { kind: "account.credential_verdict_recovered"; accountId: string; runId: string; workerId: string; workerType: string; verdict: "live" | "dead"; source: "execution_event" }
  | { kind: "account.login_required"; accountId: string; workerType: string; reason: string };

export type ConversationEvent =
  | {
      kind: "conversation.commit_agent_selected";
      runId: string;
      workerType: string;
      model: string;
      effort: string;
    }
  | { kind: "conversation.awaiting_user"; runId: string; workerId?: string; reason: "worker_requested_input" }
  | { kind: "conversation.read"; runId: string; lastReadAt: string }
  | {
      kind: "conversation.title_updated";
      runId: string;
      source:
        | "agent_session"
        | "agent_transcript"
        | "agent_thread_index"
        | "harness_llm"
        | "harness_fallback"
        | "leak_repair";
      title: string;
    }
  | {
      kind: "conversation.title_sources_missing";
      runId: string;
      workerId: string;
      workerType: string;
      streamCandidateStatus: "not_applicable" | "missing" | "rejected";
      // Named for Claude's transcript, which was the only provider store when
      // this event was added; Codex's thread index reports through it too.
      transcriptCandidateStatus: "not_applicable" | "missing" | "rejected";
      fallback: "initial_title" | "harness_llm";
    }
  | {
      kind: "conversation.title_generation_failed";
      runId: string;
      workerId: string;
      reason: string;
      fallbackTitle: string;
    }
  | {
      kind: "conversation.title_rejected";
      runId: string;
      source: "agent_session" | "agent_transcript" | "agent_thread_index";
      reason: "prompt_leak" | "too_long" | "prompt_echo";
      titleLength: number;
      titlePreview: string;
    }
  | { kind: "conversation.project_moved"; runId: string; previousProjectPath: string | null; projectPath: string }
  | { kind: "conversation.deleted"; runId: string }
  | { kind: "conversation.delete_failed"; runId: string; blockingTable: string | null }
  | {
      kind: "external_session.imported";
      runId: string;
      workerId: string;
      provider: "claude";
      sessionId: string;
      entryCount: number;
    }
  | {
      kind: "external_session.import_failed";
      runId: string;
      workerId: string;
      provider: "claude";
      sessionId: string;
      reason: string;
    }
  | {
      kind: "queue.drain_decision";
      runId: string;
      workerId: string;
      source: string;
      workerStatus: string;
      pendingCount: number;
      decision: "drain" | "skip";
      reason: string;
    }
  | {
      kind: "queue.drain_finished";
      runId: string;
      workerId: string;
      source: string;
      pendingCount: number;
      deliveredCount: number;
    }
  // Escape / force-send interruption control plane. See
  // docs/architecture/lifecycle-observability-and-testing.md.
  | {
      kind: "queue.interrupt_requested";
      runId: string;
      workerId: string | null;
      queuedMessageId: string | null;
      source: string;
    }
  | {
      kind: "queue.interrupt_refused";
      runId: string;
      workerId: string | null;
      queuedMessageId: string | null;
      reason: string;
      source: string;
    }
  | {
      kind: "queue.interrupt_cancelled_turn";
      runId: string;
      workerId: string;
      queuedMessageId: string;
      cancelDurationMs: number;
      source: string;
    }
  | {
      kind: "queue.interrupt_delivery_started";
      runId: string;
      workerId: string;
      queuedMessageId: string;
      totalInterruptLatencyMs: number;
      source: string;
    }
  | {
      kind: "queue.interrupt_delivery_finished";
      runId: string;
      workerId: string;
      queuedMessageId: string;
      totalInterruptLatencyMs: number;
      source: string;
    }
  | {
      kind: "queue.interrupt_delivery_failed";
      runId: string;
      workerId: string | null;
      queuedMessageId: string;
      reason: string;
      deferred: boolean;
      totalInterruptLatencyMs: number;
      source: string;
    };

export type SessionEvent =
  | { kind: "session.created"; runId: string; sessionType: string; actorIds: string[] }
  | { kind: "session.starting"; runId: string; sessionType: string }
  | { kind: "session.status"; runId: string; sessionType: string; prev: string | null; next: string; reason?: string }
  | { kind: "session.input.accepted"; runId: string; targetActorId: string; inputId: string }
  | { kind: "session.input.delivered"; runId: string; targetActorId: string; inputId: string }
  | { kind: "session.input.refused"; runId: string; sessionType: string; code: string; reason: string }
  | { kind: "session.action.refused"; runId: string; sessionType: string; action: string; code: string; reason: string }
  | { kind: "session.stopped"; runId: string; sessionType: string; reason: string }
  | { kind: "process.spawned"; runId: string; workerId: string; pid: number; commandPreview: string }
  | { kind: "process.exited"; runId: string; workerId: string; exitCode: number | null; signal: string | null };

export type ErrorSurfacedEvent = {
  kind: "error.surfaced";
  code: SurfacedErrorCode;
  message: string;
  surface: ErrorSurface;
  runId?: string;
  workerId?: string;
  conversationId?: string;
  accountId?: string;
  path?: string;
  cause?: { name: string; message: string } | null;
};

export type FilesystemEvent =
  | { kind: "filesystem.directory_created"; parentPath: string; path: string }
  | {
      kind: "filesystem.directory_create_failed";
      parentPath: string | null;
      path: string | null;
      reason: string;
    };

export type StreamControlEvent = {
  kind: "stream.resync_required";
  reason: StreamResyncReason;
};

export type StreamResyncReason =
  | "epoch_mismatch"
  | "cursor_evicted"
  | "subscriber_overflow";

export type StreamHeartbeatEvent = {
  kind: "stream.heartbeat";
  emittedAt: string;
};

export type StreamDiagnosticEvent = {
  kind: "stream.subscriber_overflow";
  stream: "events" | "terminal";
  surface: string;
  queuedFrames: number;
  queuedBytes: number;
  rejectedBytes: number;
  runId?: string;
  terminalId?: string;
};

export type ArtifactStreamKindLabel =
  | "execution_events"
  | "supervisor_interventions"
  | "planning_review_findings"
  | "handoff_packets"
  | "worker_entries";

export type ArtifactEvent =
  | {
      kind: "artifact.append_failed";
      runId: string;
      streamKind: ArtifactStreamKindLabel;
      ownerId: string | null;
      seq: number | null;
      reason: string;
    }
  | {
      kind: "artifact.metadata_update_deferred";
      runId: string;
      streamKind: ArtifactStreamKindLabel;
      ownerId: string | null;
      seq: number;
      reason: string;
    }
  | {
      kind: "artifact.metadata_mismatch";
      runId: string;
      streamKind: ArtifactStreamKindLabel;
      ownerId: string | null;
      expectedSeq: number | null;
      observedSeq: number | null;
      detail: string;
    }
  | {
      kind: "artifact.compaction_failed";
      runId: string;
      streamKind: ArtifactStreamKindLabel;
      ownerId: string | null;
      reason: string;
    }
  | {
      kind: "artifact.compaction_completed";
      runId: string;
      streamKind: ArtifactStreamKindLabel;
      ownerId: string | null;
    }
  | {
      kind: "artifact.payload_missing";
      runId: string;
      streamKind: ArtifactStreamKindLabel;
      ownerId: string | null;
      seq: number | null;
      recordId: string | null;
    }
  | {
      kind: "artifact.backfill_failed";
      streamKind: ArtifactStreamKindLabel;
      runId: string;
      recordId: string;
      reason: string;
    };

export type AcpEvent =
  | { kind: "acp.method_started"; workerId: string; method: string; notification: boolean }
  | { kind: "acp.method_completed"; workerId: string; method: string; notification: boolean }
  | { kind: "acp.method_failed"; workerId: string; method: string; notification: boolean; reason: string }
  | { kind: "acp.interaction_requested"; workerId: string; interaction: "permission" | "elicitation"; requestId: number }
  | { kind: "acp.interaction_resolved"; workerId: string; interaction: "permission" | "elicitation"; requestId: number; outcome: string }
  | { kind: "acp.resource_created"; workerId: string; resource: "terminal" | "mcp"; resourceId: string }
  | { kind: "acp.resource_released"; workerId: string; resource: "terminal" | "mcp"; resourceId: string };

export type ClaudeModelGatewayEvent =
  | { kind: "claude_gateway.install_started"; operationId: string }
  | { kind: "claude_gateway.install_completed"; operationId: string; version: string; source: "managed" | "system" }
  | { kind: "claude_gateway.install_failed"; operationId: string; reason: string }
  | { kind: "claude_gateway.service_starting"; operationId: string; mode: "managed" | "external" }
  | { kind: "claude_gateway.service_started"; operationId: string; mode: "managed" | "external" }
  | { kind: "claude_gateway.service_start_failed"; operationId: string; mode: "managed" | "external"; reason: string }
  | { kind: "claude_gateway.service_probe_failed"; mode: "managed" | "external"; reason: string }
  | { kind: "claude_gateway.oauth_probe_failed"; mode: "managed" | "external"; reason: string }
  | { kind: "claude_gateway.service_stopped"; operationId: string; mode: "managed" | "external" }
  | { kind: "claude_gateway.service_stop_failed"; operationId: string; mode: "managed" | "external"; reason: string }
  | { kind: "claude_gateway.oauth_started"; operationId: string }
  | { kind: "claude_gateway.oauth_completed"; operationId: string }
  | { kind: "claude_gateway.oauth_failed"; operationId: string; reason: string }
  | { kind: "claude_gateway.models_refreshed"; operationId: string; count: number }
  | { kind: "claude_gateway.models_refresh_failed"; operationId: string; reason: string }
  | { kind: "claude_gateway.spawn_refused"; runId?: string; workerId?: string; reason: string };

export type NamedEvent =
  | RuntimeEvent
  | AuthEvent
  | WorkerEvent
  | SupervisorEvent
  | PlanEvent
  | GoalEvent
  | RecoveryEvent
  | AccountEvent
  | ConversationEvent
  | SessionEvent
  | FilesystemEvent
  | ErrorSurfacedEvent
  | StreamControlEvent
  | StreamHeartbeatEvent
  | StreamDiagnosticEvent
  | ArtifactEvent
  | AcpEvent
  | ClaudeModelGatewayEvent
  | HandoffEvent;

// Internal: snapshot marker stored in the ring so `Last-Event-ID` resume
// from immediately after a snapshot remains resolvable. The marker itself
// is not emitted as a named SSE frame — it just reserves an id and lets
// the route render a fresh snapshot on replay.
export type SnapshotMarker = {
  kind: "snapshot.marker";
  version: number;
};

export type BufferedEntry =
  | { id: number; streamId: EventStreamId; emittedAt: number; runId: string | null; event: NamedEvent }
  | { id: number; streamId: EventStreamId; emittedAt: number; runId: string | null; event: SnapshotMarker };

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

const RING_CAPACITY = 4096;
let cursor = 0;
let streamEpoch = randomBytes(18).toString("base64url");
let lastHeartbeatAt = 0;
const ring: BufferedEntry[] = [];

function pickRunId(event: NamedEvent | SnapshotMarker): string | null {
  if ("runId" in event && typeof event.runId === "string") {
    return event.runId;
  }
  return null;
}

function append(event: NamedEvent | SnapshotMarker, runIdOverride?: string | null): BufferedEntry {
  cursor += 1;
  const entry = {
    id: cursor,
    streamId: formatEventStreamId(streamEpoch, cursor),
    emittedAt: Date.now(),
    runId: runIdOverride ?? pickRunId(event),
    event,
  } as BufferedEntry;
  ring.push(entry);
  if (ring.length > RING_CAPACITY) {
    ring.shift();
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Public emit API
// ---------------------------------------------------------------------------

/**
 * Emit a named lifecycle event. Records the event in the ring buffer
 * and signals the SSE stream to wake up so subscribed clients receive
 * the frame promptly.
 */
/**
 * Event kinds whose whole payload is the frame itself — the client learns
 * everything it needs from the named event and fetches any bodies through the
 * dedicated content endpoint. These must not force a snapshot rebuild; see
 * `notifyEventStreamSubscribers` in `live-updates.ts`.
 *
 * `worker.entry_appended` fires once per appended transcript entry, so it is
 * by far the hottest emitter in the system. Its contract (`named-events.ts`
 * type below, and `routes/worker-entries.ts`) is explicitly "wake up and pull
 * from afterSeq" — the snapshot carries cursors, not bodies.
 */
const DELTA_ONLY_EVENT_KINDS = new Set<string>([
  "filesystem.directory_created",
  "filesystem.directory_create_failed",
  "worker.entry_appended",
  "worker.plan_boundary_started",
  "worker.plan_updated",
  "worker.plan_rejected",
]);

export function emitNamedEvent(event: NamedEvent): BufferedEntry {
  const entry = append(event);
  notifyEventStreamSubscribers({
    snapshotRelevant: !DELTA_ONLY_EVENT_KINDS.has(event.kind),
  });
  return entry;
}

export function emitStreamHeartbeatIfDue(
  now = Date.now(),
  minimumIntervalMs = 10_000,
): BufferedEntry | null {
  if (lastHeartbeatAt > 0 && now - lastHeartbeatAt < minimumIntervalMs) {
    return null;
  }
  lastHeartbeatAt = now;
  return emitNamedEvent({
    kind: "stream.heartbeat",
    emittedAt: new Date(now).toISOString(),
  });
}

/**
 * Reserve a ring-buffer id for an upcoming `update` snapshot frame.
 * The marker itself carries no data the client renders — its only
 * purpose is to keep the id sequence contiguous so `Last-Event-ID`
 * resume after a snapshot frame can be resolved from the ring buffer.
 *
 * Note: this does NOT notify subscribers; the caller is mid-stream and
 * will write the snapshot frame itself.
 */
export function recordSnapshotMarker(
  version: number,
  runId: string | null = null,
): BufferedEntry {
  return append({ kind: "snapshot.marker", version }, runId);
}

// ---------------------------------------------------------------------------
// Resume / replay
// ---------------------------------------------------------------------------

export type ReplayResult = {
  /** True iff the requested `lastEventId` has fallen out of the ring
   * buffer; the client should re-bootstrap via /api/events?snapshot=1. */
  resyncRequired: boolean;
  /** Stable reason supplied when replay is impossible. */
  resyncReason: StreamResyncReason | null;
  /** Events strictly newer than `lastEventId`, in id order, filtered to
   * the given runId scope when provided. Snapshot markers are excluded
   * from the returned list — the SSE route renders them as fresh
   * snapshots inline rather than replaying their stored form. */
  events: BufferedEntry[];
  /** Current cursor at the time of the call. Clients should resume
   * from this id on the next call after consuming the events. */
  lastEventId: number;
  /** Epoch-aware cursor exposed to SSE clients. */
  lastStreamId: EventStreamId;
};

export type ReplayOptions = {
  /** Filter to events scoped to this runId or unscoped (runId=null in
   * the buffer). Pass null/undefined to receive all events. */
  runId?: string | null;
  /** Return only events at or below this id. Used by the SSE route to
   * catch events that arrive just before a snapshot marker without
   * delivering later events before the marker frame. */
  throughId?: number | null;
  /** Include snapshot markers in the returned events. The SSE route
   * uses this internally; the dev log endpoint does not. */
  includeSnapshotMarkers?: boolean;
};

export function getEventCursor(): number {
  return cursor;
}

export function getEventStreamCursor(): EventStreamId {
  return formatEventStreamId(streamEpoch, cursor);
}

export function getEventStreamEpoch(): string {
  return streamEpoch;
}

export function getNamedEventsSince(
  lastEventId: number | string | null,
  options: ReplayOptions = {},
): ReplayResult {
  const includeMarkers = options.includeSnapshotMarkers === true;
  const runIdFilter = options.runId ?? null;
  const throughId = typeof options.throughId === "number" && Number.isFinite(options.throughId)
    ? Math.floor(options.throughId)
    : null;

  let lastSequence: number | null = null;
  if (typeof lastEventId === "number") {
    lastSequence = Number.isSafeInteger(lastEventId) && lastEventId >= 0
      ? lastEventId
      : null;
  } else if (typeof lastEventId === "string") {
    const parsed = parseEventStreamId(lastEventId);
    if (parsed) {
      if (parsed.epoch !== streamEpoch) {
        return {
          resyncRequired: true,
          resyncReason: "epoch_mismatch",
          events: [],
          lastEventId: cursor,
          lastStreamId: getEventStreamCursor(),
        };
      }
      lastSequence = parsed.sequence;
    } else if (/^\d+$/.test(lastEventId.trim())) {
      const legacySequence = Number(lastEventId);
      lastSequence = Number.isSafeInteger(legacySequence) ? legacySequence : null;
    }
  }

  // A client carrying a `lastEventId` greater than our current cursor
  // means the server cursor was reset under their feet (process
  // restart, ring purge, or simply a client that lied). Either way, we
  // cannot replay backwards from a position we never reached — tell
  // them to resync from /api/events?snapshot=1.
  if (lastSequence !== null && lastSequence > cursor) {
    return {
      resyncRequired: true,
      resyncReason: "cursor_evicted",
      events: [],
      lastEventId: cursor,
      lastStreamId: getEventStreamCursor(),
    };
  }

  if (ring.length === 0) {
    return {
      resyncRequired: false,
      resyncReason: null,
      events: [],
      lastEventId: cursor,
      lastStreamId: getEventStreamCursor(),
    };
  }

  const oldest = ring[0]!.id;
  // A client passing `lastEventId` strictly less than (oldest - 1) has
  // missed at least one event we no longer hold. Tell them to resync.
  // The off-by-one (oldest - 1) is intentional: if the client's last id
  // equals (oldest - 1), the very next event in the buffer is the one
  // they need, which is fine.
  if (lastSequence !== null && lastSequence < oldest - 1) {
    return {
      resyncRequired: true,
      resyncReason: "cursor_evicted",
      events: [],
      lastEventId: cursor,
      lastStreamId: getEventStreamCursor(),
    };
  }

  const events = ring.filter((entry) => {
    if (lastSequence !== null && entry.id <= lastSequence) {
      return false;
    }
    if (throughId !== null && entry.id > throughId) {
      return false;
    }
    if (!includeMarkers && entry.event.kind === "snapshot.marker") {
      return false;
    }
    if (runIdFilter !== null && entry.runId !== null && entry.runId !== runIdFilter) {
      return false;
    }
    return true;
  });

  return {
    resyncRequired: false,
    resyncReason: null,
    events,
    lastEventId: cursor,
    lastStreamId: getEventStreamCursor(),
  };
}

// ---------------------------------------------------------------------------
// Test hooks
// ---------------------------------------------------------------------------

/** @internal — vitest only */
export function __resetNamedEventsForTests() {
  cursor = 0;
  lastHeartbeatAt = 0;
  ring.length = 0;
}

/** @internal — vitest only */
export function __setStreamEpochForTests(epoch: string) {
  formatEventStreamId(epoch, 0);
  streamEpoch = epoch;
}

/** @internal — vitest only */
export function __getRingForTests(): readonly BufferedEntry[] {
  return ring;
}

/** @internal — vitest only */
export function __getRingCapacity() {
  return RING_CAPACITY;
}

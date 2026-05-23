import { describe, expect, it } from "vitest";
import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";

describe("buildLiveWorkerSnapshot", () => {
  it("drops stale live current text from an idle completed direct worker", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-done",
        type: "gemini",
        cwd: "/repo",
        state: "idle",
        currentText: "Final answer that the bridge left in currentText",
        lastText: "Final answer that the bridge left in currentText",
        outputEntries: [
          {
            id: "entry-final",
            type: "message",
            text: "Final answer that the bridge left in currentText",
            timestamp: new Date(0).toISOString(),
          },
        ],
        pendingPermissions: [],
      },
      worker: {
        id: "worker-done",
        runId: "run-done",
        type: "gemini",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [
          {
            id: "entry-final",
            type: "message",
            text: "Final answer that the bridge left in currentText",
            timestamp: new Date(0).toISOString(),
          },
        ],
        currentText: "",
        lastText: "Final answer that the bridge left in currentText",
        bridgeSessionId: "session-done",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-done",
        planId: "plan-done",
        mode: "direct",
        projectPath: "/repo",
        title: "Completed direct run",
        preferredWorkerType: "gemini",
        preferredWorkerModel: "gemini-3.5-flash",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "gemini",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "done",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      state: "idle",
      currentText: "",
      lastText: "Final answer that the bridge left in currentText",
      displayText: "Final answer that the bridge left in currentText",
    }));
  });

  it("drops stale bridge permission requests from completed runs", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-done",
        type: "claude",
        cwd: "/repo",
        state: "idle",
        currentText: "",
        lastText: "Done.",
        outputEntries: [],
        pendingPermissions: [
          {
            requestId: 7,
            requestedAt: new Date(0).toISOString(),
            options: [{ optionId: "allow", kind: "allow", name: "Allow" }],
          },
        ],
      },
      worker: {
        id: "worker-done",
        runId: "run-done",
        type: "claude",
        status: "idle",
        cwd: "/repo",
        outputLog: "Earlier permission request.",
        outputEntries: [],
        currentText: "",
        lastText: "Done.",
        bridgeSessionId: "session-done",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-done",
        planId: "plan-done",
        mode: "direct",
        projectPath: "/repo",
        title: "Completed direct run",
        preferredWorkerType: "claude",
        preferredWorkerModel: "claude-sonnet",
        preferredWorkerEffort: "medium",
        allowedWorkerTypes: "claude",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "done",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot?.pendingPermissions).toEqual([]);
  });

  it("merges bridge output with persisted run metadata for steady-state rendering", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-1",
        type: "codex",
        cwd: "/repo",
        state: "working",
        currentText: "Applying patch",
        lastText: "Looked at page.tsx",
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: "Looked at page.tsx",
            timestamp: new Date(0).toISOString(),
          },
        ],
        pendingPermissions: [
          {
            requestId: 1,
            requestedAt: new Date(0).toISOString(),
            options: [{ optionId: "allow", kind: "allow", name: "Allow" }],
          },
        ],
        contextUsage: {
          fullnessPercent: 42,
        },
      },
      worker: {
        id: "worker-1",
        runId: "run-1",
        type: "codex",
        status: "working",
        cwd: "/repo",
        outputLog: "Persisted output",
        currentText: "",
        lastText: "Persisted last text",
        bridgeSessionId: "session-123",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-1",
        planId: "plan-1",
        mode: "implementation",
        projectPath: "/repo",
        title: "Implement feature",
        preferredWorkerType: "codex",
        preferredWorkerModel: "openai/gpt-5.4",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: "Run-level fallback",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      name: "worker-1",
      state: "working",
      requestedModel: "openai/gpt-5.4",
      requestedEffort: "high",
      sessionId: "session-123",
      sessionMode: "full-access",
      pendingPermissions: [
        expect.objectContaining({ requestId: 1 }),
      ],
      contextUsage: expect.objectContaining({ fullnessPercent: 42 }),
      outputEntries: [
        expect.objectContaining({ id: "entry-1", text: "Looked at page.tsx" }),
      ],
      displayText: "Persisted output\nApplying patch",
      bridgeLastError: null,
      runLastError: "Run-level fallback",
      lastError: null,
      bridgeMissing: false,
    }));
  });

  it("does not show supervisor run failures as live worker errors", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-clean",
        type: "codex",
        cwd: "/repo",
        state: "idle",
        currentText: "",
        lastText: "Implemented the feature.",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: "end_turn",
        lastError: null,
      },
      worker: {
        id: "worker-clean",
        runId: "run-supervisor-error",
        type: "codex",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "",
        lastText: "",
        bridgeSessionId: "session-clean",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-supervisor-error",
        planId: "plan-supervisor-error",
        mode: "implementation",
        projectPath: "/repo",
        title: "Supervisor DNS failure",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "failed",
        failedAt: new Date(),
        lastError: "Cannot connect to API: getaddrinfo ENOTFOUND generativelanguage.googleapis.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      bridgeLastError: null,
      runLastError: "Cannot connect to API: getaddrinfo ENOTFOUND generativelanguage.googleapis.com",
      lastError: null,
    }));
  });

  it("does not show stale bridge stderr as a live worker error while the agent is still active", () => {
    const staleDiagnostic = "\u001b[31mERROR\u001b[0m codex_core::tools::router: error=write_stdin failed: Unknown process id 66670";
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-active",
        type: "codex",
        cwd: "/repo",
        state: "working",
        currentText: "Still applying the patch",
        lastText: "Started implementation",
        outputEntries: [],
        stderrBuffer: [staleDiagnostic],
        stopReason: null,
        lastError: staleDiagnostic,
      },
      worker: {
        id: "worker-active",
        runId: "run-active",
        type: "codex",
        status: "working",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "",
        lastText: "",
        bridgeSessionId: "session-active",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-active",
        planId: "plan-active",
        mode: "implementation",
        projectPath: "/repo",
        title: "Active worker",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      state: "working",
      bridgeLastError: staleDiagnostic,
      lastError: null,
      displayText: "Started implementation\nStill applying the patch",
    }));
  });

  it("keeps persisted completion entries when live bridge output is sparse", () => {
    const startedAt = new Date(0).toISOString();
    const completedAt = new Date(1000).toISOString();
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-sparse-output",
        type: "codex",
        cwd: "/repo",
        state: "working",
        currentText: "Continuing after reading context",
        lastText: "",
        outputEntries: [
          {
            id: "read-start",
            type: "tool_call",
            text: "Read plan.md",
            timestamp: startedAt,
            toolCallId: "call-read-plan",
            toolKind: "read",
            status: "in_progress",
            raw: {
              kind: "read",
              rawInput: {
                command: ["/bin/zsh", "-lc", "sed -n '1,260p' plan.md"],
              },
            },
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
      worker: {
        id: "worker-sparse-output",
        runId: "run-sparse-output",
        type: "codex",
        status: "working",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [
          {
            id: "read-start",
            type: "tool_call",
            text: "Read plan.md",
            timestamp: startedAt,
            toolCallId: "call-read-plan",
            toolKind: "read",
            status: "in_progress",
            raw: {
              kind: "read",
              rawInput: {
                command: ["/bin/zsh", "-lc", "sed -n '1,260p' plan.md"],
              },
            },
          },
          {
            id: "read-done",
            type: "tool_call_update",
            text: "Tool call call-read-plan completed",
            timestamp: completedAt,
            toolCallId: "call-read-plan",
            status: "completed",
            raw: {
              rawOutput: {
                command: ["/bin/zsh", "-lc", "sed -n '1,260p' plan.md"],
                status: "completed",
                exit_code: 0,
              },
              status: "completed",
            },
          },
        ],
        currentText: "",
        lastText: "",
        bridgeSessionId: "session-sparse-output",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-sparse-output",
        planId: "plan-sparse-output",
        mode: "implementation",
        projectPath: "/repo",
        title: "Sparse bridge output",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot?.outputEntries?.map((entry) => entry.id)).toEqual(["read-start", "read-done"]);
  });

  it("falls back to persisted worker state when the bridge no longer returns the worker", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: null,
      worker: {
        id: "worker-2",
        runId: "run-2",
        type: "claude",
        status: "cancelled",
        cwd: "/repo",
        outputLog: "Persisted output",
        outputEntries: [
          {
            id: "entry-2",
            type: "message",
            text: "Finished the task.",
            timestamp: new Date(0).toISOString(),
          },
        ],
        currentText: "",
        lastText: "Finished the task.",
        bridgeSessionId: "session-456",
        bridgeSessionMode: "danger-full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-2",
        planId: "plan-2",
        mode: "implementation",
        projectPath: "/repo",
        title: "Recovered run",
        preferredWorkerType: "claude",
        preferredWorkerModel: "claude-sonnet-4",
        preferredWorkerEffort: "medium",
        allowedWorkerTypes: "claude",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "failed",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      bridgeError: new Error("Get agent failed: 404 not_found"),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      name: "worker-2",
      type: "claude",
      state: "cancelled",
      requestedModel: "claude-sonnet-4",
      requestedEffort: "medium",
      sessionId: "session-456",
      sessionMode: "danger-full-access",
      outputEntries: [
        expect.objectContaining({ id: "entry-2", text: "Finished the task." }),
      ],
      currentText: "",
      lastText: "Finished the task.",
      outputLog: "Persisted output",
      displayText: "Persisted output",
      bridgeMissing: true,
      bridgeLastError: "Get agent failed: 404 not_found",
      runLastError: null,
      lastError: null,
    }));
  });

  it("does not present a failed run with a missing bridge as an active worker", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: null,
      worker: {
        id: "worker-stale-active",
        runId: "run-failed",
        type: "codex",
        status: "working",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "Old in-flight text",
        lastText: "Old in-flight text",
        bridgeSessionId: "session-stale",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-failed",
        planId: "plan-failed",
        mode: "implementation",
        projectPath: "/repo",
        title: "Failed stale worker",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "failed",
        failedAt: new Date(),
        lastError: "Spawn failed: Agent session did not include a session id.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      bridgeError: new Error("Get agent failed: 404 not_found"),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      state: "error",
      lastError: "Spawn failed: Agent session did not include a session id.",
      bridgeMissing: true,
    }));
  });

  it("builds display text from persisted structured entries when the bridge is missing", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: null,
      worker: {
        id: "worker-structured-only",
        runId: "run-structured-only",
        type: "codex",
        status: "cancelled",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [
          {
            id: "message-structured",
            type: "message",
            text: "The worker already finished this implementation.",
            timestamp: new Date(0).toISOString(),
          },
        ],
        currentText: "",
        lastText: "",
        bridgeSessionId: "session-structured",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-structured-only",
        planId: "plan-structured-only",
        mode: "implementation",
        projectPath: "/repo",
        title: "Recovered structured output",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.4",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      bridgeError: new Error("Get agent failed: 404 not_found"),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      lastText: "The worker already finished this implementation.",
      displayText: "The worker already finished this implementation.",
      outputEntries: [
        expect.objectContaining({ id: "message-structured" }),
      ],
    }));
  });

  it("surfaces a diagnostic when a live bridge agent stops without output", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-empty",
        type: "codex",
        cwd: "/repo",
        state: "idle",
        currentText: "",
        lastText: "",
        renderedOutput: "",
        outputEntries: [],
        stopReason: "end_turn",
      },
      worker: {
        id: "worker-empty",
        runId: "run-empty",
        type: "codex",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "",
        lastText: "",
        bridgeSessionId: "session-empty",
        bridgeSessionMode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-empty",
        planId: "plan-empty",
        mode: "direct",
        projectPath: "/repo",
        title: "Empty direct run",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      name: "worker-empty",
      state: "idle",
      lastText: "Agent stopped without producing output. Stop reason: end_turn.",
      displayText: "Agent stopped without producing output. Stop reason: end_turn.",
    }));
  });

  it("surfaces a diagnostic when an idle persisted worker has no bridge output", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: null,
      worker: {
        id: "worker-missing-empty",
        runId: "run-missing-empty",
        type: "codex",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "",
        lastText: "",
        bridgeSessionId: null,
        bridgeSessionMode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-missing-empty",
        planId: "plan-missing-empty",
        mode: "direct",
        projectPath: "/repo",
        title: "Missing empty direct run",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      name: "worker-missing-empty",
      state: "idle",
      lastText: "Worker is idle with no recorded output, and the bridge no longer has a live session for it.",
      displayText: "Worker is idle with no recorded output, and the bridge no longer has a live session for it.",
    }));
  });
});

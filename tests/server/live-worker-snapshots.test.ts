import { describe, expect, it } from "vitest";
import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";

describe("buildLiveWorkerSnapshot", () => {
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
        outputEntriesJson: "",
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
        outputEntriesJson: "[]",
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
        outputEntriesJson: JSON.stringify([
          {
            id: "entry-2",
            type: "message",
            text: "Finished the task.",
            timestamp: new Date(0).toISOString(),
          },
        ]),
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
        outputEntriesJson: JSON.stringify([
          {
            id: "message-structured",
            type: "message",
            text: "The worker already finished this implementation.",
            timestamp: new Date(0).toISOString(),
          },
        ]),
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
        outputEntriesJson: "[]",
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
        outputEntriesJson: "[]",
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

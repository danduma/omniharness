import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendLiveCheckpointDurably,
  boundTextLines,
  classifyLiveMismatch,
  readLiveCheckpointReport,
  redactLiveEvidence,
  scopeEvidenceToOwnedRuns,
  stableTextHash,
} from "./checkpoint-reporter";
import {
  assertMonotonicWorkerSeqs,
  compareQueueState,
  fetchOwnedNamedEvents,
  isWorkerSettledNamedEvent,
  orderNamedEvents,
  parseSnapshotAnchor,
  scopeNamedEventsToOwnedRuns,
} from "./control-plane-oracle";

const cleanupPaths: string[] = [];

afterEach(() => {
  for (const cleanupPath of cleanupPaths.splice(0)) {
    fs.rmSync(cleanupPath, { force: true, recursive: true });
  }
});

describe("live journey checkpoint reporter", () => {
  it("hashes visible text deterministically without retaining it", () => {
    expect(stableTextHash("assistant output")).toMatch(/^[a-f0-9]{16}$/);
    expect(stableTextHash("assistant output")).toBe(stableTextHash("assistant output"));
    expect(stableTextHash("different output")).not.toBe(stableTextHash("assistant output"));
  });

  it("redacts secret keys and bearer-shaped values recursively", () => {
    const redacted = redactLiveEvidence({
      password: "do-not-keep",
      nested: {
        authorization: "Bearer abc123",
        safe: "worker.status",
      },
      values: ["normal", "Bearer another-secret"],
    });

    expect(redacted).toEqual({
      password: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        safe: "worker.status",
      },
      values: ["normal", "[REDACTED]"],
    });
  });

  it("keeps bounded tails instead of unbounded logs", () => {
    expect(boundTextLines("one\ntwo\nthree\nfour", 2)).toBe("three\nfour");
    expect(boundTextLines("one\ntwo", 4)).toBe("one\ntwo");
  });

  it("appends redacted checkpoints durably without losing earlier steps", () => {
    const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-live-report-"));
    cleanupPaths.push(reportRoot);
    const reportPath = path.join(reportRoot, "checkpoints.jsonl");

    appendLiveCheckpointDurably(reportPath, {
      step: "created-A",
      timestamp: "2026-07-21T12:00:00.000Z",
      runId: "run-a",
      visible: { transcriptHash: "abc", password: "must-not-remain" },
      server: { anchor: 10, authorization: "Bearer must-not-remain" },
      mismatch: null,
    });
    appendLiveCheckpointDurably(reportPath, {
      step: "switched-B-to-A",
      timestamp: "2026-07-21T12:00:01.000Z",
      runId: "run-a",
      visible: { transcriptHash: "def" },
      server: { anchor: 12 },
      mismatch: null,
    });

    const report = readLiveCheckpointReport(reportPath);
    expect(report.map((checkpoint) => checkpoint.step)).toEqual([
      "created-A",
      "switched-B-to-A",
    ]);
    expect(report[0]?.visible).toEqual({
      transcriptHash: "abc",
      password: "[REDACTED]",
    });
    expect(report[0]?.server).toEqual({
      anchor: 10,
      authorization: "[REDACTED]",
    });
    expect(fs.statSync(reportPath).mode & 0o777).toBe(0o600);
  });

  it("keeps evidence only for manifest-owned runs", () => {
    const records = [
      { runId: "run-a", kind: "worker.spawned" },
      { runId: "unrelated", kind: "worker.status" },
      { runId: null, kind: "gateway.status" },
    ];
    expect(scopeEvidenceToOwnedRuns(records, ["run-a"])).toEqual([records[0]]);
  });

  it.each([
    [
      {
        namedDecisionPresent: false,
        persistedStateMatchesDecision: false,
        workerStreamContainsOutput: false,
        clientStateMatchesServer: false,
        visibleStateMatchesClient: false,
      },
      "control_plane_missing_decision",
    ],
    [
      {
        namedDecisionPresent: true,
        persistedStateMatchesDecision: false,
        workerStreamContainsOutput: false,
        clientStateMatchesServer: false,
        visibleStateMatchesClient: false,
      },
      "persistence_finalization_gap",
    ],
    [
      {
        namedDecisionPresent: true,
        persistedStateMatchesDecision: true,
        workerStreamContainsOutput: false,
        clientStateMatchesServer: false,
        visibleStateMatchesClient: false,
      },
      "stream_delivery_gap",
    ],
    [
      {
        namedDecisionPresent: true,
        persistedStateMatchesDecision: true,
        workerStreamContainsOutput: true,
        clientStateMatchesServer: false,
        visibleStateMatchesClient: false,
      },
      "client_state_mismatch",
    ],
    [
      {
        namedDecisionPresent: true,
        persistedStateMatchesDecision: true,
        workerStreamContainsOutput: true,
        clientStateMatchesServer: true,
        visibleStateMatchesClient: false,
      },
      "visible_affordance_mismatch",
    ],
    [
      {
        namedDecisionPresent: true,
        persistedStateMatchesDecision: true,
        workerStreamContainsOutput: true,
        clientStateMatchesServer: true,
        visibleStateMatchesClient: true,
      },
      null,
    ],
  ] as const)("classifies the first failing boundary", (input, expected) => {
    expect(classifyLiveMismatch(input)).toBe(expected);
  });
});

describe("live journey control-plane oracle", () => {
  it("parses a canonical snapshot anchor and rejects missing or invalid anchors", () => {
    expect(parseSnapshotAnchor("42")).toBe(42);
    expect(() => parseSnapshotAnchor(null)).toThrow(/anchor/i);
    expect(() => parseSnapshotAnchor("not-a-number")).toThrow(/anchor/i);
  });

  it("keeps only owned named events and orders them deterministically", () => {
    const records = [
      { id: 3, emittedAt: "2026-07-13T20:00:03.000Z", runId: "run-a", event: { kind: "worker.status" } },
      { id: 1, emittedAt: "2026-07-13T20:00:01.000Z", runId: "other", event: { kind: "worker.spawned" } },
      { id: 2, emittedAt: "2026-07-13T20:00:02.000Z", runId: "run-a", event: { kind: "worker.spawned" } },
    ];
    expect(orderNamedEvents(scopeNamedEventsToOwnedRuns(records, ["run-a"])).map((record) => record.id)).toEqual([2, 3]);
  });

  it("reads the global event cursor once before scoping events to owned runs", async () => {
    const requestedUrls: string[] = [];
    const request = {
      get: async (url: string) => {
        requestedUrls.push(url);
        return {
          ok: () => true,
          json: async () => ({
            events: [
              { id: 43, emittedAt: "2026-07-13T20:00:03.000Z", runId: "run-b", event: { kind: "worker.terminal" } },
              { id: 41, emittedAt: "2026-07-13T20:00:01.000Z", runId: "other", event: { kind: "worker.spawned" } },
              { id: 42, emittedAt: "2026-07-13T20:00:02.000Z", runId: "run-a", event: { kind: "worker.spawned" } },
            ],
          }),
        };
      },
    } as unknown as APIRequestContext;

    const events = await fetchOwnedNamedEvents(request, {
      schemaVersion: 1,
      journeyId: "journey",
      createdAt: "2026-07-13T20:00:00.000Z",
      projectPath: "/tmp/journey",
      runs: [
        { id: "run-a", label: "A", createdAt: "2026-07-13T20:00:00.000Z" },
        { id: "run-b", label: "B", createdAt: "2026-07-13T20:00:00.000Z" },
      ],
    }, 40);

    expect(requestedUrls).toEqual(["/api/events/log?since=40"]);
    expect(events.map((event) => event.id)).toEqual([42, 43]);
  });

  it("treats resumable idle transitions and terminal transitions as settled worker decisions", () => {
    expect(isWorkerSettledNamedEvent({
      id: 1,
      emittedAt: "2026-07-13T20:00:01.000Z",
      runId: "run-a",
      event: { kind: "worker.status", prev: "working", next: "idle" },
    })).toBe(true);
    expect(isWorkerSettledNamedEvent({
      id: 2,
      emittedAt: "2026-07-13T20:00:02.000Z",
      runId: "run-b",
      event: { kind: "worker.terminal", status: "cancelled" },
    })).toBe(true);
    expect(isWorkerSettledNamedEvent({
      id: 3,
      emittedAt: "2026-07-13T20:00:03.000Z",
      runId: "run-c",
      event: { kind: "worker.status", prev: "starting", next: "working" },
    })).toBe(false);
  });

  it("requires strictly increasing worker stream sequences", () => {
    expect(assertMonotonicWorkerSeqs([{ seq: 1 }, { seq: 2 }, { seq: 9 }])).toBe(9);
    expect(() => assertMonotonicWorkerSeqs([{ seq: 1 }, { seq: 1 }])).toThrow(/sequence/i);
    expect(() => assertMonotonicWorkerSeqs([{ seq: 2 }, { seq: 1 }])).toThrow(/sequence/i);
  });

  it("compares pending queue identity and status without depending on order", () => {
    expect(compareQueueState(
      [{ id: "q2", status: "delivering" }, { id: "q1", status: "pending" }],
      [{ id: "q1", status: "pending" }, { id: "q2", status: "delivering" }],
    )).toEqual({ matches: true, mismatches: [] });
    expect(compareQueueState(
      [{ id: "q1", status: "pending" }],
      [{ id: "q1", status: "delivering" }],
    )).toEqual({ matches: false, mismatches: ["q1: visible=pending server=delivering"] });
  });
});

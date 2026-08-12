/**
 * Real subprocess kill + respawn. Unlike the in-process scenarios
 * which simulate restart via `simulateRestart()` (ring-buffer reset),
 * this one spawns a real Node child, SIGTERMs it, and starts a fresh
 * child against the same OMNIHARNESS_ROOT.
 *
 * Asserts:
 *  - the new process comes up with a fresh ring buffer (cursor reset),
 *  - sqlite state survives the restart,
 *  - a client carrying a stale Last-Event-ID receives
 *    `stream.resync_required`, not a silent miss,
 *  - the run row created before the restart is still observable after.
 *
 * This is the "for real" version of the chaos contract. Marked slower
 * (subprocess boot is ~1s on a warm cache).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { startSubprocessHarness, type SubprocessHandle } from "../harness/subprocess";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

let server: SubprocessHandle;
let client: LifecycleClient;

beforeEach(async () => {
  server = await startSubprocessHarness();
  client = new LifecycleClient({
    baseUrl: () => server.baseUrl,
    chaos: new Chaos(0xDEAD, NO_CHAOS),
  });
}, 45_000);

afterEach(async () => {
  await client?.close();
  await server?.stop();
});

describe("lifecycle harness — real subprocess restart", () => {
  it("survives a SIGTERM/respawn: sqlite persists, ring resets, client gets resync", { timeout: 90_000 }, async () => {
    // Create a conversation via the real HTTP surface in the subprocess.
    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "real-restart probe" }),
    });
    // The subprocess has no bridge mocking, so spawnAgent will fail
    // post-insert. That's fine — we only need the run row, which is
    // inserted before the spawn call. Accept any 2xx/5xx outcome.
    expect([200, 500]).toContain(createRes.status);

    // Subscribe and observe the initial snapshot.
    await client.bootstrapSnapshot();
    await client.subscribe({});
    const beforeRestartId = client.resumeIdNow();

    // Confirm the run row exists pre-restart via /api/events?snapshot.
    const preSnap = await client.fetch("/api/events?snapshot=1&persisted=1");
    const preBody = (await preSnap.json()) as { runs: Array<{ id: string }> };
    expect(preBody.runs.length).toBeGreaterThan(0);
    const persistedRunId = preBody.runs[0]!.id;

    // Real restart.
    client.dropSse();
    await server.restart();

    // The new process has a fresh ring buffer (cursor=0). A client
    // resuming from any pre-restart id must see stream.resync_required.
    await client.subscribe({ resumeFrom: beforeRestartId ?? "9999" });
    const resync = await client.waitFor("stream.resync_required", { timeoutMs: 10_000 });
    expect(resync.payload).toMatchObject({ reason: "epoch_mismatch" });

    // Sqlite survived: the same run is still in the snapshot from the
    // new process.
    const postSnap = await client.fetch("/api/events?snapshot=1&persisted=1");
    const postBody = (await postSnap.json()) as { runs: Array<{ id: string }> };
    expect(postBody.runs.map((r) => r.id)).toContain(persistedRunId);
  });

  it("rebuilds an ACP plan from the unified worker stream after a real restart", { timeout: 90_000 }, async () => {
    const runId = "run-plan-real-restart";
    const workerId = `${runId}-worker-1`;
    const streamDir = join(server.omniRoot, "run-data", runId);
    const boundaryTimestamp = "2026-08-10T12:00:00.000Z";
    const planTimestamp = "2026-08-10T12:00:01.000Z";
    mkdirSync(streamDir, { recursive: true });
    writeFileSync(join(streamDir, `${workerId}.jsonl`), `${[
      {
        id: "restart-boundary",
        seq: 1,
        type: "system_note",
        text: "",
        timestamp: boundaryTimestamp,
        acpSessionId: "session-restart",
        planProjection: "session_reset",
        diagnosticOnly: true,
      },
      {
        id: "restart-plan",
        seq: 2,
        type: "plan",
        text: "Verify restart",
        timestamp: planTimestamp,
        acpSessionId: "session-restart",
        planProjection: "accepted_core",
        normalizedPlan: [{
          id: "0",
          content: "Verify restart",
          priority: "high",
          status: "in_progress",
          order: 0,
        }],
      },
    ].map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const beforeResponse = await client.fetch(
      `/api/workers/${encodeURIComponent(workerId)}/entries?view=plan&runId=${encodeURIComponent(runId)}`,
    );
    expect(beforeResponse.status).toBe(200);
    const before = await beforeResponse.json() as { plan: unknown };

    await client.subscribe({ runId, resumeFrom: "pre-restart:9999" });
    client.dropSse();
    await server.restart();
    await client.subscribe({ runId, resumeFrom: "pre-restart:9999" });
    await client.waitFor("stream.resync_required", { timeoutMs: 10_000 });

    const bootstrap = await client.fetch(`/api/events?snapshot=1&persisted=1&runId=${encodeURIComponent(runId)}`);
    expect(bootstrap.status).toBe(200);
    const afterResponse = await client.fetch(
      `/api/workers/${encodeURIComponent(workerId)}/entries?view=plan&runId=${encodeURIComponent(runId)}`,
    );
    expect(afterResponse.status).toBe(200);
    const after = await afterResponse.json() as { plan: unknown };

    expect(after.plan).toEqual(before.plan);
    expect(after.plan).toMatchObject({
      acpSessionId: "session-restart",
      lastEntrySeq: 2,
      updatedAt: planTimestamp,
      items: [{ id: "1:0", content: "Verify restart", status: "in_progress" }],
    });
  });
});

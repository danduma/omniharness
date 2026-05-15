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
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle harness — real subprocess restart", () => {
  it("survives a SIGTERM/respawn: sqlite persists, ring resets, client gets resync", { timeout: 60_000 }, async () => {
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
    expect(resync.payload).toMatchObject({ reason: "id_out_of_buffer" });

    // Sqlite survived: the same run is still in the snapshot from the
    // new process.
    const postSnap = await client.fetch("/api/events?snapshot=1&persisted=1");
    const postBody = (await postSnap.json()) as { runs: Array<{ id: string }> };
    expect(postBody.runs.map((r) => r.id)).toContain(persistedRunId);
  });
});

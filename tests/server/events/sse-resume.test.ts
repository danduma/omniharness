/**
 * Verifies the SSE protocol contract of /api/events:
 *   - every frame carries an `id:` field
 *   - `Last-Event-ID` resume replays missed named events
 *   - an out-of-range `Last-Event-ID` triggers stream.resync_required
 *
 * These tests open the route's ReadableStream and read enough frames to
 * make the assertion, then abort. They do NOT exercise the full poll
 * loop — that would require booting the supervisor runtime. The point
 * here is the SSE envelope behaviour, which is independent of payload
 * content.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/guards", () => ({
  requireApiSession: vi.fn().mockResolvedValue({ response: null, account: { id: "test", role: "admin" } }),
}));
vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: vi.fn().mockResolvedValue(undefined),
}));
import { GET } from "@/app/api/events/route";
import {
  __resetNamedEventsForTests,
  emitNamedEvent,
} from "@/server/events/named-events";

function makeStreamRequest(headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const req = new NextRequest(new URL("/api/events", "http://localhost").toString(), {
    headers,
    signal: controller.signal,
  });
  return { req, controller };
}

async function readUntil(
  stream: ReadableStream<Uint8Array>,
  predicate: (buffered: string) => boolean,
  timeoutMs = 3_000,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value?: Uint8Array; done: boolean }>((resolve) =>
        setTimeout(() => resolve({ done: false, value: undefined }), 100),
      ),
    ]);
    if (done) break;
    if (value) {
      buffered += decoder.decode(value, { stream: true });
      if (predicate(buffered)) {
        await reader.cancel();
        return buffered;
      }
    }
  }
  await reader.cancel();
  return buffered;
}

describe("/api/events SSE resume", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("replays missed named events when Last-Event-ID is within the ring buffer", async () => {
    const first = emitNamedEvent({
      kind: "worker.spawned",
      runId: "r-test",
      workerId: "w1",
      workerType: "agent",
    });
    emitNamedEvent({
      kind: "worker.status",
      runId: "r-test",
      workerId: "w1",
      prev: "starting",
      next: "running",
    });
    emitNamedEvent({
      kind: "worker.terminal",
      runId: "r-test",
      workerId: "w1",
      status: "completed",
    });

    const { req, controller } = makeStreamRequest({
      "Last-Event-ID": String(first.id),
    });
    const res = await GET(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = res.body!;
    const buffered = await readUntil(body, (text) => text.includes("event: worker.terminal"));
    controller.abort();

    expect(buffered).toContain("event: worker.status");
    expect(buffered).toContain("event: worker.terminal");
    expect(buffered).not.toContain("event: worker.spawned");
    // Every named-event frame must carry an id: line.
    const statusIdMatch = buffered.match(/id: (\d+)\nevent: worker\.status/);
    const terminalIdMatch = buffered.match(/id: (\d+)\nevent: worker\.terminal/);
    expect(statusIdMatch?.[1]).toBeDefined();
    expect(terminalIdMatch?.[1]).toBeDefined();
    expect(Number(terminalIdMatch![1])).toBeGreaterThan(Number(statusIdMatch![1]));
  });

  it("emits stream.resync_required when Last-Event-ID predates the ring", async () => {
    // Push enough events to roll the ring (capacity 500).
    for (let i = 0; i < 520; i++) {
      emitNamedEvent({
        kind: "worker.status",
        runId: "r-test",
        workerId: "w1",
        prev: "running",
        next: `tick-${i}`,
      });
    }
    const { req, controller } = makeStreamRequest({
      "Last-Event-ID": "1",
    });
    const res = await GET(req);
    const buffered = await readUntil(res.body!, (text) => text.includes("event: stream.resync_required"));
    controller.abort();

    expect(buffered).toContain("event: stream.resync_required");
    expect(buffered).toMatch(/id: \d+\nevent: stream\.resync_required/);
  });
});

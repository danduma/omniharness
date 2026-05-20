import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, processSessions, runs, workerCounters, workers } from "@/server/db/schema";
import * as eventsRoute from "@/app/api/events/route";
import * as conversationsRoute from "@/app/api/conversations/route";
import * as messagesRoute from "@/app/api/conversations/[id]/messages/route";
import { readWorkerOutputEntries, __resetOutputStoreCachesForTests } from "@/server/workers/output-store";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

let server: LifecycleServer;
let client: LifecycleClient;

async function cleanDb() {
  await db.delete(processSessions);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  __resetOutputStoreCachesForTests();
  await cleanDb();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/conversations", module: conversationsRoute },
      { pattern: "/api/conversations/:id/messages", module: messagesRoute },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(11, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await cleanDb();
});

describe("lifecycle harness — process session basic", () => {
  it("creates a process session, streams output, accepts stdin, and snapshots capabilities", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionType: "process",
        command: `${process.execPath} -e "process.stdout.write('ready\\\\n'); process.stdin.once('data', d => { process.stdout.write('got:' + d.toString()); process.exit(0); })"`,
        projectPath: process.cwd(),
      }),
    });
    expect(createRes.status).toBe(200);
    const { runId } = await createRes.json() as { runId: string };

    await client.waitFor("session.status", {
      predicate: (frame) => (frame.payload as { runId?: string; next?: string } | null)?.runId === runId
        && (frame.payload as { next?: string } | null)?.next === "running",
      timeoutMs: 10_000,
    });

    const sendRes = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    });
    expect(sendRes.status).toBe(200);

    await client.waitFor("process.exited", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });

    const processRow = await db.select().from(processSessions).where(eq(processSessions.runId, runId)).get();
    expect(processRow?.status).toBe("exited");
    const entries = await readWorkerOutputEntries(runId, processRow!.workerId);
    expect(entries.some((entry) => entry.channel === "stdout" && entry.text.includes("ready"))).toBe(true);
    expect(entries.some((entry) => entry.channel === "stdin" && entry.text === "hello")).toBe(true);
    expect(entries.some((entry) => entry.channel === "stdout" && entry.text.includes("got:hello"))).toBe(true);

    const snapshotRes = await client.fetch(`/api/events?snapshot=1&persisted=1&runId=${encodeURIComponent(runId)}`);
    expect(snapshotRes.status).toBe(200);
    const snapshot = await snapshotRes.json() as { sessions?: Array<{ runId: string; sessionType: string; capabilities: string[] }> };
    const session = snapshot.sessions?.find((candidate) => candidate.runId === runId);
    expect(session?.sessionType).toBe("process");
    expect(session?.capabilities).not.toContain("send_input");
  });
});

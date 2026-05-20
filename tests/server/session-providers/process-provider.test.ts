import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, processSessions, runs, workerCounters, workers } from "@/server/db/schema";
import { __getRingForTests, __resetNamedEventsForTests } from "@/server/events/named-events";
import { processSessionProvider } from "@/server/session-providers/process-provider";
import { getDefaultCapabilities } from "@/server/session-providers/capabilities";
import { parseCommandString, redactCommandPreview } from "@/server/session-providers/process-store";
import { readWorkerOutputEntries, __resetOutputStoreCachesForTests } from "@/server/workers/output-store";

async function cleanDb() {
  await db.delete(processSessions);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(read: () => T | Promise<T>, predicate: (value: T) => boolean, timeoutMs = 2_000) {
  const startedAt = Date.now();
  let latest = await read();
  while (!predicate(latest)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for expected state. Last value: ${JSON.stringify(latest)}`);
    }
    await delay(20);
    latest = await read();
  }
  return latest;
}

describe("process session provider", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    __resetOutputStoreCachesForTests();
    await cleanDb();
  });

  afterEach(async () => {
    await cleanDb();
  });

  it("parses and redacts process commands", () => {
    expect(parseCommandString(`python -c "print('hello world')" --token abc`)).toEqual([
      "python",
      "-c",
      "print('hello world')",
      "--token",
      "abc",
    ]);
    expect(redactCommandPreview(["python", "script.py", "--token", "abc"])).toBe("python script.py <redacted> <redacted>");
  });

  it("streams stdout and stderr into the unified worker stream", async () => {
    const result = await processSessionProvider.create({
      sessionType: "process",
      command: `${process.execPath} -e "process.stdout.write('out\\\\n'); process.stderr.write('err\\\\n')"`,
      projectPath: process.cwd(),
    });

    const runId = String(result.runId);
    const row = await waitFor(
      () => db.select().from(processSessions).where(eq(processSessions.runId, runId)).get(),
      (session) => session?.status === "exited",
    );
    const entries = await readWorkerOutputEntries(runId, row!.workerId);

    expect(entries.map((entry) => entry.channel)).toContain("stdout");
    expect(entries.map((entry) => entry.channel)).toContain("stderr");
    expect(entries.some((entry) => entry.text.includes("out"))).toBe(true);
    expect(entries.some((entry) => entry.text.includes("err"))).toBe(true);
    expect(__getRingForTests().map((entry) => entry.event.kind)).toContain("process.exited");
  });

  it("delivers stdin only while the process is running", async () => {
    const result = await processSessionProvider.create({
      sessionType: "process",
      command: `${process.execPath} -e "process.stdin.once('data', d => { process.stdout.write('got:' + d.toString()); process.exit(0); })"`,
      projectPath: process.cwd(),
    });

    const runId = String(result.runId);
    await waitFor(
      () => db.select().from(processSessions).where(eq(processSessions.runId, runId)).get(),
      (session) => session?.status === "running",
    );

    await processSessionProvider.sendInput({ runId, content: "hello" });
    const row = await waitFor(
      () => db.select().from(processSessions).where(eq(processSessions.runId, runId)).get(),
      (session) => session?.status === "exited",
    );
    const entries = await readWorkerOutputEntries(runId, row!.workerId);

    expect(entries.some((entry) => entry.type === "user_input" && entry.text === "hello")).toBe(true);
    expect(entries.some((entry) => entry.text.includes("got:hello"))).toBe(true);
    expect(__getRingForTests().map((entry) => entry.event.kind)).toEqual(
      expect.arrayContaining(["session.input.accepted", "session.input.delivered"]),
    );

    await expect(processSessionProvider.sendInput({ runId, content: "late" })).rejects.toThrow("not accepting input");
  });

  it("reports process capabilities from status", () => {
    expect(getDefaultCapabilities({ runId: "r1", sessionType: "process", status: "running" })).toContain("send_input");
    expect(getDefaultCapabilities({ runId: "r1", sessionType: "process", status: "exited" })).not.toContain("send_input");
  });
});

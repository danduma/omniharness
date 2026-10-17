import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAppDataPath } from "@/server/app-root";
import {
  __resetOutputStoreCachesForTests,
  appendWorkerEntry,
  readWorkerOutputEntries,
} from "@/server/workers/output-store";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import type { WorkerEntry } from "@/server/workers/entries-types";

const testRuns: string[] = [];

afterEach(async () => {
  for (const runId of testRuns.splice(0)) {
    await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
  }
  __resetOutputStoreCachesForTests();
});

function fixture() {
  const runId = `response-fallback-${randomUUID()}`;
  const workerId = `${runId}-worker-1`;
  testRuns.push(runId);
  return {
    runId,
    workerId,
    async append(type: WorkerEntry["type"], text: string) {
      await appendWorkerEntry(runId, workerId, {
        id: randomUUID(), type, text, timestamp: new Date().toISOString(),
      });
    },
    read: () => readWorkerOutputEntries(runId, workerId),
  };
}

describe("ask response fallback", () => {
  it.each([null, { outputEntries: [] }])("keeps separate persisted messages when the snapshot is %j", async (snapshot) => {
    const f = fixture();
    await f.append("user_input", "Write the plan");
    const messages = ["Four research agents are inventorying screens.", "Waiting on the inventories.", "Writing the plan now."];
    for (const text of messages) {
      await f.append("message", text);
      await f.append("tool_call", "Research");
    }
    const before = await f.read();
    await appendAskResponseFallbackEntry({ ...f, snapshot, responseText: messages.join("") });
    expect(await f.read()).toEqual(before);
  });

  it("finds persisted output before a long tail of tool updates", async () => {
    const f = fixture();
    await f.append("user_input", "Go");
    await f.append("message", "Writing the plan now.");
    for (let i = 0; i < 205; i++) await f.append("tool_call_update", `Progress ${i}`);
    const before = await f.read();
    await appendAskResponseFallbackEntry({ ...f, snapshot: null, responseText: "Writing the plan now." });
    expect(await f.read()).toEqual(before);
  });

  it.each(["user_input", "supervisor_input"] as const)("preserves a new response after a later %s", async (type) => {
    const f = fixture();
    await f.append("message", "An earlier answer");
    await f.append(type, "Next task");
    await f.append("tool_call", "Read a file");
    await appendAskResponseFallbackEntry({ ...f, snapshot: null, responseText: "The new answer" });
    expect((await f.read()).at(-1)).toMatchObject({
      type: "message", text: "The new answer", raw: { source: "ask_response_fallback" },
    });
  });

  it("persists a response once when no streamed messages exist", async () => {
    const f = fixture();
    await appendAskResponseFallbackEntry({ ...f, snapshot: null, responseText: "A real answer" });
    await appendAskResponseFallbackEntry({ ...f, snapshot: null, responseText: "A real answer" });
    expect((await f.read()).map((e) => e.text)).toEqual(["A real answer"]);
  });
});

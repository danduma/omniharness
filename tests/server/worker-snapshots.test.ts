import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
  parseLegacyOutputEntriesJson,
} from "@/server/workers/output-store";

let workspace: string;
let originalRoot: string | undefined;

beforeEach(async () => {
  originalRoot = process.env.OMNIHARNESS_ROOT;
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "omni-output-store-"));
  process.env.OMNIHARNESS_ROOT = workspace;
});

afterEach(async () => {
  process.env.OMNIHARNESS_ROOT = originalRoot;
  await fs.rm(workspace, { recursive: true, force: true });
});

describe("worker output entry persistence", () => {
  it("round-trips entries through the on-disk JSONL store", async () => {
    const entries = [
      { id: "entry-1", type: "message" as const, text: "hello", timestamp: new Date(0).toISOString() },
      { id: "entry-2", type: "message" as const, text: "world", timestamp: new Date(1).toISOString() },
    ];

    await writeWorkerOutputEntries("run-1", "worker-1", entries);
    expect(await readWorkerOutputEntries("run-1", "worker-1")).toEqual(entries);
  });

  it("returns an empty array when no entries have been written", async () => {
    expect(await readWorkerOutputEntries("run-x", "worker-x")).toEqual([]);
  });

  it("truncates verbose raw command output before persisting history", async () => {
    const fullOutput = Array.from({ length: 80 }, (_, index) => `line-${String(index + 1).padStart(2, "0")}`).join("\n");
    const entries = [
      {
        id: "entry-read-file",
        type: "tool_call_update" as const,
        text: `Tool call completed: ${fullOutput}`,
        timestamp: new Date(0).toISOString(),
        toolCallId: "call-read-file",
        status: "completed",
        raw: {
          rawOutput: {
            formatted_output: fullOutput,
            stdout: fullOutput,
            aggregated_output: fullOutput,
          },
          content: [{ type: "content", content: { type: "text", text: fullOutput } }],
        },
      },
    ];

    await writeWorkerOutputEntries("run-2", "worker-2", entries);
    const [persisted] = await readWorkerOutputEntries("run-2", "worker-2");
    const raw = persisted.raw as {
      rawOutput: { formatted_output: string; stdout: string; aggregated_output: string };
      content: Array<{ content: { text: string } }>;
    };
    expect(raw.rawOutput.formatted_output).toContain("line-01");
    expect(raw.rawOutput.formatted_output).toContain("line-80");
    expect(raw.rawOutput.formatted_output).toContain("omitted");
    expect(raw.rawOutput.formatted_output).not.toContain("line-40");
    expect(persisted.text).toContain("omitted");
    expect(persisted.text).not.toContain("line-40");
    expect(raw.content[0].content.text).toBe(raw.rawOutput.formatted_output);
  });

  it("parses legacy brotli-compressed DB blobs for migration paths", () => {
    const entries = [{ id: "legacy", type: "message" as const, text: "x", timestamp: new Date(0).toISOString() }];
    const legacy = JSON.stringify(entries);
    expect(parseLegacyOutputEntriesJson(legacy)).toEqual(entries);
    expect(parseLegacyOutputEntriesJson("")).toEqual([]);
    expect(parseLegacyOutputEntriesJson(null)).toEqual([]);
  });
});

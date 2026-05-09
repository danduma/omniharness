import { mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendOutputEntry,
  openAgentOutputArchive,
  summarizeToolCallUpdate,
} from "@/server/agent-runtime/output-store";
import type { AgentRecord } from "@/server/agent-runtime/types";

describe("agent runtime output store", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function makeTempRoot() {
    const root = join(tmpdir(), `omniharness-output-store-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    tempRoots.push(root);
    return root;
  }

  it("keeps giant tool update summaries compact for display and archive storage", () => {
    const verboseOutput = [
      "```sh",
      ...Array.from({ length: 20_000 }, (_, index) => `./src/file-${index}.ts:${index}: ${"x".repeat(80)}`),
      "```",
    ].join("\n");
    const summary = summarizeToolCallUpdate({
      sessionUpdate: "tool_call_update",
      toolCallId: "call_verbose",
      status: "updated",
      content: [
        {
          type: "content",
          content: {
            type: "text",
            text: verboseOutput,
          },
        },
      ],
      rawOutput: {
        formatted_output: verboseOutput,
      },
    });

    expect(summary.length).toBeLessThanOrEqual(2_100);
    expect(summary).toContain("truncated");

    const dataDir = makeTempRoot();
    const outputArchive = openAgentOutputArchive({ dataDir, name: "verbose-worker" });
    const record = {
      outputArchive,
      outputEntries: [],
      activeOutputEntryId: null,
    } as unknown as AgentRecord;

    appendOutputEntry(record, {
      type: "tool_call_update",
      text: summary,
      toolCallId: "call_verbose",
      status: "updated",
      raw: {
        sessionUpdate: "tool_call_update",
        toolCallId: "call_verbose",
        status: "updated",
        content: [
          {
            type: "content",
            content: {
              type: "text",
              text: verboseOutput,
            },
          },
        ],
        rawOutput: {
          formatted_output: verboseOutput,
        },
      },
    });

    const archiveLine = readFileSync(outputArchive.filePath, "utf8").trim();
    expect(Buffer.byteLength(archiveLine)).toBeLessThan(35_000);
    expect(record.outputEntries[0]?.text.length).toBeLessThanOrEqual(2_100);
    expect(JSON.stringify(record.outputEntries[0]?.raw).length).toBeLessThan(20_000);
  });
});

import { describe, expect, it } from "vitest";
import { parseWorkerOutputEntries, serializeWorkerOutputEntries } from "@/server/workers/snapshots";

describe("worker output entry persistence", () => {
  it("keeps tiny output entry payloads as plain JSON", () => {
    const entries = [
      {
        id: "entry-small",
        type: "message" as const,
        text: "hello",
        timestamp: new Date(0).toISOString(),
      },
    ];

    const serialized = serializeWorkerOutputEntries(entries);

    expect(serialized.trim().startsWith("[")).toBe(true);
    expect(parseWorkerOutputEntries(serialized)).toEqual(entries);
  });

  it("compresses large output entry payloads and parses them back", () => {
    const entries = [
      {
        id: "entry-large",
        type: "tool_call_update" as const,
        text: "Read a large file",
        timestamp: new Date(0).toISOString(),
        toolCallId: "call-large",
        status: "completed",
        raw: {
          rawOutput: {
            stdout: "export const value = 1;\n".repeat(2_000),
          },
        },
      },
    ];

    const serialized = serializeWorkerOutputEntries(entries);

    expect(serialized.startsWith("br:v1:")).toBe(true);
    expect(serialized.length).toBeLessThan(JSON.stringify(entries).length / 4);
    expect(parseWorkerOutputEntries(serialized)).toEqual(entries);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getAppDataPath } from "@/server/app-root";
import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { buildAgentOutputActivity } from "@/lib/agent-output";

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID()}`;
}

async function cleanupRun(runId: string) {
  await fs
    .rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true })
    .catch(() => undefined);
}

describe("edit tool diff persistence round-trip", () => {
  const cleanupRunIds: string[] = [];

  afterEach(async () => {
    while (cleanupRunIds.length > 0) {
      await cleanupRun(cleanupRunIds.pop()!);
    }
  });

  it("preserves enough of oldText/newText through compaction for the Terminal to render a diff", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    cleanupRunIds.push(runId);

    // Long shared prefix and suffix with a single-line divergence in the
    // middle — exactly the shape of a real Edit on a large file. Each side
    // alone is well over RAW_HISTORY_CHAR_LIMIT (4000), so the prior
    // implementation would have truncated oldText and newText to byte-
    // identical strings and dropped the diff entirely.
    const prefix = Array.from({ length: 60 }, (_, i) => `// header line ${i}`).join("\n");
    const suffix = Array.from({ length: 60 }, (_, i) => `// trailing line ${i}`).join("\n");
    const oldMiddle = "const status = 'pending';";
    const newMiddle = "const status = 'ready';";
    const oldText = `${prefix}\n${oldMiddle}\n${suffix}`;
    const newText = `${prefix}\n${newMiddle}\n${suffix}`;
    expect(oldText).not.toBe(newText);

    const entry = {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      timestamp: new Date().toISOString(),
      toolCallId: "edit-1",
      toolKind: "edit",
      status: "completed",
      raw: {
        content: [
          {
            type: "diff",
            path: "src/index.ts",
            oldText,
            newText,
          },
        ],
        kind: "edit",
        status: "completed",
        title: "Edit",
        toolCallId: "edit-1",
        sessionUpdate: "tool_call",
      },
    };

    await writeWorkerOutputEntries(runId, workerId, [entry as never]);
    const persisted = await readWorkerOutputEntries(runId, workerId);
    expect(persisted).toHaveLength(1);

    const persistedContent = (persisted[0] as { raw: { content: Array<Record<string, unknown>> } })
      .raw.content[0];
    expect(
      persistedContent.oldText,
      "persisted oldText and newText must still differ — otherwise the Terminal cannot render a diff",
    ).not.toBe(persistedContent.newText);
    // Spot-check that the divergent line itself survived persistence.
    expect(String(persistedContent.oldText)).toContain(oldMiddle);
    expect(String(persistedContent.newText)).toContain(newMiddle);

    const activity = buildAgentOutputActivity({
      outputEntries: persisted as never,
      state: "done",
      currentText: "",
      lastText: "",
      displayText: "",
    });
    const toolEntry = activity.find((item) => item.kind === "tool");
    expect(toolEntry, "edit tool activity missing from buildAgentOutputActivity output").toBeTruthy();
    if (toolEntry?.kind === "tool") {
      expect(toolEntry.outputPane?.kind).toBe("diff");
      expect(toolEntry.outputPane?.text).toContain(`-${oldMiddle}`);
      expect(toolEntry.outputPane?.text).toContain(`+${newMiddle}`);
    }
  });

  it("leaves small diff payloads alone when both sides already fit", async () => {
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    cleanupRunIds.push(runId);

    const oldText = "const status = 'old';";
    const newText = "const status = 'new';";
    const entry = {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      timestamp: new Date().toISOString(),
      toolCallId: "edit-2",
      toolKind: "edit",
      status: "completed",
      raw: {
        content: [{ type: "diff", path: "src/index.ts", oldText, newText }],
        kind: "edit",
        status: "completed",
        title: "Edit",
        toolCallId: "edit-2",
        sessionUpdate: "tool_call",
      },
    };

    await writeWorkerOutputEntries(runId, workerId, [entry as never]);
    const persisted = await readWorkerOutputEntries(runId, workerId);
    const persistedContent = (persisted[0] as { raw: { content: Array<Record<string, unknown>> } })
      .raw.content[0];
    // Small payloads are unchanged — no "lines omitted" markers introduced.
    expect(persistedContent.oldText).toBe(oldText);
    expect(persistedContent.newText).toBe(newText);
  });

  it("survives an Edit whose oldText/newText are huge and diverge only in a one-line change", async () => {
    // Reproduces the exact pathological case from session 6f659eeee333 in
    // the user's omniharness DB: 4kB+ on each side, head and tail
    // identical, divergence buried in the middle.
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    cleanupRunIds.push(runId);

    const block = Array.from({ length: 200 }, (_, i) => `line ${i}: ${"x".repeat(20)}`).join("\n");
    const oldText = `${block}\nstale = 1;\n${block}`;
    const newText = `${block}\nstale = 2;\n${block}`;

    const entry = {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      timestamp: new Date().toISOString(),
      toolCallId: "edit-3",
      toolKind: "edit",
      status: "completed",
      raw: {
        content: [{ type: "diff", path: "HomeApp.tsx", oldText, newText }],
        kind: "edit",
        status: "completed",
        title: "Edit",
        toolCallId: "edit-3",
        sessionUpdate: "tool_call",
      },
    };

    await writeWorkerOutputEntries(runId, workerId, [entry as never]);
    const persisted = await readWorkerOutputEntries(runId, workerId);
    const activity = buildAgentOutputActivity({
      outputEntries: persisted as never,
      state: "done",
      currentText: "",
      lastText: "",
      displayText: "",
    });
    const toolEntry = activity.find((item) => item.kind === "tool");
    expect(toolEntry?.kind === "tool" ? toolEntry.outputPane?.kind : null).toBe("diff");
    const diffText = toolEntry?.kind === "tool" ? toolEntry.outputPane?.text ?? "" : "";
    expect(diffText).toContain("-stale = 1;");
    expect(diffText).toContain("+stale = 2;");
  });

  it("preserves divergence for a single-line 4kB diff with the change buried in the middle", async () => {
    // Bridge can emit Edit content as one giant line (think minified JS,
    // base64 image, JSON dump). With prefix=0 and suffix=0 the old code
    // short-circuited compressDiffContentPair and let the generic
    // char-based head+tail truncator slice off the divergent middle —
    // leaving oldText and newText byte-identical on disk.
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    cleanupRunIds.push(runId);

    const filler = "x".repeat(2200);
    const oldText = `${filler}<<OLD-MARKER>>${filler}`;
    const newText = `${filler}<<NEW-MARKER>>${filler}`;
    expect(oldText.length).toBeGreaterThan(4_000);
    expect(oldText.split("\n").length).toBe(1);

    const entry = {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      timestamp: new Date().toISOString(),
      toolCallId: "edit-6",
      toolKind: "edit",
      status: "completed",
      raw: {
        content: [{ type: "diff", path: "minified.js", oldText, newText }],
        kind: "edit",
        status: "completed",
        title: "Edit",
        toolCallId: "edit-6",
        sessionUpdate: "tool_call",
      },
    };

    await writeWorkerOutputEntries(runId, workerId, [entry as never]);
    const persisted = await readWorkerOutputEntries(runId, workerId);
    const persistedContent = (persisted[0] as { raw: { content: Array<Record<string, unknown>> } })
      .raw.content[0];
    expect(
      persistedContent.oldText,
      "single-line 4kB diff with divergence in the middle: oldText and newText must still differ on disk",
    ).not.toBe(persistedContent.newText);
    expect(String(persistedContent.oldText)).toContain("OLD-MARKER");
    expect(String(persistedContent.newText)).toContain("NEW-MARKER");
  });

  it("preserves divergence when one line in the middle of a 9-line file changes (6f659eeee333 shape)", async () => {
    // Exact shape of the persisted entry on disk for session
    // 6f659eeee333-worker-1: 9 lines, differing only at index 4. The
    // generic truncateHistoryString would omit line 4 and produce
    // byte-identical head+tail strings for old and new.
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    cleanupRunIds.push(runId);

    const buildSide = (middle: string) => [
      `"use client";`,
      ``,
      `import type React from "react";`,
      `import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";`,
      middle,
      ``,
      `function applyHomeBootstrap(bootstrap: HomeBootstrapPayload | null | undefined, notify = true) {`,
      `  if (!bootstrap) return;`,
      `}`,
    ].join("\n");
    const oldText = buildSide(`import { foo } from "./old";`);
    const newText = buildSide(`import { bar } from "./new";`);

    const entry = {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      timestamp: new Date().toISOString(),
      toolCallId: "edit-5",
      toolKind: "edit",
      status: "completed",
      raw: {
        content: [{ type: "diff", path: "HomeApp.tsx", oldText, newText }],
        kind: "edit",
        status: "completed",
        title: "Edit",
        toolCallId: "edit-5",
        sessionUpdate: "tool_call",
      },
    };

    await writeWorkerOutputEntries(runId, workerId, [entry as never]);
    const persisted = await readWorkerOutputEntries(runId, workerId);
    const persistedContent = (persisted[0] as { raw: { content: Array<Record<string, unknown>> } })
      .raw.content[0];
    expect(
      persistedContent.oldText,
      "9-line file with a one-line middle change: oldText and newText must still differ on disk",
    ).not.toBe(persistedContent.newText);
    expect(String(persistedContent.oldText)).toContain(`old`);
    expect(String(persistedContent.newText)).toContain(`new`);
  });

  it("preserves divergence when prefix and suffix lines are short but the body is enormous", async () => {
    // Mirrors the actual failure on disk for session 6f659eeee333: short
    // common prefix and suffix (so the old code took the early-null exit)
    // and a multi-kB divergent body, which the generic truncator then
    // collapsed to byte-identical head/tail strings.
    const runId = uniqueId("run");
    const workerId = uniqueId("worker");
    cleanupRunIds.push(runId);

    const divergentOld = Array.from({ length: 80 }, (_, i) => `old body ${i}: ${"a".repeat(40)}`).join("\n");
    const divergentNew = Array.from({ length: 80 }, (_, i) => `new body ${i}: ${"b".repeat(40)}`).join("\n");
    const oldText = `header\n${divergentOld}\nfooter`;
    const newText = `header\n${divergentNew}\nfooter`;
    expect(oldText.length).toBeGreaterThan(4_000);

    const entry = {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      timestamp: new Date().toISOString(),
      toolCallId: "edit-4",
      toolKind: "edit",
      status: "completed",
      raw: {
        content: [{ type: "diff", path: "HomeApp.tsx", oldText, newText }],
        kind: "edit",
        status: "completed",
        title: "Edit",
        toolCallId: "edit-4",
        sessionUpdate: "tool_call",
      },
    };

    await writeWorkerOutputEntries(runId, workerId, [entry as never]);

    // First read must already have distinguishable oldText/newText.
    const persistedOnce = await readWorkerOutputEntries(runId, workerId);
    const onceContent = (persistedOnce[0] as { raw: { content: Array<Record<string, unknown>> } })
      .raw.content[0];
    expect(
      onceContent.oldText,
      "after one write the persisted oldText and newText must already differ",
    ).not.toBe(onceContent.newText);

    // Round-trip a second time. If the first write had silently collapsed
    // both sides to byte-identical strings, the second write would then
    // take the truncateHistoryString fallback and lock in the corruption.
    await writeWorkerOutputEntries(runId, workerId, persistedOnce as never);
    const persistedTwice = await readWorkerOutputEntries(runId, workerId);
    const twiceContent = (persistedTwice[0] as { raw: { content: Array<Record<string, unknown>> } })
      .raw.content[0];
    expect(
      twiceContent.oldText,
      "second write must not collapse oldText and newText to identical strings",
    ).not.toBe(twiceContent.newText);

    const activity = buildAgentOutputActivity({
      outputEntries: persistedTwice as never,
      state: "done",
      currentText: "",
      lastText: "",
      displayText: "",
    });
    const toolEntry = activity.find((item) => item.kind === "tool");
    expect(toolEntry?.kind === "tool" ? toolEntry.outputPane?.kind : null).toBe("diff");
    const diffText = toolEntry?.kind === "tool" ? toolEntry.outputPane?.text ?? "" : "";
    // Both sides must contribute something to the diff — not just one.
    expect(diffText).toMatch(/-/);
    expect(diffText).toMatch(/\+/);
  });
});

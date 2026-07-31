import { describe, expect, it, vi } from "vitest";

import {
  collectProcessTree,
  assertMemoryBudget,
  excludeAmbientAgentSubtrees,
  memoryBudgetForTopology,
  parseProcessTable,
  runMemorySampler,
  runFixtureWorkload,
} from "../../scripts/lib/process-memory.mjs";

describe("local development process-memory measurement", () => {
  it("enforces the cutover budgets for development and production", () => {
    expect(memoryBudgetForTopology("development")).toEqual({
      topology: "runner-vite-dev",
      maximumPeakRssMb: 2_048,
    });
    expect(memoryBudgetForTopology("production")).toEqual({
      topology: "production-runner",
      maximumPeakRssMb: 1_024,
    });
    expect(() => assertMemoryBudget({
      mode: "production",
      peakRssMb: 1_024,
    })).toThrow("exceeded");
    expect(assertMemoryBudget({
      mode: "development",
      peakRssMb: 2_047.9,
    })).toEqual(expect.objectContaining({ passed: true }));
  });

  it("parses ps output and collects the complete descendant tree", () => {
    const processes = parseProcessTable([
      "  100     1  12000 node scripts/dev.ts",
      "  101   100   8000 pnpm next dev",
      "  102   101  64000 node next dev",
      "  103   100  32000 node scripts/agent-runtime.ts",
      "  999     1  50000 unrelated",
    ].join("\n"));

    expect(collectProcessTree(processes, 100).sort((left, right) => left.pid - right.pid)).toEqual([
      expect.objectContaining({ pid: 100, rssKb: 12_000 }),
      expect.objectContaining({ pid: 101, rssKb: 8_000 }),
      expect.objectContaining({ pid: 102, rssKb: 64_000 }),
      expect.objectContaining({ pid: 103, rssKb: 32_000 }),
    ]);
  });

  it("records peak and final whole-tree RSS", async () => {
    const samples = [100, 240, 180].map((rssKb) => ({
      atMs: 0,
      rootPid: 10,
      processCount: 2,
      rssKb,
      processes: [],
    }));
    let index = 0;

    const result = await runMemorySampler({
      durationMs: 2_000,
      intervalMs: 1_000,
      readSample: async () => samples[index++]!,
      sleep: vi.fn().mockResolvedValue(undefined),
      now: (() => {
        let now = 0;
        return () => {
          const value = now;
          now += 1_000;
          return value;
        };
      })(),
    });

    expect(result.samples).toHaveLength(3);
    expect(result.peakRssKb).toBe(240);
    expect(result.finalRssKb).toBe(180);
  });

  it("keeps the benchmark fixture but excludes unrelated bridge agent subtrees", () => {
    const processes = parseProcessTable([
      "  100     1  12000 node scripts/dev.ts",
      "  101   100  32000 node scripts/agent-runtime.ts",
      "  102   101  20000 codex-acp",
      "  103   102  10000 node_repl",
      "  104   101  21000 node /repo/scripts/fixtures/memory-benchmark-agent.mjs",
      "  105   101  22000 node /usr/local/bin/claude-agent-acp",
      "  106   105  90000 claude --resume user-session",
      "  107   100  64000 next-server",
    ].join("\n"));

    const result = excludeAmbientAgentSubtrees(processes, {
      fixtureCommandIncludes: "scripts/fixtures/memory-benchmark-agent.mjs",
    });

    expect(result.included.map((process) => process.pid)).toEqual([
      100,
      101,
      104,
      107,
    ]);
    expect(result.excluded.map((process) => process.pid)).toEqual([
      102,
      103,
      105,
      106,
    ]);
  });

  it("runs deterministic prompts and always removes its fixture agent", async () => {
    const requests: Array<{ path: string; method: string; body?: unknown }> = [];
    const request = vi.fn(async (path: string, init: { method: string; body?: unknown }) => {
      requests.push({ path, method: init.method, body: init.body });
      return { ok: true };
    });

    await runFixtureWorkload({
      durationMs: 10_000,
      promptIntervalMs: 5_000,
      agentName: "memory-fixture",
      projectRoot: "/tmp/project",
      fixtureCommand: "/usr/bin/node",
      fixtureArgs: ["/repo/scripts/fixtures/memory-benchmark-agent.mjs"],
      request,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(requests.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      "POST /agents",
      "POST /agents/memory-fixture/ask",
      "POST /agents/memory-fixture/ask",
      "DELETE /agents/memory-fixture",
    ]);
    expect(requests[1]?.body).toEqual({ prompt: "memory-fixture prompt 1 of 2" });
  });

  it("removes the fixture agent when a prompt fails", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("prompt failed"))
      .mockResolvedValueOnce({ ok: true });

    await expect(runFixtureWorkload({
      durationMs: 5_000,
      promptIntervalMs: 5_000,
      agentName: "memory-fixture",
      projectRoot: "/tmp/project",
      fixtureCommand: "/usr/bin/node",
      fixtureArgs: ["/repo/scripts/fixtures/memory-benchmark-agent.mjs"],
      request,
      sleep: vi.fn().mockResolvedValue(undefined),
    })).rejects.toThrow("prompt failed");

    expect(request).toHaveBeenLastCalledWith(
      "/agents/memory-fixture",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

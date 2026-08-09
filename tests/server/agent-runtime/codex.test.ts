import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { resolveCodexSessionMode } from "@/server/agent-runtime/codex";

const tempDirs: string[] = [];

const codexAcpScript = `#!/usr/bin/env node
const fs = require('node:fs');
process.stdin.setEncoding('utf8');
let buffer = '';
function write(message) { process.stdout.write(JSON.stringify(message) + '\\n'); }
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (process.env.REQUEST_LOG) fs.appendFileSync(process.env.REQUEST_LOG, JSON.stringify(message) + '\\n');
    if (message.id === undefined || message.id === null) continue;
    if (message.method === 'initialize') {
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    } else if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: {
        sessionId: 'session-codex-mode',
        modes: {
          currentModeId: 'agent',
          availableModes: [
            { id: 'read-only', name: 'Read-only' },
            { id: 'agent', name: 'Agent' },
            { id: 'agent-full-access', name: 'Agent (full access)' },
          ],
        },
      } });
    } else {
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    }
  }
});
`;

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Codex ACP session modes", () => {
  it("maps OmniHarness full-access to Codex's full-access ACP mode", () => {
    expect(resolveCodexSessionMode("full-access", [
      { id: "read-only" },
      { id: "agent" },
      { id: "agent-full-access" },
    ])).toBe("agent-full-access");
  });

  it("requests Codex's full-access ACP mode when starting a full-access worker", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-codex-mode-"));
    tempDirs.push(dir);
    const command = join(dir, "codex-acp.js");
    const requestLog = join(dir, "requests.jsonl");
    writeFileSync(command, codexAcpScript, { mode: 0o755 });
    const manager = new AgentRuntimeManager({
      env: { ...process.env, OMNIHARNESS_MEMORY_TRACE: "0" } as Record<string, string>,
    });

    try {
      await manager.startAgent({
        type: "codex",
        name: "codex-mode",
        cwd: dir,
        command,
        args: [],
        mode: "full-access",
        env: { REQUEST_LOG: requestLog },
      });

      const requests = readFileSync(requestLog, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { method?: string; params?: Record<string, unknown> });
      expect(requests).toContainEqual(expect.objectContaining({
        method: "session/set_mode",
        params: expect.objectContaining({
          sessionId: "session-codex-mode",
          modeId: "agent-full-access",
        }),
      }));
    } finally {
      await manager.stopAgent("codex-mode");
      manager.shutdownPools();
    }
  });

  it("maps later full-access mode changes to Codex's ACP mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-codex-mode-switch-"));
    tempDirs.push(dir);
    const command = join(dir, "codex-acp.js");
    const requestLog = join(dir, "requests.jsonl");
    writeFileSync(command, codexAcpScript, { mode: 0o755 });
    const manager = new AgentRuntimeManager({
      env: { ...process.env, OMNIHARNESS_MEMORY_TRACE: "0" } as Record<string, string>,
    });

    try {
      await manager.startAgent({
        type: "codex",
        name: "codex-mode-switch",
        cwd: dir,
        command,
        args: [],
        mode: "read-only",
        env: { REQUEST_LOG: requestLog },
      });
      await manager.setMode("codex-mode-switch", "full-access");

      const requests = readFileSync(requestLog, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { method?: string; params?: Record<string, unknown> });
      expect(requests).toContainEqual(expect.objectContaining({
        method: "session/set_mode",
        params: expect.objectContaining({
          sessionId: "session-codex-mode",
          modeId: "agent-full-access",
        }),
      }));
    } finally {
      await manager.stopAgent("codex-mode-switch");
      manager.shutdownPools();
    }
  });
});

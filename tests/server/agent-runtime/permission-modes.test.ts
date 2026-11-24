import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import {
  canonicalPermissionMode,
  isFullAccessPermissionMode,
  isPermissionModeForWorker,
  resolveNativeSessionMode,
} from "@/shared/worker-permission-modes";

const tempDirs: string[] = [];

// Mirrors claude-agent-acp 0.110: with no defaultMode the session starts in
// `auto`, and the catalog has no "full-access" id.
const claudeAcpScript = `#!/usr/bin/env node
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
        sessionId: 'session-claude-mode',
        modes: {
          currentModeId: 'auto',
          availableModes: [
            { id: 'default', name: 'Manual' },
            { id: 'acceptEdits', name: 'Accept edits' },
            { id: 'plan', name: 'Plan' },
            { id: 'auto', name: 'Auto' },
            { id: 'bypassPermissions', name: 'Bypass permissions' },
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

function readSetModeRequests(requestLog: string) {
  return readFileSync(requestLog, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { method?: string; params?: { modeId?: string } })
    .filter((request) => request.method === "session/set_mode")
    .map((request) => request.params?.modeId);
}

function createClaudeHarness(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  const command = join(dir, "claude-agent-acp.js");
  const requestLog = join(dir, "requests.jsonl");
  writeFileSync(command, claudeAcpScript, { mode: 0o755 });
  const manager = new AgentRuntimeManager({
    env: { ...process.env, OMNIHARNESS_MEMORY_TRACE: "0" } as Record<string, string>,
  });
  return { dir, command, requestLog, manager };
}

describe("worker permission modes", () => {
  it("maps full-access to each CLI's bypass mode", () => {
    expect(resolveNativeSessionMode("claude", "full-access")).toBe("bypassPermissions");
    expect(resolveNativeSessionMode("codex", "full-access")).toBe("agent-full-access");
    expect(resolveNativeSessionMode("gemini", "full-access")).toBe("yolo");
    expect(resolveNativeSessionMode("opencode", "full-access")).toBeNull();
    expect(resolveNativeSessionMode("claude", "acceptEdits")).toBe("acceptEdits");
  });

  it("treats every CLI's bypass spelling as full access", () => {
    for (const mode of ["full-access", "danger-full-access", "bypassPermissions", "agent-full-access", "yolo"]) {
      expect(isFullAccessPermissionMode(mode)).toBe(true);
      expect(canonicalPermissionMode(mode)).toBe("full-access");
    }
    expect(isFullAccessPermissionMode("auto")).toBe(false);
  });

  it("only accepts modes the CLI offers", () => {
    expect(isPermissionModeForWorker("claude", "auto")).toBe(true);
    expect(isPermissionModeForWorker("claude", "bypassPermissions")).toBe(true);
    expect(isPermissionModeForWorker("codex", "acceptEdits")).toBe(false);
    expect(isPermissionModeForWorker("opencode", "full-access")).toBe(true);
  });

  it("lets a conversation's chosen mode win over the stored mode and the YOLO default", () => {
    expect(resolveWorkerLaunchMode("bypassPermissions", true, "auto")).toBe("auto");
    expect(resolveWorkerLaunchMode(undefined, false, "full-access")).toBe("full-access");
    expect(resolveWorkerLaunchMode("auto", true, null)).toBe("full-access");
    expect(resolveWorkerLaunchMode(undefined, false, null)).toBeUndefined();
  });
});

describe("Claude ACP permission modes", () => {
  it("switches a full-access worker out of Claude's default auto mode into bypassPermissions", async () => {
    const { dir, command, requestLog, manager } = createClaudeHarness("omni-claude-mode-");
    try {
      await manager.startAgent({
        type: "claude",
        name: "claude-mode",
        cwd: dir,
        command,
        args: [],
        mode: "full-access",
        env: { REQUEST_LOG: requestLog },
      });
      expect(readSetModeRequests(requestLog)).toEqual(["bypassPermissions"]);
    } finally {
      await manager.stopAgent("claude-mode");
      manager.shutdownPools();
    }
  });

  it("maps later mode changes and passes native Claude modes through", async () => {
    const { dir, command, requestLog, manager } = createClaudeHarness("omni-claude-mode-switch-");
    try {
      await manager.startAgent({
        type: "claude",
        name: "claude-mode-switch",
        cwd: dir,
        command,
        args: [],
        mode: "default",
        env: { REQUEST_LOG: requestLog },
      });
      await manager.setMode("claude-mode-switch", "acceptEdits");
      await manager.setMode("claude-mode-switch", "full-access");
      expect(readSetModeRequests(requestLog)).toEqual(["default", "acceptEdits", "bypassPermissions"]);
    } finally {
      await manager.stopAgent("claude-mode-switch");
      manager.shutdownPools();
    }
  });
});

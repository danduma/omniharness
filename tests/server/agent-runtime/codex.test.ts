import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const codexAcpLaunchCaptureScript = `
const fs = require('node:fs');
fs.writeFileSync(process.env.LAUNCH_LOG, JSON.stringify({
  argv: process.argv.slice(2),
  codexConfig: process.env.CODEX_CONFIG ?? null,
}) + '\\n');
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
    if (message.id === undefined || message.id === null) continue;
    if (message.method === 'initialize') {
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    } else if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: {
        sessionId: 'session-codex-config',
        configOptions: [{ id: 'reasoning_effort', currentValue: 'high' }],
      } });
    } else if (message.method === 'session/set_config_option') {
      write({ jsonrpc: '2.0', id: message.id, result: {
        configOptions: [{ id: 'reasoning_effort', currentValue: message.params.value }],
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

  it("normalizes a legacy extra-high alias for the normal Codex ACP fallback", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-codex-config-"));
    tempDirs.push(dir);
    const binDir = join(dir, "bin");
    const command = join(binDir, "codex-acp");
    const serverScript = join(dir, "codex-acp-server.js");
    const launchLog = join(dir, "launch.jsonl");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(serverScript, codexAcpLaunchCaptureScript);
    writeFileSync(command, `#!/bin/sh\nexec ${process.execPath} ${serverScript}\n`, { mode: 0o755 });
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        PATH: binDir,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_AGENT_STARTUP_TIMEOUT_MS: "3000",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
    try {
      const status = await manager.startAgent({
        type: "codex",
        name: "codex-config",
        cwd: dir,
        model: "gpt-5.6-sol",
        effort: "extra-high",
        env: { LAUNCH_LOG: launchLog },
      });

      const launch = JSON.parse(readFileSync(launchLog, "utf8")) as {
        argv: string[];
        codexConfig: string | null;
      };
      expect(launch.argv).toEqual([]);
      expect(JSON.parse(launch.codexConfig ?? "{}")).toMatchObject({
        model: "gpt-5.6-sol",
        model_reasoning_effort: "xhigh",
      });
      expect(status.effectiveEffort).toBe("xhigh");
    } finally {
      await manager.stopAgent("codex-config");
      manager.shutdownPools();
    }
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

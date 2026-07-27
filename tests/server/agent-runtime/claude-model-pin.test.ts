import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

const tempDirs: string[] = [];

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createExecutable(dir: string, name: string, contents: string) {
  const filePath = join(dir, name);
  writeFileSync(filePath, contents, { mode: 0o755 });
  return filePath;
}

/**
 * Stands in for `claude-agent-acp` on an account whose only Fable entry is the
 * 1M-context variant, with the session starting on the model the user's global
 * `/model` last selected.
 */
const fakeClaudeAcpAgentScript = `#!/usr/bin/env node
const fs = require('node:fs');
const logPath = process.env.FAKE_ACP_REQUEST_LOG;
process.stdin.setEncoding('utf8');
let buffer = '';
let currentModel = process.env.FAKE_ACP_CURRENT_MODEL || 'default';
function write(message) { process.stdout.write(JSON.stringify(message) + '\\n'); }
function append(event) {
  if (logPath) fs.appendFileSync(logPath, JSON.stringify(event) + '\\n');
}
function configOptions() {
  return [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: currentModel,
      options: [
        { value: 'default', name: 'Default (recommended)', description: 'Sonnet 4.6' },
        { value: 'claude-fable-5[1m]', name: 'Fable', description: 'Fable 5' },
        { value: 'opus', name: 'Opus', description: 'Opus 4.8' },
        { value: 'haiku', name: 'Haiku', description: 'Haiku 4.5' },
      ],
    },
  ];
}
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    }
    if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1', configOptions: configOptions() } });
    }
    if (message.method === 'session/set_config_option') {
      append({ method: message.method, params: message.params });
      if (message.params.configId === 'model') currentModel = message.params.value;
      write({ jsonrpc: '2.0', id: message.id, result: { configOptions: configOptions() } });
    }
  }
});
process.stdin.on('end', () => process.exit(0));
`;

function readRequests(requestLog: string) {
  let raw: string;
  try {
    raw = readFileSync(requestLog, "utf8").trim();
  } catch {
    return [];
  }
  return raw ? raw.split(/\r?\n/g).map((line) => JSON.parse(line)) : [];
}

async function startClaudeWorker(options: { model?: string; currentModel?: string }) {
  const projectDir = createTempDir("omni-runtime-claude-model-project-");
  const binDir = createTempDir("omni-runtime-claude-model-bin-");
  const requestLog = join(projectDir, "requests.jsonl");
  createExecutable(binDir, "claude-agent-acp", fakeClaudeAcpAgentScript);
  const manager = new AgentRuntimeManager({
    env: {
      ...process.env,
      OMNIHARNESS_MEMORY_TRACE: "0",
      OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
      PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
    },
  });

  try {
    const status = await manager.startAgent({
      type: "claude",
      cwd: projectDir,
      name: "claude-worker",
      ...(options.model ? { model: options.model } : {}),
      env: {
        FAKE_ACP_REQUEST_LOG: requestLog,
        ...(options.currentModel ? { FAKE_ACP_CURRENT_MODEL: options.currentModel } : {}),
      },
    });
    return { status, requests: readRequests(requestLog) };
  } finally {
    await manager.stopAgent("claude-worker").catch(() => undefined);
    manager.shutdownPools();
  }
}

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Claude worker model pinning", () => {
  it("pins the requested model instead of inheriting the CLI's selection", async () => {
    const { status, requests } = await startClaudeWorker({ model: "claude-opus-4-8", currentModel: "default" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([
      expect.objectContaining({ params: expect.objectContaining({ configId: "model", value: "opus" }) }),
    ]);
    expect(status.effectiveModel).toBe("opus");
  }, 15_000);

  it("refuses to launch when the requested version is not the one the alias runs", async () => {
    // This CLI's `opus` alias is Opus 4.8. Launching an Opus 5 worker on it
    // would attribute every answer to a model that never ran, so the spawn
    // must fail loudly instead.
    await expect(startClaudeWorker({ model: "claude-opus-5", currentModel: "default" }))
      .rejects.toThrow(/claude-opus-5.*not offered.*4\.8/s);
  }, 15_000);

  it("replaces an inherited 1M-context model that the subscription cannot run", async () => {
    const { status, requests } = await startClaudeWorker({ currentModel: "claude-fable-5[1m]" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([
      expect.objectContaining({ params: expect.objectContaining({ configId: "model", value: "default" }) }),
    ]);
    expect(status.effectiveModel).toBe("default");
  }, 15_000);

  it("leaves the session alone when it already runs the requested model", async () => {
    const { requests } = await startClaudeWorker({ model: "opus", currentModel: "opus" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
  }, 15_000);
});

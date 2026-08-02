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
let currentModel = process.env.FAKE_ACP_IGNORE_ANTHROPIC_MODEL === '1'
  ? process.env.FAKE_ACP_CURRENT_MODEL || 'default'
  : process.env.ANTHROPIC_MODEL || process.env.FAKE_ACP_CURRENT_MODEL || 'default';
function write(message) { process.stdout.write(JSON.stringify(message) + '\\n'); }
function append(event) {
  if (logPath) fs.appendFileSync(logPath, JSON.stringify(event) + '\\n');
}
function configOptions() {
  if (process.env.FAKE_ACP_OMIT_MODEL_CONFIG === '1') return [];
  return [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: currentModel,
      options: [
        { value: 'default', name: 'Default (recommended)', description: 'Sonnet 4.6' },
        { value: 'claude-fable-5[1m]', name: 'Fable', description: 'Fable 5 · Uses your limits ~2× faster than Opus' },
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
      // The refreshed config is optional in the protocol; adapters that
      // acknowledge the set without echoing it back exercise a different
      // read-back path in the manager.
      const echoConfig = process.env.FAKE_ACP_OMIT_SET_CONFIG_RESULT !== '1';
      write({ jsonrpc: '2.0', id: message.id, result: echoConfig ? { configOptions: configOptions() } : {} });
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

async function startClaudeWorker(options: {
  model?: string;
  currentModel?: string;
  omitSetConfigResult?: boolean;
  omitModelConfig?: boolean;
  ignoreStartupModel?: boolean;
}) {
  const projectDir = createTempDir("omni-runtime-claude-model-project-");
  const binDir = createTempDir("omni-runtime-claude-model-bin-");
  const requestLog = join(projectDir, "requests.jsonl");
  createExecutable(binDir, "claude-agent-acp", fakeClaudeAcpAgentScript);
  const manager = new AgentRuntimeManager({
    env: {
      ...process.env,
      OMNIHARNESS_MEMORY_TRACE: "0",
      OMNIHARNESS_RESOURCE_GUARD: "0",
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
        ...(options.omitSetConfigResult ? { FAKE_ACP_OMIT_SET_CONFIG_RESULT: "1" } : {}),
        ...(options.omitModelConfig ? { FAKE_ACP_OMIT_MODEL_CONFIG: "1" } : {}),
        ...(options.ignoreStartupModel ? { FAKE_ACP_IGNORE_ANTHROPIC_MODEL: "1" } : {}),
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
  it("passes an exact requested version instead of inheriting the CLI's selection", async () => {
    const { status, requests } = await startClaudeWorker({ model: "claude-opus-4-8", currentModel: "default" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
    expect(status.effectiveModel).toBe("claude-opus-4-8");
  }, 15_000);

  it("passes the exact requested model at process startup", async () => {
    const { status, requests } = await startClaudeWorker({ model: "claude-opus-5", currentModel: "default" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
    expect(status.requestedModel).toBe("claude-opus-5");
    expect(status.effectiveModel).toBe("claude-opus-5");
  }, 15_000);

  it("refuses to launch when the adapter cannot verify the startup model", async () => {
    await expect(startClaudeWorker({ model: "claude-opus-5", omitModelConfig: true }))
      .rejects.toThrow(/cannot verify.*claude-opus-5/i);
  }, 15_000);

  it("refuses to translate an explicit model through the adapter menu", async () => {
    await expect(startClaudeWorker({
      model: "claude-opus-5",
      currentModel: "claude-fable-5[1m]",
      ignoreStartupModel: true,
    })).rejects.toThrow(/requested model.*claude-opus-5.*reported.*claude-fable-5\[1m\]/i);
  }, 15_000);

  it("passes the exact Fable model instead of crossing into another family", async () => {
    const { status, requests } = await startClaudeWorker({ model: "claude-fable-5", currentModel: "default" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
    expect(status.effectiveModel).toBe("claude-fable-5");
  }, 15_000);

  it("records the exact startup model without requiring a menu update", async () => {
    const { status, requests } = await startClaudeWorker({
      model: "claude-fable-5",
      currentModel: "default",
      omitSetConfigResult: true,
    });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
    expect(status.effectiveModel).toBe("claude-fable-5");
  }, 15_000);

  it("accepts an exact provider model even when the adapter menu omits it", async () => {
    const { status } = await startClaudeWorker({ model: "claude-sonnet-5", currentModel: "default" });

    expect(status.requestedModel).toBe("claude-sonnet-5");
    expect(status.effectiveModel).toBe("claude-sonnet-5");
  }, 15_000);

  it("keeps an inherited 1M model when no same-model standard listing exists", async () => {
    // This CLI has no standard-context Fable, so the only way off `[1m]` is a
    // different model. Nothing was requested, so nothing justifies that: the
    // session stays on the Fable the user's own `/model` selected.
    const { status, requests } = await startClaudeWorker({ currentModel: "claude-fable-5[1m]" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
    expect(status.effectiveModel).toBe("claude-fable-5[1m]");
  }, 15_000);

  it("leaves the session alone when it already runs the requested model", async () => {
    const { requests } = await startClaudeWorker({ model: "opus", currentModel: "opus" });

    expect(requests.filter((event) => event.method === "session/set_config_option")).toEqual([]);
  }, 15_000);
});

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Server } from "http";
import { dirname } from "path";
import { createAgentRuntimeServer } from "@/server/agent-runtime/http";

const tempDirs: string[] = [];
const servers: Server[] = [];

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

function listen(server: Server) {
  servers.push(server);
  return new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      }
    });
  });
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await closeServer(server);
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const fakeAcpAgentScript = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const logPath = process.env.FAKE_ACP_REQUEST_LOG;
process.stdin.setEncoding('utf8');
let buffer = '';
let promptFailures = 0;

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function append(event) {
  if (logPath) fs.appendFileSync(logPath, JSON.stringify(event) + '\\n');
}

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
      const applyPatchPath = pathEntries
        .map((entry) => path.join(entry, 'apply_patch'))
        .find((candidate) => fs.existsSync(candidate)) || null;
      append({
        method: message.method,
        params: message.params,
        argv: process.argv.slice(2),
        codexManagedConfigPath: process.env.CODEX_MANAGED_CONFIG_PATH || null,
        applyPatchPath,
        path: process.env.PATH || null,
      });
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    }
    if (message.method === 'session/new') {
      const skillsDir = path.join(message.params.cwd, '.agents', 'skills');
      append({
        method: message.method,
        params: message.params,
        skillEntries: fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).sort() : [],
      });
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    }
    if (message.method === 'session/resume') {
      append({ method: message.method, params: message.params });
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    }
    if (message.method === 'session/prompt') {
      append({ method: message.method, params: message.params });
      if (process.env.FAKE_ACP_STDERR_ON_PROMPT) {
        process.stderr.write(process.env.FAKE_ACP_STDERR_ON_PROMPT + '\\n');
      }
      if (process.env.FAKE_ACP_FAIL_FIRST_PROMPT_ECONNRESET === '1' && promptFailures === 0) {
        promptFailures += 1;
        write({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32603,
            message: 'read ECONNRESET',
          },
        });
        continue;
      }
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: message.params.sessionId,
          update: {
            sessionUpdate: 'usage_update',
            used: 250,
            size: 1000,
          },
        },
      });
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: message.params.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'terminal-1',
            kind: 'execute',
            status: 'in_progress',
            title: 'Terminal',
            rawInput: { command: 'pnpm test tests/api/agent-route.test.ts' },
          },
        },
      });
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: message.params.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'terminal-1',
            status: 'completed',
            rawOutput: { formatted_output: 'PASS tests/api/agent-route.test.ts\\n' },
          },
        },
      });
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: message.params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'fake response' },
          },
        },
      });
      write({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          stopReason: 'end_turn',
          usage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
        },
      });
    }
  }
});
`;

const fakeFsAcpAgentScript = `#!/usr/bin/env node
const fs = require('node:fs');
const logPath = process.env.FAKE_ACP_REQUEST_LOG;
process.stdin.setEncoding('utf8');
let buffer = '';
let sessionRequestId = null;
let readPath = null;
let writePath = null;

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function append(event) {
  if (logPath) fs.appendFileSync(logPath, JSON.stringify(event) + '\\n');
}

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      append({ method: message.method, params: message.params });
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    } else if (message.method === 'session/new') {
      sessionRequestId = message.id;
      readPath = process.env.FAKE_ACP_READ_PATH;
      writePath = process.env.FAKE_ACP_WRITE_PATH;
      write({
        jsonrpc: '2.0',
        id: 1001,
        method: 'fs/read_text_file',
        params: { sessionId: 'session-1', path: readPath },
      });
    } else if (message.id === 1001) {
      append({ method: 'fs/read_text_file/response', result: message.result });
      write({
        jsonrpc: '2.0',
        id: 1002,
        method: 'fs/write_text_file',
        params: { sessionId: 'session-1', path: writePath, content: message.result.content.replace('before', 'after') },
      });
    } else if (message.id === 1002) {
      append({ method: 'fs/write_text_file/response', result: message.result });
      write({ jsonrpc: '2.0', id: sessionRequestId, result: { sessionId: 'session-1' } });
    }
  }
});
`;

const fakeTerminalAcpAgentScript = `#!/usr/bin/env node
const { spawn } = require('node:child_process');
process.stdin.setEncoding('utf8');
let buffer = '';
let child = null;

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
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
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    }
    if (message.method === 'session/prompt') {
      child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: message.params.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'terminal-live',
            kind: 'execute',
            status: 'in_progress',
            title: 'Long terminal',
            rawInput: { command: 'node -e setInterval', process_id: String(child.pid) },
          },
        },
      });
      write({
        jsonrpc: '2.0',
        id: message.id,
        result: { stopReason: 'end_turn' },
      });
    }
  }
});

process.on('exit', () => {
  if (child && !child.killed) child.kill('SIGTERM');
});
`;

const fakeVerboseAcpAgentScript = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
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
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    }
    if (message.method === 'session/prompt') {
      const largeOutput = 'x'.repeat(250000);
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: message.params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: largeOutput },
          },
        },
      });
      for (let index = 0; index < 260; index += 1) {
        write({
          jsonrpc: '2.0',
          method: 'session/update',
          params: {
            sessionId: message.params.sessionId,
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'verbose-' + index,
              status: 'completed',
              content: [{ type: 'content', content: { type: 'text', text: largeOutput } }],
              rawOutput: { formatted_output: largeOutput },
            },
          },
        });
      }
      write({
        jsonrpc: '2.0',
        id: message.id,
        result: { stopReason: 'end_turn' },
      });
    }
  }
});
`;

type TestAgentOutputEntry = {
  toolCallId?: string | null;
  raw?: {
    rawInput?: {
      process_id?: string;
    };
  };
};

async function waitForProcessExit(pid: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

describe("internal agent runtime HTTP API", () => {
  it("spawns ACP agents, forwards MCP servers, exposes skill roots, and serves agent output", async () => {
    const projectDir = createTempDir("omni-runtime-project-");
    const binDir = createTempDir("omni-runtime-bin-");
    const skillsRoot = createTempDir("omni-runtime-skills-");
    const skillDir = join(skillsRoot, "reviewer");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: reviewer\ndescription: Review changes.\n---\n");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OPENAI_BASE_URL: "http://127.0.0.1:9/v1",
        ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
        GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:9",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "worker-1",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
        skillRoots: [skillsRoot],
        mcpServers: [
          {
            type: "stdio",
            name: "chrome-devtools",
            command: "npx",
            args: ["chrome-devtools-mcp@latest"],
            env: [{ name: "SAMPLE", value: "1" }],
          },
        ],
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const spawned = await spawnResponse.json();
    expect(spawned).toMatchObject({ name: "worker-1", type: "custom", state: "idle" });

    const askResponse = await fetch(`${baseUrl}/agents/worker-1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(askResponse.status).toBe(200);
    await expect(askResponse.json()).resolves.toMatchObject({
      name: "worker-1",
      response: "fake response",
      state: "idle",
    });

    const agentResponse = await fetch(`${baseUrl}/agents/worker-1`);
    const agentJson = await agentResponse.json();
    expect(agentJson).toMatchObject({
      name: "worker-1",
      currentText: "fake response",
      lastText: "fake response",
      contextUsage: {
        inputTokens: 150,
        outputTokens: 100,
        totalTokens: 250,
        maxTokens: 1000,
        fullnessPercent: 25,
      },
    });
    expect(agentJson.outputEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "tool_call",
        toolCallId: "terminal-1",
        toolKind: "execute",
        status: "in_progress",
        raw: expect.objectContaining({
          rawInput: { command: "pnpm test tests/api/agent-route.test.ts" },
        }),
      }),
      expect.objectContaining({
        type: "tool_call_update",
        toolCallId: "terminal-1",
        status: "completed",
        raw: expect.objectContaining({
          rawOutput: { formatted_output: "PASS tests/api/agent-route.test.ts\n" },
        }),
      }),
    ]));

    const doctorResponse = await fetch(`${baseUrl}/doctor`);
    expect(doctorResponse.status).toBe(200);
    await expect(doctorResponse.json()).resolves.toMatchObject({ results: expect.any(Array) });

    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const sessionNew = events.find((event) => event.method === "session/new");
    expect(sessionNew.params.mcpServers).toEqual([
      {
        type: "stdio",
        name: "chrome-devtools",
        command: "npx",
        args: ["chrome-devtools-mcp@latest"],
        env: [{ name: "SAMPLE", value: "1" }],
      },
    ]);
    expect(sessionNew.params._meta["omniharness/skillRoots"]).toEqual([skillsRoot]);
    expect(sessionNew.skillEntries.some((entry: string) => entry.includes("reviewer"))).toBe(true);
    expect(readdirSync(join(projectDir, ".agents", "skills")).some((entry) => entry.includes("reviewer"))).toBe(true);

    const stopResponse = await fetch(`${baseUrl}/agents/worker-1`, { method: "DELETE" });
    expect(stopResponse.status).toBe(200);
    expect(readdirSync(join(projectDir, ".agents", "skills")).some((entry) => entry.includes("reviewer"))).toBe(false);
  }, 120_000);

  it("stops a single reported terminal process without deleting the agent", async () => {
    const projectDir = createTempDir("omni-runtime-terminal-project-");
    const binDir = createTempDir("omni-runtime-terminal-bin-");
    const fakeAgent = createExecutable(binDir, "fake-terminal-agent", fakeTerminalAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "terminal-worker",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askResponse = await fetch(`${baseUrl}/agents/terminal-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "run long command" }),
    });
    expect(askResponse.status).toBe(200);

    const agentBeforeCancel = await (await fetch(`${baseUrl}/agents/terminal-worker`)).json();
    const terminalEntry = (agentBeforeCancel.outputEntries as TestAgentOutputEntry[]).find((entry) => entry.toolCallId === "terminal-live");
    const pid = Number(terminalEntry?.raw?.rawInput?.process_id);
    expect(pid).toBeGreaterThan(0);

    const cancelResponse = await fetch(`${baseUrl}/agents/terminal-worker/terminals/${pid}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId: "terminal-live" }),
    });
    expect(cancelResponse.status).toBe(200);

    await expect(cancelResponse.json()).resolves.toMatchObject({
      ok: true,
      name: "terminal-worker",
      processId: String(pid),
      toolCallId: "terminal-live",
    });
    await expect(waitForProcessExit(pid)).resolves.toBe(true);

    const agentAfterCancel = await (await fetch(`${baseUrl}/agents/terminal-worker`)).json();
    expect(agentAfterCancel).toMatchObject({ name: "terminal-worker" });
    expect(agentAfterCancel.outputEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "tool_call_update",
        toolCallId: "terminal-live",
        status: "cancelled",
      }),
    ]));
  }, 30_000);

  it("bounds retained agent output before serializing runtime status", async () => {
    const projectDir = createTempDir("omni-runtime-verbose-project-");
    const runtimeDataDir = createTempDir("omni-runtime-data-");
    const binDir = createTempDir("omni-runtime-verbose-bin-");
    const fakeAgent = createExecutable(binDir, "fake-verbose-agent", fakeVerboseAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_RUNTIME_DATA_DIR: runtimeDataDir,
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "verbose-worker",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askResponse = await fetch(`${baseUrl}/agents/verbose-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "make lots of output" }),
    });
    expect(askResponse.status).toBe(200);

    const listResponse = await fetch(`${baseUrl}/agents`);
    expect(listResponse.status).toBe(200);
    const payloadText = await listResponse.text();
    expect(payloadText.length).toBeLessThan(1_500_000);
    const [agentJson] = JSON.parse(payloadText);
    expect(agentJson.outputEntries.length).toBeLessThanOrEqual(80);
    expect(agentJson.outputArchive).toMatchObject({
      totalEntries: expect.any(Number),
      liveEntries: agentJson.outputEntries.length,
    });
    expect(agentJson.outputArchive.logPath).toContain(runtimeDataDir);
    expect(agentJson.outputArchive.logPath).not.toContain(projectDir);
    expect(agentJson.outputArchive.totalEntries).toBeGreaterThan(agentJson.outputEntries.length);
    expect(agentJson.outputEntries[0].id).toBe("output-archive-marker");
    expect(agentJson.outputEntries[0].text).toContain("older raw worker activity records");
    expect(agentJson.outputEntries[0].text).toContain("not in the current terminal output");
    expect(agentJson.currentText.length).toBeLessThanOrEqual(100_000);
    expect(agentJson.currentText).toContain("Earlier runtime output omitted");
    expect(agentJson.outputEntries.every((entry: { text: string }) => entry.text.length <= 5_000)).toBe(true);
    const lastEntry = agentJson.outputEntries.at(-1);
    expect(lastEntry.raw.rawOutput.formatted_output.length).toBeLessThanOrEqual(4_050);

    const archiveResponse = await fetch(`${baseUrl}/agents/verbose-worker/output?limit=3`);
    expect(archiveResponse.status).toBe(200);
    const archivePage = await archiveResponse.json();
    expect(archivePage).toMatchObject({
      name: "verbose-worker",
      cursor: 0,
      nextCursor: expect.any(Number),
      totalEntries: agentJson.outputArchive.totalEntries,
      entries: expect.any(Array),
    });
    expect(archivePage.entries).toHaveLength(3);
    expect(archivePage.entries[0]).toMatchObject({
      type: "message",
      text: "x".repeat(250000),
    });
    expect(archivePage.entries[1]).toMatchObject({
      type: "tool_call_update",
      toolCallId: "verbose-0",
    });
    expect(archivePage.entries[1].raw.rawOutput.formatted_output).toBe("x".repeat(250000));

    const nextPageResponse = await fetch(`${baseUrl}/agents/verbose-worker/output?cursor=${archivePage.nextCursor}&limit=2`);
    expect(nextPageResponse.status).toBe(200);
    const nextPage = await nextPageResponse.json();
    expect(nextPage.cursor).toBe(archivePage.nextCursor);
    expect(nextPage.entries).toHaveLength(2);
    expect(nextPage.entries[0].toolCallId).toBe("verbose-2");
  }, 30_000);

  it("keeps nonfatal agent stderr diagnostics out of lastError", async () => {
    const projectDir = createTempDir("omni-runtime-stderr-project-");
    const binDir = createTempDir("omni-runtime-stderr-bin-");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const stderrLine = "\u001b[2m2026-05-04T10:55:13.261719Z\u001b[0m \u001b[31mERROR\u001b[0m \u001b[2mcodex_core::tools::router\u001b[0m\u001b[2m:\u001b[0m \u001b[3merror\u001b[0m\u001b[2m=\u001b[0mwrite_stdin failed: Unknown process id 66670";
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "stderr-worker",
        env: { FAKE_ACP_STDERR_ON_PROMPT: stderrLine },
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askResponse = await fetch(`${baseUrl}/agents/stderr-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(askResponse.status).toBe(200);

    const agentResponse = await fetch(`${baseUrl}/agents/stderr-worker`);
    const agentJson = await agentResponse.json();
    expect(agentJson.lastError).toBeNull();
    expect(agentJson.stderrBuffer).toEqual(expect.arrayContaining([stderrLine]));
  }, 30_000);

  it("keeps a worker prompt alive across ECONNRESET failures", async () => {
    const projectDir = createTempDir("omni-runtime-reset-project-");
    const binDir = createTempDir("omni-runtime-reset-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "reset-worker",
        env: {
          FAKE_ACP_FAIL_FIRST_PROMPT_ECONNRESET: "1",
          FAKE_ACP_REQUEST_LOG: requestLog,
        },
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askResponse = await fetch(`${baseUrl}/agents/reset-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });

    expect(askResponse.status).toBe(200);
    await expect(askResponse.json()).resolves.toMatchObject({
      name: "reset-worker",
      response: "fake response",
      state: "idle",
    });

    const agentResponse = await fetch(`${baseUrl}/agents/reset-worker`);
    const agentJson = await agentResponse.json();
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    expect(agentJson.lastError).toBeNull();
    expect(agentJson.state).toBe("idle");
    expect(events.filter((event) => event.method === "session/prompt")).toHaveLength(2);
  }, 30_000);

  it("spawns Codex ACP workers with standard Codex core tools enabled", async () => {
    const projectDir = createTempDir("omni-runtime-codex-project-");
    const binDir = createTempDir("omni-runtime-codex-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "codex-acp", fakeAcpAgentScript);
    const fakeNativeCodex = createExecutable(binDir, "codex-native", "#!/bin/sh\necho codex-native\n");
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_CODEX_NATIVE_BINARY: fakeNativeCodex,
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "codex",
        command: fakeAgent,
        cwd: projectDir,
        name: "codex-worker",
        model: "gpt-5.5",
        effort: "high",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.argv).toEqual([
      "-c",
      'model="gpt-5.5"',
      "-c",
      'model_reasoning_effort="high"',
    ]);
    expect(initialize.codexManagedConfigPath).toMatch(/managed_config\.toml$/);
    const managedConfig = readFileSync(initialize.codexManagedConfigPath, "utf8");
    expect(managedConfig).toContain("apply_patch_freeform = true");
    expect(managedConfig).toContain("unified_exec = true");
    expect(managedConfig).toContain("web_search_request = true");
    expect(managedConfig).toContain("view_image_tool = true");
    expect(managedConfig).toContain("remote_models = true");
    expect(initialize.applyPatchPath).toMatch(/omniharness-codex-tools-.+apply_patch$/);
    expect(initialize.path.split(":")[0]).toContain("omniharness-codex-tools-");

    await fetch(`${baseUrl}/agents/codex-worker`, { method: "DELETE" });
  }, 15_000);

  it("treats duplicate saved-session resume requests as idempotent", async () => {
    const projectDir = createTempDir("omni-runtime-resume-project-");
    const binDir = createTempDir("omni-runtime-resume-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "worker-resume",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const resumeResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "worker-resume",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
        resumeSessionId: "session-1",
      }),
    });

    expect(resumeResponse.status).toBe(201);
    await expect(resumeResponse.json()).resolves.toMatchObject({
      name: "worker-resume",
      sessionId: "session-1",
      state: "idle",
    });

    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    expect(events.filter((event) => event.method === "session/new")).toHaveLength(1);

    await fetch(`${baseUrl}/agents/worker-resume`, { method: "DELETE" });
  }, 15_000);

  it("uses the requested session id when ACP resume succeeds without echoing one", async () => {
    const projectDir = createTempDir("omni-runtime-resume-id-project-");
    const binDir = createTempDir("omni-runtime-resume-id-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const resumeResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "worker-resumed",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
        resumeSessionId: "session-1",
      }),
    });

    expect(resumeResponse.status).toBe(201);
    await expect(resumeResponse.json()).resolves.toMatchObject({
      name: "worker-resumed",
      sessionId: "session-1",
      state: "idle",
    });

    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    expect(events.filter((event) => event.method === "session/resume")).toHaveLength(1);
    expect(events.filter((event) => event.method === "session/new")).toHaveLength(0);

    await fetch(`${baseUrl}/agents/worker-resumed`, { method: "DELETE" });
  }, 15_000);

  it("advertises and serves ACP filesystem capabilities to workers", async () => {
    const projectDir = createTempDir("omni-runtime-fs-project-");
    const binDir = createTempDir("omni-runtime-fs-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    const readPath = join(projectDir, "input.txt");
    const writePath = join(projectDir, "nested", "output.txt");
    writeFileSync(readPath, "before\n");
    const fakeAgent = createExecutable(binDir, "fake-fs-acp-agent", fakeFsAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "custom",
        command: fakeAgent,
        cwd: projectDir,
        name: "worker-fs",
        env: {
          FAKE_ACP_REQUEST_LOG: requestLog,
          FAKE_ACP_READ_PATH: readPath,
          FAKE_ACP_WRITE_PATH: writePath,
        },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    expect(readFileSync(writePath, "utf8")).toBe("after\n");

    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.params.clientCapabilities.fs).toEqual({
      readTextFile: true,
      writeTextFile: true,
    });
    expect(events.find((event) => event.method === "fs/read_text_file/response").result).toEqual({ content: "before\n" });
    expect(events.find((event) => event.method === "fs/write_text_file/response").result).toEqual({});

    await fetch(`${baseUrl}/agents/worker-fs`, { method: "DELETE" });
  }, 15_000);
});

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
    if (message.method === 'session/prompt') {
      append({ method: message.method, params: message.params });
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
    await expect(agentResponse.json()).resolves.toMatchObject({
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
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.codexManagedConfigPath).toMatch(/managed_config\.toml$/);
    const managedConfig = readFileSync(initialize.codexManagedConfigPath, "utf8");
    expect(managedConfig).toContain("apply_patch_freeform = true");
    expect(managedConfig).toContain("unified_exec = true");
    expect(managedConfig).toContain("web_search_request = true");
    expect(managedConfig).toContain("view_image_tool = true");
    expect(initialize.applyPatchPath).toMatch(/omniharness-codex-tools-.+apply_patch$/);
    expect(initialize.path.split(":")[0]).toContain("omniharness-codex-tools-");

    await fetch(`${baseUrl}/agents/codex-worker`, { method: "DELETE" });
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

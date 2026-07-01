import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createServer, type Server } from "http";
import { dirname } from "path";
import { createAgentRuntimeServer } from "@/server/agent-runtime/http";
import { getAppDataPath } from "@/server/app-root";

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

async function waitFor<T>(read: () => Promise<T>, matches: (value: T) => boolean) {
  const deadline = Date.now() + 5_000;
  let lastValue: T | undefined;
  do {
    lastValue = await read();
    if (matches(lastValue)) {
      return lastValue;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(lastValue)}`);
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
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
        selectedEnv: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || null,
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || null,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || null,
          CUSTOM_EXTERNAL_CREDENTIAL: process.env.CUSTOM_EXTERNAL_CREDENTIAL || null,
        },
        selectedCliStorageEnv: {
          CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR || null,
          CODEX_SQLITE_HOME: process.env.CODEX_SQLITE_HOME || null,
          GEMINI_CLI_HOME: process.env.GEMINI_CLI_HOME || null,
          GEMINI_CLI_TRUST_WORKSPACE: process.env.GEMINI_CLI_TRUST_WORKSPACE || null,
          GEMINI_FORCE_FILE_STORAGE: process.env.GEMINI_FORCE_FILE_STORAGE || null,
          OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR || null,
          XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || null,
          XDG_DATA_HOME: process.env.XDG_DATA_HOME || null,
          XDG_STATE_HOME: process.env.XDG_STATE_HOME || null,
        },
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
    if (message.method === 'session/set_mode') {
      append({ method: message.method, params: message.params });
      write({ jsonrpc: '2.0', id: message.id, result: {} });
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

const fakeExitAfterSessionAgentScript = `#!/usr/bin/env node
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
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-exited' } });
      setTimeout(() => process.exit(0), 5);
    }
  }
});
`;

const fakeExitAfterInitializeAgentScript = `#!/usr/bin/env node
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
      setTimeout(() => process.exit(0), 5);
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

const fakePermissionAcpAgentScript = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';
let promptRequestId = null;

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
    } else if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    } else if (message.method === 'session/set_mode') {
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    } else if (message.method === 'session/prompt') {
      promptRequestId = message.id;
      write({
        jsonrpc: '2.0',
        id: 7001,
        method: 'session/request_permission',
        params: {
          sessionId: message.params.sessionId,
          toolCall: {
            toolCallId: 'permission-call-1',
            title: 'Run command',
            kind: 'execute',
            status: 'pending',
            rawInput: { command: 'pnpm test' },
          },
          options: [
            { optionId: 'allow_always', kind: 'allow_always', name: 'Always Allow' },
            { optionId: 'allow_once', kind: 'allow_once', name: 'Allow' },
            { optionId: 'reject_once', kind: 'reject_once', name: 'Reject' },
          ],
        },
      });
    } else if (message.id === 7001) {
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'session-1',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'permission response ' + JSON.stringify(message.result) },
          },
        },
      });
      write({ jsonrpc: '2.0', id: promptRequestId, result: { stopReason: 'end_turn' } });
    }
  }
});
`;

const fakeElicitationAcpAgentScript = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';
let promptRequestId = null;

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
    } else if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    } else if (message.method === 'session/set_mode') {
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    } else if (message.method === 'session/prompt') {
      promptRequestId = message.id;
      write({
        jsonrpc: '2.0',
        id: 8001,
        method: 'elicitation/create',
        params: {
          mode: 'form',
          sessionId: message.params.sessionId,
          toolCallId: 'ask-call-1',
          message: 'Which option do you want?',
          requestedSchema: {
            type: 'object',
            properties: {
              question_0: { type: 'string', oneOf: [{ const: 'A' }, { const: 'B' }] },
            },
          },
        },
      });
    } else if (message.id === 8001) {
      write({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: 'session-1',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'elicitation response ' + JSON.stringify(message.result) },
          },
        },
      });
      write({ jsonrpc: '2.0', id: promptRequestId, result: { stopReason: 'end_turn' } });
    }
  }
});
`;

const fakeModeSwitchAcpAgentScript = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';
let promptRequestId = null;

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
    } else if (message.method === 'session/new') {
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    } else if (message.method === 'session/set_mode') {
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    } else if (message.method === 'session/prompt') {
      promptRequestId = message.id;
      write({
        jsonrpc: '2.0',
        id: 7002,
        method: 'session/request_permission',
        params: {
          sessionId: message.params.sessionId,
          toolCall: {
            toolCallId: 'mode-switch-call-1',
            title: 'Ready to code?',
            kind: 'switch_mode',
            status: 'pending',
          },
          options: [
            { optionId: 'allow_always', kind: 'allow_always', name: 'Yes, and auto-accept edits' },
            { optionId: 'allow_once', kind: 'allow_once', name: 'Yes' },
            { optionId: 'reject_once', kind: 'reject_once', name: 'No, keep planning' },
          ],
        },
      });
      // The permission must stay pending until a human responds; the turn only
      // ends once that response arrives (see the message.id === 7002 branch).
    } else if (message.id === 7002) {
      write({ jsonrpc: '2.0', id: promptRequestId, result: { stopReason: 'end_turn' } });
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
  it("keeps doctor responsive when a provider endpoint hangs", async () => {
    const binDir = createTempDir("omni-runtime-doctor-bin-");
    createExecutable(binDir, "codex-acp", "#!/bin/sh\nexit 0\n");
    const hangingEndpoint = createServer((_req, _res) => {
      // Keep the socket open to prove endpoint probes have their own wall-clock timeout.
    });
    const endpointPort = await listen(hangingEndpoint);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OPENAI_BASE_URL: `http://127.0.0.1:${endpointPort}/v1`,
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const startedAt = Date.now();

    const doctorResponse = await fetch(`http://127.0.0.1:${port}/doctor`);

    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(doctorResponse.status).toBe(200);
    const payload = await doctorResponse.json();
    expect(payload.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "codex",
        binary: true,
        endpoint: null,
      }),
    ]));

    await new Promise((resolve) => setTimeout(resolve, 900));
    const refreshedResponse = await fetch(`http://127.0.0.1:${port}/doctor`);
    const refreshedPayload = await refreshedResponse.json();
    expect(refreshedPayload.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "codex",
        binary: true,
        endpoint: false,
        message: expect.stringContaining("ETIMEDOUT"),
      }),
    ]));
  });

  it("does not repeat slow login shell PATH discovery for every doctor worker", async () => {
    const shellDir = createTempDir("omni-runtime-doctor-shell-");
    const slowShell = createExecutable(shellDir, "slow-shell", `#!/bin/sh
sleep 0.35
if [ "$1" = "-l" ]; then shift; fi
if [ "$1" = "-c" ]; then
  eval "$2"
  exit $?
fi
exec /bin/sh "$@"
`);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        SHELL: slowShell,
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const startedAt = Date.now();

    const doctorResponse = await fetch(`http://127.0.0.1:${port}/doctor`);

    expect(Date.now() - startedAt).toBeLessThan(1_500);
    expect(doctorResponse.status).toBe(200);
    await expect(doctorResponse.json()).resolves.toMatchObject({ results: expect.any(Array) });
  });

  it("uses cached login shell PATH discovery after it completes", async () => {
    const binDir = createTempDir("omni-runtime-doctor-login-bin-");
    createExecutable(binDir, "codex-acp", "#!/bin/sh\nexit 0\n");
    const shellDir = createTempDir("omni-runtime-doctor-login-shell-");
    const slowShell = createExecutable(shellDir, "slow-shell", `#!/bin/sh
sleep 0.35
printf %s "${binDir}:$PATH"
`);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        SHELL: slowShell,
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);

    const initialResponse = await fetch(`http://127.0.0.1:${port}/doctor`);
    const initialPayload = await initialResponse.json();
    const initialCodex = initialPayload.results.find((result: { type: string }) => result.type === "codex");
    expect(initialCodex?.tools?.path).not.toContain(binDir);

    const refreshedCodex = await waitFor(async () => {
      const refreshedResponse = await fetch(`http://127.0.0.1:${port}/doctor`);
      const refreshedPayload = await refreshedResponse.json();
      return refreshedPayload.results.find((result: { type: string }) => result.type === "codex");
    }, (result) => String(result?.tools?.path ?? "").includes(binDir));
    expect(refreshedCodex?.tools?.path).toContain(binDir);
  });

  it("keeps doctor under the catalog timeout when advisory checks are slow", async () => {
    const binDir = createTempDir("omni-runtime-doctor-budget-bin-");
    createExecutable(binDir, "codex-acp", "#!/bin/sh\nexit 0\n");
    const shellDir = createTempDir("omni-runtime-doctor-budget-shell-");
    const slowShell = createExecutable(shellDir, "slow-shell", `#!/bin/sh
sleep 2
if [ "$1" = "-l" ]; then shift; fi
if [ "$1" = "-c" ]; then
  eval "$2"
  exit $?
fi
exec /bin/sh "$@"
`);
    const hangingEndpoint = createServer((_req, _res) => {
      // Keep the socket open so the doctor's endpoint probe must enforce its own budget.
    });
    const endpointPort = await listen(hangingEndpoint);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        SHELL: slowShell,
        OPENAI_BASE_URL: `http://127.0.0.1:${endpointPort}/v1`,
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const startedAt = Date.now();

    const doctorResponse = await fetch(`http://127.0.0.1:${port}/doctor`);

    expect(Date.now() - startedAt).toBeLessThan(1_500);
    expect(doctorResponse.status).toBe(200);
    const payload = await doctorResponse.json();
    expect(payload.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "codex",
        binary: true,
        endpoint: null,
      }),
    ]));
  });

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
      currentText: "",
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

  it("starts Claude ACP workers with summarized thinking display enabled", async () => {
    const projectDir = createTempDir("omni-runtime-claude-project-");
    const binDir = createTempDir("omni-runtime-claude-bin-");
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
        type: "claude",
        command: fakeAgent,
        cwd: projectDir,
        name: "claude-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const sessionNew = events.find((event) => event.method === "session/new");
    expect(sessionNew.params._meta).toMatchObject({
      claudeCode: {
        options: {
          extraArgs: {
            "thinking-display": "summarized",
          },
          settings: {
            showThinkingSummaries: true,
          },
        },
      },
    });

    const stopResponse = await fetch(`${baseUrl}/agents/claude-worker`, { method: "DELETE" });
    expect(stopResponse.status).toBe(200);
  }, 15_000);

  it("bridges global Claude skills into project-scoped Claude config", async () => {
    const projectDir = createTempDir("omni-runtime-claude-skills-project-");
    const homeDir = createTempDir("omni-runtime-claude-skills-home-");
    const binDir = createTempDir("omni-runtime-claude-skills-bin-");
    const globalSkillDir = join(homeDir, ".claude", "skills", "improve");
    mkdirSync(globalSkillDir, { recursive: true });
    writeFileSync(join(globalSkillDir, "SKILL.md"), "---\nname: improve\ndescription: Improve a codebase.\n---\n");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        HOME: homeDir,
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
        type: "claude",
        command: fakeAgent,
        cwd: projectDir,
        name: "claude-skills-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    const scopedClaudeConfigDir = initialize.selectedCliStorageEnv.CLAUDE_CONFIG_DIR;
    expect(scopedClaudeConfigDir).toBe(join(projectDir, ".omniharness", "cli-home", "claude"));
    expect(existsSync(join(scopedClaudeConfigDir, "skills", "improve", "SKILL.md"))).toBe(true);

    const stopResponse = await fetch(`${baseUrl}/agents/claude-skills-worker`, { method: "DELETE" });
    expect(stopResponse.status).toBe(200);
  }, 15_000);

  it("applies file-backed external credential profiles before spawning workers", async () => {
    const projectDir = createTempDir("omni-runtime-credential-project-");
    const binDir = createTempDir("omni-runtime-credential-bin-");
    const profilesDir = createTempDir("omni-runtime-credential-profiles-");
    const claudeProfileDir = join(profilesDir, "claude");
    const envDir = join(claudeProfileDir, "env");
    mkdirSync(envDir, { recursive: true });
    writeFileSync(join(envDir, "ANTHROPIC_BASE_URL"), "https://runner.example.test\n");
    writeFileSync(join(envDir, "ANTHROPIC_AUTH_TOKEN"), "runner-token\n");
    writeFileSync(join(claudeProfileDir, "unset"), "ANTHROPIC_API_KEY\n");
    writeFileSync(join(claudeProfileDir, "expires_at"), "2026-06-14T04:23:48.000Z\n");
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE: "",
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_CREDENTIAL_PROFILES_DIR: profilesDir,
        ANTHROPIC_API_KEY: "should-be-removed",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "claude",
        command: fakeAgent,
        cwd: projectDir,
        name: "credential-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const spawned = await spawnResponse.json();
    expect(spawned.credentialProfile).toMatchObject({
      name: "claude",
      status: "loaded",
      envKeys: ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"],
      unsetKeys: ["ANTHROPIC_API_KEY"],
      expiresAt: "2026-06-14T04:23:48.000Z",
    });
    expect(JSON.stringify(spawned)).not.toContain("runner-token");

    const requests = readFileSync(requestLog, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(requests[0].selectedEnv).toEqual({
      ANTHROPIC_API_KEY: null,
      ANTHROPIC_AUTH_TOKEN: "runner-token",
      ANTHROPIC_BASE_URL: "https://runner.example.test",
      CUSTOM_EXTERNAL_CREDENTIAL: null,
    });
  });

  it("applies command-backed external credential profiles without exposing secret values", async () => {
    const projectDir = createTempDir("omni-runtime-command-credential-project-");
    const binDir = createTempDir("omni-runtime-command-credential-bin-");
    const profilesDir = createTempDir("omni-runtime-command-credential-profiles-");
    const customProfileDir = join(profilesDir, "custom-worker");
    mkdirSync(customProfileDir, { recursive: true });
    const provider = createExecutable(binDir, "credential-provider", `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  env: {
    CUSTOM_EXTERNAL_CREDENTIAL: "from-provider",
    ANTHROPIC_AUTH_TOKEN: "provider-secret"
  },
  unset: ["ANTHROPIC_API_KEY"],
  expiresAt: "2026-07-01T00:00:00.000Z"
}));
`);
    writeFileSync(join(customProfileDir, "profile.json"), JSON.stringify({
      command: provider,
      timeoutMs: 1000,
    }));
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_CREDENTIAL_PROFILES_DIR: profilesDir,
        ANTHROPIC_API_KEY: "should-be-removed",
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
        name: "command-credential-worker",
        credentialProfile: "custom-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const spawned = await spawnResponse.json();
    expect(spawned.credentialProfile).toMatchObject({
      name: "custom-worker",
      status: "loaded",
      source: "command",
      envKeys: ["ANTHROPIC_AUTH_TOKEN", "CUSTOM_EXTERNAL_CREDENTIAL"],
      unsetKeys: ["ANTHROPIC_API_KEY"],
      expiresAt: "2026-07-01T00:00:00.000Z",
    });
    expect(JSON.stringify(spawned)).not.toContain("provider-secret");
    expect(JSON.stringify(spawned)).not.toContain("from-provider");

    const requests = readFileSync(requestLog, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(requests[0].selectedEnv).toMatchObject({
      ANTHROPIC_API_KEY: null,
      ANTHROPIC_AUTH_TOKEN: "provider-secret",
      CUSTOM_EXTERNAL_CREDENTIAL: "from-provider",
    });
  });

  it("applies settings-backed credential commands before folder profiles", async () => {
    const projectDir = createTempDir("omni-runtime-settings-credential-project-");
    const binDir = createTempDir("omni-runtime-settings-credential-bin-");
    const provider = createExecutable(binDir, "credential-provider", `#!/usr/bin/env node
if (process.argv[2] !== "credential-profile") process.exit(42);
process.stdout.write(JSON.stringify({
  env: {
    ANTHROPIC_AUTH_TOKEN: "settings-secret",
    ANTHROPIC_BASE_URL: "https://settings.example.test"
  },
  unset: ["ANTHROPIC_API_KEY"],
  expiresAt: "2026-08-01T00:00:00.000Z"
}));
`);
    const requestLog = join(projectDir, "requests.jsonl");
    const fakeAgent = createExecutable(binDir, "fake-acp-agent", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE: provider,
        OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_CLAUDE: JSON.stringify(["credential-profile"]),
        ANTHROPIC_API_KEY: "should-be-removed",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "claude",
        command: fakeAgent,
        cwd: projectDir,
        name: "settings-credential-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const spawned = await spawnResponse.json();
    expect(spawned.credentialProfile).toMatchObject({
      name: "claude",
      status: "loaded",
      source: "command",
      envKeys: ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"],
      unsetKeys: ["ANTHROPIC_API_KEY"],
      expiresAt: "2026-08-01T00:00:00.000Z",
    });
    expect(JSON.stringify(spawned)).not.toContain("settings-secret");

    const requests = readFileSync(requestLog, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(requests[0].selectedEnv).toEqual({
      ANTHROPIC_API_KEY: null,
      ANTHROPIC_AUTH_TOKEN: "settings-secret",
      ANTHROPIC_BASE_URL: "https://settings.example.test",
      CUSTOM_EXTERNAL_CREDENTIAL: null,
    });
  });

  it("streams ask progress before the final worker response", async () => {
    const projectDir = createTempDir("omni-runtime-stream-project-");
    const binDir = createTempDir("omni-runtime-stream-bin-");
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
        name: "stream-worker",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askResponse = await fetch(`${baseUrl}/agents/stream-worker/ask?stream=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(askResponse.status).toBe(200);
    const streamText = await askResponse.text();

    expect(streamText).toContain("event: progress");
    expect(streamText).toContain("event: chunk");
    expect(streamText).toContain("event: done");
  }, 15_000);

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
    expect(agentJson.currentText).toBe("");
    expect(agentJson.lastText.length).toBeLessThanOrEqual(100_000);
    expect(agentJson.lastText).toContain("Earlier runtime output omitted");
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
    expect(archivePage.entries[1].text.length).toBeLessThanOrEqual(2_000);
    expect(archivePage.entries[1].raw.rawOutput.formatted_output.length).toBeLessThanOrEqual(8_050);
    expect(archivePage.entries[1].raw.rawOutput.formatted_output).toContain("[truncated");

    const nextPageResponse = await fetch(`${baseUrl}/agents/verbose-worker/output?cursor=${archivePage.nextCursor}&limit=2`);
    expect(nextPageResponse.status).toBe(200);
    const nextPage = await nextPageResponse.json();
    expect(nextPage.cursor).toBe(archivePage.nextCursor);
    expect(nextPage.entries).toHaveLength(2);
    expect(nextPage.entries[0].toolCallId).toBe("verbose-2");
  }, 30_000);

  it("records both permission requests and selected permission outcomes", async () => {
    const projectDir = createTempDir("omni-runtime-permission-project-");
    const binDir = createTempDir("omni-runtime-permission-bin-");
    const fakeAgent = createExecutable(binDir, "fake-permission-acp-agent", fakePermissionAcpAgentScript);
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
        name: "permission-worker",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askPromise = fetch(`${baseUrl}/agents/permission-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "need permission" }),
    });

    const pendingAgent = await waitFor(
      async () => {
        const response = await fetch(`${baseUrl}/agents/permission-worker`);
        expect(response.status).toBe(200);
        return response.json() as Promise<{
          pendingPermissions?: Array<{ toolCall?: { kind?: string; title?: string } | null }>;
          outputEntries?: Array<{ type: string; status?: string; raw?: unknown }>;
        }>;
      },
      (agent) => (agent.pendingPermissions?.length ?? 0) === 1,
    );
    expect(pendingAgent.pendingPermissions?.[0]?.toolCall).toMatchObject({
      kind: "execute",
      title: "Run command",
    });
    const requestEntry = pendingAgent.outputEntries?.find((entry) => entry.type === "permission" && entry.status === "pending");
    expect(requestEntry).toMatchObject({
      raw: expect.objectContaining({ requestId: 1 }),
    });

    const approveResponse = await fetch(`${baseUrl}/agents/permission-worker/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: "allow_once" }),
    });
    expect(approveResponse.status).toBe(200);
    expect(await askPromise.then((response) => response.status)).toBe(200);

    const agentResponse = await fetch(`${baseUrl}/agents/permission-worker`);
    expect(agentResponse.status).toBe(200);
    const agent = await agentResponse.json() as { outputEntries: Array<{ type: string; text: string; status?: string; raw?: unknown }> };
    const permissionEntries = agent.outputEntries.filter((entry) => entry.type === "permission");
    expect(permissionEntries).toMatchObject([
      {
        text: "Permission requested for execute: Run command: allow_always Always Allow, allow_once Allow, reject_once Reject",
        status: "pending",
        raw: expect.objectContaining({ requestId: 1 }),
      },
      {
        text: "Permission approved for request 1: allow_once Allow",
        status: "approved",
        raw: expect.objectContaining({
          requestId: 1,
          decision: "approve",
          optionId: "allow_once",
          toolCall: expect.objectContaining({ kind: "execute", title: "Run command" }),
        }),
      },
    ]);
  }, 30_000);

  it("surfaces an AskUserQuestion elicitation and returns the accepted answer to the agent", async () => {
    const projectDir = createTempDir("omni-runtime-elicitation-project-");
    const binDir = createTempDir("omni-runtime-elicitation-bin-");
    const fakeAgent = createExecutable(binDir, "fake-elicitation-acp-agent", fakeElicitationAcpAgentScript);
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
        name: "elicitation-worker",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askPromise = fetch(`${baseUrl}/agents/elicitation-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "ask me something" }),
    });

    const pendingAgent = await waitFor(
      async () => {
        const response = await fetch(`${baseUrl}/agents/elicitation-worker`);
        expect(response.status).toBe(200);
        return response.json() as Promise<{
          pendingElicitations?: Array<{ message?: string | null; toolCallId?: string | null }>;
        }>;
      },
      (agent) => (agent.pendingElicitations?.length ?? 0) === 1,
    );
    expect(pendingAgent.pendingElicitations?.[0]).toMatchObject({
      message: "Which option do you want?",
      toolCallId: "ask-call-1",
    });

    const respondResponse = await fetch(`${baseUrl}/agents/elicitation-worker/elicitation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", content: { question_0: "A" } }),
    });
    expect(respondResponse.status).toBe(200);
    expect(await respondResponse.json()).toMatchObject({ action: "accept", requestId: 1 });
    expect(await askPromise.then((response) => response.status)).toBe(200);

    const agentResponse = await fetch(`${baseUrl}/agents/elicitation-worker`);
    const agent = await agentResponse.json() as {
      lastText: string;
      outputEntries: Array<{ type: string; text: string; status?: string }>;
    };
    // The agent echoes back the answer the client returned over elicitation/create.
    expect(agent.lastText).toContain('"question_0":"A"');
    const elicitationEntries = agent.outputEntries.filter((entry) => entry.type === "elicitation");
    expect(elicitationEntries.map((entry) => entry.status)).toEqual(["pending", "answered"]);
  }, 30_000);

  it("keeps AskUserQuestion elicitation pending in full-access mode until a human answers", async () => {
    const projectDir = createTempDir("omni-runtime-full-access-elicitation-project-");
    const binDir = createTempDir("omni-runtime-full-access-elicitation-bin-");
    const fakeAgent = createExecutable(binDir, "fake-full-access-elicitation-acp-agent", fakeElicitationAcpAgentScript);
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
        name: "full-access-elicitation-worker",
        mode: "full-access",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askPromise = fetch(`${baseUrl}/agents/full-access-elicitation-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "ask me something" }),
    });

    const pendingAgent = await waitFor(
      async () => {
        const response = await fetch(`${baseUrl}/agents/full-access-elicitation-worker`);
        expect(response.status).toBe(200);
        return response.json() as Promise<{
          pendingElicitations?: Array<{ message?: string | null; toolCallId?: string | null }>;
          outputEntries?: Array<{ type: string; status?: string }>;
        }>;
      },
      (agent) => (agent.pendingElicitations?.length ?? 0) === 1,
    );
    expect(pendingAgent.pendingElicitations?.[0]).toMatchObject({
      message: "Which option do you want?",
      toolCallId: "ask-call-1",
    });
    expect(pendingAgent.outputEntries?.filter((entry) => entry.type === "elicitation").map((entry) => entry.status)).toEqual(["pending"]);

    const raceResult = await Promise.race([
      askPromise.then(() => "completed" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 250)),
    ]);
    expect(raceResult).toBe("pending");

    const respondResponse = await fetch(`${baseUrl}/agents/full-access-elicitation-worker/elicitation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", content: { question_0: "B" } }),
    });
    expect(respondResponse.status).toBe(200);
    expect(await askPromise.then((response) => response.status)).toBe(200);

    const agentResponse = await fetch(`${baseUrl}/agents/full-access-elicitation-worker`);
    const agent = await agentResponse.json() as {
      lastText: string;
      outputEntries: Array<{ type: string; status?: string }>;
    };
    expect(agent.lastText).toContain('"question_0":"B"');
    expect(agent.outputEntries.filter((entry) => entry.type === "elicitation").map((entry) => entry.status)).toEqual(["pending", "answered"]);
  }, 30_000);

  it("auto-approves permission requests when the session is full-access", async () => {
    const projectDir = createTempDir("omni-runtime-permission-yolo-project-");
    const binDir = createTempDir("omni-runtime-permission-yolo-bin-");
    const fakeAgent = createExecutable(binDir, "fake-permission-acp-agent", fakePermissionAcpAgentScript);
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
        name: "permission-yolo-worker",
        mode: "full-access",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    const askResponse = await fetch(`${baseUrl}/agents/permission-yolo-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "need permission" }),
    });
    expect(askResponse.status).toBe(200);

    const agentResponse = await fetch(`${baseUrl}/agents/permission-yolo-worker`);
    expect(agentResponse.status).toBe(200);
    const agent = await agentResponse.json() as {
      pendingPermissions: unknown[];
      outputEntries: Array<{ type: string; text: string; status?: string; raw?: unknown }>;
    };
    expect(agent.pendingPermissions).toHaveLength(0);
    expect(agent.outputEntries.some((entry) => entry.text.includes('permission response {"outcome":{"outcome":"selected","optionId":"allow_always"}}'))).toBe(true);
    const permissionEntries = agent.outputEntries.filter((entry) => entry.type === "permission");
    expect(permissionEntries).toMatchObject([
      {
        text: "Permission requested for execute: Run command: allow_always Always Allow, allow_once Allow, reject_once Reject",
        status: "pending",
        raw: expect.objectContaining({ requestId: expect.any(Number) }),
      },
      {
        status: "approved",
        raw: expect.objectContaining({
          decision: "approve",
          optionId: "allow_always",
          toolCall: expect.objectContaining({ kind: "execute", title: "Run command" }),
        }),
      },
    ]);
    expect(permissionEntries[1].text).toMatch(/^Permission approved for request \d+: allow_always Always Allow$/);
  }, 30_000);

  it("does not auto-approve a switch_mode permission even when the session is full-access", async () => {
    const projectDir = createTempDir("omni-runtime-mode-switch-project-");
    const binDir = createTempDir("omni-runtime-mode-switch-bin-");
    const fakeAgent = createExecutable(binDir, "fake-mode-switch-acp-agent", fakeModeSwitchAcpAgentScript);
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
        name: "mode-switch-worker",
        mode: "full-access",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    // `/ask` blocks until the turn ends, so fire it without awaiting and poll for
    // the surfaced permission instead.
    const askPromise = fetch(`${baseUrl}/agents/mode-switch-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "let me plan" }),
    });

    // The mode switch must stay pending rather than being auto-approved by the
    // full-access bypass.
    const pendingAgent = await waitFor(
      async () => {
        const response = await fetch(`${baseUrl}/agents/mode-switch-worker`);
        expect(response.status).toBe(200);
        return response.json() as Promise<{
          pendingPermissions?: Array<{ toolCall?: { kind?: string; title?: string } | null }>;
          outputEntries?: Array<{ type: string; status?: string }>;
        }>;
      },
      (agent) => (agent.pendingPermissions?.length ?? 0) === 1,
    );
    expect(pendingAgent.pendingPermissions?.[0]?.toolCall).toMatchObject({
      kind: "switch_mode",
      title: "Ready to code?",
    });
    // No approval/decision outcome entry should have been written.
    expect(pendingAgent.outputEntries?.some((entry) => entry.type === "permission" && entry.status === "approved")).toBe(false);

    // Answer the permission so the turn completes and the server can close cleanly.
    const rejectResponse = await fetch(`${baseUrl}/agents/mode-switch-worker/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: "reject_once" }),
    });
    expect(rejectResponse.status).toBe(200);
    expect(await askPromise.then((response) => response.status)).toBe(200);
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

  it("refuses prompts for stopped ACP agents without writing to the closed pipe", async () => {
    const projectDir = createTempDir("omni-runtime-stopped-project-");
    const binDir = createTempDir("omni-runtime-stopped-bin-");
    const fakeAgent = createExecutable(binDir, "fake-exit-acp-agent", fakeExitAfterSessionAgentScript);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
        name: "stopped-worker",
      }),
    });
    expect(spawnResponse.status).toBe(201);

    await waitFor(
      async () => {
        const response = await fetch(`${baseUrl}/agents/stopped-worker`);
        return response.json() as Promise<{ state: string; lastError: string | null }>;
      },
      (agent) => agent.state === "stopped",
    );

    const askResponse = await fetch(`${baseUrl}/agents/stopped-worker/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello after exit" }),
      signal: AbortSignal.timeout(1_000),
    });

    expect(askResponse.status).toBe(409);
    await expect(askResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("Agent is not running: stopped-worker"),
    });
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      "ACP write error:",
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  }, 15_000);

  it("fails saved-session resume promptly when the ACP process exits during startup", async () => {
    const projectDir = createTempDir("omni-runtime-resume-exit-project-");
    const binDir = createTempDir("omni-runtime-resume-exit-bin-");
    const fakeAgent = createExecutable(binDir, "fake-exit-before-resume-acp-agent", fakeExitAfterInitializeAgentScript);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
        name: "resume-exit-worker",
        resumeSessionId: "missing-session",
      }),
      signal: AbortSignal.timeout(1_000),
    });

    expect(spawnResponse.status).toBe(400);
    await expect(spawnResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("agent process exited before ACP startup completed"),
    });
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      "ACP write error:",
      expect.anything(),
    );
  }, 15_000);

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
    expect(initialize.selectedCliStorageEnv.CODEX_SQLITE_HOME).toBe(join(projectDir, ".omniharness", "cli-home", "codex", "sqlite"));

    await fetch(`${baseUrl}/agents/codex-worker`, { method: "DELETE" });
  }, 15_000);

  it("bridges Codex credentials into project-scoped CLI storage", async () => {
    const projectDir = createTempDir("omni-runtime-codex-credentials-project-");
    const binDir = createTempDir("omni-runtime-codex-credentials-bin-");
    const fakeHome = createTempDir("omni-runtime-codex-credentials-home-");
    const globalCodexHome = join(fakeHome, ".codex");
    mkdirSync(globalCodexHome, { recursive: true });
    writeFileSync(join(globalCodexHome, "auth.json"), "{\"token\":\"global-token\"}\n");
    writeFileSync(join(globalCodexHome, "config.toml"), "model = \"gpt-5\"\n");
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, "codex-acp", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        HOME: fakeHome,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_RESOURCE_GUARD: "0",
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
        cwd: projectDir,
        name: "codex-credential-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const scopedCodexHome = join(projectDir, ".omniharness", "cli-home", "codex", "home");
    expect(readFileSync(join(scopedCodexHome, "auth.json"), "utf8")).toContain("global-token");
    expect(readFileSync(join(scopedCodexHome, "config.toml"), "utf8")).toContain("gpt-5");

    await fetch(`${baseUrl}/agents/codex-credential-worker`, { method: "DELETE" });
  }, 15_000);

  it("pins Gemini CLI session storage under the project root", async () => {
    const projectDir = createTempDir("omni-runtime-gemini-home-project-");
    const binDir = createTempDir("omni-runtime-gemini-home-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, "gemini", fakeAcpAgentScript);
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
        type: "gemini",
        cwd: projectDir,
        name: "gemini-worker",
        model: "gemini-3.5-flash",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.argv).toEqual([
      "--experimental-acp",
      "--model",
      "gemini-3.5-flash",
      "--include-directories",
      getAppDataPath("attachments"),
    ]);
    expect(initialize.selectedCliStorageEnv.GEMINI_CLI_HOME).toBe(join(projectDir, ".omniharness", "cli-home", "gemini"));
    expect(initialize.selectedCliStorageEnv.GEMINI_CLI_TRUST_WORKSPACE).toBe("true");

    await fetch(`${baseUrl}/agents/gemini-worker`, { method: "DELETE" });
  }, 15_000);

  it("launches default Gemini full-access workers with Gemini YOLO approval mode", async () => {
    const projectDir = createTempDir("omni-runtime-gemini-yolo-project-");
    const binDir = createTempDir("omni-runtime-gemini-yolo-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    writeFileSync(join(projectDir, "SKILL.md"), "---\nname: test-skill\n---\n");
    createExecutable(binDir, "gemini", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_RESOURCE_GUARD: "0",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "gemini",
        cwd: projectDir,
        name: "gemini-yolo-worker",
        model: "gemini-3.5-flash",
        mode: "full-access",
        skillRoots: [projectDir],
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.argv).toEqual([
      "--experimental-acp",
      "--approval-mode",
      "yolo",
      "--model",
      "gemini-3.5-flash",
      "--include-directories",
      getAppDataPath("attachments"),
    ]);

    await fetch(`${baseUrl}/agents/gemini-yolo-worker`, { method: "DELETE" });
  }, 15_000);

  it("bridges Gemini credentials into project-scoped CLI storage", async () => {
    const projectDir = createTempDir("omni-runtime-gemini-credentials-project-");
    const binDir = createTempDir("omni-runtime-gemini-credentials-bin-");
    const fakeHome = createTempDir("omni-runtime-gemini-credentials-home-");
    const globalGeminiHome = join(fakeHome, ".gemini");
    mkdirSync(globalGeminiHome, { recursive: true });
    writeFileSync(join(globalGeminiHome, "gemini-credentials.json"), "{\"access_token\":\"global-token\"}\n");
    writeFileSync(join(globalGeminiHome, "google_accounts.json"), "{\"accounts\":[\"global-account\"]}\n");
    writeFileSync(join(globalGeminiHome, "google_account_id"), "global-account\n");
    writeFileSync(join(globalGeminiHome, "settings.json"), "{\"theme\":\"dark\"}\n");
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, "gemini", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        HOME: fakeHome,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_RESOURCE_GUARD: "0",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "gemini",
        cwd: projectDir,
        name: "gemini-credential-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const scopedGeminiConfigDir = join(projectDir, ".omniharness", "cli-home", "gemini", ".gemini");
    expect(readFileSync(join(scopedGeminiConfigDir, "gemini-credentials.json"), "utf8")).toContain("global-token");
    expect(readFileSync(join(scopedGeminiConfigDir, "google_accounts.json"), "utf8")).toContain("global-account");
    expect(readFileSync(join(scopedGeminiConfigDir, "google_account_id"), "utf8")).toContain("global-account");
    expect(existsSync(join(scopedGeminiConfigDir, "settings.json"))).toBe(true);
    expect(readFileSync(join(projectDir, ".omniharness", "cli-home", "gemini", "settings.json"), "utf8")).toContain('"autoConfigureMemory": false');
    expect(readFileSync(join(scopedGeminiConfigDir, "settings.json"), "utf8")).toContain('"autoConfigureMemory": false');
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.selectedCliStorageEnv.GEMINI_FORCE_FILE_STORAGE).toBe("true");

    await fetch(`${baseUrl}/agents/gemini-credential-worker`, { method: "DELETE" });
  }, 15_000);

  it.each([
    {
      type: "claude",
      binary: "claude-agent-acp",
      name: "claude-storage-worker",
      storage: {
        CLAUDE_CONFIG_DIR: ["claude"],
      },
      argv: [],
    },
    {
      type: "opencode",
      binary: "opencode",
      name: "opencode-storage-worker",
      storage: {
        OPENCODE_CONFIG_DIR: ["opencode", "config"],
        XDG_CACHE_HOME: ["opencode", "cache"],
        XDG_DATA_HOME: ["opencode", "data"],
        XDG_STATE_HOME: ["opencode", "state"],
      },
      argv: ["acp"],
    },
  ])("pins $type CLI session storage under the project root", async ({ type, binary, name, storage, argv }) => {
    const projectDir = createTempDir(`omni-runtime-${type}-home-project-`);
    const binDir = createTempDir(`omni-runtime-${type}-home-bin-`);
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, binary, fakeAcpAgentScript);
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
        type,
        cwd: projectDir,
        name,
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.argv).toEqual(argv);
    for (const [key, suffix] of Object.entries(storage)) {
      expect(initialize.selectedCliStorageEnv[key]).toBe(join(projectDir, ".omniharness", "cli-home", ...suffix));
    }

    await fetch(`${baseUrl}/agents/${name}`, { method: "DELETE" });
  }, 15_000);

  it("bridges OpenCode auth into project-scoped CLI storage", async () => {
    const projectDir = createTempDir("omni-runtime-opencode-credentials-project-");
    const binDir = createTempDir("omni-runtime-opencode-credentials-bin-");
    const fakeHome = createTempDir("omni-runtime-opencode-credentials-home-");
    const globalOpencodeDataDir = join(fakeHome, ".local", "share", "opencode");
    const globalOpencodeConfigDir = join(fakeHome, ".config", "opencode");
    mkdirSync(globalOpencodeDataDir, { recursive: true });
    mkdirSync(globalOpencodeConfigDir, { recursive: true });
    writeFileSync(join(globalOpencodeDataDir, "auth.json"), "{\"google\":{\"key\":\"global-token\"}}\n");
    writeFileSync(join(globalOpencodeConfigDir, "opencode.jsonc"), "{ \"$schema\": \"https://opencode.ai/config.json\" }\n");
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, "opencode", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        HOME: fakeHome,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_RESOURCE_GUARD: "0",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "opencode",
        cwd: projectDir,
        name: "opencode-credential-worker",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const scopedOpencodeHome = join(projectDir, ".omniharness", "cli-home", "opencode");
    expect(readFileSync(join(scopedOpencodeHome, "data", "opencode", "auth.json"), "utf8")).toContain("global-token");
    expect(readFileSync(join(scopedOpencodeHome, "config", "opencode.jsonc"), "utf8")).toContain("opencode.ai");
    expect(existsSync(join(scopedOpencodeHome, "state", "opencode"))).toBe(true);
    expect(existsSync(join(scopedOpencodeHome, "cache", "opencode"))).toBe(true);

    await fetch(`${baseUrl}/agents/opencode-credential-worker`, { method: "DELETE" });
  }, 15_000);

  it("starts OpenCode ACP workers without forwarding a model flag", async () => {
    const projectDir = createTempDir("omni-runtime-opencode-model-project-");
    const binDir = createTempDir("omni-runtime-opencode-model-bin-");
    const fakeHome = createTempDir("omni-runtime-opencode-model-home-");
    const globalOpencodeDataDir = join(fakeHome, ".local", "share", "opencode");
    const globalOpencodeConfigDir = join(fakeHome, ".config", "opencode");
    mkdirSync(globalOpencodeDataDir, { recursive: true });
    mkdirSync(globalOpencodeConfigDir, { recursive: true });
    writeFileSync(join(globalOpencodeDataDir, "auth.json"), "{\"google\":{\"key\":\"global-token\"}}\n");
    writeFileSync(join(globalOpencodeConfigDir, "opencode.jsonc"), "{ \"$schema\": \"https://opencode.ai/config.json\" }\n");
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, "opencode", fakeAcpAgentScript);
    const server = createAgentRuntimeServer({
      env: {
        ...process.env,
        HOME: fakeHome,
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        OMNIHARNESS_RESOURCE_GUARD: "0",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    const spawnResponse = await fetch(`${baseUrl}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "opencode",
        cwd: projectDir,
        name: "opencode-model-worker",
        model: "google/gemini-3.5-flash",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      }),
    });

    expect(spawnResponse.status).toBe(201);
    const events = readFileSync(requestLog, "utf8").trim().split(/\r?\n/g).map((line) => JSON.parse(line));
    const initialize = events.find((event) => event.method === "initialize");
    expect(initialize.argv).toEqual(["acp"]);

    await fetch(`${baseUrl}/agents/opencode-model-worker`, { method: "DELETE" });
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
    expect(initialize.params.clientCapabilities.elicitation).toEqual({ form: {} });
    expect(events.find((event) => event.method === "fs/read_text_file/response").result).toEqual({ content: "before\n" });
    expect(events.find((event) => event.method === "fs/write_text_file/response").result).toEqual({});

    await fetch(`${baseUrl}/agents/worker-fs`, { method: "DELETE" });
  }, 15_000);
});

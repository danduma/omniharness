import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { buildGeminiArgs } from "@/server/agent-runtime/gemini";
import { getAppDataPath } from "@/server/app-root";
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

const fakeAcpAgentScript = `#!/usr/bin/env node
const fs = require('node:fs');
const logPath = process.env.FAKE_ACP_REQUEST_LOG;
process.stdin.setEncoding('utf8');
let buffer = '';
function write(message) { process.stdout.write(JSON.stringify(message) + '\\n'); }
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
      append({ method: message.method, argv: process.argv.slice(2) });
      write({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
    }
    if (message.method === 'session/new') {
      append({ method: message.method, params: message.params });
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    }
  }
});
process.stdin.on('end', () => process.exit(0));
`;

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Gemini runtime args", () => {
  it("adds Gemini YOLO approval mode for full-access sessions", () => {
    expect(buildGeminiArgs({ model: "gemini-3.5-flash", mode: "full-access" })).toEqual([
      "--experimental-acp",
      "--approval-mode",
      "yolo",
      "--model",
      "gemini-3.5-flash",
      "--include-directories",
      getAppDataPath("attachments"),
    ]);
    expect(buildGeminiArgs({ model: null, mode: "danger-full-access" })).toEqual([
      "--experimental-acp",
      "--approval-mode",
      "yolo",
      "--include-directories",
      getAppDataPath("attachments"),
    ]);
    expect(buildGeminiArgs({ model: "gemini-3.5-flash", mode: "auto" })).toEqual([
      "--experimental-acp",
      "--model",
      "gemini-3.5-flash",
      "--include-directories",
      getAppDataPath("attachments"),
    ]);
  });

  it("prewarms default Gemini workers with YOLO approval mode when requested", async () => {
    const projectDir = createTempDir("omni-runtime-gemini-yolo-prewarm-project-");
    const binDir = createTempDir("omni-runtime-gemini-yolo-prewarm-bin-");
    const requestLog = join(projectDir, "requests.jsonl");
    createExecutable(binDir, "gemini", fakeAcpAgentScript);
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_MEMORY_TRACE: "0",
        OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH: "1",
        PATH: `${binDir}:${dirname(process.execPath)}:/usr/bin:/bin`,
      },
    });

    try {
      await manager.prewarmWorker({
        type: "gemini",
        cwd: projectDir,
        model: "gemini-3.5-flash",
        mode: "full-access",
        env: { FAKE_ACP_REQUEST_LOG: requestLog },
      });

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
    } finally {
      manager.shutdownPools();
    }
  }, 15_000);
});

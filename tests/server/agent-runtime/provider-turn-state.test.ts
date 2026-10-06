/**
 * A Codex /goal starts its next turn by itself, usually before the response to
 * the prompt that ran the previous turn reaches us. If `askAgent` then reports
 * the agent idle, the runner settles the conversation while the provider keeps
 * working, and nothing persists that work (session 9d1e7dd343df lost 8h47m).
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

const tempDirs: string[] = [];

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Answers a prompt the way codex-acp does when a goal is active: the prompted
// turn goes idle, the goal's next turn goes active, then the prompt resolves.
const goalContinuationAcpScript = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function threadStatus(status) {
  write({
    jsonrpc: '2.0',
    method: 'session/update',
    params: {
      sessionId: 'session-1',
      update: { sessionUpdate: 'session_info_update', _meta: { codex: { threadStatus: status } } },
    },
  });
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
    } else if (message.method === 'session/prompt') {
      threadStatus({ type: 'active', activeFlags: [] });
      threadStatus({ type: 'idle' });
      threadStatus({ type: 'active', activeFlags: [] });
      setTimeout(() => {
        write({ jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } });
      }, 20);
    }
  }
});

process.stdin.on('end', () => process.exit(0));
`;

describe("provider-started turns", () => {
  it("keeps the agent working when the goal's next turn started before the prompt resolved", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-provider-turn-"));
    tempDirs.push(dir);
    const command = join(dir, "acp-goal.js");
    writeFileSync(command, goalContinuationAcpScript, { mode: 0o755 });
    const manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
    try {
      await manager.startAgent({ type: "gemini", name: "goal-worker", cwd: dir, command, args: [] });

      const result = await manager.askAgent("goal-worker", "Continue the goal");

      expect(result.state).toBe("working");
      expect(result.stopReason).toBeNull();
      const record = manager.agents.get("goal-worker")!;
      expect(record.state).toBe("working");
      expect(record.promptInFlight).toBe(false);
    } finally {
      manager.agents.get("goal-worker")?.child.kill("SIGTERM");
      manager.shutdownPools();
    }
  });
});

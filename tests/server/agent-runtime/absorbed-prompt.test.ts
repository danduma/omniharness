/**
 * claude-agent-acp advertises prompt queueing: a prompt that arrives while
 * Claude runs a turn of its own (a background-task notification) is folded
 * into that turn at the next tool boundary (`absorbed_mid_turn`). The model
 * answers it, but the adapter never settles that `session/prompt` request. The
 * runner's ask then waited forever, and every later message queued behind it
 * on the worker's turn chain (session fc8d9cb681ef ignored the user for 35
 * minutes).
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import {
  __getRingForTests,
  __resetNamedEventsForTests,
} from "@/server/events/named-events";

const tempDirs: string[] = [];
const managers: AgentRuntimeManager[] = [];

afterEach(() => {
  for (const manager of managers.splice(0)) {
    for (const record of manager.agents.values()) {
      record.child.kill("SIGTERM");
    }
    manager.shutdownPools();
  }
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Shared ACP plumbing for the fake adapters below. `turn(text)` streams one
// complete turn: a tool call, a message chunk, then the result usage update
// claude-agent-acp sends with `cost` when the SDK reports a turn `result`.
const acpPrelude = `#!/usr/bin/env node
process.stdin.setEncoding('utf8');
let buffer = '';
let toolCalls = 0;
function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}
function update(update) {
  write({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'session-1', update } });
}
function turn(text) {
  toolCalls += 1;
  update({ sessionUpdate: 'tool_call', toolCallId: 'tool-' + toolCalls, title: 'Terminal', kind: 'execute', status: 'pending' });
  update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });
  update({ sessionUpdate: 'usage_update', used: 100, size: 1000, cost: { amount: 0.01, currency: 'USD' } });
  update({ sessionUpdate: 'session_info_update', title: 'Title' });
}
function respond(message, result) {
  write({ jsonrpc: '2.0', id: message.id, result });
}
process.stdin.on('end', () => process.exit(0));
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      respond(message, { protocolVersion: 1, agentCapabilities: { _meta: { claudeCode: { promptQueueing: true } } } });
    } else if (message.method === 'session/new') {
      respond(message, { sessionId: 'session-1' });
    } else {
      handle(message);
    }
  }
});
`;

// The absorbed prompt: a notification turn is running, it absorbs the prompt,
// answers it, ends with a result, and the prompt is never settled.
const absorbingAcpScript = `${acpPrelude}
function handle(message) {
  if (message.method !== 'session/prompt') return;
  setTimeout(() => turn('2 + 2 = 4.'), 20);
}
`;

// The prompt queued behind a notification turn: that turn ends with a result,
// then the prompt runs as its own turn and is settled normally.
const queuedBehindNotificationAcpScript = `${acpPrelude}
function handle(message) {
  if (message.method !== 'session/prompt') return;
  setTimeout(() => turn('Notification handled.'), 10);
  setTimeout(() => turn('Prompt answered.'), 120);
  setTimeout(() => respond(message, { stopReason: 'end_turn' }), 140);
}
`;

async function startFakeAgent(script: string, quietMs: number) {
  const dir = mkdtempSync(join(tmpdir(), "omni-absorbed-prompt-"));
  tempDirs.push(dir);
  const command = join(dir, "acp.js");
  writeFileSync(command, script, { mode: 0o755 });
  const manager = new AgentRuntimeManager({
    env: {
      ...process.env,
      OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
      OMNIHARNESS_MEMORY_TRACE: "0",
      OMNIHARNESS_ABSORBED_PROMPT_QUIET_MS: String(quietMs),
    } as Record<string, string>,
  });
  managers.push(manager);
  await manager.startAgent({ type: "gemini", name: "worker", cwd: dir, command, args: [] });
  return manager;
}

function absorbedEvents() {
  return __getRingForTests().filter((entry) => entry.event.kind === "acp.prompt_absorbed");
}

describe("prompts absorbed into another turn", () => {
  it("settles a prompt the adapter absorbed and never answered", async () => {
    const manager = await startFakeAgent(absorbingAcpScript, 150);

    const startedAt = Date.now();
    const result = await manager.askAgent("worker", "What is 2 + 2?");

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(result.state).toBe("idle");
    expect(result.stopReason).toBe("end_turn");
    expect(result.response).toContain("2 + 2 = 4.");
    const record = manager.agents.get("worker")!;
    expect(record.promptInFlight).toBe(false);
    expect(record.state).toBe("idle");
    expect(absorbedEvents()).toHaveLength(1);
  });

  it("waits for a prompt queued behind a notification turn instead of settling it early", async () => {
    const manager = await startFakeAgent(queuedBehindNotificationAcpScript, 400);

    const result = await manager.askAgent("worker", "Run the next step");

    expect(result.stopReason).toBe("end_turn");
    expect(result.response).toContain("Prompt answered.");
    expect(absorbedEvents()).toHaveLength(0);
  });

  it("leaves adapters that do not queue prompts to settle their own prompts", async () => {
    const manager = await startFakeAgent(absorbingAcpScript.replace("promptQueueing: true", "promptQueueing: false"), 100);

    const outcome = await Promise.race([
      manager.askAgent("worker", "What is 2 + 2?").then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 600)),
    ]);

    expect(outcome).toBe("pending");
    expect(absorbedEvents()).toHaveLength(0);
  });
});

/**
 * A fake ACP adapter that models claude-agent-acp's steering contract
 * (`_session/steering`, advertised as top-level `initialize._meta.steering`).
 *
 * Behaviour copied from @agentclientprotocol/claude-agent-acp 0.109.x:
 * - `session/prompt` starts a turn and stays open while the turn runs.
 * - `_session/steering` during a turn answers `{ outcome: "injected" }` at
 *   once. The cycle that was generating ends with a result of its own, then
 *   the model answers the steer, and only then does the original
 *   `session/prompt` settle (the adapter holds the turn for the steer).
 * - `_session/steering` with no turn and `idleBehavior: "promptRequired"`
 *   answers `{ outcome: "promptRequired" }` without starting anything.
 * - `session/cancel` ends the running turn with `stopReason: "cancelled"`.
 *
 * Every JSON-RPC method the adapter receives is appended to `logPath`, one
 * JSON object per line, so tests can assert that no cancel was sent.
 */
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export type FakeSteeringAcpOptions = {
  /** Advertise `_meta.steering.supported`. Default true. */
  steeringSupported?: boolean;
  /** How `_session/steering` behaves during a turn. Default "inject". */
  steerBehavior?: "inject" | "error" | "hang";
  /** How long a prompted turn runs before finishing on its own. */
  turnDurationMs?: number;
  /**
   * Model what real Claude sometimes does when a steer lands during a
   * foreground tool: the adapter moves the tool to the background, Claude ends
   * the turn saying it will wait, and when the command finishes Claude starts
   * a turn of its own (no prompt) that answers the steer. Value: ms until that
   * unprompted turn starts.
   */
  backgroundContinuationMs?: number;
};

export type FakeSteeringAcp = {
  dir: string;
  command: string;
  logPath: string;
  methods(): Array<{ method: string; params?: Record<string, unknown> }>;
};

export function createFakeSteeringAcp(options: FakeSteeringAcpOptions = {}): FakeSteeringAcp {
  const dir = mkdtempSync(join(tmpdir(), "omni-fake-steering-acp-"));
  const command = join(dir, "acp.js");
  const logPath = join(dir, "methods.jsonl");
  const config = {
    steeringSupported: options.steeringSupported ?? true,
    steerBehavior: options.steerBehavior ?? "inject",
    turnDurationMs: options.turnDurationMs ?? 4_000,
    backgroundContinuationMs: options.backgroundContinuationMs ?? 0,
    logPath,
  };
  writeFileSync(command, script(config), { mode: 0o755 });
  return {
    dir,
    command,
    logPath,
    methods() {
      if (!existsSync(logPath)) return [];
      return readFileSync(logPath, "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as { method: string; params?: Record<string, unknown> });
    },
  };
}

function script(config: Required<FakeSteeringAcpOptions> & { logPath: string }) {
  return `#!/usr/bin/env node
const fs = require('fs');
const CONFIG = ${JSON.stringify(config)};
process.stdin.setEncoding('utf8');
let buffer = '';
let sessionId = null;
let sessionCounter = 0;
let toolCalls = 0;
// The running turn: { message, timer, steered }.
let turn = null;

function log(message) {
  fs.appendFileSync(CONFIG.logPath, JSON.stringify({ method: message.method, params: message.params }) + '\\n');
}
function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}
function respond(message, result) {
  write({ jsonrpc: '2.0', id: message.id, result });
}
function fail(message, code, text) {
  write({ jsonrpc: '2.0', id: message.id, error: { code, message: text } });
}
function update(update) {
  write({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update } });
}
function say(text) {
  update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });
}
// The usage update claude-agent-acp sends when the SDK reports a cycle result.
function cycleResult() {
  update({ sessionUpdate: 'usage_update', used: 100, size: 1000, cost: { amount: 0.01, currency: 'USD' } });
}
function promptText(prompt) {
  return (prompt || []).filter((block) => block && block.type === 'text').map((block) => block.text).join('\\n');
}
function finishTurn(stopReason) {
  if (!turn) return;
  const current = turn;
  turn = null;
  clearTimeout(current.timer);
  respond(current.message, { stopReason });
}

function handle(message) {
  if (message.method === 'session/prompt') {
    if (turn) {
      fail(message, -32000, 'prompt already running');
      return;
    }
    const text = promptText(message.params.prompt);
    toolCalls += 1;
    turn = { message, steered: false, timer: null };
    update({ sessionUpdate: 'tool_call', toolCallId: 'tool-' + toolCalls, title: 'Terminal', kind: 'execute', status: 'in_progress' });
    say('Working on: ' + text.slice(-60));
    turn.timer = setTimeout(() => {
      say(' Finished without any steer.');
      cycleResult();
      finishTurn('end_turn');
    }, CONFIG.turnDurationMs);
    return;
  }
  if (message.method === '_session/steering') {
    const idleBehavior = message.params && message.params._meta && message.params._meta.steering
      ? message.params._meta.steering.idleBehavior
      : undefined;
    if (!turn) {
      if (idleBehavior === 'promptRequired') {
        respond(message, { outcome: 'promptRequired', reason: 'noRunningTurn' });
      } else {
        respond(message, { outcome: 'startedNewTurn' });
      }
      return;
    }
    if (CONFIG.steerBehavior === 'error') {
      fail(message, -32603, 'steering exploded');
      return;
    }
    if (CONFIG.steerBehavior === 'hang') {
      return;
    }
    const steerText = promptText(message.params.prompt);
    const current = turn;
    current.steered = true;
    clearTimeout(current.timer);
    respond(message, { outcome: 'injected' });
    // The generating cycle is aborted and reports its own result...
    cycleResult();
    if (CONFIG.backgroundContinuationMs > 0) {
      setTimeout(() => {
        say('The command is still running in the background; I will wait for it to finish.');
        cycleResult();
        setTimeout(() => {
          if (turn === current) finishTurn('end_turn');
        }, 30);
      }, 60);
      setTimeout(() => {
        // The unprompted turn a background task notification starts.
        toolCalls += 1;
        update({ sessionUpdate: 'tool_call', toolCallId: 'tool-' + toolCalls, title: 'Read background output', kind: 'read', status: 'completed' });
        say('Background command finished: FIRST_DONE. Steer received: ' + steerText);
        cycleResult();
      }, CONFIG.backgroundContinuationMs);
      return;
    }
    // ...then the model answers the steer inside the same turn.
    setTimeout(() => {
      say('Steer received: ' + steerText);
      cycleResult();
      setTimeout(() => {
        if (turn === current) finishTurn('end_turn');
      }, 30);
    }, 60);
    return;
  }
  if (message.method === 'session/cancel') {
    finishTurn('cancelled');
    return;
  }
  if (message.id !== undefined) {
    respond(message, {});
  }
}

process.stdin.on('end', () => process.exit(0));
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\\r?\\n/g);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    log(message);
    if (message.method === 'initialize') {
      respond(message, {
        protocolVersion: 1,
        agentCapabilities: { loadSession: true, _meta: { claudeCode: { promptQueueing: true } } },
        authMethods: [],
        _meta: CONFIG.steeringSupported ? { steering: { supported: true } } : {},
      });
    } else if (message.method === 'session/new') {
      sessionCounter += 1;
      sessionId = 'fake-steer-session-' + sessionCounter;
      respond(message, { sessionId });
    } else if (message.method === 'session/load' || message.method === 'session/resume') {
      sessionId = message.params.sessionId;
      respond(message, {});
    } else {
      handle(message);
    }
  }
});
`;
}

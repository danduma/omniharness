/**
 * Regression test for the stale permission-warning bug:
 *
 * A worker accumulates pending permission requests while in an interactive
 * (permission-required) mode. When the session is later switched into a
 * full-access mode, every *new* request is auto-approved — but the already
 * queued requests used to linger in record.pendingPermissions forever. The
 * agent's tool calls stayed blocked on promises no one would resolve, and the
 * UI kept rendering the permission warning triangle even though the mode now
 * grants everything automatically.
 *
 * setMode into a full-access mode must drain the backlog with the same
 * auto-approve decision a live full-access request would have produced.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

const tempDirs: string[] = [];

function createTempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// Minimal ACP CLI: handles initialize + session/new, and answers every other
// request that carries an `id` (e.g. session/set_mode) with an empty result so
// connection.setSessionMode resolves instead of hanging.
const acpScript = `#!/usr/bin/env node
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
      write({ jsonrpc: '2.0', id: message.id, result: { sessionId: 'session-1' } });
    } else {
      write({ jsonrpc: '2.0', id: message.id, result: {} });
    }
  }
});
process.stdin.on('end', () => process.exit(0));
`;

async function startAgent(manager: AgentRuntimeManager, dir: string, name: string) {
  const command = join(dir, `acp-${name}.js`);
  writeFileSync(command, acpScript, { mode: 0o755 });
  return manager.startAgent({ type: "gemini", name, cwd: dir, command, args: [] });
}

function fakePendingPermission(requestId: number, resolve: (value: unknown) => void) {
  return {
    requestId,
    requestedAt: new Date(0).toISOString(),
    resolve,
    params: {
      sessionId: "session-1",
      toolCall: { toolCallId: `tc-${requestId}`, title: `do thing ${requestId}` },
      options: [
        { optionId: "allow_always", name: "Always Allow", kind: "allow_always" },
        { optionId: "allow_once", name: "Allow", kind: "allow_once" },
        { optionId: "reject_once", name: "Reject", kind: "reject_once" },
      ],
    },
  } as never;
}

afterEach(() => {
  __resetNamedEventsForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentRuntimeManager setMode permission draining", () => {
  it("auto-approves queued pending permissions when switching into full-access", async () => {
    const dir = createTempDir("omni-permission-mode-");
    const manager = new AgentRuntimeManager({
      env: { ...process.env, OMNIHARNESS_MEMORY_TRACE: "0" } as Record<string, string>,
    });
    try {
      await startAgent(manager, dir, "perm-drain");
      const record = manager.agents.get("perm-drain")!;

      const resolveA = vi.fn();
      const resolveB = vi.fn();
      record.pendingPermissions.push(fakePendingPermission(1, resolveA));
      record.pendingPermissions.push(fakePendingPermission(2, resolveB));
      expect(record.pendingPermissions.length).toBe(2);

      const result = await manager.setMode("perm-drain", "full-access");

      expect(result.autoApprovedPending).toBe(2);
      expect(record.pendingPermissions.length).toBe(0);
      expect(resolveA).toHaveBeenCalledWith({ outcome: { outcome: "selected", optionId: "allow_always" } });
      expect(resolveB).toHaveBeenCalledWith({ outcome: { outcome: "selected", optionId: "allow_always" } });
    } finally {
      manager.agents.delete("perm-drain");
      manager.shutdownPools();
    }
  });

  it("leaves pending permissions intact when switching into an interactive mode", async () => {
    const dir = createTempDir("omni-permission-mode-keep-");
    const manager = new AgentRuntimeManager({
      env: { ...process.env, OMNIHARNESS_MEMORY_TRACE: "0" } as Record<string, string>,
    });
    try {
      await startAgent(manager, dir, "perm-keep");
      const record = manager.agents.get("perm-keep")!;

      const resolve = vi.fn();
      record.pendingPermissions.push(fakePendingPermission(1, resolve));

      const result = await manager.setMode("perm-keep", "default");

      expect(result.autoApprovedPending).toBe(0);
      expect(record.pendingPermissions.length).toBe(1);
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      manager.agents.delete("perm-keep");
      manager.shutdownPools();
    }
  });
});

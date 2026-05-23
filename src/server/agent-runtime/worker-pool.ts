/**
 * Pre-warmed ACP worker connections (gemini, codex, claude, opencode). The
 * pool keeps a small number of child processes per (type, cwd, model, mode,
 * mcp, skills, env-fingerprint) tuple that have already completed `initialize`
 * and `newSession`, so a worker spawn for a matching tuple can hand off in a
 * few milliseconds instead of paying the multi-second ACP cold-start.
 *
 * Pool members are NOT registered in `manager.agents` — they live here until
 * `checkout()` returns them, at which point the manager builds an
 * `AgentRecord` over the same child/connection/session and binds it.
 */
import { createHash } from "crypto";
import type { ChildProcessWithoutNullStreams } from "child_process";
import type * as acp from "@agentclientprotocol/sdk";
import type { AgentRecord } from "./types";

export type WorkerPoolMember = {
  key: string;
  type: string;
  cwd: string;
  recordRef: { current?: AgentRecord };
  client: acp.Client;
  stderrBuffer: string[];
  child: ChildProcessWithoutNullStreams;
  connection: acp.ClientSideConnection;
  init: unknown;
  session: unknown;
  sessionId: string;
  protocolVersion: string | number | null;
  warmedAt: number;
};

export type WorkerPoolKeyInput = {
  type: string;
  cwd: string;
  model: string | null;
  mode: string | null;
  mcpServers: acp.McpServer[];
  skillRoots: string[];
  envFingerprint: string;
};

const POOL_MEMBER_MAX_AGE_MS = 30 * 60_000;

export function computeEnvFingerprint(env: NodeJS.ProcessEnv): string {
  const relevant: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v !== "string") continue;
    if (
      k.startsWith("GEMINI_") ||
      k.startsWith("GOOGLE_") ||
      k.startsWith("OPENAI_") ||
      k.startsWith("ANTHROPIC_") ||
      k.startsWith("OPENCODE_") ||
      k.includes("API_KEY") ||
      k === "PATH" ||
      k === "HOME"
    ) {
      relevant[k] = v;
    }
  }
  const sorted = Object.keys(relevant)
    .sort()
    .map((k) => `${k}=${relevant[k]}`)
    .join("\n");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

export function computeWorkerPoolKey(input: WorkerPoolKeyInput): string {
  const payload = JSON.stringify({
    type: input.type,
    cwd: input.cwd,
    model: input.model || null,
    mode: input.mode || null,
    mcp: input.mcpServers,
    skills: input.skillRoots,
    env: input.envFingerprint,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export class WorkerPool {
  private readonly members = new Map<string, WorkerPoolMember[]>();
  private readonly inFlight = new Map<string, number>();
  private maxPerKey = 1;

  add(member: WorkerPoolMember): void {
    if (!this.isAlive(member)) {
      this.disposeMember(member);
      return;
    }
    const arr = this.members.get(member.key) ?? [];
    arr.push(member);
    this.members.set(member.key, arr);
    const exitHandler = () => {
      this.removeMemberInstance(member);
    };
    member.child.once("exit", exitHandler);
  }

  checkout(key: string): WorkerPoolMember | null {
    const arr = this.members.get(key);
    if (!arr) return null;
    while (arr.length > 0) {
      const member = arr.shift()!;
      if (this.isAlive(member) && Date.now() - member.warmedAt < POOL_MEMBER_MAX_AGE_MS) {
        if (arr.length === 0) this.members.delete(key);
        return member;
      }
      this.disposeMember(member);
    }
    this.members.delete(key);
    return null;
  }

  needsWarm(key: string): boolean {
    const current = (this.members.get(key)?.length ?? 0) + (this.inFlight.get(key) ?? 0);
    return current < this.maxPerKey;
  }

  beginInFlight(key: string): void {
    this.inFlight.set(key, (this.inFlight.get(key) ?? 0) + 1);
  }

  endInFlight(key: string): void {
    const v = (this.inFlight.get(key) ?? 0) - 1;
    if (v <= 0) this.inFlight.delete(key);
    else this.inFlight.set(key, v);
  }

  setMaxPerKey(n: number): void {
    this.maxPerKey = Math.max(0, Math.floor(n));
  }

  countMembers(key: string): number {
    return this.members.get(key)?.length ?? 0;
  }

  countAll(): number {
    let total = 0;
    for (const arr of this.members.values()) total += arr.length;
    return total;
  }

  shutdown(): void {
    for (const arr of this.members.values()) {
      for (const member of arr) this.disposeMember(member);
    }
    this.members.clear();
    this.inFlight.clear();
  }

  private removeMemberInstance(member: WorkerPoolMember): void {
    const arr = this.members.get(member.key);
    if (!arr) return;
    const idx = arr.indexOf(member);
    if (idx >= 0) arr.splice(idx, 1);
    if (arr.length === 0) this.members.delete(member.key);
  }

  private isAlive(member: WorkerPoolMember): boolean {
    return member.child.exitCode === null && member.child.signalCode === null;
  }

  private disposeMember(member: WorkerPoolMember): void {
    try {
      member.child.kill("SIGTERM");
    } catch {
      // best-effort
    }
  }
}

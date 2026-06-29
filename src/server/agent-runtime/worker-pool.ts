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
      k.startsWith("CLAUDE_") ||
      k.startsWith("CODEX_") ||
      k.startsWith("OPENCODE_") ||
      k.startsWith("XDG_") ||
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
  private maxTotal = Number.POSITIVE_INFINITY;

  add(member: WorkerPoolMember): void {
    if (!this.isAlive(member)) {
      this.disposeMember(member);
      return;
    }
    // Defense-in-depth cap enforcement. tryBeginWarm is the primary gate;
    // here we only consider materialized members. Including in-flight in this
    // comparison would double-count the caller's own reservation (still held
    // by their in-flight counter until their finally runs), and evict a
    // perfectly good existing member to make room for a slot that was
    // already accounted for.
    while (this.countAll() >= this.maxTotal) {
      if (!this.evictOldest()) break;
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

  /**
   * Atomic "check + reserve". Returns true if the caller may proceed with a
   * warm spawn (and MUST call endInFlight when done); false if a warm is
   * already in flight or the per-key/global cap is reached. Eliminates the
   * needsWarm/beginInFlight race when concurrent prewarm requests arrive.
   */
  tryBeginWarm(key: string): boolean {
    const memberCount = this.members.get(key)?.length ?? 0;
    const inFlightCount = this.inFlight.get(key) ?? 0;
    if (memberCount + inFlightCount >= this.maxPerKey) return false;
    if (this.countAll() + this.countAllInFlight() >= this.maxTotal) return false;
    this.inFlight.set(key, inFlightCount + 1);
    return true;
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

  setMaxTotal(n: number): void {
    this.maxTotal = Number.isFinite(n) && n > 0 ? Math.floor(n) : Number.POSITIVE_INFINITY;
  }

  countMembers(key: string): number {
    return this.members.get(key)?.length ?? 0;
  }

  countAll(): number {
    let total = 0;
    for (const arr of this.members.values()) total += arr.length;
    return total;
  }

  countAllInFlight(): number {
    let total = 0;
    for (const v of this.inFlight.values()) total += v;
    return total;
  }

  /**
   * Disposes pool members older than maxAgeMs even if no one ever checks them
   * out. Without this, members whose pool key is no longer requested (e.g.
   * user switched model) would live forever until the key happened to be
   * accessed again. Returns the number of members evicted.
   */
  sweepExpired(maxAgeMs: number): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, arr] of this.members) {
      const keep: WorkerPoolMember[] = [];
      for (const member of arr) {
        if (!this.isAlive(member) || now - member.warmedAt >= maxAgeMs) {
          this.disposeMember(member);
          evicted++;
        } else {
          keep.push(member);
        }
      }
      if (keep.length === 0) this.members.delete(key);
      else this.members.set(key, keep);
    }
    return evicted;
  }

  /**
   * Disposes the single oldest live member globally. Used when adding a new
   * member would exceed maxTotal. Returns true if a member was evicted.
   */
  private evictOldest(): boolean {
    let oldestKey: string | null = null;
    let oldestIdx = -1;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, arr] of this.members) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].warmedAt < oldestAt) {
          oldestAt = arr[i].warmedAt;
          oldestKey = key;
          oldestIdx = i;
        }
      }
    }
    if (oldestKey === null || oldestIdx < 0) return false;
    const arr = this.members.get(oldestKey);
    if (!arr) return false;
    const [member] = arr.splice(oldestIdx, 1);
    if (arr.length === 0) this.members.delete(oldestKey);
    this.disposeMember(member);
    return true;
  }

  shutdown(): void {
    for (const arr of this.members.values()) {
      for (const member of arr) this.disposeMember(member);
    }
    this.members.clear();
    this.inFlight.clear();
  }

  evictAll(): number {
    const total = this.countAll();
    for (const arr of this.members.values()) {
      for (const member of arr) this.disposeMember(member);
    }
    this.members.clear();
    return total;
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

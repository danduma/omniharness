import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";
import { WorkerPool, type WorkerPoolMember } from "@/server/agent-runtime/worker-pool";

type FakeChild = EventEmitter & {
  pid: number;
  exitCode: number | null;
  signalCode: string | null;
  kill: ReturnType<typeof vi.fn>;
  simulateExit: (code?: number | null, signal?: string | null) => void;
};

function fakeChild(pid = Math.floor(Math.random() * 100000)): FakeChild {
  const emitter = new EventEmitter() as FakeChild;
  emitter.pid = pid;
  emitter.exitCode = null;
  emitter.signalCode = null;
  emitter.kill = vi.fn((signal?: string) => {
    if (emitter.exitCode === null && emitter.signalCode === null) {
      emitter.signalCode = signal ?? "SIGTERM";
      queueMicrotask(() => emitter.emit("exit", null, emitter.signalCode));
    }
    return true;
  });
  emitter.simulateExit = (code = 0, signal = null) => {
    emitter.exitCode = code;
    emitter.signalCode = signal;
    emitter.emit("exit", code, signal);
  };
  return emitter;
}

function makeMember(key: string, opts: { warmedAt?: number; child?: FakeChild } = {}): WorkerPoolMember {
  return {
    key,
    type: "gemini",
    cwd: "/tmp",
    recordRef: {},
    client: {} as WorkerPoolMember["client"],
    stderrBuffer: [],
    child: (opts.child ?? fakeChild()) as unknown as WorkerPoolMember["child"],
    connection: {} as WorkerPoolMember["connection"],
    init: null,
    session: null,
    sessionId: `s-${key}-${opts.warmedAt ?? Date.now()}`,
    protocolVersion: 1,
    warmedAt: opts.warmedAt ?? Date.now(),
  };
}

describe("WorkerPool atomic warm reservation", () => {
  it("tryBeginWarm returns true once per slot and false thereafter under maxPerKey=1", () => {
    const pool = new WorkerPool();
    pool.setMaxPerKey(1);
    expect(pool.tryBeginWarm("k1")).toBe(true);
    // Second concurrent call must NOT pass even though no member has been added yet.
    expect(pool.tryBeginWarm("k1")).toBe(false);
    pool.endInFlight("k1");
    expect(pool.tryBeginWarm("k1")).toBe(true);
  });

  it("tryBeginWarm respects the global maxTotal across keys", () => {
    const pool = new WorkerPool();
    pool.setMaxPerKey(2);
    pool.setMaxTotal(2);
    expect(pool.tryBeginWarm("k1")).toBe(true);
    expect(pool.tryBeginWarm("k2")).toBe(true);
    // Third reservation across any key exceeds the global cap.
    expect(pool.tryBeginWarm("k3")).toBe(false);
    pool.endInFlight("k1");
    expect(pool.tryBeginWarm("k3")).toBe(true);
  });
});

describe("WorkerPool global cap + LRU eviction", () => {
  it("add() evicts the oldest member when maxTotal would be exceeded", () => {
    const pool = new WorkerPool();
    pool.setMaxPerKey(5);
    pool.setMaxTotal(2);

    const oldChild = fakeChild();
    const midChild = fakeChild();
    const newChild = fakeChild();

    const oldMember = makeMember("k-old", { warmedAt: 1_000, child: oldChild });
    const midMember = makeMember("k-mid", { warmedAt: 2_000, child: midChild });
    const newMember = makeMember("k-new", { warmedAt: 3_000, child: newChild });

    pool.add(oldMember);
    pool.add(midMember);
    expect(pool.countAll()).toBe(2);

    pool.add(newMember);

    // Oldest evicted; new member admitted.
    expect(pool.countAll()).toBe(2);
    expect(oldChild.kill).toHaveBeenCalledWith("SIGTERM");
    expect(midChild.kill).not.toHaveBeenCalled();
    expect(newChild.kill).not.toHaveBeenCalled();
  });
});

describe("WorkerPool periodic sweep", () => {
  it("sweepExpired disposes members past maxAgeMs even when never checked out", () => {
    const pool = new WorkerPool();
    pool.setMaxPerKey(5);

    const oldChild = fakeChild();
    const youngChild = fakeChild();
    const oldMember = makeMember("k-old", { warmedAt: Date.now() - 60_000, child: oldChild });
    const youngMember = makeMember("k-young", { warmedAt: Date.now(), child: youngChild });

    pool.add(oldMember);
    pool.add(youngMember);
    expect(pool.countAll()).toBe(2);

    const evicted = pool.sweepExpired(30_000);
    expect(evicted).toBe(1);
    expect(oldChild.kill).toHaveBeenCalledWith("SIGTERM");
    expect(youngChild.kill).not.toHaveBeenCalled();
    expect(pool.countAll()).toBe(1);
  });

  it("sweepExpired also evicts already-exited members", () => {
    const pool = new WorkerPool();
    pool.setMaxPerKey(5);
    const child = fakeChild();
    const member = makeMember("k", { child });
    pool.add(member);
    expect(pool.countAll()).toBe(1);

    // Mark exited without firing the "exit" event so the add()-registered
    // handler doesn't remove the member. sweepExpired must still notice that
    // it is dead and dispose it, independent of age.
    child.exitCode = 1;
    const evicted = pool.sweepExpired(Number.MAX_SAFE_INTEGER);
    expect(evicted).toBe(1);
    expect(pool.countAll()).toBe(0);
  });
});

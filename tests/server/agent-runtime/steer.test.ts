/**
 * In-turn steering through ACP `_session/steering`.
 *
 * A steer used to be cancel-and-replace: the runtime cancelled the running
 * turn and sent the message as a new prompt. Claude then saw its own turn end
 * with "[Request interrupted by user]" and read the steer as the user
 * cancelling its work. `steerAgent` delivers the message into the running
 * turn instead, and must never leave the agent unusable when that fails.
 */
import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "fs";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { __getRingForTests, __resetNamedEventsForTests } from "@/server/events/named-events";
import { createFakeSteeringAcp, type FakeSteeringAcpOptions } from "@/../tests/helpers/fake-steering-acp";

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

async function startAgent(options: FakeSteeringAcpOptions = {}, env: Record<string, string> = {}) {
  const fake = createFakeSteeringAcp(options);
  tempDirs.push(fake.dir);
  const manager = new AgentRuntimeManager({
    env: {
      ...process.env,
      OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "10000",
      OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
      OMNIHARNESS_MEMORY_TRACE: "0",
      // Short enough that a steer mistaken for an absorbed prompt would fail
      // the test, long enough for the fake's 60ms gap after the aborted cycle.
      OMNIHARNESS_ABSORBED_PROMPT_QUIET_MS: "400",
      ...env,
    } as Record<string, string>,
  });
  managers.push(manager);
  await manager.startAgent({ type: "gemini", name: "worker", cwd: fake.dir, command: fake.command, args: [] });
  return { manager, fake };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function eventsOfKind(kind: string) {
  return __getRingForTests().filter((entry) => entry.event.kind === kind).map((entry) => entry.event as Record<string, unknown>);
}

function methodNames(fake: { methods(): Array<{ method: string }> }) {
  return fake.methods().map((entry) => entry.method);
}

describe("AgentRuntimeManager.steerAgent", () => {
  it("reads steering support from the top-level initialize _meta", async () => {
    const supported = await startAgent();
    expect(supported.manager.agents.get("worker")?.steeringSupported).toBe(true);
  });

  it("injects into the running turn without cancelling it, and the original prompt carries the reply", async () => {
    const { manager, fake } = await startAgent();

    const ask = manager.askAgent("worker", "Refactor the parser");
    await waitUntil(() => manager.agents.get("worker")!.currentText.includes("Working on"));

    const entriesBeforeSteer = manager.agents.get("worker")!.outputEntries.map((entry) => entry.id);
    const steer = await manager.steerAgent("worker", "Also keep the old API exported");
    expect(steer).toMatchObject({ name: "worker", outcome: "injected" });
    expect(steer.outcome === "injected" && steer.outputBoundaryEntryId).toBe(entriesBeforeSteer.at(-1));

    const result = await ask;
    expect(result.stopReason).toBe("end_turn");
    expect(result.state).toBe("idle");
    expect(result.response).toContain("Working on");
    expect(result.response).toContain("Steer received: Also keep the old API exported");

    const methods = methodNames(fake);
    expect(methods).toContain("_session/steering");
    expect(methods).not.toContain("session/cancel");
    expect(methods.filter((method) => method === "session/prompt")).toHaveLength(1);

    const steerCall = fake.methods().find((entry) => entry.method === "_session/steering")!;
    expect(steerCall.params?._meta).toEqual({ steering: { idleBehavior: "promptRequired" } });

    // The aborted cycle's result must not be mistaken for an absorbed prompt.
    expect(eventsOfKind("acp.prompt_absorbed")).toHaveLength(0);
    expect(eventsOfKind("acp.steer_injected")).toHaveLength(1);

    // The reply to the steer is its own message entry, not glued onto the
    // text that was streaming when the steer landed.
    const record = manager.agents.get("worker")!;
    const messages = record.outputEntries.filter((entry) => entry.type === "message").map((entry) => entry.text);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("Working on");
    expect(messages[0]).not.toContain("Steer received");
    expect(messages[1]).toContain("Steer received");

    // The worker accepts a normal prompt afterwards.
    const next = manager.askAgent("worker", "Next task");
    await waitUntil(() => manager.agents.get("worker")!.currentText.includes("Working on"));
    await manager.steerAgent("worker", "wrap up");
    await expect(next).resolves.toMatchObject({ stopReason: "end_turn" });
  });

  it("accepts two steers in a row into the same turn", async () => {
    const { manager, fake } = await startAgent({ turnDurationMs: 4_000 });
    const ask = manager.askAgent("worker", "Long job");
    await waitUntil(() => manager.agents.get("worker")!.currentText.includes("Working on"));

    await expect(manager.steerAgent("worker", "first steer")).resolves.toMatchObject({ outcome: "injected" });
    // The second steer lands while the first is being answered: the turn is
    // still open, so it is injected too.
    await expect(manager.steerAgent("worker", "second steer")).resolves.toMatchObject({ outcome: "injected" });

    const result = await ask;
    expect(result.response).toContain("Steer received: first steer");
    expect(methodNames(fake)).not.toContain("session/cancel");
  });

  it("returns promptRequired without calling the adapter when no prompt is in flight", async () => {
    const { manager, fake } = await startAgent();
    const result = await manager.steerAgent("worker", "hello");
    expect(result).toEqual({ name: "worker", outcome: "promptRequired", reason: "no_prompt_in_flight" });
    expect(methodNames(fake)).not.toContain("_session/steering");
  });

  it("returns promptRequired without calling the adapter when steering is not advertised", async () => {
    const { manager, fake } = await startAgent({ steeringSupported: false });
    expect(manager.agents.get("worker")?.steeringSupported).toBe(false);
    const ask = manager.askAgent("worker", "Do work");
    await waitUntil(() => manager.agents.get("worker")!.currentText.includes("Working on"));

    const result = await manager.steerAgent("worker", "steer");
    expect(result).toEqual({ name: "worker", outcome: "promptRequired", reason: "unsupported" });
    expect(methodNames(fake)).not.toContain("_session/steering");

    await manager.cancelAgentTurn("worker");
    await expect(ask).resolves.toMatchObject({ stopReason: "cancelled" });
  });

  it("reports failed, not a throw, when the adapter rejects the steer, and the agent stays usable", async () => {
    const { manager } = await startAgent({ steerBehavior: "error" });
    const ask = manager.askAgent("worker", "Do work");
    await waitUntil(() => manager.agents.get("worker")!.currentText.includes("Working on"));

    const result = await manager.steerAgent("worker", "steer");
    expect(result.outcome).toBe("failed");
    expect(eventsOfKind("error.surfaced").some((event) => event.code === "worker.steer.failed")).toBe(true);
    const record = manager.agents.get("worker")!;
    expect(record.state).toBe("working");
    expect(record.promptInFlight).toBe(true);

    // The caller's fallback: cancel and re-prompt. Both must work.
    await manager.cancelAgentTurn("worker");
    await expect(ask).resolves.toMatchObject({ stopReason: "cancelled" });
    const retry = manager.askAgent("worker", "steer");
    await waitUntil(() => manager.agents.get("worker")!.promptInFlight === true);
    await manager.cancelAgentTurn("worker");
    await expect(retry).resolves.toMatchObject({ stopReason: "cancelled" });
  });

  it("times out a wedged steer request and reports failed so the caller can fall back", async () => {
    const { manager } = await startAgent({ steerBehavior: "hang" }, { OMNIHARNESS_STEER_TIMEOUT_MS: "200" });
    const ask = manager.askAgent("worker", "Do work");
    await waitUntil(() => manager.agents.get("worker")!.currentText.includes("Working on"));

    const startedAt = Date.now();
    const result = await manager.steerAgent("worker", "steer");
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(result.outcome).toBe("failed");
    expect(result.outcome === "failed" && result.reason).toContain("timed out");

    await manager.cancelAgentTurn("worker");
    await expect(ask).resolves.toMatchObject({ stopReason: "cancelled" });
  });

  it("returns promptRequired when the turn ended between the runtime check and the adapter", async () => {
    // The runtime still believes a prompt is in flight, but the adapter has no
    // turn: it must hand the message back instead of starting a detached turn.
    const { manager, fake } = await startAgent();
    const record = manager.agents.get("worker")!;
    record.promptInFlight = true;
    try {
      const result = await manager.steerAgent("worker", "late steer");
      expect(result).toEqual({ name: "worker", outcome: "promptRequired", reason: "adapter_idle" });
      expect(methodNames(fake)).toContain("_session/steering");
      expect(methodNames(fake)).not.toContain("session/prompt");
    } finally {
      record.promptInFlight = false;
    }
  });

  it("404s for an unknown worker", async () => {
    const { manager } = await startAgent();
    await expect(manager.steerAgent("nope", "x")).rejects.toMatchObject({ statusCode: 404 });
  });
});

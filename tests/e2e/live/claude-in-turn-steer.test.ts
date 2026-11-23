/**
 * Live check of in-turn steering against the real claude-agent-acp adapter
 * and a real Claude model. Opt-in, because it spends real model usage:
 *
 *   OMNIHARNESS_LIVE_CLAUDE_STEER=1 pnpm vitest run -c vitest.live.config.ts tests/e2e/live/claude-in-turn-steer.test.ts
 *
 * It asserts the outcome the user cares about: a message sent while Claude is
 * working reaches the running turn, Claude acts on it, the session never sees
 * a cancel, and Claude does not describe the steer as the user cancelling or
 * rejecting anything.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { __getRingForTests } from "@/server/events/named-events";

const LIVE = process.env.OMNIHARNESS_LIVE_CLAUDE_STEER === "1";
const describeLive = LIVE ? describe : describe.skip;

// Phrases Claude uses when it believes the user stopped or rejected its work.
const CANCELLATION_TALK = /\b(cancel(l)?ed|interrupted|rejected|declined|you stopped|stopped me|didn'?t want)\b/i;

let manager: AgentRuntimeManager;
let cwd: string;

async function waitUntil(predicate: () => boolean, timeoutMs: number, label: string) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function eventKinds(workerId: string) {
  return __getRingForTests()
    .map((entry) => entry.event as { kind: string; workerId?: string; method?: string })
    .filter((event) => event.workerId === workerId);
}

describeLive("live Claude: steering a running turn", () => {
  beforeAll(async () => {
    cwd = mkdtempSync(join(tmpdir(), "omni-live-steer-"));
    manager = new AgentRuntimeManager({
      env: {
        ...process.env,
        OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS: "60000",
        OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS: "999999",
        OMNIHARNESS_MEMORY_TRACE: "0",
      } as Record<string, string>,
    });
  }, 60_000);

  afterAll(async () => {
    for (const name of [...manager.agents.keys()]) {
      await manager.stopAgent(name).catch(() => undefined);
    }
    manager.shutdownPools();
    rmSync(cwd, { recursive: true, force: true });
  });

  it("advertises steering", async () => {
    await manager.startAgent({ type: "claude", name: "live-steer-tool", cwd, mode: "full-access" });
    expect(manager.agents.get("live-steer-tool")?.steeringSupported).toBe(true);
  }, 120_000);

  it("steers while a Bash tool call is running", async () => {
    const name = "live-steer-tool";
    const ask = manager.askAgent(
      name,
      "Use the Bash tool to run exactly this command: sleep 20 && echo FIRST_DONE\n"
      + "Wait for it to finish, then reply with one short sentence saying what it printed.",
    );
    await waitUntil(
      () => manager.agents.get(name)!.outputEntries.some((entry) => entry.type === "tool_call"),
      90_000,
      "Claude to start the Bash tool call",
    );
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    const steer = await manager.steerAgent(
      name,
      "One more thing: in your final reply, also include the word PINEAPPLE.",
    );
    expect(steer.outcome).toBe("injected");

    const result = await ask;
    console.log("[live steer: tool] response:\n" + result.response);
    expect(result.stopReason).not.toBe("cancelled");
    expect(result.response).not.toMatch(CANCELLATION_TALK);
    const methods = eventKinds(name).filter((event) => event.kind === "acp.method_completed").map((event) => event.method);
    expect(methods).not.toContain("session/cancel");

    // Like Claude Code, the adapter moves a foreground tool to the background
    // when a steer arrives during it. Claude may answer the steer before the
    // command finishes and continue on its own when it does, so the steer's
    // effect is checked across everything Claude writes until then.
    const states: string[] = [];
    const messageText = () => manager.agents.get(name)!.outputEntries
      .filter((entry) => entry.type === "message")
      .map((entry) => entry.text)
      .join("\n");
    await waitUntil(() => {
      const state = manager.agents.get(name)!.state;
      if (states.at(-1) !== state) states.push(state);
      return /PINEAPPLE/.test(messageText()) && /FIRST_DONE/.test(messageText()) && state === "idle";
    }, 90_000, "Claude to act on the steer and report the command output");
    console.log("[live steer: tool] states after ask:", states.join(" -> "));
    console.log("[live steer: tool] all messages:\n" + messageText());
    expect(messageText()).not.toMatch(CANCELLATION_TALK);
  }, 240_000);

  it("steers while Claude is writing a long answer", async () => {
    const name = "live-steer-tool";
    const ask = manager.askAgent(
      name,
      "Without using any tools, write a numbered list of 60 different one-sentence facts about the ocean.",
    );
    await waitUntil(
      () => manager.agents.get(name)!.currentText.length > 300,
      90_000,
      "Claude to be partway through the list",
    );

    const steer = await manager.steerAgent(
      name,
      "Change of plan: stop the list. Reply with only the word MANGO and nothing else.",
    );
    expect(steer.outcome).toBe("injected");

    const result = await ask;
    const textAfterSteer = result.response.slice(result.response.lastIndexOf("MANGO") - 200);
    console.log("[live steer: generation] tail of response:\n" + result.response.slice(-600));
    expect(result.stopReason).not.toBe("cancelled");
    expect(result.response).toMatch(/MANGO/);
    expect(textAfterSteer).not.toMatch(CANCELLATION_TALK);
    expect(manager.agents.get(name)!.state).toBe("idle");
  }, 240_000);

  it("keeps the session usable after steering", async () => {
    const name = "live-steer-tool";
    const result = await manager.askAgent(name, "Reply with only the word KIWI.");
    console.log("[live steer: follow-up] response:\n" + result.response);
    expect(result.response).toMatch(/KIWI/);
    expect(result.stopReason).toBe("end_turn");
  }, 120_000);
});

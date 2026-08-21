import { describe, expect, it } from "vitest";
import { withWorkspaceMutationLock } from "@/server/handoff/workspace-lock";

describe("handoff workspace mutation lock", () => {
  it("serializes mutations addressed through equivalent checkout paths", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = withWorkspaceMutationLock("/tmp/omni-workspace", async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
    });
    const second = withWorkspaceMutationLock("/tmp/omni-workspace/../omni-workspace", async () => {
      events.push("second:start");
      events.push("second:end");
    });
    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});

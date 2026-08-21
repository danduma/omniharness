import { describe, expect, it } from "vitest";
import { validateTargetLaunchOptions } from "@/server/handoff/service";

describe("handoff target launch options", () => {
  it("accepts catalog models and recognized Claude aliases", async () => {
    await expect(validateTargetLaunchOptions({ workerType: "codex", model: "gpt-5.6-sol", effort: "ultra", accountId: null })).resolves.toBeUndefined();
    await expect(validateTargetLaunchOptions({ workerType: "claude", model: "opus", effort: "xhigh", accountId: null })).resolves.toBeUndefined();
  });

  it("rejects unknown models and CLI-incompatible effort levels before source termination", async () => {
    await expect(validateTargetLaunchOptions({ workerType: "claude", model: "claude-garbage", effort: null, accountId: null })).rejects.toMatchObject({ code: "handoff_target_unavailable" });
    await expect(validateTargetLaunchOptions({ workerType: "gemini", model: "gemini-3", effort: "ultra", accountId: null })).rejects.toMatchObject({ code: "handoff_target_unavailable" });
  });
});

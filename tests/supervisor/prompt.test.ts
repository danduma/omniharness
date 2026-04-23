import { describe, expect, it } from "vitest";
import { SUPERVISOR_SYSTEM_PROMPT } from "@/server/prompts";

describe("SUPERVISOR_SYSTEM_PROMPT", () => {
  it("guides permission decisions across all agents with extra caution for destructive actions", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Permission handling");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("pendingPermissions");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("any agent");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Prefer allow_always for Claude");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("destructive");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("backed up");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("worker_approve");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("worker_deny");
  });
});

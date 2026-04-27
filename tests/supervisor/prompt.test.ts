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

  it("tells the supervisor to rely on compacted memory when the raw transcript is trimmed", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Context window handling");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Prior supervision memory");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("compacted");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("current supervision snapshot");
  });

  it("gates completion on the original objective and allows repeated clarification", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Objective and completion gate");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("original user intent");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("not merely the checklist");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("as many clarification turns as needed");
  });

  it("requires independent validation against mocks and fake product paths", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Independent validation");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("separate validator");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("mocked path");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("fake control");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("actually exercises the real path");
  });
});

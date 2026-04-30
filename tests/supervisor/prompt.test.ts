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

  it("forbids duplicate main implementers unless work is explicitly separated", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Single-worker allocation");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Do not spawn two main implementation workers for the same plan");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("part A");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("part B");
  });

  it("requires preflight intent confirmation before starting workers", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Preflight intent confirmation");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("before the first worker_spawn");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("extract the user's intent from the plan");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("summarize what you understand the job to be");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("ask_user");
  });

  it("requires preflight to summarize why-level outcomes instead of the artifact title", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("why-level intent");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("specific outcomes");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("success conditions");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Do not ask the user to confirm");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("implement this spec");
  });

  it("requires reading referenced files before asking the user to summarize them", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("use read_file");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("referenced spec");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Do not ask the user to summarize");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("file you can read");
  });

  it("directs targeted repository inspection instead of repeated full-file reads", () => {
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("Use inspect_repo");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("rg/grep");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("sed/awk/head/tail/wc");
    expect(SUPERVISOR_SYSTEM_PROMPT).toContain("repeated full-file reads");
  });
});

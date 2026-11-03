import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentUpdatesManager, buildAgentUpdateCommand } from "@/server/runner/agent-updates";
import { __getRingForTests } from "@/server/events/named-events";

const managers: AgentUpdatesManager[] = [];
function fixture(code: string, timeoutMs = 10_000) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oh-agent-updates-"));
  const manager = new AgentUpdatesManager({
    repositoryRoot: root, stateRoot: root, timeoutMs,
    command: { command: process.execPath, args: ["-e", code] },
  });
  managers.push(manager);
  return { root, manager };
}
function events(root: string) {
  return __getRingForTests().flatMap((entry) =>
    "path" in entry.event && entry.event.path === path.join(root, "agent-updates.log") ? [entry.event] : []);
}
afterEach(async () => { for (const manager of managers.splice(0)) await manager.stop(); });

describe("background agent updates", () => {
  it("selects the existing installer on Unix and Windows", () => {
    expect(buildAgentUpdateCommand("/repo", "darwin")).toEqual({
      command: "/bin/bash", args: ["/repo/scripts/install-agent-acp.sh", "--ensure-only"],
    });
    expect(buildAgentUpdateCommand("C:\\repo", "win32").args).toContain("C:\\repo\\scripts\\install-agent-acp.ps1");
  });

  it("starts without waiting for a hung download and stops its owned child", async () => {
    const { root, manager } = fixture("setInterval(() => {}, 1000)");
    expect(manager.start()).toBeUndefined();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_started")).toBe(true));
    await manager.stop();
    expect(events(root).some(e => e.kind === "agent.update_cancelled")).toBe(true);
  });

  it("logs successful completion without blocking the runner", async () => {
    const { root, manager } = fixture("console.log('updated')");
    manager.start();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_completed")).toBe(true));
    expect(fs.readFileSync(path.join(root, "agent-updates.log"), "utf8")).toContain("updated");
  });

  it("surfaces installer failure without throwing into the runner", async () => {
    const { root, manager } = fixture("process.exit(17)");
    manager.start();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_failed")).toBe(true));
    expect(events(root).some(e => e.kind === "error.surfaced" && e.code === "agent.update_failed")).toBe(true);
  });

  it("bounds a stuck update and releases its lock", async () => {
    const { root, manager } = fixture("setInterval(() => {}, 1000)", 100);
    manager.start();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_failed" && e.reason.includes("timed out"))).toBe(true));
    expect(fs.existsSync(path.join(root, "agent-updates.lock"))).toBe(false);
  });

  it("retries maintenance on its schedule after a failed attempt", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "oh-agent-updates-"));
    const manager = new AgentUpdatesManager({
      repositoryRoot: root, stateRoot: root, intervalMs: 20,
      command: { command: process.execPath, args: ["-e", "process.exit(17)"] },
    });
    managers.push(manager);
    manager.start();
    await vi.waitFor(() => expect(events(root).filter(e => e.kind === "agent.update_failed").length).toBeGreaterThanOrEqual(2));
  });

  it("reports a missing installer as a failure and releases its lock", async () => {
    const { root, manager } = fixture("");
    const missing = new AgentUpdatesManager({
      repositoryRoot: root, stateRoot: root,
      command: { command: path.join(root, "absent-installer"), args: [] },
    });
    managers.push(missing);
    missing.start();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_failed")).toBe(true));
    expect(fs.existsSync(path.join(root, "agent-updates.lock"))).toBe(false);
    await manager.stop();
  });

  it("does not allow two runners to update the same installation concurrently", async () => {
    const { root, manager } = fixture("setInterval(() => {}, 1000)");
    manager.start();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_started")).toBe(true));
    const other = new AgentUpdatesManager({ repositoryRoot: root, stateRoot: root });
    managers.push(other);
    other.start();
    await vi.waitFor(() => expect(events(root).some(e => e.kind === "agent.update_skipped")).toBe(true));
    expect(events(root).filter(e => e.kind === "agent.update_started")).toHaveLength(1);
  });
});

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SupervisorProtocolError } from "@/server/supervisor/protocol";
import { appendMemory, listMemory, readMemory, writeMemory } from "@/server/supervisor/memory-tools";
import { getMemoryRoot } from "@/server/supervisor/memory-paths";

let projectPath: string;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-memory-tools-"));
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("memory-tools", () => {
  it("returns empty list when no memory directory exists", () => {
    expect(listMemory(projectPath)).toEqual([]);
  });

  it("creates the memory root lazily on write", () => {
    writeMemory(projectPath, "overview.md", "# Overview");
    expect(fs.existsSync(getMemoryRoot(projectPath))).toBe(true);
    expect(fs.readFileSync(path.join(getMemoryRoot(projectPath), "overview.md"), "utf8")).toBe("# Overview");
  });

  it("lists files after writes, sorted alphabetically", () => {
    writeMemory(projectPath, "zeta.md", "z");
    writeMemory(projectPath, "alpha.md", "a");
    const listed = listMemory(projectPath).map((entry) => entry.path);
    expect(listed).toEqual(["alpha.md", "zeta.md"]);
  });

  it("reads back what was written and reports byte sizes", () => {
    writeMemory(projectPath, "decisions.md", "Decision: use SQLite");
    const read = readMemory(projectPath, "decisions.md");
    expect(read.content).toBe("Decision: use SQLite");
    expect(read.truncated).toBe(false);
    expect(read.size).toBeGreaterThan(0);
  });

  it("truncates oversized reads at the budget", () => {
    const big = "x".repeat(5_000);
    writeMemory(projectPath, "overview.md", big);
    const read = readMemory(projectPath, "overview.md", { maxBytes: 100 });
    expect(read.truncated).toBe(true);
    expect(read.content.length).toBe(100);
  });

  it("appends with separating newline if needed", () => {
    writeMemory(projectPath, "gotchas.md", "line 1");
    appendMemory(projectPath, "gotchas.md", "line 2");
    const read = readMemory(projectPath, "gotchas.md");
    expect(read.content).toBe("line 1\nline 2");
  });

  it("appends without doubling a newline when source already ends with one", () => {
    writeMemory(projectPath, "gotchas.md", "line 1\n");
    appendMemory(projectPath, "gotchas.md", "line 2");
    const read = readMemory(projectPath, "gotchas.md");
    expect(read.content).toBe("line 1\nline 2");
  });

  it("rejects writes exceeding the per-write limit", () => {
    const enormous = "x".repeat(70_000);
    expect(() => writeMemory(projectPath, "overview.md", enormous)).toThrow(SupervisorProtocolError);
  });

  it("rejects reads of missing files", () => {
    expect(() => readMemory(projectPath, "nope.md")).toThrow(SupervisorProtocolError);
  });

  it("rejects unsupported extensions", () => {
    expect(() => writeMemory(projectPath, "code.ts", "x")).toThrow(SupervisorProtocolError);
  });
});

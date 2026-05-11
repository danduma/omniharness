import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SupervisorProtocolError } from "@/server/supervisor/protocol";
import { getMemoryRoot, resolveMemoryPath } from "@/server/supervisor/memory-paths";

let projectPath: string;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-memory-paths-"));
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("resolveMemoryPath", () => {
  it("requires a project path", () => {
    expect(() => resolveMemoryPath(null, "overview.md")).toThrow(SupervisorProtocolError);
  });

  it("rejects empty paths", () => {
    expect(() => resolveMemoryPath(projectPath, "")).toThrow(SupervisorProtocolError);
  });

  it("rejects absolute paths", () => {
    expect(() => resolveMemoryPath(projectPath, "/etc/passwd")).toThrow(SupervisorProtocolError);
  });

  it("rejects parent traversal", () => {
    expect(() => resolveMemoryPath(projectPath, "../escape.md")).toThrow(SupervisorProtocolError);
  });

  it("rejects NUL bytes", () => {
    expect(() => resolveMemoryPath(projectPath, "ok\0.md")).toThrow(SupervisorProtocolError);
  });

  it("rejects unsupported extensions", () => {
    expect(() => resolveMemoryPath(projectPath, "code.ts")).toThrow(SupervisorProtocolError);
  });

  it("resolves a valid relative path inside the memory root", () => {
    const resolved = resolveMemoryPath(projectPath, "decisions.md");
    expect(resolved.absolutePath.startsWith(getMemoryRoot(projectPath))).toBe(true);
    expect(resolved.relativePath).toBe("decisions.md");
  });

  it("normalizes nested relative paths", () => {
    const resolved = resolveMemoryPath(projectPath, "subdir/note.md");
    expect(resolved.absolutePath).toBe(path.join(getMemoryRoot(projectPath), "subdir/note.md"));
  });
});

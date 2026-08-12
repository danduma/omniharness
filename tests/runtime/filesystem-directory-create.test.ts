import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import {
  __resetNamedEventsForTests,
  __setStreamEpochForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";

function createDirectoryRequest(parentPath: string, name: string) {
  return new Request("http://localhost/api/fs/directories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parentPath, name }),
  });
}

describe("filesystem directory creation route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    __resetNamedEventsForTests();
    __setStreamEpochForTests("filesystem-test");
  });

  it("creates a child directory through the registered runtime route", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    const mkdir = vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      createDirectoryRequest(allowedRoot, "new-project"),
      { surface: "test" },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      path: path.join(allowedRoot, "new-project"),
    });
    expect(mkdir).toHaveBeenCalledWith(path.join(allowedRoot, "new-project"));
  });

  it("rejects names that can escape the selected parent", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    const mkdir = vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      createDirectoryRequest(allowedRoot, "../outside"),
      { surface: "test" },
    );

    expect(response.status).toBe(400);
    expect(mkdir).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: expect.stringMatching(/folder name/i),
      },
    });
  });

  it("creates inside the canonical parent when the selected path is a symlink", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    const selectedParent = path.join(allowedRoot, "linked-projects");
    const canonicalParent = path.join(allowedRoot, "canonical-projects");
    vi.spyOn(fs, "realpathSync").mockImplementation(((candidate: fs.PathLike) => (
      path.resolve(String(candidate)) === allowedRoot ? allowedRoot : canonicalParent
    )) as typeof fs.realpathSync);
    vi.spyOn(fs, "statSync").mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const mkdir = vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      createDirectoryRequest(selectedParent, "new-project"),
      { surface: "test" },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      path: path.join(canonicalParent, "new-project"),
    });
    expect(mkdir).toHaveBeenCalledWith(path.join(canonicalParent, "new-project"));
  });

  it("publishes the successful filesystem decision to the named event log", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      createDirectoryRequest(allowedRoot, "observable-project"),
      { surface: "test" },
    );

    expect(response.status).toBe(201);
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual({
      kind: "filesystem.directory_created",
      parentPath: allowedRoot,
      path: path.join(allowedRoot, "observable-project"),
    });
  });

  it("surfaces permission failures with a specific HTTP status and named error", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw Object.assign(new Error("Permission denied by the filesystem."), { code: "EACCES" });
    });
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      createDirectoryRequest(allowedRoot, "protected-project"),
      { surface: "test" },
    );

    expect(response.status).toBe(403);
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toEqual([
      expect.objectContaining({
        kind: "filesystem.directory_create_failed",
        path: path.join(allowedRoot, "protected-project"),
      }),
      expect.objectContaining({
        kind: "error.surfaced",
        code: "filesystem.directory_create_failed",
        path: path.join(allowedRoot, "protected-project"),
      }),
    ]);
  });
});

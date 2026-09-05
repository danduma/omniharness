import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import {
  __resetNamedEventsForTests,
  __setStreamEpochForTests,
} from "@/server/events/named-events";

type BrowseResponse = {
  current: string;
  parent: string;
  root: string | null;
  roots: Array<{ path: string; available: boolean }>;
  directories: Array<{ name: string; path: string }>;
};

let firstRoot: string;
let secondRoot: string;
let previousRootsEnv: string | undefined;

function browseRequest(dirPath?: string) {
  const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
  return new Request(`http://localhost/api/fs${query}`);
}

function createDirectoryRequest(parentPath: string, name: string) {
  return new Request("http://localhost/api/fs/directories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parentPath, name }),
  });
}

async function browse(dirPath?: string) {
  const registry = createOmniRuntimeHttpRegistry();
  const response = await registry.handle(browseRequest(dirPath), { surface: "test" });
  expect(response.status).toBe(200);
  return await response.json() as BrowseResponse;
}

describe("filesystem routes with multiple allowed roots", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    __resetNamedEventsForTests();
    __setStreamEpochForTests("allowed-roots-test");

    // Canonical path: directory creation resolves symlinks, and macOS exposes
    // the temp dir under /var, which is a symlink to /private/var.
    const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "omni-fs-roots-")));
    firstRoot = path.join(scratch, "first");
    secondRoot = path.join(scratch, "second");
    fs.mkdirSync(path.join(firstRoot, "alpha"), { recursive: true });
    fs.mkdirSync(path.join(secondRoot, "beta"), { recursive: true });

    previousRootsEnv = process.env.OMNIHARNESS_FS_ROOTS;
    process.env.OMNIHARNESS_FS_ROOTS = [firstRoot, secondRoot].join(path.delimiter);
  });

  afterEach(() => {
    if (previousRootsEnv === undefined) {
      delete process.env.OMNIHARNESS_FS_ROOTS;
    } else {
      process.env.OMNIHARNESS_FS_ROOTS = previousRootsEnv;
    }
  });

  it("starts browsing in the first configured root and advertises every root", async () => {
    const body = await browse();

    expect(body.current).toBe(firstRoot);
    expect(body.root).toBe(firstRoot);
    expect(body.roots).toEqual([
      { path: firstRoot, available: true },
      { path: secondRoot, available: true },
    ]);
  });

  it("browses a root that is not the default one", async () => {
    const body = await browse(secondRoot);

    expect(body.current).toBe(secondRoot);
    expect(body.root).toBe(secondRoot);
    expect(body.directories.map((entry) => entry.name)).toEqual(["beta"]);
  });

  it("stops upward navigation at the root that contains the current directory", async () => {
    const body = await browse(path.join(secondRoot, "beta"));

    expect(body.parent).toBe(secondRoot);
    expect((await browse(secondRoot)).parent).toBe(secondRoot);
  });

  it("clamps a path outside every root back to the default root", async () => {
    const body = await browse(path.resolve(firstRoot, "..", "..", "elsewhere"));

    expect(body.current).toBe(firstRoot);
  });

  it("falls back to the next readable root when the first one is unavailable", async () => {
    process.env.OMNIHARNESS_FS_ROOTS = [
      path.join(firstRoot, "missing-volume"),
      secondRoot,
    ].join(path.delimiter);

    const body = await browse();

    expect(body.current).toBe(secondRoot);
    expect(body.roots).toEqual([
      { path: path.join(firstRoot, "missing-volume"), available: false },
      { path: secondRoot, available: true },
    ]);
  });

  it("creates directories inside any allowed root", async () => {
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      createDirectoryRequest(secondRoot, "created-here"),
      { surface: "test" },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      path: path.join(secondRoot, "created-here"),
    });
    expect(fs.existsSync(path.join(secondRoot, "created-here"))).toBe(true);
  });

  it("refuses to create directories outside every allowed root", async () => {
    const registry = createOmniRuntimeHttpRegistry();
    const mkdir = vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);

    const response = await registry.handle(
      createDirectoryRequest(path.resolve(firstRoot, "..", ".."), "escaped"),
      { surface: "test" },
    );

    expect(response.status).toBe(400);
    expect(mkdir).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { message: expect.stringMatching(/outside the allowed filesystem root/i) },
    });
  });
});

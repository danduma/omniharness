import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { PROJECT_TEXT_FILE_MAX_BYTES } from "@/server/fs/files";

let scratch: string;
let root: string;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "omni-editor-"));
  root = path.join(scratch, "project");
  fs.mkdirSync(root);
  vi.stubEnv("OMNIHARNESS_FS_ROOTS", scratch);
  __resetNamedEventsForTests();
});

afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function request(query: Record<string, string>, body?: unknown) {
  const params = new URLSearchParams({ root, ...query });
  const request = new Request(`http://localhost/api/fs/files?${params}`, body === undefined ? {} : {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return createOmniRuntimeHttpRegistry().handle(request, { surface: "test" });
}

describe("project browser and editor API", () => {
  it("lists one directory at a time, including dotfiles and empty folders", async () => {
    fs.mkdirSync(path.join(root, "empty"));
    fs.writeFileSync(path.join(root, ".gitignore"), "build");
    const response = await request({ directory: "." });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entries: [
        { kind: "directory", name: "empty", path: "empty" },
        { kind: "file", name: ".gitignore", path: ".gitignore" },
      ],
    });
    await expect((await request({ directory: "empty" })).json()).resolves.toMatchObject({ entries: [] });
  });

  it("streams binary downloads as attachments without decoding their bytes", async () => {
    const bytes = Buffer.from([0, 28, 255]);
    fs.writeFileSync(path.join(root, "data.bin"), bytes);
    const response = await request({ file: "data.bin", download: "1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });

  it("saves text with a revision and refuses a competing edit without losing either copy", async () => {
    const file = path.join(root, "README.md");
    fs.writeFileSync(file, "# Before", { mode: 0o751 });
    const { revision } = await (await request({ file: "README.md" })).json();
    expect(revision).toEqual(expect.any(String));
    const saved = await request({ file: "README.md" }, { revision, content: "# After" });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({ content: "# After", revision: expect.not.stringMatching(revision) });
    expect(fs.readFileSync(file, "utf8")).toBe("# After");
    expect(fs.statSync(file).mode & 0o777).toBe(0o751);

    fs.writeFileSync(file, "# External");
    const conflict = await request({ file: "README.md" }, { revision, content: "# Conflict" });
    expect(conflict.status).toBe(409);
    expect(fs.readFileSync(file, "utf8")).toBe("# External");
    expect(getNamedEventsSince(0).events.map(({ event }) => event.kind)).toEqual([
      "filesystem.file_saved", "filesystem.file_save_failed", "error.surfaced",
    ]);
  });

  it("refuses to replace a file with truncated or oversized editor text", async () => {
    const filename = "large.txt";
    const file = path.join(root, filename);
    const large = "x".repeat(PROJECT_TEXT_FILE_MAX_BYTES + 1);
    fs.writeFileSync(file, large);
    const truncated = await (await request({ file: filename })).json();
    expect(truncated).toMatchObject({ truncated: true, revision: null, size: large.length });

    fs.writeFileSync(file, "original");
    const { revision } = await (await request({ file: filename })).json();
    const response = await request({ file: filename }, { revision, content: large });
    expect(response.status).toBe(413);
    expect(fs.readFileSync(file, "utf8")).toBe("original");
  });

  it("does not follow a link outside the project or fall back to another root", async () => {
    fs.writeFileSync(path.join(scratch, "outside.md"), "outside");
    fs.symlinkSync(scratch, path.join(root, "outside"));
    expect((await request({ directory: "outside" })).status).toBe(403);
    expect((await request({ file: "outside/outside.md" })).ok).toBe(false);
    expect((await request({ file: "outside/outside.md" }, { revision: "a".repeat(64), content: "changed" })).status).toBe(403);
    expect((await request({ directory: ".", root: path.dirname(scratch) })).status).toBe(403);
    expect(fs.readFileSync(path.join(scratch, "outside.md"), "utf8")).toBe("outside");
  });
});

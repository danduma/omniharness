import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { listProjectFiles, readProjectTextFile } from "@/server/fs/files";

describe("listProjectFiles", () => {
  it("returns nested files relative to the project root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-files-"));
    fs.mkdirSync(path.join(root, "src", "components"), { recursive: true });
    fs.writeFileSync(path.join(root, "README.md"), "# hello");
    fs.writeFileSync(path.join(root, "src", "index.ts"), "export {}");
    fs.writeFileSync(path.join(root, "src", "components", "Button.tsx"), "export function Button() {}");

    const files = listProjectFiles(root);

    expect(files).toEqual([
      "README.md",
      "src/components/Button.tsx",
      "src/index.ts",
    ]);
  });

  it("skips typical generated and dependency folders", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-files-ignore-"));
    fs.mkdirSync(path.join(root, "node_modules", "react"), { recursive: true });
    fs.mkdirSync(path.join(root, "__pycache__"), { recursive: true });
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.mkdirSync(path.join(root, ".next", "cache"), { recursive: true });
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    fs.mkdirSync(path.join(root, "src"), { recursive: true });

    fs.writeFileSync(path.join(root, "node_modules", "react", "index.js"), "ignored");
    fs.writeFileSync(path.join(root, "__pycache__", "app.pyc"), "ignored");
    fs.writeFileSync(path.join(root, ".git", "config"), "ignored");
    fs.writeFileSync(path.join(root, ".next", "cache", "trace"), "ignored");
    fs.writeFileSync(path.join(root, "dist", "bundle.js"), "ignored");
    fs.writeFileSync(path.join(root, "src", "app.ts"), "kept");

    const files = listProjectFiles(root);

    expect(files).toEqual(["src/app.ts"]);
  });
});

describe("readProjectTextFile", () => {
  it("reads nested text files relative to the project root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-file-read-"));
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "app.ts"), "export const value = 1;\n");

    expect(readProjectTextFile(root, "src/app.ts")).toEqual({
      root: path.resolve(root),
      path: "src/app.ts",
      content: "export const value = 1;\n",
      size: 24,
      truncated: false,
    });
  });

  it("rejects traversal outside the root", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "omni-file-read-traversal-"));
    const root = path.join(parent, "repo");
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(parent, "outside.txt"), "nope");

    expect(() => readProjectTextFile(root, "../outside.txt")).toThrow(/outside the project root/i);
  });

  it("rejects binary-looking files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-file-read-binary-"));
    fs.writeFileSync(path.join(root, "image.bin"), Buffer.from([0x00, 0x01, 0x02, 0x03]));

    expect(() => readProjectTextFile(root, "image.bin")).toThrow(/binary/i);
  });

  it("truncates files over the text read cap", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-file-read-large-"));
    fs.writeFileSync(path.join(root, "large.txt"), "a".repeat(1024));

    const result = readProjectTextFile(root, "large.txt", { maxBytes: 32 });

    expect(result).toMatchObject({
      root: path.resolve(root),
      path: "large.txt",
      size: 1024,
      truncated: true,
    });
    expect(result.content).toHaveLength(32);
  });
});

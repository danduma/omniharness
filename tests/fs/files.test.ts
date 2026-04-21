import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { listProjectFiles } from "@/server/fs/files";

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

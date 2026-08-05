import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(process.cwd(), "scripts/interface-build-state.mjs");
const tempRoots: string[] = [];

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-interface-state-"));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, "apps", "interface"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "interface"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  fs.writeFileSync(path.join(root, "apps", "interface", "index.html"), "<div id=\"root\"></div>\n");
  fs.writeFileSync(path.join(root, "src", "interface", "main.ts"), "export const version = 1;\n");
  return root;
}

function run(root: string, flag: "--check" | "--write") {
  return spawnSync(process.execPath, [scriptPath, flag, "--root", root], {
    encoding: "utf8",
  });
}

function writeBuiltInterface(root: string) {
  const output = path.join(root, "dist", "interface");
  fs.mkdirSync(path.join(output, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(output, "index.html"),
    '<!doctype html><script type="module" src="/assets/index-abc123.js"></script>',
  );
  fs.writeFileSync(path.join(output, "assets", "index-abc123.js"), "console.log('ready');\n");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("interface build state", () => {
  it("requires a build when the interface output is missing", () => {
    const result = run(createFixture(), "--check");
    expect(result.status).toBe(10);
    expect(result.stdout).toContain("build required");
  });

  it("accepts a complete output only after writing its matching source fingerprint", () => {
    const root = createFixture();
    writeBuiltInterface(root);

    expect(run(root, "--check").status).toBe(10);
    expect(run(root, "--write").status).toBe(0);
    expect(run(root, "--check").status).toBe(0);

    const marker = JSON.parse(
      fs.readFileSync(path.join(root, "dist", "interface", ".build-state.json"), "utf8"),
    ) as { version: number; fingerprint: string };
    expect(marker.version).toBe(1);
    expect(marker.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires another build when a source input changes", () => {
    const root = createFixture();
    writeBuiltInterface(root);
    expect(run(root, "--write").status).toBe(0);

    fs.writeFileSync(path.join(root, "src", "interface", "main.ts"), "export const version = 2;\n");
    const result = run(root, "--check");
    expect(result.status).toBe(10);
    expect(result.stdout).toContain("fingerprint changed");
  });

  it("refuses to bless output whose referenced asset is missing", () => {
    const root = createFixture();
    writeBuiltInterface(root);
    fs.rmSync(path.join(root, "dist", "interface", "assets", "index-abc123.js"));

    const result = run(root, "--write");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("referenced asset is missing");
  });

  it("ignores generated cache directories inside source roots", () => {
    const root = createFixture();
    writeBuiltInterface(root);
    expect(run(root, "--write").status).toBe(0);

    fs.mkdirSync(path.join(root, "apps", "interface", ".vite"), { recursive: true });
    fs.writeFileSync(path.join(root, "apps", "interface", ".vite", "cache.json"), "{}\n");

    expect(run(root, "--check").status).toBe(0);
  });

  it("does not follow source symlinks outside the repository tree", () => {
    const root = createFixture();
    const externalPath = path.join(root, "external-source.ts");
    fs.writeFileSync(externalPath, "export const external = 1;\n");
    fs.symlinkSync(externalPath, path.join(root, "apps", "interface", "external.ts"));
    writeBuiltInterface(root);
    expect(run(root, "--write").status).toBe(0);

    fs.writeFileSync(externalPath, "export const external = 2;\n");
    expect(run(root, "--check").status).toBe(0);
  });
});

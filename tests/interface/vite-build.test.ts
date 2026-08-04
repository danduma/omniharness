import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");
const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-vite-build-"));
const webOutput = path.join(buildRoot, "web");
const packagedOutput = path.join(buildRoot, "packaged");

function buildInterface(
  script: "build:interface:web" | "build:interface:packaged",
  outputPath: string,
) {
  execFileSync("pnpm", [script], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      OMNIHARNESS_INTERFACE_OUT_DIR: outputPath,
    },
    stdio: "pipe",
  });
}

function readArtifact(root: string, relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function collectTextArtifacts(root: string): string {
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:css|html|js|json|map)$/.test(entry.name))
    .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"))
    .join("\n");
}

describe.sequential("Vite interface build", () => {
  it("builds the browser interface with both mountable HTML entry points", () => {
    buildInterface("build:interface:web", webOutput);

    const indexHtml = readArtifact(webOutput, "index.html");
    const appShellHtml = readArtifact(webOutput, "app-shell.html");
    expect(indexHtml).toContain('id="root"');
    expect(appShellHtml).toContain('id="root"');
    expect(indexHtml).toMatch(/assets\/[^"]+\.js/);
    expect(appShellHtml).toMatch(/assets\/[^"]+\.js/);
  }, 60_000);

  it("builds a packaged interface whose asset paths work outside an HTTP root", () => {
    buildInterface("build:interface:packaged", packagedOutput);

    const indexHtml = readArtifact(packagedOutput, "index.html");
    const appShellHtml = readArtifact(packagedOutput, "app-shell.html");
    expect(indexHtml).toContain('id="root"');
    expect(appShellHtml).toContain('id="root"');
    expect(indexHtml).toMatch(/(?:src|href)="\.\/assets\//);
    expect(appShellHtml).toMatch(/(?:src|href)="\.\/assets\//);
  }, 60_000);

  it("keeps server-only code and packages out of both interface artifacts", () => {
    for (const outputPath of [webOutput, packagedOutput]) {
      const artifactText = collectTextArtifacts(outputPath);
      expect(
        artifactText,
        `Node built-in import leaked into ${outputPath}`,
      ).not.toMatch(/["']node:[a-z0-9_/-]+["']/i);
      for (const forbidden of [
        "src/server",
        "src/runtime/http",
        "better-sqlite3",
        "node-pty",
        "@libsql/client",
        "proper-lockfile",
      ]) {
        expect(artifactText, `${forbidden} leaked into ${outputPath}`).not.toContain(forbidden);
      }
    }
  });
});

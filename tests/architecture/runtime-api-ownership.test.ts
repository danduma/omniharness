import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");
const interfaceRoots = [
  "src/components",
  "src/interface",
  "src/lib",
  "src/ui",
];

function sourceFiles(relativeRoot: string) {
  const root = path.join(repositoryRoot, relativeRoot);
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[jt]sx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("RuntimeAPIs network ownership", () => {
  it("keeps transport and API route construction inside runtime adapters", () => {
    const violations: string[] = [];
    for (const relativeRoot of interfaceRoots) {
      for (const filePath of sourceFiles(relativeRoot)) {
        const source = fs.readFileSync(filePath, "utf8");
        const reasons = [
          /\bfetch\s*\(/.test(source) ? "fetch" : null,
          /\bnew\s+EventSource\s*\(/.test(source) ? "EventSource" : null,
          /[("'`]\/api\//.test(source) ? "API route" : null,
          /\b(?:omniElectron|acquireVsCodeApi)\b/.test(source) ? "host IPC" : null,
        ].filter(Boolean);
        if (reasons.length > 0) {
          violations.push(
            `${path.relative(repositoryRoot, filePath)}: ${reasons.join(", ")}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps oversized interface owners split into focused modules", () => {
    const homeSource = fs.readFileSync(
      path.join(repositoryRoot, "src/interface/home/HomeApp.tsx"),
      "utf8",
    );
    const mutationSource = fs.readFileSync(
      path.join(repositoryRoot, "src/interface/home/useHomeMutations.ts"),
      "utf8",
    );
    const terminalSource = fs.readFileSync(
      path.join(repositoryRoot, "src/components/Terminal.tsx"),
      "utf8",
    );

    expect(homeSource).toContain('from "./HomeAppStateManager"');
    expect(homeSource).toContain('from "./home-bootstrap"');
    expect(homeSource).toContain(
      "useManagerSelector(homeUiStateManager, selectHomeAppState, shallowEqualRecord)",
    );
    expect(mutationSource).toContain('from "./mutations/optimistic-state"');
    expect(terminalSource).toContain(
      'from "@/components/terminal/UserMessageAttachments"',
    );
    expect(terminalSource).toContain(
      'from "@/components/terminal/scroll-state"',
    );
  });
});

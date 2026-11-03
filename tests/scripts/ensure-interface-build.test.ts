import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const helper = await import(pathToFileURL(
  path.resolve(process.cwd(), "scripts", "ensure-interface-build.mjs"),
).href) as {
  ensureInterfaceBuild: (options: {
    root: string;
    preferExisting?: boolean;
    run: (command: string, args: string[]) => { status: number | null };
  }) => number;
};

describe("production interface start freshness", () => {
  it("runs the local startup gate before the production runner", () => {
    expect(packageJson.scripts.prestart).toBe("node ./scripts/ensure-startup.mjs");
  });

  it("checks only existing compiled assets for automatic startup", () => {
    const actions: string[][] = [];
    expect(helper.ensureInterfaceBuild({
      root: "/repo",
      preferExisting: true,
      run: (_command, args) => { actions.push(args); return { status: 0 }; },
    })).toBe(0);
    expect(actions).toEqual([["/repo/scripts/interface-build-state.mjs", "--check-output"]]);
  });

  it("repairs missing compiled assets even when startup prefers existing output", () => {
    const actions: string[][] = [];
    expect(helper.ensureInterfaceBuild({
      root: "/repo",
      preferExisting: true,
      run: (_command, args) => {
        actions.push(args);
        return { status: args.includes("--check-output") ? 10 : 0 };
      },
    })).toBe(0);
    expect(actions[0]).toContain("--check-output");
    expect(actions[1]).toContain("build");
    expect(actions[2]).toContain("--write");
  });

  it("does not rebuild when the interface fingerprint is current", () => {
    const actions: string[] = [];

    const status = helper.ensureInterfaceBuild({
      root: "/repo",
      run: (command, args) => {
        actions.push(`${command} ${args.join(" ")}`);
        return { status: 0 };
      },
    });

    expect(status).toBe(0);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toContain("--check");
    expect(actions.join(" ")).not.toContain(" build");
  });

  it("builds and records the interface when the fingerprint is stale", () => {
    const actions: string[] = [];

    const status = helper.ensureInterfaceBuild({
      root: "/repo",
      run: (command, args) => {
        actions.push(`${command} ${args.join(" ")}`);
        if (args.includes("--check")) return { status: 10 };
        return { status: 0 };
      },
    });

    expect(status).toBe(0);
    expect(actions[0]).toContain("--check");
    expect(actions[1]).toContain(" build");
    expect(actions[2]).toContain("--write");
  });

  it("does not start after a failed interface build", () => {
    const actions: string[] = [];

    const status = helper.ensureInterfaceBuild({
      root: "/repo",
      run: (command, args) => {
        actions.push(`${command} ${args.join(" ")}`);
        return { status: args.includes("--check") ? 10 : 7 };
      },
    });

    expect(status).toBe(7);
    expect(actions).toHaveLength(2);
    expect(actions.join(" ")).not.toContain("--write");
  });
});

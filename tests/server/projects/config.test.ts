import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getProjectConfigPath,
  getProjectSetting,
  isProjectMemoryEnabled,
  readProjectConfig,
  setProjectSetting,
  writeProjectConfig,
} from "@/server/projects/config";

let projectPath: string;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-config-"));
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("project config", () => {
  it("returns an empty config when the file is missing", () => {
    const config = readProjectConfig(projectPath);
    expect(config).toEqual({ version: 1 });
  });

  it("creates .omniharness/ lazily on write", () => {
    writeProjectConfig(projectPath, { version: 1, supervisor: { memoryEnabled: false } });
    expect(fs.existsSync(getProjectConfigPath(projectPath))).toBe(true);
    const config = readProjectConfig(projectPath);
    expect(config.supervisor?.memoryEnabled).toBe(false);
  });

  it("treats malformed JSON as empty config", () => {
    fs.mkdirSync(path.join(projectPath, ".omniharness"), { recursive: true });
    fs.writeFileSync(getProjectConfigPath(projectPath), "not json", "utf8");
    expect(readProjectConfig(projectPath)).toEqual({ version: 1 });
  });

  it("supports dotted getters and setters", () => {
    setProjectSetting(projectPath, "supervisor.memoryEnabled", false);
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", true)).toBe(false);
    setProjectSetting(projectPath, "supervisor.memoryEnabled", true);
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", false)).toBe(true);
  });

  it("returns the default for unset keys", () => {
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", true)).toBe(true);
    expect(getProjectSetting(projectPath, "supervisor.memoryEnabled", false)).toBe(false);
  });

  it("isProjectMemoryEnabled defaults to true when no config", () => {
    expect(isProjectMemoryEnabled(projectPath)).toBe(true);
  });

  it("isProjectMemoryEnabled respects an explicit false", () => {
    setProjectSetting(projectPath, "supervisor.memoryEnabled", false);
    expect(isProjectMemoryEnabled(projectPath)).toBe(false);
  });

  it("isProjectMemoryEnabled returns false when no project path is given", () => {
    expect(isProjectMemoryEnabled(null)).toBe(false);
    expect(isProjectMemoryEnabled("")).toBe(false);
  });
});

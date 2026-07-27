import { describe, expect, test } from "vitest";
import {
  commandLineMatchesOwnedProcess,
  isProcessAlive,
  type ManagedProcessIdentity,
} from "@/server/process-ownership";

describe("shared process ownership", () => {
  test("recognizes the exact executable and config argument without matching lookalikes", () => {
    const expected: ManagedProcessIdentity = {
      pid: 42,
      startedAt: 100,
      executable: "/home/user/.omniharness/cliproxyapi/versions/7.2.71/cli-proxy-api",
      args: ["--config", "/home/user/.omniharness/cliproxyapi/managed-config.yaml"],
    };
    expect(commandLineMatchesOwnedProcess(
      "/home/user/.omniharness/cliproxyapi/versions/7.2.71/cli-proxy-api --config /home/user/.omniharness/cliproxyapi/managed-config.yaml",
      expected,
    )).toBe(true);
    expect(commandLineMatchesOwnedProcess(
      "/tmp/cli-proxy-api --config /home/user/.omniharness/cliproxyapi/managed-config.yaml",
      expected,
    )).toBe(false);
    expect(commandLineMatchesOwnedProcess(
      "/home/user/.omniharness/cliproxyapi/versions/7.2.71/cli-proxy-api --config /tmp/other.yaml",
      expected,
    )).toBe(false);
    expect(commandLineMatchesOwnedProcess(
      "/home/user/.omniharness/cliproxyapi/versions/7.2.71/cli-proxy-api --config /home/user/.omniharness/cliproxyapi/managed-config.yaml.backup",
      expected,
    )).toBe(false);
    expect(commandLineMatchesOwnedProcess(
      "/home/user/.omniharness/cliproxyapi/versions/7.2.71/cli-proxy-api --config-prefix /home/user/.omniharness/cliproxyapi/managed-config.yaml",
      expected,
    )).toBe(false);
  });

  test("treats ESRCH as dead and EPERM as alive", () => {
    expect(isProcessAlive(42, () => { throw Object.assign(new Error("gone"), { code: "ESRCH" }); })).toBe(false);
    expect(isProcessAlive(42, () => { throw Object.assign(new Error("denied"), { code: "EPERM" }); })).toBe(true);
    expect(isProcessAlive(42, () => undefined)).toBe(true);
  });
});

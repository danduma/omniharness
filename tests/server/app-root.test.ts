import { afterEach, describe, expect, it } from "vitest";

const originalRoot = process.env.OMNIHARNESS_ROOT;

afterEach(() => {
  if (originalRoot === undefined) {
    delete process.env.OMNIHARNESS_ROOT;
  } else {
    process.env.OMNIHARNESS_ROOT = originalRoot;
  }
});

describe("app root helpers", () => {
  it("prefers OMNIHARNESS_ROOT for persisted app data", async () => {
    process.env.OMNIHARNESS_ROOT = "/tmp/omniharness-test-root";
    const mod = await import("@/server/app-root");

    expect(mod.getAppRoot()).toBe("/tmp/omniharness-test-root");
    expect(mod.getAppDataPath("sqlite.db")).toBe("/tmp/omniharness-test-root/sqlite.db");
    expect(mod.getAppDataPath("vibes", "ad-hoc", "plan.md")).toBe(
      "/tmp/omniharness-test-root/vibes/ad-hoc/plan.md",
    );
  });
});

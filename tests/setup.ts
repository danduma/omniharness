import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach } from "vitest";

if (!process.env.OMNIHARNESS_ROOT) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-tests-"));
  process.env.OMNIHARNESS_ROOT = testRoot;
}

beforeEach(() => {
  process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
  if (!process.env.OMNIHARNESS_AUTH_PASSWORD && !process.env.OMNIHARNESS_AUTH_PASSWORD_HASH) {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
  }
});

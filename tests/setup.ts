import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach } from "vitest";

// Never trust an inherited runner root here. Agent processes launched by a
// live OmniHarness runner inherit its OMNIHARNESS_ROOT; respecting that value
// would let ordinary test cleanup operate on the production database.
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-tests-"));
process.env.OMNIHARNESS_ROOT = testRoot;

// Keep plan-readiness LLM judge off by default in tests. Individual tests can
// opt in by stubbing the module.
if (process.env.MOCK_LLM === undefined) {
  process.env.MOCK_LLM = "true";
}

beforeEach(() => {
  process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
  if (!process.env.OMNIHARNESS_AUTH_PASSWORD && !process.env.OMNIHARNESS_AUTH_PASSWORD_HASH) {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
  }
});

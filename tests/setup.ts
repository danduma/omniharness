import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach } from "vitest";

// Never trust an inherited runner root here. Agent processes launched by a
// live OmniHarness runner inherit its OMNIHARNESS_ROOT; respecting that value
// would let ordinary test cleanup operate on the production database.
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-tests-"));
process.env.OMNIHARNESS_ROOT = testRoot;

// Same hazard, one variable family further out. `applyProjectScopedCliStorage`
// deliberately yields to a caller-supplied CLI storage dir, and Claude worker
// startup yields to a caller-supplied ANTHROPIC_MODEL. Tests that assert the
// runtime pins storage under the project root, or pins an exact model, spread
// `...process.env` into the runtime they spawn — so whenever the suite runs
// from a shell that exports these (notably inside an agent CLI, which sets
// CLAUDE_CONFIG_DIR and ANTHROPIC_MODEL for its own session), the runtime took
// the yield branch and those tests failed on the developer's machine while
// passing in CI. Scrub them once, here, so no test can inherit them.
for (const key of [
  "ANTHROPIC_MODEL",
  "CLAUDE_CODE_SUBAGENT_MODEL",
  "CLAUDE_CONFIG_DIR",
  "CODEX_HOME",
  "CODEX_SQLITE_HOME",
  "GEMINI_CLI_HOME",
  "OPENCODE_CONFIG_DIR",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
]) {
  delete process.env[key];
}

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

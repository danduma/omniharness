import fs from "fs";
import os from "os";
import path from "path";

if (!process.env.OMNIHARNESS_ROOT) {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-tests-"));
  process.env.OMNIHARNESS_ROOT = testRoot;
}

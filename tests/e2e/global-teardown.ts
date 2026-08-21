import { lstatSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export default function globalTeardown() {
  if (process.env.OMNIHARNESS_E2E_EPHEMERAL_ROOT !== "1") return;
  const configured = process.env.OMNIHARNESS_ROOT?.trim();
  if (!configured) throw new Error("Refusing to clean an empty Playwright data root.");

  const target = realpathSync(configured);
  const temporaryRoot = realpathSync(tmpdir());
  if (
    path.dirname(target) !== temporaryRoot
    || !path.basename(target).startsWith("omniharness-playwright-")
    || !lstatSync(target).isDirectory()
    || lstatSync(target).isSymbolicLink()
  ) {
    throw new Error(`Refusing to clean unexpected Playwright data root: ${target}`);
  }
  rmSync(target, { recursive: true });
}

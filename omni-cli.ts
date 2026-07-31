#!/usr/bin/env node
import { runOmniCli } from "@/server/cli/runner";
import { startOmniHarnessAcpStdio } from "@/server/omni-acp/stdio";
import { runRunnerRekeyCommand } from "@/server/cli/admin-commands";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
if (args[0] === "acp" || args[0] === "--acp") {
  startOmniHarnessAcpStdio();
} else if (args[0] === "auth" && args[1] === "init") {
  const passwordFileIndex = args.indexOf("--password-file");
  const passwordFile = passwordFileIndex >= 0 ? args[passwordFileIndex + 1] : null;
  if (passwordFileIndex >= 0 && !passwordFile) {
    throw new Error("--password-file requires a path.");
  }
  const setupAuth = await import(
    pathToFileURL(path.join(process.cwd(), "scripts/setup-auth.mjs")).href
  );
  const authPassword = await import(
    pathToFileURL(path.join(process.cwd(), "scripts/auth-password.mjs")).href
  );
  await setupAuth.ensureAuthConfig({
    rootDir: process.cwd(),
    envPath: path.join(process.cwd(), ".env"),
    password: passwordFile
      ? authPassword.readProtectedPasswordFile(path.resolve(passwordFile))
      : undefined,
  });
} else if (args[0] === "runner" && args[1] === "rekey") {
  runRunnerRekeyCommand(args.slice(2)).then((result) => {
    if (result.warning) {
      process.stderr.write(`${result.warning}\n`);
    }
    process.stdout.write(`${JSON.stringify(result.body, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
} else {
  runOmniCli(args).then((exitCode) => {
  process.exit(exitCode);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

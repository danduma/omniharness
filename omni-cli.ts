#!/usr/bin/env node
import { runOmniCli } from "@/server/cli/runner";
import { startOmniHarnessAcpStdio } from "@/server/omni-acp/stdio";

const args = process.argv.slice(2);
if (args[0] === "acp" || args[0] === "--acp") {
  startOmniHarnessAcpStdio();
} else {
  runOmniCli(args).then((exitCode) => {
  process.exit(exitCode);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

/**
 * Diagnostic: measure cold-start latency for each worker type's default ACP
 * command, so we can decide which types (besides gemini) warrant a pre-warm
 * pool. Skips a type if its binary isn't on PATH.
 *
 * Usage: pnpm exec tsx scripts/time-worker-cold-start.ts
 */
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";
import { execFileSync } from "child_process";

type WorkerType = "codex" | "claude" | "gemini" | "opencode";
const DEFAULT_COMMANDS: Record<WorkerType, string> = {
  codex: "codex-acp",
  claude: "claude-agent-acp",
  gemini: "gemini",
  opencode: "opencode",
};

function commandOnPath(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function timeStart(manager: AgentRuntimeManager, type: WorkerType, name: string, cwd: string) {
  const t0 = Date.now();
  try {
    await manager.startAgent({ type, name, cwd });
    const dt = Date.now() - t0;
    console.log(`  ${type.padEnd(10)} startAgent → ${dt}ms`);
    await manager.stopAgent(name);
    return dt;
  } catch (error) {
    const dt = Date.now() - t0;
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ${type.padEnd(10)} FAILED after ${dt}ms: ${msg.split("\n")[0]}`);
    return null;
  }
}

async function main() {
  const manager = new AgentRuntimeManager({ env: process.env as Record<string, string> });
  const cwd = process.cwd();

  console.log("[cold-start timings — first spawn per worker type, no prewarm]");
  for (const type of Object.keys(DEFAULT_COMMANDS) as WorkerType[]) {
    const cmd = DEFAULT_COMMANDS[type];
    if (!commandOnPath(cmd)) {
      console.log(`  ${type.padEnd(10)} skipped (${cmd} not on PATH)`);
      continue;
    }
    await timeStart(manager, type, `cold-${type}-1`, cwd);
  }

  manager.shutdownPools();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

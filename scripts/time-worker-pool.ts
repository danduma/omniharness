/**
 * Diagnostic: confirm pool hits land in <500ms across all worker types.
 *
 * For each type whose default ACP binary is on PATH: prewarm, then measure
 * startAgent latency on the pool-hit path.
 *
 * Usage: pnpm exec tsx scripts/time-worker-pool.ts
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

async function timeForType(manager: AgentRuntimeManager, type: WorkerType, cwd: string) {
  const cmd = DEFAULT_COMMANDS[type];
  if (!commandOnPath(cmd)) {
    console.log(`  ${type.padEnd(10)} skipped (${cmd} not on PATH)`);
    return;
  }
  const tPrewarmStart = Date.now();
  let result;
  try {
    result = await manager.prewarmWorker({ type, cwd });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ${type.padEnd(10)} prewarm FAILED: ${msg.split("\n")[0]}`);
    return;
  }
  const prewarmMs = Date.now() - tPrewarmStart;

  await new Promise((r) => setTimeout(r, 50));

  const tStart = Date.now();
  try {
    await manager.startAgent({ type, name: `pool-${type}`, cwd });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ${type.padEnd(10)} startAgent FAILED after ${Date.now() - tStart}ms: ${msg.split("\n")[0]}`);
    return;
  }
  const startMs = Date.now() - tStart;
  await manager.stopAgent(`pool-${type}`);

  console.log(
    `  ${type.padEnd(10)} prewarm=${prewarmMs.toString().padStart(6)}ms  pool-hit startAgent=${startMs.toString().padStart(5)}ms  (warmed=${result.warmed}, size=${result.size})`,
  );
}

async function main() {
  const manager = new AgentRuntimeManager({ env: process.env as Record<string, string> });
  const cwd = process.cwd();

  console.log("[pool-hit timings — prewarm then startAgent for each worker type]");
  for (const type of Object.keys(DEFAULT_COMMANDS) as WorkerType[]) {
    await timeForType(manager, type, cwd);
  }

  manager.shutdownPools();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

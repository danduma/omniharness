/**
 * Diagnostic: measure gemini worker startup latency with vs. without the pool.
 *
 * Without pool (cold spawn): ~7.5 s for spawn + initialize + newSession.
 * With pool (after prewarm): <500 ms for the same observable user effect
 * because the pre-warmed child is reused.
 *
 * Usage: pnpm exec tsx scripts/time-gemini-pool.ts
 */
import { AgentRuntimeManager } from "@/server/agent-runtime/manager";

async function main() {
  const manager = new AgentRuntimeManager({ env: process.env as Record<string, string> });
  const cwd = process.cwd();

  console.log("[scenario] cold start (no prewarm)");
  const tColdStart = Date.now();
  await manager.startAgent({ type: "gemini", name: "cold-1", cwd });
  const tColdDone = Date.now();
  console.log(`  startAgent → ${tColdDone - tColdStart}ms`);
  await manager.stopAgent("cold-1");

  console.log("\n[scenario] prewarm then start");
  const tPrewarmStart = Date.now();
  const prewarmResult = await manager.prewarmWorker({ type: "gemini", cwd });
  console.log(`  prewarm → ${Date.now() - tPrewarmStart}ms (warmed=${prewarmResult.warmed}, size=${prewarmResult.size})`);

  // small grace to let any tail of newSession settle
  await new Promise((r) => setTimeout(r, 50));

  const tWarmStart = Date.now();
  await manager.startAgent({ type: "gemini", name: "warm-1", cwd });
  const tWarmDone = Date.now();
  console.log(`  startAgent (pool hit) → ${tWarmDone - tWarmStart}ms`);
  await manager.stopAgent("warm-1");

  console.log("\n[scenario] second prewarm + start (cache warm)");
  const tPrewarm2Start = Date.now();
  const prewarmResult2 = await manager.prewarmWorker({ type: "gemini", cwd });
  console.log(`  prewarm → ${Date.now() - tPrewarm2Start}ms (warmed=${prewarmResult2.warmed}, size=${prewarmResult2.size})`);
  await new Promise((r) => setTimeout(r, 50));
  const tWarm2Start = Date.now();
  await manager.startAgent({ type: "gemini", name: "warm-2", cwd });
  const tWarm2Done = Date.now();
  console.log(`  startAgent (pool hit) → ${tWarm2Done - tWarm2Start}ms`);
  await manager.stopAgent("warm-2");

  manager.shutdownPools();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

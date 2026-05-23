/**
 * Backfill workers.initial_prompt for direct conversations whose messages row
 * was lost. Reads the "Original command" block from each run's plan markdown
 * file and copies it onto the worker.
 *
 * Idempotent: only touches workers where initial_prompt is empty.
 *
 *   pnpm tsx scripts/backfill-worker-initial-prompts.ts [--dry-run]
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers, plans, messages } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";

type WorkerRow = typeof workers.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type PlanRow = typeof plans.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

function extractOriginalCommand(markdown: string): string | null {
  const startMarker = "Original command:";
  const startIndex = markdown.indexOf(startMarker);
  if (startIndex === -1) return null;

  const after = markdown.slice(startIndex + startMarker.length);
  const endIndex = (() => {
    const attachments = after.indexOf("\nAttachments:");
    const supervisor = after.indexOf("\n## ");
    const candidates = [attachments, supervisor].filter((index) => index >= 0);
    return candidates.length > 0 ? Math.min(...candidates) : after.length;
  })();

  const block = after.slice(0, endIndex);
  const lines = block.split(/\r?\n/);
  const quoted = lines
    .map((line) => line.match(/^>\s?(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1]);

  const command = quoted.join("\n").replace(/^\n+|\n+$/g, "");
  return command.trim().length > 0 ? command : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const allWorkers = await db.select().from(workers) as WorkerRow[];
  const allRuns = await db.select().from(runs) as RunRow[];
  const allPlans = await db.select().from(plans) as PlanRow[];
  const runsById = new Map(allRuns.map((run) => [run.id, run]));
  const plansById = new Map(allPlans.map((plan) => [plan.id, plan]));

  let scanned = 0;
  let updatedFromMessages = 0;
  let updatedFromPlan = 0;
  let skippedNoSource = 0;

  for (const worker of allWorkers) {
    if (worker.initialPrompt && worker.initialPrompt.trim().length > 0) {
      continue;
    }
    const run = runsById.get(worker.runId);
    if (!run || run.mode !== "direct") {
      continue;
    }
    scanned += 1;

    // Prefer a surviving user message — that's the exact text the user typed.
    const surviving = await db
      .select()
      .from(messages)
      .where(eq(messages.runId, worker.runId)) as MessageRow[];
    const initialUser = surviving
      .filter((message) => message.role === "user")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

    let nextPrompt: string | null = initialUser?.content?.trim() || null;
    let source: "messages" | "plan" | null = nextPrompt ? "messages" : null;

    if (!nextPrompt) {
      const plan = plansById.get(run.planId);
      if (plan?.path) {
        const fullPath = path.isAbsolute(plan.path) ? plan.path : getAppDataPath(plan.path);
        try {
          const markdown = fs.readFileSync(fullPath, "utf8");
          const extracted = extractOriginalCommand(markdown);
          if (extracted) {
            nextPrompt = extracted;
            source = "plan";
          }
        } catch {
          // Plan file missing — fall through to the no-source counter.
        }
      }
    }

    if (!nextPrompt) {
      skippedNoSource += 1;
      continue;
    }

    if (source === "messages") updatedFromMessages += 1;
    else if (source === "plan") updatedFromPlan += 1;

    console.log(
      `[${source}] ${worker.id} (run ${worker.runId.slice(0, 12)}): ${nextPrompt.slice(0, 80).replace(/\n/g, " ")}${nextPrompt.length > 80 ? "…" : ""}`,
    );

    if (!dryRun) {
      await db
        .update(workers)
        .set({ initialPrompt: nextPrompt, updatedAt: worker.updatedAt })
        .where(eq(workers.id, worker.id));
    }
  }

  console.log("");
  console.log(`scanned direct workers with empty initialPrompt: ${scanned}`);
  console.log(`  filled from messages row: ${updatedFromMessages}`);
  console.log(`  filled from plan markdown: ${updatedFromPlan}`);
  console.log(`  could not recover: ${skippedNoSource}`);
  if (dryRun) console.log("(dry-run — no rows written)");
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});

// Summarize decision-layer shadow comparisons (rollout B1).
// Usage: pnpm decisions:shadow-report [--days 7]
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppDataPath } from "@/server/app-root";
import { parseShadowLog, summarizeShadowDecisions } from "@/server/decisions/shadow-report";

async function main() {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg >= 0 ? Math.max(1, Number(process.argv[daysArg + 1]) || 7) : 7;
  const dir = getAppDataPath("decision-log");
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((file) => file.endsWith(".jsonl")).sort().slice(-days);
  } catch {
    console.log(`No shadow decision log yet at ${dir}. Enable the decision layer and a decision point first.`);
    return;
  }
  const records = (await Promise.all(files.map((file) => fs.readFile(path.join(dir, file), "utf8"))))
    .flatMap(parseShadowLog);
  if (records.length === 0) {
    console.log(`No shadow comparisons recorded in the last ${days} day(s).`);
    return;
  }
  console.log(`Shadow decisions from ${files[0]} to ${files.at(-1)} (${records.length} comparisons)\n`);
  for (const summary of summarizeShadowDecisions(records)) {
    const rate = summary.agreementRate === null ? "n/a" : `${(summary.agreementRate * 100).toFixed(1)}%`;
    console.log(`${summary.point}: ${summary.agreements}/${summary.comparisons} agree (${rate})`);
    for (const [pair, count] of Object.entries(summary.confusion).sort()) {
      console.log(`  ${pair}: ${count}`);
    }
    if (summary.meanConfidenceWhenDisagreeing !== null) {
      console.log(`  mean confidence when disagreeing: ${summary.meanConfidenceWhenDisagreeing.toFixed(2)}`);
    }
    console.log(`  acted: ${summary.acted}, escalations: ${summary.escalations}, sampled out: ${summary.sampledOut}, cost: $${summary.costUsd.toFixed(6)}\n`);
  }
}

void main();

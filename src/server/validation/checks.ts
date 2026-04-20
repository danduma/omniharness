import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { db } from "../db";
import { planItems, validationRuns, runs } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ValidationArtifact, ValidationRequest, ValidationResult } from "./contracts";

function checkArtifact(cwd: string, artifact: ValidationArtifact): { ok: boolean; failure?: string; evidence?: string } {
  if (artifact.type === "file") {
    const filePath = path.resolve(cwd, artifact.path);
    if (!fs.existsSync(filePath)) {
      return { ok: false, failure: `Missing file: ${artifact.path}` };
    }
    return { ok: true, evidence: `Found file: ${artifact.path}` };
  }

  if (artifact.type === "text") {
    const filePath = path.resolve(cwd, artifact.path);
    if (!fs.existsSync(filePath)) {
      return { ok: false, failure: `Missing text source: ${artifact.path}` };
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes(artifact.contains)) {
      return { ok: false, failure: `Expected "${artifact.contains}" in ${artifact.path}` };
    }
    return { ok: true, evidence: `Matched text in ${artifact.path}` };
  }

  const command = spawnSync(artifact.command, {
    cwd,
    shell: true,
    encoding: "utf8",
  });

  const expectedExitCode = artifact.expectedExitCode ?? 0;
  if ((command.status ?? 0) !== expectedExitCode) {
    return { ok: false, failure: `Command failed: ${artifact.command} (exit ${command.status ?? "null"})` };
  }

  if (artifact.stdoutContains && !(command.stdout || "").includes(artifact.stdoutContains)) {
    return { ok: false, failure: `Command output missing "${artifact.stdoutContains}": ${artifact.command}` };
  }

  return { ok: true, evidence: `Command passed: ${artifact.command}` };
}

function deriveArtifactsFromTitle(title: string): ValidationArtifact[] {
  const backticked = title.match(/`([^`]+)`/);
  if (backticked) {
    return [{ type: "file", path: backticked[1] }];
  }

  const quoted = title.match(/"([^"]+)"/);
  if (quoted && /\.[a-z0-9]+$/i.test(quoted[1])) {
    return [{ type: "file", path: quoted[1] }];
  }

  const match = title.match(/^(create|add|write|update|modify)\s+(.+)$/i);
  if (match) {
    const rawTarget = match[2].replace(/["']/g, "").trim();
    const firstToken = rawTarget.split(/\s+/)[0];
    return [{ type: "file", path: firstToken }];
  }

  if (/test/i.test(title)) {
    return [{ type: "command", command: "pnpm test", expectedExitCode: 0 }];
  }

  return [];
}

export async function validatePlanItem(request: ValidationRequest): Promise<ValidationResult> {
  const failures: string[] = [];
  const evidence: string[] = [];

  for (const artifact of request.expectedArtifacts) {
    const result = checkArtifact(request.cwd, artifact);
    if (!result.ok) {
      failures.push(result.failure ?? "Artifact check failed");
    } else if (result.evidence) {
      evidence.push(result.evidence);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    evidence,
  };
}

export async function validateRun(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    return { ok: false, failures: [`Run ${runId} not found`] };
  }

  const items = await db.select().from(planItems).where(eq(planItems.planId, run.planId));
  const validationSummaries: Array<{ itemId: string; ok: boolean; failures: string[]; evidence: string[] }> = [];
  const failures: string[] = [];

  for (const item of items) {
    const expectedArtifacts = deriveArtifactsFromTitle(item.title);
    const result =
      expectedArtifacts.length > 0
        ? await validatePlanItem({ cwd: process.cwd(), title: item.title, expectedArtifacts })
        : { ok: false, failures: [`No validation rule derived for "${item.title}"`], evidence: [] };

    validationSummaries.push({ itemId: item.id, ...result });

    await db.insert(validationRuns).values({
      id: randomUUID(),
      runId,
      planItemId: item.id,
      status: result.ok ? "passed" : "failed",
      summary: result.ok ? "Validation passed" : result.failures.join("; "),
      evidence: JSON.stringify(result.evidence),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!result.ok) {
      failures.push(...result.failures);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    itemResults: validationSummaries,
  };
}

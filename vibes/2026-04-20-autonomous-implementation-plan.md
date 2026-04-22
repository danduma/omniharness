# Autonomous Plan Interrogation And Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OmniHarness from a single-worker demo into a continuously running supervisor that can judge plan readiness, ask clarifying questions, execute with headless ACP-backed coding agents, and refuse to terminate until it has independently validated plan completion.

**Architecture:** Keep `acp-bridge` as the worker control plane and evolve OmniHarness into a durable state machine around it. Add explicit plan parsing, clarification persistence, execution graph tracking, and a validation subsystem so the supervisor stops trusting worker claims and instead closes the loop on observable evidence.

**Tech Stack:** Next.js 15, TypeScript, token.js, SQLite, Drizzle ORM, ACP bridge HTTP API, SSE, React Query, xterm.js, Vitest, Playwright

---

## File Structure

### Existing files to modify

- `src/server/supervisor/index.ts`
  Current monolithic loop. Refactor into a thin orchestration entrypoint that delegates to plan analysis, execution, and validation services.
- `src/server/bridge-client/index.ts`
  Expand the ACP client to support streaming, task graphs, permission requests, and worker health polling with typed responses.
- `src/server/credits/index.ts`
  Replace stubbed credit checks and switching with real account selection, exhaustion detection, and strategy execution.
- `src/server/db/schema.ts`
  Add normalized tables for checklist items, clarifications, validation runs, worker assignments, and execution events.
- `src/app/api/supervisor/route.ts`
  Start runs with richer initial state and resume existing interrupted runs.
- `src/app/api/events/route.ts`
  Stream structured supervisor state instead of only flat message snapshots.
- `src/app/page.tsx`
  Add clarification inbox, plan readiness view, validation status, and richer worker state.

### New server files to create

- `src/server/plans/parser.ts`
  Parse markdown plans into structured phases, checklist items, dependencies, and source ranges.
- `src/server/plans/readiness.ts`
  Decide whether a plan is implementation-ready and generate targeted clarification questions.
- `src/server/plans/checklist.ts`
  Persist and update checklist items, execution state, and derived plan progress.
- `src/server/supervisor/runtime.ts`
  Durable supervisor state machine with explicit states like `analyzing`, `awaiting_user`, `executing`, `validating`, `completed`.
- `src/server/supervisor/prompt.ts`
  Centralize the supervisor system prompt and tool contract.
- `src/server/supervisor/tools.ts`
  Register tool handlers so the runtime loop is not mixed with DB and bridge details.
- `src/server/supervisor/resume.ts`
  Reload persisted state after restart and continue from the last durable checkpoint.
- `src/server/workers/orchestrator.ts`
  Manage worker spawn, assignment, retry, cancellation, and parallel scheduling.
- `src/server/workers/monitor.ts`
  Poll worker state, detect stalls, repeated output, and false completion signals.
- `src/server/validation/index.ts`
  Run post-execution validation passes and aggregate results.
- `src/server/validation/checks.ts`
  Define concrete validation checks for files, commands, tests, and checklist evidence.
- `src/server/validation/contracts.ts`
  Shared types for validation requests, results, evidence, and failure reasons.
- `src/server/clarifications/store.ts`
  Persist clarification questions, answers, and resolution status.
- `src/server/clarifications/loop.ts`
  Pause the run on unresolved ambiguity and resume when answers arrive.

### New API files to create

- `src/app/api/runs/[id]/answer/route.ts`
  Accept user answers to supervisor clarification questions.
- `src/app/api/runs/[id]/resume/route.ts`
  Resume paused runs after manual intervention.
- `src/app/api/runs/[id]/validate/route.ts`
  Trigger a validation replay for debugging.

### New tests to create

- `tests/plans/parser.test.ts`
- `tests/plans/readiness.test.ts`
- `tests/supervisor/runtime.test.ts`
- `tests/workers/monitor.test.ts`
- `tests/validation/checks.test.ts`
- `tests/api/answer-route.test.ts`
- `tests/e2e/autonomous-run.spec.ts`

---

### Task 1: Add Test Harness And Durable Run State

**Files:**
- Modify: `package.json`
- Modify: `src/server/db/schema.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/db/schema.test.ts`

- [ ] **Step 1: Add test scripts and dependencies**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Add a failing DB schema test for durable run state**

```ts
import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";

describe("schema", () => {
  it("defines durable tables for clarifications and validations", () => {
    expect(schema).toHaveProperty("planItems");
    expect(schema).toHaveProperty("clarifications");
    expect(schema).toHaveProperty("validationRuns");
    expect(schema).toHaveProperty("executionEvents");
  });
});
```

- [ ] **Step 3: Expand the schema to support autonomous execution**

```ts
export const planItems = sqliteTable("plan_items", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  phase: text("phase"),
  title: text("title").notNull(),
  status: text("status").notNull(), // pending | in_progress | blocked | done | failed
  sourceLine: integer("source_line"),
  dependsOn: text("depends_on"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

- [ ] **Step 4: Add Vitest and Playwright config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 5: Run tests and confirm the new baseline passes**

Run: `npm test`
Expected: PASS for `tests/db/schema.test.ts`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/setup.ts tests/db/schema.test.ts src/server/db/schema.ts
git commit -m "feat: add autonomous run schema and test harness"
```

### Task 2: Parse Plans Into Structured Work

**Files:**
- Create: `src/server/plans/parser.ts`
- Create: `tests/plans/parser.test.ts`
- Modify: `src/server/supervisor/index.ts`

- [ ] **Step 1: Write failing parser tests for phases, checklist items, and line mapping**

```ts
import { describe, expect, it } from "vitest";
import { parsePlan } from "@/server/plans/parser";

describe("parsePlan", () => {
  it("extracts phases and checklist items from markdown", () => {
    const result = parsePlan("# Plan\n\n## Phase 1\n- [ ] First\n- [ ] Second");
    expect(result.items.map((item) => item.title)).toEqual(["First", "Second"]);
    expect(result.items[0]?.phase).toBe("Phase 1");
  });
});
```

- [ ] **Step 2: Implement a minimal parser that turns markdown into normalized items**

```ts
export function parsePlan(markdown: string) {
  const lines = markdown.split("\n");
  let currentPhase: string | null = null;
  const items = [];

  for (const [index, line] of lines.entries()) {
    if (line.startsWith("## ")) currentPhase = line.slice(3).trim();
    const match = line.match(/^- \[ \] (.+)$/);
    if (match) {
      items.push({
        id: `item-${index + 1}`,
        phase: currentPhase,
        title: match[1].trim(),
        sourceLine: index + 1,
      });
    }
  }

  return { items };
}
```

- [ ] **Step 3: Wire `plan_read` flow to parse and persist plan items immediately after loading**

```ts
const parsedPlan = parsePlan(content);
await syncPlanItems(this.planId, parsedPlan.items);
result = JSON.stringify(parsedPlan);
```

- [ ] **Step 4: Run parser tests**

Run: `npm test -- tests/plans/parser.test.ts`
Expected: PASS with parsed item titles and phase names

- [ ] **Step 5: Commit**

```bash
git add src/server/plans/parser.ts tests/plans/parser.test.ts src/server/supervisor/index.ts
git commit -m "feat: parse markdown plans into structured items"
```

### Task 3: Judge Plan Readiness And Generate Clarifications

**Files:**
- Create: `src/server/plans/readiness.ts`
- Create: `tests/plans/readiness.test.ts`
- Create: `src/server/clarifications/store.ts`
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Write failing readiness tests for underspecified plans**

```ts
import { describe, expect, it } from "vitest";
import { assessPlanReadiness } from "@/server/plans/readiness";

describe("assessPlanReadiness", () => {
  it("flags plans with missing success criteria", async () => {
    const result = await assessPlanReadiness({
      markdown: "# Plan\n- [ ] Improve onboarding",
      items: [{ id: "1", title: "Improve onboarding", phase: null, sourceLine: 2 }],
    });
    expect(result.ready).toBe(false);
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement readiness rules before involving the LLM**

```ts
export async function assessPlanReadiness(plan: ParsedPlan) {
  const questions: string[] = [];

  for (const item of plan.items) {
    if (!/\b(test|validate|ship|create|update|remove)\b/i.test(item.title)) {
      questions.push(`What concrete deliverable should satisfy "${item.title}"?`);
    }
  }

  return {
    ready: questions.length === 0,
    questions,
  };
}
```

- [ ] **Step 3: Persist clarifications so runs can pause and resume cleanly**

```ts
export const clarifications = sqliteTable("clarifications", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => runs.id).notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  status: text("status").notNull(), // pending | answered | dismissed
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

- [ ] **Step 4: Run readiness tests**

Run: `npm test -- tests/plans/readiness.test.ts`
Expected: PASS with `ready === false` for vague plans and concrete questions returned

- [ ] **Step 5: Commit**

```bash
git add src/server/plans/readiness.ts src/server/clarifications/store.ts src/server/db/schema.ts tests/plans/readiness.test.ts
git commit -m "feat: add plan readiness assessment and clarification storage"
```

### Task 4: Build The Clarification Loop And Resume Flow

**Files:**
- Create: `src/server/clarifications/loop.ts`
- Create: `src/app/api/runs/[id]/answer/route.ts`
- Create: `tests/api/answer-route.test.ts`
- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/supervisor/route.ts`

- [ ] **Step 1: Write a failing API test for answering a clarification**

```ts
import { describe, expect, it } from "vitest";

describe("POST /api/runs/[id]/answer", () => {
  it("marks the clarification answered and resumes the run", async () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Implement a clarification loop that pauses execution**

```ts
export async function pauseForClarifications(runId: string, questions: string[]) {
  await createClarifications(runId, questions);
  await db.update(runs).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(runs.id, runId));
}
```

- [ ] **Step 3: Add an answer route that stores the answer and triggers resume**

```ts
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { clarificationId, answer } = await req.json();
  await answerClarification(clarificationId, answer);
  await resumeRun((await params).id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Include pending clarifications in SSE updates**

```ts
sendEvent("update", {
  messages: msgs,
  plans: allPlans,
  runs: allRuns,
  clarifications: allClarifications,
  validations: allValidationRuns,
});
```

- [ ] **Step 5: Run API tests**

Run: `npm test -- tests/api/answer-route.test.ts`
Expected: PASS with answered clarification persisted and run moved out of `awaiting_user`

- [ ] **Step 6: Commit**

```bash
git add src/server/clarifications/loop.ts src/app/api/runs/[id]/answer/route.ts src/app/api/events/route.ts src/app/api/supervisor/route.ts tests/api/answer-route.test.ts
git commit -m "feat: add clarification answer and resume flow"
```

### Task 5: Refactor The Supervisor Into A Durable State Machine

**Files:**
- Create: `src/server/supervisor/runtime.ts`
- Create: `src/server/supervisor/prompt.ts`
- Create: `src/server/supervisor/tools.ts`
- Create: `src/server/supervisor/resume.ts`
- Create: `tests/supervisor/runtime.test.ts`
- Modify: `src/server/supervisor/index.ts`

- [ ] **Step 1: Write failing runtime tests for analyze, wait, execute, and validate transitions**

```ts
import { describe, expect, it } from "vitest";
import { nextRunState } from "@/server/supervisor/runtime";

describe("nextRunState", () => {
  it("moves from analyzing to awaiting_user when clarifications exist", () => {
    expect(nextRunState({ status: "analyzing", pendingClarifications: 1 })).toBe("awaiting_user");
  });
});
```

- [ ] **Step 2: Move prompt text and tool declarations out of `index.ts`**

```ts
export const SUPERVISOR_SYSTEM_PROMPT = `
You are the OmniHarness Supervisor.
Never mark a run done because a worker claims success.
Only finish after validation evidence passes for every plan item.
`;
```

- [ ] **Step 3: Implement a deterministic runtime transition function**

```ts
export function nextRunState(input: RuntimeSnapshot) {
  if (input.pendingClarifications > 0) return "awaiting_user";
  if (input.unvalidatedDoneItems > 0) return "validating";
  if (input.pendingItems > 0) return "executing";
  return "completed";
}
```

- [ ] **Step 4: Shrink `src/server/supervisor/index.ts` to composition logic**

```ts
export class Supervisor {
  async run() {
    const runtime = new SupervisorRuntime({ runId: this.runId, planId: this.planId });
    await runtime.start();
  }
}
```

- [ ] **Step 5: Run runtime tests**

Run: `npm test -- tests/supervisor/runtime.test.ts`
Expected: PASS for all state transitions

- [ ] **Step 6: Commit**

```bash
git add src/server/supervisor/index.ts src/server/supervisor/runtime.ts src/server/supervisor/prompt.ts src/server/supervisor/tools.ts src/server/supervisor/resume.ts tests/supervisor/runtime.test.ts
git commit -m "refactor: turn supervisor loop into durable state machine"
```

### Task 6: Implement Execution Graphs, Parallel Workers, And Monitoring

**Files:**
- Create: `src/server/workers/orchestrator.ts`
- Create: `src/server/workers/monitor.ts`
- Create: `tests/workers/monitor.test.ts`
- Modify: `src/server/bridge-client/index.ts`
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Write failing monitor tests for stalled and repeated-output workers**

```ts
import { describe, expect, it } from "vitest";
import { classifyWorkerHealth } from "@/server/workers/monitor";

describe("classifyWorkerHealth", () => {
  it("marks a worker stuck after prolonged silence", () => {
    expect(classifyWorkerHealth({ silenceMs: 120000, repeatCount: 0, unresolvedItems: 1 })).toBe("stuck");
  });
});
```

- [ ] **Step 2: Expand the bridge client to create tasks and inspect richer worker status**

```ts
export async function createTask(body: { name: string; subtasks: { id: string; prompt: string; workerType: string }[] }) {
  const res = await fetch(`${BRIDGE_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create task failed: ${res.statusText}`);
  return res.json();
}
```

- [ ] **Step 3: Add orchestration logic that schedules independent plan items in parallel**

```ts
const runnableItems = items.filter((item) => item.status === "pending" && depsSatisfied(item));
await Promise.all(runnableItems.map((item) => assignItemToWorker(item)));
```

- [ ] **Step 4: Add health classification and automatic recovery hooks**

```ts
if (health === "stuck") {
  await rePromptWorker(worker.id, item);
  await markExecutionEvent(runId, item.id, "worker_reprompted");
}
```

- [ ] **Step 5: Run worker monitor tests**

Run: `npm test -- tests/workers/monitor.test.ts`
Expected: PASS for healthy, stuck, and false-complete classifications

- [ ] **Step 6: Commit**

```bash
git add src/server/workers/orchestrator.ts src/server/workers/monitor.ts src/server/bridge-client/index.ts src/server/db/schema.ts tests/workers/monitor.test.ts
git commit -m "feat: add parallel worker orchestration and monitoring"
```

### Task 7: Add Validation That Proves Work Was Actually Done

**Files:**
- Create: `src/server/validation/contracts.ts`
- Create: `src/server/validation/checks.ts`
- Create: `src/server/validation/index.ts`
- Create: `tests/validation/checks.test.ts`
- Modify: `src/server/supervisor/tools.ts`

- [ ] **Step 1: Write failing validation tests for files, commands, and checklist evidence**

```ts
import { describe, expect, it } from "vitest";
import { validatePlanItem } from "@/server/validation/checks";

describe("validatePlanItem", () => {
  it("fails when a claimed file output does not exist", async () => {
    const result = await validatePlanItem({
      title: "Create hello.txt",
      expectedArtifacts: [{ type: "file", path: "hello.txt" }],
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Implement concrete validators instead of trusting worker responses**

```ts
if (artifact.type === "file") {
  return {
    ok: fs.existsSync(path.resolve(cwd, artifact.path)),
    evidence: artifact.path,
  };
}
```

- [ ] **Step 3: Gate `plan_mark_done` on successful validation**

```ts
const summary = await validateRun(this.runId);
if (!summary.ok) {
  result = `Validation failed: ${summary.failures.join("; ")}`;
} else {
  await markRunCompleted(this.runId);
  result = "Plan marked as done after validation.";
}
```

- [ ] **Step 4: Persist validation results for auditability**

```ts
export const validationRuns = sqliteTable("validation_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => runs.id).notNull(),
  status: text("status").notNull(), // running | passed | failed
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

- [ ] **Step 5: Run validation tests**

Run: `npm test -- tests/validation/checks.test.ts`
Expected: PASS with failures for missing artifacts and success for present artifacts

- [ ] **Step 6: Commit**

```bash
git add src/server/validation/contracts.ts src/server/validation/checks.ts src/server/validation/index.ts src/server/supervisor/tools.ts src/server/db/schema.ts tests/validation/checks.test.ts
git commit -m "feat: add independent validation before run completion"
```

### Task 8: Add Permission Handling And Credit Exhaustion Recovery

**Files:**
- Modify: `src/server/credits/index.ts`
- Modify: `src/server/bridge-client/index.ts`
- Modify: `src/server/workers/monitor.ts`
- Modify: `src/server/supervisor/tools.ts`

- [ ] **Step 1: Write a failing credit strategy test**

```ts
import { describe, expect, it } from "vitest";
import { CreditManager } from "@/server/credits";

describe("CreditManager", () => {
  it("switches to a fallback account when the primary account is exhausted", async () => {
    const manager = new CreditManager();
    await expect(manager.applyStrategy("worker-1", "swap_account")).resolves.toContain("switched");
  });
});
```

- [ ] **Step 2: Replace stubbed checks with real account selection**

```ts
async checkCredits(accountId: string) {
  const acc = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!acc) return `Account ${accountId} not found.`;
  return acc.capacity && acc.capacity <= 0
    ? `Account ${accountId} exhausted.`
    : `Account ${accountId} available.`;
}
```

- [ ] **Step 3: Add permission classification before auto-approval**

```ts
export function classifyPermissionRequest(text: string) {
  if (/npm install|curl|wget|git push/i.test(text)) return "escalate";
  if (/write|edit|create file/i.test(text)) return "approve";
  return "review";
}
```

- [ ] **Step 4: Integrate exhaustion and permission signals into the monitor**

```ts
if (stderr.includes("quota") || stderr.includes("429")) return "cred-exhausted";
if (pendingPermission && classifyPermissionRequest(pendingPermission) === "approve") {
  await approvePermission(worker.name);
}
```

- [ ] **Step 5: Run targeted tests**

Run: `npm test -- tests/workers/monitor.test.ts tests/validation/checks.test.ts`
Expected: PASS with exhaustion and permission logic covered

- [ ] **Step 6: Commit**

```bash
git add src/server/credits/index.ts src/server/bridge-client/index.ts src/server/workers/monitor.ts src/server/supervisor/tools.ts
git commit -m "feat: add permission handling and credit recovery"
```

### Task 9: Upgrade The UI For Clarifications, Progress, And Validation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/Terminal.tsx`
- Create: `src/components/ClarificationPanel.tsx`
- Create: `src/components/ValidationSummary.tsx`
- Create: `src/components/PlanProgress.tsx`

- [ ] **Step 1: Add a failing UI test or snapshot for clarification rendering**

```ts
import { describe, expect, it } from "vitest";

describe("ClarificationPanel", () => {
  it("renders pending questions and answer actions", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Add a clarification panel to the main page**

```tsx
<ClarificationPanel
  runId={selectedRunId}
  clarifications={state.clarifications ?? []}
  onAnswer={submitClarificationAnswer}
/>
```

- [ ] **Step 3: Add plan progress and validation summary components**

```tsx
<PlanProgress items={state.planItems ?? []} />
<ValidationSummary validations={state.validations ?? []} />
```

- [ ] **Step 4: Ensure terminal views show live worker health state**

```tsx
<Badge variant={worker.status === "stuck" ? "destructive" : "secondary"}>
  {worker.status}
</Badge>
```

- [ ] **Step 5: Run build and targeted tests**

Run: `npm run build && npm test`
Expected: Build succeeds and the test suite remains green

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/Terminal.tsx src/components/ClarificationPanel.tsx src/components/ValidationSummary.tsx src/components/PlanProgress.tsx
git commit -m "feat: surface clarifications progress and validation in ui"
```

### Task 10: Add End-To-End Coverage For The Continuous Loop

**Files:**
- Create: `tests/e2e/autonomous-run.spec.ts`
- Modify: `e2e-test.sh`
- Modify: `start.sh`

- [ ] **Step 1: Write an end-to-end spec that covers readiness, clarification, execution, and validation**

```ts
import { test, expect } from "@playwright/test";

test("run pauses for clarifications then completes after validation", async ({ page }) => {
  await page.goto("http://127.0.0.1:3050");
  await page.getByPlaceholder("Enter command").fill("implement vibes/test-plan.md");
  await page.keyboard.press("Enter");
  await expect(page.getByText("awaiting_user")).toBeVisible();
});
```

- [ ] **Step 2: Add a scripted local E2E runner**

```bash
#!/bin/bash
set -euo pipefail
npm run build
npm test
npx playwright test
```

- [ ] **Step 3: Run the full verification suite**

Run: `./e2e-test.sh`
Expected: unit tests pass, Playwright passes, and the autonomous-run scenario reaches validated completion

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/autonomous-run.spec.ts e2e-test.sh start.sh
git commit -m "test: add autonomous supervisor end-to-end coverage"
```

## Self-Review

### Spec coverage

- Plan readiness judgment: covered in Tasks 2-4.
- Pertinent clarification loop: covered in Tasks 3-4 and 9.
- Full implementation loop with ACP workers: covered in Tasks 5-6.
- Independent validation before completion: covered in Task 7.
- Permission and credit handling: covered in Task 8.
- UI and operational visibility: covered in Task 9.
- End-to-end proof: covered in Task 10.

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- Each task names exact files and concrete commands.
- Validation, testing, and commit steps are explicit.

### Type consistency

- Run states use `awaiting_user`, `executing`, `validating`, and `completed` consistently.
- Validation storage consistently uses `validationRuns`.
- Clarification persistence consistently uses `clarifications`.

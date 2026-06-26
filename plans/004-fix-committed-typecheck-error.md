# Plan 004: Fix the committed typecheck error in the planning-mode timeline test

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9e732d4..HEAD -- tests/app/home-utils.test.ts src/app/home/utils.ts`
> If either file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (type correctness)
- **Planned at**: commit `9e732d4`, 2026-06-23

## Why this matters

At commit `9e732d4`, `pnpm exec tsc --noEmit` does **not** pass — there is
exactly one type error:

```
tests/app/home-utils.test.ts(440,7): error TS2353: Object literal may only
specify known properties, and 'runMode' does not exist in type
'{ messages: MessageRecord[]; executionEvents: ExecutionEventRecord[];
supervisorInterventions?: ...; workers?: ...; isPlanningRun?: boolean | undefined; }'.
```

This slipped into the repo because the test runner (`vitest run`) compiles tests
with type-stripping (esbuild/swc) and does **not** typecheck — so a type error in
a test file passes `pnpm test` and is only caught by `tsc`. The function under
test, `buildConversationTimelineItems` (`src/app/home/utils.ts:651`), takes an
`isPlanningRun?: boolean` option; the test passes a non-existent `runMode`
property instead. Because `runMode` is silently ignored at runtime, the test is
also not actually exercising planning mode the way it intends. Fixing this one
line is the prerequisite for adding a typecheck CI gate (plan 001): the gate
cannot be green until this passes.

## Current state

- `src/app/home/utils.ts:651-662` — the function and its option type. The option
  is `isPlanningRun?: boolean` (default `false`); there is no `runMode`:
  ```ts
  export function buildConversationTimelineItems({
    messages,
    executionEvents,
    supervisorInterventions = [],
    workers = [],
    isPlanningRun = false,
  }: {
    messages: MessageRecord[];
    executionEvents: ExecutionEventRecord[];
    supervisorInterventions?: SupervisorInterventionRecord[];
    workers?: ConversationWorkerRecord[];
    isPlanningRun?: boolean;
  }) {
  ```
  `isPlanningRun` flows into `summarizeWorkerSpawnEvent(event, isPlanningRun)`
  (line 701) and `summarizeWorkerStartRecord(worker, isPlanningRun)` (line 691),
  which produce the planning-specific summary strings the test asserts on.
- `tests/app/home-utils.test.ts:440` — the ONLY site in the file passing
  `runMode`. The call ends:
  ```ts
        workers: [
          buildWorker({
            id: "run-1-worker-1",
            workerNumber: 1,
            title: null,
            initialPrompt: null,
            createdAt: "2026-04-27T00:00:10.000Z",
          }),
        ],
        runMode: "planning",
      });
  ```
  The surrounding test asserts the timeline includes planning-mode text such as
  `"Starting planning agent."`, which is produced only when `isPlanningRun` is
  truthy. So the intended value is `isPlanningRun: true`.
- `word of caution`: the string `runMode` appears nowhere in `src/` — it is not a
  real (or in-progress) option. Do not add a `runMode` field to the function;
  the correct fix is on the test side.

## Commands you will need

| Purpose            | Command                                                  | Expected on success            |
|--------------------|----------------------------------------------------------|--------------------------------|
| Install deps       | `pnpm install --frozen-lockfile`                         | exit 0                         |
| Full typecheck     | `pnpm exec tsc --noEmit --incremental false`             | exit 0, no errors              |
| Run the one test   | `pnpm exec vitest run tests/app/home-utils.test.ts`      | all tests pass                 |

Note: use `--incremental false` for the typecheck — there is a `.gitignore`d
`tsconfig.tsbuildinfo` cache that can otherwise mask test-file errors with a
stale result.

## Scope

**In scope** (the only file you should modify):
- `tests/app/home-utils.test.ts` — change one property on the call at ~line 440.

**Out of scope** (do NOT touch):
- `src/app/home/utils.ts` — the function signature is correct; do NOT add a
  `runMode` option to make the test compile. The test is what is wrong.
- Any other test or source file. If `tsc` reports errors in OTHER files after
  your change, that is a STOP condition (it would mean the baseline drifted).

## Git workflow

- This repo FORBIDS creating branches (see `agents.md`). Edit on the current
  branch / in the worktree provided to you. Do NOT push or open a PR unless told.

## Steps

### Step 1: Confirm the baseline error

```
pnpm exec tsc --noEmit --incremental false
```

**Verify**: exits non-zero with exactly the `tests/app/home-utils.test.ts(440,...)`
`runMode` error quoted above (and no other errors). If there are OTHER errors,
see STOP conditions.

### Step 2: Replace the stale `runMode` property with `isPlanningRun: true`

In `tests/app/home-utils.test.ts`, in the `buildConversationTimelineItems({...})`
call at ~line 440, change:

```ts
      runMode: "planning",
```

to:

```ts
      isPlanningRun: true,
```

(Same indentation, same position — it is the last property before the closing
`})`.)

**Verify**:
- `pnpm exec tsc --noEmit --incremental false` → exit 0, no errors.
- `pnpm exec vitest run tests/app/home-utils.test.ts` → all tests pass (the
  planning-mode assertions now run with the flag actually set).

## Test plan

No new test file. This corrects an existing test so it (a) typechecks and (b)
actually passes `isPlanningRun: true`, which is what its assertions about
planning-mode timeline text require. Verification is the two commands in Step 2.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm exec tsc --noEmit --incremental false` exits 0 with no errors.
- [ ] `pnpm exec vitest run tests/app/home-utils.test.ts` passes.
- [ ] `grep -n "runMode" tests/app/home-utils.test.ts` returns no matches.
- [ ] `git status --short` shows only `tests/app/home-utils.test.ts` changed.
- [ ] `plans/README.md` status row for plan 004 updated (unless a reviewer owns the index).

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 shows type errors in files OTHER than `tests/app/home-utils.test.ts`
  (the baseline has drifted from this plan's assumption of a single error).
- After Step 2, `pnpm exec vitest run tests/app/home-utils.test.ts` FAILS at
  runtime. That would mean the test's assertions don't match what
  `isPlanningRun: true` actually produces — report the failing assertion; the
  test's expectations need separate attention beyond this type fix.
- `src/app/home/utils.ts:651-662` no longer matches the "Current state" excerpt
  (e.g. someone added a real `runMode` option) — re-evaluate before editing.

## Maintenance notes

- Root cause is structural: `vitest run` does not typecheck, so test-only type
  errors are invisible until `tsc` runs. Plan 001 (typecheck CI gate) is the
  durable fix — this plan unblocks it. Land 004 before 001.
- A reviewer should confirm the change is a one-line property rename and that the
  planning-mode assertions in this test still pass (i.e. the test now genuinely
  exercises planning mode rather than silently defaulting to non-planning).

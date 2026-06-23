# Plan 001: Add a `typecheck` script and a CI workflow that gates typecheck + lint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9e732d4..HEAD -- package.json .github/workflows`
> If `package.json` or `.github/workflows/` changed since this plan was written,
> compare the "Current state" excerpts against the live files before proceeding;
> on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `9e732d4`, 2026-06-23

## Why this matters

This repo is built around an executor-driven workflow (cheaper agents implement
plans, see `agents.md`), yet nothing automatically verifies that a change
typechecks or lints before it lands. The only GitHub Actions workflow today
(`.github/workflows/codex-acp-release.yml`) builds Rust release binaries and
never touches the TypeScript app. There is also no `typecheck` npm script, so
"does this compile?" is an undiscoverable `pnpm exec tsc --noEmit` invocation.
Adding a `typecheck` script plus a CI workflow that runs typecheck and lint on
every push and PR gives every future change a deterministic, green-or-red gate.
Both gates are confirmed green at the planned-at commit, so this establishes a
baseline rather than chasing existing failures.

## Current state

- `package.json` — defines scripts but **no `typecheck`**. The relevant block today:
  ```json
  "scripts": {
    "preinstall": "node ./scripts/check-pnpm.mjs",
    "predev": "node ./scripts/check-pnpm.mjs --verify-native",
    "dev": "pnpm exec tsx scripts/dev.ts",
    "dev:proxy": "pnpm exec tsx scripts/dev-compression-proxy.ts",
    "auth:password": "node ./scripts/auth-password.mjs",
    "restart:control": "pnpm exec tsx scripts/remote-restart.ts",
    "prebuild": "node ./scripts/check-pnpm.mjs --verify-native",
    "dev:web": "next dev --turbo",
    "setup:agents": "./scripts/install-agent-acp.sh",
    "build": "next build",
    "start": "pnpm exec tsx scripts/start.ts",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "electron:build": "node ./apps/electron/scripts/build.mjs",
    "vscode:build": "node ./apps/vscode/scripts/build.mjs",
    "test:lifecycle": "vitest run tests/lifecycle",
    "measure:dev": "node ./scripts/measure-local-dev.mjs"
  },
  ```
- `tsconfig.json` already sets `"noEmit": true`, so `tsc` is type-only. Running
  `pnpm exec tsc --noEmit` at the planned-at commit exits 0.
- `pnpm lint` runs `eslint` (flat config in `eslint.config.mjs`, extends
  `next/core-web-vitals` + `next/typescript`). It exits 0 at the planned-at commit.
- Toolchain facts the CI must match:
  - Package manager is pnpm, pinned `"packageManager": "pnpm@11.2.2"`.
  - `"engines": { "node": ">=22.13 <26" }` — use Node 22.
  - `preinstall` runs `node ./scripts/check-pnpm.mjs`, which enforces pnpm is the
    package manager. CI **must** install with pnpm, not npm/yarn.
  - There is a `.nvmrc` at the repo root pinning the local Node version.
- `.github/workflows/` currently contains exactly one file:
  `codex-acp-release.yml` (a `workflow_dispatch` Rust build — do not touch it).

## Commands you will need

| Purpose       | Command                     | Expected on success      |
|---------------|-----------------------------|--------------------------|
| Install deps  | `pnpm install --frozen-lockfile` | exit 0              |
| Typecheck     | `pnpm typecheck`            | exit 0, no type errors   |
| Lint          | `pnpm lint`                 | exit 0                   |
| YAML sanity   | `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"` | exit 0 |

(Exact commands verified during recon. `pnpm typecheck` does not exist yet — you
create it in Step 1.)

## Scope

**In scope** (the only files you should modify/create):
- `package.json` — add one script entry.
- `.github/workflows/ci.yml` — create.

**Out of scope** (do NOT touch):
- `.github/workflows/codex-acp-release.yml` — unrelated Rust release pipeline.
- Any source file under `src/`, `tests/`, `apps/` — this plan adds tooling only.
- Do NOT add a test-running job. Running `pnpm test` in CI is a separate,
  larger effort: the suite includes `tests/lifecycle/**` scenarios that spawn
  real subprocesses and bind ports, and native modules (`better-sqlite3`,
  `node-pty`) need build steps. Getting those green headless is out of scope
  here and noted as a follow-up in Maintenance notes.

## Git workflow

- This repo FORBIDS creating branches (see `agents.md`). Make the edits on the
  current branch. Do NOT create a branch, worktree, commit, push, or PR unless
  the operator explicitly instructs it.

## Steps

### Step 1: Add the `typecheck` script

In `package.json`, inside `"scripts"`, add a `typecheck` entry. Place it
immediately after the `"lint": "eslint",` line:

```json
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
```

(Use `tsc --noEmit`, not `pnpm exec tsc` — npm scripts already resolve
node_modules binaries. `tsconfig.json` already has `noEmit: true`, but passing
the flag explicitly keeps the script self-documenting and correct even if the
config changes.)

**Verify**: `pnpm typecheck` → exits 0 with no type errors printed.

### Step 2: Create the CI workflow

Create `.github/workflows/ci.yml` with the following content exactly:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: Typecheck & Lint
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.2.2

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint
```

Notes for you, the executor:
- `pnpm/action-setup@v4` with an explicit `version` installs pnpm **before**
  `actions/setup-node` runs, so the `cache: pnpm` option can find it. Keep this
  ordering.
- `node-version-file: .nvmrc` reuses the repo's pinned Node version. Confirm
  `.nvmrc` exists at the repo root (it does at the planned-at commit). If it does
  not, see STOP conditions.
- The default branch is `master` (confirm with `git rev-parse --abbrev-ref HEAD`
  or `git remote show origin`). If the default branch is NOT `master`, update the
  `push.branches` value to match and note it in your report.

**Verify**:
- `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"` → exit 0.
- `git status --short` shows only `package.json` modified and
  `.github/workflows/ci.yml` added — nothing else.

### Step 3: Confirm the gates are green locally

Run the two commands the CI will run, to confirm the workflow will pass:

**Verify**:
- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm typecheck` → exit 0.
- `pnpm lint` → exit 0.

## Test plan

This plan adds no application code, so there are no new unit tests. Verification
is the local reproduction of the CI gates in Step 3. The CI workflow itself is
validated by:
- Static: the YAML parses (Step 2 verify).
- Behavioral: `pnpm typecheck` and `pnpm lint` both exit 0 locally (Step 3),
  which are the exact commands the workflow runs.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0 (the script now exists and passes).
- [ ] `pnpm lint` exits 0.
- [ ] `.github/workflows/ci.yml` exists and parses as readable text.
- [ ] `git status --short` lists ONLY `package.json` (modified) and
      `.github/workflows/ci.yml` (added).
- [ ] `grep -q '"typecheck": "tsc --noEmit"' package.json` succeeds.
- [ ] `plans/README.md` status row for plan 001 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm typecheck` or `pnpm lint` does NOT exit 0 at the current commit. This
  plan assumes a green baseline; if it is red, the gate cannot be added without
  first fixing pre-existing errors, which is out of scope — report the failing
  output instead.
- `.nvmrc` does not exist at the repo root (the workflow references it).
- The `"scripts"` block in `package.json` no longer matches the "Current state"
  excerpt closely enough to place the `typecheck` entry unambiguously.
- A `.github/workflows/ci.yml` already exists with different content.

## Maintenance notes

- **Follow-up (deferred):** add a `test` job to this workflow. Doing so requires
  deciding how to handle `tests/lifecycle/**` (spawns subprocesses, binds ports)
  and native module builds (`better-sqlite3`, `node-pty`) in a headless runner.
  A reasonable first step is a job that runs only the non-lifecycle unit tests
  (e.g. a new `test:unit` script that excludes `tests/lifecycle/**` and
  `tests/e2e/**`), gated separately so flakiness there doesn't block the
  deterministic typecheck/lint gate.
- A reviewer should confirm the `push.branches` value matches the real default
  branch and that pnpm is installed before `setup-node` (so the cache works).
- If the Node engine range in `package.json` changes, `.nvmrc` (and therefore CI)
  should track it.

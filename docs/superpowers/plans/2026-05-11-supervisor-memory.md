# Supervisor Project Memory — Implementation Plan

Date: 2026-05-11
Spec: `docs/superpowers/specs/2026-05-06-project-wide-supervisor-memory-design.md`

## Goal

Give the supervisor durable, auto-managed, per-project memory stored at
`<projectPath>/.omniharness/memory/*.md`. The supervisor learns from user
clarifications, mid-run steers, interventions, and run outcomes by running an
LLM consolidation pass — at context compaction time and at run end — that
writes durable lessons to disk. A minimal UI lets the user inspect and edit
those files in rare cases; in normal use they are not touched by the user.

## Non-Goals

- Semantic search, embeddings, or memory ranking beyond filename grouping.
- Cross-project memory sharing.
- Real-time co-editing of memory between supervisor and user.
- A rich markdown editor — a plain textarea is sufficient.
- Worker-visible memory pointers (deferred).

## Architecture Summary

Three layers:

1. **Storage + tools** — files on disk under `.omniharness/memory/` plus four
   supervisor tools (`memory_list`, `memory_read`, `memory_write`,
   `memory_append`). Path-safety enforced. This is the existing spec.
2. **LLM consolidation** — at compaction and at run end, a separate supervisor
   model call examines clarifications, interventions, and steering messages
   since the last consolidation watermark and emits a structured plan of
   memory operations.
3. **Minimal UI** — a "Project Memory" panel in project settings: list files,
   open one, edit, save. Read-mostly. No create or delete.

Gated by a two-level on/off toggle (§"Enable/Disable Toggle"): a global
setting that hard-overrides everything, and a per-project setting that can
only narrow the global setting (never override it to "on" when global is
"off").

## Enable/Disable Toggle

Memory is gated by two boolean settings with strict precedence: **global
wins**.

### Settings

- **Global**: `SUPERVISOR_MEMORY_ENABLED` in the existing `settings` table
  (already used for `WORKER_YOLO_MODE_SETTING`, `CREDIT_STRATEGY_SETTING`).
  Default: `true`.
- **Per-project**: stored in **`<projectPath>/.omniharness/config.json`**
  under the key `supervisor.memoryEnabled`. Default: `true`. See
  §"Per-Project Config File" below for the file format and rationale.

### Effective state

A single helper resolves the effective state:

```ts
function isMemoryEnabledForRun(args: {
  globalEnabled: boolean;
  projectEnabled: boolean;
}): boolean {
  return args.globalEnabled && args.projectEnabled;
}
```

Rules:

- If **global is off**, memory is off everywhere. The per-project setting
  has no effect on behavior — but its stored value is preserved (so flipping
  global back on restores the user's per-project preferences).
- If **global is on**, the per-project setting decides. Default is `true`,
  so projects opt in by default.
- The per-project UI control is **disabled** (greyed out) when global is
  off, with explanatory text: "Memory is disabled globally. Enable it in
  app settings to configure per-project memory."
- The per-project stored value is **not modified** when global flips off.
  We never coerce the project setting to `false` based on global state.

### Where the gate applies

When `isMemoryEnabledForRun` returns `false`:

- The four supervisor memory tools (`memory_list`, `memory_read`,
  `memory_write`, `memory_append`) are **not registered** in
  `buildSupervisorTools`. The model never sees them and cannot call them.
- `buildSupervisorTurnContext` sets `projectMemory: null` (or omits the
  block entirely). No directory stat, no read.
- `buildSupervisorModelMessages` omits the memory metadata block entirely
  (no empty header). This keeps the cached prompt prefix consistent across
  runs in different states.
- Consolidation triggers (`compaction`, `mark_complete`, `mark_failed`) are
  **skipped early**. Log `supervisor_memory_consolidation_skipped` with
  `reason: "memory_disabled"` for debuggability, not as a failure.
- The UI Project Memory section still **renders** the existing files (so
  users can read what's there), but the editor is read-only with a banner:
  "Memory is currently disabled — supervisor will not read or update these
  files." This prevents the user from editing files that won't be used.

### Where the gate does not apply

- Files on disk under `.omniharness/memory/` are untouched when toggled off.
  Disabling memory is non-destructive.
- Existing `runs` and their event history are untouched. We do not retro-
  actively hide old consolidation events.

### Per-Project Config File

`.omniharness/` is the project's home for OmniHarness state. Memory files
already live there; settings should too. The long-term shape is "everything
about how OmniHarness behaves in this project lives in this folder, so you
can share or commit it." This plan introduces the first piece of that.

**Location**: `<projectPath>/.omniharness/config.json`

**Format** (JSON, hand-editable, future-extensible):

```json
{
  "version": 1,
  "supervisor": {
    "memoryEnabled": true
  }
}
```

**Why JSON, not TOML or YAML**: zero dependencies, already used elsewhere
in the codebase, trivially hand-editable, no parser ambiguity. The trailing-
comma issue is acceptable for a file the user edits rarely.

**Why a single file, not one file per setting**: easier to share/diff/commit,
avoids directory clutter, and matches how most projects ship project-scoped
config (`package.json`, `tsconfig.json`, `.eslintrc.json`).

### New module: `src/server/projects/config.ts`

Pure functions, no DB:

```ts
type ProjectConfig = {
  version: 1;
  supervisor?: {
    memoryEnabled?: boolean;
  };
};

function getProjectConfigPath(projectPath: string): string;
function readProjectConfig(projectPath: string): ProjectConfig;     // returns {} if missing or unparseable
function writeProjectConfig(projectPath: string, next: ProjectConfig): void;
function getProjectSetting<T>(projectPath: string, key: string, defaultValue: T): T;
function setProjectSetting<T>(projectPath: string, key: string, value: T): void;
```

`getProjectSetting`/`setProjectSetting` use dotted keys like
`"supervisor.memoryEnabled"`. They handle missing files, missing keys,
malformed JSON (treated as "no config — return default") and lazy-create
the `.omniharness/` directory on write.

**Concurrency**: writes are last-write-wins, no locking. The settings are
edited rarely (UI toggle clicks) and a torn write would just reset a
single boolean — acceptable. If concurrency becomes a problem later,
introduce file-level locking via the existing `bridge-lock.ts` pattern.

**Path safety**: same `isPathInside` check used elsewhere — config file
must resolve to inside `<projectPath>/.omniharness/`.

### Future migrations

Other per-project settings that currently live in the DB or as run columns
and should eventually move to `.omniharness/config.json`:

- `allowedWorkerTypes` (currently on `runs`)
- `preferredWorkerType`, `preferredWorkerModel`, `preferredWorkerEffort`
- Anything new that is "how OmniHarness behaves for this project"

That migration is out of scope for this plan, but the config module is
designed to absorb them. Add as a follow-up in §"Phase 5 — Deferred".

### Resolving state at run time

`Supervisor.createModel()` (in `src/server/supervisor/index.ts:690`)
already loads all global settings. Extend it to also call
`getProjectSetting(run.projectPath, "supervisor.memoryEnabled", true)` and
to expose:

```ts
{
  ...existing,
  memoryEnabled: boolean,
}
```

Propagate `memoryEnabled` through to `buildSupervisorTools`,
`buildSupervisorTurnContext`, and the consolidation triggers.

### UI

In **global settings**: add a "Supervisor memory" toggle. Default on.
Helper text: "Let the supervisor remember durable project context between
runs. Turning this off disables memory for all projects."

In **project settings → Project Memory** section: add an "Enabled for this
project" toggle above the file list. Helper text changes based on global
state:

- Global on: "When on, the supervisor reads and updates memory for this
  project."
- Global off: control is disabled; "Memory is disabled globally. Enable it
  in app settings to configure per-project memory."

### Acceptance (Toggle)

- With global off and project on, the supervisor's tool list contains no
  `memory_*` tools (verified by intercepting `buildSupervisorTools`
  output).
- With global off and project on, consolidation triggers fire a
  `supervisor_memory_consolidation_skipped` event with reason
  `memory_disabled` and write no files.
- With global on and project off, same behavior as above — same skipped
  reason.
- With both on, normal behavior.
- Flipping global off does **not** mutate any per-project setting in
  storage. Flipping global back on restores the previous effective state.
- The per-project toggle in the UI is disabled when global is off and its
  stored value is preserved.
- The metadata block in `buildSupervisorModelMessages` is byte-identical
  across a memory-enabled run and a memory-disabled run in terms of the
  cached-prefix region (i.e. the disabled run has no memory block at all
  rather than an empty one), so prompt caching is not destabilized by
  toggling.

## Phase 1 — Storage + Tools

Implements the existing spec verbatim.

### Files to add

- `src/server/supervisor/memory-paths.ts` — path resolution and safety.
  - `resolveMemoryPath(projectPath, relPath)`: rejects absolute paths, `..`
    traversal, empty paths, NUL bytes, unsupported extensions
    (`.md`/`.txt`/`.json` only), symlinks escaping the root.
  - `getMemoryRoot(projectPath)` → `<projectPath>/.omniharness/memory`.
  - `ensureMemoryRoot(projectPath)` — lazy mkdir on first write.
- `src/server/supervisor/memory-tools.ts` — pure operations used by both the
  supervisor tool dispatcher and the UI endpoints.
  - `listMemory(projectPath)` → `Array<{ path, size, updatedAt }>`.
  - `readMemory(projectPath, relPath, maxBytes)` → `{ content, truncated, absolutePath }`.
  - `writeMemory(projectPath, relPath, content)`.
  - `appendMemory(projectPath, relPath, content)`.

### Files to modify

- `src/server/supervisor/tools.ts` — register `memory_list`, `memory_read`,
  `memory_write`, `memory_append` in `buildSupervisorTools`. Schemas:
  - `memory_list`: `{}`
  - `memory_read`: `{ path: string }`
  - `memory_write`: `{ path: string, content: string, reason?: string }`
  - `memory_append`: `{ path: string, content: string, reason?: string }`
- `src/server/supervisor/index.ts` — add four cases in the action switch
  (`index.ts:874`). Each case:
  1. Reads `run.projectPath`; if absent, throw `SupervisorProtocolError`.
  2. Calls the corresponding `memory-tools` function.
  3. Persists a `supervisor_memory_{listed,read,written,appended}` event with
     summary, path, absolute path, byte count, truncation, reason.
  4. `continue;` to the next turn step (memory ops are evidence, not
     turn-ending).
- `src/server/supervisor/context.ts` — extend `SupervisorTurnContext` with:

  ```ts
  projectMemory: {
    root: string | null;
    files: Array<{ path: string; size: number; updatedAt: string }>;
    recentReads: Array<{ path: string; content: string; truncated: boolean }>;
    recentWrites: Array<{ path: string; operation: "write" | "append"; reason: string | null }>;
  }
  ```

  Metadata only; bodies enter via explicit `memory_read` events parsed from
  `executionEvents` like the existing `parseReadFileEvent`.

- `src/server/supervisor/context-window.ts` — render a stable memory section
  near the top of the system prompt so it benefits from prompt caching:

  ```text
  Project memory root: <projectPath>/.omniharness/memory
  Files (12 max): overview.md (2.3 KB), decisions.md (1.1 KB), …
  ```

  Recent reads/writes appear lower, in the dynamic per-turn section.

- `src/server/prompts/supervisor.md` — append the "Prompt Contract" rules from
  the spec §"Prompt Contract".

### Schema changes

Add `memoryMetadataRevision INTEGER NOT NULL DEFAULT 0` to the `runs` table.
Bumped on any memory write (supervisor or user). The context builder uses this
to decide whether to re-stat the directory or reuse the metadata it computed
last turn. See §"Prompt cache preservation" below.

### Acceptance (Phase 1)

Spec §"Acceptance Criteria" applies as written.

## Phase 2 — LLM Consolidation

### New module: `src/server/supervisor/memory-consolidation.ts`

Exported function:

```ts
async function consolidateProjectMemory(args: {
  runId: string;
  trigger: "compaction" | "completion" | "failure";
  outcomeSummary?: string;
}): Promise<{ skipped: boolean; reason?: string; operations?: number }>
```

### Inputs gathered

From the DB, since the last `supervisor_memory_consolidated` event for this
run (or run start if none):

- Answered clarifications (`clarifications.status === "answered"`).
- Supervisor interventions (`supervisorInterventions` rows, focus on
  `interventionType` of `correction`/`redirect`/`steer`).
- User messages with role `user` after the initial prompt — these are organic
  steers.
- Latest compacted memory summary (already in `SupervisorTurnContext.compactedMemory`).
- Outcome summary (passed in by the caller for completion/failure triggers).
- Current memory file metadata + bodies of any files referenced by the above
  signals (let the consolidator see what's already known to avoid duplicates).

### Heuristic pre-filter

Short-circuit if all of the following are true:

- No clarifications since watermark.
- No interventions since watermark.
- No user messages since watermark (other than the original goal).
- Trigger is `compaction` (always run on completion/failure if any signal
  exists).

Return `{ skipped: true, reason: "no_signal" }`.

### Model call

Reuse `getSupervisorModelConfig` and `buildMastraModelConfig`. Use the
**fallback** model config when available — consolidation is cheaper and
non-critical; if quota is tight on the primary, fall back silently.

Prompt structure:

```
SYSTEM: You are extracting durable project-level lessons from a supervisor
run. Output strictly a JSON array of operations on memory files at
.omniharness/memory/. Rules: <rules>.

USER: <signals + current memory snapshot>
```

Rules embedded in the system prompt:

- Only durable, project-scoped lessons. Skip transient task chatter, secrets,
  per-run progress, or anything that would be obvious from reading the
  repository.
- Each operation must cite evidence: which clarification/intervention/message
  it came from, by id or quoted snippet, in `reason`.
- Prefer `append` with a dated bullet (`- 2026-05-11: <lesson>`). Reserve
  `write` for replacing clearly stale sections — and only when the existing
  text is explicitly contradicted.
- If a lesson is already in memory, emit no operation for it.
- Cap: at most 8 operations per consolidation; at most 1500 characters per
  operation payload.

Output schema (validated, rejected on parse failure):

```ts
type ConsolidationPlan = Array<{
  op: "append" | "write";
  path: string;          // relative to memory root, e.g. "gotchas.md"
  content: string;
  reason: string;
  evidenceIds?: string[]; // clarification/intervention ids
}>;
```

### Dispatch

For each operation, call the same `writeMemory`/`appendMemory` functions from
Phase 1 — same path safety, same audit event emission. Wrap the whole batch
in a single `supervisor_memory_consolidated` event with:

- trigger,
- model used,
- operation count,
- full plan (for debugging),
- watermark advanced to: `new Date()`.

For `append` ops, the consolidator appends a provenance footer comment so
human readers know which run produced it:

```md
- 2026-05-11: Prefer `pnpm typecheck` over `npm run build` for fast feedback.
  <!-- supervisor:run=abc123 trigger=completion -->
```

### Trigger points

- **Compaction** — in `src/server/supervisor/index.ts:724` after the
  `supervisor_context_compacted` event is recorded. Run consolidation
  synchronously before continuing the turn loop. Failures log
  `supervisor_memory_consolidation_failed` and continue.
- **`mark_complete`** — `index.ts:1298`, after `cancelRunWorkers` and before
  `runMilestoneAutoCommit` so the auto-commit picks up new memory files.
  Pass `outcomeSummary: summary`.
- **`mark_failed`** — `index.ts:1330`, only when the failure reason does not
  match quota/infra patterns (reuse `extractQuotaResetInfo` or a small
  helper). Pass `outcomeSummary: reason`.

### Cost guards

- Hard ceiling: 1 consolidation per 60 seconds per run (guard against
  pathological compaction loops). Enforced via the watermark + a min-interval
  check.
- Max input size: 80k characters of signal text; truncate clarifications and
  messages by recency if exceeded.
- On model error or invalid JSON: log, skip, do not retry. The next trigger
  will catch up.

### Prompt cache preservation

The metadata block injected by `buildSupervisorModelMessages` must be cache-
friendly:

- Stable position: render directly after `SUPERVISOR_SYSTEM_PROMPT`, before
  any per-turn dynamic content.
- Stable format: file list sorted alphabetically; sizes rounded to KB; **no
  `updatedAt` timestamps in the cached block** (timestamps thrash the cache
  on every `stat`).
- Refresh policy: `buildSupervisorTurnContext` reads
  `runs.memoryMetadataRevision`. If unchanged since the last context build
  for this run, reuse the previous metadata block verbatim (in-memory cache
  keyed by `runId` + revision). Only re-stat the directory when revision
  bumps.
- Revision bumps happen on:
  - `memory_write`/`memory_append` tool calls,
  - consolidation operations,
  - user edits via the UI endpoint.

### Acceptance (Phase 2)

- A run with clarifications produces at least one memory operation on
  completion (verified by event inspection in tests).
- A run with no signals produces a `skipped: no_signal` event and zero
  writes.
- A compaction in the middle of a run with new clarifications consolidates
  those clarifications immediately, and a subsequent completion does not
  re-consolidate them (watermark works).
- Quota-class failures skip consolidation.
- Invalid JSON from the model logs an error event and does not crash the
  run.
- Memory writes from consolidation are visible in the next supervisor turn's
  metadata block.
- The metadata block format does not change turn-to-turn when no writes
  occur (verified by snapshot test on `buildSupervisorModelMessages`
  output).

## Phase 3 — Minimal UI

### Backend

Add tRPC procedures (or REST routes — match the convention used by
`src/server/runs/` adjacent code):

- `projectMemory.list(projectPath)` → `Array<{ path, size, updatedAt, content }>`.
  Reads full bodies, capped at 200 KB per file for the UI (separate budget
  from the supervisor read budget).
- `projectMemory.write({ projectPath, path, content })` → writes via the
  Phase 1 `writeMemory` function, bumps `memoryMetadataRevision` on any
  active run for that project, emits a `supervisor_memory_user_edited`
  event (with `runId: null` since this is out-of-band).

No `delete`. No `create new file`. The supervisor manages file existence.

### Frontend

In whatever project settings surface exists today (the conversation has open
edits in `src/components/home/HomeHeader.tsx` and `src/app/home/*` — confirm
during implementation), add a new section "Project Memory":

- File list on the left (alphabetical, with byte size).
- Selected file content in a plain `<textarea>` on the right (monospace).
- "Save" button. No autosave.
- Header text: "Auto-managed by the supervisor. Edit only when needed."
- Empty state when no `.omniharness/memory/` directory: "No memory yet. The
  supervisor will create files as it learns about this project."

### i18n

Add strings to all 10 locale files in `shared/locales/*.json`:

- `projectMemory.title` — "Project memory"
- `projectMemory.description` — "Auto-managed by the supervisor. Edit only when needed."
- `projectMemory.empty` — "No memory yet."
- `projectMemory.save` — "Save"
- `projectMemory.saved` — "Saved"
- `projectMemory.error` — "Failed to save: {{error}}"

Use the existing `src/lib/i18n.ts` patterns.

### Acceptance (Phase 3)

- The settings panel lists every file under `.omniharness/memory/` for the
  active project.
- Editing and saving a file persists to disk and bumps
  `memoryMetadataRevision` on active runs.
- A subsequent supervisor turn for that run sees the new content (via the
  revision-driven re-stat).
- Path safety from Phase 1 is reused — there is no way to write to a path
  outside the memory root through the UI.

## Phase 4 — Testing

Unit tests:

- `memory-paths.test.ts` — absolute, `..`, NUL, unsupported extensions,
  symlinks, normalization, missing `projectPath`.
- `memory-tools.test.ts` — list with missing dir, write creates dir, append
  vs write semantics, read truncation at the 60 KB budget.
- `memory-consolidation.test.ts` — golden fixtures:
  - run with one clarification → one `append` op.
  - run with no signals → `skipped: no_signal`.
  - quota-class failure → no consolidation.
  - duplicate lesson already in memory → `noop`.
  - invalid model JSON → failure event, no writes.
  - watermark prevents reprocessing on subsequent trigger.
- `context-window.test.ts` snapshot — metadata block stable across two
  turns with no writes; changes after a write.

Integration tests:

- `supervisor/index.test.ts` — exercise the four memory tool cases end-to-
  end (database event recorded, file on disk, error on bad path).
- `consolidation runs on compaction` — synthetic run with clarifications,
  manually trigger compaction, assert event sequence.
- `consolidation runs on mark_complete` — assert ordering: cancel workers →
  consolidate → auto-commit → run_completed event.

UI tests:

- Snapshot the project memory section in the settings dialog.
- E2E: edit a file, save, see persisted content on reload.

Mock the LLM in all consolidation tests — never hit the real model.

## Phase 5 — Deferred

Per spec §"Later Milestones":

- Memory templates seeded on first run.
- CLI command for inspecting project memory.
- Worker-visible memory pointer in initial prompts.
- `supervisor_memory_user_edited` provenance shown in UI.
- Per-file "supervisor vs user last edited" indicators.
- Memory compaction or cleanup suggestions.

Migrate other per-project state into `.omniharness/config.json`:

- `allowedWorkerTypes` from the `runs` table.
- `preferredWorkerType`, `preferredWorkerModel`, `preferredWorkerEffort`.
- Any other "how OmniHarness behaves in this project" knobs.

Goal: shipping or sharing `.omniharness/` (memory + config + whatever
history makes sense) gives a recipient a fully-configured OmniHarness
project without DB migration.

## Rollout

1. Land Phase 1 behind no feature flag — pure additions, dormant until the
   supervisor prompt invokes them.
2. Update the supervisor prompt to introduce the tools; verify in a real
   project that the supervisor starts reading memory.
3. Land Phase 2; verify on a synthetic run with clarifications that
   `gotchas.md` or `decisions.md` gets populated.
4. Land Phase 3; manual smoke test of edit + save round trip.
5. Document in `README.md` and `CLAUDE.md` (project root) that
   `.omniharness/memory/` exists and is committed by default.

## Open Decisions

- Should `.omniharness/memory/` and `.omniharness/config.json` be committed
  to git? Recommendation: **committed**, so memory and project config
  survive clones and benefit the team. Document a `.gitignore` snippet for
  the runtime-only `.omniharness/` subdirectories (cache, locks) but
  whitelist `memory/` and `config.json`.
- Watermark storage: a column on `runs` (e.g. `lastMemoryConsolidationAt`)
  is simpler than scanning events. Recommendation: add the column. (This
  is run-scoped state, so it stays in the DB, not in
  `.omniharness/config.json`.)

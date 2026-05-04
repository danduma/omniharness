# ACP Worker Terminal Processes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show terminal commands currently reported by ACP workers as first-class worker status, without turning the main conversation into a process log.

**Architecture:** Derive a small `WorkerTerminalProcess` view model from ACP `outputEntries` rather than querying the OS process table. Keep the extraction logic shared between backend persistence and frontend display, then render active and recent terminal commands inside worker detail surfaces while preserving full raw events in the existing worker terminal and run log.

**Tech Stack:** TypeScript, Next.js app UI, React 19, existing Manager classes, ACP `sessionUpdate` tool-call events, Drizzle-persisted worker snapshots, Vitest source/unit tests, existing `Terminal` and `WorkerCard` components.

**North Star Product:** Worker detail should feel like an inspectable live execution control plane: the user can see which worker is thinking, which command it is running, whether that command is waiting on permission, what output has appeared, and where to inspect full logs.

**Current Milestone:** Display ACP-reported shell/terminal tool calls as compact active/recent process rows in worker cards and direct terminal surfaces, with command, status, timestamps, and output tail derived from real worker snapshots.

**Later Milestones / Deferred But Intentional:** OS-level child process tables with PIDs, process trees, signal controls, CPU/memory metrics, terminal stream multiplexing, and bridge-level push updates are intentionally deferred. Those require adapter/runtime support beyond generic ACP tool-call events and must not be presented as delivered in this milestone.

**Final Functionality Standard:** This milestone delivers real end-to-end functionality for ACP-reported terminal commands: worker ACP updates enter the runtime, persist in worker snapshots, derive deterministic process state, and render in the worker UI. It does not fake process data, infer nonexistent PIDs, or claim visibility into commands the ACP adapter does not report.

---

## File Map

Files to create:

- `src/lib/worker-terminal-processes.ts`: pure extractor that turns `AgentOutputEntry[]` into `WorkerTerminalProcess[]`.
  - Responsibility: identify shell-like ACP tool calls, merge updates by `toolCallId`, normalize command/status/timestamps/output, and classify active vs completed.
- `tests/lib/worker-terminal-processes.test.ts`: TDD coverage for command extraction, update merging, status transitions, and output-tail behavior.

Files to modify:

- `src/lib/agent-output.ts`
  - Responsibility: reuse terminal-process extraction helpers where useful, or keep current activity rendering compatible with the new extractor. Avoid duplicating command parsing logic.
- `src/app/home/types.ts`
  - Responsibility: add lightweight frontend types only if the process view model needs to cross component boundaries. Prefer importing the shared type from `src/lib/worker-terminal-processes.ts` if practical.
- `src/components/WorkerCard.tsx`
  - Responsibility: render a compact `Terminal Processes` section from worker `agent.outputEntries`, with active commands first and recent completed commands below.
- `src/components/Terminal.tsx`
  - Responsibility: keep the existing full activity feed, optionally add a small active-command header for direct/native terminal surfaces if it improves orientation without duplicating WorkerCard content.
- `src/components/home/WorkersSidebar.tsx`
  - Responsibility: pass existing agent/output data through unchanged; avoid new per-worker polling.
- `src/server/agent-runtime/types.ts`
  - Responsibility: add structured raw metadata fields only if current `OutputEntry` typing blocks safe extraction.
- `src/server/agent-runtime/manager.ts`
  - Responsibility: preserve more raw ACP tool-call metadata only if existing `raw` payloads are insufficient. This file is 1118 lines; avoid growth by extracting helper logic instead of adding substantial code here.
- `src/server/workers/snapshots.ts`
  - Responsibility: continue persisting `outputEntriesJson`; no schema change unless tests prove data is being dropped.
- `src/server/bridge-client/index.ts`
  - Responsibility: keep normalization permissive enough to preserve raw ACP tool metadata.
- `tests/lib/agent-output.test.ts`
  - Responsibility: update existing activity tests if shared extraction changes command labels or panes.
- `tests/ui/terminal-fit.test.ts`
  - Responsibility: source-level UI guardrails for active command display and no layout regressions.
- `tests/ui/sidebar-layout.test.ts`
  - Responsibility: guard that worker cards show process rows and the main conversation does not.
- `tests/server/agent-runtime/http.test.ts`
  - Responsibility: verify fake ACP `tool_call` / `tool_call_update` events expose terminal-process fields through `/agents/:name`.
- `tests/supervisor/observer.test.ts`
  - Responsibility: verify persisted worker snapshots retain enough terminal-process data after observer polling.

Files not to modify unless a test forces it:

- `src/server/db/schema.ts`: no schema change is planned because `workers.outputEntriesJson` already persists structured ACP activity.
- `src/components/home/ConversationMain.tsx`: main conversation should not display terminal process rows.
- App routing files: do not add file-based routing.

Candidate agentic user journey tests, approval-gated:

- Start an implementation conversation with a worker that runs a shell command. Confirm the main conversation stays clean, the worker sidebar shows the active command, and the full terminal shows input/output details.
- Start a direct worker session, ask it to run a long command, and confirm the direct surface shows command progress without hiding permission/error states.

These black-box journey tests require explicit user approval before running.

## Product Behavior

Primary user stories:

- As a builder, I can see which command a worker is currently running without opening a raw terminal log.
- As a builder, I can distinguish "thinking" from "running `pnpm test ...`" from "waiting on permission".
- As a builder returning to a conversation, I can inspect recent commands from persisted worker snapshots.
- As a builder debugging a failure, I can open the full terminal or run log for raw ACP details.

Current milestone behavior:

- Worker cards show a compact process section only when command-like ACP tool calls exist.
- Active processes appear above completed/recent processes.
- Each row shows a command/title, normalized status, relative or absolute timestamp, and a short output/error tail when available.
- Long commands truncate visually but remain inspectable through tooltip/title or expansion.
- Permission requests remain prominent and are not hidden by process rows.
- Main conversation remains free of process-log rows.

Deferred behavior:

- PIDs, process tree, kill/restart controls, CPU/memory usage, and raw shell session multiplexing.
- Detecting commands that the ACP adapter does not report.
- New persistence tables for process history.

## State And Persistence Model

Durable source of truth:

- ACP `sessionUpdate` events captured as runtime `outputEntries`.
- `workers.outputEntriesJson` persisted by the observer.
- Existing runtime `/agents/:name` status responses for live worker details.

Derived UI state:

- `WorkerTerminalProcess[]` derived from `AgentSnapshot.outputEntries`.
- Active/recent process display derived inside worker UI components.
- No frontend state becomes the source of truth for terminal process status.

No new settings are required.

## Tasks

- [ ] **Step 1: Write failing extractor tests**
  - Add `tests/lib/worker-terminal-processes.test.ts`.
  - Cover `tool_call` with `toolKind: "execute"` and raw `command`.
  - Cover `tool_call_update` merging by `toolCallId`.
  - Cover status normalization: `pending`, `in_progress`, `working`, `completed`, `failed`, `error`, `cancelled`.
  - Cover command extraction from `raw.rawInput.command`, `raw.command`, `raw.cmd`, and title fallback.
  - Cover output extraction from ACP content text, raw output, stdout/stderr-like metadata, and truncation.
  - Verification: run `pnpm test tests/lib/worker-terminal-processes.test.ts` and confirm failures are due to missing implementation.

- [ ] **Step 2: Implement the shared process extractor**
  - Create `src/lib/worker-terminal-processes.ts`.
  - Export:
    - `type WorkerTerminalProcess`
    - `deriveWorkerTerminalProcesses(outputEntries: AgentOutputEntry[]): WorkerTerminalProcess[]`
    - `isActiveWorkerTerminalProcess(process: WorkerTerminalProcess): boolean`
  - Keep all parsing pure and deterministic.
  - Do not infer OS-level process data.
  - Verification: `pnpm test tests/lib/worker-terminal-processes.test.ts`.

- [ ] **Step 3: Preserve ACP raw metadata through runtime status**
  - Inspect `src/server/agent-runtime/manager.ts`, `src/server/bridge-client/index.ts`, and fake ACP tests.
  - If raw command/output metadata is already preserved, do not edit runtime manager.
  - If metadata is being dropped, extract tiny helpers rather than adding substantial code to `manager.ts`.
  - Add or update `tests/server/agent-runtime/http.test.ts` so a fake ACP worker emits shell `tool_call` and `tool_call_update` events and `/agents/worker-1` returns enough `outputEntries` to derive command state.
  - Verification: `pnpm test tests/server/agent-runtime/http.test.ts tests/lib/worker-terminal-processes.test.ts`.

- [ ] **Step 4: Verify observer persistence**
  - Extend `tests/supervisor/observer.test.ts` with command-like `outputEntries`.
  - Assert `workers.outputEntriesJson` preserves raw command and update metadata after `pollRunWorkers`.
  - Keep the test focused on real persisted rows, not mocked UI state.
  - Verification: `pnpm test tests/supervisor/observer.test.ts tests/lib/worker-terminal-processes.test.ts`.

- [ ] **Step 5: Render process rows in worker cards**
  - In `src/components/WorkerCard.tsx`, derive processes from `agent.outputEntries`.
  - Add a compact `Terminal Processes` section only when processes exist.
  - Show active processes first, then the most recent completed commands.
  - Keep rows dense, task-oriented, and consistent with existing worker card styling.
  - Do not nest cards inside cards; use a small section/list inside the worker card.
  - Do not add decorative color beyond status semantics.
  - Verification: add/update source tests in `tests/ui/sidebar-layout.test.ts`.

- [ ] **Step 6: Keep Terminal as the full detail surface**
  - In `src/components/Terminal.tsx`, preserve the existing full activity feed.
  - If adding an active-command header, keep it small and only in direct/native terminal surfaces where it adds orientation.
  - Do not duplicate the WorkerCard process list inside the full terminal history unless the UI needs it for direct mode.
  - Keep the known terminal timeline source guardrails passing.
  - Verification: `pnpm test tests/ui/terminal-fit.test.ts tests/lib/agent-output.test.ts`.

- [ ] **Step 7: Main conversation guardrail**
  - Ensure `src/components/home/ConversationMain.tsx` does not import the process component or display process rows.
  - Add/update a source-level assertion in `tests/ui/sidebar-layout.test.ts`.
  - Verification: `pnpm test tests/ui/sidebar-layout.test.ts`.

- [ ] **Step 8: Error and permission behavior**
  - Ensure failed commands expose status and output/error tail.
  - Ensure permission rows remain visible and are not replaced by terminal-process rows.
  - Add focused tests for failed command output and permission coexistence.
  - Verification: `pnpm test tests/lib/worker-terminal-processes.test.ts tests/ui/sidebar-layout.test.ts`.

- [ ] **Step 9: Run targeted verification**
  - Required:
    - `pnpm test tests/lib/worker-terminal-processes.test.ts`
    - `pnpm test tests/lib/agent-output.test.ts tests/ui/terminal-fit.test.ts tests/ui/sidebar-layout.test.ts`
    - `pnpm test tests/server/agent-runtime/http.test.ts tests/supervisor/observer.test.ts`
    - changed-file ESLint for touched files
    - `git diff --check`
  - If full `pnpm test`, `pnpm lint`, or `pnpm exec tsc --noEmit` still fail due to pre-existing unrelated repo issues, record exact blockers instead of claiming full-suite success.

- [ ] **Step 10: Optional approval-gated journey test**
  - Ask for explicit approval before running an agentic user journey.
  - Mission: create a worker that runs a visible shell command, confirm process rows in the worker sidebar, full details in Terminal, and no main conversation process spam.
  - Entry point: running local OmniHarness app.
  - Expected visible proof: worker sidebar shows the active/recent command and the full terminal includes input/output details.

## Acceptance Criteria

- ACP-reported shell/terminal tool calls display as terminal-process rows in worker detail surfaces.
- Active commands are visibly distinct from completed commands.
- Command, status, timestamp, and output/error tail are derived from real `outputEntries`.
- Worker snapshots persist enough data for process rows after reload.
- Main conversation does not render terminal process rows.
- Permission requests and worker errors remain visible.
- Tests cover extraction, runtime propagation, observer persistence, and UI source guardrails.

## Self-Review Checklist

- Every deliverable maps to a concrete task.
- No task depends on fake process data, canned commands, or placeholder UI.
- No branch or worktree is assumed.
- No file-based routing is introduced.
- `src/server/agent-runtime/manager.ts` growth is controlled because it is already close to 1200 lines.
- OS-level process tables are clearly deferred and not presented as part of this milestone.

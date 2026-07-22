---
codex_thread_id: "019f13ab-aa95-7132-8ee3-b19a2f71bf5c"
title: "Codex conversation 019f13ab"
started_at: "2026-06-29T13:57:25.328Z"
updated_at: "2026-06-29T13:58:14.280Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "active"
part: 1
parts: 1
---

# Codex conversation 019f13ab

> This archive contains visible conversation activity and tool records. Private model reasoning and system/developer instructions are not available here.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-29T13:57:25.436Z","phase":null} -->
## Task state: task_started · 2026-06-29T13:57:25.436Z

```text
{
  "type": "task_started",
  "turn_id": "019f13ab-aaf8-73e0-b66c-41d1a68bc999",
  "started_at": 1782741445,
  "model_context_window": 258400,
  "collaboration_mode_kind": "default"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-29T13:57:28.925Z","phase":null} -->
## User · 2026-06-29T13:57:28.925Z

Review the current code changes (staged, unstaged, and untracked files) and provide prioritized findings.

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-29T13:57:34.857Z","phase":"commentary"} -->
## Codex progress · 2026-06-29T13:57:34.857Z

I’ll use the code-review workflow and the required second-opinion CLIs while keeping the repository unchanged.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:57:36.528Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:57:36.528Z

```json
{
  "cmd": "cat /Users/masterman/.agents/skills/requesting-code-review/SKILL.md && printf '\\n--- using-ultrapowers ---\\n' && cat /Users/masterman/.agents/skills/using-ultrapowers/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:57:36.580Z","phase":null} -->
## Tool result: call_HwANF2tUhbwE9QnH0BZT2I7L · 2026-06-29T13:57:36.580Z

````text
Chunk ID: 7555fe
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2759
Output:
---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch ultrapowers:code-reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use Task tool with ultrapowers:code-reviewer type, fill template at `code-reviewer.md`

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch ultrapowers:code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from docs/superpowers/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md

--- using-ultrapowers ---
---
name: using-ultrapowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before acting
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Using Ultrapowers

Use relevant skills before acting, but keep process proportional to the task.

## Instruction Priority

1. User instructions and local repo instructions
2. Ultrapowers skills
3. Default model behavior

If the user says not to create extra repository isolation, or says to work directly in the current repository, follow that instruction.

## Core Rule

Before responding, ask:

1. Is there a process skill that governs how to approach this?
2. Is there an implementation skill that governs how to execute it?
3. Is the request substantial enough to justify that process, or is it a tiny mechanical edit?

If a skill applies and the task is substantial enough to justify it, use it before continuing. If the request is a tiny mechanical edit, make the edit directly with targeted verification.

## Proportional Skill Use

Do the smallest responsible workflow that matches the request.

For tiny, unambiguous mechanical edits, do the edit directly:

- changing a color value,
- fixing a typo,
- tweaking short copy,
- changing a prompt sentence,
- renaming a label,
- adjusting obvious spacing or formatting,
- making a one-line config or docs correction.

For these, do not run brainstorming, write a plan, or force TDD unless the change affects product behavior, data, persistence, control flow, user journeys, or non-obvious architecture.

Use the heavier process when the request is ambiguous, user-facing behavior changes, multiple files/modules are involved, the user journey can change, or the change could create regressions that are not obvious from a quick targeted check.

## Default Posture

- Work in the current repository by default.
- YOU WILL NEVER CREATE A BRANCH unless explicitly instructed.
- Ask the user whether we should work in worktrees as part of the planning.
- YOU WILL ONLY CREATE A WORKTREE if explicitly instructed.
- Keep skill use proportional. Tiny mechanical edits should stay tiny.
- Every project should have a `.gitignore`.
- Never commit or push secrets, credentials, local environment files, `node_modules`, dependency caches, build outputs, coverage output, logs, temporary files, or intermediate/generated artifacts unless the human explicitly asks to version a specific generated artifact.
- Deliver full product functionality by default. NO FAKE COMPONENTS, NO MOCKS, NO PLACEHOLDERS, NO FALLBACKS as substitutes for the requested functionality unless the human explicitly asks for a prototype or scaffold.
- For app, UI, and product-surface work, run a PM pass during planning. Treat it as mandatory default behavior, not optional polish.
- For app, UI, and product-surface work, consider `agentic-user-journey-testing` for important user stories, but do not run it without explicit user approval.
- Use `second-opinion` for substantial saved implementation plans, and for unusually hard, creative, high-risk, or architecture-heavy specs when an independent external review could improve the artifact. Prefer a different available coding harness for that review, such as Codex asking Claude Code or Claude Code asking Codex. If no different harness is available, the same harness is fine; the second opinion is still mandatory for matching artifacts.
- Refactor code when a file passes 1200 lines. Do not normalize oversized files as the default end state.
- Use user stories in specs and plans when they clarify behavior or value.
- Default UI work to `shadcn/ui` unless the user says otherwise.
- When designing UI from scratch, first inspect the available ShadCN Blocks at https://ui.shadcn.com/blocks for each screen, form, or major surface. Start from the closest matching block with `npx shadcn add <block-name>` or the block's source in https://github.com/shadcn-ui/ui, then edit it by adding, removing, or adapting controls. Do not invent a fresh layout before doing this block-selection pass.
- Before adding any individual UI control, check whether `shadcn/ui` already provides a control that does what is needed. Use the available shadcn control first, then customize it, instead of hand-building a one-off control.
- Treat desktop and mobile responsiveness as first-class from the beginning.
- Prefer explicit routing unless the framework strongly defaults to file-based routes.
- For React apps, use `building-react-apps` for state managers, explicit transitions, routing, refs, imports, package-manager defaults, and frontend configuration defaults.
- For React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization, use `client-server-state-invariants` during planning and verification.
- For React or Next.js slowness, root-load, compile-time, SSR/hydration, bundle, import-bloat, or UI dependency cleanup work, use `optimizing-react-next-apps`.
- Prefer strong instrumentation and auditability for backend behavior.
- When a project has backend or agent workflows, prefer a fully instrumented control plane: persist meaningful events, tool calls, actions, results, errors, and state transitions, and expose them through a CLI or other scriptable interface so the full system can be inspected and tested without the UI.
- Use `instrumenting-control-planes` when building, planning, reviewing, or debugging backend decisions, agent workflows, recovery paths, retries, deletes, long-running jobs, SSE/WebSocket streams, or user-visible failures.
- Use `learning-from-bugs` after diagnosing or fixing meaningful architecture, storage, memory, persistence, control-plane, or system-level bugs so reusable lessons become durable.
- Do not default to silent, masked, or over-abstracted errors.
- When a project has a frontend, prefer surfacing full backend error details and stack traces to the frontend so failures stay visible, debuggable, and testable end-to-end.
- Treat persistence of settings and preferences as explicit design work.
- For every meaningful UI setting, define whether it persists, where it is stored, how it is read and written, who owns it, and how reset, sync, migration, and testing are handled.

See `docs/ultrapowers-defaults.md` for the canonical fork defaults.

## Skill Priority

1. Process skills first
2. Implementation skills second

Examples:

- "Make this button blue" -> inspect the relevant file, make the small edit, do targeted verification
- "Update this prompt sentence" -> edit the prompt directly and verify the final text
- "Build a feature" -> `brainstorming` with a PM pass first, then `writing-plans`, then execution; consider approval-gated `agentic-user-journey-testing` for app workflows
- "Fix this bug" -> `systematic-debugging`, then the relevant implementation skill; if the root cause is meaningful or systemic, finish with `learning-from-bugs`
- "Review this change" -> `requesting-code-review`

## Examples Of User Override

- If a task feels risky and the user did not ask for extra repository isolation, keep working in the current repository unless the user explicitly instructs otherwise.
- If a stack supports file-based routing but the user says not to use it, choose an explicit routing approach instead.
- If a framework strongly defaults to file-based routing, such as Next.js App Router, use the framework-native routing model unless there is a good reason not to.
- If a frontend skill suggests `shadcn/ui` but the user wants another design system, follow the user.

## Red Flags

- "I need a whole workflow for this tiny edit" -> no. Use the smallest responsible process.
- "This is simple, so I need the whole process anyway" -> no. Tiny mechanical edits should stay tiny.
- "I'll create extra repository isolation just to be safe" -> forbidden unless the user clearly asked for it.
- "I already know the skill" -> read the current version before relying on it

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:57:42.487Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:57:42.487Z

```json
{
  "cmd": "git status --short && printf '\\n--- branch ---\\n' && git branch --show-current && printf '\\n--- diff stat ---\\n' && git diff --stat && printf '\\n--- staged stat ---\\n' && git diff --cached --stat",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:57:42.640Z","phase":null} -->
## Tool result: call_Pd1Na34E4TvJzS9dxLWpHl3z · 2026-06-29T13:57:42.640Z

```text
Chunk ID: fa4148
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2166
Output:
 M docs/superpowers/specs/2026-05-29-multi-account-cli-credentials.md
 M shared/locales/de.json
 M shared/locales/en.json
 M shared/locales/es.json
 M shared/locales/fr.json
 M shared/locales/it.json
 M shared/locales/ja.json
 M shared/locales/ko.json
 M shared/locales/pt.json
 M shared/locales/zh-CN.json
 M src/app/home/BusyMessageQueueManager.ts
 M src/app/home/ComposerContainer.tsx
 M src/app/home/HomeApp.tsx
 M src/app/home/HomeUiStateManager.ts
 M src/app/home/auto-resume-selection.ts
 M src/app/home/types.ts
 M src/app/home/useFrozenRecentOrder.ts
 M src/app/home/useHomeMutations.ts
 M src/app/home/useHomeViewModel.ts
 M src/components/home/ConversationComposer.tsx
 M src/components/settings/AgentsSettingsPanel.tsx
 M src/components/settings/SettingsDialog.tsx
 M src/runtime/http/routes/conversation-messages.ts
 M src/runtime/http/routes/conversations.ts
 M src/runtime/http/routes/events.ts
 M src/runtime/http/routes/prewarm-worker.ts
 M src/runtime/http/routes/runs.ts
 M src/server/accounts/dto.ts
 M src/server/agent-runtime/http.ts
 M src/server/agent-runtime/manager.ts
 M src/server/agent-runtime/types.ts
 M src/server/agent-runtime/worker-pool.ts
 M src/server/artifacts/stream-metadata.ts
 M src/server/bridge-client/index.ts
 M src/server/conversations/create.ts
 M src/server/conversations/queued-messages.ts
 M src/server/conversations/send-message.ts
 M src/server/conversations/sync.ts
 M src/server/db/index.ts
 M src/server/db/schema.ts
 M src/server/events/named-events.ts
 M src/server/events/persisted-snapshot.ts
 M src/server/quota/recovery.ts
 M src/server/quota/type-blocking.ts
 M src/server/quota/worker-resume.ts
 M src/server/runs/failures.ts
 M src/server/runs/recovery-reconciler.ts
 M src/server/runs/recovery.ts
 M src/server/session-providers/omni-provider.ts
 M src/server/session-providers/types.ts
 M src/server/supervisor/index.ts
 M src/server/supervisor/lease.ts
 M src/server/supervisor/retry.ts
 M src/server/supervisor/runtime-watchdog.ts
 M src/server/supervisor/wake-schedule.ts
 M src/server/supervisor/wake.ts
 M src/server/supervisor/worker-availability.ts
 M src/server/supervisor/worker-failover.ts
 M tests/api/conversation-messages-route.test.ts
 M tests/api/events-route.test.ts
 M tests/app/auto-resume-selection.test.ts
 M tests/app/busy-message-queue-manager.test.ts
 M tests/app/use-frozen-recent-order.test.ts
 M tests/runtime/http-routes.test.ts
 M tests/server/agent-runtime/http.test.ts
 M tests/server/agent-runtime/worker-pool.test.ts
 M tests/server/conversations-sync.test.ts
 M tests/server/quota/type-blocking.test.ts
 M tests/server/runs/failures.test.ts
 M tests/supervisor/index.test.ts
 M tests/supervisor/lease.test.ts
 M tests/supervisor/retry.test.ts
 M tests/supervisor/runtime-watchdog.test.ts
 M tests/supervisor/wake.test.ts
 M tests/supervisor/worker-availability.test.ts
 M tests/ui/composer-shell.test.ts
 M tests/ui/sidebar-layout.test.ts
?? .claude/
?? docs/superpowers/learnings/2026-06-26-frozen-recent-rows-must-refresh-terminal-status.md
?? docs/superpowers/learnings/2026-06-26-live-stream-renders-must-not-repaint-composer.md
?? docs/superpowers/learnings/2026-06-26-steer-delivery-must-not-revive-queued-intent.md
?? docs/superpowers/learnings/2026-06-28-sqlite-busy-wake-leases-and-worker-availability.md
?? docs/superpowers/learnings/2026-06-29-account-snapshot-dto-redaction.md
?? docs/superpowers/learnings/2026-06-29-project-scoped-cli-homes-must-bridge-current-auth-files.md
?? src/server/accounts/account-allocator.ts
?? src/server/accounts/account-resolver.ts
?? src/server/db/retry.ts
?? tests/server/accounts/
?? tests/server/conversations-sync-concurrency.test.ts
?? tests/server/db-retry.test.ts

--- branch ---
master

--- diff stat ---
 .../2026-05-29-multi-account-cli-credentials.md    |  62 +++++-
 shared/locales/de.json                             |   5 +
 shared/locales/en.json                             |   5 +
 shared/locales/es.json                             |   5 +
 shared/locales/fr.json                             |   5 +
 shared/locales/it.json                             |   5 +
 shared/locales/ja.json                             |   5 +
 shared/locales/ko.json                             |   5 +
 shared/locales/pt.json                             |   5 +
 shared/locales/zh-CN.json                          |   5 +
 src/app/home/BusyMessageQueueManager.ts            |  78 +++++++-
 src/app/home/ComposerContainer.tsx                 |  16 +-
 src/app/home/HomeApp.tsx                           | 119 +++++++++---
 src/app/home/HomeUiStateManager.ts                 |   3 +
 src/app/home/auto-resume-selection.ts              |   5 +
 src/app/home/types.ts                              |  20 +-
 src/app/home/useFrozenRecentOrder.ts               |  14 +-
 src/app/home/useHomeMutations.ts                   |  12 +-
 src/app/home/useHomeViewModel.ts                   |  42 +++--
 src/components/home/ConversationComposer.tsx       |  65 +++++--
 src/components/settings/AgentsSettingsPanel.tsx    |  34 +++-
 src/components/settings/SettingsDialog.tsx         |   5 +-
 src/runtime/http/routes/conversation-messages.ts   |   2 +
 src/runtime/http/routes/conversations.ts           |   1 +
 src/runtime/http/routes/events.ts                  |   3 +-
 src/runtime/http/routes/prewarm-worker.ts          |   2 +
 src/runtime/http/routes/runs.ts                    |  12 ++
 src/server/accounts/dto.ts                         |  29 +++
 src/server/agent-runtime/http.ts                   |   4 +
 src/server/agent-runtime/manager.ts                |  88 +++++++--
 src/server/agent-runtime/types.ts                  |   1 +
 src/server/agent-runtime/worker-pool.ts            |   3 +
 src/server/artifacts/stream-metadata.ts            |   5 +-
 src/server/bridge-client/index.ts                  |   3 +
 src/server/conversations/create.ts                 |  15 ++
 src/server/conversations/queued-messages.ts        |  81 +++++---
 src/server/conversations/send-message.ts           |  83 +++++++-
 src/server/conversations/sync.ts                   |  58 +++---
 src/server/db/index.ts                             | 133 ++++++++++++-
 src/server/db/schema.ts                            |  65 ++++++-
 src/server/events/named-events.ts                  |  38 +++-
 src/server/events/persisted-snapshot.ts            |   3 +-
 src/server/quota/recovery.ts                       |   9 +-
 src/server/quota/type-blocking.ts                  | 119 ++++++++++--
 src/server/quota/worker-resume.ts                  |   1 +
 src/server/runs/failures.ts                        |   3 +
 src/server/runs/recovery-reconciler.ts             |   2 +
 src/server/runs/recovery.ts                        |  14 ++
 src/server/session-providers/omni-provider.ts      |   1 +
 src/server/session-providers/types.ts              |   1 +
 src/server/supervisor/index.ts                     |  70 +++++--
 src/server/supervisor/lease.ts                     |  11 +-
 src/server/supervisor/retry.ts                     |  15 ++
 src/server/supervisor/runtime-watchdog.ts          |   6 +-
 src/server/supervisor/wake-schedule.ts             |  13 +-
 src/server/supervisor/wake.ts                      | 106 ++++++++++-
 src/server/supervisor/worker-availability.ts       |  32 ++--
 src/server/supervisor/worker-failover.ts           |  11 ++
 tests/api/conversation-messages-route.test.ts      |  91 ++++++++-
 tests/api/events-route.test.ts                     |  31 ++-
 tests/app/auto-resume-selection.test.ts            |  27 +++
 tests/app/busy-message-queue-manager.test.ts       |  18 ++
 tests/app/use-frozen-recent-order.test.ts          |  20 +-
 tests/runtime/http-routes.test.ts                  |  40 ++++
 tests/server/agent-runtime/http.test.ts            |  47 +++++
 tests/server/agent-runtime/worker-pool.test.ts     |  37 +++-
 tests/server/conversations-sync.test.ts            | 103 ++++++++++
 tests/server/quota/type-blocking.test.ts           |  65 +++++++
 tests/server/runs/failures.test.ts                 |  20 ++
 tests/supervisor/index.test.ts                     |  56 +++++-
 tests/supervisor/lease.test.ts                     |  17 +-
 tests/supervisor/retry.test.ts                     |  17 ++
 tests/supervisor/runtime-watchdog.test.ts          |  34 ++++
 tests/supervisor/wake.test.ts                      | 209 +++++++++++++++++++++
 tests/supervisor/worker-availability.test.ts       |  50 ++++-
 tests/ui/composer-shell.test.ts                    |  17 +-
 tests/ui/sidebar-layout.test.ts                    |  10 +
 77 files changed, 2237 insertions(+), 235 deletions(-)

--- staged stat ---

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:57:48.697Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:57:48.697Z

```json
{
  "cmd": "git diff -- src/server/db/index.ts src/server/db/schema.ts src/server/accounts/account-allocator.ts src/server/accounts/account-resolver.ts src/server/accounts/dto.ts src/server/conversations/send-message.ts src/server/conversations/queued-messages.ts src/server/conversations/sync.ts src/server/quota/type-blocking.ts src/server/agent-runtime/manager.ts src/server/supervisor/index.ts src/server/supervisor/wake.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:57:48.759Z","phase":null} -->
## Tool result: call_m1a9EkE2ZtZaAp7ArmIXjAxh · 2026-06-29T13:57:48.759Z

```text
Chunk ID: 904e66
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 16790
Output:
Total output lines: 1602

diff --git a/src/server/accounts/dto.ts b/src/server/accounts/dto.ts
index 637c8f1..b52855a 100644
--- a/src/server/accounts/dto.ts
+++ b/src/server/accounts/dto.ts
@@ -4,20 +4,49 @@ type AccountRow = typeof accounts.$inferSelect;
 
 export type AccountDto = {
   id: string;
+  cliType: string | null;
   provider: string;
   type: string;
+  label: string | null;
+  authMode: string;
+  enabled: boolean;
+  priority: number;
   capacity: number | null;
   resetSchedule: string | null;
+  status: string | null;
+  statusCheckedAt: string | null;
+  metadata: Record<string, unknown> | null;
   createdAt: string;
+  updatedAt: string | null;
 };
 
+function parseMetadata(metadataJson: string | null): Record<string, unknown> | null {
+  if (!metadataJson) return null;
+  try {
+    const value = JSON.parse(metadataJson) as unknown;
+    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
+    return value as Record<string, unknown>;
+  } catch {
+    return null;
+  }
+}
+
 export function toAccountDto(account: AccountRow): AccountDto {
   return {
     id: account.id,
+    cliType: account.cliType ?? null,
     provider: account.provider,
     type: account.type,
+    label: account.label ?? null,
+    authMode: account.authMode,
+    enabled: account.enabled,
+    priority: account.priority,
     capacity: account.capacity ?? null,
     resetSchedule: account.resetSchedule ?? null,
+    status: account.status ?? null,
+    statusCheckedAt: account.statusCheckedAt?.toISOString() ?? null,
+    metadata: parseMetadata(account.metadataJson ?? null),
     createdAt: account.createdAt.toISOString(),
+    updatedAt: account.updatedAt?.toISOString() ?? null,
   };
 }
diff --git a/src/server/agent-runtime/manager.ts b/src/server/agent-runtime/manager.ts
index d46d6dd..59ea7da 100644
--- a/src/server/agent-runtime/manager.ts
+++ b/src/server/agent-runtime/manager.ts
@@ -9,7 +9,6 @@ import { Readable, Writable } from "stream";
 import * as acp from "@agentclientprotocol/sdk";
 import { sanitizeAcpStream } from "./acp-stream-sanitizer";
 import { applyCodexBridgeEnv, buildCodexConfigArgs, shouldSetRequestedMode } from "./codex";
-import { applyCredentialProfileEnv, resolveCredentialProfile } from "./external-credentials";
 import { isRecoverableConnectionSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";
 import { commandAvailable, createToolDiagnostics, refreshCachedLoginShellPath, withCodexStandardTooling, withManagedPath } from "./tool-env";
 import {
@@ -34,6 +33,10 @@ import type {
   StartAgentInput,
 } from "./types";
 import { RuntimeHttpError } from "./types";
+import {
+  applyAccountCredentialEnv,
+  resolveAccountCredentials,
+} from "@/server/accounts/account-resolver";
 import {
   computeEnvFingerprint,
   computeWorkerPoolKey,
@@ -132,8 +135,10 @@ function bridgeProjectScopedCliCredentials(type: string, env: EnvLike) {
     const globalHome = join(userHomeFromEnv(env), ".gemini");
     const scopedConfigDir = join(scopedHome, ".gemini");
     for (const fileName of [
+      "gemini-credentials.json",
       "google_accounts.json",
       "google_account_id",
+      "oauth_creds.json",
       "mcp-oauth-tokens-v2.json",
       "settings.json",
     ]) {
@@ -156,6 +161,31 @@ function bridgeProjectScopedCliCredentials(type: string, env: EnvLike) {
     if (!scopedConfigDir) return;
     const globalHome = join(userHomeFromEnv(env), ".claude");
     bridgeDirectoryIfMissing(join(globalHome, "skills"), join(scopedConfigDir, "skills"));
+    return;
+  }
+
+  if (type === "opencode") {
+    const homeDir = userHomeFromEnv(env);
+    const scopedConfigDir = env.OPENCODE_CONFIG_DIR?.trim();
+    const scopedDataHome = env.XDG_DATA_HOME?.trim();
+    const scopedStateHome = env.XDG_STATE_HOME?.trim();
+    const scopedCacheHome = env.XDG_CACHE_HOME?.trim();
+
+    if (scopedConfigDir) {
+      bridgeDirectoryIfMissing(join(homeDir, ".config", "opencode"), scopedConfigDir);
+      mkdirSync(scopedConfigDir, { recursive: true });
+    }
+    if (scopedDataHome) {
+      const scopedDataDir = join(scopedDataHome, "opencode");
+      mkdirSync(scopedDataDir, { recursive: true });
+      bridgeCredentialFileIfMissing(join(homeDir, ".local", "share", "opencode", "auth.json"), join(scopedDataDir, "auth.json"));
+    }
+    if (scopedStateHome) {
+      mkdirSync(join(scopedStateHome, "opencode"), { recursive: true });
+    }
+    if (scopedCacheHome) {
+      mkdirSync(join(scopedCacheHome, "opencode"), { recursive: true });
+    }
   }
 }
 
@@ -200,7 +230,7 @@ function applyClaudeKeychainOAuthToken(env: EnvLike) {
   }
 }
 
-function applyProjectScopedCliStorage(type: string, cwd: string, env: EnvLike) {
+function applyProjectScopedCliStorage(type: string, cwd: string, env: EnvLike, options: { bridgeCredentials?: boolean } = {}) {
   const cliHome = join(cwd, ".omniharness", "cli-home");
   let shouldBridgeCredentials = false;
   if (type === "gemini" && !env.GEMINI_CLI_HOME?.trim()) {
@@ -223,20 +253,28 @@ function applyProjectScopedCliStorage(type: string, cwd: string, env: EnvLike) {
   }
   if (type === "opencode") {
     const opencodeHome = join(cliHome, "opencode");
+    let opencodeUsesScopedStorage = false;
     if (!env.OPENCODE_CONFIG_DIR?.trim()) {
       env.OPENCODE_CONFIG_DIR = join(opencodeHome, "config");
+      opencodeUsesScopedStorage = true;
     }
     if (!env.XDG_DATA_HOME?.trim()) {
       env.XDG_DATA_HOME = join(opencodeHome, "data");
+      opencodeUsesScopedStorage = true;
     }
     if (!env.XDG_STATE_HOME?.trim()) {
       env.XDG_STATE_HOME = join(opencodeHome, "state");
+      opencodeUsesScopedStorage = true;
     }
     if (!env.XDG_CACHE_HOME?.trim()) {
       env.XDG_CACHE_HOME = join(opencodeHome, "cache");
+      opencodeUsesScopedStorage = true;
+    }
+    if (opencodeUsesScopedStorage) {
+      shouldBridgeCredentials = true;
     }
   }
-  if (shouldBridgeCredentials) {
+  if (shouldBridgeCredentials && options.bridgeCredentials !== false) {
     bridgeProjectScopedCliCredentials(type, env);
   }
 }
@@ -1430,21 +1468,27 @@ export class AgentRuntimeManager {
       ...(configuredAgent?.env || {}),
       ...(input.env || {}),
     }, cwd);
-    applyProjectScopedCliStorage(type, cwd, finalEnv);
-    const credentialProfile = await resolveCredentialProfile({
-      type,
+    const accountCredentials = await resolveAccountCredentials({
+      workerType: type,
       cwd,
       env: finalEnv,
-      requestedProfile: input.credentialProfile,
-      configuredProfile: configuredAgent?.credentialProfile,
+      accountId: input.accountId,
+      requestedCredentialProfile: input.credentialProfile,
+      configuredCredentialProfile: configuredAgent?.credentialProfile,
     });
-    applyCredentialProfileEnv(finalEnv, credentialProfile);
+    if (accountCredentials.account?.authMode === "isolated_cli_home") {
+      Object.assign(finalEnv, accountCredentials.env);
+    }
+    applyProjectScopedCliStorage(type, cwd, finalEnv, {
+      bridgeCredentials: accountCredentials.allowGlobalCredentialBridge,
+    });
+    applyAccountCredentialEnv(finalEnv, accountCredentials);
 
     if (type === "codex") {
       Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
       Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
     }
-    if (type === "claude") {
+    if (type === "claude" && accountCredentials.allowGlobalCredentialBridge) {
       applyClaudeKeychainOAuthToken(finalEnv);
     }
 
@@ -1597,7 +1641,7 @@ export class AgentRuntimeManager {
       effectiveModel: requestedModel,
       requestedEffort,
       effectiveEffort: null,
-      credentialProfile: credentialProfile.status,
+      credentialProfile: accountCredentials.credentialProfile.status,
       sessionMode: requestedMode || null,
       contextUsage: null,
       lastText: "",
@@ -1869,6 +1913,8 @@ export class AgentRuntimeManager {
     model?: string | null;
     mode?: string | null;
     env?: Record<string, string>;
+    accountId?: string | null;
+    credentialProfile?: string | null;
     mcpServers?: acp.McpServer[];
   }): Promise<{ ok: true; key: string; size: number; warmed: boolean }> {
     this.applyRuntimeSettings(input.env ?? {}, { emit: false });
@@ -1888,21 +1934,27 @@ export class AgentRuntimeManager {
       ...(configuredAgent?.env || {}),
       ...(input.env || {}),
     }, cwd);
-    applyProjectScopedCliStorage(type, cwd, finalEnv);
-    const credentialProfile = await resolveCredentialProfile({
-      type,
+    const accountCredentials = await resolveAccountCredentials({
+      workerType: type,
       cwd,
       env: finalEnv,
-      requestedProfile: undefined,
-      configuredProfile: configuredAgent?.credentialProfile,
+      accountId: input.accountId,
+      requestedCredentialProfile: input.credentialProfile,
+      configuredCredentialProfile: configuredAgent?.credentialProfile,
+    });
+    if (accountCredentials.account?.authMode === "isolated_cli_home") {
+      Object.assign(finalEnv, accountCredentials.env);
+    }
+    applyProjectScopedCliStorage(type, cwd, finalEnv, {
+      bridgeCredentials: accountCredentials.allowGlobalCredentialBridge,
     });
-    applyCredentialProfileEnv(finalEnv, credentialProfile);
+    applyAccountCredentialEnv(finalEnv, accountCredentials);
 
     if (type === "codex") {
       Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
       Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
     }
-    if (type === "claude") {
+    if (type === "claude" && accountCredentials.allowGlobalCredentialBridge) {
       applyClaudeKeychainOAuthToken(finalEnv);
     }
 
diff --git a/src/server/conversations/queued-messages.ts b/src/server/conversations/queued-messages.ts
index c4ea4f6..8bcc16b 100644
--- a/src/server/conversations/queued-messages.ts
+++ b/src/server/conversations/queued-messages.ts
@@ -495,9 +495,9 @@ async function deliverQueuedWorkerSteering(args: {
   content: string;
   userText: string;
   attachments: ChatAttachment[];
+  onUserInputAppended?: () => void;
 }) {
   await runWorkerTurn(args.worker.id, async () => {
-    let userInputAppended = false;
     const appendQueuedUserInput = async (deliveredAt: Date) => {
       await appendUserInputOnDelivery({
         id: args.userMessageId ?? args.messageId,
@@ -512,7 +512,7 @@ async function deliverQueuedWorkerSteering(args: {
           sizeBytes: attachment.size,
         })),
       });
-      userInputAppended = true;
+      args.onUserInputAppended?.();
     };
 
     if (await queuedMessageStatus(args.messageId) !== "delivering") {
@@ -520,25 +520,12 @@ async function deliverQueuedWorkerSteering(args: {
       return;
     }
 
-    await appendQueuedUserInput(new Date());
-    notifyEventStreamSubscribers();
-
-    if (await queuedMessageStatus(args.messageId) !== "delivering") {
-      notifyEventStreamSubscribers();
-      return;
-    }
-
     const snapshotBeforeAsk = await Promise.resolve(getAgent(args.worker.id)).catch(() => null);
     const deliveredAt = new Date();
     if (await queuedMessageStatus(args.messageId) !== "delivering") {
       notifyEventStreamSubscribers();
       return;
     }
-    if (!userInputAppended) {
-      // Kept as a defensive fallback for future call paths that might
-      // choose not to pre-anchor the prompt before bridge output streams.
-      await appendQueuedUserInput(deliveredAt);
-    }
     if (await answerPendingWorkerElicitation({
       run: args.run,
       worker: args.worker,
@@ -546,6 +533,7 @@ async function deliverQueuedWorkerSteering(args: {
       content: args.userText,
       deliveredAt,
     })) {
+      await appendQueuedUserInput(deliveredAt);
       await db.update(queuedConversationMessages).set({
         status: "delivered",
         lastError: null,
@@ -562,6 +550,14 @@ async function deliverQueuedWorkerSteering(args: {
       return;
     }
 
+    await appendQueuedUserInput(deliveredAt);
+    notifyEventStreamSubscribers();
+
+    if (await queuedMessageStatus(args.messageId) !== "delivering") {
+      notifyEventStreamSubscribers();
+      return;
+    }
+
     const response = await askAgent(args.worker.id, workerPromptForRun(args.run, args.content));
     await persistDeliveredWorkerResponse({
       run: args.run,
@@ -596,8 +592,14 @@ async function continueQueuedWorkerSteering(args: {
   userText: string;
   attachments: ChatAttachment[];
 }) {
+  let userInputAppended = false;
   try {
-    await deliverQueuedWorkerSteering(args);
+    await deliverQueuedWorkerSteering({
+      ...args,
+      onUserInputAppended: () => {
+        userInputAppended = true;
+      },
+    });
     return;
   } catch (error) {
     if (isAgentNotFoundError(error)) {
@@ -611,6 +613,9 @@ async function continueQueuedWorkerSteering(args: {
           await deliverQueuedWorkerSteering({
             ...args,
             worker: fallbackWorker,
+            onUserInputAppended: () => {
+              userInputAppended = true;
+            },
           });
           return;
         } catch (fallbackError) {
@@ -641,7 +646,7 @@ async function continueQueuedWorkerSteering(args: {
         });
       }
     }
-    if (isAgentBusyError(error) && args.userMessageId) {
+    if (args.userMessageId && (isAgentBusyError(error) || !userInputAppended)) {
       await db.delete(messages).where(eq(messages.id, args.userMessageId));
     }
     await insertQueueExecutionEvent(args.run.id, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
@@ -1089,20 +1094,6 @@ export async function drainQueuedWorkerMessages({
         }).where(eq(workers.id, workerId));
         const snapshotBeforeAsk = snapshot ?? await Promise.resolve(getAgent(workerId)).catch(() => null);
         const deliveredAt = new Date();
-        await appendUserInputOnDelivery({
-          id: userMessage.id,
-          runId,
-          workerId,
-          text: record.content,
-          deliveredAt,
-          attachments: normalizedAttachments.map((attachment) => ({
-            id: attachment.id,
-            filename: attachment.name,
-            mimeType: attachment.mimeType,
-            sizeBytes: attachment.size,
-          })),
-        });
-        await db.insert(messages).values(userMessage);
         if (await answerPendingWorkerElicitation({
           run,
           worker,
@@ -1110,6 +1101,20 @@ export async function drainQueuedWorkerMessages({
           content: record.content,
           deliveredAt,
         })) {
+          await appendUserInputOnDelivery({
+            id: userMessage.id,
+            runId,
+            workerId,
+            text: record.content,
+            deliveredAt,
+            attachments: normalizedAttachments.map((attachment) => ({
+              id: attachment.id,
+              filename: attachment.name,
+              mimeType: attachment.mimeType,
+              sizeBytes: attachment.size,
+            })),
+          });
+          await db.insert(messages).values(userMessage);
           await db.update(queuedConversationMessages).set({
             status: "delivered",
             lastError: null,
@@ -1124,6 +1129,20 @@ export async function drainQueuedWorkerMessages({
           return;
         }
 
+        await appendUserInputOnDelivery({
+          id: userMessage.id,
+          runId,
+          workerId,
+          text: record.content,
+          deliveredAt,
+          attachments: normalizedAttachments.map((attachment) => ({
+            id: attachment.id,
+            filename: attachment.name,
+            mimeType: attachment.mimeType,
+            sizeBytes: attachment.size,
+          })),
+        });
+        await db.insert(messages).values(userMessage);
         const response = await askAgent(workerId, workerPromptForRun(run, workerContent));
         await persistDeliveredWorkerResponse({
           run,
diff --git a/src/server/conversations/send-message.ts b/src/server/conversations/send-message.ts
index 1269f30..ab93bf6 100644
--- a/src/server/conversations/send-message.ts
+++ b/src/server/conversations/send-message.ts
@@ -2,7 +2,7 @@ import { randomUUID } from "crypto";
 import { and, asc, eq } from "drizzle-orm";
 import { askAgent, cancelAgent, getAgent, respondElicitation, spawnAgent } from "@/server/bridge-client";
 import { db } from "@/server/db";
-import { clarifications, messages, runs, workers } from "@/server/db/schema";
+import { clarifications, messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
 import { recordExecutionEvent } from "@/server/events/execution-event-store";
 import { answerClarification } from "@/server/clarifications/store";
 import { resumeRunAfterClarification } from "@/server/clarifications/loop";
@@ -17,10 +17,11 @@ import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
 import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
 import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
 import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
-import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
+import { appendAttachmentContext, normalizeChatAttachments, parseChatAttachmentsJson, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
 import { getAppDataPath } from "@/server/app-root";
 import { normalizeWorkerType, SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "@/server/supervisor/worker-types";
 import { createQueuedConversationMessage, type BusyMessageAction } from "./queued-messages";
+import { interruptWithDraftMessage } from "./queued-message-interrupt";
 import { serializeMessageRecord } from "./message-records";
 import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
 import { runConversationMutation, runWorkerTurn, trackConversationBackgroundTask } from "./worker-turn-gate";
@@ -201,6 +202,46 @@ async function answerDirectWorkerElicitation(args: {
   return userMessage;
 }
 
+async function retireMatchingQueuedDirectAnswers(args: {
+  runId: string;
+  workerId: string;
+  content: string;
+  attachmentsJson: string | null;
+  answeredAt: Date;
+}) {
+  const expectedAttachmentsJson = serializeChatAttachments(parseChatAttachmentsJson(args.attachmentsJson));
+  const queuedRows = await db
+    .select()
+    .from(queuedConversationMessages)
+    .where(eq(queuedConversationMessages.runId, args.runId));
+  const matchingRows = queuedRows.filter((row) => (
+    (row.status === "pending" || row.status === "delivering")
+    && (row.targetWorkerId === args.workerId || row.targetWorkerId === null)
+    && row.content === args.content
+    && serializeChatAttachments(parseChatAttachmentsJson(row.attachmentsJson)) === expectedAttachmentsJson
+  ));
+
+  for (const row of matchingRows) {
+    await db.update(queuedConversationMessages).set({
+      status: "cancelled",
+      lastError: "Answered directly before queued delivery.",
+      updatedAt: args.answeredAt,
+    }).where(eq(queuedConversationMessages.id, row.id));
+    await recordExecutionEvent({
+      runId: args.runId,
+      workerId: row.targetWorkerId ?? args.workerId,
+      planItemId: null,
+      eventType: "queued_message_cancelled",
+      details: {
+        summary: "Cancelled queued duplicate after the answer was delivered directly.",
+        queuedMessageId: row.id,
+        reason: "direct_answer_delivered",
+      },
+      createdAt: args.answeredAt,
+    });
+  }
+}
+
 /**
  * Reconcile the DB user-message list against the worker output stream.
  *
@@ -292,6 +333,7 @@ export async function resumeMissingDirectWorker(run: RunRecord, worker: WorkerRe
     name: worker.id,
     ...(workerMode ? { mode: workerMode } : {}),
     env: envParams,
+    ...(run.preferredWorkerAccountId ? { accoun…6790 tokens truncated…llocation = await db.select()
+    .from(workerCredentialAllocations)
+    .where(eq(workerCredentialAllocations.workerId, workerId))
+    .get();
+  return allocation?.accountId ?? null;
+}
+
+function shouldBlockTypeForAccounts(usableAccountIds: Set<string>, blockedAccountIds: Set<string>, legacyBlocked: boolean) {
+  if (usableAccountIds.size === 0) return legacyBlocked;
+  if (blockedAccountIds.size === 0) return false;
+  for (const accountId of usableAccountIds) {
+    if (!blockedAccountIds.has(accountId)) return false;
+  }
+  return true;
+}
+
 function newestRecoveryIncident(incidents: RecoveryIncidentRecord[]) {
   return [...incidents].sort((a, b) => {
     const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
@@ -64,6 +98,9 @@ export async function isWorkerTypeQuotaBlocked(
   options: { now?: Date } = {},
 ): Promise<boolean> {
   const now = options.now ?? new Date();
+  const usableAccountIds = await usableAccountIdsForType(type);
+  const blockedAccountIds = new Set<string>();
+  let legacyBlocked = false;
 
   const exhaustedWorkers = await db.select()
     .from(workers)
@@ -81,21 +118,29 @@ export async function isWorkerTypeQuotaBlocked(
         inArray(recoveryIncidents.workerId, workerIds),
       ));
 
-    const anyStillActive = exhaustedWorkers.some((worker) => {
+    for (const worker of exhaustedWorkers) {
       const incidentForWorker = newestRecoveryIncident(
         recentIncidents.filter((incident) => incident.workerId === worker.id),
       );
-      if (!incidentForWorker) return true;
+      if (!incidentForWorker) {
+        legacyBlocked = true;
+        const accountId = await allocatedAccountIdForWorker(worker.id);
+        if (accountId) blockedAccountIds.add(accountId);
+        continue;
+      }
       const details = parseDetails(incidentForWorker.details);
       const resumeAt = readResumeAt(details);
-      return !isResumeAtPast(resumeAt, now);
-    });
-
-    if (anyStillActive) return true;
+      if (!isResumeAtPast(resumeAt, now)) {
+        legacyBlocked = true;
+        const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(worker.id);
+        if (accountId) blockedAccountIds.add(accountId);
+      }
+    }
   }
 
   const quotaIncidents = await db.select({
     incident: recoveryIncidents,
+    worker: workers,
   })
     .from(recoveryIncidents)
     .innerJoin(workers, eq(recoveryIncidents.workerId, workers.id))
@@ -109,11 +154,13 @@ export async function isWorkerTypeQuotaBlocked(
     const details = parseDetails(row.incident.details);
     const resumeAt = readResumeAt(details);
     if (!isResumeAtPast(resumeAt, now)) {
-      return true;
+      legacyBlocked = true;
+      const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(row.worker.id);
+      if (accountId) blockedAccountIds.add(accountId);
     }
   }
 
-  return false;
+  return shouldBlockTypeForAccounts(usableAccountIds, blockedAccountIds, legacyBlocked);
 }
 
 /**
@@ -155,6 +202,36 @@ export async function quotaBlockedTypes(
           inArray(recoveryIncidents.workerId, credWorkerIds),
         ))
     : [];
+  const accountAwareCandidates = new Map<SupportedWorkerType, {
+    usableAccountIds: Set<string>;
+    blockedAccountIds: Set<string>;
+    reason: string;
+    resumeAt: Date | null;
+  }>();
+
+  async function addBlockedCandidate(workerType: SupportedWorkerType, accountId: string | null, candidate: QuotaBlockReason) {
+    const usableAccountIds = await usableAccountIdsForType(workerType);
+    if (usableAccountIds.size === 0) {
+      const existing = result.get(workerType);
+      if (!existing || (candidate.resumeAt && (!existing.resumeAt || candidate.resumeAt < existing.resumeAt))) {
+        result.set(workerType, candidate);
+      }
+      return;
+    }
+
+    const current = accountAwareCandidates.get(workerType) ?? {
+      usableAccountIds,
+      blockedAccountIds: new Set<string>(),
+      reason: candidate.reason,
+      resumeAt: candidate.resumeAt,
+    };
+    if (accountId) current.blockedAccountIds.add(accountId);
+    if (candidate.resumeAt && (!current.resumeAt || candidate.resumeAt < current.resumeAt)) {
+      current.resumeAt = candidate.resumeAt;
+      current.reason = candidate.reason;
+    }
+    accountAwareCandidates.set(workerType, current);
+  }
 
   for (const worker of credExhaustedRows) {
     const incidentForWorker = newestRecoveryIncident(
@@ -165,15 +242,12 @@ export async function quotaBlockedTypes(
     if (isResumeAtPast(resumeAt, now)) {
       continue;
     }
+    const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(worker.id);
     const workerType = worker.type as SupportedWorkerType;
-    const existing = result.get(workerType);
-    const candidate: QuotaBlockReason = {
+    await addBlockedCandidate(workerType, accountId, {
       reason: "cred-exhausted",
       resumeAt,
-    };
-    if (!existing || (resumeAt && (!existing.resumeAt || resumeAt < existing.resumeAt))) {
-      result.set(workerType, candidate);
-    }
+    });
   }
 
   const incidentRows = await db.select({
@@ -192,12 +266,19 @@ export async function quotaBlockedTypes(
     const details = parseDetails(row.incident.details);
     const resumeAt = readResumeAt(details);
     if (isResumeAtPast(resumeAt, now)) continue;
+    const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(row.worker.id);
     const workerType = row.worker.type as SupportedWorkerType;
-    const existing = result.get(workerType);
-    if (!existing || (resumeAt && (!existing.resumeAt || resumeAt < existing.resumeAt))) {
+    await addBlockedCandidate(workerType, accountId, {
+      reason: "active quota incident",
+      resumeAt,
+    });
+  }
+
+  for (const [workerType, candidate] of accountAwareCandidates) {
+    if (shouldBlockTypeForAccounts(candidate.usableAccountIds, candidate.blockedAccountIds, true)) {
       result.set(workerType, {
-        reason: "active quota incident",
-        resumeAt,
+        reason: candidate.reason,
+        resumeAt: candidate.resumeAt,
       });
     }
   }
diff --git a/src/server/supervisor/index.ts b/src/server/supervisor/index.ts
index 6b21271..f1ec3c3 100644
--- a/src/server/supervisor/index.ts
+++ b/src/server/supervisor/index.ts
@@ -3,7 +3,7 @@ import { spawnSync } from "child_process";
 import fs from "fs";
 import path from "path";
 import { Agent } from "@mastra/core/agent";
-import { desc, eq } from "drizzle-orm";
+import { and, desc, eq, notInArray } from "drizzle-orm";
 import * as bridge from "@/server/bridge-client";
 import { db } from "@/server/db";
 import { clarifications, executionEvents, messages as dbMessages, runs, settings, supervisorInterventions, workers } from "@/server/db/schema";
@@ -41,6 +41,7 @@ import { notifyRunLifecycleEventBestEffort } from "@/server/notifications/trigge
 import { isProjectMemoryEnabled } from "@/server/projects/config";
 import { appendMemory, listMemory, readMemory, writeMemory } from "@/server/supervisor/memory-tools";
 import { consolidateProjectMemory } from "@/server/supervisor/memory-consolidation";
+import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
 
 export interface SupervisorOptions {
   runId: string;
@@ -232,6 +233,10 @@ function isInfraFailureReason(reason: string) {
   ].some((pattern) => normalized.includes(pattern));
 }
 
+function isWorkerBinaryMissingReason(reason: string) {
+  return /\bworker binary is not installed\b/i.test(reason);
+}
+
 function truncate(text: string, maxLength: number) {
   return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
 }
@@ -351,8 +356,10 @@ async function persistAwaitingUserQuestion(args: {
   eventDetails: Record<string, unknown>;
 }) {
   const now = new Date();
-  await db.transaction(async (tx) => {
-    await tx.insert(clarifications).values({
+  // Keep this as a libsql batch rather than an interactive transaction:
+  // interactive transactions orphan the PRAGMA-configured connection.
+  await db.batch([
+    db.insert(clarifications).values({
       id: randomUUID(),
       runId: args.runId,
       question: args.question,
@@ -360,8 +367,8 @@ async function persistAwaitingUserQuestion(args: {
       status: "pending",
       createdAt: now,
       updatedAt: now,
-    });
-    await tx.insert(dbMessages).values({
+    }),
+    db.insert(dbMessages).values({
       id: randomUUID(),
       runId: args.runId,
       role: "supervisor",
@@ -369,13 +376,13 @@ async function persistAwaitingUserQuestion(args: {
       content: args.question,
       workerId: null,
       createdAt: now,
-    });
-    await tx.update(runs).set({ status: "awaiting_user", updatedAt: now }).where(eq(runs.id, args.runId));
+    }),
+    db.update(runs).set({ status: "awaiting_user", updatedAt: now }).where(eq(runs.id, args.runId)),
     // Legacy-format insert: this runs inside a SQLite transaction so we
     // can't safely interleave the artifact-stream append. Readers
     // tolerate `artifact_seq IS NULL` by falling back to the legacy
     // `details` column (see execution-event-store.ts).
-    await tx.insert(executionEvents).values({
+    db.insert(executionEvents).values({
       id: randomUUID(),
       runId: args.runId,
       workerId: null,
@@ -383,8 +390,8 @@ async function persistAwaitingUserQuestion(args: {
       eventType: args.eventType,
       details: JSON.stringify(args.eventDetails),
       createdAt: now,
-    });
-  });
+    }),
+  ]);
   await notifyRunLifecycleEventBestEffort({
     runId: args.runId,
     eventType: args.eventType,
@@ -869,6 +876,7 @@ async function resumeWorkerFromSavedSessionForSupervisor(runId: string, workerId
     name: worker.id,
     ...(mode ? { mode } : {}),
     env: envParams,
+    ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
     ...(run.preferredWorkerModel ? { model: run.preferredWorkerModel } : {}),
     ...(run.preferredWorkerEffort ? { effort: run.preferredWorkerEffort } : {}),
   };
@@ -1097,7 +1105,11 @@ export class Supervisor {
       failedAt: null,
       lastError: null,
       updatedAt: new Date(),
-    }).where(eq(runs.id, this.runId));
+    }).where(and(
+      eq(runs.id, this.runId),
+      eq(runs.mode, "implementation"),
+      notInArray(runs.status, ["awaiting_user", "done", "failed", "cancelled", "canceled", "promoting", "promoted"]),
+    ));
 
     // Observer-driven failover: if an incident is flagged
     // failover_pending we owe a failover attempt before doing anything
@@ -1231,8 +1243,11 @@ export class Supervisor {
           const requestedType = asString(action.args.type, "type");
           const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
           const allowedWorkerTypes = parseAllowedWorkerTypes(run?.allowedWorkerTypes);
-          const workerType = selectSpawnableWorkerType(requestedType, envParams, allowedWorkerTypes);
           const cwd = resolveSupervisorWorkerCwd(asString(action.args.cwd, "cwd"), run?.projectPath);
+          const workerType = selectSpawnableWorkerType(requestedType, envParams, allowedWorkerTypes, {
+            cwd,
+            loginShellPathMode: "blocking",
+          });
           const title = asString(action.args.title, "title");
           const prompt = asString(action.args.prompt, "prompt");
           const mode = resolveWorkerSpawnMode(action.args.mode, yoloModeEnabled);
@@ -1291,6 +1306,14 @@ export class Supervisor {
           });
           const preferredModel = run?.preferredWorkerModel ?? null;
           const preferredEffort = run?.preferredWorkerEffort ?? null;
+          const accountAllocation = await allocateWorkerAccount({
+            workerType: workerType.type,
+            runId: this.runId,
+            workerId,
+            explicitAccountId: run?.preferredWorkerAccountId ?? null,
+            strategy: run?.preferredWorkerAccountId ? "manual" : "priority",
+          });
+          const workerAccountId = accountAllocation.account?.id ?? null;
 
           let spawnedWorker: bridge.AgentRecord;
           try {
@@ -1300,6 +1323,7 @@ export class Supervisor {
               name: workerId,
               ...(mode ? { mode } : {}),
               env: envParams,
+              ...(workerAccountId ? { accountId: workerAccountId } : {}),
               ...(preferredModel ? { model: preferredModel } : {}),
               ...(preferredEffort ? { effort: preferredEffort } : {}),
               ...(skillRoots?.length ? { skillRoots } : {}),
@@ -1955,6 +1979,27 @@ export class Supervisor {
 
         case "mark_failed": {
           const reason = asString(action.args.reason, "reason");
+          if (isWorkerBinaryMissingReason(reason)) {
+            const run = await db.select().from(runs).where(eq(runs.id, this.runId)).get();
+            const allowedWorkerTypes = parseAllowedWorkerTypes(run?.allowedWorkerTypes);
+            const requestedType = run?.preferredWorkerType ?? allowedWorkerTypes[0] ?? "codex";
+            try {
+              selectSpawnableWorkerType(requestedType, envParams, allowedWorkerTypes, {
+                cwd: run?.projectPath ?? undefined,
+                loginShellPathMode: "blocking",
+              });
+              await insertExecutionEvent(this.runId, "supervisor_turn_stopped", {
+                summary: "Rejected stale supervisor failure because the requested worker binary is currently spawnable.",
+                actionName: action.name,
+                evidenceKey: "mark_failed:worker_binary_missing",
+                rejectedReason: reason,
+                requestedType,
+              });
+              return { state: "wait", delayMs: 1_000 };
+            } catch {
+              // The binary is still genuinely unavailable; proceed with the failure.
+            }
+          }
           await cancelRunWorkers(this.runId);
           const failHalt = await this.haltResultIfRunCannotContinue();
           if (failHalt) {
@@ -1975,7 +2020,6 @@ export class Supervisor {
               });
             }
           }
-          await insertExecutionEvent(this.runId, "run_failed", { reason });
           await persistRunFailure(this.runId, reason, {
             surface: { code: "supervisor.gave_up" },
           });
diff --git a/src/server/supervisor/wake.ts b/src/server/supervisor/wake.ts
index e71f5f8..61c0003 100644
--- a/src/server/supervisor/wake.ts
+++ b/src/server/supervisor/wake.ts
@@ -1,7 +1,7 @@
 import { recordExecutionEvent } from "@/server/events/execution-event-store";
-import { desc, eq, inArray } from "drizzle-orm";
+import { and, desc, eq, inArray } from "drizzle-orm";
 import { db } from "@/server/db";
-import { executionEvents, runs, workers } from "@/server/db/schema";
+import { clarifications, executionEvents, runs, workers } from "@/server/db/schema";
 import { persistRunFailure } from "@/server/runs/failures";
 import { emitNamedEvent } from "@/server/events/named-events";
 import { isActiveImplementationRun, isRunnableImplementationRun } from "@/server/runs/status";
@@ -23,8 +23,19 @@ const wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
 const wakeDeadlines = new Map<string, number>();
 const inFlight = new Set<string>();
 const LEASE_BLOCKED_RETRY_MS = 1_000;
+const TRANSIENT_SUPERVISOR_RETRY_MS = 5_000;
+const PRE_WORKER_LEASE_ORPHAN_GRACE_MS = 90_000;
 const COMPLETION_EVENT_TYPES = new Set(["worker_turn_completed"]);
 const COMPLETION_RESET_EVENT_TYPES = new Set(["worker_prompted", "worker_spawned", "worker_session_resumed", "worker_session_recreated"]);
+const PRE_WORKER_RECOVERY_EVENT_TYPES = new Set([
+  "clarification_resolved",
+  "supervisor_model_request_started",
+  "supervisor_wake_retry_scheduled",
+  "supervisor_wake_lease_recovered",
+  "supervisor_turn_step_limit_reached",
+  "supervisor_turn_stopped",
+  "worker_selection_changed",
+]);
 const ACTIVE_WORKER_STATUS_PATTERN = /\b(working|stuck|starting|pending|busy|running)\b/i;
 
 function scheduleDurableWakeBackup(runId: string, nextDeadline: number, delayMs: number) {
@@ -98,6 +109,81 @@ async function recoverCompletionBlockedByOrphanedLease(runId: string) {
   return true;
 }
 
+async function recoverPreWorkerBlockedByOrphanedLease(runId: string) {
+  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
+  if (!run || run.mode !== "implementation" || run.status !== "running") {
+    return false;
+  }
+
+  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
+  if (runWorkers.length > 0) {
+    return false;
+  }
+
+  const pendingClarification = await db.select().from(clarifications).where(and(
+    eq(clarifications.runId, runId),
+    eq(clarifications.status, "pending"),
+  )).limit(1).get();
+  if (pendingClarification) {
+    return false;
+  }
+
+  const latestEvent = await db.select().from(executionEvents)
+    .where(eq(executionEvents.runId, runId))
+    .orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))
+    .limit(1)
+    .get();
+  if (!latestEvent || !PRE_WORKER_RECOVERY_EVENT_TYPES.has(latestEvent.eventType)) {
+    if (latestEvent?.eventType === "run_failed") {
+      let error = "Supervisor wake failed before the first worker was attached.";
+      try {
+        const details = JSON.parse(latestEvent.details || "{}") as { error?: unknown; summary?: unknown };
+        const parsed = typeof details.error === "string"
+          ? details.error
+          : typeof details.summary === "string"
+            ? details.summary
+            : "";
+        if (parsed) {
+          error = parsed;
+        }
+      } catch {
+        // Keep the generic failure text when legacy event details are malformed.
+      }
+      await clearSupervisorWakeLease(runId);
+      await persistRunFailure(runId, new Error(error), {
+        surface: { code: "supervisor.wake.failed" },
+      });
+      emitNamedEvent({
+        kind: "supervisor.wake_lease_recovered",
+        runId,
+        reason: "orphaned_pre_worker",
+      });
+      return true;
+    }
+    return false;
+  }
+  if (Date.now() - latestEvent.createdAt.getTime() < PRE_WORKER_LEASE_ORPHAN_GRACE_MS) {
+    return false;
+  }
+
+  await clearSupervisorWakeLease(runId);
+  emitNamedEvent({
+    kind: "supervisor.wake_lease_recovered",
+    runId,
+    reason: "orphaned_pre_worker",
+  });
+  await recordExecutionEvent({
+    runId,
+    eventType: "supervisor_wake_lease_recovered",
+    details: {
+      summary: "Cleared an orphaned supervisor wake lease before the first worker was attached.",
+      latestEventType: latestEvent.eventType,
+      latestEventId: latestEvent.id,
+    },
+  });
+  return true;
+}
+
 export async function executeSupervisorWake(runId: string) {
   clearWake(runId);
   if (inFlight.has(runId)) {
@@ -107,7 +193,10 @@ export async function executeSupervisorWake(runId: string) {
 
   const leaseId = await acquireSupervisorWakeLease(runId);
   if (!leaseId) {
-    if (await recoverCompletionBlockedByOrphanedLease(runId)) {
+    if (
+      await recoverCompletionBlockedByOrphanedLease(runId)
+      || await recoverPreWorkerBlockedByOrphanedLease(runId)
+    ) {
       scheduleSupervisorWake(runId, 0);
       return;
     }
@@ -195,7 +284,16 @@ export async function executeSupervisorWake(runId: string) {
     }
   } catch (error) {
     if (isTransientSupervisorError(error)) {
-      scheduleSupervisorWake(runId, 5_000);
+      await recordExecutionEvent({
+        runId,
+        eventType: "supervisor_wake_retry_scheduled",
+        details: {
+          summary: "Supervisor wake hit a transient error; retrying shortly.",
+          delayMs: TRANSIENT_SUPERVISOR_RETRY_MS,
+          error: error instanceof Error ? error.message : String(error),
+        },
+      });
+      scheduleSupervisorWake(runId, TRANSIENT_SUPERVISOR_RETRY_MS);
       return;
     }
     stopRunObserver(runId);

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:57:53.978Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:57:53.978Z

```json
{
  "cmd": "sed -n '1,260p' src/server/accounts/account-allocator.ts && printf '\\n--- resolver ---\\n' && sed -n '1,320p' src/server/accounts/account-resolver.ts && printf '\\n--- db retry ---\\n' && sed -n '1,260p' src/server/db/retry.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:57:54.029Z","phase":null} -->
## Tool result: call_McKr38hbeTWqTC0F7DCLwSUS · 2026-06-29T13:57:54.029Z

```text
Chunk ID: 89dc9c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3709
Output:
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountUsageSnapshots,
  accounts,
  recoveryIncidents,
  workerCredentialAllocations,
} from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { RuntimeHttpError } from "@/server/agent-runtime/types";

type AccountRow = typeof accounts.$inferSelect;
type AccountUsageSnapshotRow = typeof accountUsageSnapshots.$inferSelect;
const OPEN_QUOTA_INCIDENT_STATUSES = ["open", "waiting", "quota_waiting", "recovering", "needs_user"] as const;

export type AccountAllocationStrategy =
  | "manual"
  | "priority"
  | "round_robin"
  | "quota_balanced"
  | "subscription_then_api"
  | "wait_for_reset";

export type AccountAllocationInput = {
  workerType: string;
  runId?: string | null;
  workerId?: string | null;
  explicitAccountId?: string | null;
  strategy?: AccountAllocationStrategy | null;
  now?: Date;
};

export type AccountAllocation = {
  account: AccountRow | null;
  strategy: AccountAllocationStrategy;
  explicit: boolean;
  reason: string;
};

function normalizeWorkerType(value: string) {
  return value.trim().toLowerCase();
}

function normalizeStrategy(value: AccountAllocationStrategy | null | undefined): AccountAllocationStrategy {
  return value || "priority";
}

function isUsable(account: AccountRow) {
  if (!account.enabled) return false;
  const status = account.status?.trim().toLowerCase();
  return status !== "quota_exhausted" && status !== "login_required" && status !== "disabled";
}

function parseIncidentDetails(details: string | null): Record<string, unknown> {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function incidentResumeAt(details: Record<string, unknown>) {
  const value = details.resumeAt;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

async function quotaBlockedAccountIds(now: Date) {
  const rows = await db.select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.kind, "quota_exhausted"),
      inArray(recoveryIncidents.status, [...OPEN_QUOTA_INCIDENT_STATUSES]),
    ));
  const result = new Set<string>();
  for (const row of rows) {
    const details = parseIncidentDetails(row.details);
    const accountId = typeof details.accountId === "string" ? details.accountId.trim() : "";
    const resumeAt = incidentResumeAt(details);
    if (accountId && (!resumeAt || resumeAt.getTime() > now.getTime())) {
      result.add(accountId);
    }
  }
  return result;
}

function accountMatchesWorkerType(account: AccountRow, workerType: string) {
  return !account.cliType || normalizeWorkerType(account.cliType) === normalizeWorkerType(workerType);
}

function sortByPriority(a: AccountRow, b: AccountRow) {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function latestUsableCapacity(snapshot: AccountUsageSnapshotRow | undefined) {
  if (!snapshot) return Number.NEGATIVE_INFINITY;
  return snapshot.remainingTokens ?? Math.max(0, snapshot.usedTokens * -1);
}

async function listCandidateAccounts(workerType: string) {
  const rows = await db.select().from(accounts);
  return rows.filter((account) => accountMatchesWorkerType(account, workerType));
}

async function countAllocationsByAccount(workerType: string) {
  const rows = await db
    .select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerType, workerType));
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1);
  }
  return counts;
}

async function latestSnapshotsByAccount(workerType: string) {
  const rows = await db
    .select()
    .from(accountUsageSnapshots)
    .where(eq(accountUsageSnapshots.workerType, workerType));
  const latest = new Map<string, AccountUsageSnapshotRow>();
  for (const row of rows) {
    const current = latest.get(row.accountId);
    if (!current || row.updatedAt.getTime() > current.updatedAt.getTime()) {
      latest.set(row.accountId, row);
    }
  }
  return latest;
}

async function persistAllocation(input: AccountAllocationInput, allocation: AccountAllocation) {
  if (!allocation.account || !input.runId || !input.workerId) return;
  const now = input.now ?? new Date();
  await db.insert(workerCredentialAllocations).values({
    id: randomUUID(),
    runId: input.runId,
    workerId: input.workerId,
    workerType: normalizeWorkerType(input.workerType),
    accountId: allocation.account.id,
    strategy: allocation.strategy,
    selectionReason: allocation.reason,
    explicit: allocation.explicit,
    createdAt: now,
    updatedAt: now,
  });
}

function emitSelection(input: AccountAllocationInput, allocation: AccountAllocation) {
  if (!allocation.account) return;
  emitNamedEvent({
    kind: "account.credential_selected",
    accountId: allocation.account.id,
    runId: input.runId ?? undefined,
    workerId: input.workerId ?? undefined,
    workerType: normalizeWorkerType(input.workerType),
    strategy: allocation.strategy,
    explicit: allocation.explicit,
    reason: allocation.reason,
  });
}

async function chooseAutomaticAccount(
  workerType: string,
  strategy: AccountAllocationStrategy,
  candidates: AccountRow[],
): Promise<{ account: AccountRow | null; reason: string }> {
  const usable = candidates.filter(isUsable);
  if (usable.length === 0) return { account: null, reason: "no usable account inventory row" };

  if (strategy === "subscription_then_api") {
    const subscription = usable.filter((account) => account.type === "subscription").sort(sortByPriority)[0];
    if (subscription) return { account: subscription, reason: "selected highest-priority subscription account" };
    const api = usable.filter((account) => account.type === "api").sort(sortByPriority)[0];
    return { account: api ?? null, reason: api ? "selected API account after subscription options were unavailable" : "no subscription or API account was usable" };
  }

  if (strategy === "round_robin") {
    const counts = await countAllocationsByAccount(normalizeWorkerType(workerType));
    const account = [...usable].sort((a, b) => {
      const byCount = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
      return byCount || sortByPriority(a, b);
    })[0];
    return { account, reason: "selected least-used enabled account" };
  }

  if (strategy === "quota_balanced") {
    const snapshots = await latestSnapshotsByAccount(normalizeWorkerType(workerType));
    const account = [...usable].sort((a, b) => {
      const byRemaining = latestUsableCapacity(snapshots.get(b.id)) - latestUsableCapacity(snapshots.get(a.id));
      return byRemaining || sortByPriority(a, b);
    })[0];
    return { account, reason: "selected account with most remaining quota" };
  }

  const account = [...usable].sort(sortByPriority)[0];
  return { account, reason: strategy === "wait_for_reset" ? "selected priority account for wait policy" : "selected highest-priority enabled account" };
}

export async function allocateWorkerAccount(input: AccountAllocationInput): Promise<AccountAllocation> {
  const workerType = normalizeWorkerType(input.workerType);
  const strategy = normalizeStrategy(input.strategy);
  const candidates = await listCandidateAccounts(workerType);

  if (input.explicitAccountId?.trim()) {
    const account = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, input.explicitAccountId.trim())))
      .get();
    if (!account) {
      throw new RuntimeHttpError(400, `Account "${input.explicitAccountId}" was not found.`);
    }
    if (!accountMatchesWorkerType(account, workerType)) {
      throw new RuntimeHttpError(400, `Account "${account.id}" cannot be used for ${workerType} workers.`);
    }
    if (!isUsable(account)) {
      throw new RuntimeHttpError(400, `Account "${account.id}" is not currently usable.`);
    }
    const blockedAccountIds = await quotaBlockedAccountIds(input.now ?? new Date());
    if (blockedAccountIds.has(account.id)) {
      throw new RuntimeHttpError(400, `Account "${account.id}" is quota blocked.`);
    }
    const allocation = {
      account,
      strategy: "manual" as const,
      explicit: true,
      reason: "explicit run account preference",
    };
    await persistAllocation(input, allocation);
    emitSelection(input, allocation);
    return allocation;
  }

  if (candidates.length === 0) {
    return {
      account: null,
      strategy,
      explicit: false,
      reason: "no account inventory exists for worker type",
    };
  }

  const blockedAccountIds = await quotaBlockedAccountIds(input.now ?? new Date());
  const { account, reason } = await chooseAutomaticAccount(
    workerType,
    strategy,
    candidates.filter((account) => !blockedAccountIds.has(account.id)),
  );
  if (!account) {
    throw new RuntimeHttpError(400, `No usable ${workerType} account is available.`);
  }


--- resolver ---
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import {
  applyCredentialProfileEnv,
  resolveCredentialProfile,
  type CredentialProfileResolution,
} from "@/server/agent-runtime/external-credentials";
import { RuntimeHttpError } from "@/server/agent-runtime/types";

type EnvLike = Record<string, string | undefined>;
type AccountRow = typeof accounts.$inferSelect;

export type ResolvedAccountCredentials = {
  account: AccountRow | null;
  env: Record<string, string>;
  unset: string[];
  credentialProfile: CredentialProfileResolution;
  allowGlobalCredentialBridge: boolean;
};

function accountHome(account: AccountRow) {
  const cliType = account.cliType?.trim() || "unknown";
  return getAppDataPath("account-cli-homes", cliType, account.id);
}

function isolatedHomeEnv(account: AccountRow): Record<string, string> {
  const root = accountHome(account);
  switch (account.cliType) {
    case "codex":
      return {
        CODEX_HOME: join(root, "home"),
        CODEX_SQLITE_HOME: join(root, "sqlite"),
      };
    case "claude":
      return { CLAUDE_CONFIG_DIR: join(root, "config") };
    case "gemini":
      return { GEMINI_CLI_HOME: join(root, "home") };
    case "opencode":
      return {
        OPENCODE_CONFIG_DIR: join(root, "config"),
        XDG_DATA_HOME: join(root, "data"),
        XDG_STATE_HOME: join(root, "state"),
        XDG_CACHE_HOME: join(root, "cache"),
      };
    default:
      return {};
  }
}

function profileNameFromAuthRef(authRef: string) {
  const trimmed = authRef.trim();
  if (trimmed.startsWith("profile:")) return trimmed.slice("profile:".length);
  return trimmed;
}

function emptyCredentialProfile(): CredentialProfileResolution {
  return { env: {}, unset: [], status: null };
}

export async function resolveAccountCredentials(input: {
  workerType: string;
  cwd: string;
  env: EnvLike;
  accountId?: string | null;
  account?: AccountRow | null;
  configuredCredentialProfile?: string | null;
  requestedCredentialProfile?: string | null;
}): Promise<ResolvedAccountCredentials> {
  const account = input.account ?? (
    input.accountId
      ? await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get()
      : null
  );

  if (!account) {
    const credentialProfile = await resolveCredentialProfile({
      type: input.workerType,
      cwd: input.cwd,
      env: input.env,
      requestedProfile: input.requestedCredentialProfile,
      configuredProfile: input.configuredCredentialProfile,
    });
    return {
      account: null,
      env: credentialProfile.env,
      unset: credentialProfile.unset,
      credentialProfile,
      allowGlobalCredentialBridge: true,
    };
  }

  if (account.cliType && account.cliType !== input.workerType) {
    throw new RuntimeHttpError(400, `Account "${account.id}" cannot be used for ${input.workerType} workers.`);
  }

  if (!account.enabled) {
    throw new RuntimeHttpError(400, `Account "${account.id}" is disabled.`);
  }

  if (account.authMode === "isolated_cli_home") {
    const env = isolatedHomeEnv(account);
    return {
      account,
      env,
      unset: [],
      credentialProfile: emptyCredentialProfile(),
      allowGlobalCredentialBridge: false,
    };
  }

  if (account.authMode === "credential_profile") {
    const credentialProfile = await resolveCredentialProfile({
      type: input.workerType,
      cwd: input.cwd,
      env: input.env,
      requestedProfile: profileNameFromAuthRef(account.authRef),
      configuredProfile: null,
    });
    return {
      account,
      env: credentialProfile.env,
      unset: credentialProfile.unset,
      credentialProfile,
      allowGlobalCredentialBridge: false,
    };
  }

  if (account.authMode === "local_session" || account.authMode === "legacy_ref") {
    const credentialProfile = emptyCredentialProfile();
    return {
      account,
      env: credentialProfile.env,
      unset: credentialProfile.unset,
      credentialProfile,
      allowGlobalCredentialBridge: true,
    };
  }

  throw new RuntimeHttpError(400, `Account auth mode "${account.authMode}" is not supported yet.`);
}

export function applyAccountCredentialEnv<T extends EnvLike>(env: T, resolved: ResolvedAccountCredentials): T {
  for (const key of resolved.unset) {
    delete env[key];
  }
  Object.assign(env, resolved.env);
  applyCredentialProfileEnv(env, resolved.credentialProfile);
  return env;
}

--- db retry ---
type SqliteBusyRetryOptions = {
  attempts?: number;
  delayMs?: number;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function isSqliteBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(SQLITE_BUSY|database is locked)\b/i.test(message);
}

export async function withSqliteBusyRetry<T>(
  operation: () => Promise<T> | T,
  options: SqliteBusyRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 6);
  const baseDelayMs = Math.max(0, options.delayMs ?? 50);

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === attempts - 1) {
        throw error;
      }
      await delay(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:57:57.518Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:57:57.518Z

```json
{
  "cmd": "sed -n '260,520p' src/server/accounts/account-allocator.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:57:57.590Z","phase":null} -->
## Tool result: call_P48UlhqIoW1L26yanf1QFlJ3 · 2026-06-29T13:57:57.590Z

```text
Chunk ID: 4efc1b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 49
Output:

  const allocation = {
    account,
    strategy,
    explicit: false,
    reason,
  };
  await persistAllocation(input, allocation);
  emitSelection(input, allocation);
  return allocation;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:58:01.429Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:58:01.429Z

```json
{
  "cmd": "git diff -- src/server/db/index.ts src/server/db/schema.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:58:01.490Z","phase":null} -->
## Tool result: call_cBQwlj3uMpd5DvOJ3CC51GoN · 2026-06-29T13:58:01.490Z

```text
Chunk ID: 36c6a5
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3019
Output:
diff --git a/src/server/db/index.ts b/src/server/db/index.ts
index aff8fa6..b181c1c 100644
--- a/src/server/db/index.ts
+++ b/src/server/db/index.ts
@@ -4,7 +4,7 @@ import * as schema from './schema';
 import { getAppDataPath } from '@/server/app-root';
 
 const dbPath = getAppDataPath('sqlite.db');
-const DB_SCHEMA_VERSION = 3;
+const DB_SCHEMA_VERSION = 4;
 type DbClient = ReturnType<typeof createClient>;
 
 async function tableColumns(client: DbClient, table: string): Promise<Set<string>> {
@@ -41,10 +41,11 @@ CREATE TABLE IF NOT EXISTS runs (
   phase text,
   project_path text,
   title text,
-  preferred_worker_type text,
-  preferred_worker_model text,
-  preferred_worker_effort text,
-  allowed_worker_types text,
+	  preferred_worker_type text,
+	  preferred_worker_model text,
+	  preferred_worker_effort text,
+	  preferred_worker_account_id text,
+	  allowed_worker_types text,
   spec_path text,
   artifact_plan_path text,
   planner_artifacts_json text,
@@ -192,12 +193,82 @@ CREATE TABLE IF NOT EXISTS supervisor_scheduled_wakes (
 
 CREATE TABLE IF NOT EXISTS accounts (
   id text PRIMARY KEY NOT NULL,
+  cli_type text,
   provider text NOT NULL,
   type text NOT NULL,
+  label text,
+  auth_mode text NOT NULL DEFAULT 'legacy_ref',
   auth_ref text NOT NULL,
+  enabled integer NOT NULL DEFAULT 1,
+  priority integer NOT NULL DEFAULT 0,
   capacity integer,
   reset_schedule text,
-  created_at integer NOT NULL
+  status text,
+  status_checked_at integer,
+  metadata_json text,
+  created_at integer NOT NULL,
+  updated_at integer
+);
+
+CREATE TABLE IF NOT EXISTS account_secrets (
+  id text PRIMARY KEY NOT NULL,
+  account_id text NOT NULL,
+  secret_kind text NOT NULL,
+  secret_ref text,
+  encrypted_value text NOT NULL,
+  created_at integer NOT NULL,
+  updated_at integer NOT NULL,
+  FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE no action
+);
+
+CREATE TABLE IF NOT EXISTS worker_credential_allocations (
+  id text PRIMARY KEY NOT NULL,
+  run_id text NOT NULL,
+  worker_id text NOT NULL,
+  worker_type text NOT NULL,
+  account_id text NOT NULL,
+  strategy text NOT NULL,
+  selection_reason text,
+  explicit integer NOT NULL DEFAULT 0,
+  created_at integer NOT NULL,
+  updated_at integer NOT NULL,
+  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
+  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action,
+  FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE no action
+);
+
+CREATE TABLE IF NOT EXISTS worker_token_usage (
+  id text PRIMARY KEY NOT NULL,
+  run_id text NOT NULL,
+  worker_id text,
+  worker_type text NOT NULL,
+  account_id text NOT NULL,
+  model text,
+  input_tokens integer NOT NULL DEFAULT 0,
+  output_tokens integer NOT NULL DEFAULT 0,
+  cache_read_tokens integer NOT NULL DEFAULT 0,
+  cache_write_tokens integer NOT NULL DEFAULT 0,
+  cost_usd real NOT NULL DEFAULT 0,
+  occurred_at integer NOT NULL,
+  created_at integer NOT NULL,
+  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
+  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action,
+  FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE no action
+);
+
+CREATE TABLE IF NOT EXISTS account_usage_snapshots (
+  id text PRIMARY KEY NOT NULL,
+  account_id text NOT NULL,
+  worker_type text NOT NULL,
+  window_key text NOT NULL,
+  used_tokens integer NOT NULL DEFAULT 0,
+  remaining_tokens integer,
+  cost_usd real NOT NULL DEFAULT 0,
+  reset_at integer,
+  source text NOT NULL,
+  created_at integer NOT NULL,
+  updated_at integer NOT NULL,
+  FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE no action
 );
 
 CREATE TABLE IF NOT EXISTS credit_events (
@@ -445,6 +516,10 @@ if (!runColumnNames.has("preferred_worker_effort")) {
   await client.execute("ALTER TABLE runs ADD COLUMN preferred_worker_effort text;");
 }
 
+if (!runColumnNames.has("preferred_worker_account_id")) {
+  await client.execute("ALTER TABLE runs ADD COLUMN preferred_worker_account_id text;");
+}
+
 if (!runColumnNames.has("allowed_worker_types")) {
   await client.execute("ALTER TABLE runs ADD COLUMN allowed_worker_types text;");
 }
@@ -636,6 +711,44 @@ if (!messageColumnNames.has("attachments_json")) {
   await client.execute("ALTER TABLE messages ADD COLUMN attachments_json text;");
 }
 
+const accountColumnNames = await tableColumns(client, "accounts");
+
+if (!accountColumnNames.has("cli_type")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN cli_type text;");
+}
+
+if (!accountColumnNames.has("label")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN label text;");
+}
+
+if (!accountColumnNames.has("auth_mode")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN auth_mode text NOT NULL DEFAULT 'legacy_ref';");
+}
+
+if (!accountColumnNames.has("enabled")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN enabled integer NOT NULL DEFAULT 1;");
+}
+
+if (!accountColumnNames.has("priority")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN priority integer NOT NULL DEFAULT 0;");
+}
+
+if (!accountColumnNames.has("status")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN status text;");
+}
+
+if (!accountColumnNames.has("status_checked_at")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN status_checked_at integer;");
+}
+
+if (!accountColumnNames.has("metadata_json")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN metadata_json text;");
+}
+
+if (!accountColumnNames.has("updated_at")) {
+  await client.execute("ALTER TABLE accounts ADD COLUMN updated_at integer;");
+}
+
 // ── v1 → v2: append-only artifact storage ──────────────────────────
 // Add the new metadata columns on each domain table that gains an
 // artifact stream. ALTER ADD COLUMN is safe with default NULL.
@@ -709,6 +822,14 @@ CREATE INDEX IF NOT EXISTS queued_conversation_messages_pending_run_created_id_d
 CREATE INDEX IF NOT EXISTS recovery_incidents_run_status_updated_idx ON recovery_incidents(run_id, status, updated_at);
 CREATE INDEX IF NOT EXISTS recovery_incidents_run_updated_id_desc_idx ON recovery_incidents(run_id, updated_at DESC, id DESC);
 CREATE INDEX IF NOT EXISTS supervisor_scheduled_wakes_wake_at_idx ON supervisor_scheduled_wakes(wake_at);
+CREATE INDEX IF NOT EXISTS accounts_cli_type_enabled_priority_idx ON accounts(cli_type, enabled, priority);
+CREATE INDEX IF NOT EXISTS account_secrets_account_idx ON account_secrets(account_id);
+CREATE INDEX IF NOT EXISTS worker_credential_allocations_worker_idx ON worker_credential_allocations(worker_id);
+CREATE INDEX IF NOT EXISTS worker_credential_allocations_run_idx ON worker_credential_allocations(run_id);
+CREATE INDEX IF NOT EXISTS worker_credential_allocations_account_idx ON worker_credential_allocations(account_id);
+CREATE INDEX IF NOT EXISTS worker_token_usage_account_occurred_idx ON worker_token_usage(account_id, occurred_at);
+CREATE INDEX IF NOT EXISTS worker_token_usage_worker_idx ON worker_token_usage(worker_id);
+CREATE INDEX IF NOT EXISTS account_usage_snapshots_account_window_idx ON account_usage_snapshots(account_id, window_key);
 CREATE INDEX IF NOT EXISTS runs_created_idx ON runs(created_at);
 CREATE INDEX IF NOT EXISTS runs_archived_created_id_desc_idx ON runs(archived_at, created_at DESC, id DESC);
 CREATE INDEX IF NOT EXISTS plans_created_idx ON plans(created_at);
diff --git a/src/server/db/schema.ts b/src/server/db/schema.ts
index f00b023..d5f954c 100644
--- a/src/server/db/schema.ts
+++ b/src/server/db/schema.ts
@@ -1,4 +1,4 @@
-import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
+import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
 
 export const plans = sqliteTable('plans', {
   id: text('id').primaryKey(),
@@ -22,6 +22,7 @@ export const runs = sqliteTable('runs', {
   preferredWorkerType: text('preferred_worker_type'),
   preferredWorkerModel: text('preferred_worker_model'),
   preferredWorkerEffort: text('preferred_worker_effort'),
+  preferredWorkerAccountId: text('preferred_worker_account_id'),
   allowedWorkerTypes: text('allowed_worker_types'),
   specPath: text('spec_path'),
   artifactPlanPath: text('artifact_plan_path'),
@@ -159,12 +160,74 @@ export const supervisorScheduledWakes = sqliteTable('supervisor_scheduled_wakes'
 
 export const accounts = sqliteTable('accounts', {
   id: text('id').primaryKey(),
+  cliType: text('cli_type'),
   provider: text('provider').notNull(),
   type: text('type').notNull(), // 'subscription' | 'api'
+  label: text('label'),
+  authMode: text('auth_mode').notNull().default('legacy_ref'),
   authRef: text('auth_ref').notNull(),
+  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
+  priority: integer('priority').notNull().default(0),
   capacity: integer('capacity'),
   resetSchedule: text('reset_schedule'),
+  status: text('status'),
+  statusCheckedAt: integer('status_checked_at', { mode: 'timestamp' }),
+  metadataJson: text('metadata_json'),
+  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
+  updatedAt: integer('updated_at', { mode: 'timestamp' }),
+});
+
+export const accountSecrets = sqliteTable('account_secrets', {
+  id: text('id').primaryKey(),
+  accountId: text('account_id').references(() => accounts.id).notNull(),
+  secretKind: text('secret_kind').notNull(),
+  secretRef: text('secret_ref'),
+  encryptedValue: text('encrypted_value').notNull(),
+  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
+  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
+});
+
+export const workerCredentialAllocations = sqliteTable('worker_credential_allocations', {
+  id: text('id').primaryKey(),
+  runId: text('run_id').references(() => runs.id).notNull(),
+  workerId: text('worker_id').references(() => workers.id).notNull(),
+  workerType: text('worker_type').notNull(),
+  accountId: text('account_id').references(() => accounts.id).notNull(),
+  strategy: text('strategy').notNull(),
+  selectionReason: text('selection_reason'),
+  explicit: integer('explicit', { mode: 'boolean' }).notNull().default(false),
   createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
+  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
+});
+
+export const workerTokenUsage = sqliteTable('worker_token_usage', {
+  id: text('id').primaryKey(),
+  runId: text('run_id').references(() => runs.id).notNull(),
+  workerId: text('worker_id').references(() => workers.id),
+  workerType: text('worker_type').notNull(),
+  accountId: text('account_id').references(() => accounts.id).notNull(),
+  model: text('model'),
+  inputTokens: integer('input_tokens').notNull().default(0),
+  outputTokens: integer('output_tokens').notNull().default(0),
+  cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
+  cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
+  costUsd: real('cost_usd').notNull().default(0),
+  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
+  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
+});
+
+export const accountUsageSnapshots = sqliteTable('account_usage_snapshots', {
+  id: text('id').primaryKey(),
+  accountId: text('account_id').references(() => accounts.id).notNull(),
+  workerType: text('worker_type').notNull(),
+  windowKey: text('window_key').notNull(),
+  usedTokens: integer('used_tokens').notNull().default(0),
+  remainingTokens: integer('remaining_tokens'),
+  costUsd: real('cost_usd').notNull().default(0),
+  resetAt: integer('reset_at', { mode: 'timestamp' }),
+  source: text('source').notNull(),
+  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
+  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
 });
 
 export const creditEvents = sqliteTable('credit_events', {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:58:07.544Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:58:07.544Z

```json
{
  "cmd": "sed -n '1260,1365p' src/server/supervisor/index.ts && sed -n '320,400p' src/server/conversations/send-message.ts && sed -n '410,510p' src/server/conversations/send-message.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:58:07.600Z","phase":null} -->
## Tool result: call_1qnFLKkzuJJhjxwBgQVBuJWV · 2026-06-29T13:58:07.600Z

```text
Chunk ID: dc92ac
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2954
Output:
          })) {
            return { state: "paused" };
          }
          const skillRoots = asOptionalStringArray(action.args.skillRoots, "skillRoots");
          const mcpServers = asOptionalMcpServers(action.args.mcpServers, "mcpServers");
          const requestedAllocation = classifyWorkerAllocation(title, purpose, prompt);
          const blockingWorker = await findBlockingWorkerForAllocation(this.runId, requestedAllocation);
          if (blockingWorker) {
            const blockingAllocation = resolveWorkerAllocation(blockingWorker);
            if (
              requestedAllocation.role === "validation"
              && blockingAllocation.role === "implementation"
              && hasFinalLookingWorkerOutput(blockingWorker)
            ) {
              await parkFinalLookingWorkerForValidator({
                runId: this.runId,
                worker: blockingWorker,
                requestedTitle: title,
                requestedPurpose: purpose,
              });
            } else {
              const resumable = blockingWorker.bridgeSessionId && isResumableWorkerStatus(blockingWorker.status);
              await insertExecutionEvent(this.runId, "worker_spawn_blocked", {
                summary: resumable
                  ? `Blocked replacement worker spawn because ${this.runId} already has resumable ${blockingAllocation.role} worker ${blockingWorker.id}.`
                  : `Blocked duplicate worker spawn because ${this.runId} already has active ${blockingAllocation.role} worker ${blockingWorker.id}.`,
                requestedTitle: title,
                requestedPurpose: purpose,
                requestedRole: requestedAllocation.role,
                requestedAllocationKey: requestedAllocation.allocationKey,
                activeWorkerId: blockingWorker.id,
                activeWorkerRole: blockingAllocation.role,
                activeAllocationKey: blockingAllocation.allocationKey,
                resumableSessionId: resumable ? blockingWorker.bridgeSessionId : null,
              });
              return { state: "wait", delayMs: 5_000 };
            }
          }
          const workerId = await reserveWorkerRow({
            runId: this.runId,
            workerType: workerType.type,
            cwd,
            title,
            initialPrompt: prompt,
            workerRole: requestedAllocation.role,
            allocationKey: requestedAllocation.allocationKey,
          });
          const preferredModel = run?.preferredWorkerModel ?? null;
          const preferredEffort = run?.preferredWorkerEffort ?? null;
          const accountAllocation = await allocateWorkerAccount({
            workerType: workerType.type,
            runId: this.runId,
            workerId,
            explicitAccountId: run?.preferredWorkerAccountId ?? null,
            strategy: run?.preferredWorkerAccountId ? "manual" : "priority",
          });
          const workerAccountId = accountAllocation.account?.id ?? null;

          let spawnedWorker: bridge.AgentRecord;
          try {
            spawnedWorker = await bridge.spawnAgent({
              type: workerType.type,
              cwd,
              name: workerId,
              ...(mode ? { mode } : {}),
              env: envParams,
              ...(workerAccountId ? { accountId: workerAccountId } : {}),
              ...(preferredModel ? { model: preferredModel } : {}),
              ...(preferredEffort ? { effort: preferredEffort } : {}),
              ...(skillRoots?.length ? { skillRoots } : {}),
              ...(mcpServers?.length ? { mcpServers } : {}),
            });
          } catch (error) {
            const quotaInfo = extractQuotaResetInfo(error, { provider: workerType.type });
            if (quotaInfo.isQuotaError) {
              emitNamedEvent({
                kind: "worker.status",
                runId: this.runId,
                workerId,
                prev: "starting",
                next: "cred-exhausted",
              });
              emitNamedEvent({
                kind: "error.surfaced",
                code: "worker.spawn.failed",
                message: `Worker ${workerType.type} hit quota on spawn.`,
                surface: "log",
                runId: this.runId,
                workerId,
                cause: {
                  name: error instanceof Error ? error.name : "Error",
                  message: quotaInfo.rawText.slice(0, 2_000),
                },
              });
              if (allowedWorkerTypes.length >= 2) {
                const failover = await attemptWorkerFailover({
                  runId: this.runId,
                  outgoingWorkerId: workerId,
                  outgoingWorkerType: workerType.type,
                  quotaText: quotaInfo.rawText,
                  originalPrompt: prompt,
                  allowedTypes: allowedWorkerTypes,
                  env: envParams,
                  cwd,
                  title,
                });
      runId: run.id,
      workerId: worker.id,
      cause: null,
    });
    throw Object.assign(new Error(message), { status: 500 });
  }

  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(sessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();
  const spawnParams = {
    type: worker.type,
    cwd: worker.cwd,
    name: worker.id,
    ...(workerMode ? { mode: workerMode } : {}),
    env: envParams,
    ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
    ...(run.preferredWorkerModel ? { model: run.preferredWorkerModel } : {}),
    ...(run.preferredWorkerEffort ? { effort: run.preferredWorkerEffort } : {}),
  };
  let resumedWorker;
  let recreatedFromRejectedEmptySession = false;
  let transcriptReplayRequired = false;
  try {
    resumedWorker = await spawnAgent({
      ...spawnParams,
      resumeSessionId: sessionId,
    });
  } catch (error) {
    if (isAgentAlreadyExistsError(error, worker.id)) {
      resumedWorker = await getAgent(worker.id);
    } else if (
      isRejectedSavedSessionErrorMessage(formatErrorMessage(error))
      && await canRecreateRejectedSavedSession(run.id, worker.id)
    ) {
      await recordExecutionEvent({
        runId: run.id,
        workerId: worker.id,
        planItemId: null,
        eventType: "worker_session_missing",
        details: {
          summary: `Saved bridge session for ${worker.id} is not recoverable, and the worker stream has no provider transcript.`,
          sessionId,
          reason: formatErrorMessage(error),
        },
      });
      await db.update(workers).set({
        status: "starting",
        bridgeSessionId: null,
        bridgeSessionMode: null,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      resumedWorker = await spawnAgent(spawnParams);
      recreatedFromRejectedEmptySession = true;
    } else if (isRejectedSavedSessionErrorMessage(formatErrorMessage(error))) {
      const materialized = await materializeProviderSessionFromWorkerStream({
        runId: run.id,
        workerId: worker.id,
        type: worker.type,
        sessionId,
        cwd: worker.cwd,
        errorMessage: formatErrorMessage(error),
        env: envParams,
      });
      if (materialized) {
        await recordExecutionEvent({
          runId: run.id,
          workerId: worker.id,
          planItemId: null,
          eventType: "worker_session_materialized",
          details: {
            summary: `Materialized ${materialized.provider} session ${sessionId} from the saved OmniHarness transcript.`,
            provider: materialized.provider,
            sessionId,
            filePath: materialized.filePath,
            messageCount: materialized.messageCount,
          },
        });
        try {
          resumedWorker = await spawnAgent({
            ...spawnParams,
              summary: `Materialized ${materialized.provider} session ${sessionId}, but ACP resume still failed.`,
              provider: materialized.provider,
              sessionId,
              filePath: materialized.filePath,
              reason: formatErrorMessage(materializedResumeError),
            },
          });
        }
      }
      if (!resumedWorker) {
        await recordExecutionEvent({
          runId: run.id,
          workerId: worker.id,
          planItemId: null,
          eventType: "worker_session_missing",
          details: {
            summary: `Saved bridge session for ${worker.id} is not recoverable; continuing from the saved OmniHarness transcript.`,
            sessionId,
            reason: formatErrorMessage(error),
            transcriptReplay: true,
          },
        });
        await db.update(workers).set({
          status: "starting",
          bridgeSessionId: null,
          bridgeSessionMode: null,
          updatedAt: new Date(),
        }).where(eq(workers.id, worker.id));
        resumedWorker = await spawnAgent(spawnParams);
        transcriptReplayRequired = true;
      }
    } else {
      emitNamedEvent({
        kind: "error.surfaced",
        code: "worker.resume.failed",
        message: formatErrorMessage(error),
        surface: "banner",
        runId: run.id,
        workerId: worker.id,
        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
      });
      throw error;
    }
  }

  await recordExecutionEvent({
    runId: run.id,
    workerId: worker.id,
    planItemId: null,
    eventType: transcriptReplayRequired
      ? "worker_session_recreated_from_transcript"
      : recreatedFromRejectedEmptySession ? "worker_session_recreated" : "worker_session_resumed",
    details: {
      summary: transcriptReplayRequired
        ? `Started a fresh runtime worker for ${worker.id} and continued from the saved OmniHarness transcript.`
        : recreatedFromRejectedEmptySession
        ? `Started a fresh runtime worker for ${worker.id} after its empty saved session was rejected.`
        : `Resumed ${worker.id} from saved session`,
      rejectedSessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? sessionId : null,
      sessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? resumedWorker.sessionId ?? null : sessionId,
      transcriptReplay: transcriptReplayRequired,
    },
  });
  emitNamedEvent({
    kind: recreatedFromRejectedEmptySession || transcriptReplayRequired ? "worker.recreated" : "worker.reattached",
    runId: run.id,
    workerId: worker.id,
  });

  await db.update(workers).set({
    status: resumedWorker.state,
    bridgeSessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
  await appendWorkerSessionMetadata({
    runId: run.id,
    workerId: worker.id,
    sessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    sessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    source: "direct-follow-up",
  });

  await persistWorkerSnapshot(worker.id, resumedWorker);
  notifyEventStreamSubscribers();
  return { ...resumedWorker, transcriptReplayRequired };
}

async function askDirectWorkerWithResume(run: RunRecord, worker: WorkerRecord, content: string) {
  const workerPrompt = isDirectRunMode(run.mode) ? buildDirectWorkerPrompt(content) : content;
  try {
    return await askAgent(worker.id, workerPrompt);
  } catch (error) {
    if (!isAgentNotFoundError(error)) {
      throw error;
    }

    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker)) {
      throw error;
    }

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-29T13:58:14.110Z","phase":null} -->
## Tool call: exec_command · 2026-06-29T13:58:14.110Z

```json
{
  "cmd": "rg \"preferredWorkerAccountId|accountId|workerCredentialAllocations|allocateWorkerAccount\" src tests -n",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-29T13:58:14.280Z","phase":null} -->
## Tool result: call_6DZva7njLZPc6T8tOK4Iuo50 · 2026-06-29T13:58:14.280Z

```text
Chunk ID: 1d05e6
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4974
Output:
tests/server/supervisor/codex-auth.test.ts:79:    expect(creds?.accountId).toBe("acc_mock");
tests/server/supervisor/codex-auth.test.ts:89:      accountId: "...",
tests/server/supervisor/codex-auth.test.ts:106:      accountId: "...",
tests/server/supervisor/codex-auth-refresh.test.ts:43:    accountId: "acc_mock",
src/server/supervisor/model-config.ts:180:        headers.set("chatgpt-account-id", creds.accountId);
src/server/bridge-client/index.ts:516:  accountId?: string | null;
src/server/bridge-client/index.ts:539:  accountId?: string;
src/server/supervisor/index.ts:44:import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
src/server/supervisor/index.ts:879:    ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
src/server/supervisor/index.ts:1309:          const accountAllocation = await allocateWorkerAccount({
src/server/supervisor/index.ts:1313:            explicitAccountId: run?.preferredWorkerAccountId ?? null,
src/server/supervisor/index.ts:1314:            strategy: run?.preferredWorkerAccountId ? "manual" : "priority",
src/server/supervisor/index.ts:1326:              ...(workerAccountId ? { accountId: workerAccountId } : {}),
tests/credits/manager.test.ts:9:    const accountId = `test-account-${randomUUID()}`;
tests/credits/manager.test.ts:12:      id: accountId,
tests/credits/manager.test.ts:22:    const result = await manager.checkCredits(accountId);
src/server/supervisor/worker-failover.ts:29:import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
src/server/supervisor/worker-failover.ts:334:      const accountAllocation = await allocateWorkerAccount({
src/server/supervisor/worker-failover.ts:338:        explicitAccountId: run?.preferredWorkerAccountId ?? null,
src/server/supervisor/worker-failover.ts:339:        strategy: run?.preferredWorkerAccountId ? "manual" : "priority",
src/server/supervisor/worker-failover.ts:347:        ...(workerAccountId ? { accountId: workerAccountId } : {}),
tests/api/codex-auth-status-route.security.test.ts:17:      accountId: "acc_id_sensitive",
tests/api/codex-auth-status-route.security.test.ts:45:    expect(data.accountId).toBeUndefined();
src/server/session-providers/types.ts:63:  preferredWorkerAccountId?: string | null;
src/server/session-providers/omni-provider.ts:28:      preferredWorkerAccountId: input.preferredWorkerAccountId,
src/server/runs/recovery.ts:45:import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
src/server/runs/recovery.ts:227:  const accountAllocation = await allocateWorkerAccount({
src/server/runs/recovery.ts:231:    explicitAccountId: run.preferredWorkerAccountId ?? null,
src/server/runs/recovery.ts:232:    strategy: run.preferredWorkerAccountId ? "manual" : "priority",
src/server/runs/recovery.ts:244:      ...(workerAccountId ? { accountId: workerAccountId } : {}),
src/server/runs/recovery.ts:475:      ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
src/server/runs/recovery.ts:510:        ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
src/server/runs/recovery.ts:546:            ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
src/server/runs/recovery.ts:594:          ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
src/server/supervisor/codex-auth.ts:24:  accountId: string;
src/server/supervisor/codex-auth.ts:84:    const accountId = tokens.account_id;
src/server/supervisor/codex-auth.ts:87:    if (!accessToken || !refreshToken || !accountId) {
src/server/supervisor/codex-auth.ts:113:      accountId,
src/runtime/http/routes/conversation-messages.ts:70:    const preferredWorkerAccountId = typeof body?.preferredWorkerAccountId === "string" ? body.preferredWorkerAccountId : null;
src/runtime/http/routes/conversation-messages.ts:102:        preferredWorkerAccountId,
src/server/runs/recovery-reconciler.ts:189:      ...(args.run.preferredWorkerAccountId ? { accountId: args.run.preferredWorkerAccountId } : {}),
src/server/runs/recovery-reconciler.ts:217:      ...(args.run.preferredWorkerAccountId ? { accountId: args.run.preferredWorkerAccountId } : {}),
src/runtime/http/routes/prewarm-worker.ts:41:      accountId: typeof body.accountId === "string" ? body.accountId : null,
tests/api/run-route.test.ts:2462:    const accountId = randomUUID();
tests/api/run-route.test.ts:2487:      id: accountId,
tests/api/run-route.test.ts:2555:      accountId,
src/server/agent-runtime/types.ts:143:  accountId?: string;
src/server/credits/index.ts:51:  async recordEvent(accountId: string, workerId: string, eventType: string, details?: string) {
src/server/credits/index.ts:54:      accountId,
src/server/credits/index.ts:62:  async checkCredits(accountId: string): Promise<string> {
src/server/credits/index.ts:63:    const acc = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
src/server/credits/index.ts:64:    if (!acc) return `Account ${accountId} not found.`;
src/server/credits/index.ts:66:      return `Account ${accountId} (${acc.provider}) is exhausted.`;
src/server/credits/index.ts:69:      return `Account ${accountId} (${acc.provider}) has ${acc.capacity} credits remaining.`;
src/server/credits/index.ts:71:    return `Account ${accountId} (${acc.provider}) has sufficient credits.`;
src/server/credits/index.ts:101:        accountId: target.id,
src/server/db/schema.ts:25:  preferredWorkerAccountId: text('preferred_worker_account_id'),
src/server/db/schema.ts:182:  accountId: text('account_id').references(() => accounts.id).notNull(),
src/server/db/schema.ts:190:export const workerCredentialAllocations = sqliteTable('worker_credential_allocations', {
src/server/db/schema.ts:195:  accountId: text('account_id').references(() => accounts.id).notNull(),
src/server/db/schema.ts:208:  accountId: text('account_id').references(() => accounts.id).notNull(),
src/server/db/schema.ts:221:  accountId: text('account_id').references(() => accounts.id).notNull(),
src/server/db/schema.ts:235:  accountId: text('account_id').references(() => accounts.id).notNull(),
src/server/agent-runtime/manager.ts:1475:      accountId: input.accountId,
src/server/agent-runtime/manager.ts:1916:    accountId?: string | null;
src/server/agent-runtime/manager.ts:1941:      accountId: input.accountId,
src/server/agent-runtime/http.ts:102:          accountId?: string | null;
src/server/agent-runtime/http.ts:121:          accountId: body.accountId ?? null,
src/server/events/named-events.ts:243:  | { kind: "account.detected"; accountId: string; workerType: string; provider: string; authMode: string }
src/server/events/named-events.ts:244:  | { kind: "account.created"; accountId: string; workerType: string | null; provider: string; authMode: string }
src/server/events/named-events.ts:245:  | { kind: "account.updated"; accountId: string; workerType: string | null; changedKeys: string[] }
src/server/events/named-events.ts:246:  | { kind: "account.status_checked"; accountId: string; workerType: string | null; status: string | null }
src/server/events/named-events.ts:249:      accountId: string;
src/server/events/named-events.ts:257:  | { kind: "account.quota_exhausted"; accountId: string; runId?: string; workerId?: string; workerType: string; reason: string }
src/server/events/named-events.ts:268:  | { kind: "account.usage_recorded"; accountId: string; runId: string; workerId?: string; workerType: string; inputTokens: number; outputTokens: number; costUsd: number }
src/server/events/named-events.ts:269:  | { kind: "account.login_required"; accountId: string; workerType: string; reason: string };
src/runtime/http/routes/conversations.ts:173:      preferredWorkerAccountId: typeof body?.preferredWorkerAccountId === "string" ? body.preferredWorkerAccountId : null,
tests/server/quota/type-blocking.test.ts:11:  workerCredentialAllocations,
tests/server/quota/type-blocking.test.ts:98:async function insertAllocation(runId: string, workerId: string, workerType: string, accountId: string) {
tests/server/quota/type-blocking.test.ts:99:  await db.insert(workerCredentialAllocations).values({
tests/server/quota/type-blocking.test.ts:104:    accountId,
tests/server/quota/type-blocking.test.ts:118:    await db.delete(workerCredentialAllocations);
tests/server/quota/type-blocking.test.ts:187:    await db.delete(workerCredentialAllocations);
src/server/conversations/create.ts:43:import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
src/server/conversations/create.ts:450:  preferredWorkerAccountId?: string | null;
src/server/conversations/create.ts:466:      ...(args.preferredWorkerAccountId ? { accountId: args.preferredWorkerAccountId } : {}),
src/server/conversations/create.ts:539:  preferredWorkerAccountId?: string | null;
src/server/conversations/create.ts:622:      preferredWorkerAccountId: args.preferredWorkerAccountId?.trim() || null,
src/server/conversations/create.ts:695:      const accountAllocation = await allocateWorkerAccount({
src/server/conversations/create.ts:699:        explicitAccountId: args.preferredWorkerAccountId?.trim() || null,
src/server/conversations/create.ts:700:        strategy: args.preferredWorkerAccountId?.trim() ? "manual" : "priority",
src/server/conversations/create.ts:739:          preferredWorkerAccountId: workerAccountId,
src/server/conversations/create.ts:762:              ...(workerAccountId ? { accountId: workerAccountId } : {}),
src/server/quota/recovery.ts:3:import { runs, workerCredentialAllocations, workers } from "@/server/db/schema";
src/server/quota/recovery.ts:49:  accountId?: string | null;
src/server/quota/recovery.ts:62:    accountId: args.accountId ?? null,
src/server/quota/recovery.ts:109:    .from(workerCredentialAllocations)
src/server/quota/recovery.ts:110:    .where(eq(workerCredentialAllocations.workerId, args.workerId))
src/server/quota/recovery.ts:118:    accountId: allocation?.accountId ?? null,
src/server/conversations/send-message.ts:336:    ...(run.preferredWorkerAccountId ? { accountId: run.preferredWorkerAccountId } : {}),
src/server/conversations/send-message.ts:715:  preferredWorkerAccountId?: string | null;
src/server/conversations/send-message.ts:743:  preferredWorkerAccountId?: string | null;
src/server/conversations/send-message.ts:758:  const nextPreferredWorkerAccountId = args.preferredWorkerAccountId?.trim() || null;
src/server/conversations/send-message.ts:765:    preferredWorkerAccountId: nextPreferredWorkerAccountId,
src/server/conversations/send-message.ts:779:      preferredWorkerAccountId: nextPreferredWorkerAccountId,
src/server/conversations/send-message.ts:791:    preferredWorkerAccountId: nextPreferredWorkerAccountId,
src/server/conversations/send-message.ts:943:  preferredWorkerAccountId = null,
src/server/conversations/send-message.ts:970:    preferredWorkerAccountId,
src/server/quota/type-blocking.ts:3:import { accounts, workers, recoveryIncidents, workerCredentialAllocations } from "@/server/db/schema";
src/server/quota/type-blocking.ts:40:  return typeof details.accountId === "string" && details.accountId.trim()
src/server/quota/type-blocking.ts:41:    ? details.accountId.trim()
src/server/quota/type-blocking.ts:58:    .from(workerCredentialAllocations)
src/server/quota/type-blocking.ts:59:    .where(eq(workerCredentialAllocations.workerId, workerId))
src/server/quota/type-blocking.ts:61:  return allocation?.accountId ?? null;
src/server/quota/type-blocking.ts:67:  for (const accountId of usableAccountIds) {
src/server/quota/type-blocking.ts:68:    if (!blockedAccountIds.has(accountId)) return false;
src/server/quota/type-blocking.ts:127:        const accountId = await allocatedAccountIdForWorker(worker.id);
src/server/quota/type-blocking.ts:128:        if (accountId) blockedAccountIds.add(accountId);
src/server/quota/type-blocking.ts:135:        const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(worker.id);
src/server/quota/type-blocking.ts:136:        if (accountId) blockedAccountIds.add(accountId);
src/server/quota/type-blocking.ts:158:      const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(row.worker.id);
src/server/quota/type-blocking.ts:159:      if (accountId) blockedAccountIds.add(accountId);
src/server/quota/type-blocking.ts:212:  async function addBlockedCandidate(workerType: SupportedWorkerType, accountId: string | null, candidate: QuotaBlockReason) {
src/server/quota/type-blocking.ts:228:    if (accountId) current.blockedAccountIds.add(accountId);
src/server/quota/type-blocking.ts:245:    const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(worker.id);
src/server/quota/type-blocking.ts:247:    await addBlockedCandidate(workerType, accountId, {
src/server/quota/type-blocking.ts:269:    const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(row.worker.id);
src/server/quota/type-blocking.ts:271:    await addBlockedCandidate(workerType, accountId, {
src/server/quota/worker-resume.ts:144:          ...(args.run.preferredWorkerAccountId ? { accountId: args.run.preferredWorkerAccountId } : {}),
tests/server/accounts/account-allocator.test.ts:11:  workerCredentialAllocations,
tests/server/accounts/account-allocator.test.ts:14:import { allocateWorkerAccount } from "@/server/accounts/account-allocator";
tests/server/accounts/account-allocator.test.ts:71:    const accountId = await insertAccount({ cliType: workerType, priority: 1 });
tests/server/accounts/account-allocator.test.ts:74:    const allocation = await allocateWorkerAccount({
tests/server/accounts/account-allocator.test.ts:76:      explicitAccountId: accountId,
tests/server/accounts/account-allocator.test.ts:82:    expect(allocation.account?.id).toBe(accountId);
tests/server/accounts/account-allocator.test.ts:88:      .from(workerCredentialAllocations)
tests/server/accounts/account-allocator.test.ts:89:      .where(eq(workerCredentialAllocations.workerId, workerId))
tests/server/accounts/account-allocator.test.ts:92:      accountId,
tests/server/accounts/account-allocator.test.ts:104:    const allocation = await allocateWorkerAccount({ workerType });
tests/server/accounts/account-allocator.test.ts:119:        accountId: small,
tests/server/accounts/account-allocator.test.ts:130:        accountId: large,
tests/server/accounts/account-allocator.test.ts:141:    const allocation = await allocateWorkerAccount({ workerType, strategy: "quota_balanced" });
tests/server/accounts/account-allocator.test.ts:161:        accountId: blocked,
tests/server/accounts/account-allocator.test.ts:169:    const allocation = await allocateWorkerAccount({
tests/server/accounts/account-allocator.test.ts:179:    const allocation = await allocateWorkerAccount({ workerType: `missing-${randomUUID()}` });
tests/server/accounts/schema.test.ts:11:  workerCredentialAllocations,
tests/server/accounts/schema.test.ts:19:    const accountId = `account-${randomUUID()}`;
tests/server/accounts/schema.test.ts:23:      id: accountId,
tests/server/accounts/schema.test.ts:41:    const row = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
tests/server/accounts/schema.test.ts:44:      id: accountId,
tests/server/accounts/schema.test.ts:56:      id: accountId,
tests/server/accounts/schema.test.ts:74:    const accountId = `account-${randomUUID()}`;
tests/server/accounts/schema.test.ts:85:      id: accountId,
tests/server/accounts/schema.test.ts:91:      authRef: `setting:ACCOUNT_SECRET_${accountId}`,
tests/server/accounts/schema.test.ts:101:      preferredWorkerAccountId: accountId,
tests/server/accounts/schema.test.ts:119:      accountId,
tests/server/accounts/schema.test.ts:121:      secretRef: `setting:ACCOUNT_SECRET_${accountId}`,
tests/server/accounts/schema.test.ts:126:    await db.insert(workerCredentialAllocations).values({
tests/server/accounts/schema.test.ts:131:      accountId,
tests/server/accounts/schema.test.ts:143:      accountId,
tests/server/accounts/schema.test.ts:155:      accountId,
tests/server/accounts/schema.test.ts:168:    const allocation = await db.select().from(workerCredentialAllocations).where(eq(workerCredentialAllocations.workerId, workerId)).get();
tests/server/accounts/schema.test.ts:170:    const snapshot = await db.select().from(accountUsageSnapshots).where(eq(accountUsageSnapshots.accountId, accountId)).get();
tests/server/accounts/schema.test.ts:172:    expect(run?.preferredWorkerAccountId).toBe(accountId);
tests/server/accounts/schema.test.ts:173:    expect(allocation).toMatchObject({ accountId, explicit: true, strategy: "manual" });
tests/server/accounts/schema.test.ts:174:    expect(usage).toMatchObject({ accountId, inputTokens: 10, outputTokens: 20, costUsd: 0.0123 });
tests/server/accounts/schema.test.ts:175:    expect(snapshot).toMatchObject({ accountId, usedTokens: 30, remainingTokens: 70, source: "local_rollup" });
tests/server/accounts/account-resolver.test.ts:32:    const accountId = await insertAccount({
tests/server/accounts/account-resolver.test.ts:42:      accountId,
tests/server/accounts/account-resolver.test.ts:45:    expect(resolved.account?.id).toBe(accountId);
tests/server/accounts/account-resolver.test.ts:46:    expect(resolved.env.CODEX_HOME).toContain(join("account-cli-homes", "codex", accountId, "home"));
tests/server/accounts/account-resolver.test.ts:47:    expect(resolved.env.CODEX_SQLITE_HOME).toContain(join("account-cli-homes", "codex", accountId, "sqlite"));
tests/server/accounts/account-resolver.test.ts:58:    const accountId = await insertAccount({
tests/server/accounts/account-resolver.test.ts:72:      accountId,
tests/server/accounts/account-resolver.test.ts:75:    expect(resolved.account?.id).toBe(accountId);
src/server/accounts/account-allocator.ts:8:  workerCredentialAllocations,
src/server/accounts/account-allocator.ts:84:    const accountId = typeof details.accountId === "string" ? details.accountId.trim() : "";
src/server/accounts/account-allocator.ts:86:    if (accountId && (!resumeAt || resumeAt.getTime() > now.getTime())) {
src/server/accounts/account-allocator.ts:87:      result.add(accountId);
src/server/accounts/account-allocator.ts:115:    .from(workerCredentialAllocations)
src/server/accounts/account-allocator.ts:116:    .where(eq(workerCredentialAllocations.workerType, workerType));
src/server/accounts/account-allocator.ts:119:    counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1);
src/server/accounts/account-allocator.ts:131:    const current = latest.get(row.accountId);
src/server/accounts/account-allocator.ts:133:      latest.set(row.accountId, row);
src/server/accounts/account-allocator.ts:142:  await db.insert(workerCredentialAllocations).values({
src/server/accounts/account-allocator.ts:147:    accountId: allocation.account.id,
src/server/accounts/account-allocator.ts:160:    accountId: allocation.account.id,
src/server/accounts/account-allocator.ts:207:export async function allocateWorkerAccount(input: AccountAllocationInput): Promise<AccountAllocation> {
src/server/accounts/account-resolver.ts:67:  accountId?: string | null;
src/server/accounts/account-resolver.ts:73:    input.accountId
src/server/accounts/account-resolver.ts:74:      ? await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get()
src/app/home/HomeApp.tsx:810:        accountId: effectiveSelectedWorkerAccountId === "auto" ? null : effectiveSelectedWorkerAccountId,
src/app/home/useHomeMutations.ts:388:  const preferredWorkerAccountId = selectedWorkerAccountId === "auto" ? null : selectedWorkerAccountId;
src/app/home/useHomeMutations.ts:751:          preferredWorkerAccountId,
src/app/home/useHomeMutations.ts:877:          preferredWorkerAccountId,
src/app/home/useHomeMutations.ts:966:          preferredWorkerAccountId,

```

<!-- /codex-event -->

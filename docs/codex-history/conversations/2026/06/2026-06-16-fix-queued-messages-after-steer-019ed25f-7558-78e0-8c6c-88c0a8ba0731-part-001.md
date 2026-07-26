---
provider: "codex"
codex_thread_id: "019ed25f-7558-78e0-8c6c-88c0a8ba0731"
title: "Fix queued messages after steer"
started_at: "2026-06-16T21:38:51.896Z"
updated_at: "2026-06-16T21:49:36.838Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "complete"
part: 1
parts: 1
---

# Fix queued messages after steer

> This archive contains visible conversation activity and tool records. Private model reasoning and system/developer instructions are not available here.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-16T21:39:52.962Z","phase":null} -->
## Task state: task_started · 2026-06-16T21:39:52.962Z

```text
{
  "type": "task_started",
  "turn_id": "019ed260-63ae-7663-bd01-0711a3e4aa54",
  "started_at": 1781645992,
  "model_context_window": 258400,
  "collaboration_mode_kind": "default"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-16T21:39:52.995Z","phase":null} -->
## User · 2026-06-16T21:39:52.995Z

man how many times do I need to tell you this again and again. The list of queued messages DOESN'T FUCKING UPDATE WHEN WE FORCE STEER A MESSAGE!!@!!


IT NEVER DID!!!@! STILL DOESNT!!!!!!!!!!!!!!

the motherfucking message is still there!!!!!!!!


MOTHER FUCKKKKKKKKKKKKKKKK

look at this session: 5eb40b0d5030


<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:40:06.371Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:40:06.371Z

I hear you. I’m going straight at the persisted state for `5eb40b0d5030` first, then I’ll trace the force-steer path that should be removing or refreshing queued messages.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:06.374Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:06.374Z

```json
{
  "cmd": "sed -n '1,240p' /Users/masterman/.agents/skills/systematic-debugging/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:06.377Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:06.377Z

```json
{
  "cmd": "sed -n '1,240p' /Users/masterman/.agents/skills/client-server-state-invariants/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:06.760Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:06.760Z

```json
{
  "cmd": "sed -n '1,240p' /Users/masterman/.agents/skills/instrumenting-control-planes/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:06.823Z","phase":null} -->
## Tool result: call_R2J3MncojGAe5GmfavE1dsfO · 2026-06-16T21:40:06.823Z

````text
Chunk ID: 876312
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1821
Output:
---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue:
- Test failures
- Bugs in production
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (rushing guarantees rework)
- Manager wants it fixed NOW (systematic is faster than thrashing)

## The Four Phases

You MUST complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings
   - They often contain the exact solution
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen every time?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - What changed that could cause this?
   - Git diff, recent commits
   - New dependencies, config changes
   - Environmental differences

4. **Gather Evidence in Multi-Component Systems**

   **WHEN system has multiple components (CI → build → signing, API → service → database):**

   **BEFORE proposing fixes, add diagnostic instrumentation:**
   ```
   For EACH component boundary:
     - Log what data enters component
     - Log what data exits component
     - Verify environment/config propagation
     - Check state at each layer

   Run once to gather evidence showing WHERE it breaks
   THEN analyze evidence to identify failing component
   THEN investigate that specific component
   ```

   **Example (multi-layer system):**
   ```bash
   # Layer 1: Workflow
   echo "=== Secrets available in workflow: ==="
   echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

   # Layer 2: Build script
   echo "=== Env vars in build script: ==="
   env | grep IDENTITY || echo "IDENTITY not in environment"

   # Layer 3: Signing script
   echo "=== Keychain state: ==="
   security list-keychains
   security find-identity -v

   # Layer 4: Actual signing
   codesign --sign "$IDENTITY" --verbose=4 "$APP"
   ```

   **This reveals:** Which layer fails (secrets → workflow ✓, workflow → build ✗)

5. **Trace Data Flow**

   **WHEN error is deep in call stack:**

   See `root-cause-tracing.md` in this directory for the complete backward tracing technique.

   **Quick version:**
   - Where does bad value originate?
   - What called this with bad value?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

**Find the pattern before fixing:**

1. **Find Working Examples**
   - Locate similar working code in same codebase
   - What works that's similar to what's broken?

2. **Compare Against References**
   - If implementing pattern, read reference implementation COMPLETELY
   - Don't skim - read every line
   - Understand the pattern fully before applying

3. **Identify Differences**
   - What's different between working and broken?
   - List every difference, however small
   - Don't assume "that can't matter"

4. **Understand Dependencies**
   - What other components does this need?
   - What settings, config, environment?
   - What assumptions does it make?

### Phase 3: Hypothesis and Testing

**Scientific method:**

1. **Form Single Hypothesis**
   - State clearly: "I think X is the root cause because Y"
   - Write it down
   - Be specific, not vague

2. **Test Minimally**
   - Make the SMALLEST possible change to test hypothesis
   - One variable at a time
   - Don't fix multiple things at once

3. **Verify Before Continuing**
   - Did it work? Yes → Phase 4
   - Didn't work? Form NEW hypothesis
   - DON'T add more fixes on top

4. **When You Don't Know**
   - Say "I don't understand X"
   - Don't pretend to know
   - Ask for help
   - Research more

### Phase 4: Implementation

**Fix the root cause, not the symptom:**

1. **Create Failing Test Case**
   - Simplest possible reproduction
   - Automated test if possible
   - One-off test script if no framework
   - MUST have before fixing
   - Use the `ultrapowers:test-driven-development` skill for writing proper failing tests

2. **Implement Single Fix**
   - Address the root cause identified
   - ONE change at a time
   - No "while I'm here" improvements
   - No bundled refactoring

3. **Verify Fix**
   - Test passes now?
   - No other tests broken?
   - Issue actually resolved?
   - If the bug was meaningful or systemic, use `ultrapowers:learning-from-bugs` before declaring the fix complete.

4. **If Fix Doesn't Work**
   - STOP
   - Count: How many fixes have you tried?
   - If < 3: Return to Phase 1, re-analyze with new information
   - **If ≥ 3: STOP and question the architecture (step 5 below)**
   - DON'T attempt Fix #4 without architectural discussion

5. **If 3+ Fixes Failed: Question Architecture**

   **Pattern indicating architectural problem:**
   - Each fix reveals new shared state/coupling/problem in different place
   - Fixes require "massive refactoring" to implement
   - Each fix creates new symptoms elsewhere

   **STOP and question fundamentals:**
   - Is this pattern fundamentally sound?
   - Are we "sticking with it through sheer inertia"?
   - Should we refactor architecture vs. continue fixing symptoms?

   **Discuss with your human partner before attempting more fixes**

   This is NOT a failed hypothesis - this is a wrong architecture.

## Red Flags - STOP and Follow Process

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Pattern says X but I'll adapt it differently"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- **Each fix reveals new problem in different place**

**ALL of these mean: STOP. Return to Phase 1.**

**If 3+ fixes failed:** Question the architecture (see Phase 4.5)

## your human partner's Signals You're Doing It Wrong

**Watch for these redirections:**
- "Is that not happening?" - You assumed without verifying
- "Will it show us...?" - You should have added evidence gathering
- "Stop guessing" - You're proposing fixes without understanding

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:06.823Z","phase":null} -->
## Tool result: call_FK6JRbmLVSFQW9ufnWumBgiI · 2026-06-16T21:40:06.823Z

```text
Chunk ID: 202582
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1481
Output:
---
name: client-server-state-invariants
description: Use when planning, building, reviewing, or debugging React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization
---

# Client Server State Invariants

React bugs often expose deeper ownership mistakes. When client state, server state, cache state, stream state, and persisted state all exist, every plan needs explicit invariants.

## Core Rule

No UI surface may treat data as authoritative unless the payload proves ownership, freshness, completeness, ordering, and terminal state.

If those words are missing from the plan, the plan is probably baking in a race condition.

## Planning Checklist

For every React app that reads server/runtime state, the plan must answer:

1. **Owner:** What owns this state: server, client manager, URL, cache, stream, local storage, or worker/runtime?
2. **Token:** What owner token protects async results: `requestId`, `runId`, `projectPath`, `operationId`, `workerId + seq`, or equivalent?
3. **Provenance:** Is data server-authoritative, optimistic, cached preview, partial update, or historical fallback?
4. **Completeness:** Does the payload declare what scope it is complete for? What may it erase?
5. **Ordering:** What stable order is used: monotonic seq, `(createdAt, id)`, version, or cursor?
6. **State machine:** What are the legal states, terminal states, and transitions?
7. **Events:** Which server decisions are named events rather than client-side derivations?
8. **Loading shape:** Which states are bootstrap, first load, incremental refresh, reconnect, resync, recovery, and terminal error?
9. **Fallbacks:** Which legacy/fallback rows can render, and only after what authority is loaded?
10. **Tests:** Which race, stale-response, event-sequence, reconnect, and merge tests prove the invariants?

## Invariants To Require

- Cached and optimistic data may pre-render, but cannot satisfy full-load gates.
- Partial snapshots may add or refine state, but may not erase optimistic objects, delivered user input, read markers, or stream entries unless they declare complete scope.
- Every async response checks that its owner token still matches before mutating visible state.
- Mutation success handlers may navigate or clear UI only if they still own the current context, unless the action explicitly creates a new selected context.
- Timers and polling callbacks re-check ownership immediately before acting.
- Server decisions are emitted as named events; the client does not infer decisions by diffing snapshots.
- SSE/WebSocket streams have event ids, replay/resume, and an explicit resync path.
- Loading booleans are split by lifecycle stage. A leaf stream refresh must not unmount the whole page.
- Append-only content has one writer, one reader, stable ids, and monotonic cursors.
- Fallback DB rows or historical rows are gated behind stream loading and deduped by stable id plus safe equivalence.
- Status classifiers distinguish active, runnable, blocked, awaiting user, terminal, stale, and recoverable states.
- "Latest" queries have deterministic tie-breakers. Timestamp-only ordering is not enough.
- Hot paths use bounded reads and do not synchronously load large bodies, bridge probes, schema setup, or heavy app graphs.
- Process-local caches have explicit TTL/size bounds and invalidation rules.

## Test Matrix

Pick the rows that match the work. Do not rely on one happy-path UI test.

| Risk | Test shape |
| --- | --- |
| Stale async response | Start request A, switch owner, resolve A, assert it cannot mutate B |
| Optimistic object erased | Create local optimistic state, apply stale/partial snapshot, assert object remains |
| Cache masquerades as loaded | Hydrate cache preview, assert full-load gate waits for server authority |
| Mutation steals navigation | Start mutation, switch selection, resolve mutation, assert focus stays put |
| Timer/poll stale-fire | Use fake timers or deferred promises; callback must re-check owner before acting |
| Snapshot merge erases stream | Apply partial snapshot missing known entries, assert entries/read markers remain |
| Event stream gap | Bootstrap snapshot, emit events during disconnect, reconnect with last id, assert replay or resync |
| Server decision invisible | Exercise branch and assert named event such as `blocked`, `refused`, `gave_up`, or `error.surfaced` |
| State classifier wrong | Table-test every status into active/runnable/terminal/recoverable buckets |
| Fallback duplicates stream | Load fallback rows then stream entries, assert no duplicate or false chronology |
| Hot path bloats | Assert snapshots carry cursors not bodies; route returns before DB/heavy imports when possible |
| Timestamp tie | Insert equal timestamps, assert deterministic order by id/seq |

Use headless HTTP/SSE tests for control-plane decisions. Use React/unit tests for manager merging and ownership guards. Use Playwright only for real UI layout, focus, scroll, mobile computed styles, and visible affordances.

## Refuse These Shapes

- one `isLoading` boolean for bootstrap, refresh, reconnect, and recovery;
- cache or optimistic data treated as authoritative without provenance;
- async callbacks that mutate state without checking owner tokens;
- client-side derivation of server decisions;
- snapshot diffs used as the only way to know what happened;
- event streams without ids or resume;
- timestamp-only "latest" queries;
- parallel transcript or persistence surfaces that the frontend must reconcile;
- unbounded process caches introduced to hide slow storage;
- tests that prove only the DOM result when the bug is a server decision.

## Review Prompt

Ask this before implementation starts:

> What can arrive late, out of order, partially, twice, or after the user changes context, and what test proves it cannot corrupt visible state?

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:06.824Z","phase":null} -->
## Tool result: call_YL6FcvlWXiO5AoQ1DzK9MlOR · 2026-06-16T21:40:06.824Z

````text
Chunk ID: 098d36
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1303
Output:
---
name: instrumenting-control-planes
description: Use when building, planning, reviewing, or debugging apps with backend decisions, agent workflows, long-running jobs, SSE/WebSocket streams, recovery paths, deletes, retries, or user-visible failures
---

# Instrumenting Control Planes

Build the control plane as a product surface. If the server decides, refuses, retries, spawns, deletes, recovers, gives up, or fails, that decision must be observable by users, operators, and tests.

If a React UI consumes the control plane through server state, optimistic UI, caches, polling, SSE/WebSocket streams, or persisted runtime state, also use `client-server-state-invariants`.

## Core Rule

Every meaningful server-side state transition emits a named, durable event. The UI and tests consume the same production event surface.

Do not rely on snapshot diffs, rendered DOM state, logs only, or client-side re-derivation to prove what the server decided.

## Hot Path Rule

No user bootstrap, catalog, status, reconnect, or recovery request may depend on a lock-prone database write path or external health probe finishing. Serve these paths from a bounded read model, memory cache, append-only event log, or stale-but-marked snapshot; queue reconciliation writes outside the request. Every dependency on a database or bridge call in a hot path needs a short timeout, cancellation, and an explicit degraded response.

If SQLite, local files, or a single-writer store is used, assume writer contention can freeze readers at the worst moment. Use one writer, WAL/busy-timeout discipline, short transactions, bounded queues, and headless chaos tests that run bootstrap/reload while writes are active. A 25s UI request is a control-plane failure, even if the database eventually returns.

## Event Contract

For each backend or agent workflow, define:

- named events for decisions: `worker.spawned`, `worker.reattached`, `plan.ready`, `plan.review.blocked`, `recovery.gave_up`, `conversation.delete_failed`;
- payloads with stable ids, `prev`/`next` status when relevant, reason codes, and enough context to debug;
- `error.surfaced` or an equivalent user-facing failure event for every failure the user should know about;
- durable persistence or a bounded replay buffer so short disconnects do not erase history;
- a scriptable read path: CLI, HTTP endpoint, sqlite query, or event log command.

If a decision cannot be asserted from this surface, the design is incomplete.

If debugging a control-plane failure reveals a reusable lesson, use `ultrapowers:learning-from-bugs` after the fix is verified.

## Streaming Requirements

For SSE or WebSocket-like streams:

- emit named events alongside any snapshot/update frame;
- include monotonic event ids;
- support resume from the last seen id;
- replay missed events from a bounded buffer;
- emit an explicit resync-required event when replay is impossible;
- bootstrap from a snapshot, then tail events.

Snapshots show current truth. Named events show why it became true.

## Testing Standard

Control-plane tests should usually be headless HTTP/SSE scenario tests, not browser tests. Browser automation is for UI behavior; control-plane tests assert server decisions directly.

Write scenario assertions as event transcripts:

```ts
expect(events).toHaveEmitted("worker.spawned", { runId });
expect(events).toHaveEmitted("worker.status", { next: "running" });
chaos.killServer();
chaos.restartServer();
expect(events).toHaveEmitted("worker.reattached", { runId });
expect(events).not.toHaveEmitted("worker.recreated", { runId });
```

Chaos belongs outside production code paths: drop connections in the client, fail fetches in the harness, restart the server process, and use seeds for reproducibility.

## Refuse These Shapes

- silent early returns in server methods;
- swallowed `catch` blocks;
- client-side derivation of server decisions;
- response-code-only user failures;
- event streams without ids or resume;
- tests that infer control-plane behavior from rendered state;
- delete handlers that do not enumerate dependent rows or emit typed failure events;
- recovery loops without terminal events such as `gave_up` or `abandoned`;
- request handlers that wait on inline reconciliation writes, SQLite contention, or bridge `/doctor` checks before returning bootstrap data;
- test-only behavior branches in production code.

## Design Checklist

Before implementing a backend or agent workflow, answer:

1. What decisions can this workflow make?
2. What named event is emitted for each decision, including refusal and failure?
3. Where are events persisted or buffered?
4. How does a client resume after disconnect?
5. Which request paths must keep working while persistence or bridge dependencies are slow, locked, or stale?
6. How can a CLI or test harness inspect the exact event sequence without the UI?
7. Which headless scenario proves the happy path, failure path, recovery path, terminal state, and hot-path timeout/degraded path?
8. Which client state consumes these events, and how does it prove ownership, freshness, completeness, ordering, and replay/resync?

If the answer is "the UI can figure it out", name the missing event instead.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:40:15.565Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:40:15.565Z

I’m using the systematic debugging, control-plane, and client/server state invariants skills here because this is exactly the kind of bug where server truth, DB rows, and UI snapshots can drift. First evidence, then fix.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:15.578Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:15.578Z

```json
{
  "cmd": "rg --files -g 'sqlite.db' -g '*.db' -g 'package.json' -g 'pnpm-lock.yaml'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:15.578Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:15.578Z

```json
{
  "cmd": "rg -n \"queued|queue|force steer|forceSteer|steer|queued message|queuedMessages|pending message|pendingMessages\" src tests docs shared -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:15.650Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:15.650Z

```json
{
  "cmd": "git status --short",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:15.785Z","phase":null} -->
## Tool result: call_MSvbOZ6BTL9hEC1HfgzF9XkD · 2026-06-16T21:40:15.785Z

```text
Chunk ID: cbf22e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 23
Output:
pnpm-lock.yaml
sqlite.db
package.json
apps/vscode/package.json
apps/electron/package.json

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:15.816Z","phase":null} -->
## Tool result: call_RUfD84ygFV4FCLHTmI5gIgmO · 2026-06-16T21:40:15.816Z

```text
Chunk ID: 10e66f
Wall time: 0.0036 seconds
Process exited with code 0
Original token count: 53079
Output:
Total output lines: 1558

shared/locales/es.json:127:  "settings.runtime.steer": "Dirigir",
shared/locales/es.json:128:  "settings.runtime.queue": "Encolar",
shared/locales/es.json:184:  "conversation.composer.sendButton.queue": "Encolar mensaje",
shared/locales/es.json:185:  "conversation.composer.sendButton.steer": "Dirigir trabajo activo",
shared/locales/es.json:188:  "conversation.composer.sendButton.queueTitle": "Encolar mensaje. {shortcut} dirige el trabajo activo.",
shared/locales/es.json:189:  "conversation.composer.sendButton.steerTitle": "Dirigir trabajo activo. {shortcut} encola el mensaje.",
shared/locales/es.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/es.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/es.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/es.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/es.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/es.json:358:  "queued.message.interruptSendAria": "Interrumpir y enviar ahora",
shared/locales/es.json:359:  "queued.message.interruptSendTitle": "Detener el turno actual y enviar esto ahora",
shared/locales/es.json:362:  "queued.message.cancelAria": "Cancel queued message",
shared/locales/ko.json:127:  "settings.runtime.steer": "조향",
shared/locales/ko.json:128:  "settings.runtime.queue": "대기열",
shared/locales/ko.json:184:  "conversation.composer.sendButton.queue": "메시지 대기열에 추가",
shared/locales/ko.json:185:  "conversation.composer.sendButton.steer": "진행 중인 작업 조향",
shared/locales/ko.json:188:  "conversation.composer.sendButton.queueTitle": "메시지를 대기열에 추가합니다. {shortcut}은 진행 중인 작업을 조향합니다.",
shared/locales/ko.json:189:  "conversation.composer.sendButton.steerTitle": "진행 중인 작업을 조향합니다. {shortcut}은 메시지를 대기열에 추가합니다.",
shared/locales/ko.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/ko.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/ko.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/ko.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/ko.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/ko.json:358:  "queued.message.interruptSendAria": "중단하고 지금 보내기",
shared/locales/ko.json:359:  "queued.message.interruptSendTitle": "현재 턴을 멈추고 지금 보냅니다",
shared/locales/ko.json:362:  "queued.message.cancelAria": "Cancel queued message",
shared/locales/fr.json:127:  "settings.runtime.steer": "Diriger",
shared/locales/fr.json:128:  "settings.runtime.queue": "Mettre en file",
shared/locales/fr.json:184:  "conversation.composer.sendButton.queue": "Mettre le message en file",
shared/locales/fr.json:185:  "conversation.composer.sendButton.steer": "Diriger le travail actif",
shared/locales/fr.json:188:  "conversation.composer.sendButton.queueTitle": "Mettre le message en file. {shortcut} dirige le travail actif.",
shared/locales/fr.json:189:  "conversation.composer.sendButton.steerTitle": "Diriger le travail actif. {shortcut} met le message en file.",
shared/locales/fr.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/fr.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/fr.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/fr.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/fr.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/fr.json:358:  "queued.message.interruptSendAria": "Interrompre et envoyer maintenant",
shared/locales/fr.json:359:  "queued.message.interruptSendTitle": "Arrêter le tour en cours et envoyer maintenant",
shared/locales/fr.json:362:  "queued.message.cancelAria": "Cancel queued message",
shared/locales/it.json:127:  "settings.runtime.steer": "Dirigi",
shared/locales/it.json:128:  "settings.runtime.queue": "Accoda",
shared/locales/it.json:184:  "conversation.composer.sendButton.queue": "Accoda messaggio",
shared/locales/it.json:185:  "conversation.composer.sendButton.steer": "Dirigi il lavoro attivo",
shared/locales/it.json:188:  "conversation.composer.sendButton.queueTitle": "Accoda messaggio. {shortcut} dirige il lavoro attivo.",
shared/locales/it.json:189:  "conversation.composer.sendButton.steerTitle": "Dirigi il lavoro attivo. {shortcut} accoda il messaggio.",
shared/locales/it.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/it.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/it.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/it.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/it.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/it.json:358:  "queued.message.interruptSendAria": "Interrompi e invia ora",
shared/locales/it.json:359:  "queued.message.interruptSendTitle": "Ferma il turno corrente e invia subito",
shared/locales/it.json:362:  "queued.message.cancelAria": "Cancel queued message",
shared/locales/en.json:157:  "settings.runtime.steer": "Steer",
shared/locales/en.json:158:  "settings.runtime.queue": "Queue",
shared/locales/en.json:162:  "settings.runtime.preserveQueuedMessages": "Preserve queued messages",
shared/locales/en.json:214:  "conversation.composer.sendButton.queue": "Queue message",
shared/locales/en.json:215:  "conversation.composer.sendButton.steer": "Steer active work",
shared/locales/en.json:218:  "conversation.composer.sendButton.queueTitle": "Queue message. {shortcut} steers active work.",
shared/locales/en.json:219:  "conversation.composer.sendButton.steerTitle": "Steer active work. {shortcut} queues the message.",
shared/locales/en.json:269:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/en.json:289:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/en.json:385:  "queued.message.drawerTitle": "Queued messages",
shared/locales/en.json:386:  "queued.message.editAria": "Edit queued message",
shared/locales/en.json:387:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/en.json:388:  "queued.message.interruptSendAria": "Interrupt and send now",
shared/locales/en.json:389:  "queued.message.interruptSendTitle": "Stop the current turn and send this now",
shared/locales/en.json:392:  "queued.message.cancelAria": "Cancel queued message",
shared/locales/pt.json:127:  "settings.runtime.steer": "Direcionar",
shared/locales/pt.json:128:  "settings.runtime.queue": "Enfileirar",
shared/locales/pt.json:184:  "conversation.composer.sendButton.queue": "Enfileirar mensagem",
shared/locales/pt.json:185:  "conversation.composer.sendButton.steer": "Direcionar trabalho ativo",
shared/locales/pt.json:188:  "conversation.composer.sendButton.queueTitle": "Enfileirar mensagem. {shortcut} direciona o trabalho ativo.",
shared/locales/pt.json:189:  "conversation.composer.sendButton.steerTitle": "Direcionar trabalho ativo. {shortcut} enfileira a mensagem.",
shared/locales/pt.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/pt.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/pt.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/pt.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/pt.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/pt.json:358:  "queued.message.interruptSendAria": "Interromper e enviar agora",
shared/locales/pt.json:359:  "queued.message.interruptSendTitle": "Parar o turno atual e enviar isto agora",
shared/locales/pt.json:362:  "queued.message.cancelAria": "Cancel queued message",
docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md:4:**Context:** OmniHarness queued steering, event snapshots, frontend snapshot cache
docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md:5:**Symptom:** A queued steering message delivered to the worker, but the UI kept showing it in the queued-message drawer, so the same user text appeared both in the worker stream and in the queue.
docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md:6:**Root Cause:** The server correctly omits delivered queue rows from `queuedMessages`, but `EventStreamSnapshotCacheManager` treated an authoritative server `queuedMessages: []` the same as missing data and restored stale cached pending queue rows.
docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md:8:**Verification:** `pnpm test tests/app/event-stream-state-manager.test.ts` covers stale cached queued rows being cleared by an empty server queue. `pnpm test tests/server/queued-messages.test.ts` confirms queued-message delivery behavior still passes.
docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md:9:**Prevention:** For server-owned arrays, do not use non-empty array checks as authority checks. Empty arrays can be terminal facts, especially for queues and filtered delivered state.
docs/superpowers/learnings/2026-06-15-input-ready-state-must-not-render-as-working.md:4:**Context:** OmniHarness direct worker permissions, elicitations, queue interruption, direct terminal activity, and execution status
docs/superpowers/learnings/2026-06-15-input-ready-state-must-not-render-as-working.md:5:**Symptom:** A worker showed a pending `switch_mode` permission request, the conversation still said `Working`, the direct terminal rendered its own `Working...` indicator, and a user reply stayed stuck in queued/delivering state.
docs/superpowers/learnings/2026-06-15-input-ready-state-must-not-render-as-working.md:6:**Root Cause:** The status and direct-terminal activity layers only trusted live metadata and ignored pending permission or elicitation entries already present in the worker stream. The shared worker-entry type also omitted the runtime's `elicitation` entry type. Interrupt delivery returned early when its worker turn generation became stale, which could leave the queued row in `delivering` if no newer delivery owner updated it.
docs/superpowers/learnings/2026-06-15-pending-elicitations-are-input-ready.md:4:**Context:** OmniHarness direct worker conversations, queued messages, and CLI elicitation rendering
docs/superpowers/learnings/2026-06-15-pending-elicitations-are-input-ready.md:5:**Symptom:** A Claude `AskUserQuestion` prompt rendered as a Bash command, the conversation still displayed as working, and the user's answer stayed queued behind the worker's `working` status.
docs/superpowers/learnings/2026-06-15-pending-elicitations-are-input-ready.md:6:**Root Cause:** The UI inferred tool kind from prompt/title text, so an input request mentioning terminal work became `bash`. The queue drain also treated worker `working` as always non-drainable and ignored the bridge's authoritative `pendingElicitations`, so answers were not delivered through `respondElicitation`.
docs/superpowers/learnings/2026-06-15-pending-elicitations-are-input-ready.md:7:**Fix:** Preserve `AskUserQuestion` as a generic tool activity, route main-composer answers for direct `awaiting_user` runs through `respondElicitation`, and let queue draining proceed when the live snapshot has a pending elicitation even if the worker state is still `working`.
shared/locales/ja.json:127:  "settings.runtime.steer": "誘導",
shared/locales/ja.json:128:  "settings.runtime.queue": "キュー",
shared/locales/ja.json:184:  "conversation.composer.sendButton.queue": "メッセージをキューに追加",
shared/locales/ja.json:185:  "conversation.composer.sendButton.steer": "進行中の作業を誘導",
shared/locales/ja.json:188:  "conversation.composer.sendButton.queueTitle": "メッセージをキューに追加します。{shortcut} で進行中の作業を誘導します。",
shared/locales/ja.json:189:  "conversation.composer.sendButton.steerTitle": "進行中の作業を誘導します。{shortcut} でメッセージをキューに追加します。",
shared/locales/ja.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/ja.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/ja.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/ja.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/ja.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/ja.json:358:  "queued.message.interruptSendAria": "中断して今すぐ送信",
shared/locales/ja.json:359:  "queued.message.interruptSendTitle": "現在のターンを止めて今すぐ送信します",
shared/locales/ja.json:362:  "queued.message.cancelAria": "Cancel queued message",
shared/locales/de.json:127:  "settings.runtime.steer": "Steuern",
shared/locales/de.json:128:  "settings.runtime.queue": "Einreihen",
shared/locales/de.json:184:  "conversation.composer.sendButton.queue": "Nachricht einreihen",
shared/locales/de.json:185:  "conversation.composer.sendButton.steer": "Aktive Arbeit steuern",
shared/locales/de.json:188:  "conversation.composer.sendButton.queueTitle": "Nachricht einreihen. {shortcut} steuert die aktive Arbeit.",
shared/locales/de.json:189:  "conversation.composer.sendButton.steerTitle": "Aktive Arbeit steuern. {shortcut} reiht die Nachricht ein.",
shared/locales/de.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/de.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/de.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/de.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/de.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/de.json:358:  "queued.message.interruptSendAria": "Unterbrechen und jetzt senden",
shared/locales/de.json:359:  "queued.message.interruptSendTitle": "Aktuellen Zug stoppen und dies jetzt senden",
shared/locales/de.json:362:  "queued.message.cancelAria": "Cancel queued message",
docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md:4:**Context:** OmniHarness queued steering, interrupt-and-send, frontend queue manager
docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md:5:**Symptom:** A force-sent queued message appeared in the worker stream as steered/delivered, but it remained visible in the queued-message drawer.
docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md:6:**Root Cause:** The server delivered the row and authoritative event snapshots correctly omitted it from `queuedMessages`, but the interrupt mutation returned a partial `status: "delivering"` queued row. When delivery completed quickly, the complete empty snapshot could arrive before the mutation success handler, and the older partial response reinserted the row into `BusyMessageQueueManager`.
docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md:7:**Fix:** `BusyMessageQueueManager` now records active queued-message ids that disappear from authoritative server snapshots. Later active upserts for those ids are ignored unless a new server snapshot includes the row again, while terminal mutation rows remove the item and clear pending action flags.
docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md:8:**Verification:** `./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts` passes and covers stale active mutation upserts after an empty server snapshot, server restoration of a genuinely pending row, and terminal mutation row removal.
docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md:9:**Prevention:** Treat mutation responses as partial and potentially stale. Complete server snapshots may erase active queue rows; older partial mutation responses must not be allowed to revive them without a newer authoritative server row.
docs/superpowers/learnings/2026-05-25-browser-route-and-queue-ownership.md:4:**Context:** OmniHarness frontend session routing and busy-message queue UI.
docs/superpowers/learnings/2026-05-25-browser-route-and-queue-ownership.md:5:**Symptom:** The visible session could jump during Next.js dev refresh, and queued messages from one session could appear while viewing another session.
docs/superpowers/learnings/2026-05-25-browser-route-and-queue-ownership.md:7:**Fix:** Parse the actual browser route before applying bootstrap selection or snapshot scope, and pass only selected-run queued messages into the composer/status surfaces. Added a queue-manager selected-run accessor for explicit ownership.
docs/superpowers/learnings/2026-05-25-browser-route-and-queue-ownership.md:8:**Verification:** `pnpm vitest run tests/app/home-utils.test.ts tests/app/busy-message-queue-manager.test.ts tests/app/home-ui-state-manager.test.ts tests/app/live-event-connection-manager.test.ts` passed with 61 tests. Full `pnpm exec tsc --noEmit` is still blocked by existing `tests/supervisor/protocol.test.ts` `ProcessEnv` fixture typing errors unrelated to this change.
docs/superpowers/learnings/2026-06-14-direct-conversation-title-generation.md:6:**Root Cause:** `shouldGenerateConversationTitle` treated `direct` mode like `commit` mode and skipped the title-generation queue entirely. The fallback title was persisted at run creation and no later title update was scheduled.
docs/superpowers/learnings/2026-06-14-direct-conversation-title-generation.md:7:**Fix:** Only commit conversations skip generated titles; direct conversations now queue the same background title generation as other user request modes.
docs/superpowers/learnings/2026-06-14-direct-conversation-title-generation.md:9:**Prevention:** Do not conflate direct-control worker ownership with disabled background metadata. If a mode persists a temporary fallback title, add behavioral coverage for whether the replacement title is queued.
shared/locales/zh-CN.json:127:  "settings.runtime.steer": "引导",
shared/locales/zh-CN.json:128:  "settings.runtime.queue": "排队",
shared/locales/zh-CN.json:184:  "conversation.composer.sendButton.queue": "将消息排队",
shared/locales/zh-CN.json:185:  "conversation.composer.sendButton.steer": "引导活动工作",
shared/locales/zh-CN.json:188:  "conversation.composer.sendButton.queueTitle": "将消息排队。{shortcut} 引导活动工作。",
shared/locales/zh-CN.json:189:  "conversation.composer.sendButton.steerTitle": "引导活动工作。{shortcut} 将消息排队。",
shared/locales/zh-CN.json:239:  "recovery.notice.title.queueBlocked": "Queued message blocked",
shared/locales/zh-CN.json:259:  "recovery.inspector.queuedMessage": "Queued message:",
shared/locales/zh-CN.json:355:  "queued.message.drawerTitle": "Queued messages",
shared/locales/zh-CN.json:356:  "queued.message.editAria": "Edit queued message",
shared/locales/zh-CN.json:357:  "queued.message.sendNowAria": "Send queued message now",
shared/locales/zh-CN.json:358:  "queued.message.interruptSendAria": "中断并立即发送",
shared/locales/zh-CN.json:359:  "queued.message.interruptSendTitle": "停止当前回合并立即发送",
shared/locales/zh-CN.json:362:  "queued.message.cancelAria": "Cancel queued message",
docs/superpowers/learnings/2026-05-26-optimistic-ui-needs-complete-sidebar-records.md:4:**Context:** OmniHarness home UI conversation creation and busy-message queue state.
docs/superpowers/learnings/2026-05-26-optimistic-ui-needs-complete-sidebar-records.md:5…43079 tokens truncated…eue manager is stale.
docs/architecture/direct-control-session-regressions.md:243:8. Mark the queue/message/run transition delivered or completed.
docs/architecture/direct-control-session-regressions.md:246:This applies to initial prompts, direct follow-ups, queued send-now, queued
docs/architecture/direct-control-session-regressions.md:252:`queuedConversationMessages` is UI state for pending work. The worker stream is
docs/architecture/direct-control-session-regressions.md:257:  ordinary queued item once a user message has been accepted into chat.
docs/architecture/direct-control-session-regressions.md:312:### Queued drawer represents queued work, not accepted work
docs/architecture/direct-control-session-regressions.md:324:Any change touching direct-control delivery, queued messages, worker stream
docs/architecture/direct-control-session-regressions.md:332:| Fast direct follow-up while worker active | message is queued or serialized explicitly, with visible pending state |
docs/architecture/direct-control-session-regressions.md:333:| Send-now queued direct message | user input is appended before assistant output, queue row becomes delivered, run becomes `done` or `awaiting_user` |
docs/architecture/direct-control-session-regressions.md:334:| Send-now accepted into chat | queued drawer hides the item immediately |
docs/architecture/direct-control-session-regressions.md:363:4. Can a queued item remain visible after it has been accepted into chat?
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md:7:**Architecture:** Keep the existing project/session sidebar rendering as the visual source of truth by extracting it into a reusable list component. Build two sidebar datasets in the home view model: the existing full project list and a derived active-only list with deterministic activity metadata from the existing event-stream snapshot, read markers, workers, agents, messages, queued messages, and live worker-entry cursor observations.
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md:105:  - Build `activeProjects` by calling the new pure helpers with `runs`, `messages`, effective read markers, `workers`, `agents`, `queuedMessages`, sidebar worker activity observations, and a render-time `nowMs` value.
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md:194:  - Server owns runs, workers, messages, queued messages, execution events, supervisor interventions, and read markers through the `/api/events` snapshot stream.
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md:244:- `queuedMessages`: user input state changes, using `createdAt`, `updatedAt`, and `deliveredAt`.
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md:255:2. Latest queued user input `deliveredAt`, `updatedAt`, or `createdAt`.
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md:280:  - Cover unread inclusion, working inclusion, recent user-message inclusion, recent queued user input inclusion, recent worker-output inclusion via live worker-entry observation, recent worker-output inclusion via audited `worker.updatedAt`, old read terminal exclusion, hidden empty projects, and deterministic ordering.
src/runtime/http/routes/runs.ts:30:  queuedConversationMessages,
src/runtime/http/routes/runs.ts:771:    await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
docs/superpowers/plans/2026-05-20-append-only-artifact-storage.md:44:- Moving core `runs`, `workers`, `messages`, `queued_conversation_messages`, `conversation_read_markers`, auth/session/settings/account tables, or small planner status rows out of SQLite.
docs/superpowers/plans/2026-05-20-append-only-artifact-storage.md:75:- `src/server/conversations/create.ts`, `src/server/conversations/send-message.ts`, `src/server/conversations/queued-messages.ts`, `src/server/runs/recovery-*`: switch execution-event writes to the adapter where events can carry large details.
docs/superpowers/plans/2026-05-20-append-only-artifact-storage.md:239:  - Avoid importing supervisor startup, provider registries, queue delivery, or bridge sync in persisted-only snapshots.
docs/superpowers/plans/2026-05-20-append-only-artifact-storage.md:295:  - queued message state,
docs/superpowers/plans/2026-05-14-planning-review-agents.md:433:- Starting a user message while review is running should either be blocked with a clear inline notice or queued only if existing planning busy behavior already supports it. For this milestone, block review start when the planner is already working and block planner user messages while `reviewing_plan`/`revising_plan` unless current busy queue logic safely supports them.
docs/architecture/session-provider-model.md:22:Providers advertise capabilities such as `send_input`, `stop`, `retry_from_message`, `edit_message`, `fork_session`, `queue_input`, and `use_git_workspace`.
docs/architecture/hot-path-responsiveness-and-resource-leaks.md:315:  serializing the request queue behind a hung local CLI;
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:35:### 1. Queued steering looked like it crossed conversations
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:43:- `14260d2a2df0` also showed an old queued item that had already been deleted,
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:44:  and the queue controls were no longer clickable.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:48:- The UI state for queued messages and active worker output was too easy to
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:50:- A queued row in `delivering` state was not cancelable through the same path
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:58:- Delivery must re-read persisted queue status before appending user input,
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:61:- A cancelled or missing queued row must never resurrect itself through a late
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:63:- A forced queued send must use one stable message id for the UI row, the
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:65:- The queued drawer may disable edit/send while delivering, but cancel must
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:70:- Cancelling a `delivering` queued message hides it and does not append it to
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:73:  queue row or the transcript entry.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:74:- Forcing queued send anchors the delivered user input to the same id the UI
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:204:  - `queued_conversation_messages`
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:384:4. Query `queued_conversation_messages` for the run. Check whether old rows are
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:409:- Every long async delivery path must re-read queue status around bridge calls.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:489:- Reading queued-message status once, then doing async bridge work without
docs/architecture/timing-determinism-audit.md:110:  run. A pending message or stop mutation for another run can no longer hide,
docs/architecture/timing-determinism-audit.md:487:- "latest queued message"
docs/architecture/timing-determinism-audit.md:507:- Handoff synthesis, queued-message selection/draining, recovery checkpoint
docs/architecture/timing-determinism-audit.md:731:- Busy-with-text composers may keep the send/queue/steer button, but they must
docs/architecture/timing-determinism-audit.md:752:  stoppable, while still allowing queue/steer sends. Exact manual stop text is
docs/architecture/timing-determinism-audit.md:948:### 23. FIFO queues need an order key, not random-id tie-breaking
docs/architecture/timing-determinism-audit.md:952:- `src/server/conversations/queued-messages.ts`
docs/architecture/timing-determinism-audit.md:953:- `tests/server/queued-messages.test.ts`
docs/architecture/timing-determinism-audit.md:955:Ordering queue records by `(createdAt, id)` is deterministic but not FIFO if
docs/architecture/timing-determinism-audit.md:957:The full test suite exposed this by draining `Second queued note` before
docs/architecture/timing-determinism-audit.md:958:`First queued note`.
docs/architecture/timing-determinism-audit.md:962:- User-visible FIFO queues need an insertion sequence or logical clock.
docs/architecture/timing-determinism-audit.md:963:- Drained messages should carry the queue record's owned order timestamp, not a
docs/architecture/timing-determinism-audit.md:971:- Drained checkpoint messages use the queue record's `createdAt`, preserving
docs/architecture/timing-determinism-audit.md:1163:- `HomeApp` scopes pending send, queued send, worker stop, and supervisor stop
src/app/home/useConversationExecutionStatus.ts:18:  queuedMessageCount: number;
src/app/home/useConversationExecutionStatus.ts:65:  queuedMessageCount,
src/app/home/useConversationExecutionStatus.ts:187:    if (queuedMessageCount > 0) {
src/app/home/useConversationExecutionStatus.ts:189:        label: queuedMessageCount === 1 ? "Queued follow-up" : "Queued follow-ups",
src/app/home/useConversationExecutionStatus.ts:190:        detail: `${queuedMessageCount} user ${queuedMessageCount === 1 ? "message is" : "messages are"} waiting for delivery.`,
src/app/home/useConversationExecutionStatus.ts:210:        label: "Retry queued",
src/app/home/useConversationExecutionStatus.ts:239:  }, [activeConversationAgents, awaitingUserQuestionMessage, completionEvent, erroredAgent, hasStuckWorker, isSelectedConversationLoaded, latestExecutionEvent, latestPromptDeferredEvent, latestStuckEvent, latestWaitEvent, liveThoughts, pendingElicitationAgent, pendingPermissionAgent, queuedMessageCount, selectedRun, showRecoverableRunningState]);
src/app/home/types.ts:17:// placeholder/steer behavior stays correct (planning | implementation | direct).
src/app/home/types.ts:28:  | "queue_input"
src/app/home/types.ts:129:  queuedMessage: QueuedConversationMessageRecord;
src/app/home/types.ts:140:  queuedMessageId?: string | null;
src/app/home/types.ts:197:  queuedMessageId?: string | null;
src/app/home/types.ts:355:  queuedMessages?: QueuedConversationMessageRecord[];
src/app/home/BusyMessageQueueManager.ts:8:  queuedMessages: QueuedConversationMessageRecord[];
src/app/home/BusyMessageQueueManager.ts:11:  // UI only — server queue rows from /api/events remain authoritative.
src/app/home/BusyMessageQueueManager.ts:18:  queuedMessages: [],
src/app/home/BusyMessageQueueManager.ts:37:      const newlyAbsentActiveIds = current.queuedMessages
src/app/home/BusyMessageQueueManager.ts:72:        queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
src/app/home/BusyMessageQueueManager.ts:85:    return this.getSnapshot().queuedMessages.filter((message) => message.runId === normalizedRunId);
src/app/home/BusyMessageQueueManager.ts:103:          queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
src/app/home/BusyMessageQueueManager.ts:111:      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
src/app/home/BusyMessageQueueManager.ts:115:          queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
src/app/home/BusyMessageQueueManager.ts:120:      const next = [...current.queuedMessages];
src/app/home/BusyMessageQueueManager.ts:124:        queuedMessages: next,
src/app/home/BusyMessageQueueManager.ts:165:        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
src/app/home/BusyMessageQueueManager.ts:184:      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
src/app/home/BusyMessageQueueManager.ts:185:      const queuedMessages = existingIndex === -1
src/app/home/BusyMessageQueueManager.ts:186:        ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
src/app/home/BusyMessageQueueManager.ts:187:        : current.queuedMessages.map((entry) => entry.id === message.id ? message : entry);
src/app/home/BusyMessageQueueManager.ts:189:        queuedMessages,
src/app/home/EventStreamStateManager.ts:179:  // queuedMessages/executionEvents are a strict subset of what we already
src/app/home/EventStreamStateManager.ts:182:  // whose filter is driven by messages+workers+agents+queuedMessages).
src/app/home/EventStreamStateManager.ts:214: * workers metadata, supervisor messages, planning artifacts, queued
src/app/home/ComposerContainer.tsx:65:  queuedMessages: QueuedConversationMessageRecord[];
src/app/home/ComposerContainer.tsx:104:  queuedMessages,
src/app/home/ComposerContainer.tsx:157:    forceSteer: selectedConversationMode === "implementation",
src/app/home/ComposerContainer.tsx:229:      queuedMessages={queuedMessages}
src/app/home/recovery-utils.ts:16:  if (state.kind === "queue_blocked") return "recovery.notice.title.queueBlocked";
src/app/home/useHomeMutations.ts:862:        queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
src/app/home/useHomeMutations.ts:884:      if (data.queuedMessage) {
src/app/home/useHomeMutations.ts:885:        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
src/app/home/HomeUiStateManager.ts:23:  queuedMessages: [],
src/app/home/sidebar-activity.ts:78:  queuedMessages: QueuedMessageInput[];
src/app/home/sidebar-activity.ts:87:  queuedMessages: QueuedMessageInput[],
src/app/home/sidebar-activity.ts:98:  for (const qm of queuedMessages) {
src/app/home/sidebar-activity.ts:111:  const userInputAt = getLatestUserInputAt(args.run.id, args.messages, args.queuedMessages);
src/app/home/sidebar-activity.ts:212:  queuedMessages: QueuedMessageInput[];
src/app/home/sidebar-activity.ts:219:  const { groups, messages, readMarkers, workers, agents, queuedMessages, workerOutputObservedAtByRunId, nowMs, selectedRunId } = args;
src/app/home/sidebar-activity.ts:239:        queuedMessages,
src/app/home/utils.ts:72:    queuedMessages: (current.queuedMessages || []).filter((item) => item.runId !== runId),
src/app/home/utils.ts:195:  pendingMessages: Map<string, MessageRecord>,
src/app/home/utils.ts:197:  if (pendingMessages.size === 0) {
src/app/home/utils.ts:205:  for (const [messageId, message] of Array.from(pendingMessages.entries())) {
src/app/home/utils.ts:207:      pendingMessages.delete(messageId);
src/app/home/utils.ts:213:      pendingMessages.delete(messageId);
src/app/home/utils.ts:1161:    return `Waiting to steer ${formatConversationWorkerLabel(event.workerId)}; worker is busy.`;
src/app/home/busy-message-behavior.ts:1:export type BusyMessageAction = "queue" | "steer";
src/app/home/busy-message-behavior.ts:3:export type BusyComposerSubmitAction = "send_normal" | "send_queue" | "send_steer" | "stop";
src/app/home/busy-message-behavior.ts:13:  return value === "steer" ? "steer" : "queue";
src/app/home/busy-message-behavior.ts:26:  forceSteer,
src/app/home/busy-message-behavior.ts:32:  forceSteer?: boolean;
src/app/home/busy-message-behavior.ts:44:    return busyMessageAction === "steer" || forceSteer
src/app/home/busy-message-behavior.ts:47:          submitAction: "send_steer",
src/app/home/busy-message-behavior.ts:48:          ariaLabelKey: "conversation.composer.sendButton.steer",
src/app/home/busy-message-behavior.ts:49:          allowAlternateBusyAction: !forceSteer,
src/app/home/busy-message-behavior.ts:53:          submitAction: "send_queue",
src/app/home/busy-message-behavior.ts:54:          ariaLabelKey: "conversation.composer.sendButton.queue",
src/app/home/busy-message-behavior.ts:71:  if (submitAction === "send_queue") {
src/app/home/busy-message-behavior.ts:72:    return options.useAlternate ? "steer" : "queue";
src/app/home/busy-message-behavior.ts:75:  if (submitAction === "send_steer") {
src/app/home/busy-message-behavior.ts:76:    return options.useAlternate ? "queue" : "steer";
src/app/home/upload-attachments.ts:8: * Shared by the conversation-send and queued-message mutation hooks.
src/app/home/useQueuedMessageMutations.ts:21:  queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
src/app/home/useQueuedMessageMutations.ts:38:    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<{ ok: true }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
src/app/home/useQueuedMessageMutations.ts:42:      action: "Cancel queued message",
src/app/home/useQueuedMessageMutations.ts:45:      const previousQueuedMessage = busyMessageQueueManager.getSnapshot().queuedMessages.find((message) => message.id === messageId) ?? null;
src/app/home/useQueuedMessageMutations.ts:60:    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<QueuedMessageMutationResponse>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
src/app/home/useQueuedMessageMutations.ts:64:      action: "Send queued message now",
src/app/home/useQueuedMessageMutations.ts:82:      if (data.message && data.queuedMessage?.status === "delivering") {
src/app/home/useQueuedMessageMutations.ts:87:      if (data.queuedMessage && (data.queuedMessage.status === "pending" || data.queuedMessage.status === "delivering")) {
src/app/home/useQueuedMessageMutations.ts:88:        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
src/app/home/useQueuedMessageMutations.ts:101:  // selected queued message (or a busy-composer draft) immediately.
src/app/home/useQueuedMessageMutations.ts:114:        return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/${variables.messageId}/interrupt`, {
src/app/home/useQueuedMessageMutations.ts:118:          action: "Interrupt and send queued message",
src/app/home/useQueuedMessageMutations.ts:125:      return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/interrupt-next`, {
src/app/home/useQueuedMessageMutations.ts:133:        action: "Interrupt and send queued message",
src/app/home/useQueuedMessageMutations.ts:147:      if (data.queuedMessage) {
src/app/home/useQueuedMessageMutations.ts:148:        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
src/app/home/useAppErrors.ts:91:        action: "Cancel queued message",
src/app/home/HomeApp.tsx:186:  if (bootstrap.initialEventState?.queuedMessages) {
src/app/home/HomeApp.tsx:187:    busyMessageQueueManager.setQueuedMessages(bootstrap.initialEventState.queuedMessages, notify);
src/app/home/HomeApp.tsx:398:    () => busyMessageQueueState.queuedMessages.filter((message) => message.runId === selectedRunId),
src/app/home/HomeApp.tsx:399:    [busyMessageQueueState.queuedMessages, selectedRunId],
src/app/home/HomeApp.tsx:422:    const reconcile = (s: EventStreamState) => { busyMessageQueueManager.setQueuedMessages(s.queuedMessages || []); return s; };
src/app/home/HomeApp.tsx:959:    queuedMessageCount: selectedQueuedMessages.filter(
src/app/home/HomeApp.tsx:1115:      queuedMessages={selectedQueuedMessages}
src/app/home/composer-keyboard.ts:50: * a busy turn plus draft/queued intent to deliver.
src/app/home/EventStreamSnapshotCacheManager.ts:123:      queuedMessages: preferInitialArray(initialState.queuedMessages, cachedState.queuedMessages, arrayMergeOptions),
src/app/home/constants.ts:118:  BUSY_MESSAGE_ACTION: "queue",
src/app/home/useHomeViewModel.ts:180:      queuedMessages: (state.queuedMessages || []) as Array<{ runId: string; createdAt: string; updatedAt: string; deliveredAt?: string | null }>,
src/app/home/useHomeViewModel.ts:187:  }, [groupedProjects, state.messages, state.workers, state.agents, state.queuedMessages, readMarkers, searchQuery, selectedRunId]);

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:15.835Z","phase":null} -->
## Tool result: call_u9D3dXZ553yB8oKwdtHcjkC9 · 2026-06-16T21:40:15.835Z

```text
Chunk ID: 83cbf6
Wall time: 0.0132 seconds
Process exited with code 0
Original token count: 1024
Output:
 M eslint.config.mjs
 M pnpm-workspace.yaml
 M scripts/agent-runtime.ts
 M shared/locales/de.json
 M shared/locales/en.json
 M shared/locales/es.json
 M shared/locales/fr.json
 M shared/locales/it.json
 M shared/locales/ja.json
 M shared/locales/ko.json
 M shared/locales/pt.json
 M shared/locales/zh-CN.json
 M src/app/home/ConversationTranscriptManager.ts
 M src/app/home/HomeApp.tsx
 M src/app/home/HomeUiStateManager.ts
 M src/app/home/direct-control-activity.ts
 M src/app/home/useComposerController.ts
 M src/app/home/useConversationActions.ts
 M src/app/home/useConversationExecutionStatus.ts
 M src/app/home/useHomeMutations.ts
 M src/app/home/useHomeViewModel.ts
 M src/app/home/utils.ts
 M src/components/Terminal.tsx
 M src/components/home/ConversationMain.tsx
 M src/components/home/ConversationSidebar.tsx
 M src/components/home/HomeHeader.tsx
 M src/lib/agent-output.ts
 M src/lib/run-status.ts
 M src/runtime/http/routes/conversation-transcript.ts
 M src/runtime/http/routes/planning.ts
 M src/runtime/http/routes/runs.ts
 M src/server/agent-runtime/codex.ts
 M src/server/agent-runtime/http.ts
 M src/server/agent-runtime/manager.ts
 M src/server/agent-runtime/output-store.ts
 M src/server/agent-runtime/tool-env.ts
 M src/server/agent-runtime/types.ts
 M src/server/cli/options.ts
 M src/server/cli/runner.ts
 M src/server/conversations/create.ts
 M src/server/conversations/direct-run-status.ts
 M src/server/conversations/modes.ts
 M src/server/conversations/queued-message-interrupt.ts
 M src/server/events/named-events.ts
 M src/server/git/run-auto-commit.ts
 M src/server/omni-acp/agent.ts
 M src/server/planning/promote.ts
 M src/server/planning/review.ts
 M src/server/runs/persisted-zombie-reconciler.ts
 M src/server/runs/status.ts
 M src/server/supervisor/context-window.ts
 M src/server/supervisor/context.ts
 M src/server/supervisor/index.ts
 M src/server/supervisor/observer.ts
 M src/server/supervisor/runtime-watchdog.ts
 M src/server/workers/entries-types.ts
 M src/server/workers/live-snapshots.ts
 D src/server/workers/orchestrator.ts
 M tests/api/conversation-messages-route.test.ts
 M tests/api/conversations-route.test.ts
 M tests/api/run-route.test.ts
 M tests/app/conversation-execution-status.test.ts
 M tests/app/direct-control-activity.test.ts
 M tests/conversations/direct-run-status.test.ts
 M tests/lib/agent-output.test.ts
 M tests/server/agent-runtime/http.test.ts
 M tests/server/runs/persisted-zombie-reconciler.test.ts
 M tests/supervisor/observer.test.ts
 M tests/ui/conversation-actions.test.ts
 M tests/ui/sidebar-layout.test.ts
?? docs/superpowers/learnings/2026-06-14-capped-transcript-cursors-must-track-consumed-rows.md
?? docs/superpowers/learnings/2026-06-14-current-schema-version-must-still-run-additive-guards.md
?? docs/superpowers/learnings/2026-06-14-direct-conversation-title-generation.md
?? docs/superpowers/learnings/2026-06-14-direct-runs-auto-commit.md
?? docs/superpowers/learnings/2026-06-14-full-access-elicitations-must-wait-for-user.md
?? docs/superpowers/learnings/2026-06-15-composer-draft-updates-must-be-atomic.md
?? docs/superpowers/learnings/2026-06-15-input-ready-state-must-not-render-as-working.md
?? docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md
?? docs/superpowers/learnings/2026-06-15-pending-elicitations-are-input-ready.md
?? docs/superpowers/learnings/2026-06-15-project-moves-must-not-authorize-worker-resume.md
?? docs/superpowers/learnings/2026-06-15-run-scoped-transcripts-must-tail-load.md
?? docs/superpowers/plans/2026-06-14-escape-interrupt-queued-message.md
?? docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
?? docs/superpowers/plans/2026-06-14-visual-improve-mode.md
?? scripts/install-restarter.sh
?? src/app/api/agents/[name]/elicitation/
?? src/lib/plan-path.ts
?? src/server/planning/transition.ts
?? tests/api/conversation-transcript-route.test.ts
?? tests/app/conversation-transcript-manager.test.ts
?? tests/server/agent-runtime/manager-permission-mode.test.ts
?? tests/server/git/run-auto-commit.test.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:40:26.025Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:40:26.025Z

The repo already has a prior learning that looks painfully close: stale partial queue mutation responses reviving hidden rows. I’m checking whether this session is the same failure mode or a different one, because the DB will tell us whether the row is actually still pending/delivering or only the client drawer resurrected it.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:26.034Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:26.034Z

```json
{
  "cmd": "sqlite3 sqlite.db \".tables\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:26.034Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:26.034Z

```json
{
  "cmd": "sqlite3 sqlite.db \"select id, status, mode, created_at, updated_at, project_path from runs where id like '5eb40b0d5030%';\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:26.140Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:26.140Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/BusyMessageQueueManager.ts && sed -n '1,220p' src/app/home/useQueuedMessageMutations.ts && sed -n '1,260p' src/server/conversations/queued-message-interrupt.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:26.193Z","phase":null} -->
## Tool result: call_zFpf1S3nqtRH3FhDUFI6lKps · 2026-06-16T21:40:26.193Z

```text
Chunk ID: 0a7fc0
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 192
Output:
accounts                      planning_review_rounds      
artifact_streams              planning_review_runs        
auth_events                   plans                       
auth_pair_tokens              process_sessions            
auth_sessions                 queued_conversation_messages
clarifications                recovery_incidents          
conversation_read_markers     runs                        
credit_events                 settings                    
execution_events              supervisor_interventions    
messages                      supervisor_scheduled_wakes  
notification_subscriptions    worker_assignments          
plan_items                    worker_counters             
planning_review_findings      workers                     

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:26.193Z","phase":null} -->
## Tool result: call_XHxpWuSAWaUtsUeBqUNWopV7 · 2026-06-16T21:40:26.193Z

```text
Chunk ID: ec9b24
Wall time: 0.0001 seconds
Process exited with code 0
Original token count: 20
Output:
5eb40b0d5030|done|direct|1781531776|1781646004|/Users/masterman/NLP/evergreen

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:26.204Z","phase":null} -->
## Tool result: call_fAmQWAJakUJjVeipMTWzInUO · 2026-06-16T21:40:26.204Z

```text
Chunk ID: c2c9f6
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 5672
Output:
"use client";

import { StateManager } from "@/lib/state-manager";
import type { QueuedConversationMessageRecord } from "./types";
import { compareOldestByCreatedAtThenId } from "./utils";

type BusyMessageQueueState = {
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingMessageIds: Set<string>;
  // Rows the user has asked to interrupt-and-send ("force send"). Optimistic
  // UI only — server queue rows from /api/events remain authoritative.
  interruptingMessageIds: Set<string>;
  locallyHiddenMessageIds: Set<string>;
  serverAbsentMessageIds: Set<string>;
};

const initialBusyMessageQueueState: BusyMessageQueueState = {
  queuedMessages: [],
  cancellingMessageIds: new Set(),
  interruptingMessageIds: new Set(),
  locallyHiddenMessageIds: new Set(),
  serverAbsentMessageIds: new Set(),
};

function isActiveQueuedMessage(message: QueuedConversationMessageRecord) {
  return message.status === "pending" || message.status === "delivering";
}

export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
  constructor() {
    super(initialBusyMessageQueueState);
  }

  setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
    this.update((current) => {
      const incomingIds = new Set(messages.map((message) => message.id));
      const newlyAbsentActiveIds = current.queuedMessages
        .filter((message) => isActiveQueuedMessage(message) && !incomingIds.has(message.id))
        .map((message) => message.id);
      // Server rows are authoritative: clear optimistic interrupt/cancel flags
      // for any row that has left a pending/delivering state.
      const settledIds = new Set(
        [
          ...messages
            .filter((message) => !isActiveQueuedMessage(message))
            .map((message) => message.id),
          ...newlyAbsentActiveIds,
        ],
      );
      const clearSettled = (ids: Set<string>) => {
        if (settledIds.size === 0) {
          return ids;
        }
        let changed = false;
        const next = new Set(ids);
        for (const id of settledIds) {
          if (next.delete(id)) {
            changed = true;
          }
        }
        return changed ? next : ids;
      };
      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
      for (const id of newlyAbsentActiveIds) {
        serverAbsentMessageIds.add(id);
      }
      for (const id of incomingIds) {
        serverAbsentMessageIds.delete(id);
      }
      return {
        ...current,
        queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
        cancellingMessageIds: clearSettled(current.cancellingMessageIds),
        interruptingMessageIds: clearSettled(current.interruptingMessageIds),
        serverAbsentMessageIds,
      };
    }, notify);
  }

  getQueuedMessagesForRun(runId: string | null | undefined) {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return [];
    }
    return this.getSnapshot().queuedMessages.filter((message) => message.runId === normalizedRunId);
  }

  upsertQueuedMessage(message: QueuedConversationMessageRecord) {
    this.update((current) => {
      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
      if (isActiveQueuedMessage(message) && serverAbsentMessageIds.has(message.id)) {
        return current;
      }

      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const interruptingMessageIds = new Set(current.interruptingMessageIds);
      if (!isActiveQueuedMessage(message)) {
        cancellingMessageIds.delete(message.id);
        interruptingMessageIds.delete(message.id);
        serverAbsentMessageIds.add(message.id);
        return {
          ...current,
          queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
          cancellingMessageIds,
          interruptingMessageIds,
          serverAbsentMessageIds,
        };
      }

      serverAbsentMessageIds.delete(message.id);
      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
      if (existingIndex === -1) {
        return {
          ...current,
          queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
          serverAbsentMessageIds,
        };
      }

      const next = [...current.queuedMessages];
      next[existingIndex] = message;
      return {
        ...current,
        queuedMessages: next,
        serverAbsentMessageIds,
      };
    });
  }

  markCancelling(messageId: string) {
    this.setKey("cancellingMessageIds", (current) => new Set([...current, messageId]));
  }

  unmarkCancelling(messageId: string) {
    this.setKey("cancellingMessageIds", (current) => {
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }

  markInterrupting(messageId: string) {
    this.setKey("interruptingMessageIds", (current) => new Set([...current, messageId]));
  }

  unmarkInterrupting(messageId: string) {
    this.setKey("interruptingMessageIds", (current) => {
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }

  hideQueuedMessage(messageId: string) {
    this.patch((current) => {
      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const interruptingMessageIds = new Set(current.interruptingMessageIds);
      const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
      cancellingMessageIds.delete(messageId);
      interruptingMessageIds.delete(messageId);
      locallyHiddenMessageIds.add(messageId);
      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
      serverAbsentMessageIds.add(messageId);
      return {
        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
        cancellingMessageIds,
        interruptingMessageIds,
        locallyHiddenMessageIds,
        serverAbsentMessageIds,
      };
    });
  }

  restoreQueuedMessage(message: QueuedConversationMessageRecord) {
    this.patch((current) => {
      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const interruptingMessageIds = new Set(current.interruptingMessageIds);
      const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
      cancellingMessageIds.delete(message.id);
      interruptingMessageIds.delete(message.id);
      locallyHiddenMessageIds.delete(message.id);
      serverAbsentMessageIds.delete(message.id);
      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
      const queuedMessages = existingIndex === -1
        ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
        : current.queuedMessages.map((entry) => entry.id === message.id ? message : entry);
      return {
        queuedMessages,
        cancellingMessageIds,
        interruptingMessageIds,
        locallyHiddenMessageIds,
        serverAbsentMessageIds,
      };
    });
  }
}

export const busyMessageQueueManager = new BusyMessageQueueManager();
"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { requestJson } from "@/lib/app-errors";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { uploadPendingChatAttachments } from "./upload-attachments";
import { appendSentConversationMessageSnapshot } from "./utils";
import { ownsConversationSideEffects } from "./useHomeMutations";
import type {
  EventStreamState,
  MessageRecord,
  QueuedMessageInterruptResponse,
} from "./types";

type QueuedMessageMutationResponse = {
  ok: true;
  message?: MessageRecord;
  queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
};

export interface UseQueuedMessageMutationsParams {
  setState: React.Dispatch<React.SetStateAction<EventStreamState>>;
  pendingSentConversationMessagesRef: React.RefObject<Map<string, MessageRecord>>;
  scrollConversationToBottom: () => void;
}

export function useQueuedMessageMutations({
  setState,
  pendingSentConversationMessagesRef,
  scrollConversationToBottom,
}: UseQueuedMessageMutationsParams) {
  const { setCommand, clearAttachments } = homeUiSetters;

  const cancelQueuedMessage = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<{ ok: true }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
      method: "DELETE",
    }, {
      source: "Conversations",
      action: "Cancel queued message",
    }),
    onMutate: ({ messageId }) => {
      const previousQueuedMessage = busyMessageQueueManager.getSnapshot().queuedMessages.find((message) => message.id === messageId) ?? null;
      busyMessageQueueManager.markCancelling(messageId);
      busyMessageQueueManager.hideQueuedMessage(messageId);
      return { previousQueuedMessage };
    },
    onError: (_error, variables, context) => {
      if (context?.previousQueuedMessage) {
        busyMessageQueueManager.restoreQueuedMessage(context.previousQueuedMessage);
        return;
      }
      busyMessageQueueManager.unmarkCancelling(variables.messageId);
    },
  });

  const sendQueuedMessageNow = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<QueuedMessageMutationResponse>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
      method: "PATCH",
    }, {
      source: "Conversations",
      action: "Send queued message now",
    }),
    onMutate: ({ messageId }) => {
      busyMessageQueueManager.markCancelling(messageId);
    },
    onSuccess: (data, variables) => {
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      });
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
        setState((current) => appendSentConversationMessageSnapshot(current, data.message));
        if (ownsSideEffects) {
          scrollConversationToBottom();
        }
      }

      if (data.message && data.queuedMessage?.status === "delivering") {
        busyMessageQueueManager.hideQueuedMessage(variables.messageId);
        return;
      }

      if (data.queuedMessage && (data.queuedMessage.status === "pending" || data.queuedMessage.status === "delivering")) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
        busyMessageQueueManager.unmarkCancelling(variables.messageId);
        return;
      }

      busyMessageQueueManager.hideQueuedMessage(variables.messageId);
    },
    onError: (_error, variables) => {
      busyMessageQueueManager.unmarkCancelling(variables.messageId);
    },
  });

  // Force-send / Escape interrupt: cancel the active turn and deliver the
  // selected queued message (or a busy-composer draft) immediately.
  const interruptQueuedMessage = useMutation({
    onMutate: (variables: { runId: string; messageId?: string; draft?: { content: string; attachments: PendingChatAttachment[] } }) => {
      if (variables.messageId) {
        busyMessageQueueManager.markInterrupting(variables.messageId);
      }
      return {
        commandAtStart: homeUiStateManager.getSnapshot().command,
        attachmentsAtStart: homeUiStateManager.getSnapshot().attachments,
      };
    },
    mutationFn: async (variables: { runId: string; messageId?: string; draft?: { content: string; attachments: PendingChatAttachment[] } }) => {
      if (variables.messageId) {
        return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/${variables.messageId}/interrupt`, {
          method: "POST",
        }, {
          source: "Conversations",
          action: "Interrupt and send queued message",
        });
      }

      const uploadedAttachments = variables.draft
        ? await uploadPendingChatAttachments(variables.draft.attachments)
        : [];
      return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/interrupt-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables.draft
          ? { content: variables.draft.content, attachments: uploadedAttachments }
          : {}),
      }, {
        source: "Conversations",
        action: "Interrupt and send queued message",
      });
    },
    onSuccess: (data, variables, context) => {
      const snapshot = homeUiStateManager.getSnapshot();
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });

      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
        setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      }
      if (data.queuedMessage) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
      }
      if (variables.messageId) {
        busyMessageQueueManager.unmarkInterrupting(variables.messageId);
      }

      // Owner-token check before clearing the composer: only clear the draft we
      // submitted, and only if the user has not switched runs or edited it.
      if (variables.draft && ownsSideEffects && context
        && snapshot.command === context.commandAtStart
        && snapshot.attachments === context.attachmentsAtStart) {
        setCommand("");
        clearAttachments();
      }

      if (ownsSideEffects) {
        scrollConversationToBottom();
      }
    },
    onError: (_error, variables) => {
      if (variables.messageId) {
        busyMessageQueueManager.unmarkInterrupting(variables.messageId);
      }
    },
  });

  return {
    cancelQueuedMessage,
    sendQueuedMessageNow,
    interruptQueuedMessage,
  };
}
import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { askAgent, cancelAgentTurn } from "@/server/bridge-client";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { appendAttachmentContext, normalizeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { getAppDataPath } from "@/server/app-root";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { persistRunFailure } from "@/server/runs/failures";
import { serializeMessageRecord } from "./message-records";
import { serializeQueuedConversationMessage } from "./queued-message-records";
import {
  createQueuedConversationMessage,
  errorMessage,
  getLatestRunWorker,
  isAgentBusyError,
  isAgentNotFoundError,
  isCancelledWorkerStatus,
  isEmptyQueuedWorkerOutputError,
  persistDeliveredWorkerResponse,
} from "./queued-messages";
import {
  advanceWorkerTurnGeneration,
  isWorkerTurnGenerationCurrent,
  runWorkerTurn,
  trackConversationBackgroundTask,
} from "./worker-turn-gate";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;
type QueuedRecord = typeof queuedConversationMessages.$inferSelect;

export type InterruptSource = "escape" | "drawer" | "api";

export interface InterruptResult {
  ok: true;
  message?: ReturnType<typeof serializeMessageRecord>;
  queuedMessage: ReturnType<typeof serializeQueuedConversationMessage>;
  interruption: {
    status: "delivering" | "deferred";
    workerId: string;
    cancelDurationMs: number;
  };
}

function refusal(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

async function queuedRowStatus(messageId: string) {
  const record = await db
    .select({ status: queuedConversationMessages.status })
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();
  return record?.status ?? null;
}

function timestampMs(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = new Date(value ?? 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadRun(runId: string): Promise<RunRecord> {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw refusal(404, "Conversation not found");
  }
  return run;
}

async function loadQueuedRecord(runId: string, messageId: string): Promise<QueuedRecord> {
  const record = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();
  if (!record || record.runId !== runId) {
    throw refusal(404, "Queued message not found");
  }
  if (record.status === "delivered") {
    throw refusal(409, "Queued message was already delivered");
  }
  if (record.status === "cancelled") {
    throw refusal(409, "Queued message was cancelled");
  }
  return record;
}

async function selectOldestPendingRecord(runId: string): Promise<QueuedRecord> {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
  const pending = records.find((record) => record.status === "pending");
  if (!pending) {
    emitNamedEvent({
      kind: "queue.interrupt_refused",
      runId,
      workerId: null,
      queuedMessageId: null,
      reason: "no_user_intent",
      source: "escape",
    });
    throw refusal(409, "No queued message to interrupt");
  }
  return pending;
}

async function resolveInterruptWorker(run: RunRecord, record: QueuedRecord): Promise<WorkerRecord | null> {
  const targetWorker = record.targetWorkerId
    ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
    : null;
  if (targetWorker && targetWorker.runId === run.id && !isCancelledWorkerStatus(targetWorker.status)) {
    return targetWorker;
  }
  const latest = await getLatestRunWorker(run.id, record.targetWorkerId);
  if (latest && latest.runId === run.id && !isCancelledWorkerStatus(latest.status)) {
    return latest;
  }
  return null;
}

/**
 * Core control-plane flow shared by every interrupt entry point:
 * cancel the active turn, advance the worker turn fence into a delivery-safe
 * state, then deliver exactly one queued user message through the unified
 * worker stream. Emits named + execution events for every decision.
 */
async function interruptAndDeliver(args: {
  run: RunRecord;
  record: QueuedRecord;
  source: InterruptSource;
}): Promise<InterruptResult> {
  const { run, record, source } = args;
  const runId = run.id;
  const requestedAt = Date.now();

  emitNamedEvent({
    kind: "queue.interrupt_requested",
    runId,
    workerId: record.targetWorkerId ?? null,
    queuedMessageId: record.id,
    source,
  });
  await recordExecutionEvent({
    runId,
    workerId: record.targetWorkerId ?? null,
    eventType: "queued_message_interrupt_requested",
    details: {
      summary: "User requested an interrupt-and-send for a queued message.",
      queuedMessageId: record.id,
      source,
    },
  });

  const worker = await resolveInterruptWorker(run, record);
  if (!worker) {
    emitNamedEvent({
      kind: "queue.interrupt_refused",
      runId,
      workerId: record.targetWorkerId ?? null,
      queuedMessageId: record.id,
      reason: "worker_missing",
      source,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "queue.interrupt.refused",
      message: "No active worker is available to interrupt.",
      surface: "toast",
      runId,
    });
    throw refusal(409, "No active worker is available to interrupt");
  }

  // Cancel the current worker turn (and any pending permissions).
  const cancelStartedAt = Date.now();
  try {
    await cancelAgentTurn(worker.id);
  } catch (error) {
    emitNamedEvent({
      kind: "queue.interrupt_delivery_failed",
      runId,
      workerId: worker.id,
      queuedMessageId: record.id,
      reason: "cancel_failed",
      deferred: false,
      totalInterruptLatencyMs: Date.now() - requestedAt,
      source,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "queue.interrupt.cancel_failed",
      message: `Could not interrupt the active turn: ${errorMessage(error)}`,
      surface: "toast",
      runId,
      workerId: worker.id,
    });
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_interrupt_failed",
      details: {
        summary: `Failed to cancel the active turn for ${worker.id}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
    // Keep the queued row pending so user intent is not lost.
    notifyEventStreamSubscribers();
    throw refusal(502, `Could not interrupt the active turn: ${errorMessage(error)}`);
  }
  const cancelDurationMs = Date.now() - cancelStartedAt;

  // Advance the fence and reset persisted worker state into a delivery-safe
  // shape in one mutation so immediate delivery cannot observe stale `working`.
  const cancelledAt = new Date();
  const generation = await advanceWorkerTurnGeneration(worker.id, {
    status: "idle",
    clearCurrentText: true,
    updatedAt: cancelledAt,
  });

  emitNamedEvent({
    kind: "queue.interrupt_cancelled_turn",
    runId,
    workerId: worker.id,
    queuedMessageId: record.id,
    cancelDurationMs,
    source,
  });
  await recordExecutionEvent({
    runId,
    workerId: worker.id,
    eventType: "queued_message_turn_cancelled",
    details: {
      summary: `Interrupted the active turn for ${worker.id}.`,
      queuedMessageId: record.id,
      cancelDurationMs,
      source,
    },
  });

  // Mark the row delivering and move the run back into an active state.
  const startedAt = new Date();
  await db.update(queuedConversationMessages).set({
    action: "steer",
    targetWorkerId: worker.id,
    status: "delivering",
    lastError: null,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:36.060Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:36.060Z

```json
{
  "cmd": "sed -n '260,620p' src/server/conversations/queued-message-interrupt.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:36.067Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:36.067Z

```json
{
  "cmd": "sed -n '1,300p' tests/app/busy-message-queue-manager.test.ts && sed -n '1,360p' tests/server/queued-messages.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:36.574Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:36.574Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, run_id, status, action, target_worker_id, created_at, updated_at, delivered_at, cancelled_at, substr(content,1,120) as content, last_error from queued_conversation_messages where run_id='5eb40b0d5030' order by created_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:36.617Z","phase":null} -->
## Tool result: call_kdlMtk4xeXQnbPWB7bGt8j30 · 2026-06-16T21:40:36.617Z

```text
Chunk ID: fead54
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2697
Output:
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(queuedConversationMessages.id, record.id));
  await db.update(runs).set({
    status: run.mode === "planning" ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(runs.id, runId));

  emitNamedEvent({
    kind: "queue.interrupt_delivery_started",
    runId,
    workerId: worker.id,
    queuedMessageId: record.id,
    totalInterruptLatencyMs: Date.now() - requestedAt,
    source,
  });
  notifyEventStreamSubscribers();

  const normalizedAttachments = normalizeChatAttachments(
    record.attachmentsJson ? JSON.parse(record.attachmentsJson) : [],
  );
  const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
    resolvePath: (storagePath) => getAppDataPath(storagePath),
  });

  const userMessage = {
    id: record.id,
    runId,
    role: "user" as const,
    kind: "checkpoint" as const,
    content: record.content,
    attachmentsJson: record.attachmentsJson,
    createdAt: startedAt,
  };

  trackConversationBackgroundTask(
    deliverInterruptedQueuedMessage({
      run,
      worker,
      record,
      userMessage,
      workerContent,
      attachments: normalizedAttachments,
      generation,
      source,
      requestedAt,
    }).catch((error) => {
      console.error("Queued message interrupt delivery failed:", error);
    }),
  );

  return {
    ok: true,
    message: serializeMessageRecord(userMessage),
    queuedMessage: serializeQueuedConversationMessage({
      ...record,
      action: "steer",
      targetWorkerId: worker.id,
      status: "delivering",
      lastError: null,
      updatedAt: startedAt,
      deliveredAt: null,
    }),
    interruption: {
      status: "delivering",
      workerId: worker.id,
      cancelDurationMs,
    },
  };
}

async function deliverInterruptedQueuedMessage(args: {
  run: RunRecord;
  worker: WorkerRecord;
  record: QueuedRecord;
  userMessage: {
    id: string;
    runId: string;
    role: "user";
    kind: "checkpoint";
    content: string;
    attachmentsJson: string | null;
    createdAt: Date;
  };
  workerContent: string;
  attachments: ChatAttachment[];
  generation: number;
  source: InterruptSource;
  requestedAt: number;
}) {
  const { run, worker, record, userMessage, workerContent, attachments, generation, source, requestedAt } = args;
  const runId = run.id;

  // A stale terminal write must never overwrite a newer interrupt delivery or a
  // row the user cancelled mid-flight. Every terminal mutation re-checks both.
  const isStillCurrent = async () => {
    if (await queuedRowStatus(record.id) !== "delivering") {
      return false;
    }
    return isWorkerTurnGenerationCurrent(worker.id, generation);
  };

  try {
    await runWorkerTurn(worker.id, async () => {
      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      await db.update(workers).set({
        status: "working",
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));

      const deliveredAt = new Date();
      await appendUserInputOnDelivery({
        id: userMessage.id,
        runId,
        workerId: worker.id,
        text: record.content,
        deliveredAt,
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
        })),
      });
      await db.insert(messages).values(userMessage);
      notifyEventStreamSubscribers();

      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      const response = await askAgent(worker.id, workerContent);
      const finishedAt = new Date();

      // Before any terminal persistence, confirm a newer interrupt has not
      // superseded this delivery and the row was not cancelled.
      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      await persistDeliveredWorkerResponse({
        run: { id: runId, mode: run.mode },
        workerId: worker.id,
        response,
        deliveredAt: finishedAt,
        userInputEntryId: userMessage.id,
      });

      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      await db.update(queuedConversationMessages).set({
        status: "delivered",
        lastError: null,
        updatedAt: finishedAt,
        deliveredAt: finishedAt,
      }).where(eq(queuedConversationMessages.id, record.id));
      await recordExecutionEvent({
        runId,
        workerId: worker.id,
        eventType: "queued_message_interrupt_delivered",
        details: {
          summary: `Delivered interrupted queued message to ${worker.id}.`,
          queuedMessageId: record.id,
          source,
        },
      });
      emitNamedEvent({
        kind: "queue.interrupt_delivery_finished",
        runId,
        workerId: worker.id,
        queuedMessageId: record.id,
        totalInterruptLatencyMs: Date.now() - requestedAt,
        source,
      });
      notifyEventStreamSubscribers();
    });
  } catch (error) {
    await handleInterruptDeliveryError({ run, worker, record, userMessage, error, generation, source, requestedAt });
  }
}

async function handleInterruptDeliveryError(args: {
  run: RunRecord;
  worker: WorkerRecord;
  record: QueuedRecord;
  userMessage: { id: string; createdAt: Date };
  error: unknown;
  generation: number;
  source: InterruptSource;
  requestedAt: number;
}) {
  const { run, worker, record, userMessage, error, generation, source, requestedAt } = args;
  const runId = run.id;
  const failedAt = new Date();

  // A late failure from an interrupted (older) turn or a row the user cancelled
  // must not flip queue state.
  if (await queuedRowStatus(record.id) !== "delivering") {
    notifyEventStreamSubscribers();
    return;
  }
  if (!(await isWorkerTurnGenerationCurrent(worker.id, generation))) {
    const currentRecord = await db
      .select({ updatedAt: queuedConversationMessages.updatedAt })
      .from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, record.id))
      .get();
    if (timestampMs(currentRecord?.updatedAt) > timestampMs(userMessage.createdAt)) {
      notifyEventStreamSubscribers();
      return;
    }
  }

  const busy = isAgentBusyError(error);
  await db.update(queuedConversationMessages).set({
    status: busy ? "pending" : "failed",
    lastError: errorMessage(error),
    updatedAt: failedAt,
  }).where(eq(queuedConversationMessages.id, record.id));

  if (isEmptyQueuedWorkerOutputError(error)) {
    await db.update(workers).set({
      status: "error",
      outputLog: error.message,
      updatedAt: failedAt,
    }).where(eq(workers.id, worker.id));
    if (run.mode === "direct" || run.mode === "commit") {
      await persistRunFailure(runId, error, {
        surface: { code: "worker.idle.empty_output", workerId: worker.id },
      });
    }
  }

  if (busy) {
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_interrupt_deferred",
      details: {
        summary: `Worker ${worker.id} was still busy after cancel; queued message kept pending.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
  } else {
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_interrupt_failed",
      details: {
        summary: `Interrupt delivery failed for ${worker.id}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "queue.interrupt.delivery_failed",
      message: `Interrupt delivery failed: ${errorMessage(error)}`,
      surface: "toast",
      runId,
      workerId: worker.id,
    });
  }

  emitNamedEvent({
    kind: "queue.interrupt_delivery_failed",
    runId,
    workerId: worker.id,
    queuedMessageId: record.id,
    reason: busy ? "busy_after_cancel" : "delivery_failed",
    deferred: busy,
    totalInterruptLatencyMs: Date.now() - requestedAt,
    source,
  });

  if (isAgentNotFoundError(error)) {
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_recovery_blocked",
      details: {
        summary: `Queued message ${record.id} is blocked because ${worker.id} is missing.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
    await reconcileRunRecovery({
      runId,
      liveAgents: [],
      source: "queued-message-interrupt",
    });
  }

  // A busy delivery already removed nothing; non-recoverable failures keep the
  // appended worker-stream input for audit. Drop the duplicate checkpoint
  // message row only when we deferred so a later retry re-appends cleanly.
  if (busy) {
    await db.delete(messages).where(eq(messages.id, userMessage.id));
  }

  notifyEventStreamSubscribers();
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export async function interruptAndSendQueuedConversationMessageNow(params: {
  runId: string;
  messageId: string;
  source?: InterruptSource;
}): Promise<InterruptResult> {
  const run = await loadRun(params.runId);
  const record = await loadQueuedRecord(params.runId, params.messageId);
  return interruptAndDeliver({ run, record, source: params.source ?? "drawer" });
}

export async function interruptAndSendNextQueuedConversationMessage(params: {
  runId: string;
  source?: InterruptSource;
}): Promise<InterruptResult> {
  const run = await loadRun(params.runId);
  const record = await selectOldestPendingRecord(params.runId);
  return interruptAndDeliver({ run, record, source: params.source ?? "escape" });
}

export async function interruptWithDraftMessage(params: {
  runId: string;
  content: string;
  attachments?: ChatAttachment[];
  targetWorkerId?: string | null;
  source?: InterruptSource;
}): Promise<InterruptResult> {
  const run = await loadRun(params.runId);
  const trimmed = params.content.trim();
  const normalizedAttachments = normalizeChatAttachments(params.attachments ?? []);
  if (!trimmed && normalizedAttachments.length === 0) {
    emitNamedEvent({
      kind: "queue.interrupt_refused",
      runId: params.runId,
      workerId: params.targetWorkerId ?? null,
      queuedMessageId: null,
      reason: "no_user_intent",
      source: params.source ?? "escape",
    });
    throw refusal(400, "Message content or attachment is required");

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:36.618Z","phase":null} -->
## Tool result: call_7JnP3f4sAeoLeXBXi2Ug0cvR · 2026-06-16T21:40:36.618Z

```text
Chunk ID: 98a3fb
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4183
Output:
import { describe, expect, it } from "vitest";
import { BusyMessageQueueManager } from "@/app/home/BusyMessageQueueManager";
import type { QueuedConversationMessageRecord } from "@/app/home/types";

function buildQueuedMessage(overrides: Partial<QueuedConversationMessageRecord>): QueuedConversationMessageRecord {
  return {
    id: "queued-1",
    runId: "run-1",
    action: "queue",
    content: "queued text",
    status: "pending",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("BusyMessageQueueManager", () => {
  it("returns queued messages only for the selected run", () => {
    const manager = new BusyMessageQueueManager();
    manager.setQueuedMessages([
      buildQueuedMessage({ id: "run-a-queued", runId: "run-a" }),
      buildQueuedMessage({ id: "run-b-queued", runId: "run-b" }),
    ], false);

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["run-a-queued"]);
    expect(manager.getQueuedMessagesForRun("run-b").map((message) => message.id)).toEqual(["run-b-queued"]);
    expect(manager.getQueuedMessagesForRun(null)).toEqual([]);
  });

  it("keeps locally hidden queued messages hidden across stale server snapshots", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({ id: "queued-editing", runId: "run-a" });

    manager.setQueuedMessages([queuedMessage], false);
    manager.hideQueuedMessage("queued-editing");
    manager.setQueuedMessages([queuedMessage], false);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);

    manager.restoreQueuedMessage(queuedMessage);

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["queued-editing"]);
  });

  it("does not revive an active row after an authoritative server snapshot removes it", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-interrupted",
      runId: "run-a",
      status: "delivering",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.setQueuedMessages([], false);
    manager.upsertQueuedMessage(queuedMessage);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });

  it("allows a server snapshot to restore a row that became pending again", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-deferred",
      runId: "run-a",
      status: "delivering",
    });
    const pendingAgain = buildQueuedMessage({
      ...queuedMessage,
      status: "pending",
      lastError: "Worker is busy",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.setQueuedMessages([], false);
    manager.setQueuedMessages([pendingAgain], false);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([pendingAgain]);
  });

  it("removes terminal rows supplied by a mutation response", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-delivered",
      runId: "run-a",
      status: "delivering",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.upsertQueuedMessage({
      ...queuedMessage,
      status: "delivered",
      deliveredAt: "2026-05-25T00:00:01.000Z",
    });

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });
});
import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

const { mockAskAgent, mockGetAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Worker received the queued note.",
    state: "idle",
  }),
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
}));

import {
  cancelQueuedConversationMessage,
  createQueuedConversationMessage,
  drainQueuedImplementationMessages,
  drainQueuedWorkerMessages,
  sendQueuedConversationMessageNow,
} from "@/server/conversations/queued-messages";
import { __resetWorkerTurnChainsForTests } from "@/server/conversations/worker-turn-gate";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function waitFor<T>(read: () => T | Promise<T>, predicate: (value: T) => boolean, timeoutMs = 1_000) {
  const startedAt = Date.now();
  let latest = await read();

  while (!predicate(latest)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for expected state. Last value: ${JSON.stringify(latest)}`);
    }

    await delay(10);
    latest = await read();
  }

  return latest;
}

async function createRun(mode: "implementation" | "planning" | "direct" = "implementation") {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: "docs/superpowers/plans/example.md",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode,
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return runId;
}

describe("queued conversation messages", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockAskAgent.mockResolvedValue({
      response: "Worker received the queued note.",
      state: "idle",
    });
    mockGetAgent.mockReset();
    mockGetAgent.mockResolvedValue({
      name: "worker",
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      outputEntries: [],
      renderedOutput: null,
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });
    __resetWorkerTurnChainsForTests();
    __resetOutputStoreCachesForTests();
    await db.delete(executionEvents);
    await db.delete(supervisorInterventions);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("creates and cancels pending queue entries without deleting audit rows", async () => {
    const runId = await createRun();
    const queued = await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "Remember to update the tests.",
      attachments: [],
    });

    await cancelQueuedConversationMessage({ runId, messageId: queued.id });

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored).toMatchObject({
      runId,
      content: "Remember to update the tests.",
      status: "cancelled",
    });
  });

  it("cancels delivering queue entries so stale send-now rows can be dismissed", async () => {
    const runId = await createRun();
    const queued = await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "This send-now row got stuck delivering.",
      attachments: [],
    });
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, queued.id));

    const cancelled = await cancelQueuedConversationMessage({ runId, messageId: queued.id });

    expect(cancelled).toMatchObject({
      id: queued.id,
      status: "cancelled",
    });
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored).toMatchObject({
      runId,
      status: "cancelled",
    });
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_cancelled")).toBe(true);
  });

  it("cancels failed queue entries so visible audit rows can be dismissed", async () => {
    const runId = await createRun("direct");
    const queued = await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "This queued row already failed.",
      attachments: [],
    });
    await db.update(queuedConversationMessages).set({
      status: "failed",
      lastError: "Agent stopped without producing output. Final state: idle.",
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, queued.id));

    const cancelled = await cancelQueuedConversationMessage({ runId, messageId: queued.id });

    expect(cancelled).toMatchObject({
      id: queued.id,
      status: "cancelled",
      lastError: "Agent stopped without producing output. Final state: idle.",
    });
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored).toMatchObject({
      runId,
      status: "cancelled",
      lastError: "Agent stopped without producing output. Final state: idle.",
    });
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_cancelled")).toBe(true);
  });

  it("drains implementation queue entries into user checkpoint messages in FIFO order", async () => {
    const runId = await createRun("implementation");
    await createQueuedConversationMessage({ runId, action: "queue", content: "First queued note", attachments: [] });
    await createQueuedConversationMessage({ runId, action: "queue", content: "Second queued note", attachments: [] });

    const drained = await drainQueuedImplementationMessages(runId);

    expect(drained).toBe(2);
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    expect(storedMessages.map((message) => message.content)).toEqual(["First queued note", "Second queued note"]);
    expect(storedMessages.every((message) => message.kind === "checkpoint")).toBe(true);

    const remainingPending = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.status, "pending"));
    expect(remainingPending).toHaveLength(0);
  });

  it("drains implementation steering to the active worker instead of only the supervisor transcript", async () => {
    const runId = await createRun("implementation");
    const workerId = `${runId}-worker-1`;
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "Spawn sub-agents when the work can be split safely.",
      attachments: [],
    });

    const drained = await drainQueuedImplementationMessages(runId);

    expect(drained).toBe(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Spawn sub-agents when the work can be split safely.");
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    expect(storedQueued).toMatchObject({
      status: "delivered",
      action: "steer",
    });
    const interventions = await db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    expect(interventions).toHaveLength(1);
    expect(interventions[0]).toMatchObject({
      workerId,
      prompt: "Spawn sub-agents when the work can be split safely.",
    });
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    // Worker response now lives in the unified worker stream — only
    // user + supervisor narration remain in the `messages` table.
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "supervisor"]);
    expect(storedMessages[1]?.content).toContain("sent that to worker 1");
  });

  it("keeps implementation steering pending when the active worker is still busy", async () => {
    const runId = await createRun("implementation");
    const workerId = `${runId}-worker-1`;
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "Use parallel agents once the schema work is split.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const drained = await drainQueuedImplementationMessages(runId);

    expect(drained).toBe(0);
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    expect(storedQueued).toMatchObject({
      status: "pending",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
    });
    expect(storedQueued?.deliveredAt).toBeNull();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedMessages).toHaveLength(0);
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_deferred")).toBe(true);
  });

  it("drains worker queue entries through askAgent and records delivery output", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Queued worker note", attachments: [] });

    const drained = await drainQueuedWorkerMessages({ runId, workerId });

    expect(drained).toBe(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Queued worker note");
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    // Worker response now lives in the unified worker stream.
    expect(storedMessages.map((message) => message.role)).toEqual(["user"]);
    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "user_input",
        text: "Queued worker note",
      }),
      expect.objectContaining({
        type: "message",
        text: "Worker received the queued note.",
      }),
    ]));
    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(storedRun).toMatchObject({ status: "done" });
  });

  it("keeps direct worker queue messages out of the conversation until delivery succeeds", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Please handle this once free.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const drained = await drainQueuedWorkerMessages({ runId, workerId });

    expect(drained).toBe(0);
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:36.634Z","phase":null} -->
## Tool result: call_LKoriciencTJ1BJdVJ4YaPr4 · 2026-06-16T21:40:36.634Z

```text
Chunk ID: 2587f5
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 46
Output:
Error: in prepare, no such column: cancelled_at
  _worker_id, created_at, updated_at, delivered_at, cancelled_at, substr(content
                                      error here ---^

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:40:47.943Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:40:47.943Z

The first query confirms the run itself is `done`. My queued-message query hit a schema mismatch (`cancelled_at` isn’t a column here), so I’m re-reading the actual queue row shape instead of assuming the schema.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:47.947Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:47.947Z

```json
{
  "cmd": "sqlite3 sqlite.db \"pragma table_info(queued_conversation_messages);\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:47.947Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:47.947Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, run_id, status, action, target_worker_id, created_at, updated_at, delivered_at, substr(content,1,160) as content, last_error from queued_conversation_messages where run_id='5eb40b0d5030' order by created_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:47.964Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:47.964Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, run_id, worker_id, role, kind, created_at, substr(content,1,160) as content from messages where run_id='5eb40b0d5030' order by created_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:48.089Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:48.089Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, run_id, status, type, created_at, updated_at, substr(current_text,1,120) as current_text, substr(last_text,1,120) as last_text from workers where run_id='5eb40b0d5030' order by created_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:48.142Z","phase":null} -->
## Tool result: call_GXoopeRESaWl1H5Ic2MpNdaC · 2026-06-16T21:40:48.142Z

```text
Chunk ID: 91a91e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 64
Output:
0|id|TEXT|1||1
1|run_id|TEXT|1||0
2|target_worker_id|TEXT|0||0
3|action|TEXT|1||0
4|content|TEXT|1||0
5|attachments_json|TEXT|0||0
6|status|TEXT|1||0
7|last_error|TEXT|0||0
8|created_at|INTEGER|1||0
9|updated_at|INTEGER|1||0
10|delivered_at|INTEGER|0||0

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:48.142Z","phase":null} -->
## Tool result: call_ZuKFTqvvCSMDnqNd4o14zSnZ · 2026-06-16T21:40:48.142Z

```text
Chunk ID: 676882
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 217
Output:
id                                    run_id        status     action  target_worker_id       created_at  updated_at  delivered_at  content                                                                   last_error
------------------------------------  ------------  ---------  ------  ---------------------  ----------  ----------  ------------  ------------------------------------------------------------------------  ----------
1f633077-ed5c-4884-bd93-79cfc35651cd  5eb40b0d5030  delivered  steer   5eb40b0d5030-worker-1  1781641581  1781641684  1781641684    remove the .dev subdomain, wont work through cloudflare                             
8318d43e-7ad8-47dd-800d-58c0bc1d94b7  5eb40b0d5030  delivered  steer   5eb40b0d5030-worker-1  1781642788  1781645954  1781645954    also the "cloud" storage of cloudcaptions will go on that external drive            

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:48.142Z","phase":null} -->
## Tool result: call_2SK80AfReNuoGG78f7zpeG0k · 2026-06-16T21:40:48.142Z

```text
Chunk ID: 73db1c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1465
Output:
id                                    run_id        worker_id  role  kind        created_at  content                                                                                                                                                         
------------------------------------  ------------  ---------  ----  ----------  ----------  ----------------------------------------------------------------------------------------------------------------------------------------------------------------
b33f752a-515d-4caf-8ce2-9c215d0db702  5eb40b0d5030             user  checkpoint  1781531776  use @devops/rag1_ssh.sh to connect to the server and tell me what is running there. Mostly serving subdomains of aiminions.xyz - we want to bring those apps to 

9cfb03bb-1032-4ab2-83a5-d9e7c65bd0ec  5eb40b0d5030             user  checkpoint  1781533565  We should be able to bring everything locally. Only question really is how to get our cloudflare tunnel config on this machine right                            
                                                                                                                                                                                                                                                             
                                                                                             Check what we're currentl                                                                                                                                       

f18ff77d-f0e6-405c-b5e3-3ef5c0dccd60  5eb40b0d5030             user  checkpoint  1781557820  let's install locally all the ones that are currently working. get the code from the repos if it's not locally here already. They'll all be under github/danduma

1f2a76d2-3731-4a71-950f-3e1ba6825553  5eb40b0d5030             user  checkpoint  1781606074  pretty sure the tunnels should be on launch agent, pls check. And if not, yes, we need to make them relaunch at restart. We'll simply bring in what we can for n

49bd676b-a382-4d5c-8817-b4c0049f153a  5eb40b0d5030             user  checkpoint  1781641388  yes browser login                                                                                                                                               

1f633077-ed5c-4884-bd93-79cfc35651cd  5eb40b0d5030             user  checkpoint  1781641589  remove the .dev subdomain, wont work through cloudflare                                                                                                         

645fa299-abcb-48f9-8429-06d457761d45  5eb40b0d5030             user  checkpoint  1781641853  wait so we can't have a single cloudflare certificate for multiple cloudflare domains???? we gotta choose??                                                     

6988ef16-6943-4196-802a-ce3512c2e06a  5eb40b0d5030             user  checkpoint  1781642116  write it somewhere so we can reuse it in the future                                                                                                             
                                                                                                                                                                                                                                                             
                                                                                             curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \                                                                                                
                                                                                             -H "Authorization: Bearer [REDACTED]                                                                                                                      

2934df94-b5dc-4c66-9d07-7bac68329a42  5eb40b0d5030             user  checkpoint  1781642652  on the apps we're gonna run here, trendintel should store its data in the newly added external drive Lexar                                                      

e1ba587c-dc72-44eb-aa67-f2000d01cb46  5eb40b0d5030             user  checkpoint  1781643139  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

6dea2ca5-7c08-4d8a-85ef-b04d39095471  5eb40b0d5030             user  checkpoint  1781644403  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

90c7287f-1b7b-467f-9bb4-dd8b9c3e65d4  5eb40b0d5030             user  checkpoint  1781645172  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

d67b0906-bdda-4df1-ad9b-514ca998cb32  5eb40b0d5030             user  checkpoint  1781645217  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

5abc7899-7d0e-4b2b-90df-ec4f8ee48f9c  5eb40b0d5030             user  checkpoint  1781645565  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

fc4782fa-d0d9-4163-a56f-5bf837b2db25  5eb40b0d5030             user  checkpoint  1781645900  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

4a4e9861-ace8-40c4-9b39-1495e64ffa8c  5eb40b0d5030             user  checkpoint  1781645954  also the "cloud" storage of cloudcaptions will go on that external drive                                                                                        

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:48.142Z","phase":null} -->
## Tool result: call_YxVNQ1fPe0UzoNdVFA95dBEn · 2026-06-16T21:40:48.142Z

```text
Chunk ID: c30058
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 159
Output:
id                     run_id        status  type    created_at  updated_at  current_text  last_text                                                                                                               
---------------------  ------------  ------  ------  ----------  ----------  ------------  ------------------------------------------------------------------------------------------------------------------------
5eb40b0d5030-worker-1  5eb40b0d5030  idle    claude  1781531776  1781645954                I'll stop trying to stand up MinIO and just record this as a firm requirement (the storage is currently disabled with no

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:40:58.750Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:40:58.750Z

For this session, SQLite says both queued rows are already `delivered`; there are no `pending` or `delivering` rows left in `queued_conversation_messages`. That means the “still there” thing is very likely the frontend queue manager/snapshot path, not the database keeping the intent alive.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:58.753Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:58.753Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, event_type, worker_id, created_at, substr(details_json,1,400) as details from execution_events where run_id='5eb40b0d5030' and (event_type like '%queued%' or event_type like '%interrupt%') order by created_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:58.753Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:58.753Z

```json
{
  "cmd": "rg -n \"queuedMessages|queued_conversation_messages|queuedConversationMessages|serializeQueuedConversationMessage\" src/server src/runtime src/app -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:40:58.882Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:40:58.882Z

```json
{
  "cmd": "sed -n '130,230p' src/app/home/EventStreamStateManager.ts && sed -n '100,150p' src/app/home/EventStreamSnapshotCacheManager.ts && sed -n '400,440p' src/app/home/HomeApp.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:58.932Z","phase":null} -->
## Tool result: call_fip3FTVXqblzQI0kErPQRbKI · 2026-06-16T21:40:58.932Z

```text
Chunk ID: d4a569
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 46
Output:
Error: in prepare, no such column: details_json
  ect id, event_type, worker_id, created_at, substr(details_json,1,400) as detai
                                      error here ---^

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:58.932Z","phase":null} -->
## Tool result: call_pmvoGSIi6sXdVSAT1NrzMQ9Q · 2026-06-16T21:40:58.932Z

```text
Chunk ID: e94c82
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 5188
Output:
src/app/home/BusyMessageQueueManager.ts:8:  queuedMessages: QueuedConversationMessageRecord[];
src/app/home/BusyMessageQueueManager.ts:18:  queuedMessages: [],
src/app/home/BusyMessageQueueManager.ts:37:      const newlyAbsentActiveIds = current.queuedMessages
src/app/home/BusyMessageQueueManager.ts:72:        queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
src/app/home/BusyMessageQueueManager.ts:85:    return this.getSnapshot().queuedMessages.filter((message) => message.runId === normalizedRunId);
src/app/home/BusyMessageQueueManager.ts:103:          queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
src/app/home/BusyMessageQueueManager.ts:111:      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
src/app/home/BusyMessageQueueManager.ts:115:          queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
src/app/home/BusyMessageQueueManager.ts:120:      const next = [...current.queuedMessages];
src/app/home/BusyMessageQueueManager.ts:124:        queuedMessages: next,
src/app/home/BusyMessageQueueManager.ts:165:        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
src/app/home/BusyMessageQueueManager.ts:184:      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
src/app/home/BusyMessageQueueManager.ts:185:      const queuedMessages = existingIndex === -1
src/app/home/BusyMessageQueueManager.ts:186:        ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
src/app/home/BusyMessageQueueManager.ts:187:        : current.queuedMessages.map((entry) => entry.id === message.id ? message : entry);
src/app/home/BusyMessageQueueManager.ts:189:        queuedMessages,
src/app/home/ComposerContainer.tsx:65:  queuedMessages: QueuedConversationMessageRecord[];
src/app/home/ComposerContainer.tsx:104:  queuedMessages,
src/app/home/ComposerContainer.tsx:229:      queuedMessages={queuedMessages}
src/app/home/types.ts:355:  queuedMessages?: QueuedConversationMessageRecord[];
src/app/home/useHomeMutations.ts:862:        queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
src/app/home/sidebar-activity.ts:78:  queuedMessages: QueuedMessageInput[];
src/app/home/sidebar-activity.ts:87:  queuedMessages: QueuedMessageInput[],
src/app/home/sidebar-activity.ts:98:  for (const qm of queuedMessages) {
src/app/home/sidebar-activity.ts:111:  const userInputAt = getLatestUserInputAt(args.run.id, args.messages, args.queuedMessages);
src/app/home/sidebar-activity.ts:212:  queuedMessages: QueuedMessageInput[];
src/app/home/sidebar-activity.ts:219:  const { groups, messages, readMarkers, workers, agents, queuedMessages, workerOutputObservedAtByRunId, nowMs, selectedRunId } = args;
src/app/home/sidebar-activity.ts:239:        queuedMessages,
src/app/home/EventStreamStateManager.ts:179:  // queuedMessages/executionEvents are a strict subset of what we already
src/app/home/EventStreamStateManager.ts:182:  // whose filter is driven by messages+workers+agents+queuedMessages).
src/app/home/HomeUiStateManager.ts:23:  queuedMessages: [],
src/app/home/utils.ts:72:    queuedMessages: (current.queuedMessages || []).filter((item) => item.runId !== runId),
src/app/home/EventStreamSnapshotCacheManager.ts:123:      queuedMessages: preferInitialArray(initialState.queuedMessages, cachedState.queuedMessages, arrayMergeOptions),
src/runtime/http/routes/events.ts:2:import { messages, plans, runs, accounts, workers, planItems, clarifications, queuedConversationMessages, recoveryIncidents, planningReviewRuns, planningReviewRounds, processSessions, conversationReadMarkers } from "@/server/db/schema";
src/runtime/http/routes/events.ts:22:import { serializeQueuedConversationMessage } from "@/server/conversations/queued-message-records";
src/runtime/http/routes/events.ts:150:      ? db.select().from(queuedConversationMessages)
src/runtime/http/routes/events.ts:152:          eq(queuedConversationMessages.runId, selectedRunId),
src/runtime/http/routes/events.ts:153:          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
src/runtime/http/routes/events.ts:155:        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
src/runtime/http/routes/events.ts:492:    queuedMessages: records.allQueuedMessages
src/runtime/http/routes/events.ts:494:      .map(serializeQueuedConversationMessage),
src/runtime/http/routes/runs.ts:30:  queuedConversationMessages,
src/runtime/http/routes/runs.ts:771:    await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
src/app/home/useQueuedMessageMutations.ts:21:  queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
src/app/home/useQueuedMessageMutations.ts:45:      const previousQueuedMessage = busyMessageQueueManager.getSnapshot().queuedMessages.find((message) => message.id === messageId) ?? null;
src/app/home/HomeApp.tsx:186:  if (bootstrap.initialEventState?.queuedMessages) {
src/app/home/HomeApp.tsx:187:    busyMessageQueueManager.setQueuedMessages(bootstrap.initialEventState.queuedMessages, notify);
src/app/home/HomeApp.tsx:398:    () => busyMessageQueueState.queuedMessages.filter((message) => message.runId === selectedRunId),
src/app/home/HomeApp.tsx:399:    [busyMessageQueueState.queuedMessages, selectedRunId],
src/app/home/HomeApp.tsx:422:    const reconcile = (s: EventStreamState) => { busyMessageQueueManager.setQueuedMessages(s.queuedMessages || []); return s; };
src/app/home/HomeApp.tsx:1115:      queuedMessages={selectedQueuedMessages}
src/app/home/useHomeViewModel.ts:180:      queuedMessages: (state.queuedMessages || []) as Array<{ runId: string; createdAt: string; updatedAt: string; deliveredAt?: string | null }>,
src/app/home/useHomeViewModel.ts:187:  }, [groupedProjects, state.messages, state.workers, state.agents, state.queuedMessages, readMarkers, searchQuery, selectedRunId]);
src/server/events/persisted-snapshot.ts:9:  queuedConversationMessages,
src/server/events/persisted-snapshot.ts:212:function serializeQueuedConversationMessage(record: typeof queuedConversationMessages.$inferSelect) {
src/server/events/persisted-snapshot.ts:282:      ? db.select().from(queuedConversationMessages)
src/server/events/persisted-snapshot.ts:284:          eq(queuedConversationMessages.runId, selectedRunId),
src/server/events/persisted-snapshot.ts:285:          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
src/server/events/persisted-snapshot.ts:287:        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
src/server/events/persisted-snapshot.ts:350:    queuedMessages: allQueuedMessages
src/server/events/persisted-snapshot.ts:352:      .map(serializeQueuedConversationMessage),
src/server/conversations/queued-message-interrupt.ts:5:import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
src/server/conversations/queued-message-interrupt.ts:15:import { serializeQueuedConversationMessage } from "./queued-message-records";
src/server/conversations/queued-message-interrupt.ts:35:type QueuedRecord = typeof queuedConversationMessages.$inferSelect;
src/server/conversations/queued-message-interrupt.ts:42:  queuedMessage: ReturnType<typeof serializeQueuedConversationMessage>;
src/server/conversations/queued-message-interrupt.ts:56:    .select({ status: queuedConversationMessages.status })
src/server/conversations/queued-message-interrupt.ts:57:    .from(queuedConversationMessages)
src/server/conversations/queued-message-interrupt.ts:58:    .where(eq(queuedConversationMessages.id, messageId))
src/server/conversations/queued-message-interrupt.ts:82:    .from(queuedConversationMessages)
src/server/conversations/queued-message-interrupt.ts:83:    .where(eq(queuedConversationMessages.id, messageId))
src/server/conversations/queued-message-interrupt.ts:100:    .from(queuedConversationMessages)
src/server/conversations/queued-message-interrupt.ts:101:    .where(eq(queuedConversationMessages.runId, runId))
src/server/conversations/queued-message-interrupt.ts:102:    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
src/server/conversations/queued-message-interrupt.ts:256:  await db.update(queuedConversationMessages).set({
src/server/conversations/queued-message-interrupt.ts:262:  }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-message-interrupt.ts:316:    queuedMessage: serializeQueuedConversationMessage({
src/server/conversations/queued-message-interrupt.ts:421:      await db.update(queuedConversationMessages).set({
src/server/conversations/queued-message-interrupt.ts:426:      }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-message-interrupt.ts:474:      .select({ updatedAt: queuedConversationMessages.updatedAt })
src/server/conversations/queued-message-interrupt.ts:475:      .from(queuedConversationMessages)
src/server/conversations/queued-message-interrupt.ts:476:      .where(eq(queuedConversationMessages.id, record.id))
src/server/conversations/queued-message-interrupt.ts:485:  await db.update(queuedConversationMessages).set({
src/server/conversations/queued-message-interrupt.ts:489:  }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-message-records.ts:2:import type { queuedConversationMessages } from "@/server/db/schema";
src/server/conversations/queued-message-records.ts:7:type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;
src/server/conversations/queued-message-records.ts:9:export function serializeQueuedConversationMessage(record: QueuedConversationMessageRecord) {
src/server/conversations/sync.ts:3:import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
src/server/conversations/sync.ts:216:  const records = await db.select({ id: queuedConversationMessages.id })
src/server/conversations/sync.ts:217:    .from(queuedConversationMessages)
src/server/conversations/sync.ts:219:      eq(queuedConversationMessages.runId, runId),
src/server/conversations/sync.ts:220:      eq(queuedConversationMessages.targetWorkerId, workerId),
src/server/conversations/sync.ts:221:      eq(queuedConversationMessages.status, "pending"),
src/server/conversations/queued-messages.ts:5:import { messages, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
src/server/conversations/queued-messages.ts:23:  serializeQueuedConversationMessage,
src/server/conversations/queued-messages.ts:29:type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;
src/server/conversations/queued-messages.ts:76:    .select({ createdAt: queuedConversationMessages.createdAt })
src/server/conversations/queued-messages.ts:77:    .from(queuedConversationMessages)
src/server/conversations/queued-messages.ts:78:    .where(eq(queuedConversationMessages.runId, runId))
src/server/conversations/queued-messages.ts:79:    .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
src/server/conversations/queued-messages.ts:95:    .select({ status: queuedConversationMessages.status })
src/server/conversations/queued-messages.ts:96:    .from(queuedConversationMessages)
src/server/conversations/queued-messages.ts:97:    .where(eq(queuedConversationMessages.id, messageId))
src/server/conversations/queued-messages.ts:314:    .from(queuedConversationMessages)
src/server/conversations/queued-messages.ts:315:    .where(eq(queuedConversationMessages.runId, runId))
src/server/conversations/queued-messages.ts:316:    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
src/server/conversations/queued-messages.ts:320:    .map(serializeQueuedConversationMessage);
src/server/conversations/queued-messages.ts:357:  await db.insert(queuedConversationMessages).values(record);
src/server/conversations/queued-messages.ts:364:  return serializeQueuedConversationMessage(record);
src/server/conversations/queued-messages.ts:376:    .from(queuedConversationMessages)
src/server/conversations/queued-messages.ts:377:    .where(eq(queuedConversationMessages.id, messageId))
src/server/conversations/queued-messages.ts:389:    return serializeQueuedConversationMessage(record);
src/server/conversations/queued-messages.ts:393:  await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:396:  }).where(eq(queuedConversationMessages.id, messageId));
src/server/conversations/queued-messages.ts:403:  return serializeQueuedConversationMessage({
src/server/conversations/queued-messages.ts:469:      await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:474:      }).where(eq(queuedConversationMessages.id, args.messageId));
src/server/conversations/queued-messages.ts:495:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:500:    }).where(eq(queuedConversationMessages.id, args.messageId));
src/server/conversations/queued-messages.ts:527:          await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:530:          }).where(eq(queuedConversationMessages.id, args.messageId));
src/server/conversations/queued-messages.ts:547:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:551:    }).where(eq(queuedConversationMessages.id, args.messageId));
src/server/conversations/queued-messages.ts:601:    .from(queuedConversationMessages)
src/server/conversations/queued-messages.ts:602:    .where(eq(queuedConversationMessages.id, messageId))
src/server/conversations/queued-messages.ts:620:  await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:625:  }).where(eq(queuedConversationMessages.id, messageId));
src/server/conversations/queued-messages.ts:634:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:640:    }).where(eq(queuedConversationMessages.id, messageId));
src/server/conversations/queued-messages.ts:651:      queuedMessage: serializeQueuedConversationMessage({
src/server/conversations/queued-messages.ts:669:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:672:    }).where(eq(queuedConversationMessages.id, messageId));
src/server/conversations/queued-messages.ts:678:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:684:    }).where(eq(queuedConversationMessages.id, messageId));
src/server/conversations/queued-messages.ts:695:      queuedMessage: serializeQueuedConversationMessage({
src/server/conversations/queued-messages.ts:751:    queuedMessage: serializeQueuedConversationMessage({
src/server/conversations/queued-messages.ts:766:    .from(queuedConversationMessages)
src/server/conversations/queued-messages.ts:767:    .where(eq(queuedConversationMessages.runId, runId))
src/server/conversations/queued-messages.ts:768:    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
src/server/conversations/queued-messages.ts:789:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:792:    }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:803:        await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:807:        }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:879:          await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:885:          }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:895:        await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:900:        }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:928:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:933:    }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:986:    await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:990:    }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:1027:          await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:1032:          }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:1050:        await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:1055:        }).where(eq(queuedConversationMessages.id, record.id));
src/server/conversations/queued-messages.ts:1064:      await db.update(queuedConversationMessages).set({
src/server/conversations/queued-messages.ts:1068:      }).where(eq(queuedConversationMessages.id, record.id));
src/server/db/index.ts:146:CREATE TABLE IF NOT EXISTS queued_conversation_messages (
src/server/db/index.ts:177:  FOREIGN KEY (queued_message_id) REFERENCES queued_conversation_messages(id) ON UPDATE no action ON DELETE no action
src/server/db/index.ts:704:CREATE INDEX IF NOT EXISTS queued_conversation_messages_run_status_created_idx ON queued_conversation_messages(run_id, status, created_at);
src/server/db/index.ts:705:CREATE INDEX IF NOT EXISTS queued_conversation_messages_run_status_created_id_desc_idx ON queued_conversation_messages(run_id, status, created_at DESC, id DESC);
src/server/db/index.ts:706:CREATE INDEX IF NOT EXISTS queued_conversation_messages_pending_run_created_id_desc_idx
src/server/db/index.ts:707:  ON queued_conversation_messages(run_id, created_at DESC, id DESC)
src/server/db/schema.ts:120:export const queuedConversationMessages = sqliteTable('queued_conversation_messages', {
src/server/db/schema.ts:138:  queuedMessageId: text('queued_message_id').references(() => queuedConversationMessages.id),
src/server/runs/recovery-state.ts:133:  queuedMessages: RecoveryQueuedMessageLike[],
src/server/runs/recovery-state.ts:136:  return queuedMessages.find((message) => (
src/server/runs/recovery-state.ts:148:  queuedMessages = [],
src/server/runs/recovery-state.ts:155:  queuedMessages?: RecoveryQueuedMessageLike[];
src/server/runs/recovery-state.ts:203:  const blockedMessage = findQueueBlockedMessage(queuedMessages);
src/server/runs/recovery-state.ts:210:    const workerBlockedMessage = findQueueBlockedMessage(queuedMessages, worker.id);
src/server/runs/recovery-actions.ts:4:import { messages, plans, queuedConversationMessages, runs, workers } from "@/server/db/schema";
src/server/runs/recovery-actions.ts:23:    .from(queuedConversationMessages)
src/server/runs/recovery-actions.ts:24:    .where(eq(queuedConversationMessages.runId, args.runId));
src/server/runs/recovery-actions.ts:38:  await db.update(queuedConversationMessages).set({
src/server/runs/recovery-actions.ts:45:  }).where(inArray(queuedConversationMessages.id, recoverableIds));
src/server/runs/recovery-actions.ts:52:    .from(queuedConversationMessages)
src/server/runs/recovery-actions.ts:53:    .where(eq(queuedConversationMessages.runId, runId))
src/server/runs/recovery-actions.ts:54:    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
src/server/runs/recovery-actions.ts:63:    await db.update(queuedConversationMessages).set({
src/server/runs/recovery-actions.ts:66:    }).where(eq(queuedConversationMessages.id, record.id));
src/server/runs/recovery-actions.ts:76:    await db.update(queuedConversationMessages).set({
src/server/runs/recovery-actions.ts:81:    }).where(eq(queuedConversationMessages.id, record.id));
src/server/runs/recovery-reconciler.ts:5:import { executionEvents, messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
src/server/runs/recovery-reconciler.ts:74:    db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id)),
src/server/runs/recovery-reconciler.ts:328:    queuedMessages: runQueuedMessages,
src/server/runs/recovery.ts:12:  queuedConversationMessages,
src/server/runs/recovery.ts:138:  await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:40:58.933Z","phase":null} -->
## Tool result: call_uSTVY13qNRRUVKGnj2dTDcVU · 2026-06-16T21:40:58.933Z

```text
Chunk ID: c92aa3
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2142
Output:
      ...incomingRun,
      ...currentRun,
    };
  });

  return changed ? { ...catalogMergedIncoming, runs: mergedRuns } : catalogMergedIncoming;
}

/**
 * Supervisor-conversation messages still flow through the `messages`
 * table (worker-attributed messages moved to the unified worker
 * stream). Snapshots declare whether their message run scope is
 * complete; partial updates are additive and must not erase durable
 * conversation messages the client already knows about.
 */
function mergeScopedMessages(current: EventStreamState, incoming: EventStreamState) {
  const incomingMessages = incoming.messages ?? [];
  const incomingMessageIds = new Set(incomingMessages.map((message) => message.id));
  const completeMessageRunIds = new Set(
    incoming.messageScope?.complete ? incoming.messageScope.runIds : [],
  );
  const liveRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const retainedCurrentMessages = (current.messages ?? []).filter((message) => (
    liveRunIds.has(message.runId)
    && !incomingMessageIds.has(message.id)
    && !completeMessageRunIds.has(message.runId)
  ));
  const mergedMessages = sortMessages([
    ...retainedCurrentMessages,
    ...incomingMessages,
  ]);

  if (
    mergedMessages.length === incomingMessages.length
    && mergedMessages.every((message, index) => message === incomingMessages[index])
  ) {
    return incoming;
  }

  return {
    ...incoming,
    messages: mergedMessages,
  };
}

function mergeScopedCachedState(current: EventStreamState, cached: EventStreamState): EventStreamState {
  // hydrateFromCacheScope swaps scopes (e.g. on session switch). The cached
  // payload for the newly-selected scope only contains data that was
  // observed while THAT scope was active — its messages/workers/agents/
  // queuedMessages/executionEvents are a strict subset of what we already
  // know across all runs. Replacing current collections with that subset
  // briefly empties any cross-run sidebar view (notably the Active tab,
  // whose filter is driven by messages+workers+agents+queuedMessages).
  //
  // Initial-mount cache hydration takes a different path (hydrateFromCaches
  // → snapshotCache.hydrateState) that already prefers current values when
  // present and falls back to cached when empty, so the only consumers of
  // this merge are scope transitions where current is server-authoritative.
  // Preserve current state and only adopt the scope-pointer metadata so
  // consumers gating on snapshotRunId still recognize the switch.
  return {
    ...current,
    snapshotRunId: cached.snapshotRunId ?? current.snapshotRunId,
    snapshotChecksum: cached.snapshotChecksum ?? current.snapshotChecksum,
    snapshotScope: cached.snapshotScope ?? current.snapshotScope,
    frontendErrors: [],
  };
}

function authoritativeCatalogExcludesScope(state: EventStreamState, scope: string | null | undefined) {
  const scopedRunId = scope?.trim();
  if (!scopedRunId || state.snapshotSource !== "server" || state.snapshotScope?.catalog?.complete !== true) {
    return false;
  }

  return !(state.runs ?? []).some((run) => run.id === scopedRunId);
}

/**
 * State manager for the global `/api/events` snapshot stream. Worker
 * conversation content (bridge entries, user/supervisor inputs,
 * lifecycle markers) is NOT managed here — it lives in
 * `WorkerEntriesManager` and is fetched per-worker via
 * `/api/workers/:workerId/entries`. This manager owns runs, plans,
 * workers metadata, supervisor messages, planning artifacts, queued
 * messages, recovery state, and review records.
 */
export class EventStreamStateManager {
  private state: EventStreamState;
  private readonly listeners = new Set<EventStreamStateListener>();
  private readonly snapshotCache: EventStreamSnapshotCacheManager;
  private snapshotCacheScope: string | null;

  constructor(initialState: EventStreamState, options: {
    snapshotCache?: EventStreamSnapshotCacheManager;
    snapshotCacheScope?: string | null;
    deferCacheHydration?: boolean;
    initialSnapshotSource?: EventStreamSnapshotSource;
  } = {}) {
    this.snapshotCache = options.snapshotCache ?? new EventStreamSnapshotCacheManager();
    this.snapshotCacheScope = options.snapshotCacheScope?.trim() || null;

  hydrateState(initialState: EventStreamState, scope: string | null | undefined = null) {
    const cachedState = this.getCachedState(scope);
    if (!cachedState) {
      return initialState;
    }
    const arrayMergeOptions = {
      serverAuthoritative: initialState.snapshotSource === "server",
    };

    return {
      ...cachedState,
      ...initialState,
      messages: preferInitialArray(initialState.messages, cachedState.messages, arrayMergeOptions),
      plans: preferInitialArray(initialState.plans, cachedState.plans, arrayMergeOptions),
      runs: preferInitialArray(initialState.runs, cachedState.runs, arrayMergeOptions),
      accounts: preferInitialArray(initialState.accounts, cachedState.accounts, arrayMergeOptions),
      agents: preferInitialArray(initialState.agents, cachedState.agents, arrayMergeOptions),
      workers: preferInitialArray(initialState.workers, cachedState.workers, arrayMergeOptions),
      planItems: preferInitialArray(initialState.planItems, cachedState.planItems, arrayMergeOptions),
      clarifications: preferInitialArray(initialState.clarifications, cachedState.clarifications, arrayMergeOptions),
      executionEvents: preferInitialArray(initialState.executionEvents, cachedState.executionEvents, arrayMergeOptions),
      supervisorInterventions: preferInitialArray(initialState.supervisorInterventions, cachedState.supervisorInterventions, arrayMergeOptions),
      queuedMessages: preferInitialArray(initialState.queuedMessages, cachedState.queuedMessages, arrayMergeOptions),
      recoveryIncidents: preferInitialArray(initialState.recoveryIncidents, cachedState.recoveryIncidents, arrayMergeOptions),
      frontendErrors: [],
    };
  }

  getCachedState(scope: string | null | undefined = null): EventStreamState | null {
    const snapshot = this.readEnvelope().snapshots[scopeKey(scope)];
    if (!snapshot || !isEventStreamState(snapshot.state)) {
      return null;
    }

    return {
      ...snapshot.state,
      frontendErrors: [],
    };
  }

  rememberState(state: EventStreamState, scope: string | null | undefined = null) {
    if (!this.storage) {
      return;
    }

    const currentEnvelope = this.readEnvelope();
    const envelope = this.pruneEnvelope({
      ...currentEnvelope,
      snapshots: {
        ...currentEnvelope.snapshots,
  );
  const settingsDraft = useManagerSnapshot(settingsDraftManager);

  const scrollConversationToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const vp = scrollRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]',
      ) as HTMLDivElement | null;
      vp?.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    conversationNotificationManager.hydrateFromBrowser();
    preflightConfirmationActionsManager.hydrateFromBrowser();
  }, []);

  // Filter event stream state
  const filterEventStreamState = useCallback((incoming: EventStreamState) => {
    let next = mergePendingCreatedConversationSnapshots(incoming, pendingCreatedConversationSnapshotsRef.current);
    next = mergePendingSentConversationMessages(next, pendingSentConversationMessagesRef.current);
    const pendingDeleted = pendingDeletedRunIdsRef.current;
    const reconcile = (s: EventStreamState) => { busyMessageQueueManager.setQueuedMessages(s.queuedMessages || []); return s; };
    if (pendingDeleted.size === 0) return reconcile(next);
    next = filterOptimisticallyDeletedRuns(next, pendingDeleted);
    const serverRunIds = new Set((incoming.runs || []).map((r) => r.id));
    for (const id of Array.from(pendingDeleted)) { if (!serverRunIds.has(id)) pendingDeleted.delete(id); }
    return reconcile(next);
  }, []);

  // Compute currentProjectScope early so queries can use it
  const explicitProjects = useMemo(() => parseProjectList(apiKeys.PROJECTS), [apiKeys.PROJECTS]);
  const currentProjectScope = resolveProjectScope({
    draftProjectPath,
    selectedRunId,
    plans: (state.plans || []) as import("./types").PlanRecord[],
    runs: (state.runs || []) as import("./types").RunRecord[],
    explicitProjects,
  });
  // The composer's worker dropdown filters by catalog availability, so the
  // catalog must load on initial mount — not just when the user opens

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:41:10.722Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:41:10.722Z

The event snapshot code also filters queued messages to only `pending`/`delivering`, so a clean server snapshot for `5eb40b0d5030` should carry `queuedMessages: []`. I’m checking the execution events and the manager merge/update tests next; the likely hole is an empty/missing snapshot being treated as “do nothing” somewhere.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:10.726Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:10.726Z

```json
{
  "cmd": "sqlite3 sqlite.db \"pragma table_info(execution_events);\" && sqlite3 -header -column sqlite.db \"select id, event_type, worker_id, created_at, substr(details,1,500) as details from execution_events where run_id='5eb40b0d5030' and (event_type like '%queued%' or event_type like '%interrupt%') order by created_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:10.743Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:10.743Z

```json
{
  "cmd": "sed -n '1,180p' src/app/home/EventStreamSnapshotCacheManager.ts && sed -n '230,330p' src/server/events/persisted-snapshot.ts && sed -n '130,170p' src/runtime/http/routes/events.ts && sed -n '480,500p' src/runtime/http/routes/events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:11.016Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:11.016Z

```json
{
  "cmd": "sed -n '1,260p' tests/app/event-stream-state-manager.test.ts && sed -n '1,220p' tests/app/event-stream-snapshot-cache-manager.test.ts 2>/dev/null || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:11.097Z","phase":null} -->
## Tool result: call_J0js8dc0UE31h7qTPYtMeAbj · 2026-06-16T21:41:11.097Z

```text
Chunk ID: 320bbb
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1161
Output:
0|id|TEXT|1||1
1|run_id|TEXT|1||0
2|worker_id|TEXT|0||0
3|plan_item_id|TEXT|0||0
4|event_type|TEXT|1||0
5|details|TEXT|0||0
6|created_at|INTEGER|1||0
7|artifact_seq|INTEGER|0||0
8|details_hash|TEXT|0||0
9|details_preview|TEXT|0||0
id                                    event_type                          worker_id              created_at  details                                                                                                                                                                                                      
------------------------------------  ----------------------------------  ---------------------  ----------  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
ed723e77-3835-43e5-be33-3b1121e6030a  queued_message_created              5eb40b0d5030-worker-1  1781641581  {"summary":"Steering message was deferred into the queue.","queuedMessageId":"1f633077-ed5c-4884-bd93-79cfc35651cd","action":"steer"}                                                                        
85996073-59e4-4f0d-8f72-49de5b027dc3  queued_message_interrupt_requested  5eb40b0d5030-worker-1  1781641589  {"summary":"User requested an interrupt-and-send for a queued message.","queuedMessageId":"1f633077-ed5c-4884-bd93-79cfc35651cd","source":"drawer"}                                                          
d2dfad17-ca17-4d09-ac0f-021caebecb60  queued_message_turn_cancelled       5eb40b0d5030-worker-1  1781641589  {"summary":"Interrupted the active turn for 5eb40b0d5030-worker-1.","queuedMessageId":"1f633077-ed5c-4884-bd93-79cfc35651cd","cancelDurationMs":2,"source":"drawer"}                                         
1dff85d3-7df7-4055-8d42-3294372e277e  queued_message_interrupt_delivered  5eb40b0d5030-worker-1  1781641684  {"summary":"Delivered interrupted queued message to 5eb40b0d5030-worker-1.","queuedMessageId":"1f633077-ed5c-4884-bd93-79cfc35651cd","source":"drawer"}                                                      
d3496ea5-815e-4f05-8998-65c4f3dec51d  queued_message_created              5eb40b0d5030-worker-1  1781642788  {"summary":"Steering message was deferred into the queue.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","action":"steer"}                                                                        
a5b3e1ef-15f8-4026-a9b4-a6ce93eabbd8  queued_message_deferred             5eb40b0d5030-worker-1  1781643481  {"summary":"Worker 5eb40b0d5030-worker-1 is still busy; queued message will be retried.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","error":"Ask failed: Agent is busy: 5eb40b0d5030-worker-1"}
defd25e5-0967-4193-99a6-d95d57115238  queued_message_deferred             5eb40b0d5030-worker-1  1781644407  {"summary":"Worker 5eb40b0d5030-worker-1 is still busy; queued message will be retried.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","error":"Ask failed: Agent is busy: 5eb40b0d5030-worker-1"}
c954c7f9-3bda-40e2-b8fe-23ee38ae11d6  queued_message_deferred             5eb40b0d5030-worker-1  1781645175  {"summary":"Worker 5eb40b0d5030-worker-1 is still busy; queued message will be retried.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","error":"Ask failed: Agent is busy: 5eb40b0d5030-worker-1"}
f9973924-0559-4259-957d-d42c4a263573  queued_message_deferred             5eb40b0d5030-worker-1  1781645556  {"summary":"Worker 5eb40b0d5030-worker-1 is still busy; queued message will be retried.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","error":"Ask failed: Agent is busy: 5eb40b0d5030-worker-1"}
3a80f414-91ed-4953-87c6-0fc3e0c6d384  queued_message_deferred             5eb40b0d5030-worker-1  1781645573  {"summary":"Worker 5eb40b0d5030-worker-1 is still busy; queued message will be retried.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","error":"Ask failed: Agent is busy: 5eb40b0d5030-worker-1"}
218269b8-8800-4f01-83f4-d9c5307e0081  queued_message_deferred             5eb40b0d5030-worker-1  1781645903  {"summary":"Worker 5eb40b0d5030-worker-1 is still busy; queued message will be retried.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7","error":"Ask failed: Agent is busy: 5eb40b0d5030-worker-1"}
036564a0-ab72-4b7a-a7f6-4722ae566e71  queued_message_delivered            5eb40b0d5030-worker-1  1781646004  {"summary":"Delivered queued message to 5eb40b0d5030-worker-1.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7"}                                                                                    

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:11.097Z","phase":null} -->
## Tool result: call_KGp94XrUmtvcwQ4ndi20b3hv · 2026-06-16T21:41:11.097Z

```text
Chunk ID: 619b0c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3228
Output:
import type { AgentSnapshot, EventStreamState } from "./types";

const DEFAULT_STORAGE_KEY = "omni-event-stream-snapshot-cache:v1";
const DEFAULT_MAX_SNAPSHOTS = 8;
const DEFAULT_MAX_SERIALIZED_BYTES = 4_000_000;
const GLOBAL_SCOPE_KEY = "__global__";

type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface CachedSnapshot {
  updatedAt: number;
  state: EventStreamState;
}

interface SnapshotEnvelope {
  version: 1;
  snapshots: Record<string, CachedSnapshot>;
}

interface EventStreamSnapshotCacheManagerOptions {
  storage?: SnapshotStorage | null;
  storageKey?: string;
  maxSnapshots?: number;
  maxSerializedBytes?: number;
  now?: () => number;
}

function getDefaultStorage(): SnapshotStorage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }

  return window.localStorage;
}

function scopeKey(scope: string | null | undefined) {
  return scope?.trim() || GLOBAL_SCOPE_KEY;
}

function emptyEnvelope(): SnapshotEnvelope {
  return {
    version: 1,
    snapshots: {},
  };
}

function compactAgent(agent: AgentSnapshot): AgentSnapshot {
  return {
    ...agent,
    outputEntries: agent.outputEntries?.map((entry) => ({
      ...entry,
      raw: undefined,
    })),
  };
}

function compactStateForCache(state: EventStreamState): EventStreamState {
  return {
    ...state,
    agents: (state.agents ?? []).map(compactAgent),
    frontendErrors: [],
  };
}

function preferInitialArray<T>(
  initial: T[] | undefined,
  cached: T[] | undefined,
  options: { serverAuthoritative: boolean },
) {
  if (options.serverAuthoritative && initial) {
    return initial;
  }

  return initial && initial.length > 0 ? initial : cached ?? [];
}

function isEventStreamState(value: unknown): value is EventStreamState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EventStreamState>;
  return Array.isArray(record.runs) && Array.isArray(record.messages);
}

export class EventStreamSnapshotCacheManager {
  private readonly storage: SnapshotStorage | null;
  private readonly storageKey: string;
  private readonly maxSnapshots: number;
  private readonly maxSerializedBytes: number;
  private readonly now: () => number;

  constructor(options: EventStreamSnapshotCacheManagerOptions = {}) {
    this.storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxSnapshots = options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
    this.maxSerializedBytes = options.maxSerializedBytes ?? DEFAULT_MAX_SERIALIZED_BYTES;
    this.now = options.now ?? Date.now;
  }

  hydrateState(initialState: EventStreamState, scope: string | null | undefined = null) {
    const cachedState = this.getCachedState(scope);
    if (!cachedState) {
      return initialState;
    }
    const arrayMergeOptions = {
      serverAuthoritative: initialState.snapshotSource === "server",
    };

    return {
      ...cachedState,
      ...initialState,
      messages: preferInitialArray(initialState.messages, cachedState.messages, arrayMergeOptions),
      plans: preferInitialArray(initialState.plans, cachedState.plans, arrayMergeOptions),
      runs: preferInitialArray(initialState.runs, cachedState.runs, arrayMergeOptions),
      accounts: preferInitialArray(initialState.accounts, cachedState.accounts, arrayMergeOptions),
      agents: preferInitialArray(initialState.agents, cachedState.agents, arrayMergeOptions),
      workers: preferInitialArray(initialState.workers, cachedState.workers, arrayMergeOptions),
      planItems: preferInitialArray(initialState.planItems, cachedState.planItems, arrayMergeOptions),
      clarifications: preferInitialArray(initialState.clarifications, cachedState.clarifications, arrayMergeOptions),
      executionEvents: preferInitialArray(initialState.executionEvents, cachedState.executionEvents, arrayMergeOptions),
      supervisorInterventions: preferInitialArray(initialState.supervisorInterventions, cachedState.supervisorInterventions, arrayMergeOptions),
      queuedMessages: preferInitialArray(initialState.queuedMessages, cachedState.queuedMessages, arrayMergeOptions),
      recoveryIncidents: preferInitialArray(initialState.recoveryIncidents, cachedState.recoveryIncidents, arrayMergeOptions),
      frontendErrors: [],
    };
  }

  getCachedState(scope: string | null | undefined = null): EventStreamState | null {
    const snapshot = this.readEnvelope().snapshots[scopeKey(scope)];
    if (!snapshot || !isEventStreamState(snapshot.state)) {
      return null;
    }

    return {
      ...snapshot.state,
      frontendErrors: [],
    };
  }

  rememberState(state: EventStreamState, scope: string | null | undefined = null) {
    if (!this.storage) {
      return;
    }

    const currentEnvelope = this.readEnvelope();
    const envelope = this.pruneEnvelope({
      ...currentEnvelope,
      snapshots: {
        ...currentEnvelope.snapshots,
        [scopeKey(scope)]: {
          updatedAt: this.now(),
          state: compactStateForCache(state),
        },
      },
    });

    const serialized = JSON.stringify(envelope);
    if (serialized.length > this.maxSerializedBytes) {
      return;
    }

    try {
      this.storage.setItem(this.storageKey, serialized);
    } catch {
      // localStorage can be unavailable or full. The live stream remains the source of truth.
    }
  }

  private readEnvelope(): SnapshotEnvelope {
    if (!this.storage) {
      return emptyEnvelope();
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return emptyEnvelope();
      }

  await reconcilePersistedReloadZombies({
    selectedRunId: options.selectedRunId,
    source: "persisted-event-payload",
  });
  const requestedSelectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
  const selectedRun = requestedSelectedRunId ? allRuns.find((run) => run.id === requestedSelectedRunId) ?? null : null;
  const selectedRunId = selectedRun?.id ?? null;
  const selectedPlanId = selectedRun?.planId ?? null;
  const transcriptRunIds = selectedRunId
    ? [
        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
        selectedRunId,
      ]
    : [];

  const runIds = selectedRunId ? new Set([selectedRunId]) : null;

  const [
    msgs,
    allAccounts,
    allWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allProcessSessions,
    allReadMarkers,
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
      : [],
    db.select().from(accounts),
    selectedRunId
      ? db.select(WORKER_SNAPSHOT_COLUMNS).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : db.select(WORKER_SNAPSHOT_COLUMNS).from(workers).orderBy(asc(workers.createdAt), asc(workers.id)),
    selectedPlanId
      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
      : [],
    selectedRunId
      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt), desc(clarifications.id))
      : [],
    selectedRunId
      ? listExecutionEventsForSnapshot(selectedRunId, EXECUTION_EVENT_LIMIT)
      : [],
    selectedRunId
      ? listSupervisorInterventionsForSnapshot(selectedRunId, SUPERVISOR_INTERVENTION_LIMIT)
      : [],
    selectedRunId
      ? db.select().from(queuedConversationMessages)
        .where(and(
          eq(queuedConversationMessages.runId, selectedRunId),
          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
        ))
        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
      : [],
    selectedRunId
      ? db.select().from(recoveryIncidents)
        .where(eq(recoveryIncidents.runId, selectedRunId))
        .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
        .limit(20)
      : [],
    db.select().from(processSessions),
    db.select().from(conversationReadMarkers).where(allRuns.length > 0 ? inArray(conversationReadMarkers.runId, allRuns.map((run) => run.id)) : eq(conversationReadMarkers.runId, "__none__")),
  ]);
  const processSessionsByRunId = new Map<string, typeof allProcessSessions[number]>(
    allProcessSessions.map((session) => [session.runId, session]),
  );
  const workersByRunId = new Map<string, typeof allWorkers[number]>();
  for (const worker of allWorkers) {
    if (!workersByRunId.has(worker.runId)) {
      workersByRunId.set(worker.runId, worker);
    }
  }
  const sessions = allRuns.map((run) => serializeSessionRecord({
    run,
    primaryWorker: workersByRunId.get(run.id) ?? null,
    processSession: processSessionsByRunId.get(run.id) ?? null,
  }));
  const selectedWorkerEntryResults = selectedRunId
    ? await Promise.all(
      allWorkers
        .filter((worker) => worker.runId === selectedRunId)
        .map(async (worker) => {
          const latestSeq = await readWorkerLatestSeq(selectedRunId, worker.id);
          return { workerId: worker.id, latestSeq };
        }),
    )
    : [];
  const selectedWorkerEntrySeqs = Object.fromEntries(
    selectedWorkerEntryResults
      .filter((result) => result.latestSeq > 0)
      .map((result) => [result.workerId, result.latestSeq] as const),
  );
  const lifecycleErrors = buildAwaitingUserQuestionInvariantErrors({
    runs: allRuns,
    messages: msgs,
    clarifications: allClarifications,
        initialPrompt: workers.initialPrompt,
        activeWorkStartedAt: workers.activeWorkStartedAt,
        activeWorkDurationMs: workers.activeWorkDurationMs,
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
      }).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : [],
    selectedPlanId
      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
      : [],
    selectedRunId
      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt), desc(clarifications.id))
      : [],
    selectedRunId
      ? listExecutionEventsForSnapshot(selectedRunId, EXECUTION_EVENT_LIMIT)
      : [],
    selectedRunId
      ? listSupervisorInterventionsForSnapshot(selectedRunId, SUPERVISOR_INTERVENTION_LIMIT)
      : [],
    selectedRunId
      ? db.select().from(queuedConversationMessages)
        .where(and(
          eq(queuedConversationMessages.runId, selectedRunId),
          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
        ))
        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
      : [],
    selectedRunId
      ? db.select().from(recoveryIncidents)
        .where(eq(recoveryIncidents.runId, selectedRunId))
        .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
        .limit(20)
      : [],
    selectedRunId
      ? db.select().from(planningReviewRuns).where(eq(planningReviewRuns.runId, selectedRunId)).orderBy(desc(planningReviewRuns.createdAt), desc(planningReviewRuns.id))
      : [],
    selectedRunId
      ? db.select().from(planningReviewRounds).where(eq(planningReviewRounds.runId, selectedRunId)).orderBy(asc(planningReviewRounds.roundNumber))
      : [],
    selectedRunId
      ? listPlanningReviewFindingsForSnapshot(selectedRunId, PLANNING_REVIEW_FINDING_LIMIT)
    runs: records.allRuns,
    sessions,
    accounts: records.allAccounts,
    agents: agentsData.map(compactAgentSnapshot),
    workers: records.allWorkers.map(compactWorkerRecord),
    planItems: records.allPlanItems,
    clarifications: records.allClarifications,
    executionEvents: records.allExecutionEvents
      .slice(0, EXECUTION_EVENT_LIMIT)
      .map(compactExecutionEvent),
    supervisorInterventions: records.allSupervisorInterventions
      .map(compactSupervisorIntervention),
    queuedMessages: records.allQueuedMessages
      .filter((message) => message.status === "pending" || message.status === "delivering")
      .map(serializeQueuedConversationMessage),
    recoveryIncidents: records.allRecoveryIncidents
      .map(compactRecoveryIncident),
    recoveryState: runIds && !isTerminalRunStatus(
      records.allRuns.find((run) => runIds.has(run.id))?.status,
    )
      ? deriveRecoveryState(records.allRecoveryIncidents)

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:11.099Z","phase":null} -->
## Tool result: call_eFuZVh6L5sVm1MfpvzS4FtmO · 2026-06-16T21:41:11.099Z

```text
Chunk ID: a25e71
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2202
Output:
import { describe, expect, it } from "vitest";
import { EventStreamSnapshotCacheManager } from "@/app/home/EventStreamSnapshotCacheManager";
import { EventStreamStateManager } from "@/app/home/EventStreamStateManager";
import type { EventStreamState } from "@/app/home/types";

function state(runId: string, message: string, checksum: string): EventStreamState {
  return {
    messages: [{
      id: `${runId}-message`,
      runId,
      role: "user",
      content: message,
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    }],
    plans: [],
    runs: [{
      id: runId,
      planId: "plan-1",
      status: "done",
      createdAt: new Date(0).toISOString(),
      projectPath: null,
      title: runId,
      mode: "direct",
    }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    snapshotRunId: runId,
    snapshotChecksum: checksum,
  };
}

function run(id: string): EventStreamState["runs"][number] {
  return {
    id,
    planId: `${id}-plan`,
    status: "done",
    createdAt: new Date(0).toISOString(),
    projectPath: null,
    title: id,
    mode: "direct",
  };
}

function awaitingUserState(args: {
  messages: EventStreamState["messages"];
  checksum: string;
  messageScope?: { runIds: string[]; complete: boolean };
}): EventStreamState {
  return {
    messages: args.messages,
    plans: [{ id: "plan-1", path: "plan.md" }],
    runs: [{
      id: "run-awaiting",
      planId: "plan-1",
      status: "awaiting_user",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(1_000).toISOString(),
      projectPath: null,
      title: "Awaiting run",
      mode: "implementation",
    }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    snapshotRunId: "run-awaiting",
    snapshotChecksum: args.checksum,
    ...(args.messageScope ? { messageScope: args.messageScope } : {}),
  };
}

function multiRunState(args: {
  runs: string[];
  messageRunId: string;
  message: string;
  checksum: string;
  catalogComplete?: boolean;
}): EventStreamState {
  return {
    messages: [{
      id: `${args.messageRunId}-message`,
      runId: args.messageRunId,
      role: "user",
      content: args.message,
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    }],
    plans: args.runs.map((id) => ({ id: `${id}-plan`, path: `${id}.md` })),
    runs: args.runs.map(run),
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    snapshotRunId: args.messageRunId,
    snapshotChecksum: args.checksum,
    snapshotScope: args.catalogComplete === undefined
      ? undefined
      : { catalog: { complete: args.catalogComplete } },
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("EventStreamStateManager", () => {
  it("keeps supervisor confirmation messages when a partial live update only includes the user checkpoint", () => {
    const userMessage: EventStreamState["messages"][number] = {
      id: "user-message",
      runId: "run-awaiting",
      role: "user",
      content: "Implement the plan.",
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    };
    const supervisorMessage: EventStreamState["messages"][number] = {
      id: "supervisor-confirmation",
      runId: "run-awaiting",
      role: "supervisor",
      content: "Before I start implementation, please confirm this is the intended job.",
      createdAt: new Date(1_000).toISOString(),
      kind: "implementation_confirmation",
      attachments: [],
    };
    const manager = new EventStreamStateManager(
      awaitingUserState({
        messages: [userMessage, supervisorMessage],
        checksum: "sha256:with-confirmation",
      }),
      { deferCacheHydration: true },
    );

    manager.update(awaitingUserState({
      messages: [userMessage],
      checksum: "sha256:user-only-live-update",
      messageScope: { runIds: ["run-awaiting"], complete: false },
    }));

    expect(manager.getSnapshot().messages.map((message) => message.id)).toEqual([
      "user-message",
      "supervisor-confirmation",
    ]);
  });

  it("removes absent run messages when the incoming message scope is complete", () => {
    const userMessage: EventStreamState["messages"][number] = {
      id: "user-message",
      runId: "run-awaiting",
      role: "user",
      content: "Implement the plan.",
      createdAt: new Date(0).toISOString(),
      kind: "checkpoint",
      attachments: [],
    };
    const staleSupervisorMessage: EventStreamState["messages"][number] = {
      id: "stale-supervisor-confirmation",
      runId: "run-awaiting",
      role: "supervisor",
      content: "Before I start implementation, please confirm this is the intended job.",
      createdAt: new Date(1_000).toISOString(),
      kind: "implementation_confirmation",
      attachments: [],
    };
    const manager = new EventStreamStateManager(
      awaitingUserState({
        messages: [userMessage, staleSupervisorMessage],
        checksum: "sha256:with-stale-confirmation",
      }),
      { deferCacheHydration: true },
    );

    manager.update(awaitingUserState({
      messages: [userMessage],
      checksum: "sha256:complete-user-only-snapshot",
      messageScope: { runIds: ["run-awaiting"], complete: true },
    }));

    expect(manager.getSnapshot().messages.map((message) => message.id)).toEqual([
      "user-message",
    ]);
  });

  it("adopts the new scope pointer when switching but preserves current cross-run state", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-a", "cached first conversation", "sha256:a"), "run-a");
    cache.rememberState(state("run-b", "cached second conversation", "sha256:b"), "run-b");

    const manager = new EventStreamStateManager(state("run-a", "current conversation", "sha256:a"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
    });

    const hydrated = manager.hydrateFromCacheScope("run-b");

    expect(hydrated).toBe(true);
    // Scope pointer follows the new selection so isSelectedConversationPreviewAvailable etc. flip.
    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotChecksum).toBe("sha256:b");
    // Cross-run state (messages, workers, agents, queuedMessages, etc.) is preserved so the
    // sidebar — especially the Active tab whose filter spans all runs — does not briefly empty.
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["current conversation"]);
  });

  it("marks scoped frontend cache hydration as a preview instead of authoritative server state", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-b", "cached second conversation", "sha256:b"), "run-b");

    const manager = new EventStreamStateManager(state("run-a", "current conversation", "sha256:a"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
    });

    manager.hydrateFromCacheScope("run-b");

    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotSource).toBe("cache");

    manager.updateFromServer(state("run-b", "fresh server conversation", "sha256:fresh"));

    expect(manager.getSnapshot().snapshotSource).toBe("server");
    // Fresh server data for run-b lands alongside run-a's preserved message — the scope
    // switch is not a cross-run wipe.
    const contents = manager.getSnapshot().messages.map((message) => message.content);
    expect(contents).toContain("fresh server conversation");
    expect(contents).toContain("current conversation");
  });

  it("does not demote selected server bootstrap state to a cached preview for the same run", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-b", "cached second conversation", "sha256:cached"), "run-b");
    const manager = new EventStreamStateManager(state("run-b", "fresh server conversation", "sha256:server"), {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:41:23.986Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:41:23.986Z

The execution timeline explains the human-visible pain: the second queued item deferred over and over, then finally delivered. The DB row is `delivered`, but because the response path can return a partial `delivering` row and the frontend has cache/preserved cross-run state, a stale row can survive unless the manager treats an authoritative selected-run empty queue as a scoped delete.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:23.990Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:23.990Z

```json
{
  "cmd": "sed -n '220,520p' tests/app/event-stream-state-manager.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:23.990Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:23.990Z

```json
{
  "cmd": "sed -n '520,760p' tests/app/event-stream-state-manager.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:24.114Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:24.114Z

```json
{
  "cmd": "sed -n '1,280p' src/app/home/EventStreamStateManager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:24.153Z","phase":null} -->
## Tool result: call_iGJlOuLyWqWkpa5NWJ7oNNK0 · 2026-06-16T21:41:24.153Z

```text
Chunk ID: 6cdc93
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2578
Output:

    const hydrated = manager.hydrateFromCacheScope("run-b");

    expect(hydrated).toBe(true);
    // Scope pointer follows the new selection so isSelectedConversationPreviewAvailable etc. flip.
    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotChecksum).toBe("sha256:b");
    // Cross-run state (messages, workers, agents, queuedMessages, etc.) is preserved so the
    // sidebar — especially the Active tab whose filter spans all runs — does not briefly empty.
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["current conversation"]);
  });

  it("marks scoped frontend cache hydration as a preview instead of authoritative server state", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-b", "cached second conversation", "sha256:b"), "run-b");

    const manager = new EventStreamStateManager(state("run-a", "current conversation", "sha256:a"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
    });

    manager.hydrateFromCacheScope("run-b");

    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotSource).toBe("cache");

    manager.updateFromServer(state("run-b", "fresh server conversation", "sha256:fresh"));

    expect(manager.getSnapshot().snapshotSource).toBe("server");
    // Fresh server data for run-b lands alongside run-a's preserved message — the scope
    // switch is not a cross-run wipe.
    const contents = manager.getSnapshot().messages.map((message) => message.content);
    expect(contents).toContain("fresh server conversation");
    expect(contents).toContain("current conversation");
  });

  it("does not demote selected server bootstrap state to a cached preview for the same run", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(state("run-b", "cached second conversation", "sha256:cached"), "run-b");
    const manager = new EventStreamStateManager(state("run-b", "fresh server conversation", "sha256:server"), {
      snapshotCache: cache,
      snapshotCacheScope: "run-b",
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    expect(manager.hydrateFromCacheScope("run-b")).toBe(false);

    expect(manager.getSnapshot().snapshotRunId).toBe("run-b");
    expect(manager.getSnapshot().snapshotSource).toBe("server");
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["fresh server conversation"]);
  });

  it("does not resurrect cached queued messages when the server snapshot has an empty queue", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState({
      ...state("run-b", "cached second conversation", "sha256:cached-queue"),
      queuedMessages: [{
        id: "queued-stale",
        runId: "run-b",
        targetWorkerId: "run-b-worker-1",
        action: "steer",
        content: "This was already delivered.",
        status: "pending",
        lastError: null,
        attachments: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        deliveredAt: null,
      }],
    }, "run-b");

    const serverState = {
      ...state("run-b", "fresh server conversation", "sha256:fresh-empty-queue"),
      queuedMessages: [],
      snapshotSource: "server" as const,
    };
    const hydrated = cache.hydrateState(serverState, "run-b");

    expect(hydrated.queuedMessages).toEqual([]);
  });

  it("lets authoritative server run state retire a newer optimistic running row", () => {
    const optimistic = state("run-b", "follow-up", "sha256:optimistic");
    optimistic.runs = [{
      ...optimistic.runs[0],
      status: "running",
      updatedAt: "2026-05-20T10:00:00.000Z",
    }];
    const serverDone = state("run-b", "follow-up", "sha256:server-done");
    serverDone.runs = [{
      ...serverDone.runs[0],
      status: "done",
      updatedAt: "2026-05-20T09:59:59.000Z",
    }];
    const manager = new EventStreamStateManager(optimistic, {
      deferCacheHydration: true,
      initialSnapshotSource: "cache",
    });

    manager.updateFromServer(serverDone);

    expect(manager.getSnapshot().runs[0]?.status).toBe("done");
    expect(manager.getSnapshot().runs[0]?.updatedAt).toBe("2026-05-20T09:59:59.000Z");
    expect(manager.getSnapshot().snapshotSource).toBe("server");
  });

  it("does not let selected-run snapshots erase the sidebar run catalog", () => {
    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:current",
      }),
      {
        deferCacheHydration: true,
        initialSnapshotSource: "server",
      },
    );

    manager.updateFromServer(
      multiRunState({
        runs: ["run-b"],
        messageRunId: "run-b",
        message: "selected second conversation",
        checksum: "sha256:selected",
        catalogComplete: false,
      }),
    );

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b", "run-a"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan", "run-a-plan"]);
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual([
      "current first conversation",
      "selected second conversation",
    ]);
  });

  it("does not let selected-run complete snapshots remove unrelated sidebar runs", () => {
    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:current",
        catalogComplete: true,
      }),
      {
        deferCacheHydration: true,
        initialSnapshotSource: "server",
      },
    );

    manager.updateFromServer(
      multiRunState({
        runs: ["run-b"],
        messageRunId: "run-b",
        message: "selected second conversation",
        checksum: "sha256:selected",
        catalogComplete: true,
      }),
    );

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b", "run-a"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan", "run-a-plan"]);
  });

  it("lets unscoped complete server catalog snapshots remove absent runs", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:current",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager(initial, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });
    const incoming = multiRunState({
      runs: ["run-b"],
      messageRunId: "run-b",
      message: "selected second conversation",
      checksum: "sha256:selected",
      catalogComplete: true,
    });

    manager.updateFromServer({
      ...incoming,
      snapshotRunId: null,
    });

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-b"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-b-plan"]);
  });

  it("does not let transient snapshots clear read markers for visible runs", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:current",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager({
      ...initial,
      readMarkers: {
        "run-a": "2026-05-20T10:00:00.000Z",
        "run-b": "2026-05-20T10:01:00.000Z",
      },
    }, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });
    const incoming = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-b",
      message: "selected second conversation",
      checksum: "sha256:missing-read-markers",
      catalogComplete: true,
    });

    manager.updateFromServer({
      ...incoming,
      readMarkers: {},
    });

    expect(manager.getSnapshot().readMarkers).toEqual({
      "run-a": "2026-05-20T10:00:00.000Z",
      "run-b": "2026-05-20T10:01:00.000Z",
    });
  });

  it("drops read markers for runs absent from an unscoped catalog snapshot", () => {
    const initial = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:current",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager({
      ...initial,
      readMarkers: {
        "run-a": "2026-05-20T10:00:00.000Z",
        "run-b": "2026-05-20T10:01:00.000Z",
      },
    }, {
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });
    const incoming = multiRunState({
      runs: ["run-a"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:archived",
      catalogComplete: true,
    });

    manager.updateFromServer({
      ...incoming,
      snapshotRunId: null,
      readMarkers: {},
    });

    expect(manager.getSnapshot().readMarkers).toEqual({
      "run-a": "2026-05-20T10:00:00.000Z",
    });
  });

  it("does not resurrect deleted runs from stale scoped frontend caches", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(
      multiRunState({
        runs: ["run-a", "run-b", "deleted-run"],
        messageRunId: "run-b",
        message: "cached second conversation",
        checksum: "sha256:stale-b",
      }),
      "run-b",
    );

    const manager = new EventStreamStateManager(
      multiRunState({
        runs: ["run-a", "run-b"],
        messageRunId: "run-a",
        message: "current first conversation",
        checksum: "sha256:current",
      }),
      {
        snapshotCache: cache,
        snapshotCacheScope: "run-a",
        deferCacheHydration: true,
      },
    );

    const hydrated = manager.hydrateFromCacheScope("run-b");

    expect(hydrated).toBe(true);

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:24.153Z","phase":null} -->
## Tool result: call_mYNHMQhVTaURmpYGXq33CDOh · 2026-06-16T21:41:24.153Z

```text
Chunk ID: 8bec16
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1198
Output:
    expect(hydrated).toBe(true);
    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-a", "run-b"]);
    expect(manager.getSnapshot().plans.map((item) => item.id)).toEqual(["run-a-plan", "run-b-plan"]);
    // Cross-run state is preserved on scope switch so the sidebar's Active tab does not flicker.
    expect(manager.getSnapshot().messages.map((message) => message.content)).toEqual(["current first conversation"]);
  });

  it("preserves cross-run sidebar signals (workers, agents, queued messages, foreign messages) on scope switch", () => {
    // Regression: switching the selected session used to wipe all the
    // cross-run collections that drive the sidebar Active tab, making
    // every session briefly disappear from the list until the next SSE
    // frame restored them. The cached payload for the newly-selected
    // scope only contains that scope's data, so a wholesale replace
    // strips away every other run's signals.
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState({
      ...state("run-b", "cached second conversation", "sha256:b"),
      // The cache for scope "run-b" only knows about run-b's workers /
      // agents / queue; if hydration blindly trusts this, run-a's
      // sidebar signals vanish.
      workers: [],
      agents: [],
      queuedMessages: [],
    }, "run-b");

    const currentWorkers = [
      { id: "worker-a", runId: "run-a", status: "working", updatedAt: new Date(0).toISOString(), type: "claude" },
      { id: "worker-c", runId: "run-c", status: "idle", updatedAt: new Date(0).toISOString(), type: "claude" },
    ];
    const currentAgents = [
      { name: "worker-a", state: "working", updatedAt: new Date(0).toISOString(), lastText: "", currentText: "thinking…" },
    ];
    const currentQueued = [{
      id: "queued-a",
      runId: "run-a",
      targetWorkerId: "worker-a",
      action: "steer" as const,
      content: "queued for a",
      status: "pending" as const,
      lastError: null,
      attachments: [],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      deliveredAt: null,
    }];
    const currentMessages = [
      ...state("run-a", "current message in run-a", "sha256:current").messages,
      { id: "extra-c", runId: "run-c", role: "user", content: "current message in run-c", createdAt: new Date(0).toISOString(), kind: "checkpoint", attachments: [] },
    ];

    const manager = new EventStreamStateManager({
      ...state("run-a", "current message in run-a", "sha256:current"),
      messages: currentMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workers: currentWorkers as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agents: currentAgents as any,
      queuedMessages: currentQueued,
    }, {
      snapshotCache: cache,
      snapshotCacheScope: "run-a",
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    manager.hydrateFromCacheScope("run-b");

    const snap = manager.getSnapshot();
    expect(snap.snapshotRunId).toBe("run-b");
    expect(snap.workers.map((w) => w.id)).toEqual(["worker-a", "worker-c"]);
    expect(snap.agents.map((a) => a.name)).toEqual(["worker-a"]);
    expect((snap.queuedMessages ?? []).map((q) => q.id)).toEqual(["queued-a"]);
    expect(snap.messages.map((m) => m.content)).toEqual([
      "current message in run-a",
      "current message in run-c",
    ]);
  });

  it("does not hydrate a stale scoped cache when an authoritative catalog excludes that run", () => {
    const cache = new EventStreamSnapshotCacheManager({ storage: memoryStorage() });
    cache.rememberState(
      multiRunState({
        runs: ["archived-run"],
        messageRunId: "archived-run",
        message: "archived conversation body",
        checksum: "sha256:archived-cache",
      }),
      "archived-run",
    );

    const authoritative = multiRunState({
      runs: ["run-a", "run-b"],
      messageRunId: "run-a",
      message: "current first conversation",
      checksum: "sha256:server",
      catalogComplete: true,
    });
    const manager = new EventStreamStateManager({
      ...authoritative,
      snapshotRunId: null,
      messages: [],
    }, {
      snapshotCache: cache,
      snapshotCacheScope: "archived-run",
      deferCacheHydration: true,
      initialSnapshotSource: "server",
    });

    expect(manager.hydrateFromCacheScope("archived-run")).toBe(false);
    manager.hydrateFromCaches();

    expect(manager.getSnapshot().runs.map((item) => item.id)).toEqual(["run-a", "run-b"]);
    expect(manager.getSnapshot().messages).toEqual([]);
    expect(manager.getSnapshot().snapshotSource).toBe("server");
  });
});

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:24.153Z","phase":null} -->
## Tool result: call_UqIX9lN0ipv9DSi8QdfdaMB8 · 2026-06-16T21:41:24.153Z

```text
Chunk ID: bc6883
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2479
Output:
import type { EventStreamState, MessageRecord } from "./types";
import { EventStreamSnapshotCacheManager } from "./EventStreamSnapshotCacheManager";

type EventStreamStateListener = (state: EventStreamState) => void;
type EventStreamStateAction = EventStreamState | ((current: EventStreamState) => EventStreamState);
type EventStreamSnapshotSource = NonNullable<EventStreamState["snapshotSource"]>;

function messageTimestampMs(message: MessageRecord) {
  const value = new Date(message.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortMessages(messages: MessageRecord[]) {
  return [...messages].sort((a, b) => {
    const timeDelta = messageTimestampMs(a) - messageTimestampMs(b);
    return timeDelta !== 0 ? timeDelta : a.id.localeCompare(b.id);
  });
}

type RunRecord = EventStreamState["runs"][number];

function mergeByKey<T>(current: T[] | undefined, incoming: T[] | undefined, getKey: (item: T) => string | null | undefined) {
  const incomingItems = incoming ?? [];
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of incomingItems) {
    const key = getKey(item);
    if (key) {
      seen.add(key);
    }
    merged.push(item);
  }

  for (const item of current ?? []) {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function runUpdatedTimestampMs(run: RunRecord) {
  const value = new Date(run.updatedAt || run.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeReadMarkersForVisibleRuns(current: EventStreamState, incoming: EventStreamState) {
  const visibleRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const merged: Record<string, string> = {};

  for (const [runId, readAt] of Object.entries(current.readMarkers ?? {})) {
    if (visibleRunIds.has(runId)) {
      merged[runId] = readAt;
    }
  }

  for (const [runId, readAt] of Object.entries(incoming.readMarkers ?? {})) {
    if (!visibleRunIds.has(runId)) {
      continue;
    }
    if (timestampMs(readAt) >= timestampMs(merged[runId])) {
      merged[runId] = readAt;
    }
  }

  return merged;
}

function mergeScopedCatalog(current: EventStreamState, incoming: EventStreamState) {
  const isSelectedRunScoped = Boolean(incoming.snapshotRunId?.trim());
  const catalogIsPartial = incoming.snapshotScope?.catalog?.complete === false;
  if (!isSelectedRunScoped && !catalogIsPartial) {
    return {
      ...incoming,
      readMarkers: mergeReadMarkersForVisibleRuns(current, incoming),
    };
  }

  const mergedRuns = mergeByKey(current.runs, incoming.runs, (run) => run.id);
  return {
    ...incoming,
    runs: mergedRuns,
    plans: mergeByKey(current.plans, incoming.plans, (plan) => plan.id),
    workers: mergeByKey(current.workers, incoming.workers, (worker) => worker.id),
    sessions: mergeByKey(current.sessions, incoming.sessions, (session) => session.runId),
    readMarkers: mergeReadMarkersForVisibleRuns(current, {
      ...incoming,
      runs: mergedRuns,
    }),
  };
}

function mergeScopedRuns(current: EventStreamState, incoming: EventStreamState, options: {
  serverAuthoritative: boolean;
}) {
  const catalogMergedIncoming = mergeScopedCatalog(current, incoming);
  if (options.serverAuthoritative) {
    return catalogMergedIncoming;
  }

  const incomingRuns = catalogMergedIncoming.runs ?? [];
  if (incomingRuns.length === 0 || !current.runs?.length) {
    return catalogMergedIncoming;
  }

  const currentRunsById = new Map(current.runs.map((run) => [run.id, run]));
  let changed = false;
  const mergedRuns = incomingRuns.map((incomingRun) => {
    const currentRun = currentRunsById.get(incomingRun.id);
    if (!currentRun || runUpdatedTimestampMs(currentRun) <= runUpdatedTimestampMs(incomingRun)) {
      return incomingRun;
    }

    changed = true;
    return {
      ...incomingRun,
      ...currentRun,
    };
  });

  return changed ? { ...catalogMergedIncoming, runs: mergedRuns } : catalogMergedIncoming;
}

/**
 * Supervisor-conversation messages still flow through the `messages`
 * table (worker-attributed messages moved to the unified worker
 * stream). Snapshots declare whether their message run scope is
 * complete; partial updates are additive and must not erase durable
 * conversation messages the client already knows about.
 */
function mergeScopedMessages(current: EventStreamState, incoming: EventStreamState) {
  const incomingMessages = incoming.messages ?? [];
  const incomingMessageIds = new Set(incomingMessages.map((message) => message.id));
  const completeMessageRunIds = new Set(
    incoming.messageScope?.complete ? incoming.messageScope.runIds : [],
  );
  const liveRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const retainedCurrentMessages = (current.messages ?? []).filter((message) => (
    liveRunIds.has(message.runId)
    && !incomingMessageIds.has(message.id)
    && !completeMessageRunIds.has(message.runId)
  ));
  const mergedMessages = sortMessages([
    ...retainedCurrentMessages,
    ...incomingMessages,
  ]);

  if (
    mergedMessages.length === incomingMessages.length
    && mergedMessages.every((message, index) => message === incomingMessages[index])
  ) {
    return incoming;
  }

  return {
    ...incoming,
    messages: mergedMessages,
  };
}

function mergeScopedCachedState(current: EventStreamState, cached: EventStreamState): EventStreamState {
  // hydrateFromCacheScope swaps scopes (e.g. on session switch). The cached
  // payload for the newly-selected scope only contains data that was
  // observed while THAT scope was active — its messages/workers/agents/
  // queuedMessages/executionEvents are a strict subset of what we already
  // know across all runs. Replacing current collections with that subset
  // briefly empties any cross-run sidebar view (notably the Active tab,
  // whose filter is driven by messages+workers+agents+queuedMessages).
  //
  // Initial-mount cache hydration takes a different path (hydrateFromCaches
  // → snapshotCache.hydrateState) that already prefers current values when
  // present and falls back to cached when empty, so the only consumers of
  // this merge are scope transitions where current is server-authoritative.
  // Preserve current state and only adopt the scope-pointer metadata so
  // consumers gating on snapshotRunId still recognize the switch.
  return {
    ...current,
    snapshotRunId: cached.snapshotRunId ?? current.snapshotRunId,
    snapshotChecksum: cached.snapshotChecksum ?? current.snapshotChecksum,
    snapshotScope: cached.snapshotScope ?? current.snapshotScope,
    frontendErrors: [],
  };
}

function authoritativeCatalogExcludesScope(state: EventStreamState, scope: string | null | undefined) {
  const scopedRunId = scope?.trim();
  if (!scopedRunId || state.snapshotSource !== "server" || state.snapshotScope?.catalog?.complete !== true) {
    return false;
  }

  return !(state.runs ?? []).some((run) => run.id === scopedRunId);
}

/**
 * State manager for the global `/api/events` snapshot stream. Worker
 * conversation content (bridge entries, user/supervisor inputs,
 * lifecycle markers) is NOT managed here — it lives in
 * `WorkerEntriesManager` and is fetched per-worker via
 * `/api/workers/:workerId/entries`. This manager owns runs, plans,
 * workers metadata, supervisor messages, planning artifacts, queued
 * messages, recovery state, and review records.
 */
export class EventStreamStateManager {
  private state: EventStreamState;
  private readonly listeners = new Set<EventStreamStateListener>();
  private readonly snapshotCache: EventStreamSnapshotCacheManager;
  private snapshotCacheScope: string | null;

  constructor(initialState: EventStreamState, options: {
    snapshotCache?: EventStreamSnapshotCacheManager;
    snapshotCacheScope?: string | null;
    deferCacheHydration?: boolean;
    initialSnapshotSource?: EventStreamSnapshotSource;
  } = {}) {
    this.snapshotCache = options.snapshotCache ?? new EventStreamSnapshotCacheManager();
    this.snapshotCacheScope = options.snapshotCacheScope?.trim() || null;
    const source = options.initialSnapshotSource;
    const initialWithSource = source ? { ...initialState, snapshotSource: source } : initialState;
    if (options.deferCacheHydration) {
      this.state = initialWithSource;
    } else {
      this.state = {
        ...this.snapshotCache.hydrateState(initialWithSource, this.snapshotCacheScope),
        snapshotSource: "cache",
      };
    }
  }

  hydrateFromCaches() {
    if (authoritativeCatalogExcludesScope(this.state, this.snapshotCacheScope)) {
      return;
    }
    if (
      this.state.snapshotSource === "server"
      && (!this.snapshotCacheScope || this.state.snapshotRunId === this.snapshotCacheScope)
    ) {
      return;
    }
    const cached = this.snapshotCache.hydrateState(this.state, this.snapshotCacheScope);
    if (cached === this.state) {
      return;
    }
    this.state = { ...cached, snapshotSource: "cache" };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  hydrateFromCacheScope(scope: string | null | undefined) {
    this.snapshotCacheScope = scope?.trim() || null;
    if (authoritativeCatalogExcludesScope(this.state, this.snapshotCacheScope)) {
      return false;
    }
    if (
      this.state.snapshotSource === "server"
      && this.snapshotCacheScope
      && this.state.snapshotRunId === this.snapshotCacheScope
    ) {
      return false;
    }
    const cached = this.snapshotCache.getCachedState(this.snapshotCacheScope);
    if (!cached || Object.is(cached, this.state)) {
      return false;
    }

    this.state = {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:32.014Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:32.014Z

```json
{
  "cmd": "sed -n '280,620p' src/app/home/EventStreamStateManager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:32.027Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:32.027Z

```json
{
  "cmd": "sed -n '330,390p' src/app/home/types.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 10000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:32.357Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:32.357Z

```json
{
  "cmd": "sed -n '1,80p' docs/superpowers/learnings/2026-06-15-partial-queue-mutations-must-not-revive-server-absent-rows.md && sed -n '1,90p' docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:32.407Z","phase":null} -->
## Tool result: call_IsTcqusULQBR5ZYk6cbHNytZ · 2026-06-16T21:41:32.407Z

```text
Chunk ID: e3d5db
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 368
Output:
    this.state = {
      ...mergeScopedCachedState(this.state, cached),
      snapshotSource: "cache",
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }
    return true;
  }

  getSnapshot() {
    return this.state;
  }

  subscribe(listener: EventStreamStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setSnapshotCacheScope(scope: string | null | undefined) {
    this.snapshotCacheScope = scope?.trim() || null;
  }

  update(action: EventStreamStateAction, options: { snapshotSource?: EventStreamSnapshotSource } = {}) {
    const incoming = typeof action === "function" ? action(this.state) : action;
    const snapshotSource = options.snapshotSource
      ?? incoming.snapshotSource
      ?? this.state.snapshotSource;
    const incomingWithRuns = mergeScopedRuns(this.state, incoming, {
      serverAuthoritative: snapshotSource === "server",
    });
    const nextState = {
      ...mergeScopedMessages(this.state, incomingWithRuns),
      snapshotSource,
    };

    if (Object.is(nextState, this.state)) {
      return this.state;
    }

    this.state = nextState;
    this.snapshotCache.rememberState(nextState, this.snapshotCacheScope);
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  updateFromServer(action: EventStreamStateAction) {
    return this.update(action, { snapshotSource: "server" });
  }
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:32.408Z","phase":null} -->
## Tool result: call_hmiydiR3G3oZraxt1OBLmkKl · 2026-06-16T21:41:32.408Z

```text
Chunk ID: 7eba05
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 455
Output:
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AuthSessionResponse = {
  enabled: boolean;
  authenticated: boolean;
  currentSession: AuthSessionRecord | null;
  sessions: AuthSessionRecord[];
  configurationError?: string | null;
  publicOrigin?: string | null;
};
export type EventStreamState = {
  messages: MessageRecord[];
  readMarkers?: Record<string, string>;
  plans: PlanRecord[];
  runs: RunRecord[];
  sessions?: SessionRecord[];
  accounts: unknown[];
  agents: AgentSnapshot[];
  workers: ConversationWorkerRecord[];
  planItems: PlanItemRecord[];
  clarifications: ClarificationRecord[];
  executionEvents: ExecutionEventRecord[];
  supervisorInterventions: SupervisorInterventionRecord[];
  queuedMessages?: QueuedConversationMessageRecord[];
  recoveryIncidents?: RecoveryIncidentRecord[];
  recoveryState?: RunRecoveryState | null;
  reviewRuns?: PlanningReviewRunRecord[];
  reviewRounds?: PlanningReviewRoundRecord[];
  reviewFindings?: PlanningReviewFindingRecord[];
  frontendErrors?: AppErrorDescriptor[];
  snapshotRunId?: string | null;
  snapshotChecksum?: string;
  snapshotSource?: "cache" | "optimistic" | "server";
  messageScope?: {
    runIds: string[];
    complete: boolean;
  };
  snapshotScope?: {
    catalog?: {
      complete: boolean;
    };
    executionEvents?: {
      limit: number;
      complete: boolean;
      oldestCreatedAt: string | null;
    };
    supervisorInterventions?: {
      limit: number;
      complete: boolean;
      oldestCreatedAt: string | null;
    };
  };
  workerEntrySeqs?: Record<string, number>;
  workerEntries?: Record<string, WorkerEntry[]>;
};
export type SettingsTab = "general" | "models" | "credentials" | "agents" | "runtime" | "memory";

export type ConversationSidebarTab = "projects" | "recent";


```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:32.413Z","phase":null} -->
## Tool result: call_tQmPMuCaenSWEvk5DZxZ986c · 2026-06-16T21:41:32.413Z

```text
Chunk ID: f9197e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 768
Output:
# Partial Queue Mutations Must Not Revive Server-Absent Rows

**Date:** 2026-06-15
**Context:** OmniHarness queued steering, interrupt-and-send, frontend queue manager
**Symptom:** A force-sent queued message appeared in the worker stream as steered/delivered, but it remained visible in the queued-message drawer.
**Root Cause:** The server delivered the row and authoritative event snapshots correctly omitted it from `queuedMessages`, but the interrupt mutation returned a partial `status: "delivering"` queued row. When delivery completed quickly, the complete empty snapshot could arrive before the mutation success handler, and the older partial response reinserted the row into `BusyMessageQueueManager`.
**Fix:** `BusyMessageQueueManager` now records active queued-message ids that disappear from authoritative server snapshots. Later active upserts for those ids are ignored unless a new server snapshot includes the row again, while terminal mutation rows remove the item and clear pending action flags.
**Verification:** `./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts` passes and covers stale active mutation upserts after an empty server snapshot, server restoration of a genuinely pending row, and terminal mutation row removal.
**Prevention:** Treat mutation responses as partial and potentially stale. Complete server snapshots may erase active queue rows; older partial mutation responses must not be allowed to revive them without a newer authoritative server row.
**Skill/Doc Updates:** No general skill update needed; `client-server-state-invariants` already requires provenance, completeness, and stale-response tests for server-owned arrays.
# Server Empty Queue Must Clear Cache

**Date:** 2026-05-20
**Context:** OmniHarness queued steering, event snapshots, frontend snapshot cache
**Symptom:** A queued steering message delivered to the worker, but the UI kept showing it in the queued-message drawer, so the same user text appeared both in the worker stream and in the queue.
**Root Cause:** The server correctly omits delivered queue rows from `queuedMessages`, but `EventStreamSnapshotCacheManager` treated an authoritative server `queuedMessages: []` the same as missing data and restored stale cached pending queue rows.
**Fix:** Cache hydration now respects server-authoritative snapshots: when `snapshotSource` is `"server"` and an array is present, even an empty array wins over cached data.
**Verification:** `pnpm test tests/app/event-stream-state-manager.test.ts` covers stale cached queued rows being cleared by an empty server queue. `pnpm test tests/server/queued-messages.test.ts` confirms queued-message delivery behavior still passes.
**Prevention:** For server-owned arrays, do not use non-empty array checks as authority checks. Empty arrays can be terminal facts, especially for queues and filtered delivered state.
**Skill/Doc Updates:** No general skill update needed; `client-server-state-invariants` already requires provenance and completeness before treating cached state as authoritative.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:41:47.347Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:41:47.347Z

One important detail from the trace: the exact content was appended repeatedly as ordinary user messages while the original queued row stayed deferred, then one delivery event finally marked the queue row delivered. So I’m tracing both force-steer paths now: drawer “interrupt queued message” and composer “steer active work,” because the stale visible item could be coming from either mutation response path.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:47.347Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:47.347Z

```json
{
  "cmd": "sed -n '780,930p' src/app/home/useHomeMutations.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:47.353Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:47.353Z

```json
{
  "cmd": "sed -n '600,770p' src/server/conversations/queued-messages.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:41:47.488Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:41:47.488Z

```json
{
  "cmd": "sed -n '760,1090p' src/server/conversations/queued-messages.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 38000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:47.530Z","phase":null} -->
## Tool result: call_dpwaIw9a5EAhJKadiwEzKUNK · 2026-06-16T21:41:47.530Z

```text
Chunk ID: d5d5d5
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1513
Output:
        previousPendingCreatedSnapshot,
        hadPendingCreatedSnapshot,
        previousSelectedRunId,
        previousDraftProjectPath,
        previousCommand,
        previousCommandCursor,
      };
    },
    onSuccess: (data, variables) => {
      if (variables.projectPath) {
        gitWorkspaceManager.consumePendingLaunch(variables.projectPath);
      }
      const createdRunId = data.runId ?? data.run?.id ?? variables.requestedRunId;
      const ownsSelection = ownsOptimisticRunSelection({
        requestedRunId: variables.requestedRunId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      });
      if (ownsSelection) {
        clearAttachments();
      }
      if (createdRunId) {
        if (data.run) {
          pendingCreatedConversationSnapshotsRef.current.set(createdRunId, {
            plan: data.plan,
            run: data.run,
            message: data.message,
          });
          setState((current) => appendCreatedConversationSnapshot(current, data));
        }
        if (ownsSelection) {
          setSelectedRunId(createdRunId);
          replaceBrowserConversationPath(createdRunId, null);
        }
      }
    },
    onError: (_error, _variables, context) => {
      if (context) {
        if (context.hadPendingCreatedSnapshot && context.previousPendingCreatedSnapshot) {
          pendingCreatedConversationSnapshotsRef.current.set(context.requestedRunId, context.previousPendingCreatedSnapshot);
        } else {
          pendingCreatedConversationSnapshotsRef.current.delete(context.requestedRunId);
        }
        setState((current) => removeRunFromHomeState(current, context.requestedRunId));
      }
      const ownsSelection = context
        ? ownsOptimisticRunSelection({
          requestedRunId: context.requestedRunId,
          currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
        })
        : false;
      if (context && ownsSelection) {
        setSelectedRunId(context.previousSelectedRunId);
        replaceBrowserConversationPath(context.previousSelectedRunId, context.previousDraftProjectPath);
      }
      const snapshot = homeUiStateManager.getSnapshot();
      if (context && ownsSelection && !snapshot.command.trim()) {
        setCommand(context.previousCommand);
        homeUiSetters.setCommandCursor(context.previousCommandCursor);
      }
    },
  });

  const sendConversationMessage = useMutation({
    onMutate: () => ({
      commandAtStart: homeUiStateManager.getSnapshot().command,
      attachmentsAtStart: homeUiStateManager.getSnapshot().attachments,
    }),
    mutationFn: async (payload: {
      runId: string;
      content: string;
      attachments: PendingChatAttachment[];
      busyAction?: BusyMessageAction;
    }) => {
      const isAutoWorkerSelection = selectedCliAgent === "auto";
      const selectedWorkerType = isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent;
      const resolvedSelectedModel = selectedWorkerType
        ? resolveSelectedWorkerModel(selectedWorkerType as WorkerType, selectedModel)
        : null;
      const uploadedAttachments = await uploadPendingChatAttachments(payload.attachments);
      return requestJson<{
        ok: true;
        message?: MessageRecord;
        queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
      }>(`/api/conversations/${payload.runId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: payload.content,
          attachments: uploadedAttachments,
          busyAction: payload.busyAction,
          preferredWorkerType: selectedWorkerType,
          preferredWorkerModel: isAutoWorkerSelection ? null : resolvedSelectedModel,
          preferredWorkerEffort: selectedEffort.toLowerCase(),
          allowedWorkerTypes: activeAllowedWorkerTypes,
        }),
      }, {
        source: "Conversations",
        action: "Send a conversation message",
      });
    },
    onSuccess: (data, variables, context) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
      }
      if (data.queuedMessage) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
      }
      setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      const snapshot = homeUiStateManager.getSnapshot();
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });
      if (ownsSideEffects && context && shouldClearSubmittedComposer({
        submittedContent: variables.content,
        commandAtStart: context.commandAtStart,
        currentCommand: snapshot.command,
        attachmentsAtStart: context.attachmentsAtStart,
        currentAttachments: snapshot.attachments,
      })) {
        setCommand("");
        clearAttachments();
      }
      if (ownsSideEffects) {
        scrollConversationToBottom();
      }
    },
  });

  const { cancelQueuedMessage, sendQueuedMessageNow, interruptQueuedMessage } = useQueuedMessageMutations({
    setState,
    pendingSentConversationMessagesRef,
    scrollConversationToBottom,
  });

  const autoCommitChat = useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: ManualCommitAction }) => requestJson<{ ok: true; message?: MessageRecord }>(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: getManualCommitPrompt(action) }),
    }, {
      source: "Conversations",
      action: "Commit chat",
    }),
    onSuccess: (data, variables) => {
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
      }
      setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      if (ownsConversationSideEffects({
        runId: variables.runId,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:47.530Z","phase":null} -->
## Tool result: call_TnHOIBAvXlbo6jCC9WpGlt4J · 2026-06-16T21:41:47.530Z

```text
Chunk ID: b3c1df
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1318
Output:
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();

  if (!record || record.runId !== runId || record.status !== "pending") {
    throw Object.assign(new Error("Queued message not found"), { status: 404 });
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
  const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
    resolvePath: (storagePath) => getAppDataPath(storagePath),
  });
  const startedAt = new Date();

  await db.update(queuedConversationMessages).set({
    action: "steer",
    status: "delivering",
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(queuedConversationMessages.id, messageId));

  if (run.mode === "implementation") {
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));
    await db.update(queuedConversationMessages).set({
      action: "steer",
      status: "pending",
      lastError: null,
      updatedAt: startedAt,
      deliveredAt: null,
    }).where(eq(queuedConversationMessages.id, messageId));
    await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
      summary: "Accepted queued message for implementation worker steering.",
      queuedMessageId: messageId,
      action: "steer",
    });
    startSupervisorRun(runId);
    notifyEventStreamSubscribers();

    return {
      ok: true,
      queuedMessage: serializeQueuedConversationMessage({
        ...record,
        action: "steer",
        status: "pending",
        lastError: null,
        updatedAt: startedAt,
        deliveredAt: null,
      }),
    };
  }

  const targetWorker = record.targetWorkerId
    ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
    : null;
  const worker = targetWorker && targetWorker.runId === runId
    ? targetWorker
    : await getLatestRunWorker(runId, record.targetWorkerId);
  if (!worker || worker.runId !== runId) {
    await db.update(queuedConversationMessages).set({
      status: "pending",
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, messageId));
    throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
  }

  if (isWorkerClearlyBusy(worker)) {
    const error = `Ask failed: Agent is busy: ${worker.id}`;
    await db.update(queuedConversationMessages).set({
      action: "steer",
      targetWorkerId: worker.id,
      status: "pending",
      lastError: error,
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, messageId));
    await insertQueueExecutionEvent(runId, "queued_message_deferred", {
      summary: `Worker ${worker.id} is still busy; queued message will be retried.`,
      queuedMessageId: messageId,
      action: "steer",
      error,
    }, worker.id);
    notifyEventStreamSubscribers();

    return {
      ok: true,
      queuedMessage: serializeQueuedConversationMessage({
        ...record,
        targetWorkerId: worker.id,
        action: "steer",
        status: "pending",
        lastError: error,
        updatedAt: startedAt,
        deliveredAt: null,
      }),
    };
  }

  const userMessage = {
    id: messageId,
    runId,
    role: "user",
    kind: "checkpoint",
    content: record.content,
    attachmentsJson: record.attachmentsJson,
    createdAt: startedAt,
  };

  await db.insert(messages).values(userMessage);
  await db.update(runs).set({
    status: run.mode === "planning" ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(runs.id, runId));
  await db.update(workers).set({
    status: "working",
    updatedAt: startedAt,
  }).where(eq(workers.id, worker.id));

  await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
    summary: `Accepted queued message for immediate steering to ${worker.id}.`,
    queuedMessageId: messageId,
    action: "steer",
  }, worker.id);
  notifyEventStreamSubscribers();

  continueQueuedWorkerSteering({
    run,
    worker,
    messageId,
    userMessageId: userMessage.id,
    content: workerContent,
    userText: record.content,
    attachments: normalizedAttachments,
  }).catch((error) => {
    console.error("Queued message immediate steering failed:", error);
  });

  return {
    ok: true,
    message: serializeMessageRecord(userMessage),
    queuedMessage: serializeQueuedConversationMessage({
      ...record,
      targetWorkerId: worker.id,
      action: "steer",
      status: "delivering",
      lastError: null,
      updatedAt: startedAt,
      deliveredAt: null,
    }),
  };
}

async function pendingQueueRecords(runId: string, workerId?: string | null) {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));

  return records.filter((record) => {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:41:47.532Z","phase":null} -->
## Tool result: call_C3CY5yNsi0IL88h5uVZ9ieCX · 2026-06-16T21:41:47.532Z

```text
Chunk ID: 32ee5a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2995
Output:
  };
}

async function pendingQueueRecords(runId: string, workerId?: string | null) {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));

  return records.filter((record) => {
    if (record.status !== "pending") {
      return false;
    }

    if (workerId === undefined) {
      return record.targetWorkerId === null;
    }

    return record.targetWorkerId === workerId;
  });
}

export async function drainQueuedImplementationMessages(runId: string) {
  const records = await pendingQueueRecords(runId);
  let deliveredCount = 0;

  for (const record of records) {
    const now = new Date();
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: now,
    }).where(eq(queuedConversationMessages.id, record.id));

    if (record.action === "steer") {
      const targetWorker = record.targetWorkerId
        ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
        : null;
      const worker = targetWorker && targetWorker.runId === runId && !isCancelledWorkerStatus(targetWorker.status)
        ? targetWorker
        : await getLatestRunWorker(runId, record.targetWorkerId);

      if (!worker || worker.runId !== runId || isCancelledWorkerStatus(worker.status)) {
        await db.update(queuedConversationMessages).set({
          status: "pending",
          lastError: "Conversation worker not found",
          updatedAt: new Date(),
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_deferred", {
          summary: "No active implementation worker is available; queued steering will be retried.",
          queuedMessageId: record.id,
          action: "steer",
          error: "Conversation worker not found",
        });
        continue;
      }

      const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
      const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
        resolvePath: (storagePath) => getAppDataPath(storagePath),
      });
      let interventionId: string | null = null;

      try {
        await runWorkerTurn(worker.id, async () => {
          await db.update(workers).set({
            status: "working",
            updatedAt: now,
          }).where(eq(workers.id, worker.id));
          const intervention = await recordSupervisorIntervention({
            runId,
            workerId: worker.id,
            prompt: workerContent,
            summary: `Sent user steering to ${worker.id}`,
            interventionType: "continue",
          });
          interventionId = intervention.id;
          const response = await askAgent(worker.id, workerContent);
          const deliveredAt = new Date();
          const userMessage = {
            id: randomUUID(),
            runId,
            role: "user" as const,
            kind: "checkpoint" as const,
            content: record.content,
            attachmentsJson: record.attachmentsJson,
            createdAt: record.createdAt,
          };
          await appendUserInputOnDelivery({
            id: userMessage.id,
            runId,
            workerId: worker.id,
            text: record.content,
            deliveredAt,
            attachments: normalizedAttachments.map((attachment) => ({
              id: attachment.id,
              filename: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.size,
            })),
          });
          await db.insert(messages).values(userMessage);
          await db.insert(messages).values({
            id: randomUUID(),
            runId,
            role: "supervisor",
            kind: "update",
            content: `Got it. I sent that to ${formatWorkerLabel(worker)} and will keep watching the run.`,
            attachmentsJson: null,
            createdAt: deliveredAt,
          });
          await persistDeliveredWorkerResponse({
            run: { id: runId, mode: "implementation" },
            workerId: worker.id,
            response,
            deliveredAt,
            userInputEntryId: userMessage.id,
          });
          // Worker response now lives in the unified worker stream.
          await db.update(queuedConversationMessages).set({
            targetWorkerId: worker.id,
            status: "delivered",
            updatedAt: deliveredAt,
            deliveredAt,
            lastError: null,
          }).where(eq(queuedConversationMessages.id, record.id));
          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
            summary: `Delivered queued steering to ${worker.id}.`,
            queuedMessageId: record.id,
            action: "steer",
          }, worker.id);
        });
        deliveredCount += 1;
      } catch (error) {
        const failedAt = new Date();
        await db.update(queuedConversationMessages).set({
          targetWorkerId: worker.id,
          status: isAgentBusyError(error) ? "pending" : "failed",
          lastError: errorMessage(error),
          updatedAt: failedAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        if (isAgentBusyError(error) && interventionId) {
          await db.update(supervisorInterventions).set({
            summary: `Deferred user steering to ${worker.id}; worker is busy.`,
          }).where(eq(supervisorInterventions.id, interventionId));
        }
        await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
          summary: isAgentBusyError(error)
            ? `Worker ${worker.id} is still busy; queued steering will be retried.`
            : `Queued steering delivery failed for ${worker.id}.`,
          queuedMessageId: record.id,
          action: "steer",
          error: errorMessage(error),
        }, worker.id);
      }
      continue;
    }

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user" as const,
      kind: "checkpoint" as const,
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: record.createdAt,
    });

    await db.update(queuedConversationMessages).set({
      status: "delivered",
      updatedAt: now,
      deliveredAt: now,
      lastError: null,
    }).where(eq(queuedConversationMessages.id, record.id));
    await insertQueueExecutionEvent(runId, "queued_message_delivered", {
      summary: "Delivered queued message into the supervisor conversation.",
      queuedMessageId: record.id,
    });
    deliveredCount += 1;
  }

  if (deliveredCount > 0) {
    notifyEventStreamSubscribers();
  }

  return deliveredCount;
}

export async function drainQueuedWorkerMessages({
  runId,
  workerId,
  snapshot,
}: {
  runId: string;
  workerId: string;
  snapshot?: WorkerSnapshot | null;
}) {
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker || worker.runId !== runId) {
    return 0;
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    return 0;
  }

  const records = await pendingQueueRecords(runId, workerId);
  let deliveredCount = 0;

  for (const record of records) {
    const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
    const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
      resolvePath: (storagePath) => getAppDataPath(storagePath),
    });
    const startedAt = new Date();

    const userMessage = {
      id: randomUUID(),
      runId,
      role: "user" as const,
      kind: "checkpoint" as const,
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: startedAt,
    };
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: startedAt,
      lastError: null,
    }).where(eq(queuedConversationMessages.id, record.id));
    await db.update(runs).set({
      status: run.mode === "planning" ? "working" : "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));

    try {
      await runWorkerTurn(workerId, async () => {
        await db.update(workers).set({
          status: "working",
          updatedAt: startedAt,
        }).where(eq(workers.id, workerId));
        const snapshotBeforeAsk = snapshot ?? await Promise.resolve(getAgent(workerId)).catch(() => null);
        const deliveredAt = new Date();
        await appendUserInputOnDelivery({
          id: userMessage.id,
          runId,
          workerId,
          text: record.content,
          deliveredAt,
          attachments: normalizedAttachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
          })),
        });
        await db.insert(messages).values(userMessage);
        if (await answerPendingWorkerElicitation({
          run,
          worker,
          snapshot: snapshotBeforeAsk,
          content: record.content,
          deliveredAt,
        })) {
          await db.update(queuedConversationMessages).set({
            status: "delivered",
            lastError: null,
            updatedAt: deliveredAt,
            deliveredAt,
          }).where(eq(queuedConversationMessages.id, record.id));
          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
            summary: `Delivered queued answer to ${workerId}'s pending question.`,
            queuedMessageId: record.id,
            delivery: "elicitation",
          }, workerId);
          return;
        }

        const response = await askAgent(workerId, workerContent);
        await persistDeliveredWorkerResponse({
          run,
          workerId,
          response,
          deliveredAt,
          userInputEntryId: userMessage.id,
        });
        // Worker response now lives in the unified worker stream.
        await db.update(queuedConversationMessages).set({
          status: "delivered",
          lastError: null,
          updatedAt: deliveredAt,
          deliveredAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
          summary: `Delivered queued message to ${workerId}.`,
          queuedMessageId: record.id,
        }, workerId);
      });
      deliveredCount += 1;
    } catch (error) {
      const failedAt = new Date();
      await db.update(queuedConversationMessages).set({
        status: isAgentBusyError(error) ? "pending" : "failed",
        lastError: errorMessage(error),
        updatedAt: failedAt,
      }).where(eq(queuedConversationMessages.id, record.id));
      await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
        summary: isAgentBusyError(error)
          ? `Worker ${workerId} is still busy; queued message will be retried.`
          : `Queued message delivery failed for ${workerId}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
      }, workerId);

      if (isAgentNotFoundError(error)) {
        await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
          summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
          queuedMessageId: record.id,
          error: errorMessage(error),
        }, workerId);
        await reconcileRunRecovery({
          runId,
          liveAgents: [],
          source: "queued-message-drain",
        });
      }

      if (!isAgentBusyError(error)) {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:42:01.254Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:42:01.254Z

I found a concrete server-side gap too: the non-interrupt drain paths update queue rows to `pending` after busy deferrals but don’t always notify subscribers on those status/error changes. For the final delivery they do notify, but I’m still hunting the specific “delivered but drawer still shows it” path because this session’s row did reach `delivered`.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:01.260Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:42:01.260Z

```json
{
  "cmd": "sed -n '1090,1160p' src/server/conversations/queued-messages.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:01.260Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:42:01.260Z

```json
{
  "cmd": "rg -n \"sendConversationMessage\\.mutate|sendConversationMessage|busyAction|send_steer|send_queue|interruptQueuedMessage\\.mutate|interruptQueuedMessage\" src/app src/components -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:01.476Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:42:01.476Z

```json
{
  "cmd": "rg -n \"messages route|busyAction|createQueuedConversationMessage|sendConversationMessage\" src/runtime/http/routes src/server/conversations -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:01.535Z","phase":null} -->
## Tool result: call_AzWWXmymdL9HzIG703Yg51gf · 2026-06-16T21:42:01.535Z

```text
Chunk ID: 75a260
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 48
Output:
      if (!isAgentBusyError(error)) {
        break;
      }
    }
  }

  if (deliveredCount > 0 || records.length > 0) {
    notifyEventStreamSubscribers();
  }

  return deliveredCount;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:01.535Z","phase":null} -->
## Tool result: call_s3DxIrr3h5iqOait4cseH4Dg · 2026-06-16T21:42:01.535Z

```text
Chunk ID: b384d3
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 969
Output:
src/components/home/ConversationComposer.tsx:67:  onSendConversationMessage: (content: string, busyAction?: BusyMessageAction) => void;
src/components/home/ConversationComposer.tsx:144:  const sendButtonTitle = composerBehavior.submitAction === "send_queue"
src/components/home/ConversationComposer.tsx:146:    : composerBehavior.submitAction === "send_steer" && composerBehavior.allowAlternateBusyAction
src/components/home/ConversationComposer.tsx:148:      : composerBehavior.submitAction === "send_steer"
src/app/home/useComposerController.ts:33:  onSendConversationMessage: (content: string, attachments: PendingChatAttachment[], busyAction?: BusyMessageAction) => void;
src/app/home/ComposerContainer.tsx:72:  onSendConversationMessage: (content: string, attachments: PendingChatAttachment[], busyAction?: BusyMessageAction) => void;
src/app/home/ComposerContainer.tsx:239:      onSendConversationMessage={(content, busyAction) => onSendConversationMessage(content, attachments, busyAction)}
src/app/home/useHomeMutations.ts:842:  const sendConversationMessage = useMutation({
src/app/home/useHomeMutations.ts:851:      busyAction?: BusyMessageAction;
src/app/home/useHomeMutations.ts:869:          busyAction: payload.busyAction,
src/app/home/useHomeMutations.ts:909:  const { cancelQueuedMessage, sendQueuedMessageNow, interruptQueuedMessage } = useQueuedMessageMutations({
src/app/home/useHomeMutations.ts:1206:    sendConversationMessage,
src/app/home/useHomeMutations.ts:1209:    interruptQueuedMessage,
src/app/home/busy-message-behavior.ts:3:export type BusyComposerSubmitAction = "send_normal" | "send_queue" | "send_steer" | "stop";
src/app/home/busy-message-behavior.ts:47:          submitAction: "send_steer",
src/app/home/busy-message-behavior.ts:53:          submitAction: "send_queue",
src/app/home/busy-message-behavior.ts:71:  if (submitAction === "send_queue") {
src/app/home/busy-message-behavior.ts:75:  if (submitAction === "send_steer") {
src/app/home/useAppErrors.ts:13:  sendConversationMessageError?: unknown;
src/app/home/useAppErrors.ts:36:  sendConversationMessageError,
src/app/home/useAppErrors.ts:81:    if (sendConversationMessageError) {
src/app/home/useAppErrors.ts:82:      errors.push(buildInlineError(sendConversationMessageError, {
src/app/home/useAppErrors.ts:163:    sendConversationMessageError,
src/app/home/useQueuedMessageMutations.ts:102:  const interruptQueuedMessage = useMutation({
src/app/home/useQueuedMessageMutations.ts:177:    interruptQueuedMessage,
src/app/home/HomeApp.tsx:627:    sendConversationMessage,
src/app/home/HomeApp.tsx:630:    interruptQueuedMessage,
src/app/home/HomeApp.tsx:975:    sendConversationMessageError: sendConversationMessage.error,
src/app/home/HomeApp.tsx:998:    isPending: sendConversationMessage.isPending,
src/app/home/HomeApp.tsx:999:    mutationRunId: sendConversationMessage.variables?.runId,
src/app/home/HomeApp.tsx:1007:    isPending: interruptQueuedMessage.isPending,
src/app/home/HomeApp.tsx:1008:    mutationRunId: interruptQueuedMessage.variables?.runId,
src/app/home/HomeApp.tsx:1022:    isPending: sendConversationMessage.isPending,
src/app/home/HomeApp.tsx:1023:    mutationRunId: sendConversationMessage.variables?.runId,
src/app/home/HomeApp.tsx:1120:        if (selectedRunId) interruptQueuedMessage.mutate({ runId: selectedRunId, messageId });
src/app/home/HomeApp.tsx:1126:        if (selectedRunId) interruptQueuedMessage.mutate({ runId: selectedRunId, draft: draft ?? undefined });
src/app/home/HomeApp.tsx:1128:      onSendConversationMessage={(content, attachments, busyAction) => {
src/app/home/HomeApp.tsx:1129:        if (selectedRunId) sendConversationMessage.mutate({ runId: selectedRunId, content, attachments, busyAction });
src/app/home/HomeApp.tsx:1336:              sendConversationMessage.mutate({ runId: selectedRunId, content, attachments: [] });

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:01.535Z","phase":null} -->
## Tool result: call_R5MAbN5Tuk8eXD8dVRT1Wg7j · 2026-06-16T21:42:01.535Z

```text
Chunk ID: 36ff43
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 690
Output:
src/server/conversations/send-message.ts:23:import { createQueuedConversationMessage, type BusyMessageAction } from "./queued-messages";
src/server/conversations/send-message.ts:662:  busyAction?: BusyMessageAction | null;
src/server/conversations/send-message.ts:900:export async function sendConversationMessage(args: SendConversationMessageArgs) {
src/server/conversations/send-message.ts:901:  return runConversationMutation(args.runId, () => sendConversationMessageUnlocked(args));
src/server/conversations/send-message.ts:904:async function sendConversationMessageUnlocked({
src/server/conversations/send-message.ts:908:  busyAction = null,
src/server/conversations/send-message.ts:945:  if (isSupervisedRun(run) && (busyAction === "queue" || busyAction === "steer")) {
src/server/conversations/send-message.ts:946:    const queuedMessage = await createQueuedConversationMessage({
src/server/conversations/send-message.ts:956:  if (busyAction === "queue") {
src/server/conversations/send-message.ts:965:    const queuedMessage = await createQueuedConversationMessage({
src/server/conversations/send-message.ts:1045:  if (busyAction === "steer" && ["starting", "working", "stuck"].includes(worker.status.trim().toLowerCase().split(":")[0] ?? "")) {
src/server/conversations/send-message.ts:1046:    const queuedMessage = await createQueuedConversationMessage({
src/server/conversations/send-message.ts:1101:    if (busyAction === "steer") {
src/server/conversations/send-message.ts:1116:          const queuedMessage = await createQueuedConversationMessage({
src/server/conversations/send-message.ts:1175:    if (busyAction === "steer" && isAgentBusyError(error)) {
src/server/conversations/send-message.ts:1177:      const queuedMessage = await createQueuedConversationMessage({
src/server/conversations/queued-messages.ts:323:export async function createQueuedConversationMessage({
src/server/conversations/queued-message-interrupt.ts:17:  createQueuedConversationMessage,
src/server/conversations/queued-message-interrupt.ts:624:  const created = await createQueuedConversationMessage({
src/runtime/http/routes/conversation-messages.ts:3:import { sendConversationMessage } from "@/server/conversations/send-message";
src/runtime/http/routes/conversation-messages.ts:66:    const busyAction = parseBusyMessageAction(body?.busyAction);
src/runtime/http/routes/conversation-messages.ts:93:      const result = await sendConversationMessage({
src/runtime/http/routes/conversation-messages.ts:97:        busyAction,
src/runtime/http/routes/conversation-messages.ts:103:      probe.mark("sendConversationMessage");
src/runtime/http/routes/conversation-messages.ts:109:    const result = await provider.sendInput({ runId, content, attachments, busyAction });

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-16T21:42:01.542Z","phase":null} -->
## User · 2026-06-16T21:42:01.542Z


# Files mentioned by the user:

## codex-clipboard-a084a6e8-58ea-40bf-8d88-703f4cdfd870.png: /Users/masterman/.codex/attachments/7e0744ad-118d-4fe1-ad38-748eed55d4e4/codex-clipboard-a084a6e8-58ea-40bf-8d88-703f4cdfd870.png

## My request for Codex:
look at it. This state keeps disappearing and reappearing, where the queued message and the "working..." disappear and come back


![Attached image](../../../attachments/019ed25f-7558-78e0-8c6c-88c0a8ba0731/l1zdT7yAXBQAAAABJRU5ErkJggg-959e13b5eb4a7355)

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:42:17.573Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:42:17.573Z

Yep, I see it in the screenshot: the terminal is rendering `Working...` while the queued drawer still contains the exact delivered row. The disappearing/reappearing makes this feel like two competing snapshots: one clean server state, then a stale cache or runtime snapshot rehydrating the old “working + queued” view.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:26.469Z","phase":null} -->
## Tool call: view_image · 2026-06-16T21:42:26.469Z

```json
{
  "path": "/Users/masterman/.codex/attachments/7e0744ad-118d-4fe1-ad38-748eed55d4e4/codex-clipboard-a084a6e8-58ea-40bf-8d88-703f4cdfd870.png",
  "detail": "high"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:26.580Z","phase":null} -->
## Tool result: call_7rUHa4MaNcfWUpJNQK0pwhB5 · 2026-06-16T21:42:26.580Z

Content was stored in 1 bounded part:

- [Stored content part 1](../../../attachments/019ed25f-7558-78e0-8c6c-88c0a8ba0731/tool-result-tool-result-function_call_output-call_7rUHa4MaNcfWUpJNQK0pwhB5-part-001.txt)

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:42:44.650Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:42:44.650Z

I’m going to ask the running app what it is currently serving for this selected run, not just SQLite. If `/api/events` says no queued messages and idle, then the frontend is definitely reintroducing stale state after a clean server frame.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:44.655Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:42:44.655Z

```json
{
  "cmd": "curl -sS -D - 'http://localhost:3035/api/events?snapshot=1&selectedRunId=5eb40b0d5030' | head -c 12000",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:44.655Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:42:44.655Z

```json
{
  "cmd": "curl -sS 'http://localhost:3035/api/events/log?runId=5eb40b0d5030' | head -c 12000",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:42:44.859Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:42:44.859Z

```json
{
  "cmd": "sed -n '1,220p' src/runtime/http/routes/events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:45.819Z","phase":null} -->
## Tool result: call_SBcHzKqxx5Y9WhVskhBDt8XB · 2026-06-16T21:42:45.819Z

```text
Chunk ID: 7d2fcd
Wall time: 1.0029 seconds
Process running with session ID 43101
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:45.819Z","phase":null} -->
## Tool result: call_kREcBgj3SdaRUdeDKttz9Nuq · 2026-06-16T21:42:45.819Z

```text
Chunk ID: e1de4b
Wall time: 1.0029 seconds
Process running with session ID 40815
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:42:45.819Z","phase":null} -->
## Tool result: call_mtEIoMw1StuPk4ij4vtTaIYS · 2026-06-16T21:42:45.819Z

```text
Chunk ID: 3ed4bf
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2225
Output:
import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, planItems, clarifications, queuedConversationMessages, recoveryIncidents, planningReviewRuns, planningReviewRounds, processSessions, conversationReadMarkers } from "@/server/db/schema";
import { listExecutionEventsForSnapshot } from "@/server/events/execution-event-store";
import { listSupervisorInterventionsForSnapshot } from "@/server/supervisor/intervention-store";
import { listPlanningReviewFindingsForSnapshot } from "@/server/planning/review-artifact-store";
import { BRIDGE_URL } from "@/server/bridge-client";
import { isTerminalRunStatus } from "@/lib/run-status";
import { buildAppError, type AppErrorPayload } from "@/server/api-errors";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
import { readWorkerLatestSeq } from "@/server/workers/output-store";
import { getEventStreamNotificationVersion, waitForEventStreamNotification } from "@/server/events/live-updates";
import {
  getEventCursor,
  getNamedEventsSince,
  recordSnapshotMarker,
} from "@/server/events/named-events";
import { withEventPayloadChecksum } from "@/server/events/payload-checksum";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import { serializeQueuedConversationMessage } from "@/server/conversations/queued-message-records";
import { buildAwaitingUserQuestionInvariantErrors } from "@/server/events/lifecycle-invariants";
import { serializeSessionRecord } from "@/server/session-providers/session-records";
import { reconcileOrphanedProcessSessions } from "@/server/session-providers/process-store";
import { reconcilePersistedReloadZombies } from "@/server/runs/persisted-zombie-reconciler";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";
import { toNextRequest } from "./next-request";

const STREAM_REFRESH_INTERVAL_MS = 15_000;
const RUNTIME_AGENT_GRACE_MS = 150;
const RUNTIME_AGENT_TIMEOUT_MS = 5000;
const EXECUTION_EVENT_LIMIT = 100;
const SUPERVISOR_INTERVENTION_LIMIT = 50;
const PLANNING_REVIEW_FINDING_LIMIT = 50;
const EVENT_PAYLOAD_CACHE_LIMIT = 50;

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      fetch(url, { signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Agent runtime list request timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function readPersistedEventRecords(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  await reconcileOrphanedProcessSessions();
  probe?.mark("reconcile");
  await reconcilePersistedReloadZombies({
    selectedRunId: options.selectedRunId,
    source: "events-snapshot",
  });
  probe?.mark("reconcile.zombies");
  const requestedSelectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
  probe?.mark("q.plans");
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
  probe?.mark("q.runs");
  const visibleRunIds = allRuns.map((run) => run.id);
  const selectedRun = requestedSelectedRunId ? allRuns.find((run) => run.id === requestedSelectedRunId) ?? null : null;
  const selectedRunId = selectedRun?.id ?? null;
  const selectedPlanId = selectedRun?.planId ?? null;
  const transcriptRunIds = selectedRunId
    ? [
        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
        selectedRunId,
      ]
    : [];

  const [
    msgs,
    allAccounts,
    allWorkers,
    selectedAgentWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allReviewRuns,
    allReviewRounds,
    allReviewFindings,
    allProcessSessions,
    allReadMarkers,
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
      : [],
    db.select().from(accounts),
    db.select({
      id: workers.id,
      runId: workers.runId,
      type: workers.type,
      status: workers.status,
      workerNumber: workers.workerNumber,
      title: workers.title,
      initialPrompt: workers.initialPrompt,
      createdAt: workers.createdAt,
      updatedAt: workers.updatedAt,
    }).from(workers).where(visibleRunIds.length > 0 ? inArray(workers.runId, visibleRunIds) : eq(workers.id, "__none__")).orderBy(asc(workers.runId), asc(workers.createdAt), asc(workers.id)),
    selectedRunId
      ? db.select({
        id: workers.id,
        runId: workers.runId,
        type: workers.type,
        status: workers.status,
        cwd: workers.cwd,
        outputLog: workers.outputLog,
        currentText: workers.currentText,
        lastText: workers.lastText,
        bridgeSessionId: workers.bridgeSessionId,
        bridgeSessionMode: workers.bridgeSessionMode,
        workerNumber: workers.workerNumber,
        title: workers.title,
        initialPrompt: workers.initialPrompt,
        activeWorkStartedAt: workers.activeWorkStartedAt,
        activeWorkDurationMs: workers.activeWorkDurationMs,
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
      }).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : [],
    selectedPlanId
      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
      : [],
    selectedRunId
      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt), desc(clarifications.id))
      : [],
    selectedRunId
      ? listExecutionEventsForSnapshot(selectedRunId, EXECUTION_EVENT_LIMIT)
      : [],
    selectedRunId
      ? listSupervisorInterventionsForSnapshot(selectedRunId, SUPERVISOR_INTERVENTION_LIMIT)
      : [],
    selectedRunId
      ? db.select().from(queuedConversationMessages)
        .where(and(
          eq(queuedConversationMessages.runId, selectedRunId),
          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
        ))
        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
      : [],
    selectedRunId
      ? db.select().from(recoveryIncidents)
        .where(eq(recoveryIncidents.runId, selectedRunId))
        .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
        .limit(20)
      : [],
    selectedRunId
      ? db.select().from(planningReviewRuns).where(eq(planningReviewRuns.runId, selectedRunId)).orderBy(desc(planningReviewRuns.createdAt), desc(planningReviewRuns.id))
      : [],
    selectedRunId
      ? db.select().from(planningReviewRounds).where(eq(planningReviewRounds.runId, selectedRunId)).orderBy(asc(planningReviewRounds.roundNumber))
      : [],
    selectedRunId
      ? listPlanningReviewFindingsForSnapshot(selectedRunId, PLANNING_REVIEW_FINDING_LIMIT)
      : [],
    db.select().from(processSessions),
    db.select().from(conversationReadMarkers).where(visibleRunIds.length > 0 ? inArray(conversationReadMarkers.runId, visibleRunIds) : eq(conversationReadMarkers.runId, "__none__")),
  ]);
  probe?.mark("q.parallel15");

  return {
    msgs,
    allPlans,
    allRuns,
    allAccounts,
    allWorkers,
    selectedAgentWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allReviewRuns,
    allReviewRounds,
    allReviewFindings,
    allProcessSessions,
    allReadMarkers,
  };
}


type EventPayloadOptions = {
  selectedRunId?: string | null;
};

type PersistedEventRecords = Awaited<ReturnType<typeof readPersistedEventRecords>>;
type EventPayload = ReturnType<typeof buildEventPayload>;

const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
const AGENT_TEXT_FIELD_LIMIT = 4_000;
const EXECUTION_EVENT_DETAIL_LIMIT = 1_000;
const SUPERVISOR_INTERVENTION_TEXT_LIMIT = 2_000;

function truncateText(value: string | null | undefined, limit: number) {
  if (!value || value.length <= limit) {
    return value ?? "";
  }

  return `${value.slice(0, limit)}

[Truncated ${value.length - limit} characters in live payload]`;
}


```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:43:00.946Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:43:00.946Z

The snapshot endpoint is slow or hanging, which is itself useful: the UI flicker may be alternating between stale cached state and a delayed/partial server frame. I’ll poll that request output and then inspect the hot path that builds agent snapshots.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:00.964Z","phase":null} -->
## Tool call: write_stdin · 2026-06-16T21:43:00.964Z

```json
{
  "session_id": 43101,
  "chars": "",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:00.974Z","phase":null} -->
## Tool call: write_stdin · 2026-06-16T21:43:00.974Z

```json
{
  "session_id": 40815,
  "chars": "",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:01.534Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:01.534Z

```json
{
  "cmd": "sed -n '220,520p' src/runtime/http/routes/events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 36000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:01.573Z","phase":null} -->
## Tool result: call_sOEX2uIOwL8fyuGhveWDEx1K · 2026-06-16T21:43:01.573Z

```text
Chunk ID: 5dcfba
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 106
Output:
HTTP/1.1 401 Unauthorized
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
content-type: application/json
date: Tue, 16 Jun 2026 21:42:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":{"message":"Authentication required.","source":"Events","action":"Stream live updates","suggestion":"Fill in the required input and retry.","status":401}}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:01.574Z","phase":null} -->
## Tool result: call_k80rb7BASOylkQRwM8sA887M · 2026-06-16T21:43:01.574Z

```text
Chunk ID: da14ff
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3000
Output:
{"resyncRequired":false,"lastEventId":20904,"events":[{"id":20405,"emittedAt":1781645933109,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20408,"emittedAt":1781645933209,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20409,"emittedAt":1781645933211,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20412,"emittedAt":1781645933370,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20413,"emittedAt":1781645933375,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20416,"emittedAt":1781645933480,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20417,"emittedAt":1781645933489,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20420,"emittedAt":1781645933610,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20421,"emittedAt":1781645933614,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20424,"emittedAt":1781645933705,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20425,"emittedAt":1781645933707,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20428,"emittedAt":1781645933811,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20429,"emittedAt":1781645933812,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20432,"emittedAt":1781645933920,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20433,"emittedAt":1781645933957,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20436,"emittedAt":1781645934069,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20437,"emittedAt":1781645934082,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20441,"emittedAt":1781645934246,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20442,"emittedAt":1781645934257,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20447,"emittedAt":1781645937128,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20448,"emittedAt":1781645937424,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20454,"emittedAt":1781645937934,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20455,"emittedAt":1781645937983,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20458,"emittedAt":1781645938036,"runId":"5eb40b0d5030","event":{"kind":"worker.entry_appended","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","seq":1621}},{"id":20459,"emittedAt":1781645938040,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20463,"emittedAt":1781645938155,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20464,"emittedAt":1781645938159,"runId":"5eb40b0d5030","event":{"kind":"worker.entry_appended","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","seq":1622}},{"id":20465,"emittedAt":1781645938164,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20468,"emittedAt":1781645938297,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20469,"emittedAt":1781645938303,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20472,"emittedAt":1781645938416,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20473,"emittedAt":1781645938429,"runId":"5eb40b0d5030","event":{"kind":"worker.entry_appended","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","seq":1623}},{"id":20474,"emittedAt":1781645938430,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20477,"emittedAt":1781645938604,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20478,"emittedAt":1781645938630,"runId":"5eb40b0d5030","event":{"kind":"worker.entry_appended","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","seq":1624}},{"id":20479,"emittedAt":1781645938632,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20484,"emittedAt":1781645938767,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20485,"emittedAt":1781645938772,"runId":"5eb40b0d5030","event":{"kind":"worker.entry_appended","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","seq":1625}},{"id":20486,"emittedAt":1781645938777,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20489,"emittedAt":1781645938900,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20490,"emittedAt":1781645938903,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20493,"emittedAt":1781645939019,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20497,"emittedAt":1781645939221,"runId":"5eb40b0d5030","event":{"kind":"worker.entry_appended","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","seq":1626}},{"id":20498,"emittedAt":1781645939255,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}},{"id":20502,"emittedAt":1781645939467,"runId":"5eb40b0d5030","event":{"kind":"queue.drain_decision","runId":"5eb40b0d5030","workerId":"5eb40b0d5030-worker-1","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainab
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:01.574Z","phase":null} -->
## Tool result: call_nn5wM5mj2aZbbWlN9x5x3gqZ · 2026-06-16T21:43:01.574Z

```text
Chunk ID: cc951f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2729
Output:

function compactWorkerRecord(worker: PersistedEventRecords["allWorkers"][number]) {
  return {
    id: worker.id,
    runId: worker.runId,
    type: worker.type,
    status: worker.status,
    workerNumber: worker.workerNumber,
    title: worker.title,
    initialPrompt: truncateText(worker.initialPrompt, WORKER_INITIAL_PROMPT_PREVIEW_LIMIT),
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}

function selectedRunWorkers(
  records: PersistedEventRecords,
  options: EventPayloadOptions,
) {
  const selectedRunId = resolveVisibleSelectedRunId(records, options);
  if (!selectedRunId) {
    return [];
  }

  return records.selectedAgentWorkers;
}

function resolveVisibleSelectedRunId(records: PersistedEventRecords, options: EventPayloadOptions) {
  const requested = options.selectedRunId?.trim();
  if (!requested) {
    return null;
  }

  return records.allRuns.some((run) => run.id === requested) ? requested : null;
}

function visibleSelectedRunIds(records: PersistedEventRecords, options: EventPayloadOptions) {
  const selectedRunId = resolveVisibleSelectedRunId(records, options);
  return selectedRunId ? new Set([selectedRunId]) : null;
}

function selectedMessageRunIds(records: PersistedEventRecords, options: EventPayloadOptions) {
  const selectedRunId = resolveVisibleSelectedRunId(records, options);
  if (!selectedRunId) {
    return [];
  }

  const selectedRun = records.allRuns.find((run) => run.id === selectedRunId);
  return [
    ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
    selectedRunId,
  ];
}

function compactExecutionEvent(event: PersistedEventRecords["allExecutionEvents"][number]) {
  return {
    ...event,
    details: compactExecutionEventDetails(event.details),
  };
}

function compactExecutionEventDetails(details: string | null) {
  if (!details?.trim()) {
    return details ?? null;
  }

  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const compacted: Record<string, unknown> = {};

    for (const key of [
      "summary",
      "reason",
      "error",
      "mode",
      "seconds",
      "recoveryState",
      "recommendedAction",
      "resetAt",
      "resumeAt",
      "scheduledWakeAt",
      "quotaResetSource",
      "quotaResetConfidence",
      "retryAfterMs",
      "provider",
      "sourceType",
      "rawText",
    ]) {
      const value = parsed[key];
      if (typeof value === "string") {
        compacted[key] = truncateText(value, EXECUTION_EVENT_DETAIL_LIMIT);
      } else if (typeof value === "number") {
        compacted[key] = value;
      }
    }

    return Object.keys(compacted).length > 0 ? JSON.stringify(compacted) : "{}";
  } catch {
    return JSON.stringify({
      summary: truncateText(details, EXECUTION_EVENT_DETAIL_LIMIT),
    });
  }
}

function compactSupervisorIntervention(intervention: PersistedEventRecords["allSupervisorInterventions"][number]) {
  return {
    ...intervention,
    prompt: truncateText(intervention.prompt, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
    summary: truncateText(intervention.summary, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
  };
}

function compactReviewFinding(finding: PersistedEventRecords["allReviewFindings"][number]) {
  return {
    ...finding,
    details: truncateText(finding.details, 2_000),
    recommendation: truncateText(finding.recommendation, 2_000),
  };
}

function compactRecoveryIncident(incident: PersistedEventRecords["allRecoveryIncidents"][number]) {
  return {
    id: incident.id,
    runId: incident.runId,
    workerId: incident.workerId,
    queuedMessageId: incident.queuedMessageId,
    kind: incident.kind,
    status: incident.status,
    autoAttemptCount: incident.autoAttemptCount,
    lastError: truncateText(incident.lastError, 2_000),
    details: compactExecutionEventDetails(incident.details),
    detectedAt: incident.detectedAt,
    updatedAt: incident.updatedAt,
    resolvedAt: incident.resolvedAt,
  };
}

function deriveRecoveryState(incidents: PersistedEventRecords["allRecoveryIncidents"]) {
  const active = incidents.find((incident) => (
    incident.status === "open"
    || incident.status === "recovering"
    || incident.status === "needs_user"
    || incident.status === "failed"
  ));
  if (!active) {
    return null;
  }

  let parsedDetails: Record<string, unknown> = {};
  try {
    parsedDetails = active.details ? JSON.parse(active.details) as Record<string, unknown> : {};
  } catch {
    parsedDetails = {};
  }

  return {
    kind: String(parsedDetails.recoveryState ?? active.kind),
    status: active.status,
    workerId: active.workerId,
    queuedMessageId: active.queuedMessageId,
    message: typeof parsedDetails.reason === "string" ? parsedDetails.reason : active.lastError,
    recommendedAction: String(parsedDetails.recommendedAction ?? (
      active.status === "recovering" ? "none" : "manual_resume"
    )),
    lastError: active.lastError,
    attemptCount: active.autoAttemptCount,
    nextAttemptAt: typeof parsedDetails.nextAttemptAt === "string" ? parsedDetails.nextAttemptAt : null,
    resumeAt: typeof parsedDetails.resumeAt === "string" ? parsedDetails.resumeAt : null,
    quotaResetSource: typeof parsedDetails.quotaResetSource === "string" ? parsedDetails.quotaResetSource : null,
    quotaResetConfidence: typeof parsedDetails.quotaResetConfidence === "string" ? parsedDetails.quotaResetConfidence : null,
    policyDecision: typeof parsedDetails.decision === "string" ? parsedDetails.decision : null,
  };
}

function compactAgentSnapshot(agent: ReturnType<typeof buildLiveWorkerSnapshots>[number]) {
  // Worker conversation content (outputEntries) is no longer carried
  // on the /api/events snapshot. Clients fetch it via
  // /api/workers/:workerId/entries through `WorkerEntriesManager`. The
  // agents[] array stays for non-content metadata: state, the
  // "thinking…" indicator, bridge-missing flag, last error.
  return {
    ...agent,
    outputEntries: [],
    renderedOutput: null,
    currentText: truncateText(agent.currentText, AGENT_TEXT_FIELD_LIMIT),
    lastText: truncateText(agent.lastText, AGENT_TEXT_FIELD_LIMIT),
    outputLog: truncateText(agent.outputLog, AGENT_TEXT_FIELD_LIMIT),
    displayText: truncateText(agent.displayText, AGENT_TEXT_FIELD_LIMIT),
    stderrBuffer: (agent.stderrBuffer ?? []).slice(-10).map((line) => truncateText(line, 2_000)),
  };
}

async function buildWorkerEntrySeqs(workers: Array<{ id: string; runId: string }>) {
  const seqs = await Promise.all(
    workers.map(async (worker) => {
      const seq = await readWorkerLatestSeq(worker.runId, worker.id);
      return seq > 0 ? [worker.id, seq] as const : null;
    }),
  );
  return Object.fromEntries(seqs.filter((seq): seq is readonly [string, number] => Boolean(seq)));
}

function filterRuntimeAgentsForWorkers(rawAgents: unknown[], scopedWorkers: PersistedEventRecords["allWorkers"]) {
  const workerIds = new Set(scopedWorkers.map((worker) => worker.id));
  if (workerIds.size === 0) {
    return [];
  }

  return rawAgents.filter((agent) => {
    if (typeof agent !== "object" || agent === null) {
      return false;
    }

    const name = (agent as { name?: unknown }).name;
    return typeof name === "string" && workerIds.has(name);
  });
}

function buildEventPayload(
  records: PersistedEventRecords,
  agentsData: ReturnType<typeof buildLiveWorkerSnapshots>,
  frontendErrors: AppErrorPayload[] = [],
  options: EventPayloadOptions = {},
  workerEntrySeqs: Record<string, number> = {},
) {
  const selectedRunId = resolveVisibleSelectedRunId(records, options);
  const runIds = visibleSelectedRunIds(records, options);
  const messageRunIds = selectedMessageRunIds(records, options);
  const lifecycleErrors = buildAwaitingUserQuestionInvariantErrors({
    runs: records.allRuns,
    messages: records.msgs,
    clarifications: records.allClarifications,
    selectedRunId: options.selectedRunId,
  });
  const processSessionsByRunId = new Map<string, PersistedEventRecords["allProcessSessions"][number]>(
    records.allProcessSessions.map((session) => [session.runId, session]),
  );
  const workersByRunId = new Map<string, PersistedEventRecords["allWorkers"][number]>();
  for (const worker of records.allWorkers) {
    if (!workersByRunId.has(worker.runId)) {
      workersByRunId.set(worker.runId, worker);
    }
  }
  const sessions = records.allRuns.map((run) => serializeSessionRecord({
    run,
    primaryWorker: workersByRunId.get(run.id) ?? null,
    processSession: processSessionsByRunId.get(run.id) ?? null,
  }));
  const readMarkers = Object.fromEntries(
    records.allReadMarkers.map((marker) => [marker.runId, marker.lastReadAt.toISOString()]),
  );
  // Worker conversation content now lives in the unified worker stream
  // (per-worker JSONL, fetched via /api/workers/:workerId/entries). The
  // previous `synthesizeStreamingWorkerMessages` path that fabricated
  // pseudo-messages from `agent.outputEntries` is gone; clients render
  // worker content via `WorkerEntriesManager` instead.
  return withEventPayloadChecksum({
    messages: records.msgs.map(serializeMessageRecord),
    readMarkers,
    plans: records.allPlans,
    runs: records.allRuns,
    sessions,
    accounts: records.allAccounts,
    agents: agentsData.map(compactAgentSnapshot),
    workers: records.allWorkers.map(compactWorkerRecord),
    planItems: records.allPlanItems,
    clarifications: records.allClarifications,
    executionEvents: records.allExecutionEvents
      .slice(0, EXECUTION_EVENT_LIMIT)
      .map(compactExecutionEvent),
    supervisorInterventions: records.allSupervisorInterventions
      .map(compactSupervisorIntervention),
    queuedMessages: records.allQueuedMessages
      .filter((message) => message.status === "pending" || message.status === "delivering")
      .map(serializeQueuedConversationMessage),
    recoveryIncidents: records.allRecoveryIncidents
      .map(compactRecoveryIncident),
    recoveryState: runIds && !isTerminalRunStatus(
      records.allRuns.find((run) => runIds.has(run.id))?.status,
    )
      ? deriveRecoveryState(records.allRecoveryIncidents)
      : null,
    reviewRuns: records.allReviewRuns,
    reviewRounds: records.allReviewRounds,
    reviewFindings: records.allReviewFindings
      .map(compactReviewFinding),
    frontendErrors: [...frontendErrors, ...lifecycleErrors],
    snapshotRunId: selectedRunId,
    messageScope: {
      runIds: messageRunIds,
      complete: true,
    },
    // Bounded selected-run collections: list a cursor + completeness
    // flag so the UI can distinguish "full transcript loaded" from
    // "preview/tail only" and trigger pagination if it wants the rest.
    // Artifact-backed payloads MAY be partial; the cursor lets a
    // follow-up query request older entries.
    snapshotScope: {
      catalog: {
        complete: true,
      },

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:43:14.842Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:43:14.842Z

The dev event log is full of `queue.drain_decision` frames saying `pendingCount: 1` and `workerStatus: "working"` right before delivery. That matches the flicker: live worker sync was repeatedly telling the UI “still busy, one queued thing,” while persisted SQLite now says “done, delivered.”

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:14.845Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:14.845Z

```json
{
  "cmd": "sed -n '520,740p' src/runtime/http/routes/events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:14.853Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:14.853Z

```json
{
  "cmd": "rg -n \"queue\\.drain_decision|drain_decision|pendingCount|live_worker_sync|drainQueuedWorkerMessages|drainQueuedImplementationMessages\" src/server src/runtime tests -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:20.115Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:20.115Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, kind, status, queued_message_id, worker_id, updated_at, resolved_at, substr(last_error,1,200) as last_error, substr(details,1,300) as details from recovery_incidents where run_id='5eb40b0d5030' order by updated_at, id;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:20.186Z","phase":null} -->
## Tool result: call_0yJdSuKLDadyvFv6cbjxrJyE · 2026-06-16T21:43:20.186Z

```text
Chunk ID: 8ce175
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1903
Output:
      },
      executionEvents: {
        limit: EXECUTION_EVENT_LIMIT,
        complete: records.allExecutionEvents.length < EXECUTION_EVENT_LIMIT,
        oldestCreatedAt: records.allExecutionEvents.length > 0
          ? records.allExecutionEvents[records.allExecutionEvents.length - 1]!.createdAt.toISOString()
          : null,
      },
      supervisorInterventions: {
        limit: SUPERVISOR_INTERVENTION_LIMIT,
        complete: records.allSupervisorInterventions.length < SUPERVISOR_INTERVENTION_LIMIT,
        oldestCreatedAt: records.allSupervisorInterventions.length > 0
          ? records.allSupervisorInterventions[records.allSupervisorInterventions.length - 1]!.createdAt.toISOString()
          : null,
      },
      planningReviewFindings: {
        limit: PLANNING_REVIEW_FINDING_LIMIT,
        complete: records.allReviewFindings.length < PLANNING_REVIEW_FINDING_LIMIT,
        oldestCreatedAt: records.allReviewFindings.length > 0
          ? records.allReviewFindings[records.allReviewFindings.length - 1]!.createdAt.toISOString()
          : null,
      },
    },
    workerEntrySeqs,
  });
}

async function buildPersistedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  const records = await readPersistedEventRecords(options, probe);
  probe?.mark("readRecords.total");
  const scopedWorkers = selectedRunWorkers(records, options);
  const workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
  probe?.mark(`workerSeqs[${scopedWorkers.length}]`);
  const payload = buildEventPayload(
    records,
    buildLiveWorkerSnapshots({
      workers: scopedWorkers,
      runs: records.allRuns,
    }),
    undefined,
    options,
    workerEntrySeqs,
  );
  probe?.mark("buildPayload");
  return payload;
}

type EventPayloadCacheEntry = {
  version: number;
  promise: Promise<EventPayload>;
};

const cachedPersistedPayloads = new Map<string, EventPayloadCacheEntry>();
const cachedRuntimePayloads = new Map<string, EventPayloadCacheEntry>();

export function __clearEventPayloadCachesForTests() {
  cachedPersistedPayloads.clear();
  cachedRuntimePayloads.clear();
}

function eventPayloadCacheKey(options: EventPayloadOptions = {}) {
  return options.selectedRunId?.trim() || "__all__";
}

function shareInFlightEventPayload(
  cache: Map<string, EventPayloadCacheEntry>,
  options: EventPayloadOptions,
  build: () => Promise<EventPayload>,
) {
  const key = eventPayloadCacheKey(options);
  const version = getEventStreamNotificationVersion();
  const existing = cache.get(key);
  if (existing?.version === version) {
    return existing.promise;
  }

  const pending = build().catch((error) => {
    const cached = cache.get(key);
    if (cached?.promise === pending) {
      cache.delete(key);
    }
    throw error;
  });
  cache.set(key, { version, promise: pending });
  pruneEventPayloadCache(cache);
  return pending;
}

function pruneEventPayloadCache(cache: Map<string, EventPayloadCacheEntry>) {
  while (cache.size > EVENT_PAYLOAD_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function buildSharedPersistedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  return shareInFlightEventPayload(
    cachedPersistedPayloads,
    options,
    () => buildPersistedEventPayload(options, probe),
  );
}

async function buildRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  let records = await readPersistedEventRecords(options, probe);
  probe?.mark("readRecords#1.total");
  let scopedWorkers = selectedRunWorkers(records, options);
  let workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
  probe?.mark(`workerSeqs#1[${scopedWorkers.length}]`);
  let agentsData = buildLiveWorkerSnapshots({
    workers: scopedWorkers,
    runs: records.allRuns,
  });
  const frontendErrors: AppErrorPayload[] = [];

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/agents`, RUNTIME_AGENT_TIMEOUT_MS);
    probe?.mark("bridge.fetch");
    if (res.ok) {
      const rawAgentsPayload = await res.json();
      const rawAgents = Array.isArray(rawAgentsPayload) ? rawAgentsPayload : [];
      const { syncConversationSessions } = await import("@/server/conversations/sync");
      await syncConversationSessions(rawAgents, {
        selectedRunId: options.selectedRunId,
      });
      probe?.mark("bridge.sync");
      // Second reconciliation pass — this one knows what's actually in
      // the bridge, so it can detect workers that were "working" when
      // the bridge died and are now stranded with no live agent. The
      // earlier pass (inside readPersistedEventRecords) couldn't see
      // this because it ran before we fetched the bridge agent list.
      const bridgeAgentNames = new Set<string>();
      for (const agent of rawAgents) {
        if (typeof agent === "object" && agent !== null) {
          const name = (agent as { name?: unknown }).name;
          if (typeof name === "string" && name.length > 0) {
            bridgeAgentNames.add(name);
          }
        }
      }
      await reconcilePersistedReloadZombies({
        selectedRunId: options.selectedRunId,
        source: "events-snapshot-post-bridge",
        bridgeAgentNames,
      });
      probe?.mark("reconcile.bridge-orphans");
      records = await readPersistedEventRecords(options);
      probe?.mark("readRecords#2.total");
      scopedWorkers = selectedRunWorkers(records, options);
      workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
      probe?.mark(`workerSeqs#2[${scopedWorkers.length}]`);
      agentsData = buildLiveWorkerSnapshots({
        agents: filterRuntimeAgentsForWorkers(rawAgents, scopedWorkers),
        workers: scopedWorkers,
        runs: records.allRuns,
      });
    } else {
      const bridgeError = new Error(`Agent runtime list request failed with status ${res.status}.`);
      agentsData = buildLiveWorkerSnapshots({
        workers: scopedWorkers,
        runs: records.allRuns,
        bridgeError,
      });
      if (!isTransientSupervisorError(bridgeError)) {
        frontendErrors.push(buildAppError(
          bridgeError,
          {
            source: "Agent runtime",
            action: "Stream live agent state",
          },
        ));
      }
    }
  } catch (error) {
    agentsData = buildLiveWorkerSnapshots({
      workers: scopedWorkers,
      runs: records.allRuns,
      bridgeError: error,
    });
    if (!isTransientSupervisorError(error)) {
      frontendErrors.push(buildAppError(error, {
        source: "Agent runtime",
        action: "Stream live agent state",
      }));
    }
  }

  return buildEventPayload(records, agentsData, frontendErrors, options, workerEntrySeqs);
}

function buildSharedRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  return shareInFlightEventPayload(
    cachedRuntimePayloads,
    options,
    () => buildRuntimeEnrichedEventPayload(options, probe),
  );
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseLastEventId(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export const handleEventsRequest: OmniHttpHandler = async (request) => {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:20.186Z","phase":null} -->
## Tool result: call_Fl1Yrtw8m7Qub2pU999QndaR · 2026-06-16T21:43:20.186Z

```text
Chunk ID: d96c20
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 963
Output:
src/server/supervisor/index.ts:32:import { drainQueuedImplementationMessages } from "@/server/conversations/queued-messages";
src/server/supervisor/index.ts:1127:    await drainQueuedImplementationMessages(this.runId);
tests/server/conversations-sync.test.ts:607:        eventType: "queue_drain_decision",
src/server/conversations/sync.ts:16:import { drainQueuedWorkerMessages } from "./queued-messages";
src/server/conversations/sync.ts:231:  pendingCount: number;
src/server/conversations/sync.ts:236:    kind: "queue.drain_decision",
src/server/conversations/sync.ts:241:    pendingCount: args.pendingCount,
src/server/conversations/sync.ts:248:    eventType: "queue_drain_decision",
src/server/conversations/sync.ts:251:        ? `Draining ${args.pendingCount} queued message(s) for ${args.workerId}.`
src/server/conversations/sync.ts:255:      pendingCount: args.pendingCount,
src/server/conversations/sync.ts:262:async function drainQueuedWorkerMessagesWithObservation(args: {
src/server/conversations/sync.ts:269:  const pendingCount = await pendingWorkerQueueCount(args.runId, args.workerId);
src/server/conversations/sync.ts:270:  if (pendingCount === 0) {
src/server/conversations/sync.ts:278:    pendingCount,
src/server/conversations/sync.ts:290:  const deliveredCount = await drainQueuedWorkerMessages({
src/server/conversations/sync.ts:300:    pendingCount,
src/server/conversations/sync.ts:308:      summary: `Queue drain finished for ${args.workerId}: delivered ${deliveredCount} of ${pendingCount}.`,
src/server/conversations/sync.ts:310:      pendingCount,
src/server/conversations/sync.ts:608:      await drainQueuedWorkerMessagesWithObservation({
src/server/conversations/sync.ts:637:    await drainQueuedWorkerMessagesWithObservation({
src/server/conversations/sync.ts:641:      source: "live_worker_sync",
src/server/conversations/sync.ts:694:      await drainQueuedWorkerMessagesWithObservation({
src/server/conversations/sync.ts:712:      await drainQueuedWorkerMessagesWithObservation({
src/server/conversations/queued-messages.ts:783:export async function drainQueuedImplementationMessages(runId: string) {
src/server/conversations/queued-messages.ts:948:export async function drainQueuedWorkerMessages({
src/server/clarifications/loop.ts:63:  return { nextStatus, pendingCount: pending.length };
src/server/events/named-events.ts:243:      kind: "queue.drain_decision";
src/server/events/named-events.ts:248:      pendingCount: number;
src/server/events/named-events.ts:257:      pendingCount: number;
tests/server/queued-messages.test.ts:28:  drainQueuedImplementationMessages,
tests/server/queued-messages.test.ts:29:  drainQueuedWorkerMessages,
tests/server/queued-messages.test.ts:197:    const drained = await drainQueuedImplementationMessages(runId);
tests/server/queued-messages.test.ts:231:    const drained = await drainQueuedImplementationMessages(runId);
tests/server/queued-messages.test.ts:277:    const drained = await drainQueuedImplementationMessages(runId);
tests/server/queued-messages.test.ts:310:    const drained = await drainQueuedWorkerMessages({ runId, workerId });
tests/server/queued-messages.test.ts:357:    const drained = await drainQueuedWorkerMessages({ runId, workerId });
tests/server/dual-write-stream.test.ts:45:  drainQueuedImplementationMessages,
tests/server/dual-write-stream.test.ts:46:  drainQueuedWorkerMessages,
tests/server/dual-write-stream.test.ts:157:    const delivered = await drainQueuedWorkerMessages({ runId, workerId });
tests/server/dual-write-stream.test.ts:181:    const delivered = await drainQueuedWorkerMessages({ runId, workerId });
tests/server/dual-write-stream.test.ts:199:    const delivered = await drainQueuedImplementationMessages(runId);
tests/server/dual-write-stream.test.ts:221:    const delivered = await drainQueuedWorkerMessages({ runId, workerId });

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:20.186Z","phase":null} -->
## Tool result: call_hqZqJPgQiiS44dxSy7SVARrm · 2026-06-16T21:43:20.186Z

```text
Chunk ID: 61f1f4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:43:32.939Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:43:32.939Z

The key server suspect is `syncConversationSessions`: it drains queued worker messages during live worker sync, then the event snapshot builder immediately re-reads persisted rows and live bridge state. If bridge/live state says “working” while SQLite says idle/delivered, the UI can oscillate. I’m going into that handoff now.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:32.942Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:32.942Z

```json
{
  "cmd": "sed -n '200,330p' src/server/conversations/sync.ts && sed -n '560,730p' src/server/conversations/sync.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:32.942Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:32.942Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, event_type, worker_id, created_at, substr(details,1,500) as details from execution_events where run_id='5eb40b0d5030' and event_type='queue_drain_decision' order by created_at desc, id desc limit 20;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:33.046Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:33.046Z

```json
{
  "cmd": "sqlite3 -header -column sqlite.db \"select id, event_type, worker_id, created_at, substr(details,1,500) as details from execution_events where run_id='5eb40b0d5030' and event_type in ('queue_drain_finished','queued_message_delivered','worker_status_synced','worker_status_updated') order by created_at desc, id desc limit 40;\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:33.097Z","phase":null} -->
## Tool result: call_8ymJWIlgI6So52c3eWJdan0v · 2026-06-16T21:43:33.097Z

```text
Chunk ID: 3b26ac
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2378
Output:

function isCleanLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  return agent.state !== "error" && !agent.lastError?.trim();
}

function isActiveLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  const state = normalizedStatus(agent.state);
  return ["starting", "working", "stuck"].includes(state) || Boolean(agent.currentText.trim());
}

function isWorkerQueueDrainableStatus(status: string) {
  const normalized = normalizedStatus(status);
  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
}

async function pendingWorkerQueueCount(runId: string, workerId: string) {
  const records = await db.select({ id: queuedConversationMessages.id })
    .from(queuedConversationMessages)
    .where(and(
      eq(queuedConversationMessages.runId, runId),
      eq(queuedConversationMessages.targetWorkerId, workerId),
      eq(queuedConversationMessages.status, "pending"),
    ));
  return records.length;
}

async function recordQueueDrainDecision(args: {
  runId: string;
  workerId: string;
  source: string;
  workerStatus: string;
  pendingCount: number;
  decision: "drain" | "skip";
  reason: string;
}) {
  emitNamedEvent({
    kind: "queue.drain_decision",
    runId: args.runId,
    workerId: args.workerId,
    source: args.source,
    workerStatus: args.workerStatus,
    pendingCount: args.pendingCount,
    decision: args.decision,
    reason: args.reason,
  });
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    eventType: "queue_drain_decision",
    details: {
      summary: args.decision === "drain"
        ? `Draining ${args.pendingCount} queued message(s) for ${args.workerId}.`
        : `Skipped queue drain for ${args.workerId}: ${args.reason}.`,
      source: args.source,
      workerStatus: args.workerStatus,
      pendingCount: args.pendingCount,
      decision: args.decision,
      reason: args.reason,
    },
  });
}

async function drainQueuedWorkerMessagesWithObservation(args: {
  runId: string;
  workerId: string;
  workerStatus: string;
  source: string;
  snapshot?: ReturnType<typeof normalizeAgentRecord> | null;
}) {
  const pendingCount = await pendingWorkerQueueCount(args.runId, args.workerId);
  if (pendingCount === 0) {
    return 0;
  }

  const hasPendingElicitation = (args.snapshot?.pendingElicitations?.length ?? 0) > 0;
  const drainable = hasPendingElicitation || isWorkerQueueDrainableStatus(args.workerStatus);
  await recordQueueDrainDecision({
    ...args,
    pendingCount,
    decision: drainable ? "drain" : "skip",
    reason: hasPendingElicitation
      ? "pending_elicitation"
      : drainable
        ? "worker_drainable"
        : "worker_not_drainable",
  });
  if (!drainable) {
    return 0;
  }

  const deliveredCount = await drainQueuedWorkerMessages({
    runId: args.runId,
    workerId: args.workerId,
    snapshot: args.snapshot,
  });
  emitNamedEvent({
    kind: "queue.drain_finished",
    runId: args.runId,
    workerId: args.workerId,
    source: args.source,
    pendingCount,
    deliveredCount,
  });
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    eventType: "queue_drain_finished",
    details: {
      summary: `Queue drain finished for ${args.workerId}: delivered ${deliveredCount} of ${pendingCount}.`,
      source: args.source,
      pendingCount,
      deliveredCount,
    },
  });
  return deliveredCount;
}

function isRecoverableMissingDirectWorkerStatus(status: string) {
  const normalized = normalizedStatus(status);
  return ["starting", "working", "stuck", "recovering"].includes(normalized);
}

function isCancelledWorkerStatus(status: string | null | undefined) {
  const normalized = normalizedStatus(status);
  return normalized === "cancelled" || normalized === "canceled";
}

function isIdleDirectWorkerWithStaleCurrentText(worker: typeof workers.$inferSelect) {
  if (normalizedStatus(worker.status) !== "idle") {
    return false;
  }
      && worker.status.trim().toLowerCase().split(":")[0]?.trim() === "idle"
      && isIdleLiveAgentWithoutOutput(agent)
    ) {
      await db.update(workers).set({
        status: "error",
        cwd: agent.cwd || worker.cwd,
        currentText: agent.currentText,
        lastText: agent.lastText,
        outputLog: EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      await persistRunFailure(run.id, new Error(EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
        surface: { code: "worker.idle.empty_output", workerId: worker.id },
      });
      continue;
    }

    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
    const nextRunState = resolveSyncedRunState(run, agent);
    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
    await db.update(workers).set({
      status: nextWorkerStatus,
      cwd: agent.cwd || worker.cwd,
      currentText: quiescedDirectWorker ? "" : agent.currentText,
      lastText: agent.lastText,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    if (worker.status !== nextWorkerStatus) {
      emitNamedEvent({
        kind: "worker.status",
        runId: run.id,
        workerId: worker.id,
        prev: worker.status,
        next: nextWorkerStatus,
      });
    }

    if (run.mode === "planning") {
      const result = await refreshPlanningArtifactsForRun({
        run,
        worker,
        snapshot: agent,
        status: nextRunState === "running" ? "working" : undefined,
      });
      if (staleBusyFailure && result.status !== "failed") {
        await clearMatchingRunFailureMessage(run);
      }
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: agent.state,
        source: "live_planning_sync",
      });
      continue;
    }

    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        renderedOutput: agent.renderedOutput,
        currentText: agent.currentText,
        lastText: agent.lastText,
        outputEntries: agent.outputEntries,
      });
    } else {
      await db.update(runs).set({
        status: nextRunState,
        lastError: nextRunState === "failed" ? agent.lastError || run.lastError : null,
        failedAt: nextRunState === "failed" ? run.failedAt : null,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
    }
    if (staleBusyFailure && nextRunState !== "failed") {
      await clearMatchingRunFailureMessage(run);
    }
    await drainQueuedWorkerMessagesWithObservation({
      runId: run.id,
      workerId: worker.id,
      workerStatus: nextWorkerStatus,
      source: "live_worker_sync",
      snapshot: agent,
    });
  }

  for (const run of allRuns) {
    const staleBusyFailure = isAgentBusyRunFailure(run);
    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
      continue;
    }

    const worker = selectConversationWorker(run.id, allWorkers);
    if (!worker || agents.some((agent) => agent.name === worker.id)) {
      continue;
    }

    if (
      options.selectedRunId === run.id
      && isRecoverableMissingDirectWorkerStatus(worker.status)
    ) {
      const recoveryResult = await reconcileRunRecovery({
        runId: run.id,
        liveAgents: agents,
        source: "conversation-sync",
      });
      if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
        continue;
      }
    }

    if (await isEmptyIdlePersistedWorker(worker)) {
      await db.update(workers).set({
        status: "error",
        outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
        surface: { code: "worker.idle.missing_output", workerId: worker.id },
      });
      continue;
    }

    const nextRunState = await resolvePersistedRunState(run, worker);
    if (run.mode === "planning") {
      await refreshPlanningArtifactsForRun({
        run,
        worker,
        status: nextRunState === "running" ? "working" : undefined,
      });
      continue;
    }

    if (nextRunState === run.status) {
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        source: "persisted_state_unchanged",
      });
      continue;
    }

    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        outputLog: worker.outputLog,
        currentText: worker.currentText,
        lastText: worker.lastText,
        outputEntriesJson: worker.outputEntriesJson,
      });
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        source: "persisted_direct_completion",
      });
    } else {
      await db.update(runs).set({
        status: nextRunState,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
    }
  }
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:33.097Z","phase":null} -->
## Tool result: call_VwyqUttydNSIHiJdcTJwNYRF · 2026-06-16T21:43:33.097Z

```text
Chunk ID: d7d6ca
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1639
Output:
id                                    event_type            worker_id              created_at  details                                                                                                                                                                                                   
------------------------------------  --------------------  ---------------------  ----------  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
ad169647-66e6-4cc5-b3e5-97edba410bd3  queue_drain_decision  5eb40b0d5030-worker-1  1781645954  {"summary":"Draining 1 queued message(s) for 5eb40b0d5030-worker-1.","source":"live_worker_sync","workerStatus":"idle","pendingCount":1,"decision":"drain","reason":"worker_drainable"}                   
a88fd263-e0b4-4af1-89af-eb3837a592c6  queue_drain_decision  5eb40b0d5030-worker-1  1781645954  {"summary":"Draining 1 queued message(s) for 5eb40b0d5030-worker-1.","source":"live_worker_sync","workerStatus":"idle","pendingCount":1,"decision":"drain","reason":"worker_drainable"}                   
af799ca8-cbe9-4bfc-a37c-1cf6332bc94e  queue_drain_decision  5eb40b0d5030-worker-1  1781645949  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
a74eff84-ace7-4043-82e9-bd2538f789a0  queue_drain_decision  5eb40b0d5030-worker-1  1781645949  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
fb6f8615-bdae-421e-ae18-105e8aa0184e  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
f4cb01a3-92dd-4c69-99e5-daeda2b10018  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
e7729b5b-ab80-4ceb-8307-ded69d9e2bd5  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
cbab6f9a-f313-455f-b374-c0ac47064d34  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
afcd4a39-393d-4376-b940-83f8dcfa004b  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
af2634a7-1ad0-4718-ac66-5f48f7b04789  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
a5b357d4-3e5f-42e3-9040-1a116ba8eee6  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
a0d0ce46-7ac3-4e8e-9dec-01972eae7d7c  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
90e52ab6-2ea8-4c7b-82f4-515c5afa8cbd  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
8e3b144c-d10c-4314-8271-578d94c1252f  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
7ad40553-e2aa-4a89-bec1-32f03749815e  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
72164a4e-d49b-4493-9126-c0b076307855  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
617c0dc6-e65d-418a-a198-d8872269d162  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
5eab9010-e2ad-4c5e-941f-8ff3e0d3b3fa  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
21aa0fb6-21c9-4643-80d1-67b63e9eee2d  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}
1b01bf66-852c-422e-8e4d-c975b11f30c6  queue_drain_decision  5eb40b0d5030-worker-1  1781645948  {"summary":"Skipped queue drain for 5eb40b0d5030-worker-1: worker_not_drainable.","source":"live_worker_sync","workerStatus":"working","pendingCount":1,"decision":"skip","reason":"worker_not_drainable"}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:33.134Z","phase":null} -->
## Tool result: call_HgWofw33J5TpP0yQwsnlaIPX · 2026-06-16T21:43:33.134Z

```text
Chunk ID: 86e0c4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 669
Output:
id                                    event_type                worker_id              created_at  details                                                                                                                                        
------------------------------------  ------------------------  ---------------------  ----------  -----------------------------------------------------------------------------------------------------------------------------------------------
75bc49a5-b6e5-4f94-8e86-c3331a3fe4d5  queue_drain_finished      5eb40b0d5030-worker-1  1781646004  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 1 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":1}
036564a0-ab72-4b7a-a7f6-4722ae566e71  queued_message_delivered  5eb40b0d5030-worker-1  1781646004  {"summary":"Delivered queued message to 5eb40b0d5030-worker-1.","queuedMessageId":"8318d43e-7ad8-47dd-800d-58c0bc1d94b7"}                      
2c179659-81b5-49ff-bbf7-5101966c3919  queue_drain_finished      5eb40b0d5030-worker-1  1781645954  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}
cfdb0cea-9398-4aff-8b1d-f30c058dd14e  queue_drain_finished      5eb40b0d5030-worker-1  1781645903  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}
343e5054-a2c5-42a6-b456-eae58ca2e277  queue_drain_finished      5eb40b0d5030-worker-1  1781645573  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}
843692b9-eb7b-4747-938f-6e61639a60f3  queue_drain_finished      5eb40b0d5030-worker-1  1781645556  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}
513ce57c-72a2-413c-a736-81d2a55e18e2  queue_drain_finished      5eb40b0d5030-worker-1  1781645175  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}
82a0891a-7ef5-45a8-b3b5-aa299c401d76  queue_drain_finished      5eb40b0d5030-worker-1  1781644407  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}
1d44ff3e-86ab-4bbd-a34a-1ad40cdba062  queue_drain_finished      5eb40b0d5030-worker-1  1781643481  {"summary":"Queue drain finished for 5eb40b0d5030-worker-1: delivered 0 of 1.","source":"live_worker_sync","pendingCount":1,"deliveredCount":0}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:43:42.603Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:43:42.603Z

I’m going to bring in `baton` for a second opinion on the state race before editing. The pattern is now concrete: duplicate drain attempts can report “drain 1” and “delivered 0” while another attempt finally delivers, and the UI is consuming those interleaved signals.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:42.607Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:42.607Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:42.608Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:42.608Z

```json
{
  "cmd": "sed -n '520,660p' tests/server/conversations-sync.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:42.920Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:42.920Z

```json
{
  "cmd": "sed -n '230,270p' src/server/events/named-events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:43.547Z","phase":null} -->
## Tool result: call_kJ2Hl4ksI0rTVF8oKVgv6F7m · 2026-06-16T21:43:43.547Z

```text
Chunk ID: a28484
Wall time: 0.7647 seconds
Process exited with code 0
Original token count: 3847
Output:
Usage: claude [options] [command] [prompt]

Claude Code - starts an interactive session by default, use -p/--print for
non-interactive output

Arguments:
  prompt                                Your prompt

Options:
  --add-dir <directories...>            Additional directories to allow tool
                                        access to
  --agent <agent>                       Agent for the current session. Overrides
                                        the 'agent' setting.
  --agents <json>                       JSON object defining custom agents (e.g.
                                        '{"reviewer": {"description": "Reviews
                                        code", "prompt": "You are a code
                                        reviewer"}}')
  --allow-dangerously-skip-permissions  Enable bypassing all permission checks
                                        as an option, without it being enabled
                                        by default. Recommended only for
                                        sandboxes with no internet access.
  --allowedTools, --allowed-tools <tools...>
      Comma or space-separated list of tool names to allow (e.g. "Bash(git *)
      Edit")
  --append-system-prompt <prompt>       Append a system prompt to the default
                                        system prompt
  --bare                                Minimal mode: skip hooks, LSP, plugin
                                        sync, attribution, auto-memory,
                                        background prefetches, keychain reads,
                                        and CLAUDE.md auto-discovery. Sets
                                        CLAUDE_CODE_SIMPLE=1. Anthropic auth is
                                        strictly ANTHROPIC_API_KEY or
                                        apiKeyHelper via --settings (OAuth and
                                        keychain are never read). 3P providers
                                        (Bedrock/Vertex/Foundry) use their own
                                        credentials. Skills still resolve via
                                        /skill-name. Explicitly provide context
                                        via: --system-prompt[-file],
                                        --append-system-prompt[-file], --add-dir
                                        (CLAUDE.md dirs), --mcp-config,
                                        --settings, --agents, --plugin-dir.
  --betas <betas...>                    Beta headers to include in API requests
                                        (API key users only)
  --brief                               Enable SendUserMessage tool for
                                        agent-to-user communication
  --chrome                              Enable Claude in Chrome integration
  -c, --continue                        Continue the most recent conversation in
                                        the current directory
  --dangerously-skip-permissions        Bypass all permission checks.
                                        Recommended only for sandboxes with no
                                        internet access.
  -d, --debug [filter]                  Enable debug mode with optional category
                                        filtering (e.g., "api,hooks" or
                                        "!1p,!file")
  --debug-file <path>                   Write debug logs to a specific file path
                                        (implicitly enables debug mode)
  --disable-slash-commands              Disable all skills
  --disallowedTools, --disallowed-tools <tools...>
      Comma or space-separated list of tool names to deny (e.g. "Bash(git *)
      Edit")
  --effort <level>                      Effort level for the current session
                                        (low, medium, high, xhigh, max)
  --exclude-dynamic-system-prompt-sections
      Move per-machine sections (cwd, env info, memory paths, git status) from
      the system prompt into the first user message. Improves cross-user
      prompt-cache reuse. Only applies with the default system prompt (ignored
      with --system-prompt). (default: false)
  --fallback-model <model>              Enable automatic fallback to specified
                                        model(s) when the default model is
                                        overloaded or not available. Accepts a
                                        comma-separated list to try each in
                                        order. Re-tries the primary at the start
                                        of each user turn. (only works with
                                        --print)
  --file <specs...>                     File resources to download at startup.
                                        Format: file_id:relative_path (e.g.,
                                        --file file_abc:doc.txt
                                        file_def:img.png)
  --fork-session                        When resuming, create a new session ID
                                        instead of reusing the original (use
                                        with --resume or --continue)
  --from-pr [value]                     Resume a session linked to a PR by PR
                                        number/URL, or open interactive picker
                                        with optional search term
  -h, --help                            Display help for command
  --ide                                 Automatically connect to IDE on startup
                                        if exactly one valid IDE is available
  --include-hook-events                 Include all hook lifecycle events in the
                                        output stream (only works with
                                        --output-format=stream-json)
  --include-partial-messages            Include partial message chunks as they
                                        arrive (only works with --print and
                                        --output-format=stream-json)
  --input-format <format>               Input format (only works with --print):
                                        "text" (default), or "stream-json"
                                        (realtime streaming input) (choices:
                                        "text", "stream-json")
  --json-schema <schema>                JSON Schema for structured output
                                        validation. Example:
                                        {"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}
  --max-budget-usd <amount>             Maximum dollar amount to spend on API
                                        calls (only works with --print)
  --mcp-config <configs...>             Load MCP servers from JSON files or
                                        strings (space-separated)
  --mcp-debug                           [DEPRECATED. Use --debug instead] Enable
                                        MCP debug mode (shows MCP server errors)
  --model <model>                       Model for the current session. Provide
                                        an alias for the latest model (e.g.
                                        'fable', 'opus', or 'sonnet') or a
                                        model's full name (e.g.
                                        'claude-fable-5').
  -n, --name <name>                     Set a display name for this session
                                        (shown in the prompt box, /resume
                                        picker, and terminal title)
  --no-chrome                           Disable Claude in Chrome integration
  --no-session-persistence              Disable session persistence - sessions
                                        will not be saved to disk and cannot be
                                        resumed (only works with --print)
  --output-format <format>              Output format (only works with --print):
                                        "text" (default), "json" (single
                                        result), or "stream-json" (realtime
                                        streaming) (choices: "text", "json",
                                        "stream-json")
  --permission-mode <mode>              Permission mode to use for the session
                                        (choices: "acceptEdits", "auto",
                                        "bypassPermissions", "default",
                                        "dontAsk", "plan")
  --plugin-dir <path>                   Load a plugin from a directory or .zip
                                        for this session only (repeatable:
                                        --plugin-dir A --plugin-dir B.zip)
                                        (default: [])
  --plugin-url <url>                    Fetch a plugin .zip from a URL for this
                                        session only (repeatable: --plugin-url A
                                        --plugin-url B) (default: [])
  -p, --print                           Print response and exit (useful for
                                        pipes). Note: The workspace trust dialog
                                        is skipped when Claude is run in
                                        non-interactive mode (via -p, or when
                                        stdout is not a TTY, e.g. piped or
                                        redirected output). Only use this in
                                        directories you trust. Settings files
                                        that fail validation are silently
                                        ignored in this mode (no error dialog is
                                        shown).
  --prompt-suggestions [value]          Enable prompt suggestions. In print/SDK
                                        mode, emits a prompt_suggestion message
                                        after each turn with a predicted next
                                        user prompt (choices: "true", "false",
                                        "1", "0", "yes", "no", "on", "off",
                                        preset: "true")
  --remote-control [name]               Start an interactive session with Remote
                                        Control enabled (optionally named)
  --remote-control-session-name-prefix <prefix>
      Prefix for auto-generated Remote Control session names (default: hostname)
  --replay-user-messages                Re-emit user messages from stdin back on
                                        stdout for acknowledgment (only works
                                        with --input-format=stream-json and
                                        --output-format=stream-json)
  -r, --resume [value]                  Resume a conversation by session ID, or
                                        open interactive picker with optional
                                        search term
  --safe-mode                           Start with all customizations
                                        (CLAUDE.md, skills, plugins, hooks, MCP
                                        servers, custom commands and agents,
                                        output styles, workflows, custom themes,
                                        keybindings, and more) disabled — useful
                                        for troubleshooting a broken
                                        configuration. Admin-managed (policy)
                                        settings still apply. Auth, model
                                        selection, built-in tools, and
                                        permissions work normally. Sets
                                        CLAUDE_CODE_SAFE_MODE=1.
  --session-id <uuid>                   Use a specific session ID for the
                                        conversation (must be a valid UUID)
  --setting-sources <sources>           Comma-separated list of setting sources
                                        to load (user, project, local).
  --settings <file-or-json>             Path to a settings JSON file or a JSON
                                        string to load additional settings from
  --strict-mcp-config                   Only use MCP servers from --mcp-config,
                                        ignoring all other MCP configurations
  --system-prompt <prompt>              System prompt to use for the session
  --tmux                                Create a tmux session for the worktree
                                        (requires --worktree). Uses iTerm2
                                        native panes when available; use
                                        --tmux=classic for traditional tmux.
  --tools <tools...>                    Specify the list of available tools from
                                        the built-in set. Use "" to disable all
                                        tools, "default" to use all tools, or
                                        specify tool names (e.g.
                                        "Bash,Edit,Read").
  --verbose                             Override verbose mode setting from
                                        config
  -v, --version                         Output the version number
  -w, --worktree [name]                 Create a new git worktree for this
                                        session (optionally specify a name)

Commands:
  agents [options]                      Manage background agents
  auth                                  Manage authentication
  auto-mode                             Inspect auto mode classifier
                                        configuration
  doctor                                Check the health of your Claude Code
                                        auto-updater. Note: The workspace trust
                                        dialog is skipped and stdio servers from
                                        .mcp.json are spawned for health checks.
                                        Only use this command in directories you
                                        trust.
  install [options] [target]            Install Claude Code native build. Use
                                        [target] to specify version (stable,
                                        latest, or specific version)
  mcp                                   Configure and manage MCP servers
  plugin|plugins                        Manage Claude Code plugins
  project                               Manage Claude Code project state
  setup-token                           Set up a long-lived authentication token
                                        (requires Claude subscription)
  ultrareview [options] [target]        Run a cloud-hosted multi-agent code
                                        review of the current branch (or a PR
                                        number / base branch) and print the
                                        findings
  update|upgrade                        Check for updates and install if
                                        available

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:43.547Z","phase":null} -->
## Tool result: call_81vWumGTirfdvNZCGdWm2PS6 · 2026-06-16T21:43:43.547Z

```text
Chunk ID: abb2d3
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1132
Output:
      "It includes a complete summary, concrete verification notes, and enough stable prose to clear the long-completion threshold used for direct worker quiescence.",
      "That threshold prevents accidental completion on tiny partial chunks, so this fixture needs to look like a genuinely finished assistant response.",
      "After this point the worker should no longer be treated as busy by the control plane, and any queued steering for the same worker should drain.",
    ].join(" ");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-queued-drain.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct queued drain",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: randomUUID(),
      runId,
      targetWorkerId: workerId,
      action: "steer",
      status: "pending",
      content: "continue",
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 3),
      updatedAt: new Date(now.getTime() + 3),
    });
    await syncConversationSessions([
      {
        name: workerId,
        type: "gemini",
        cwd: process.cwd(),
        state: "working",
        sessionId: "still-working-session",
        sessionMode: "full-access",
        lastText: finalAnswer,
        currentText: finalAnswer,
        renderedOutput: finalAnswer,
        outputEntries: [
          {
            id: "user-1",
            type: "user_input",
            text: "Recover worker",
            timestamp: now.toISOString(),
          },
          {
            id: "message-1",
            type: "message",
            text: finalAnswer,
            timestamp: new Date(now.getTime() + 2).toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(worker?.status).toBe("idle");
    expect(run?.status).toBe("done");
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "continue");
    expect(queued?.status).toBe("delivered");
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "queue_drain_decision",
        workerId,
      }),
      expect.objectContaining({
        eventType: "queue_drain_finished",
        workerId,
      }),
      expect.objectContaining({
        eventType: "queued_message_delivered",
        workerId,
      }),
    ]));
  });

  it("answers a pending direct worker elicitation instead of leaving the queued reply stuck behind working status", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const question = "The terminal feature is done and tested, but unrelated WIP is interleaved in some files. How should I commit?";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-elicitation-queued-drain.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct elicitation queued drain",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: question,
      lastText: question,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queued-answer",
      runId,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:43.547Z","phase":null} -->
## Tool result: call_iiniAfExWYRJFyGARCd9fGbG · 2026-06-16T21:43:43.547Z

```text
Chunk ID: 1cf858
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 389
Output:
export type RecoveryEvent =
  | { kind: "recovery.opened"; runId: string; incidentId: string; recoveryKind: string }
  | { kind: "recovery.attempt"; runId: string; incidentId: string; attempt: number }
  | { kind: "recovery.gave_up"; runId: string; incidentId: string; attempts: number }
  | { kind: "recovery.resolved"; runId: string; incidentId: string };

export type ConversationEvent =
  | { kind: "conversation.awaiting_user"; runId: string; workerId?: string; reason: "worker_requested_input" }
  | { kind: "conversation.read"; runId: string; lastReadAt: string }
  | { kind: "conversation.project_moved"; runId: string; previousProjectPath: string | null; projectPath: string }
  | { kind: "conversation.deleted"; runId: string }
  | { kind: "conversation.delete_failed"; runId: string; blockingTable: string | null }
  | {
      kind: "queue.drain_decision";
      runId: string;
      workerId: string;
      source: string;
      workerStatus: string;
      pendingCount: number;
      decision: "drain" | "skip";
      reason: string;
    }
  | {
      kind: "queue.drain_finished";
      runId: string;
      workerId: string;
      source: string;
      pendingCount: number;
      deliveredCount: number;
    }
  // Escape / force-send interruption control plane. See
  // docs/architecture/lifecycle-observability-and-testing.md.
  | {
      kind: "queue.interrupt_requested";
      runId: string;
      workerId: string | null;
      queuedMessageId: string | null;
      source: string;
    }
  | {
      kind: "queue.interrupt_refused";

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:43:51.183Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:43:51.183Z

I found an existing sync test for the intended behavior: a “working” direct worker with a complete final answer should be quiesced to `idle`, the run should become `done`, and the queue should drain. The live session shows repeated duplicate drain attempts, including “delivered 0 of 1” before the eventual real delivery, so I’m going to harden that race rather than only hide the symptom.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:43:54.615Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:43:54.615Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton -p --permission-mode dontAsk --allowedTools 'Read,Grep,Glob' \"Second opinion needed on OmniHarness queue/UI flicker bug. Context: user reports session 5eb40b0d5030 shows delivered queued message still in drawer and Working... flickers. SQLite: queued_conversation_messages rows for run are both delivered, worker idle, run done. Event log before final delivery has many duplicate queue.drain_decision skip pendingCount=1 workerStatus=working, then duplicate drain decisions at same second, a queue_drain_finished delivered 0 of 1, then final queued_message_delivered and queue_drain_finished delivered 1 of 1. Relevant files: src/server/conversations/sync.ts drainQueuedWorkerMessagesWithObservation, src/server/conversations/queued-messages.ts drainQueuedWorkerMessages, src/app/home/BusyMessageQueueManager.ts, src/app/home/EventStreamStateManager.ts. Prior fixes block stale active upserts after server empty queue. Please inspect these files and suggest the likely root cause and a focused fix/test. Do not edit files.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:43:56.496Z","phase":null} -->
## Tool result: call_L24D6RaakDe9JUYjrmHqyBQs · 2026-06-16T21:43:56.496Z

```text
Chunk ID: f0d0b9
Wall time: 1.7139 seconds
Process exited with code 1
Original token count: 24
Output:
Error: Input must be provided either through stdin or as a prompt argument when using --print

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:44:05.518Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:44:05.518Z

`baton` didn’t accept that invocation shape, so I’m retrying with the prompt passed through stdin. Tiny tool-wrapper snag, not a blocker.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:44:11.408Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:44:11.408Z

```json
{
  "cmd": "printf '%s' \"Second opinion needed on OmniHarness queue/UI flicker bug. Context: user reports session 5eb40b0d5030 shows delivered queued message still in drawer and Working... flickers. SQLite: queued_conversation_messages rows for run are both delivered, worker idle, run done. Event log before final delivery has many duplicate queue.drain_decision skip pendingCount=1 workerStatus=working, then duplicate drain decisions at same second, a queue_drain_finished delivered 0 of 1, then final queued_message_delivered and queue_drain_finished delivered 1 of 1. Relevant files: src/server/conversations/sync.ts drainQueuedWorkerMessagesWithObservation, src/server/conversations/queued-messages.ts drainQueuedWorkerMessages, src/app/home/BusyMessageQueueManager.ts, src/app/home/EventStreamStateManager.ts. Prior fixes block stale active upserts after server empty queue. Please inspect these files and suggest the likely root cause and a focused fix/test. Do not edit files.\" | /Users/masterman/.local/bin/baton -p --permission-mode dontAsk --allowedTools 'Read,Grep,Glob'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:44:41.578Z","phase":null} -->
## Tool result: call_djUfy52j7n73UK7lcAPjhseU · 2026-06-16T21:44:41.578Z

```text
Chunk ID: 865cdc
Wall time: 30.0030 seconds
Process running with session ID 48423
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:44:52.447Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:44:52.447Z

```json
{
  "cmd": "sed -n '1,280p' src/server/workers/live-snapshots.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:44:52.463Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:44:52.463Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/direct-control-activity.ts && sed -n '1,280p' src/app/home/useConversationExecutionStatus.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 42000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:44:52.610Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:44:52.610Z

```json
{
  "cmd": "sed -n '1,260p' src/components/Terminal.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 36000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:44:52.700Z","phase":null} -->
## Tool result: call_1YohNJLobCci4motlHkRb16V · 2026-06-16T21:44:52.700Z

```text
Chunk ID: e8cd57
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2392
Output:
import type { AgentRecord } from "@/server/bridge-client";
import { normalizeAgentRecord } from "@/server/bridge-client";
import { formatErrorMessage } from "@/server/runs/failures";

type WorkerOutputEntry = NonNullable<AgentRecord["outputEntries"]>[number];

type PersistedWorkerRecord = {
  id: string;
  runId: string;
  type: string;
  status: string;
  cwd: string;
  outputLog: string;
  outputEntries?: WorkerOutputEntry[];
  currentText: string;
  lastText: string;
  bridgeSessionId: string | null;
  bridgeSessionMode: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type PersistedRunRecord = {
  id: string;
  planId?: string | null;
  mode?: string | null;
  projectPath?: string | null;
  title?: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel: string | null;
  preferredWorkerEffort: string | null;
  allowedWorkerTypes?: string | null;
  specPath?: string | null;
  artifactPlanPath?: string | null;
  plannerArtifactsJson?: string | null;
  parentRunId?: string | null;
  forkedFromMessageId?: string | null;
  status?: string | null;
  failedAt?: Date | string | null;
  lastError: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type LiveWorkerSnapshot = AgentRecord & {
  bridgeLastError: string | null;
  runLastError: string | null;
  outputLog: string;
  displayText: string;
  bridgeMissing: boolean;
  updatedAt?: Date | string | null;
};

function cleanStructuredOutput(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value : "";
}

function appendLiveText(base: string, liveText: string) {
  if (!base) {
    return liveText;
  }

  return `${base}${base.endsWith("\n") || liveText.startsWith("\n") ? "" : "\n"}${liveText}`;
}

function buildEmptyStopDiagnostic(stopReason: string | null | undefined) {
  const normalizedStopReason = typeof stopReason === "string" ? stopReason.trim() : "";
  if (!normalizedStopReason) {
    return "";
  }

  return `Agent stopped without producing output. Stop reason: ${normalizedStopReason}.`;
}

function buildMissingBridgeEmptyDiagnostic(worker: PersistedWorkerRecord | null) {
  if (!worker) {
    return "";
  }

  const status = worker.status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  if (status !== "idle") {
    return "";
  }

  if (worker.outputLog.trim() || worker.currentText.trim() || worker.lastText.trim()) {
    return "";
  }

  return "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";
}

function outputEntriesText(entries: NonNullable<AgentRecord["outputEntries"]>) {
  return entries
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

function outputEntryTimestampMs(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
  const value = new Date(entry.timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}

function mergeOutputEntries(
  persistedEntries: NonNullable<AgentRecord["outputEntries"]>,
  liveEntries: NonNullable<AgentRecord["outputEntries"]>,
) {
  if (persistedEntries.length === 0) {
    return liveEntries;
  }

  if (liveEntries.length === 0) {
    return persistedEntries;
  }

  const entriesById = new Map<string, NonNullable<AgentRecord["outputEntries"]>[number]>();
  for (const entry of persistedEntries) {
    entriesById.set(entry.id, entry);
  }
  for (const entry of liveEntries) {
    entriesById.set(entry.id, entry);
  }

  return Array.from(entriesById.values()).sort((left, right) => {
    const timeDelta = outputEntryTimestampMs(left) - outputEntryTimestampMs(right);
    return timeDelta || left.id.localeCompare(right.id);
  });
}

function isAgentActive(state: string | null | undefined) {
  const normalized = (state ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "starting" || normalized === "working" || normalized === "stuck";
}

function isFailedRun(run: PersistedRunRecord | null) {
  return (run?.status ?? "").trim().toLowerCase() === "failed";
}

function isTerminalRun(run: PersistedRunRecord | null) {
  const status = (run?.status ?? "").trim().toLowerCase();
  return status === "done"
    || status === "failed"
    || status === "cancelled"
    || status === "canceled"
    || status === "promoting"
    || status === "promoted";
}

function shouldSurfaceBridgeLastError(agent: AgentRecord) {
  if (!agent.lastError) {
    return false;
  }

  if (agent.state === "error") {
    return true;
  }

  if (isAgentActive(agent.state)) {
    return false;
  }

  return !agent.currentText.trim() && !agent.lastText.trim() && (agent.outputEntries?.length ?? 0) === 0;
}

export function buildLiveWorkerSnapshot(args: {
  agent?: unknown | null;
  worker?: PersistedWorkerRecord | null;
  run?: PersistedRunRecord | null;
  bridgeError?: unknown;
}): LiveWorkerSnapshot | null {
  const normalizedAgent = args.agent ? normalizeAgentRecord(args.agent) : null;
  const worker = args.worker ?? null;
  const run = args.run ?? null;

  if (!normalizedAgent && !worker) {
    return null;
  }

  const persistedOutputEntries = worker?.outputEntries ?? [];
  const outputLog = worker?.outputLog ?? "";
  const persistedLastText = worker?.lastText ?? "";
  const requestedModel = normalizedAgent?.requestedModel ?? run?.preferredWorkerModel ?? null;
  const requestedEffort = normalizedAgent?.requestedEffort ?? run?.preferredWorkerEffort ?? null;
  const runLastError = run?.lastError ?? null;

  if (normalizedAgent) {
    const structuredOutput = cleanStructuredOutput(normalizedAgent.renderedOutput);
    const liveText = isAgentActive(normalizedAgent.state) && normalizedAgent.currentText.length > 0
      ? normalizedAgent.currentText
      : "";
    const outputEntries = mergeOutputEntries(persistedOutputEntries, normalizedAgent.outputEntries ?? []);
    const structuredEntriesText = outputEntriesText(outputEntries);
    const emptyStopDiagnostic = !structuredOutput && !liveText && outputEntries.length === 0 && !outputLog && !normalizedAgent.lastText && !persistedLastText
      ? buildEmptyStopDiagnostic(normalizedAgent.stopReason)
      : "";
    const lastText = normalizedAgent.lastText || persistedLastText || outputLog || structuredEntriesText || emptyStopDiagnostic;
    const displayBase = structuredOutput || outputLog || lastText || structuredEntriesText || "";
    const displayText = liveText && !structuredOutput ? appendLiveText(displayBase, liveText) : displayBase;
    const visibleLastError = shouldSurfaceBridgeLastError(normalizedAgent) ? normalizedAgent.lastError : null;

    return {
      ...normalizedAgent,
      pendingPermissions: isTerminalRun(run) ? [] : normalizedAgent.pendingPermissions,
      pendingElicitations: isTerminalRun(run) ? [] : normalizedAgent.pendingElicitations,
      type: normalizedAgent.type || worker?.type || "",
      cwd: normalizedAgent.cwd || worker?.cwd || "",
      sessionId: normalizedAgent.sessionId ?? worker?.bridgeSessionId ?? null,
      sessionMode: normalizedAgent.sessionMode ?? worker?.bridgeSessionMode ?? null,
      requestedModel,
      effectiveModel: normalizedAgent.effectiveModel ?? null,
      requestedEffort,
      effectiveEffort: normalizedAgent.effectiveEffort ?? null,
      outputEntries,
      currentText: liveText,
      lastText,
      bridgeLastError: normalizedAgent.lastError ?? null,
      runLastError,
      lastError: visibleLastError,
      outputLog,
      displayText,
      bridgeMissing: false,
      updatedAt: worker?.updatedAt ?? null,
    };
  }

  const bridgeLastError = args.bridgeError ? formatErrorMessage(args.bridgeError) : null;
  const missingBridgeDiagnostic = persistedOutputEntries.length === 0
    ? buildMissingBridgeEmptyDiagnostic(worker)
    : "";
  const structuredEntriesText = outputEntriesText(persistedOutputEntries);
  const lastText = persistedLastText || outputLog || structuredEntriesText || missingBridgeDiagnostic;
  const displayText = outputLog || persistedLastText || structuredEntriesText || missingBridgeDiagnostic;
  const persistedState = worker?.status || "starting";
  const state = isFailedRun(run) && isAgentActive(persistedState) ? "error" : persistedState;

  return {
    name: worker?.id ?? "",
    type: worker?.type ?? "",
    cwd: worker?.cwd ?? "",
    state,
    sessionId: worker?.bridgeSessionId ?? null,
    requestedModel,
    effectiveModel: null,
    requestedEffort,
    effectiveEffort: null,
    sessionMode: worker?.bridgeSessionMode ?? null,
    lastError: runLastError,
    bridgeLastError,
    runLastError,
    outputEntries: persistedOutputEntries,
    outputLog,
    displayText,
    renderedOutput: null,
    currentText: worker?.currentText ?? "",
    lastText,
    stderrBuffer: [],
    pendingPermissions: [],
    pendingElicitations: [],
    stopReason: null,
    bridgeMissing: true,
    updatedAt: worker?.updatedAt ?? null,
  };
}

export function buildLiveWorkerSnapshots(args: {
  agents?: unknown[];
  workers?: PersistedWorkerRecord[];
  runs?: PersistedRunRecord[];
  bridgeError?: unknown;
}) {
  const workers = args.workers ?? [];
  const runsById = new Map((args.runs ?? []).map((run) => [run.id, run]));
  const workersById = new Map(workers.map((worker) => [worker.id, worker]));
  const snapshots: LiveWorkerSnapshot[] = [];
  const seenWorkerIds = new Set<string>();

  for (const rawAgent of args.agents ?? []) {
    const normalizedAgent = normalizeAgentRecord(rawAgent);
    if (!normalizedAgent.name) {
      continue;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:44:52.700Z","phase":null} -->
## Tool result: call_FqxUnDxSsmes6K188ZZv1gnw · 2026-06-16T21:44:52.700Z

```text
Chunk ID: f92f22
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3106
Output:
import { normalizeWorkerStatus } from "@/lib/conversation-workers";
import { isTerminalRunStatus } from "@/lib/run-status";
import type { AgentOutputEntry } from "@/lib/agent-output";

const DIRECT_WORKING_STATUSES = new Set(["starting", "working", "stuck", "recovering"]);

export type DirectControlPendingAssistantStatus = "connecting" | "thinking" | "working";

function hasWorkingStatus(statuses: readonly (string | null | undefined)[]) {
  return statuses.some((status) => DIRECT_WORKING_STATUSES.has(normalizeWorkerStatus(status)));
}

function isOpenInputEntry(entry: AgentOutputEntry) {
  if (entry.type !== "permission" && entry.type !== "elicitation") {
    return false;
  }
  const status = (entry.status ?? "pending").trim().toLowerCase();
  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected"].includes(status);
}

export function hasPendingHumanInputSignal(agent: {
  pendingPermissions?: unknown[] | null;
  pendingElicitations?: unknown[] | null;
  outputEntries?: AgentOutputEntry[] | null;
}) {
  return (
    (agent.pendingPermissions?.length ?? 0) > 0
    || (agent.pendingElicitations?.length ?? 0) > 0
    || (agent.outputEntries?.some(isOpenInputEntry) ?? false)
  );
}

export function resolveDirectControlPendingAssistantStatus(args: {
  isDirectConversation: boolean;
  pendingConversationWorkerId: string | null | undefined;
  busyConversationWorkerId: string | null | undefined;
  selectedRunStatus: string | null | undefined;
  workerStatuses: readonly (string | null | undefined)[];
  agentStates: readonly (string | null | undefined)[];
  hasAgentCurrentText: boolean;
  hasPendingHumanInput?: boolean;
}) {
  if (!args.isDirectConversation) {
    return null;
  }

  if (isTerminalRunStatus(args.selectedRunStatus)) {
    return null;
  }

  if (args.hasPendingHumanInput) {
    return null;
  }

  if (args.busyConversationWorkerId || hasWorkingStatus(args.workerStatuses) || hasWorkingStatus(args.agentStates)) {
    return "working";
  }

  if (args.hasAgentCurrentText) {
    return "thinking";
  }

  if (args.pendingConversationWorkerId) {
    return "connecting";
  }

  return null;
}

export function shouldShowDirectControlPendingAssistant(args: Parameters<typeof resolveDirectControlPendingAssistantStatus>[0]) {
  return resolveDirectControlPendingAssistantStatus(args) !== null;
}

export function isMutationPendingForSelectedRun(args: {
  isPending: boolean;
  mutationRunId: string | null | undefined;
  selectedRunId: string | null | undefined;
}) {
  return Boolean(
    args.isPending
      && args.selectedRunId
      && args.mutationRunId === args.selectedRunId,
  );
}

export function resolvePendingConversationWorkerId(args: {
  isPending: boolean;
  mutationRunId: string | null | undefined;
  selectedRunId: string | null | undefined;
  isImplementationConversation: boolean;
  selectedWorkerIds: readonly string[];
}) {
  if (args.isImplementationConversation) {
    return null;
  }

  if (!isMutationPendingForSelectedRun({
    isPending: args.isPending,
    mutationRunId: args.mutationRunId,
    selectedRunId: args.selectedRunId,
  })) {
    return null;
  }

  return args.selectedWorkerIds[0] ?? null;
}
import { useMemo } from "react";
import { t } from "@/lib/i18n";
import type { AgentSnapshot, ExecutionEventRecord, MessageRecord, RunRecord } from "./types";
import { getRunDurationLabel, parseExecutionEventDetails, summarizeExecutionEvent } from "./utils";

interface UseConversationExecutionStatusProps {
  selectedRun: RunRecord | null;
  latestExecutionEvent: ExecutionEventRecord | null;
  erroredAgent: AgentSnapshot | null;
  pendingPermissionAgent: AgentSnapshot | null;
  pendingElicitationAgent?: AgentSnapshot | null;
  hasStuckWorker: boolean;
  latestStuckEvent: ExecutionEventRecord | null;
  showRecoverableRunningState: boolean;
  latestWaitEvent: ExecutionEventRecord | null;
  latestPromptDeferredEvent: ExecutionEventRecord | null;
  completionEvent: ExecutionEventRecord | null;
  queuedMessageCount: number;
  activeConversationAgents: AgentSnapshot[];
  liveThoughts: Array<{ agentName: string; text: string; snippet: string; isLive: boolean }>;
  awaitingUserQuestionMessage: MessageRecord | null;
  isSelectedConversationLoaded: boolean;
}

function pendingPermissionEntryCount(agent: AgentSnapshot | null | undefined) {
  return agent?.outputEntries?.filter((entry) => (
    entry.type === "permission"
    && !["approved", "cancelled", "canceled", "completed", "denied", "failed", "rejected"].includes(
      (entry.status ?? "pending").trim().toLowerCase(),
    )
  )).length ?? 0;
}

function pendingPermissionCount(agent: AgentSnapshot | null | undefined) {
  const liveCount = agent?.pendingPermissions?.length ?? 0;
  return liveCount > 0 ? liveCount : pendingPermissionEntryCount(agent);
}

function pendingElicitationEntryCount(agent: AgentSnapshot | null | undefined) {
  return agent?.outputEntries?.filter((entry) => (
    entry.type === "elicitation"
    && !["answered", "cancelled", "canceled", "completed", "declined", "failed", "rejected"].includes(
      (entry.status ?? "pending").trim().toLowerCase(),
    )
  )).length ?? 0;
}

function pendingElicitationCount(agent: AgentSnapshot | null | undefined) {
  const liveCount = agent?.pendingElicitations?.length ?? 0;
  return liveCount > 0 ? liveCount : pendingElicitationEntryCount(agent);
}

export function useConversationExecutionStatus({
  selectedRun,
  latestExecutionEvent,
  erroredAgent,
  pendingPermissionAgent,
  pendingElicitationAgent = null,
  hasStuckWorker,
  latestStuckEvent,
  showRecoverableRunningState,
  latestWaitEvent,
  latestPromptDeferredEvent,
  completionEvent,
  queuedMessageCount,
  activeConversationAgents,
  liveThoughts,
  awaitingUserQuestionMessage,
  isSelectedConversationLoaded,
}: UseConversationExecutionStatusProps) {
  const liveExecutionStatus = useMemo(() => {
    const durationLabel = getRunDurationLabel(selectedRun, completionEvent?.createdAt);
    const permissionAgent = pendingPermissionAgent
      ?? activeConversationAgents.find((agent) => pendingPermissionEntryCount(agent) > 0)
      ?? null;
    const elicitationAgent = pendingElicitationAgent
      ?? activeConversationAgents.find((agent) => pendingElicitationEntryCount(agent) > 0)
      ?? null;

    if (selectedRun && !isSelectedConversationLoaded) {
      return {
        label: "Loading",
        detail: "Loading the latest conversation state…",
        tone: "active" as const,
      };
    }

    if (selectedRun?.status === "failed") {
      return {
        label: "Runtime error",
        detail: [durationLabel, selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run failed.")]
          .filter(Boolean)
          .join(". "),
        tone: "error" as const,
      };
    }

    if (erroredAgent) {
      return {
        label: "Runtime error",
        detail: erroredAgent.lastError || erroredAgent.stopReason || "A worker reported an error.",
        tone: "error" as const,
      };
    }

    if (permissionAgent) {
      const requestCount = pendingPermissionCount(permissionAgent);
      return {
        label: "Awaiting permission",
        detail: `${permissionAgent.name} is waiting on ${requestCount} permission ${requestCount === 1 ? "decision" : "decisions"}.`,
        tone: "warning" as const,
      };
    }

    if (elicitationAgent) {
      const requestCount = pendingElicitationCount(elicitationAgent);
      return {
        label: t("conversation.status.awaitingInput"),
        detail: t("conversation.status.workerAwaitingAnswer", { worker: elicitationAgent.name, count: requestCount }),
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "awaiting_user") {
      if (
        (selectedRun.mode === "direct" || selectedRun.mode === "commit")
        && latestExecutionEvent?.eventType === "direct_worker_awaiting_user"
      ) {
        return {
          label: t("conversation.status.awaitingInput"),
          detail: t("conversation.status.awaitingWorkerInput"),
          tone: "warning" as const,
        };
      }
      if (!awaitingUserQuestionMessage) {
        return {
          label: "Loading",
          detail: "Loading Omni's question…",
          tone: "active" as const,
        };
      }
      return {
        label: t("conversation.status.awaitingInput"),
        detail: "Omni asked for clarification before continuing.",
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "needs_recovery") {
      return {
        label: t("recovery.notice.title.needsRecovery"),
        detail: [durationLabel, selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : t("recovery.notice.description.needsRecovery"))]
          .filter(Boolean)
          .join(". "),
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "cancelled") {
      return {
        label: "Stopped",
        detail: [durationLabel, latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run was stopped by the user."]
          .filter(Boolean)
          .join(". "),
        tone: "muted" as const,
      };
    }

    if (hasStuckWorker) {
      return {
        label: "Stuck",
        detail: latestStuckEvent
          ? summarizeExecutionEvent(latestStuckEvent)
          : "The worker stopped making progress. Resume the worker to continue the turn.",
        tone: "warning" as const,
      };
    }

    if (showRecoverableRunningState) {
      return {
        label: "Needs recovery",
        detail: "This conversation is still marked running, but nothing active is attached to it. Reconnect to the existing worker session to continue.",
        tone: "warning" as const,
      };
    }

    if (queuedMessageCount > 0) {
      return {
        label: queuedMessageCount === 1 ? "Queued follow-up" : "Queued follow-ups",
        detail: `${queuedMessageCount} user ${queuedMessageCount === 1 ? "message is" : "messages are"} waiting for delivery.`,
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "done") {
      const completionSummary = completionEvent
        ? summarizeExecutionEvent(completionEvent).replace(/^Completed:?\s*/i, "").trim()
        : "";
      return {
        label: "Completed",
        detail: durationLabel
          ? `${durationLabel}${completionSummary ? `: ${completionSummary}` : "."}`
          : latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run finished.",
        tone: "muted" as const,
      };
    }

    if (latestPromptDeferredEvent && latestPromptDeferredEvent.id === latestExecutionEvent?.id) {
      return {
        label: "Retry queued",
        detail: [durationLabel, summarizeExecutionEvent(latestPromptDeferredEvent)].filter(Boolean).join(". "),
        tone: "active" as const,
      };
    }

    if (latestWaitEvent && !activeConversationAgents.some((agent) => agent.state === "working")) {
      const details = parseExecutionEventDetails(latestWaitEvent.details);
      const seconds = typeof details.seconds === "number" ? details.seconds : null;
      return {
        label: seconds ? `Waiting ${seconds}s` : "Waiting",
        detail: [durationLabel, summarizeExecutionEvent(latestWaitEvent)].filter(Boolean).join(". "),
        tone: "muted" as const,
      };
    }

    if (activeConversationAgents.some((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))) {
      return {
        label: "Working",
        detail: [durationLabel, liveThoughts[0]?.snippet || "The worker is active."].filter(Boolean).join(". "),
        tone: "active" as const,
      };
    }

    return {
      label: "Working",
      detail: [durationLabel, latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "Omni is still checking the run."].filter(Boolean).join(". "),
      tone: "active" as const,
    };
  }, [activeConversationAgents, awaitingUserQuestionMessage, completionEvent, erroredAgent, hasStuckWorker, isSelectedConversationLoaded, latestExecutionEvent, latestPromptDeferredEvent, latestStuckEvent, latestWaitEvent, liveThoughts, pendingElicitationAgent, pendingPermissionAgent, queuedMessageCount, selectedRun, showRecoverableRunningState]);
  return { liveExecutionStatus };
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:44:52.700Z","phase":null} -->
## Tool result: call_ZqhMnH94ZA2KDPXYWEgLPPtk · 2026-06-16T21:44:52.700Z

```text
Chunk ID: 3bc857
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2540
Output:
"use client";

import Image from "next/image";
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ALargeSmall, Check, ChevronDown, Copy, LoaderCircle } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { attachmentImagePreviewManager, conversationCopyNoticeManager, terminalUiManager } from "@/components/component-state-managers";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  appearancePreferencesManager,
  getConversationTerminalTextSizeStyle,
  getTerminalTextSizeStyle,
  TERMINAL_TEXT_SIZE_LEVELS,
  type TerminalTextSizeLevel,
} from "@/app/home/AppearancePreferencesManager";
import { buildAgentOutputActivity, formatActivityStatus, type AgentActivityItem, type AgentOutputEntry, type AgentToolGroupCounts } from "@/lib/agent-output";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { formatBytes, type ChatAttachment } from "@/lib/chat-attachments";
import { parseProjectFileReference, type ProjectFileReference } from "@/lib/project-file-links";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface TerminalProps {
  agent?: AgentTerminalPayload | null;
  userMessages?: TerminalUserMessage[];
  /**
   * Unified worker conversation stream entries. When provided, the
   * Terminal renders directly from these and ignores `agent` /
   * `userMessages`. Phase 4 of the unified stream rollout flips
   * ConversationMain to pass this prop. See
   * docs/architecture/worker-conversation-stream.md.
   */
  entries?: WorkerEntry[];
  allowUserMessageFallback?: boolean;
  getUserMessageActions?: (message: TerminalUserMessage) => TerminalUserMessageAction[];
  editingUserMessageId?: string | null;
  editingUserMessageValue?: string;
  isEditingUserMessageSaving?: boolean;
  onEditingUserMessageValueChange?: (value: string) => void;
  onCancelEditingUserMessage?: () => void;
  onSaveEditedUserMessage?: (messageId: string) => void;
  hasMoreHistory?: boolean;
  onRequestMoreHistory?: () => void;
  variant?: "terminal" | "native";
  textSizeScope?: "terminal" | "conversation";
  conversationMessageTextSize?: boolean;
  className?: string;
  showTextSizeControl?: boolean;
  showPendingAssistantIndicator?: boolean;
  pendingAssistantStatus?: TerminalPendingAssistantStatus;
  activityFilter?: (activity: TerminalActivityItem) => boolean;
  thoughtsDefaultOpen?: boolean;
  toolGroupsDefaultOpen?: boolean;
  emptyState?: ReactNode;
  isLoading?: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
  scrollAnchorKey?: string | null;
  summarizeWorkBlocks?: boolean;
}

export interface TerminalUserMessage {
  id: string;
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

export interface TerminalUserMessageAction {
  label: string;
  title?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  menuItems?: TerminalUserMessageActionItem[];
  feedback?: "copy-message";
}

export interface TerminalUserMessageActionItem {
  label: string;
  title?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface AgentTerminalPayload {
  outputEntries?: AgentOutputEntry[];
  state?: string | null;
  currentText?: string;
  lastText?: string;
  displayText?: string;
}

export type TerminalActivityItem = AgentActivityItem | {
  id: string;
  kind: "user_message";
  messageId: string;
  text: string;
  timestamp: string;
  attachments: ChatAttachment[];
  actions: TerminalUserMessageAction[];
} | {
  id: string;
  kind: "pending_assistant";
  status: TerminalPendingAssistantStatus;
  timestamp: string;
};
type TerminalActivityItemWithOrder = TerminalActivityItem & { streamSeq?: number };
export type TerminalActivityKind = TerminalActivityItem["kind"];
export type TerminalPendingAssistantStatus = "connecting" | "thinking" | "working";

const TOOL_OUTPUT_PREVIEW_LINES = 3;
const TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT = "calc(var(--terminal-pane-size) * 4.65 + 1rem)";
const TOOL_OUTPUT_EXPANDED_MAX_HEIGHT = "min(72vh, 42rem)";
const TERMINAL_REVEAL_CLASS = "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
const TERMINAL_REVEAL_OPEN_CLASS = "grid-rows-[1fr] opacity-100 translate-y-0";
const TERMINAL_REVEAL_CLOSED_CLASS = "grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none";
const TERMINAL_TOOL_STATUSES = new Set(["completed", "done", "failed", "error", "cancelled"]);
const TERMINAL_BOTTOM_THRESHOLD_PX = 1;
const TERMINAL_TOP_THRESHOLD_PX = 4;
export { TERMINAL_TEXT_SIZE_LEVELS };
export type TerminalZoomLevel = TerminalTextSizeLevel;
export const getTerminalZoomStyle = getTerminalTextSizeStyle;

export function shouldTerminalFollowLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= TERMINAL_BOTTOM_THRESHOLD_PX;
}

export function shouldTerminalKeepFollowingLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
  previousScrollTop: number,
) {
  if (metrics.scrollTop < previousScrollTop) {
    return false;
  }

  return shouldTerminalFollowLatest(metrics);
}

export function getTerminalActivityVersion(activity: TerminalActivityItem[]) {
  return activity.map((item) => {
    switch (item.kind) {
      case "pending_assistant":
        return `${item.id}:${item.kind}:${item.status}`;
      case "thinking":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.inProgress}:${item.thoughts.join("\n").length}`;
      case "tool":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.status}:${item.title.length}:${item.inputPane?.text.length ?? 0}:${item.outputPane?.text.length ?? 0}`;
      case "tool_group":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.status}:${item.tools.length}:${item.tools.map((tool) => `${tool.id}:${tool.status}:${tool.title.length}:${tool.inputPane?.text.length ?? 0}:${tool.outputPane?.text.length ?? 0}`).join(",")}`;
      case "permission":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.status}:${item.title.length}:${item.text.length}:${item.detail?.length ?? 0}`;
      case "message":
      case "user_message":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.text.length}`;
      case "work_summary":
        return `${item.id}:${item.kind}:${item.durationMs}:${item.inProgress}:${item.items.length}`;
    }
  }).join("|");
}

export function shouldTerminalConnectorExtend(
  activityKind: TerminalActivityKind,
  adjacentActivityKind: TerminalActivityKind | undefined,
) {
  return activityKind !== "user_message"
    && adjacentActivityKind !== undefined
    && adjacentActivityKind !== "user_message";
}

export function TerminalTextSizeControl({ className }: { className?: string }) {
  const { terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
  useI18nSnapshot();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 dark:border-white/10 dark:bg-[#15181d]/95 dark:text-zinc-400 dark:hover:bg-[#1d2128] dark:hover:text-zinc-100 dark:focus-visible:ring-cyan-300/45",
          className,
        )}
        aria-label={t("settings.appearance.terminalFontSize")}
        title={t("settings.appearance.terminalFontSize")}
      >
        <ALargeSmall className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("settings.appearance.terminalFontSize")}</DropdownMenuLabel>
          {TERMINAL_TEXT_SIZE_LEVELS.map((level) => (
            <DropdownMenuItem
              key={level.value}
              onClick={() => appearancePreferencesManager.setTerminalTextSize(level.value)}
              className="text-xs"
            >
              <span className="w-4">
                {terminalTextSize === level.value ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span>{t(level.labelKey)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function shouldTerminalRequestMoreHistory(
  metrics: Pick<HTMLDivElement, "scrollTop">,
) {
  return metrics.scrollTop <= TERMINAL_TOP_THRESHOLD_PX;
}

function getTerminalScrollElement(container: HTMLDivElement, variant: "terminal" | "native") {
  if (variant === "terminal") {
    return container;
  }

  return (container.closest('[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]') as HTMLDivElement | null) ?? container;
}

function scrollTerminalToBottom(container: HTMLDivElement, behavior: ScrollBehavior = "smooth") {
  if (container.scrollHeight <= container.clientHeight) {
    return false;
  }
  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  });
  return true;
}

export function shouldTerminalScrollToLatest({
  variant,
  isFirstRenderedActivity,
  latestActivityKind,
}: {
  variant: "terminal" | "native";
  isFirstRenderedActivity: boolean;
  latestActivityKind: TerminalActivityKind | undefined;
}) {
  if (variant !== "native") {
    return true;
  }

  if (latestActivityKind === "pending_assistant") {
    return false;
  }

  return !(isFirstRenderedActivity && latestActivityKind === "user_message");
}

function activityTimestampMs(timestamp: string) {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : 0;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:44:59.974Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:44:59.974Z

Now the other half of the screenshot clicks: `Working...` is driven by `agents[].state`, not just the persisted worker row. `buildLiveWorkerSnapshots` currently preserves a live bridge agent’s `working` state even when the selected run is terminal, so a stale bridge agent can keep reasserting “working” after SQLite says the run is `done`.

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:45:11.467Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:45:11.467Z

I’ve got a focused fix shape: when a run is terminal (`done`, `failed`, `cancelled`, etc.), a live bridge agent snapshot must not be allowed to publish active `starting/working/stuck` state or current text into the UI. Terminal persisted run status should win over stale live bridge state. I’m adding a regression test around that before patching.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:11.470Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:45:11.470Z

```json
{
  "cmd": "rg -n \"buildLiveWorkerSnapshot|buildLiveWorkerSnapshots|live-snapshots\" tests src -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:11.470Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:45:11.470Z

```json
{
  "cmd": "sed -n '1,260p' tests/server/workers/live-snapshots.test.ts 2>/dev/null || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:12.146Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:45:12.146Z

```json
{
  "cmd": "sed -n '260,520p' tests/server/workers/live-snapshots.test.ts 2>/dev/null || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:12.170Z","phase":null} -->
## Tool result: call_kOowgYPL6ZMmYHfJdRbz5Ken · 2026-06-16T21:45:12.170Z

```text
Chunk ID: 9aeb67
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 662
Output:
src/runtime/http/routes/events.ts:11:import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
src/runtime/http/routes/events.ts:394:function compactAgentSnapshot(agent: ReturnType<typeof buildLiveWorkerSnapshots>[number]) {
src/runtime/http/routes/events.ts:440:  agentsData: ReturnType<typeof buildLiveWorkerSnapshots>,
src/runtime/http/routes/events.ts:555:    buildLiveWorkerSnapshots({
src/runtime/http/routes/events.ts:632:  let agentsData = buildLiveWorkerSnapshots({
src/runtime/http/routes/events.ts:674:      agentsData = buildLiveWorkerSnapshots({
src/runtime/http/routes/events.ts:681:      agentsData = buildLiveWorkerSnapshots({
src/runtime/http/routes/events.ts:697:    agentsData = buildLiveWorkerSnapshots({
src/runtime/http/routes/agent-detail.ts:8:import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";
src/runtime/http/routes/agent-detail.ts:155:    return Response.json(buildLiveWorkerSnapshot({
src/runtime/http/routes/agent-detail.ts:162:      return Response.json(buildLiveWorkerSnapshot({
src/server/workers/live-snapshots.ts:165:export function buildLiveWorkerSnapshot(args: {
src/server/workers/live-snapshots.ts:265:export function buildLiveWorkerSnapshots(args: {
src/server/workers/live-snapshots.ts:283:    const snapshot = buildLiveWorkerSnapshot({
src/server/workers/live-snapshots.ts:300:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:2:import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";
tests/server/live-worker-snapshots.test.ts:4:describe("buildLiveWorkerSnapshot", () => {
tests/server/live-worker-snapshots.test.ts:6:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:78:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:137:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:224:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:284:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:346:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:448:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:519:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:568:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:626:    const snapshot = buildLiveWorkerSnapshot({
tests/server/live-worker-snapshots.test.ts:685:    const snapshot = buildLiveWorkerSnapshot({

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:12.171Z","phase":null} -->
## Tool result: call_Y5ZHD0SZbMpnfYcqlnpDOH4L · 2026-06-16T21:45:12.171Z

```text
Chunk ID: 9c0811
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:12.200Z","phase":null} -->
## Tool result: call_rXH5UA2wFXAWo0lhq49LnXTp · 2026-06-16T21:45:12.200Z

```text
Chunk ID: 96dda5
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:25.752Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:45:25.752Z

```json
{
  "cmd": "sed -n '1,140p' tests/server/live-worker-snapshots.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:25.752Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:45:25.752Z

```json
{
  "cmd": "sed -n '620,760p' tests/server/live-worker-snapshots.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:25.978Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:45:25.978Z

```json
{
  "cmd": "sed -n '260,340p' src/server/workers/live-snapshots.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:26.034Z","phase":null} -->
## Tool result: call_RRavE90V8C4ZFUUzULvUMzoR · 2026-06-16T21:45:26.034Z

```text
Chunk ID: 549889
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1059
Output:
import { describe, expect, it } from "vitest";
import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";

describe("buildLiveWorkerSnapshot", () => {
  it("drops stale live current text from an idle completed direct worker", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-done",
        type: "gemini",
        cwd: "/repo",
        state: "idle",
        currentText: "Final answer that the bridge left in currentText",
        lastText: "Final answer that the bridge left in currentText",
        outputEntries: [
          {
            id: "entry-final",
            type: "message",
            text: "Final answer that the bridge left in currentText",
            timestamp: new Date(0).toISOString(),
          },
        ],
        pendingPermissions: [],
      },
      worker: {
        id: "worker-done",
        runId: "run-done",
        type: "gemini",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [
          {
            id: "entry-final",
            type: "message",
            text: "Final answer that the bridge left in currentText",
            timestamp: new Date(0).toISOString(),
          },
        ],
        currentText: "",
        lastText: "Final answer that the bridge left in currentText",
        bridgeSessionId: "session-done",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-done",
        planId: "plan-done",
        mode: "direct",
        projectPath: "/repo",
        title: "Completed direct run",
        preferredWorkerType: "gemini",
        preferredWorkerModel: "gemini-3.5-flash",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "gemini",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "done",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      state: "idle",
      currentText: "",
      lastText: "Final answer that the bridge left in currentText",
      displayText: "Final answer that the bridge left in currentText",
    }));
  });

  it("drops stale bridge permission requests from completed runs", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-done",
        type: "claude",
        cwd: "/repo",
        state: "idle",
        currentText: "",
        lastText: "Done.",
        outputEntries: [],
        pendingPermissions: [
          {
            requestId: 7,
            requestedAt: new Date(0).toISOString(),
            options: [{ optionId: "allow", kind: "allow", name: "Allow" }],
          },
        ],
      },
      worker: {
        id: "worker-done",
        runId: "run-done",
        type: "claude",
        status: "idle",
        cwd: "/repo",
        outputLog: "Earlier permission request.",
        outputEntries: [],
        currentText: "",
        lastText: "Done.",
        bridgeSessionId: "session-done",
        bridgeSessionMode: "full-access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-done",
        planId: "plan-done",
        mode: "direct",
        projectPath: "/repo",
        title: "Completed direct run",
        preferredWorkerType: "claude",
        preferredWorkerModel: "claude-sonnet",
        preferredWorkerEffort: "medium",
        allowedWorkerTypes: "claude",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "done",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot?.pendingPermissions).toEqual([]);
  });

  it("merges bridge output with persisted run metadata for steady-state rendering", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-1",
        type: "codex",

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:26.034Z","phase":null} -->
## Tool result: call_ALoJykoKAcjE9FZfN51MYWXx · 2026-06-16T21:45:26.034Z

```text
Chunk ID: 5ff10f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 829
Output:
        expect.objectContaining({ id: "message-structured" }),
      ],
    }));
  });

  it("surfaces a diagnostic when a live bridge agent stops without output", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: {
        name: "worker-empty",
        type: "codex",
        cwd: "/repo",
        state: "idle",
        currentText: "",
        lastText: "",
        renderedOutput: "",
        outputEntries: [],
        stopReason: "end_turn",
      },
      worker: {
        id: "worker-empty",
        runId: "run-empty",
        type: "codex",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "",
        lastText: "",
        bridgeSessionId: "session-empty",
        bridgeSessionMode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-empty",
        planId: "plan-empty",
        mode: "direct",
        projectPath: "/repo",
        title: "Empty direct run",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      name: "worker-empty",
      state: "idle",
      lastText: "Agent stopped without producing output. Stop reason: end_turn.",
      displayText: "Agent stopped without producing output. Stop reason: end_turn.",
    }));
  });

  it("surfaces a diagnostic when an idle persisted worker has no bridge output", () => {
    const snapshot = buildLiveWorkerSnapshot({
      agent: null,
      worker: {
        id: "worker-missing-empty",
        runId: "run-missing-empty",
        type: "codex",
        status: "idle",
        cwd: "/repo",
        outputLog: "",
        outputEntries: [],
        currentText: "",
        lastText: "",
        bridgeSessionId: null,
        bridgeSessionMode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      run: {
        id: "run-missing-empty",
        planId: "plan-missing-empty",
        mode: "direct",
        projectPath: "/repo",
        title: "Missing empty direct run",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.5",
        preferredWorkerEffort: "high",
        allowedWorkerTypes: "codex",
        specPath: null,
        artifactPlanPath: null,
        plannerArtifactsJson: null,
        parentRunId: null,
        forkedFromMessageId: null,
        status: "running",
        failedAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      name: "worker-missing-empty",
      state: "idle",
      lastText: "Worker is idle with no recorded output, and the bridge no longer has a live session for it.",
      displayText: "Worker is idle with no recorded output, and the bridge no longer has a live session for it.",
    }));
  });
});

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:26.034Z","phase":null} -->
## Tool result: call_Gimu2QtwomZLxsaj6Of5WE8U · 2026-06-16T21:45:26.034Z

```text
Chunk ID: e139d7
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 350
Output:
    bridgeMissing: true,
    updatedAt: worker?.updatedAt ?? null,
  };
}

export function buildLiveWorkerSnapshots(args: {
  agents?: unknown[];
  workers?: PersistedWorkerRecord[];
  runs?: PersistedRunRecord[];
  bridgeError?: unknown;
}) {
  const workers = args.workers ?? [];
  const runsById = new Map((args.runs ?? []).map((run) => [run.id, run]));
  const workersById = new Map(workers.map((worker) => [worker.id, worker]));
  const snapshots: LiveWorkerSnapshot[] = [];
  const seenWorkerIds = new Set<string>();

  for (const rawAgent of args.agents ?? []) {
    const normalizedAgent = normalizeAgentRecord(rawAgent);
    if (!normalizedAgent.name) {
      continue;
    }

    const snapshot = buildLiveWorkerSnapshot({
      agent: normalizedAgent,
      worker: workersById.get(normalizedAgent.name) ?? null,
      run: workersById.get(normalizedAgent.name) ? runsById.get(workersById.get(normalizedAgent.name)!.runId) ?? null : null,
    });

    if (snapshot) {
      snapshots.push(snapshot);
      seenWorkerIds.add(snapshot.name);
    }
  }

  for (const worker of workers) {
    if (seenWorkerIds.has(worker.id)) {
      continue;
    }

    const snapshot = buildLiveWorkerSnapshot({
      worker,
      run: runsById.get(worker.runId) ?? null,
      bridgeError: args.bridgeError,
    });

    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:45:50.010Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:45:50.010Z

There are two fixes that fit the evidence, both scoped: stop terminal runs from rendering stale live `working` agent state, and make the queue manager remember the `updatedAt` of a server-absent row so an older in-flight server snapshot cannot restore it. I’m patching those with tests now.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:45:59.726Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:45:59.726Z

```json
*** Begin Patch
*** Update File: tests/server/live-worker-snapshots.test.ts
@@
   it("drops stale live current text from an idle completed direct worker", () => {
@@
   });
+
+  it("does not publish stale active bridge state for completed runs", () => {
+    const snapshot = buildLiveWorkerSnapshot({
+      agent: {
+        name: "worker-done",
+        type: "claude",
+        cwd: "/repo",
+        state: "working",
+        currentText: "Stale live bridge text that should not make the UI active",
+        lastText: "Final answer",
+        outputEntries: [
+          {
+            id: "entry-final",
+            type: "message",
+            text: "Final answer",
+            timestamp: new Date(0).toISOString(),
+          },
+        ],
+        pendingPermissions: [],
+      },
+      worker: {
+        id: "worker-done",
+        runId: "run-done",
+        type: "claude",
+        status: "idle",
+        cwd: "/repo",
+        outputLog: "",
+        outputEntries: [
+          {
+            id: "entry-final",
+            type: "message",
+            text: "Final answer",
+            timestamp: new Date(0).toISOString(),
+          },
+        ],
+        currentText: "",
+        lastText: "Final answer",
+        bridgeSessionId: "session-done",
+        bridgeSessionMode: "full-access",
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+      run: {
+        id: "run-done",
+        planId: "plan-done",
+        mode: "direct",
+        projectPath: "/repo",
+        title: "Completed direct run",
+        preferredWorkerType: "claude",
+        preferredWorkerModel: "claude-sonnet",
+        preferredWorkerEffort: "medium",
+        allowedWorkerTypes: "claude",
+        specPath: null,
+        artifactPlanPath: null,
+        plannerArtifactsJson: null,
+        parentRunId: null,
+        forkedFromMessageId: null,
+        status: "done",
+        failedAt: null,
+        lastError: null,
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+    });
+
+    expect(snapshot).toEqual(expect.objectContaining({
+      state: "idle",
+      currentText: "",
+      lastText: "Final answer",
+      displayText: "Final answer",
+    }));
+  });
 
   it("drops stale bridge permission requests from completed runs", () => {
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:45:59.804Z","phase":null} -->
## Tool result: call_VUJDXeJOIphWKxCYnvUzKWh8 · 2026-06-16T21:45:59.804Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M tests/server/live-worker-snapshots.test.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:46:09.735Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:46:09.735Z

```json
*** Begin Patch
*** Update File: tests/app/busy-message-queue-manager.test.ts
@@
   it("allows a server snapshot to restore a row that became pending again", () => {
@@
     const pendingAgain = buildQueuedMessage({
       ...queuedMessage,
       status: "pending",
       lastError: "Worker is busy",
+      updatedAt: "2026-05-25T00:00:02.000Z",
     });
@@
     expect(manager.getQueuedMessagesForRun("run-a")).toEqual([pendingAgain]);
   });
+
+  it("ignores older authoritative server snapshots after the server removed an active row", () => {
+    const manager = new BusyMessageQueueManager();
+    const queuedMessage = buildQueuedMessage({
+      id: "queued-late-server-frame",
+      runId: "run-a",
+      status: "pending",
+      updatedAt: "2026-05-25T00:00:01.000Z",
+    });
+
+    manager.setQueuedMessages([queuedMessage], false);
+    manager.setQueuedMessages([], false);
+    manager.setQueuedMessages([queuedMessage], false);
+
+    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
+  });
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:46:09.773Z","phase":null} -->
## Tool result: call_ckFHQ8Z14gSgv9ehKFzVOdY4 · 2026-06-16T21:46:09.773Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M tests/app/busy-message-queue-manager.test.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:46:13.824Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:46:13.824Z

The tests are in place: one for stale active bridge state after completion, one for a late server queue frame trying to bring back an already-absent active row. Now I’m changing only those two managers.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:46:20.695Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:46:20.695Z

```json
*** Begin Patch
*** Update File: src/server/workers/live-snapshots.ts
@@
   if (normalizedAgent) {
+    const terminalRun = isTerminalRun(run);
+    const effectiveState = terminalRun
+      ? isFailedRun(run) ? "error" : "idle"
+      : normalizedAgent.state;
     const structuredOutput = cleanStructuredOutput(normalizedAgent.renderedOutput);
-    const liveText = isAgentActive(normalizedAgent.state) && normalizedAgent.currentText.length > 0
+    const liveText = isAgentActive(effectiveState) && normalizedAgent.currentText.length > 0
       ? normalizedAgent.currentText
       : "";
@@
     return {
       ...normalizedAgent,
+      state: effectiveState,
       pendingPermissions: isTerminalRun(run) ? [] : normalizedAgent.pendingPermissions,
       pendingElicitations: isTerminalRun(run) ? [] : normalizedAgent.pendingElicitations,
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:46:20.745Z","phase":null} -->
## Tool result: call_HIilCln8Qzi9gcX17MxpESqw · 2026-06-16T21:46:20.745Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M src/server/workers/live-snapshots.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:46:26.467Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:46:26.467Z

The terminal-state fix is now in: terminal run status wins over a stale live bridge `working` state. I’m tightening the queue manager next so it treats late active snapshots as stale when their `updatedAt` is not newer than the row that just disappeared.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:46:28.887Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:46:28.887Z

```json
*** Begin Patch
*** Update File: src/server/workers/live-snapshots.ts
@@
-      pendingPermissions: isTerminalRun(run) ? [] : normalizedAgent.pendingPermissions,
-      pendingElicitations: isTerminalRun(run) ? [] : normalizedAgent.pendingElicitations,
+      pendingPermissions: terminalRun ? [] : normalizedAgent.pendingPermissions,
+      pendingElicitations: terminalRun ? [] : normalizedAgent.pendingElicitations,
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:46:28.940Z","phase":null} -->
## Tool result: call_XVIuID3wpTDgv6nWsqRGBh4h · 2026-06-16T21:46:28.940Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M src/server/workers/live-snapshots.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:46:38.989Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:46:38.989Z

I’m making the queue absence marker timestamped rather than just a boolean. A boolean can be cleared by any later server frame, even an older one; the timestamp lets a genuinely new pending row restore while blocking stale in-flight frames.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:07.801Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:47:07.801Z

```json
*** Begin Patch
*** Update File: src/app/home/BusyMessageQueueManager.ts
@@
   interruptingMessageIds: Set<string>;
   locallyHiddenMessageIds: Set<string>;
-  serverAbsentMessageIds: Set<string>;
+  serverAbsentMessageUpdatedAtById: Map<string, number>;
 };
@@
   cancellingMessageIds: new Set(),
   interruptingMessageIds: new Set(),
   locallyHiddenMessageIds: new Set(),
-  serverAbsentMessageIds: new Set(),
+  serverAbsentMessageUpdatedAtById: new Map(),
 };
 
 function isActiveQueuedMessage(message: QueuedConversationMessageRecord) {
   return message.status === "pending" || message.status === "delivering";
 }
+
+function timestampMs(value: string | null | undefined) {
+  if (!value) {
+    return 0;
+  }
+  const parsed = new Date(value).getTime();
+  return Number.isFinite(parsed) ? parsed : 0;
+}
+
+function isStaleServerAbsentActiveMessage(
+  message: QueuedConversationMessageRecord,
+  serverAbsentMessageUpdatedAtById: Map<string, number>,
+) {
+  if (!isActiveQueuedMessage(message)) {
+    return false;
+  }
+  const absentUpdatedAt = serverAbsentMessageUpdatedAtById.get(message.id);
+  return absentUpdatedAt !== undefined && timestampMs(message.updatedAt) <= absentUpdatedAt;
+}
@@
   setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
     this.update((current) => {
-      const incomingIds = new Set(messages.map((message) => message.id));
+      const incomingMessages = messages.filter(
+        (message) => !isStaleServerAbsentActiveMessage(message, current.serverAbsentMessageUpdatedAtById),
+      );
+      const incomingIds = new Set(incomingMessages.map((message) => message.id));
       const newlyAbsentActiveIds = current.queuedMessages
         .filter((message) => isActiveQueuedMessage(message) && !incomingIds.has(message.id))
-        .map((message) => message.id);
+        .map((message) => [message.id, timestampMs(message.updatedAt)] as const);
       // Server rows are authoritative: clear optimistic interrupt/cancel flags
       // for any row that has left a pending/delivering state.
       const settledIds = new Set(
         [
-          ...messages
+          ...incomingMessages
             .filter((message) => !isActiveQueuedMessage(message))
             .map((message) => message.id),
-          ...newlyAbsentActiveIds,
+          ...newlyAbsentActiveIds.map(([id]) => id),
         ],
       );
@@
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      for (const id of newlyAbsentActiveIds) {
-        serverAbsentMessageIds.add(id);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      for (const [id, updatedAt] of newlyAbsentActiveIds) {
+        serverAbsentMessageUpdatedAtById.set(id, updatedAt);
       }
-      for (const id of incomingIds) {
-        serverAbsentMessageIds.delete(id);
+      for (const message of incomingMessages) {
+        serverAbsentMessageUpdatedAtById.delete(message.id);
       }
       return {
         ...current,
-        queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
+        queuedMessages: incomingMessages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
         cancellingMessageIds: clearSettled(current.cancellingMessageIds),
         interruptingMessageIds: clearSettled(current.interruptingMessageIds),
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     }, notify);
   }
@@
   upsertQueuedMessage(message: QueuedConversationMessageRecord) {
     this.update((current) => {
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      if (isActiveQueuedMessage(message) && serverAbsentMessageIds.has(message.id)) {
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      if (isStaleServerAbsentActiveMessage(message, serverAbsentMessageUpdatedAtById)) {
         return current;
       }
 
       const cancellingMessageIds = new Set(current.cancellingMessageIds);
       const interruptingMessageIds = new Set(current.interruptingMessageIds);
       if (!isActiveQueuedMessage(message)) {
         cancellingMessageIds.delete(message.id);
         interruptingMessageIds.delete(message.id);
-        serverAbsentMessageIds.add(message.id);
+        serverAbsentMessageUpdatedAtById.set(message.id, timestampMs(message.updatedAt));
         return {
           ...current,
           queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
           cancellingMessageIds,
           interruptingMessageIds,
-          serverAbsentMessageIds,
+          serverAbsentMessageUpdatedAtById,
         };
       }
 
-      serverAbsentMessageIds.delete(message.id);
+      serverAbsentMessageUpdatedAtById.delete(message.id);
       const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
       if (existingIndex === -1) {
         return {
           ...current,
           queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
-          serverAbsentMessageIds,
+          serverAbsentMessageUpdatedAtById,
         };
       }
@@
       return {
         ...current,
         queuedMessages: next,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
@@
       locallyHiddenMessageIds.add(messageId);
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      serverAbsentMessageIds.add(messageId);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      const existing = current.queuedMessages.find((message) => message.id === messageId);
+      serverAbsentMessageUpdatedAtById.set(messageId, timestampMs(existing?.updatedAt));
       return {
         queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
         cancellingMessageIds,
         interruptingMessageIds,
         locallyHiddenMessageIds,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
@@
       const cancellingMessageIds = new Set(current.cancellingMessageIds);
       const interruptingMessageIds = new Set(current.interruptingMessageIds);
       const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
       cancellingMessageIds.delete(message.id);
       interruptingMessageIds.delete(message.id);
       locallyHiddenMessageIds.delete(message.id);
-      serverAbsentMessageIds.delete(message.id);
+      serverAbsentMessageUpdatedAtById.delete(message.id);
@@
         queuedMessages,
         cancellingMessageIds,
         interruptingMessageIds,
         locallyHiddenMessageIds,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:07.846Z","phase":null} -->
## Tool result: call_BYmCt0k8VjwywYHfaczSwSlM · 2026-06-16T21:47:07.846Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M src/app/home/BusyMessageQueueManager.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:47:15.126Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:47:15.126Z

Both patches are in. I’m running the targeted tests now: queue manager behavior, live worker snapshots, and the conversation sync regression that exercises queued drain after direct completion.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:15.131Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:47:15.131Z

```json
{
  "cmd": "pnpm vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:15.243Z","phase":null} -->
## Tool call: write_stdin · 2026-06-16T21:47:15.243Z

```json
{
  "session_id": 48423,
  "chars": "",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:17.597Z","phase":null} -->
## Tool result: call_oE3z7HHwgq37uMwsrhXzIwkB · 2026-06-16T21:47:17.597Z

```text
Chunk ID: 10a2bb
Wall time: 2.3040 seconds
Process exited with code 1
Original token count: 917
Output:
[WARN] Unsupported engine: wanted: {"node":">=22.13 <26"} (current: {"node":"v26.3.0","pnpm":"11.2.2"})
Lockfile is up to date, resolution step is skipped
Already up to date

   ╭─────────────────────────────────────────╮
   │                                         │
   │   Update available! 11.2.2 → 11.7.0.    │
   │   Changelog: https://pnpm.io/v/11.7.0   │
   │    To update, run: pnpm add -g pnpm     │
   │                                         │
   ╰─────────────────────────────────────────╯


. preinstall$ node ./scripts/check-pnpm.mjs
. preinstall: OmniHarness requires Node.js >=22.13.0 <26.0.0.
. preinstall: Current runtime: v26.3.0 at /opt/homebrew/Cellar/node/26.3.0/bin/node
. preinstall: This repo uses native dependencies, so unsupported Node versions can fail during install or runtime.
. preinstall: Switch to a supported Node version, then run `pnpm rebuild better-sqlite3 @node-rs/argon2 sharp` if node_modules already exists.
. preinstall: Failed
[ELIFECYCLE] Command failed with exit code 1.
[ERROR] Command failed with exit code 1: /opt/homebrew/Cellar/node/26.3.0/bin/node '/Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/bin/pnpm.mjs' install

pnpm: Command failed with exit code 1: /opt/homebrew/Cellar/node/26.3.0/bin/node '/Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/bin/pnpm.mjs' install
    at getFinalError (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:29448:14)
    at makeError (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:31755:21)
    at getSyncResult (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:33599:10)
    at spawnSubprocessSync (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:33559:14)
    at execaCoreSync (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:33489:23)
    at callBoundExeca (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:36017:23)
    at boundExeca (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:35994:49)
    at sync (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:36153:10)
    at runPnpmCli (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:213261:5)
    at runDepsStatusCheck (file:///Users/masterman/Library/pnpm/store/v11/links/@/pnpm/11.2.2/e33168da9f20c39744207ae93b38ad649d10a9feda3bbeea2d739ac9d0fd2d17/node_modules/pnpm/dist/pnpm.mjs:214967:7)

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:17.598Z","phase":null} -->
## Tool result: call_qluEB92OnEyICd57OxYqB9kG · 2026-06-16T21:47:17.598Z

````text
Chunk ID: 45ce1a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1790
Output:
## Second opinion: root cause is a non-atomic, unsynchronized queue drain (TOCTOU race), not a client bug

The DB is correct (both rows `delivered`, worker idle, run `done`), so this is a **transient-state ordering** problem, not a persistence problem. The prior client fixes (`serverAbsentMessageIds`) were patching a symptom one layer too high. The actual defect is on the server, in the drain path.

### Why concurrent drains happen

`syncConversationSessions` — which calls `drainQueuedWorkerMessagesWithObservation` — has **three independent, unsynchronized callers**:

- `runtime-watchdog.ts:70` (15s sweep, via `syncConversationSessionsFromBridge`)
- `routes/events.ts:645` (SSE-driven, per connected client)
- `stuck-worker-reaper.ts:188`

`bridgeSyncInFlight` (sync.ts:408) only dedupes the watchdog against *itself*. The SSE path and reaper can — and given a phone reconnecting / multiple tabs, routinely do — run `syncConversationSessions` concurrently with the watchdog. So two `drainQueuedWorkerMessagesWithObservation` calls for the same `(run, worker)` overlap.

### The race, mapped to your event log

The "claim" of a pending row is **not atomic**. In `drainQueuedWorkerMessages` (queued-messages.ts):

1. line 967 — `pendingQueueRecords` reads rows where `status='pending'`
2. line 986 — sets `status='delivering'` **unconditionally** (no `WHERE status='pending'` guard)
3. lines 991–996 — flips `runs.status='running'` **outside** `runWorkerTurn`
4. line 999 — `runWorkerTurn` (this is the *only* serialization, and it's too late)

And the wrapper (`drainQueuedWorkerMessagesWithObservation`, sync.ts:269) computes `pendingCount` separately from the re-fetch inside the drain. So:

- Both syncs see `pendingCount=1` while worker is `working` → the **repeated `skip ... workerStatus=working`** lines.
- Worker quiesces. Both syncs now decide `drain` in the same tick → **duplicate `drain_decision` at the same second**.
- Sync A's `drainQueuedWorkerMessages` claims the row (`pending`→`delivering`), runs the turn, delivers → `queued_message_delivered` + **`delivered 1 of 1`**.
- Sync B's wrapper already counted `pendingCount=1`, but by the time its `drainQueuedWorkerMessages` re-runs `pendingQueueRecords`, the row is no longer `pending` → returns empty → **`delivered 0 of 1`**.

That sequence is an exact fingerprint of a check-then-act race with two readers.

### Why the two UI symptoms appear

**"Working…" flickers:** the losing/redundant drain re-executes lines 986–996 *after* the run already reached `done` — flipping `runs.status` back to `running` and (if it gets into the per-record loop) `workers.status` back to `working`, each followed by `notifyEventStreamSubscribers()`. The client's `useConversationExecutionStatus` (line 226) renders "Working" whenever an agent is `working` or has `currentText`. So a completed run momentarily re-enters "Working".

**Delivered row stuck in the drawer:** the snapshot's `queuedMessages` is `pending ∪ delivering` (`listPendingQueuedConversationMessages`). When the redundant drain resurrects a delivered row to `delivering` (line 986), a snapshot generated at that instant contains it. Critically, `queuedMessages` is **last-writer-wins with no monotonicity guard**: `EventStreamStateManager.update` never merges `queuedMessages` (only runs/workers/plans/sessions are merged in `mergeScopedCatalog`), and `setQueuedMessages` trusts incoming server rows wholesale — it only consults `locallyHiddenMessageIds`, **not** `serverAbsentMessageIds`. So if the stale `delivering` snapshot lands *after* the final `delivered` snapshot (trivially possible since these notifies fire from concurrent async paths and SSE flush order isn't guaranteed), the drawer re-populates the delivered row and never clears it. The `serverAbsentMessageIds` guard you added protects `upsertQueuedMessage` but is bypassed entirely by the snapshot path.

### Focused fix (server, root cause)

Make the claim atomic and gate all side effects on winning it. In `drainQueuedWorkerMessages`, replace the unconditional `delivering` write with a compare-and-swap:

```ts
const claimed = await db.update(queuedConversationMessages)
  .set({ status: "delivering", updatedAt: startedAt, lastError: null })
  .where(and(
    eq(queuedConversationMessages.id, record.id),
    eq(queuedConversationMessages.status, "pending"),
  ))
  .returning({ id: queuedConversationMessages.id });
if (claimed.length === 0) {
  continue; // another drain owns this row; do not touch run/worker status
}
```

`.returning()` is already the codebase idiom (`wake-schedule.ts:128`). Only after a successful claim should the run→`running` / worker→`working` flips and `notifyEventStreamSubscribers` happen. This alone removes both the duplicate agent ask **and** the post-completion `running`/`working` re-flip, which kills the flicker and the resurrection at the source.

Belt-and-suspenders worth considering:
- A per-`(runId, workerId)` in-process promise lock around `drainQueuedWorkerMessagesWithObservation` (same shape as `bridgeSyncInFlight`) so the redundant "drain_decision"/snapshot churn never even starts. Cheaper than relying on CAS alone and stops the duplicate `drain_decision` log spam.
- Don't flip `runs.status='running'` if the run is already terminal *and* no row was actually claimed — the CAS guard makes this fall out naturally.

I'd treat the client as **secondary hardening, not the fix**: having `setQueuedMessages` drop incoming active rows whose id is in `serverAbsentMessageIds` would make stale snapshots harmless, but it risks suppressing a legitimate re-queue (a row that genuinely goes `delivered`→`pending` after an `agent is busy` retry). Fix the server first; only add the client guard if you can key it on a monotonic version/`updatedAt` rather than mere presence.

### Test to lock it in

Server-level, in `tests/server/queued-messages.test.ts` (or `conversations-sync.test.ts`): seed one `pending` row for an idle/drainable worker, stub `askAgent` to resolve once, then fire **two `drainQueuedWorkerMessages` (or two `syncConversationSessions`) calls concurrently** with `Promise.all`. Assert:
- `askAgent` called exactly once,
- final row `status==='delivered'` with a single `queued_message_delivered` event,
- the run never transitions back to `running` after reaching its terminal state (assert no `worker.status`/run-status flip is emitted post-delivery — e.g. spy on `emitNamedEvent`/`notifyEventStreamSubscribers` ordering).

Without the CAS, the second concurrent call re-asks and/or re-flips, and the test fails on the duplicate ask or the trailing `running` transition.

One caveat on my analysis: I've inferred the SSE flush reordering for the "stuck in drawer" half from the code shape rather than observing it directly in your log — the flicker half is fully determined by the code. If you want certainty on the stuck-row path, capturing the raw `/api/events` snapshot sequence the client received (specifically the last two `queuedMessages` payloads for that row) would confirm the out-of-order `delivering`-after-`delivered` snapshot.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:47:27.893Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:47:27.893Z

The second opinion agrees with the server-side race and sharpened it: the queue drain “claims” a pending row with an unconditional update, so concurrent syncs can re-flip run/worker state and emit stale active snapshots. I’m adding the compare-and-swap claim too; the client timestamp guard stays as defense against any already-in-flight stale frame.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:27.904Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:47:27.904Z

```json
{
  "cmd": "rg -n \"\\.returning\\(|returning\\(\" src tests -S",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:27.906Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:47:27.906Z

```json
{
  "cmd": "sed -n '948,1090p' src/server/conversations/queued-messages.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:27.982Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:47:27.982Z

```json
{
  "cmd": "sed -n '1,40p' src/server/conversations/queued-messages.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:28.024Z","phase":null} -->
## Tool result: call_mHihpRUZCfnblBnCfIz2sZLQ · 2026-06-16T21:47:28.024Z

```text
Chunk ID: 4d2a03
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 105
Output:
src/server/supervisor/observer.ts:1194:          }).where(and(eq(workers.id, worker.id), eq(workers.status, prevStatus))).returning({ id: workers.id })
src/server/supervisor/observer.ts:1199:          }).where(eq(workers.id, worker.id)).returning({ id: workers.id });
src/server/supervisor/wake-schedule.ts:128:    .returning();
src/server/workers/ids.ts:39:    .returning({ workerNumber: workerCounters.nextNumber })

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:28.024Z","phase":null} -->
## Tool result: call_Nl4VzSIUcT2wE6sZ7bXhQaPd · 2026-06-16T21:47:28.024Z

```text
Chunk ID: 042edf
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1265
Output:
export async function drainQueuedWorkerMessages({
  runId,
  workerId,
  snapshot,
}: {
  runId: string;
  workerId: string;
  snapshot?: WorkerSnapshot | null;
}) {
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker || worker.runId !== runId) {
    return 0;
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    return 0;
  }

  const records = await pendingQueueRecords(runId, workerId);
  let deliveredCount = 0;

  for (const record of records) {
    const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
    const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
      resolvePath: (storagePath) => getAppDataPath(storagePath),
    });
    const startedAt = new Date();

    const userMessage = {
      id: randomUUID(),
      runId,
      role: "user" as const,
      kind: "checkpoint" as const,
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: startedAt,
    };
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: startedAt,
      lastError: null,
    }).where(eq(queuedConversationMessages.id, record.id));
    await db.update(runs).set({
      status: run.mode === "planning" ? "working" : "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));

    try {
      await runWorkerTurn(workerId, async () => {
        await db.update(workers).set({
          status: "working",
          updatedAt: startedAt,
        }).where(eq(workers.id, workerId));
        const snapshotBeforeAsk = snapshot ?? await Promise.resolve(getAgent(workerId)).catch(() => null);
        const deliveredAt = new Date();
        await appendUserInputOnDelivery({
          id: userMessage.id,
          runId,
          workerId,
          text: record.content,
          deliveredAt,
          attachments: normalizedAttachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
          })),
        });
        await db.insert(messages).values(userMessage);
        if (await answerPendingWorkerElicitation({
          run,
          worker,
          snapshot: snapshotBeforeAsk,
          content: record.content,
          deliveredAt,
        })) {
          await db.update(queuedConversationMessages).set({
            status: "delivered",
            lastError: null,
            updatedAt: deliveredAt,
            deliveredAt,
          }).where(eq(queuedConversationMessages.id, record.id));
          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
            summary: `Delivered queued answer to ${workerId}'s pending question.`,
            queuedMessageId: record.id,
            delivery: "elicitation",
          }, workerId);
          return;
        }

        const response = await askAgent(workerId, workerContent);
        await persistDeliveredWorkerResponse({
          run,
          workerId,
          response,
          deliveredAt,
          userInputEntryId: userMessage.id,
        });
        // Worker response now lives in the unified worker stream.
        await db.update(queuedConversationMessages).set({
          status: "delivered",
          lastError: null,
          updatedAt: deliveredAt,
          deliveredAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
          summary: `Delivered queued message to ${workerId}.`,
          queuedMessageId: record.id,
        }, workerId);
      });
      deliveredCount += 1;
    } catch (error) {
      const failedAt = new Date();
      await db.update(queuedConversationMessages).set({
        status: isAgentBusyError(error) ? "pending" : "failed",
        lastError: errorMessage(error),
        updatedAt: failedAt,
      }).where(eq(queuedConversationMessages.id, record.id));
      await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
        summary: isAgentBusyError(error)
          ? `Worker ${workerId} is still busy; queued message will be retried.`
          : `Queued message delivery failed for ${workerId}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
      }, workerId);

      if (isAgentNotFoundError(error)) {
        await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
          summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
          queuedMessageId: record.id,
          error: errorMessage(error),
        }, workerId);
        await reconcileRunRecovery({
          runId,
          liveAgents: [],
          source: "queued-message-drain",
        });
      }

      if (!isAgentBusyError(error)) {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:28.024Z","phase":null} -->
## Tool result: call_IXDlHsTeoRYuk5qUnCGi9CoQ · 2026-06-16T21:47:28.024Z

```text
Chunk ID: 721c65
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 598
Output:
import { randomUUID } from "crypto";
import { asc, desc, eq } from "drizzle-orm";
import { askAgent, getAgent, respondElicitation } from "@/server/bridge-client";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { startSupervisorRun } from "@/server/supervisor/start";
import { recordSupervisorIntervention } from "@/server/supervisor/interventions";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { getAppDataPath } from "@/server/app-root";
import { serializeMessageRecord } from "./message-records";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { runWorkerTurn } from "./worker-turn-gate";
import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
import { persistRunFailure } from "@/server/runs/failures";
import {
  serializeQueuedConversationMessage,
  type BusyMessageAction,
  type QueuedConversationMessageStatus,
} from "./queued-message-records";
export type { BusyMessageAction, QueuedConversationMessageStatus } from "./queued-message-records";

type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;
export type WorkerAskResponse = Awaited<ReturnType<typeof askAgent>>;
type WorkerSnapshot = Awaited<ReturnType<typeof getAgent>>;
export type WorkerResponseRun = Pick<typeof runs.$inferSelect, "id" | "mode">;
type ElicitationSchema = NonNullable<WorkerSnapshot["pendingElicitations"]>[number]["requestedSchema"];
type ElicitationContent = Record<string, string | number | boolean | string[]>;

export class EmptyQueuedWorkerOutputError extends Error {
  constructor(
    readonly runId: string,
    readonly workerId: string,
    readonly responseState: string,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:47:32.616Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:47:32.616Z

I’m applying the CAS at the exact point where the drain takes ownership: `WHERE id = ? AND status = 'pending' RETURNING id`. If another sync already moved the row to `delivering` or `delivered`, this caller will skip all run/worker mutations.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:36.676Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:47:36.676Z

```json
*** Begin Patch
*** Update File: src/server/conversations/queued-messages.ts
@@
-import { asc, desc, eq } from "drizzle-orm";
+import { and, asc, desc, eq } from "drizzle-orm";
@@
-    await db.update(queuedConversationMessages).set({
+    const claimed = await db.update(queuedConversationMessages).set({
       status: "delivering",
       updatedAt: startedAt,
       lastError: null,
-    }).where(eq(queuedConversationMessages.id, record.id));
+    }).where(and(
+      eq(queuedConversationMessages.id, record.id),
+      eq(queuedConversationMessages.status, "pending"),
+    )).returning({ id: queuedConversationMessages.id });
+    if (claimed.length === 0) {
+      continue;
+    }
     await db.update(runs).set({
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:36.730Z","phase":null} -->
## Tool result: call_nTnQ83jYP1kSa9L98R2u5vUG · 2026-06-16T21:47:36.730Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M src/server/conversations/queued-messages.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:47:51.178Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:47:51.178Z

The server ownership guard is patched. The first test run failed before Vitest because `pnpm` tried to install under Node 26, so I’m switching to the local Vitest binary to avoid the package-manager preinstall gate.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:51.178Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:47:51.178Z

```json
{
  "cmd": "./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 60000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:47:51.302Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:47:51.302Z

```json
{
  "cmd": "git diff -- src/app/home/BusyMessageQueueManager.ts src/server/workers/live-snapshots.ts src/server/conversations/queued-messages.ts tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:54.439Z","phase":null} -->
## Tool result: call_tQqvHF4pW6V6PZmU7nHQuJ4W · 2026-06-16T21:47:54.439Z

```text
Chunk ID: 2cde71
Wall time: 3.1026 seconds
Process exited with code 1
Original token count: 760
Output:

 RUN  v3.2.4 /Users/masterman/NLP/omniharness

 ✓ tests/app/busy-message-queue-manager.test.ts (6 tests) 6ms
stdout | tests/server/queued-messages.test.ts
[db] schema ready in 9ms

stdout | tests/server/conversations-sync.test.ts
[db] schema ready in 9ms

stdout | tests/server/live-worker-snapshots.test.ts
[db] schema ready in 9ms

 ✓ tests/server/live-worker-snapshots.test.ts (12 tests) 4ms
 ✓ tests/server/conversations-sync.test.ts (15 tests) 325ms
 ❯ tests/server/queued-messages.test.ts (13 tests | 1 failed) 544ms
   ✓ queued conversation messages > creates and cancels pending queue entries without deleting audit rows 23ms
   ✓ queued conversation messages > cancels delivering queue entries so stale send-now rows can be dismissed 23ms
   ✓ queued conversation messages > cancels failed queue entries so visible audit rows can be dismissed 15ms
   ✓ queued conversation messages > drains implementation queue entries into user checkpoint messages in FIFO order 27ms
   ✓ queued conversation messages > drains implementation steering to the active worker instead of only the supervisor transcript 53ms
   ✓ queued conversation messages > keeps implementation steering pending when the active worker is still busy 28ms
   ✓ queued conversation messages > drains worker queue entries through askAgent and records delivery output 44ms
   × queued conversation messages > keeps direct worker queue messages out of the conversation until delivery succeeds 29ms
     → expected [ { …(10) } ] to have a length of +0 but got 1
   ✓ queued conversation messages > keeps send-now worker queue entries pending when the worker is still busy 37ms
   ✓ queued conversation messages > anchors send-now queued worker input before bridge output can stream 38ms
   ✓ queued conversation messages > persists send-now queued worker responses and clears direct running state 66ms
   ✓ queued conversation messages > does not mark send-now queued steering delivered when the worker produces no post-input output 100ms
   ✓ queued conversation messages > does not resurrect a cancelled send-now delivery when the background bridge call finishes 57ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/server/queued-messages.test.ts > queued conversation messages > keeps direct worker queue messages out of the conversation until delivery succeeds
AssertionError: expected [ { …(10) } ] to have a length of +0 but got 1

- Expected
+ Received

- 0
+ 1

 ❯ tests/server/queued-messages.test.ts:367:28
    365|     });
    366|     expect(storedQueued?.deliveredAt).toBeNull();
    367|     expect(storedMessages).toHaveLength(0);
       |                            ^
    368|   });
    369| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 45 passed (46)
   Start at  23:47:52
   Duration  2.05s (transform 643ms, setup 59ms, collect 2.68s, tests 878ms, environment 0ms, prepare 279ms)


```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:47:54.439Z","phase":null} -->
## Tool result: call_aAh6qgFHM3xPMd84CxTxktuX · 2026-06-16T21:47:54.439Z

```text
Chunk ID: 92fcc4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3955
Output:
diff --git a/src/app/home/BusyMessageQueueManager.ts b/src/app/home/BusyMessageQueueManager.ts
index 7a572c6..7fcfd36 100644
--- a/src/app/home/BusyMessageQueueManager.ts
+++ b/src/app/home/BusyMessageQueueManager.ts
@@ -11,7 +11,7 @@ type BusyMessageQueueState = {
   // UI only — server queue rows from /api/events remain authoritative.
   interruptingMessageIds: Set<string>;
   locallyHiddenMessageIds: Set<string>;
-  serverAbsentMessageIds: Set<string>;
+  serverAbsentMessageUpdatedAtById: Map<string, number>;
 };
 
 const initialBusyMessageQueueState: BusyMessageQueueState = {
@@ -19,13 +19,32 @@ const initialBusyMessageQueueState: BusyMessageQueueState = {
   cancellingMessageIds: new Set(),
   interruptingMessageIds: new Set(),
   locallyHiddenMessageIds: new Set(),
-  serverAbsentMessageIds: new Set(),
+  serverAbsentMessageUpdatedAtById: new Map(),
 };
 
 function isActiveQueuedMessage(message: QueuedConversationMessageRecord) {
   return message.status === "pending" || message.status === "delivering";
 }
 
+function timestampMs(value: string | null | undefined) {
+  if (!value) {
+    return 0;
+  }
+  const parsed = new Date(value).getTime();
+  return Number.isFinite(parsed) ? parsed : 0;
+}
+
+function isStaleServerAbsentActiveMessage(
+  message: QueuedConversationMessageRecord,
+  serverAbsentMessageUpdatedAtById: Map<string, number>,
+) {
+  if (!isActiveQueuedMessage(message)) {
+    return false;
+  }
+  const absentUpdatedAt = serverAbsentMessageUpdatedAtById.get(message.id);
+  return absentUpdatedAt !== undefined && timestampMs(message.updatedAt) <= absentUpdatedAt;
+}
+
 export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
   constructor() {
     super(initialBusyMessageQueueState);
@@ -33,18 +52,21 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
 
   setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
     this.update((current) => {
-      const incomingIds = new Set(messages.map((message) => message.id));
+      const incomingMessages = messages.filter(
+        (message) => !isStaleServerAbsentActiveMessage(message, current.serverAbsentMessageUpdatedAtById),
+      );
+      const incomingIds = new Set(incomingMessages.map((message) => message.id));
       const newlyAbsentActiveIds = current.queuedMessages
         .filter((message) => isActiveQueuedMessage(message) && !incomingIds.has(message.id))
-        .map((message) => message.id);
+        .map((message) => [message.id, timestampMs(message.updatedAt)] as const);
       // Server rows are authoritative: clear optimistic interrupt/cancel flags
       // for any row that has left a pending/delivering state.
       const settledIds = new Set(
         [
-          ...messages
+          ...incomingMessages
             .filter((message) => !isActiveQueuedMessage(message))
             .map((message) => message.id),
-          ...newlyAbsentActiveIds,
+          ...newlyAbsentActiveIds.map(([id]) => id),
         ],
       );
       const clearSettled = (ids: Set<string>) => {
@@ -60,19 +82,19 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
         }
         return changed ? next : ids;
       };
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      for (const id of newlyAbsentActiveIds) {
-        serverAbsentMessageIds.add(id);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      for (const [id, updatedAt] of newlyAbsentActiveIds) {
+        serverAbsentMessageUpdatedAtById.set(id, updatedAt);
       }
-      for (const id of incomingIds) {
-        serverAbsentMessageIds.delete(id);
+      for (const message of incomingMessages) {
+        serverAbsentMessageUpdatedAtById.delete(message.id);
       }
       return {
         ...current,
-        queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
+        queuedMessages: incomingMessages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
         cancellingMessageIds: clearSettled(current.cancellingMessageIds),
         interruptingMessageIds: clearSettled(current.interruptingMessageIds),
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     }, notify);
   }
@@ -87,8 +109,8 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
 
   upsertQueuedMessage(message: QueuedConversationMessageRecord) {
     this.update((current) => {
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      if (isActiveQueuedMessage(message) && serverAbsentMessageIds.has(message.id)) {
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      if (isStaleServerAbsentActiveMessage(message, serverAbsentMessageUpdatedAtById)) {
         return current;
       }
 
@@ -97,23 +119,23 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       if (!isActiveQueuedMessage(message)) {
         cancellingMessageIds.delete(message.id);
         interruptingMessageIds.delete(message.id);
-        serverAbsentMessageIds.add(message.id);
+        serverAbsentMessageUpdatedAtById.set(message.id, timestampMs(message.updatedAt));
         return {
           ...current,
           queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
           cancellingMessageIds,
           interruptingMessageIds,
-          serverAbsentMessageIds,
+          serverAbsentMessageUpdatedAtById,
         };
       }
 
-      serverAbsentMessageIds.delete(message.id);
+      serverAbsentMessageUpdatedAtById.delete(message.id);
       const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
       if (existingIndex === -1) {
         return {
           ...current,
           queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
-          serverAbsentMessageIds,
+          serverAbsentMessageUpdatedAtById,
         };
       }
 
@@ -122,7 +144,7 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       return {
         ...current,
         queuedMessages: next,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
@@ -159,14 +181,15 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       cancellingMessageIds.delete(messageId);
       interruptingMessageIds.delete(messageId);
       locallyHiddenMessageIds.add(messageId);
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      serverAbsentMessageIds.add(messageId);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      const existing = current.queuedMessages.find((message) => message.id === messageId);
+      serverAbsentMessageUpdatedAtById.set(messageId, timestampMs(existing?.updatedAt));
       return {
         queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
         cancellingMessageIds,
         interruptingMessageIds,
         locallyHiddenMessageIds,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
@@ -176,11 +199,11 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       const cancellingMessageIds = new Set(current.cancellingMessageIds);
       const interruptingMessageIds = new Set(current.interruptingMessageIds);
       const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
       cancellingMessageIds.delete(message.id);
       interruptingMessageIds.delete(message.id);
       locallyHiddenMessageIds.delete(message.id);
-      serverAbsentMessageIds.delete(message.id);
+      serverAbsentMessageUpdatedAtById.delete(message.id);
       const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
       const queuedMessages = existingIndex === -1
         ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
@@ -190,7 +213,7 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
         cancellingMessageIds,
         interruptingMessageIds,
         locallyHiddenMessageIds,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
diff --git a/src/server/conversations/queued-messages.ts b/src/server/conversations/queued-messages.ts
index a0b07c4..ca12cbc 100644
--- a/src/server/conversations/queued-messages.ts
+++ b/src/server/conversations/queued-messages.ts
@@ -1,5 +1,5 @@
 import { randomUUID } from "crypto";
-import { asc, desc, eq } from "drizzle-orm";
+import { and, asc, desc, eq } from "drizzle-orm";
 import { askAgent, getAgent, respondElicitation } from "@/server/bridge-client";
 import { db } from "@/server/db";
 import { messages, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
@@ -983,11 +983,17 @@ export async function drainQueuedWorkerMessages({
       attachmentsJson: record.attachmentsJson,
       createdAt: startedAt,
     };
-    await db.update(queuedConversationMessages).set({
+    const claimed = await db.update(queuedConversationMessages).set({
       status: "delivering",
       updatedAt: startedAt,
       lastError: null,
-    }).where(eq(queuedConversationMessages.id, record.id));
+    }).where(and(
+      eq(queuedConversationMessages.id, record.id),
+      eq(queuedConversationMessages.status, "pending"),
+    )).returning({ id: queuedConversationMessages.id });
+    if (claimed.length === 0) {
+      continue;
+    }
     await db.update(runs).set({
       status: run.mode === "planning" ? "working" : "running",
       failedAt: null,
diff --git a/src/server/workers/live-snapshots.ts b/src/server/workers/live-snapshots.ts
index 6600be3..7d3a79c 100644
--- a/src/server/workers/live-snapshots.ts
+++ b/src/server/workers/live-snapshots.ts
@@ -184,8 +184,12 @@ export function buildLiveWorkerSnapshot(args: {
   const runLastError = run?.lastError ?? null;
 
   if (normalizedAgent) {
+    const terminalRun = isTerminalRun(run);
+    const effectiveState = terminalRun
+      ? isFailedRun(run) ? "error" : "idle"
+      : normalizedAgent.state;
     const structuredOutput = cleanStructuredOutput(normalizedAgent.renderedOutput);
-    const liveText = isAgentActive(normalizedAgent.state) && normalizedAgent.currentText.length > 0
+    const liveText = isAgentActive(effectiveState) && normalizedAgent.currentText.length > 0
       ? normalizedAgent.currentText
       : "";
     const outputEntries = mergeOutputEntries(persistedOutputEntries, normalizedAgent.outputEntries ?? []);
@@ -200,7 +204,9 @@ export function buildLiveWorkerSnapshot(args: {
 
     return {
       ...normalizedAgent,
-      pendingPermissions: isTerminalRun(run) ? [] : normalizedAgent.pendingPermissions,
+      state: effectiveState,
+      pendingPermissions: terminalRun ? [] : normalizedAgent.pendingPermissions,
+      pendingElicitations: terminalRun ? [] : normalizedAgent.pendingElicitations,
       type: normalizedAgent.type || worker?.type || "",
       cwd: normalizedAgent.cwd || worker?.cwd || "",
       sessionId: normalizedAgent.sessionId ?? worker?.bridgeSessionId ?? null,
@@ -254,6 +260,7 @@ export function buildLiveWorkerSnapshot(args: {
     lastText,
     stderrBuffer: [],
     pendingPermissions: [],
+    pendingElicitations: [],
     stopReason: null,
     bridgeMissing: true,
     updatedAt: worker?.updatedAt ?? null,
diff --git a/tests/app/busy-message-queue-manager.test.ts b/tests/app/busy-message-queue-manager.test.ts
index bff0a20..f4ad6c5 100644
--- a/tests/app/busy-message-queue-manager.test.ts
+++ b/tests/app/busy-message-queue-manager.test.ts
@@ -69,6 +69,7 @@ describe("BusyMessageQueueManager", () => {
       ...queuedMessage,
       status: "pending",
       lastError: "Worker is busy",
+      updatedAt: "2026-05-25T00:00:02.000Z",
     });
 
     manager.setQueuedMessages([queuedMessage], false);
@@ -78,6 +79,22 @@ describe("BusyMessageQueueManager", () => {
     expect(manager.getQueuedMessagesForRun("run-a")).toEqual([pendingAgain]);
   });
 
+  it("ignores older authoritative server snapshots after the server removed an active row", () => {
+    const manager = new BusyMessageQueueManager();
+    const queuedMessage = buildQueuedMessage({
+      id: "queued-late-server-frame",
+      runId: "run-a",
+      status: "pending",
+      updatedAt: "2026-05-25T00:00:01.000Z",
+    });
+
+    manager.setQueuedMessages([queuedMessage], false);
+    manager.setQueuedMessages([], false);
+    manager.setQueuedMessages([queuedMessage], false);
+
+    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
+  });
+
   it("removes terminal rows supplied by a mutation response", () => {
     const manager = new BusyMessageQueueManager();
     const queuedMessage = buildQueuedMessage({
diff --git a/tests/server/live-worker-snapshots.test.ts b/tests/server/live-worker-snapshots.test.ts
index 5f40efb..5e1b75a 100644
--- a/tests/server/live-worker-snapshots.test.ts
+++ b/tests/server/live-worker-snapshots.test.ts
@@ -74,6 +74,78 @@ describe("buildLiveWorkerSnapshot", () => {
     }));
   });
 
+  it("does not publish stale active bridge state for completed runs", () => {
+    const snapshot = buildLiveWorkerSnapshot({
+      agent: {
+        name: "worker-done",
+        type: "claude",
+        cwd: "/repo",
+        state: "working",
+        currentText: "Stale live bridge text that should not make the UI active",
+        lastText: "Final answer",
+        outputEntries: [
+          {
+            id: "entry-final",
+            type: "message",
+            text: "Final answer",
+            timestamp: new Date(0).toISOString(),
+          },
+        ],
+        pendingPermissions: [],
+      },
+      worker: {
+        id: "worker-done",
+        runId: "run-done",
+        type: "claude",
+        status: "idle",
+        cwd: "/repo",
+        outputLog: "",
+        outputEntries: [
+          {
+            id: "entry-final",
+            type: "message",
+            text: "Final answer",
+            timestamp: new Date(0).toISOString(),
+          },
+        ],
+        currentText: "",
+        lastText: "Final answer",
+        bridgeSessionId: "session-done",
+        bridgeSessionMode: "full-access",
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+      run: {
+        id: "run-done",
+        planId: "plan-done",
+        mode: "direct",
+        projectPath: "/repo",
+        title: "Completed direct run",
+        preferredWorkerType: "claude",
+        preferredWorkerModel: "claude-sonnet",
+        preferredWorkerEffort: "medium",
+        allowedWorkerTypes: "claude",
+        specPath: null,
+        artifactPlanPath: null,
+        plannerArtifactsJson: null,
+        parentRunId: null,
+        forkedFromMessageId: null,
+        status: "done",
+        failedAt: null,
+        lastError: null,
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+    });
+
+    expect(snapshot).toEqual(expect.objectContaining({
+      state: "idle",
+      currentText: "",
+      lastText: "Final answer",
+      displayText: "Final answer",
+    }));
+  });
+
   it("drops stale bridge permission requests from completed runs", () => {
     const snapshot = buildLiveWorkerSnapshot({
       agent: {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:48:09.692Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:48:09.692Z

The targeted run surfaced an existing server test failure after my CAS patch: a busy direct-worker drain appends the user message before `askAgent` reports busy, and the old expectation wants zero conversation messages. I’m checking the catch path now; if the row is deferred, it should delete the speculative message just like the interrupt path does.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:09.713Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:48:09.713Z

```json
{
  "cmd": "sed -n '1030,1125p' src/server/conversations/queued-messages.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:09.812Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:48:09.812Z

```json
{
  "cmd": "sed -n '330,375p' tests/server/queued-messages.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:09.864Z","phase":null} -->
## Tool result: call_aSbrhUUVR7SdghGJON6VcFbo · 2026-06-16T21:48:09.864Z

```text
Chunk ID: d02b84
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 691
Output:
          content: record.content,
          deliveredAt,
        })) {
          await db.update(queuedConversationMessages).set({
            status: "delivered",
            lastError: null,
            updatedAt: deliveredAt,
            deliveredAt,
          }).where(eq(queuedConversationMessages.id, record.id));
          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
            summary: `Delivered queued answer to ${workerId}'s pending question.`,
            queuedMessageId: record.id,
            delivery: "elicitation",
          }, workerId);
          return;
        }

        const response = await askAgent(workerId, workerContent);
        await persistDeliveredWorkerResponse({
          run,
          workerId,
          response,
          deliveredAt,
          userInputEntryId: userMessage.id,
        });
        // Worker response now lives in the unified worker stream.
        await db.update(queuedConversationMessages).set({
          status: "delivered",
          lastError: null,
          updatedAt: deliveredAt,
          deliveredAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
          summary: `Delivered queued message to ${workerId}.`,
          queuedMessageId: record.id,
        }, workerId);
      });
      deliveredCount += 1;
    } catch (error) {
      const failedAt = new Date();
      await db.update(queuedConversationMessages).set({
        status: isAgentBusyError(error) ? "pending" : "failed",
        lastError: errorMessage(error),
        updatedAt: failedAt,
      }).where(eq(queuedConversationMessages.id, record.id));
      await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
        summary: isAgentBusyError(error)
          ? `Worker ${workerId} is still busy; queued message will be retried.`
          : `Queued message delivery failed for ${workerId}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
      }, workerId);

      if (isAgentNotFoundError(error)) {
        await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
          summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
          queuedMessageId: record.id,
          error: errorMessage(error),
        }, workerId);
        await reconcileRunRecovery({
          runId,
          liveAgents: [],
          source: "queued-message-drain",
        });
      }

      if (!isAgentBusyError(error)) {
        break;
      }
    }
  }

  if (deliveredCount > 0 || records.length > 0) {
    notifyEventStreamSubscribers();
  }

  return deliveredCount;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:09.865Z","phase":null} -->
## Tool result: call_N2V5DGAmlQLymauoxdS25mBe · 2026-06-16T21:48:09.865Z

```text
Chunk ID: c58873
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 403
Output:
  });

  it("keeps direct worker queue messages out of the conversation until delivery succeeds", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Please handle this once free.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const drained = await drainQueuedWorkerMessages({ runId, workerId });

    expect(drained).toBe(0);
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedQueued).toMatchObject({
      status: "pending",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
    });
    expect(storedQueued?.deliveredAt).toBeNull();
    expect(storedMessages).toHaveLength(0);
  });

  it("keeps send-now worker queue entries pending when the worker is still busy", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:48:20.405Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:48:20.405Z

The catch path really was missing the cleanup for busy deferrals in the normal worker-drain path. I’m adding that now so a failed busy delivery returns the row to `pending` without leaving an accepted chat message behind.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:23.882Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:48:23.882Z

```json
*** Begin Patch
*** Update File: src/server/conversations/queued-messages.ts
@@
       if (isAgentNotFoundError(error)) {
         await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
           summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
           queuedMessageId: record.id,
           error: errorMessage(error),
@@
         });
       }
 
-      if (!isAgentBusyError(error)) {
+      if (isAgentBusyError(error)) {
+        await db.delete(messages).where(eq(messages.id, userMessage.id));
+      } else {
         break;
       }
     }
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:23.956Z","phase":null} -->
## Tool result: call_ycXjHc6kdS7GYLBiSTsKpiyB · 2026-06-16T21:48:23.956Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M src/server/conversations/queued-messages.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:48:28.689Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:48:28.689Z

That cleanup is patched. Re-running the same focused suite now with the local Vitest binary.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:30.659Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:48:30.659Z

```json
{
  "cmd": "./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 60000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:34.420Z","phase":null} -->
## Tool result: call_BXX0QsUv1P9rwGa5BEjiM7b5 · 2026-06-16T21:48:34.420Z

```text
Chunk ID: 0137c7
Wall time: 3.5969 seconds
Process exited with code 0
Original token count: 178
Output:

 RUN  v3.2.4 /Users/masterman/NLP/omniharness

 ✓ tests/app/busy-message-queue-manager.test.ts (6 tests) 10ms
stdout | tests/server/queued-messages.test.ts
[db] schema ready in 16ms

stdout | tests/server/conversations-sync.test.ts
[db] schema ready in 21ms

stdout | tests/server/live-worker-snapshots.test.ts
[db] schema ready in 9ms

 ✓ tests/server/live-worker-snapshots.test.ts (12 tests) 8ms
 ✓ tests/server/conversations-sync.test.ts (15 tests) 380ms
 ✓ tests/server/queued-messages.test.ts (13 tests) 582ms

 Test Files  4 passed (4)
      Tests  46 passed (46)
   Start at  23:48:31
   Duration  3.12s (transform 992ms, setup 156ms, collect 4.12s, tests 979ms, environment 1ms, prepare 562ms)


```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:48:45.789Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:48:45.789Z

The focused suite is green now: 46 tests across queue manager, live snapshots, sync, and queued-message delivery. I’m doing a final pass over the diff and then I’ll summarize exactly what was wrong in `5eb40b0d5030`.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:45.792Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:48:45.792Z

```json
{
  "cmd": "sed -n '1,220p' /Users/masterman/.agents/skills/verification-before-completion/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:45.793Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:48:45.793Z

```json
{
  "cmd": "sed -n '1,220p' /Users/masterman/.agents/skills/learning-from-bugs/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:48:45.869Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:48:45.869Z

```json
{
  "cmd": "git diff --stat && git diff -- src/app/home/BusyMessageQueueManager.ts src/server/workers/live-snapshots.ts src/server/conversations/queued-messages.ts tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:45.932Z","phase":null} -->
## Tool result: call_PAe85UuNpQehzsyKJ9JNloHU · 2026-06-16T21:48:45.932Z

````text
Chunk ID: 47f512
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2230
Output:
---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Product-Surface Verification

When the work involves an app, UI, or product surface, verification must cover more than whether a single requested feature works.

Keep verification proportional. For tiny mechanical edits, targeted verification is enough: inspect the diff, confirm the changed value/text, and run only the smallest relevant check. Do not escalate to full product-surface verification unless the change can affect behavior, state, navigation, persistence, or the user journey.

Also verify:

- required functionality is real end-to-end, not a fake component, mock, placeholder, canned response, or fallback path,
- the primary user stories are actually supported,
- the primary user journey works end-to-end,
- any approved agentic user journey tests have been run, or clearly state that they were proposed but not run because approval was not given,
- return/revisit flows work when they are part of the product,
- expected empty states are present,
- expected loading, waiting, or in-progress states are visible,
- expected error and recovery states are present,
- expected completed or success states are understandable,
- expected status-awareness flows are present,
- the state model is represented correctly,
- React/server-state invariants are verified when the app uses server state, optimistic UI, caches, polling, streams, background jobs, or persisted runtime state,
- persistence behavior for settings, preferences, drafts, and other user-managed state matches the approved design,
- operational readiness expectations are met for the approved scope,
- instrumentation and observability exist where the approved scope depends on them,
- backend or agent workflow decisions emit the planned named events, and a headless/scriptable check can assert the event sequence without relying on UI snapshots,
- real errors are surfaced rather than silently swallowed or replaced with vague placeholders,
- onboarding and discoverability work for first-run or empty-state use,
- risk and trust surfaces are handled well enough to avoid silent failure, ambiguous state, or obvious loss of confidence,
- when the scope includes a frontend/backend boundary, frontend-visible failures preserve the real error details and stack traces expected by the approved design,
- baseline expected v1 surfaces and inferred behaviors from the approved story set, spec, or plan are actually present.

When the scope includes settings or preferences, also verify:

- each meaningful setting persists or does not persist exactly as designed,
- the storage location and ownership model match the approved plan,
- refresh, restart, sign-out, reset, and migration behavior work as intended for the approved scope,
- settings dialogs avoid redundant section titles, subtitles, explanatory filler, and decorative chrome that does not help the user make a decision.

Do not confuse "the requested control exists" with "the product is usable."

For app, UI, and product-surface work, consider whether an agentic user journey test is the right proof. This mode is approval-gated because it can spend significant tokens: propose it when useful, but only run it if the user explicitly approves.

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Meaningful system bug fixed | Learning note plus verification | Fix committed with no durable lesson |
| React/server state sync works | Stale-response, merge, event-sequence, and ownership tests relevant to the change | UI looked right once |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |
| Feature complete | Real end-to-end behavior in the product | Mocked component, canned data, placeholder UI, fallback path |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Accepting "validated with mocks" or "placeholder works" as completion
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Staging, committing, pushing, or opening a PR when the work could include secrets, local environment files, dependencies, caches, build outputs, logs, temporary files, or generated/intermediate artifacts
- Moving to next task
- Delegating to agents

When a meaningful bug involved architecture, storage, memory, persistence, control planes, background workers, recovery, data loss, security, or a repeated wrong assumption, use `ultrapowers:learning-from-bugs` before claiming the fix is complete.

When a React app has server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, or persisted runtime state, use `ultrapowers:client-server-state-invariants` to decide which race and synchronization tests are required before claiming completion.

Before any git publish step, verify `.gitignore` exists for the project and that `git status` does not include secrets, credentials, local environment files, `node_modules`, dependency caches, build outputs, coverage output, logs, temporary files, or intermediate/generated artifacts unless the human explicitly asked to version a specific generated artifact.

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:45.932Z","phase":null} -->
## Tool result: call_00NjjUWPkIRuJry2OamOPT4i · 2026-06-16T21:48:45.932Z

````text
Chunk ID: 7a5dec
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 635
Output:
---
name: learning-from-bugs
description: Use when a meaningful bug, regression, architecture flaw, storage issue, memory problem, persistence failure, control-plane failure, or system-level failure has been diagnosed or fixed
---

# Learning From Bugs

When a bug teaches something reusable, capture the lesson before moving on.

## Use This For

Use this after diagnosing or fixing bugs that involve:

- architecture or ownership boundaries,
- storage, persistence, migrations, caching, or file paths,
- memory management, leaks, lifecycle, cleanup, or resource pressure,
- concurrency, queues, retries, resumability, or recovery,
- control planes, event streams, background workers, or long-running jobs,
- security, data loss, user trust, or incident-like failures,
- any bug that took repeated attempts or revealed a wrong mental model.

Skip it for typos, obvious one-line UI mistakes, throwaway test fixture fixes, or purely local churn that will not help future work.

## Required Output

Write a short learning note to:

`docs/superpowers/learnings/YYYY-MM-DD-<bug-or-lesson-slug>.md`

Create the directory if needed.

Use this shape:

```markdown
# [Lesson Title]

**Date:** YYYY-MM-DD
**Context:** [project, feature, or subsystem]
**Symptom:** [what failed]
**Root Cause:** [the real cause, not the symptom]
**Fix:** [what changed]
**Verification:** [commands, tests, or checks that proved it]
**Prevention:** [what future agents should do differently]
**Skill/Doc Updates:** [nearby skills or docs updated, or why no general update was needed]
```

Keep it concrete. Future agents should be able to read the note and avoid the same mistake.

## Update The System When The Lesson Generalizes

If the bug reveals a reusable rule, update the nearest skill or defaults doc in the same change. Examples:

- debugging lesson -> `systematic-debugging`
- verification gap -> `verification-before-completion`
- control-plane or eventing lesson -> `instrumenting-control-planes`
- React lifecycle or routing lesson -> `building-react-apps`
- planning omission -> `writing-plans` or `brainstorming`

Do not bury a general lesson only in a project note. The learning note records the case; the skill update changes future behavior.

## Completion Gate

Before saying a meaningful bug is fixed, check:

1. Is this lesson reusable?
2. Is there a learning note?
3. Did any skill or defaults doc need an update?
4. Did verification prove the fix?

If the answer to 1 is yes, do not skip the note. If the answer to 3 is no, say why in the note.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:48:45.938Z","phase":null} -->
## Tool result: call_bBLiOvQ5GSoKHHRgw9nq0ieB · 2026-06-16T21:48:45.938Z

```text
Chunk ID: c73b58
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 5211
Output:
 eslint.config.mjs                                  |   2 +
 pnpm-workspace.yaml                                |   1 +
 scripts/agent-runtime.ts                           |   4 +-
 shared/locales/de.json                             |  14 +-
 shared/locales/en.json                             |  14 +-
 shared/locales/es.json                             |  14 +-
 shared/locales/fr.json                             |  14 +-
 shared/locales/it.json                             |  14 +-
 shared/locales/ja.json                             |  14 +-
 shared/locales/ko.json                             |  14 +-
 shared/locales/pt.json                             |  14 +-
 shared/locales/zh-CN.json                          |  14 +-
 src/app/home/BusyMessageQueueManager.ts            |  75 +++++---
 src/app/home/ConversationTranscriptManager.ts      | 124 +++++++++++--
 src/app/home/HomeApp.tsx                           |  15 ++
 src/app/home/HomeUiStateManager.ts                 |   6 +
 src/app/home/direct-control-activity.ts            |  26 +++
 src/app/home/useComposerController.ts              |   7 +-
 src/app/home/useConversationActions.ts             |  31 ++++
 src/app/home/useConversationExecutionStatus.ts     |  46 ++++-
 src/app/home/useHomeMutations.ts                   |  43 ++++-
 src/app/home/useHomeViewModel.ts                   |   4 +-
 src/app/home/utils.ts                              |  20 +--
 src/components/Terminal.tsx                        |  17 +-
 src/components/home/ConversationMain.tsx           |  21 ++-
 src/components/home/ConversationSidebar.tsx        | 130 +++++++++++++-
 src/components/home/HomeHeader.tsx                 |  24 +++
 src/lib/agent-output.ts                            |  26 ++-
 src/lib/run-status.ts                              |  12 +-
 src/runtime/http/routes/conversation-transcript.ts | 177 ++++++++++++++++--
 src/runtime/http/routes/planning.ts                |  17 +-
 src/runtime/http/routes/runs.ts                    | 100 ++++++++++-
 src/server/agent-runtime/codex.ts                  |   2 +-
 src/server/agent-runtime/http.ts                   |  19 ++
 src/server/agent-runtime/manager.ts                | 166 ++++++++++++++++-
 src/server/agent-runtime/output-store.ts           |   2 +-
 src/server/agent-runtime/tool-env.ts               |   2 +-
 src/server/agent-runtime/types.ts                  |  34 +++-
 src/server/cli/options.ts                          |  34 ++--
 src/server/cli/runner.ts                           |  13 +-
 src/server/conversations/create.ts                 |  46 +++--
 src/server/conversations/direct-run-status.ts      |  12 ++
 src/server/conversations/modes.ts                  |  42 +++++
 .../conversations/queued-message-interrupt.ts      |  21 ++-
 src/server/conversations/queued-messages.ts        |  16 +-
 src/server/events/named-events.ts                  |   1 +
 src/server/git/run-auto-commit.ts                  |   2 +-
 src/server/omni-acp/agent.ts                       |   7 +-
 src/server/planning/promote.ts                     |  48 +++--
 src/server/planning/review.ts                      |   6 +-
 src/server/runs/persisted-zombie-reconciler.ts     |  18 ++
 src/server/runs/status.ts                          |   1 +
 src/server/supervisor/context-window.ts            |  12 ++
 src/server/supervisor/context.ts                   |   8 +
 src/server/supervisor/index.ts                     |  25 ++-
 src/server/supervisor/observer.ts                  |  37 +++-
 src/server/supervisor/runtime-watchdog.ts          |   7 +
 src/server/workers/entries-types.ts                |   4 +-
 src/server/workers/live-snapshots.ts               |  11 +-
 src/server/workers/orchestrator.ts                 |  34 ----
 tests/api/conversation-messages-route.test.ts      |  26 +++
 tests/api/conversations-route.test.ts              |  54 ++++++
 tests/api/run-route.test.ts                        | 101 +++++++++++
 tests/app/busy-message-queue-manager.test.ts       |  17 ++
 tests/app/conversation-execution-status.test.ts    | 123 +++++++++++++
 tests/app/direct-control-activity.test.ts          |  13 ++
 tests/conversations/direct-run-status.test.ts      |  56 +++++-
 tests/lib/agent-output.test.ts                     |  61 +++++++
 tests/server/agent-runtime/http.test.ts            | 200 +++++++++++++++++++++
 tests/server/live-worker-snapshots.test.ts         |  72 ++++++++
 .../runs/persisted-zombie-reconciler.test.ts       |  18 +-
 tests/supervisor/observer.test.ts                  |  55 ++++++
 tests/ui/conversation-actions.test.ts              |  28 +++
 tests/ui/sidebar-layout.test.ts                    |   3 +
 74 files changed, 2250 insertions(+), 261 deletions(-)
diff --git a/src/app/home/BusyMessageQueueManager.ts b/src/app/home/BusyMessageQueueManager.ts
index 7a572c6..7fcfd36 100644
--- a/src/app/home/BusyMessageQueueManager.ts
+++ b/src/app/home/BusyMessageQueueManager.ts
@@ -11,7 +11,7 @@ type BusyMessageQueueState = {
   // UI only — server queue rows from /api/events remain authoritative.
   interruptingMessageIds: Set<string>;
   locallyHiddenMessageIds: Set<string>;
-  serverAbsentMessageIds: Set<string>;
+  serverAbsentMessageUpdatedAtById: Map<string, number>;
 };
 
 const initialBusyMessageQueueState: BusyMessageQueueState = {
@@ -19,13 +19,32 @@ const initialBusyMessageQueueState: BusyMessageQueueState = {
   cancellingMessageIds: new Set(),
   interruptingMessageIds: new Set(),
   locallyHiddenMessageIds: new Set(),
-  serverAbsentMessageIds: new Set(),
+  serverAbsentMessageUpdatedAtById: new Map(),
 };
 
 function isActiveQueuedMessage(message: QueuedConversationMessageRecord) {
   return message.status === "pending" || message.status === "delivering";
 }
 
+function timestampMs(value: string | null | undefined) {
+  if (!value) {
+    return 0;
+  }
+  const parsed = new Date(value).getTime();
+  return Number.isFinite(parsed) ? parsed : 0;
+}
+
+function isStaleServerAbsentActiveMessage(
+  message: QueuedConversationMessageRecord,
+  serverAbsentMessageUpdatedAtById: Map<string, number>,
+) {
+  if (!isActiveQueuedMessage(message)) {
+    return false;
+  }
+  const absentUpdatedAt = serverAbsentMessageUpdatedAtById.get(message.id);
+  return absentUpdatedAt !== undefined && timestampMs(message.updatedAt) <= absentUpdatedAt;
+}
+
 export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
   constructor() {
     super(initialBusyMessageQueueState);
@@ -33,18 +52,21 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
 
   setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
     this.update((current) => {
-      const incomingIds = new Set(messages.map((message) => message.id));
+      const incomingMessages = messages.filter(
+        (message) => !isStaleServerAbsentActiveMessage(message, current.serverAbsentMessageUpdatedAtById),
+      );
+      const incomingIds = new Set(incomingMessages.map((message) => message.id));
       const newlyAbsentActiveIds = current.queuedMessages
         .filter((message) => isActiveQueuedMessage(message) && !incomingIds.has(message.id))
-        .map((message) => message.id);
+        .map((message) => [message.id, timestampMs(message.updatedAt)] as const);
       // Server rows are authoritative: clear optimistic interrupt/cancel flags
       // for any row that has left a pending/delivering state.
       const settledIds = new Set(
         [
-          ...messages
+          ...incomingMessages
             .filter((message) => !isActiveQueuedMessage(message))
             .map((message) => message.id),
-          ...newlyAbsentActiveIds,
+          ...newlyAbsentActiveIds.map(([id]) => id),
         ],
       );
       const clearSettled = (ids: Set<string>) => {
@@ -60,19 +82,19 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
         }
         return changed ? next : ids;
       };
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      for (const id of newlyAbsentActiveIds) {
-        serverAbsentMessageIds.add(id);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      for (const [id, updatedAt] of newlyAbsentActiveIds) {
+        serverAbsentMessageUpdatedAtById.set(id, updatedAt);
       }
-      for (const id of incomingIds) {
-        serverAbsentMessageIds.delete(id);
+      for (const message of incomingMessages) {
+        serverAbsentMessageUpdatedAtById.delete(message.id);
       }
       return {
         ...current,
-        queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
+        queuedMessages: incomingMessages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
         cancellingMessageIds: clearSettled(current.cancellingMessageIds),
         interruptingMessageIds: clearSettled(current.interruptingMessageIds),
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     }, notify);
   }
@@ -87,8 +109,8 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
 
   upsertQueuedMessage(message: QueuedConversationMessageRecord) {
     this.update((current) => {
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      if (isActiveQueuedMessage(message) && serverAbsentMessageIds.has(message.id)) {
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      if (isStaleServerAbsentActiveMessage(message, serverAbsentMessageUpdatedAtById)) {
         return current;
       }
 
@@ -97,23 +119,23 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       if (!isActiveQueuedMessage(message)) {
         cancellingMessageIds.delete(message.id);
         interruptingMessageIds.delete(message.id);
-        serverAbsentMessageIds.add(message.id);
+        serverAbsentMessageUpdatedAtById.set(message.id, timestampMs(message.updatedAt));
         return {
           ...current,
           queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
           cancellingMessageIds,
           interruptingMessageIds,
-          serverAbsentMessageIds,
+          serverAbsentMessageUpdatedAtById,
         };
       }
 
-      serverAbsentMessageIds.delete(message.id);
+      serverAbsentMessageUpdatedAtById.delete(message.id);
       const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
       if (existingIndex === -1) {
         return {
           ...current,
           queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
-          serverAbsentMessageIds,
+          serverAbsentMessageUpdatedAtById,
         };
       }
 
@@ -122,7 +144,7 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       return {
         ...current,
         queuedMessages: next,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
@@ -159,14 +181,15 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       cancellingMessageIds.delete(messageId);
       interruptingMessageIds.delete(messageId);
       locallyHiddenMessageIds.add(messageId);
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
-      serverAbsentMessageIds.add(messageId);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
+      const existing = current.queuedMessages.find((message) => message.id === messageId);
+      serverAbsentMessageUpdatedAtById.set(messageId, timestampMs(existing?.updatedAt));
       return {
         queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
         cancellingMessageIds,
         interruptingMessageIds,
         locallyHiddenMessageIds,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
@@ -176,11 +199,11 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
       const cancellingMessageIds = new Set(current.cancellingMessageIds);
       const interruptingMessageIds = new Set(current.interruptingMessageIds);
       const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
-      const serverAbsentMessageIds = new Set(current.serverAbsentMessageIds);
+      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
       cancellingMessageIds.delete(message.id);
       interruptingMessageIds.delete(message.id);
       locallyHiddenMessageIds.delete(message.id);
-      serverAbsentMessageIds.delete(message.id);
+      serverAbsentMessageUpdatedAtById.delete(message.id);
       const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
       const queuedMessages = existingIndex === -1
         ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
@@ -190,7 +213,7 @@ export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState>
         cancellingMessageIds,
         interruptingMessageIds,
         locallyHiddenMessageIds,
-        serverAbsentMessageIds,
+        serverAbsentMessageUpdatedAtById,
       };
     });
   }
diff --git a/src/server/conversations/queued-messages.ts b/src/server/conversations/queued-messages.ts
index a0b07c4..9616a71 100644
--- a/src/server/conversations/queued-messages.ts
+++ b/src/server/conversations/queued-messages.ts
@@ -1,5 +1,5 @@
 import { randomUUID } from "crypto";
-import { asc, desc, eq } from "drizzle-orm";
+import { and, asc, desc, eq } from "drizzle-orm";
 import { askAgent, getAgent, respondElicitation } from "@/server/bridge-client";
 import { db } from "@/server/db";
 import { messages, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
@@ -983,11 +983,17 @@ export async function drainQueuedWorkerMessages({
       attachmentsJson: record.attachmentsJson,
       createdAt: startedAt,
     };
-    await db.update(queuedConversationMessages).set({
+    const claimed = await db.update(queuedConversationMessages).set({
       status: "delivering",
       updatedAt: startedAt,
       lastError: null,
-    }).where(eq(queuedConversationMessages.id, record.id));
+    }).where(and(
+      eq(queuedConversationMessages.id, record.id),
+      eq(queuedConversationMessages.status, "pending"),
+    )).returning({ id: queuedConversationMessages.id });
+    if (claimed.length === 0) {
+      continue;
+    }
     await db.update(runs).set({
       status: run.mode === "planning" ? "working" : "running",
       failedAt: null,
@@ -1087,7 +1093,9 @@ export async function drainQueuedWorkerMessages({
         });
       }
 
-      if (!isAgentBusyError(error)) {
+      if (isAgentBusyError(error)) {
+        await db.delete(messages).where(eq(messages.id, userMessage.id));
+      } else {
         break;
       }
     }
diff --git a/src/server/workers/live-snapshots.ts b/src/server/workers/live-snapshots.ts
index 6600be3..7d3a79c 100644
--- a/src/server/workers/live-snapshots.ts
+++ b/src/server/workers/live-snapshots.ts
@@ -184,8 +184,12 @@ export function buildLiveWorkerSnapshot(args: {
   const runLastError = run?.lastError ?? null;
 
   if (normalizedAgent) {
+    const terminalRun = isTerminalRun(run);
+    const effectiveState = terminalRun
+      ? isFailedRun(run) ? "error" : "idle"
+      : normalizedAgent.state;
     const structuredOutput = cleanStructuredOutput(normalizedAgent.renderedOutput);
-    const liveText = isAgentActive(normalizedAgent.state) && normalizedAgent.currentText.length > 0
+    const liveText = isAgentActive(effectiveState) && normalizedAgent.currentText.length > 0
       ? normalizedAgent.currentText
       : "";
     const outputEntries = mergeOutputEntries(persistedOutputEntries, normalizedAgent.outputEntries ?? []);
@@ -200,7 +204,9 @@ export function buildLiveWorkerSnapshot(args: {
 
     return {
       ...normalizedAgent,
-      pendingPermissions: isTerminalRun(run) ? [] : normalizedAgent.pendingPermissions,
+      state: effectiveState,
+      pendingPermissions: terminalRun ? [] : normalizedAgent.pendingPermissions,
+      pendingElicitations: terminalRun ? [] : normalizedAgent.pendingElicitations,
       type: normalizedAgent.type || worker?.type || "",
       cwd: normalizedAgent.cwd || worker?.cwd || "",
       sessionId: normalizedAgent.sessionId ?? worker?.bridgeSessionId ?? null,
@@ -254,6 +260,7 @@ export function buildLiveWorkerSnapshot(args: {
     lastText,
     stderrBuffer: [],
     pendingPermissions: [],
+    pendingElicitations: [],
     stopReason: null,
     bridgeMissing: true,
     updatedAt: worker?.updatedAt ?? null,
diff --git a/tests/app/busy-message-queue-manager.test.ts b/tests/app/busy-message-queue-manager.test.ts
index bff0a20..f4ad6c5 100644
--- a/tests/app/busy-message-queue-manager.test.ts
+++ b/tests/app/busy-message-queue-manager.test.ts
@@ -69,6 +69,7 @@ describe("BusyMessageQueueManager", () => {
       ...queuedMessage,
       status: "pending",
       lastError: "Worker is busy",
+      updatedAt: "2026-05-25T00:00:02.000Z",
     });
 
     manager.setQueuedMessages([queuedMessage], false);
@@ -78,6 +79,22 @@ describe("BusyMessageQueueManager", () => {
     expect(manager.getQueuedMessagesForRun("run-a")).toEqual([pendingAgain]);
   });
 
+  it("ignores older authoritative server snapshots after the server removed an active row", () => {
+    const manager = new BusyMessageQueueManager();
+    const queuedMessage = buildQueuedMessage({
+      id: "queued-late-server-frame",
+      runId: "run-a",
+      status: "pending",
+      updatedAt: "2026-05-25T00:00:01.000Z",
+    });
+
+    manager.setQueuedMessages([queuedMessage], false);
+    manager.setQueuedMessages([], false);
+    manager.setQueuedMessages([queuedMessage], false);
+
+    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
+  });
+
   it("removes terminal rows supplied by a mutation response", () => {
     const manager = new BusyMessageQueueManager();
     const queuedMessage = buildQueuedMessage({
diff --git a/tests/server/live-worker-snapshots.test.ts b/tests/server/live-worker-snapshots.test.ts
index 5f40efb..5e1b75a 100644
--- a/tests/server/live-worker-snapshots.test.ts
+++ b/tests/server/live-worker-snapshots.test.ts
@@ -74,6 +74,78 @@ describe("buildLiveWorkerSnapshot", () => {
     }));
   });
 
+  it("does not publish stale active bridge state for completed runs", () => {
+    const snapshot = buildLiveWorkerSnapshot({
+      agent: {
+        name: "worker-done",
+        type: "claude",
+        cwd: "/repo",
+        state: "working",
+        currentText: "Stale live bridge text that should not make the UI active",
+        lastText: "Final answer",
+        outputEntries: [
+          {
+            id: "entry-final",
+            type: "message",
+            text: "Final answer",
+            timestamp: new Date(0).toISOString(),
+          },
+        ],
+        pendingPermissions: [],
+      },
+      worker: {
+        id: "worker-done",
+        runId: "run-done",
+        type: "claude",
+        status: "idle",
+        cwd: "/repo",
+        outputLog: "",
+        outputEntries: [
+          {
+            id: "entry-final",
+            type: "message",
+            text: "Final answer",
+            timestamp: new Date(0).toISOString(),
+          },
+        ],
+        currentText: "",
+        lastText: "Final answer",
+        bridgeSessionId: "session-done",
+        bridgeSessionMode: "full-access",
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+      run: {
+        id: "run-done",
+        planId: "plan-done",
+        mode: "direct",
+        projectPath: "/repo",
+        title: "Completed direct run",
+        preferredWorkerType: "claude",
+        preferredWorkerModel: "claude-sonnet",
+        preferredWorkerEffort: "medium",
+        allowedWorkerTypes: "claude",
+        specPath: null,
+        artifactPlanPath: null,
+        plannerArtifactsJson: null,
+        parentRunId: null,
+        forkedFromMessageId: null,
+        status: "done",
+        failedAt: null,
+        lastError: null,
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+    });
+
+    expect(snapshot).toEqual(expect.objectContaining({
+      state: "idle",
+      currentText: "",
+      lastText: "Final answer",
+      displayText: "Final answer",
+    }));
+  });
+
   it("drops stale bridge permission requests from completed runs", () => {
     const snapshot = buildLiveWorkerSnapshot({
       agent: {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:48:51.229Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:48:51.229Z

Because this was a real control-plane race, I’m recording a project learning note before I call it. The reusable lesson is “queue ownership must be claimed atomically, and late server snapshots need monotonic guards.”

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:49:00.054Z","phase":null} -->
## Tool call: apply_patch · 2026-06-16T21:49:00.054Z

```json
*** Begin Patch
*** Add File: docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md
+# Queued Drain Claims Must Be Atomic
+
+**Date:** 2026-06-16
+**Context:** OmniHarness direct-control queued messages, live worker sync, event snapshots, and frontend queue rendering
+**Symptom:** A force-steered queued message was delivered in SQLite and the worker stream, but the UI could still show the same row in the queued-message drawer while `Working...` flickered in the terminal.
+**Root Cause:** Concurrent live sync paths could observe the same pending queued row and race through the drain path. The worker drain changed the row to `delivering` without a compare-and-swap status guard, then flipped run/worker state before serialized delivery. Late active snapshots could also arrive after an authoritative empty queue snapshot and revive a stale active row in the frontend.
+**Fix:** Worker queue drains now claim rows with `WHERE id = ? AND status = 'pending'` before mutating run/worker state, and busy deferrals remove speculative message rows. Terminal live snapshots suppress stale active bridge state once the persisted run is terminal. The frontend queue manager now records the `updatedAt` of server-absent active rows and ignores older active snapshots or mutation rows for the same id.
+**Verification:** `./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts` passed with 46 tests.
+**Prevention:** Treat queue delivery as a claimed state transition, not a read-then-write loop. For server-owned UI lists consumed through streams or caches, pair authoritative removals with monotonic freshness checks so late snapshots cannot resurrect older state.
+**Skill/Doc Updates:** No general skill update needed; `instrumenting-control-planes`, `client-server-state-invariants`, and `systematic-debugging` already require named event evidence, ownership tokens, ordering, and stale-response tests.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:49:00.132Z","phase":null} -->
## Tool result: call_gSfISF7jxKqvlpV6dnlalSos · 2026-06-16T21:49:00.132Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
A docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:49:11.479Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:49:11.479Z

The learning note is added. I’m doing one final targeted test run after the note plus a status check so I can separate my touched files from the large pre-existing dirty tree.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:49:11.493Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:49:11.493Z

```json
{
  "cmd": "./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 60000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:49:11.548Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:49:11.548Z

```json
{
  "cmd": "git status --short src/app/home/BusyMessageQueueManager.ts src/server/workers/live-snapshots.ts src/server/conversations/queued-messages.ts tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:49:14.252Z","phase":null} -->
## Tool result: call_4eVDpnz43hheaa1zPwr2eU0b · 2026-06-16T21:49:14.252Z

```text
Chunk ID: eb32f8
Wall time: 2.6018 seconds
Process exited with code 0
Original token count: 178
Output:

 RUN  v3.2.4 /Users/masterman/NLP/omniharness

 ✓ tests/app/busy-message-queue-manager.test.ts (6 tests) 6ms
stdout | tests/server/queued-messages.test.ts
[db] schema ready in 10ms

stdout | tests/server/live-worker-snapshots.test.ts
[db] schema ready in 10ms

stdout | tests/server/conversations-sync.test.ts
[db] schema ready in 11ms

 ✓ tests/server/live-worker-snapshots.test.ts (12 tests) 3ms
 ✓ tests/server/conversations-sync.test.ts (15 tests) 450ms
 ✓ tests/server/queued-messages.test.ts (13 tests) 558ms

 Test Files  4 passed (4)
      Tests  46 passed (46)
   Start at  23:49:11
   Duration  2.10s (transform 610ms, setup 49ms, collect 2.95s, tests 1.02s, environment 0ms, prepare 230ms)


```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:49:14.252Z","phase":null} -->
## Tool result: call_VxJBZPHokVp39LBJul94GmYz · 2026-06-16T21:49:14.252Z

```text
Chunk ID: 978bb4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 76
Output:
 M src/app/home/BusyMessageQueueManager.ts
 M src/server/conversations/queued-messages.ts
 M src/server/workers/live-snapshots.ts
 M tests/app/busy-message-queue-manager.test.ts
 M tests/server/live-worker-snapshots.test.ts
?? docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-16T21:49:23.840Z","phase":"commentary"} -->
## Codex progress · 2026-06-16T21:49:23.840Z

The fresh targeted suite passed again: 4 files, 46 tests. I’m grabbing line references for the final summary now.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:49:23.843Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:49:23.843Z

```json
{
  "cmd": "nl -ba src/server/conversations/queued-messages.ts | sed -n '980,1100p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:49:23.844Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:49:23.844Z

```json
{
  "cmd": "nl -ba src/app/home/BusyMessageQueueManager.ts | sed -n '1,140p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-16T21:49:24.010Z","phase":null} -->
## Tool call: exec_command · 2026-06-16T21:49:24.010Z

```json
{
  "cmd": "nl -ba src/server/workers/live-snapshots.ts | sed -n '180,220p' && nl -ba docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md | sed -n '1,40p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:49:24.064Z","phase":null} -->
## Tool result: call_ajS33HxrMl6fE6jv4KXabbSy · 2026-06-16T21:49:24.064Z

```text
Chunk ID: 83d14a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1319
Output:
   980	      role: "user" as const,
   981	      kind: "checkpoint" as const,
   982	      content: record.content,
   983	      attachmentsJson: record.attachmentsJson,
   984	      createdAt: startedAt,
   985	    };
   986	    const claimed = await db.update(queuedConversationMessages).set({
   987	      status: "delivering",
   988	      updatedAt: startedAt,
   989	      lastError: null,
   990	    }).where(and(
   991	      eq(queuedConversationMessages.id, record.id),
   992	      eq(queuedConversationMessages.status, "pending"),
   993	    )).returning({ id: queuedConversationMessages.id });
   994	    if (claimed.length === 0) {
   995	      continue;
   996	    }
   997	    await db.update(runs).set({
   998	      status: run.mode === "planning" ? "working" : "running",
   999	      failedAt: null,
  1000	      lastError: null,
  1001	      updatedAt: startedAt,
  1002	    }).where(eq(runs.id, runId));
  1003	
  1004	    try {
  1005	      await runWorkerTurn(workerId, async () => {
  1006	        await db.update(workers).set({
  1007	          status: "working",
  1008	          updatedAt: startedAt,
  1009	        }).where(eq(workers.id, workerId));
  1010	        const snapshotBeforeAsk = snapshot ?? await Promise.resolve(getAgent(workerId)).catch(() => null);
  1011	        const deliveredAt = new Date();
  1012	        await appendUserInputOnDelivery({
  1013	          id: userMessage.id,
  1014	          runId,
  1015	          workerId,
  1016	          text: record.content,
  1017	          deliveredAt,
  1018	          attachments: normalizedAttachments.map((attachment) => ({
  1019	            id: attachment.id,
  1020	            filename: attachment.name,
  1021	            mimeType: attachment.mimeType,
  1022	            sizeBytes: attachment.size,
  1023	          })),
  1024	        });
  1025	        await db.insert(messages).values(userMessage);
  1026	        if (await answerPendingWorkerElicitation({
  1027	          run,
  1028	          worker,
  1029	          snapshot: snapshotBeforeAsk,
  1030	          content: record.content,
  1031	          deliveredAt,
  1032	        })) {
  1033	          await db.update(queuedConversationMessages).set({
  1034	            status: "delivered",
  1035	            lastError: null,
  1036	            updatedAt: deliveredAt,
  1037	            deliveredAt,
  1038	          }).where(eq(queuedConversationMessages.id, record.id));
  1039	          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
  1040	            summary: `Delivered queued answer to ${workerId}'s pending question.`,
  1041	            queuedMessageId: record.id,
  1042	            delivery: "elicitation",
  1043	          }, workerId);
  1044	          return;
  1045	        }
  1046	
  1047	        const response = await askAgent(workerId, workerContent);
  1048	        await persistDeliveredWorkerResponse({
  1049	          run,
  1050	          workerId,
  1051	          response,
  1052	          deliveredAt,
  1053	          userInputEntryId: userMessage.id,
  1054	        });
  1055	        // Worker response now lives in the unified worker stream.
  1056	        await db.update(queuedConversationMessages).set({
  1057	          status: "delivered",
  1058	          lastError: null,
  1059	          updatedAt: deliveredAt,
  1060	          deliveredAt,
  1061	        }).where(eq(queuedConversationMessages.id, record.id));
  1062	        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
  1063	          summary: `Delivered queued message to ${workerId}.`,
  1064	          queuedMessageId: record.id,
  1065	        }, workerId);
  1066	      });
  1067	      deliveredCount += 1;
  1068	    } catch (error) {
  1069	      const failedAt = new Date();
  1070	      await db.update(queuedConversationMessages).set({
  1071	        status: isAgentBusyError(error) ? "pending" : "failed",
  1072	        lastError: errorMessage(error),
  1073	        updatedAt: failedAt,
  1074	      }).where(eq(queuedConversationMessages.id, record.id));
  1075	      await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
  1076	        summary: isAgentBusyError(error)
  1077	          ? `Worker ${workerId} is still busy; queued message will be retried.`
  1078	          : `Queued message delivery failed for ${workerId}.`,
  1079	        queuedMessageId: record.id,
  1080	        error: errorMessage(error),
  1081	      }, workerId);
  1082	
  1083	      if (isAgentNotFoundError(error)) {
  1084	        await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
  1085	          summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
  1086	          queuedMessageId: record.id,
  1087	          error: errorMessage(error),
  1088	        }, workerId);
  1089	        await reconcileRunRecovery({
  1090	          runId,
  1091	          liveAgents: [],
  1092	          source: "queued-message-drain",
  1093	        });
  1094	      }
  1095	
  1096	      if (isAgentBusyError(error)) {
  1097	        await db.delete(messages).where(eq(messages.id, userMessage.id));
  1098	      } else {
  1099	        break;
  1100	      }

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:49:24.064Z","phase":null} -->
## Tool result: call_yAt0hNAC8zIfvXHJqP6yKAfG · 2026-06-16T21:49:24.064Z

```text
Chunk ID: 9fbcf8
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1594
Output:
     1	"use client";
     2	
     3	import { StateManager } from "@/lib/state-manager";
     4	import type { QueuedConversationMessageRecord } from "./types";
     5	import { compareOldestByCreatedAtThenId } from "./utils";
     6	
     7	type BusyMessageQueueState = {
     8	  queuedMessages: QueuedConversationMessageRecord[];
     9	  cancellingMessageIds: Set<string>;
    10	  // Rows the user has asked to interrupt-and-send ("force send"). Optimistic
    11	  // UI only — server queue rows from /api/events remain authoritative.
    12	  interruptingMessageIds: Set<string>;
    13	  locallyHiddenMessageIds: Set<string>;
    14	  serverAbsentMessageUpdatedAtById: Map<string, number>;
    15	};
    16	
    17	const initialBusyMessageQueueState: BusyMessageQueueState = {
    18	  queuedMessages: [],
    19	  cancellingMessageIds: new Set(),
    20	  interruptingMessageIds: new Set(),
    21	  locallyHiddenMessageIds: new Set(),
    22	  serverAbsentMessageUpdatedAtById: new Map(),
    23	};
    24	
    25	function isActiveQueuedMessage(message: QueuedConversationMessageRecord) {
    26	  return message.status === "pending" || message.status === "delivering";
    27	}
    28	
    29	function timestampMs(value: string | null | undefined) {
    30	  if (!value) {
    31	    return 0;
    32	  }
    33	  const parsed = new Date(value).getTime();
    34	  return Number.isFinite(parsed) ? parsed : 0;
    35	}
    36	
    37	function isStaleServerAbsentActiveMessage(
    38	  message: QueuedConversationMessageRecord,
    39	  serverAbsentMessageUpdatedAtById: Map<string, number>,
    40	) {
    41	  if (!isActiveQueuedMessage(message)) {
    42	    return false;
    43	  }
    44	  const absentUpdatedAt = serverAbsentMessageUpdatedAtById.get(message.id);
    45	  return absentUpdatedAt !== undefined && timestampMs(message.updatedAt) <= absentUpdatedAt;
    46	}
    47	
    48	export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
    49	  constructor() {
    50	    super(initialBusyMessageQueueState);
    51	  }
    52	
    53	  setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
    54	    this.update((current) => {
    55	      const incomingMessages = messages.filter(
    56	        (message) => !isStaleServerAbsentActiveMessage(message, current.serverAbsentMessageUpdatedAtById),
    57	      );
    58	      const incomingIds = new Set(incomingMessages.map((message) => message.id));
    59	      const newlyAbsentActiveIds = current.queuedMessages
    60	        .filter((message) => isActiveQueuedMessage(message) && !incomingIds.has(message.id))
    61	        .map((message) => [message.id, timestampMs(message.updatedAt)] as const);
    62	      // Server rows are authoritative: clear optimistic interrupt/cancel flags
    63	      // for any row that has left a pending/delivering state.
    64	      const settledIds = new Set(
    65	        [
    66	          ...incomingMessages
    67	            .filter((message) => !isActiveQueuedMessage(message))
    68	            .map((message) => message.id),
    69	          ...newlyAbsentActiveIds.map(([id]) => id),
    70	        ],
    71	      );
    72	      const clearSettled = (ids: Set<string>) => {
    73	        if (settledIds.size === 0) {
    74	          return ids;
    75	        }
    76	        let changed = false;
    77	        const next = new Set(ids);
    78	        for (const id of settledIds) {
    79	          if (next.delete(id)) {
    80	            changed = true;
    81	          }
    82	        }
    83	        return changed ? next : ids;
    84	      };
    85	      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
    86	      for (const [id, updatedAt] of newlyAbsentActiveIds) {
    87	        serverAbsentMessageUpdatedAtById.set(id, updatedAt);
    88	      }
    89	      for (const message of incomingMessages) {
    90	        serverAbsentMessageUpdatedAtById.delete(message.id);
    91	      }
    92	      return {
    93	        ...current,
    94	        queuedMessages: incomingMessages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
    95	        cancellingMessageIds: clearSettled(current.cancellingMessageIds),
    96	        interruptingMessageIds: clearSettled(current.interruptingMessageIds),
    97	        serverAbsentMessageUpdatedAtById,
    98	      };
    99	    }, notify);
   100	  }
   101	
   102	  getQueuedMessagesForRun(runId: string | null | undefined) {
   103	    const normalizedRunId = runId?.trim();
   104	    if (!normalizedRunId) {
   105	      return [];
   106	    }
   107	    return this.getSnapshot().queuedMessages.filter((message) => message.runId === normalizedRunId);
   108	  }
   109	
   110	  upsertQueuedMessage(message: QueuedConversationMessageRecord) {
   111	    this.update((current) => {
   112	      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
   113	      if (isStaleServerAbsentActiveMessage(message, serverAbsentMessageUpdatedAtById)) {
   114	        return current;
   115	      }
   116	
   117	      const cancellingMessageIds = new Set(current.cancellingMessageIds);
   118	      const interruptingMessageIds = new Set(current.interruptingMessageIds);
   119	      if (!isActiveQueuedMessage(message)) {
   120	        cancellingMessageIds.delete(message.id);
   121	        interruptingMessageIds.delete(message.id);
   122	        serverAbsentMessageUpdatedAtById.set(message.id, timestampMs(message.updatedAt));
   123	        return {
   124	          ...current,
   125	          queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
   126	          cancellingMessageIds,
   127	          interruptingMessageIds,
   128	          serverAbsentMessageUpdatedAtById,
   129	        };
   130	      }
   131	
   132	      serverAbsentMessageUpdatedAtById.delete(message.id);
   133	      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
   134	      if (existingIndex === -1) {
   135	        return {
   136	          ...current,
   137	          queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
   138	          serverAbsentMessageUpdatedAtById,
   139	        };
   140	      }

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-16T21:49:24.064Z","phase":null} -->
## Tool result: call_ggrSHMx0zDJKR6vVfkFt0RZx · 2026-06-16T21:49:24.064Z

```text
Chunk ID: f772c9
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1162
Output:
   180	  const outputLog = worker?.outputLog ?? "";
   181	  const persistedLastText = worker?.lastText ?? "";
   182	  const requestedModel = normalizedAgent?.requestedModel ?? run?.preferredWorkerModel ?? null;
   183	  const requestedEffort = normalizedAgent?.requestedEffort ?? run?.preferredWorkerEffort ?? null;
   184	  const runLastError = run?.lastError ?? null;
   185	
   186	  if (normalizedAgent) {
   187	    const terminalRun = isTerminalRun(run);
   188	    const effectiveState = terminalRun
   189	      ? isFailedRun(run) ? "error" : "idle"
   190	      : normalizedAgent.state;
   191	    const structuredOutput = cleanStructuredOutput(normalizedAgent.renderedOutput);
   192	    const liveText = isAgentActive(effectiveState) && normalizedAgent.currentText.length > 0
   193	      ? normalizedAgent.currentText
   194	      : "";
   195	    const outputEntries = mergeOutputEntries(persistedOutputEntries, normalizedAgent.outputEntries ?? []);
   196	    const structuredEntriesText = outputEntriesText(outputEntries);
   197	    const emptyStopDiagnostic = !structuredOutput && !liveText && outputEntries.length === 0 && !outputLog && !normalizedAgent.lastText && !persistedLastText
   198	      ? buildEmptyStopDiagnostic(normalizedAgent.stopReason)
   199	      : "";
   200	    const lastText = normalizedAgent.lastText || persistedLastText || outputLog || structuredEntriesText || emptyStopDiagnostic;
   201	    const displayBase = structuredOutput || outputLog || lastText || structuredEntriesText || "";
   202	    const displayText = liveText && !structuredOutput ? appendLiveText(displayBase, liveText) : displayBase;
   203	    const visibleLastError = shouldSurfaceBridgeLastError(normalizedAgent) ? normalizedAgent.lastError : null;
   204	
   205	    return {
   206	      ...normalizedAgent,
   207	      state: effectiveState,
   208	      pendingPermissions: terminalRun ? [] : normalizedAgent.pendingPermissions,
   209	      pendingElicitations: terminalRun ? [] : normalizedAgent.pendingElicitations,
   210	      type: normalizedAgent.type || worker?.type || "",
   211	      cwd: normalizedAgent.cwd || worker?.cwd || "",
   212	      sessionId: normalizedAgent.sessionId ?? worker?.bridgeSessionId ?? null,
   213	      sessionMode: normalizedAgent.sessionMode ?? worker?.bridgeSessionMode ?? null,
   214	      requestedModel,
   215	      effectiveModel: normalizedAgent.effectiveModel ?? null,
   216	      requestedEffort,
   217	      effectiveEffort: normalizedAgent.effectiveEffort ?? null,
   218	      outputEntries,
   219	      currentText: liveText,
   220	      lastText,
     1	# Queued Drain Claims Must Be Atomic
     2	
     3	**Date:** 2026-06-16
     4	**Context:** OmniHarness direct-control queued messages, live worker sync, event snapshots, and frontend queue rendering
     5	**Symptom:** A force-steered queued message was delivered in SQLite and the worker stream, but the UI could still show the same row in the queued-message drawer while `Working...` flickered in the terminal.
     6	**Root Cause:** Concurrent live sync paths could observe the same pending queued row and race through the drain path. The worker drain changed the row to `delivering` without a compare-and-swap status guard, then flipped run/worker state before serialized delivery. Late active snapshots could also arrive after an authoritative empty queue snapshot and revive a stale active row in the frontend.
     7	**Fix:** Worker queue drains now claim rows with `WHERE id = ? AND status = 'pending'` before mutating run/worker state, and busy deferrals remove speculative message rows. Terminal live snapshots suppress stale active bridge state once the persisted run is terminal. The frontend queue manager now records the `updatedAt` of server-absent active rows and ignores older active snapshots or mutation rows for the same id.
     8	**Verification:** `./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts` passed with 46 tests.
     9	**Prevention:** Treat queue delivery as a claimed state transition, not a read-then-write loop. For server-owned UI lists consumed through streams or caches, pair authoritative removals with monotonic freshness checks so late snapshots cannot resurrect older state.
    10	**Skill/Doc Updates:** No general skill update needed; `instrumenting-control-planes`, `client-server-state-invariants`, and `systematic-debugging` already require named event evidence, ownership tokens, ordering, and stale-response tests.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-16T21:49:36.725Z","phase":"final_answer"} -->
## Codex final · 2026-06-16T21:49:36.725Z

You were right. For `5eb40b0d5030`, SQLite had no active queued row: both queued rows were already `delivered`, worker was `idle`, run was `done`. The UI was being fed stale “active” state.

I fixed the actual race and added hardening:

- [queued-messages.ts](/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts:986): worker queue drains now atomically claim a row with `status = pending` before flipping run/worker state. A losing concurrent drain cannot resurrect `delivering` or `working`.
- [queued-messages.ts](/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts:1096): busy deferrals now remove speculative message rows.
- [live-snapshots.ts](/Users/masterman/NLP/omniharness/src/server/workers/live-snapshots.ts:187): terminal runs suppress stale live bridge `working` state/current text.
- [BusyMessageQueueManager.ts](/Users/masterman/NLP/omniharness/src/app/home/BusyMessageQueueManager.ts:53): frontend queue snapshots now reject older active rows after an authoritative server absence.
- Added a learning note: [2026-06-16-queued-drain-claims-must-be-atomic.md](/Users/masterman/NLP/omniharness/docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md:1)

Verification passed:

`./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts`

Result: 4 test files passed, 46 tests passed.

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-16T21:49:36.838Z","phase":null} -->
## Task state: task_complete · 2026-06-16T21:49:36.838Z

```text
{
  "type": "task_complete",
  "turn_id": "019ed260-63ae-7663-bd01-0711a3e4aa54",
  "last_agent_message": "You were right. For `5eb40b0d5030`, SQLite had no active queued row: both queued rows were already `delivered`, worker was `idle`, run was `done`. The UI was being fed stale “active” state.\n\nI fixed the actual race and added hardening:\n\n- [queued-messages.ts](/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts:986): worker queue drains now atomically claim a row with `status = pending` before flipping run/worker state. A losing concurrent drain cannot resurrect `delivering` or `working`.\n- [queued-messages.ts](/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts:1096): busy deferrals now remove speculative message rows.\n- [live-snapshots.ts](/Users/masterman/NLP/omniharness/src/server/workers/live-snapshots.ts:187): terminal runs suppress stale live bridge `working` state/current text.\n- [BusyMessageQueueManager.ts](/Users/masterman/NLP/omniharness/src/app/home/BusyMessageQueueManager.ts:53): frontend queue snapshots now reject older active rows after an authoritative server absence.\n- Added a learning note: [2026-06-16-queued-drain-claims-must-be-atomic.md](/Users/masterman/NLP/omniharness/docs/superpowers/learnings/2026-06-16-queued-drain-claims-must-be-atomic.md:1)\n\nVerification passed:\n\n`./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts`\n\nResult: 4 test files passed, 46 tests passed.",
  "completed_at": 1781646576,
  "duration_ms": 583951,
  "time_to_first_token_ms": 7468
}
```

<!-- /codex-event -->

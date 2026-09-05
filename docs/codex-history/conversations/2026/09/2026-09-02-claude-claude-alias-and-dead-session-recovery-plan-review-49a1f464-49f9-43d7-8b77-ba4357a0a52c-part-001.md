---
provider: "claude"
codex_thread_id: "49a1f464-49f9-43d7-8b77-ba4357a0a52c"
title: "Claude alias and dead session recovery plan review"
started_at: "2026-09-02T21:51:08.704Z"
updated_at: "2026-09-02T21:52:46.328Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Claude alias and dead session recovery plan review

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude record: atis-latch

```text
{
  "type": "atis-latch",
  "atis": "",
  "sessionId": "49a1f464-49f9-43d7-8b77-ba4357a0a52c"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude record: atis-latch

```text
{
  "type": "atis-latch",
  "atis": "",
  "sessionId": "49a1f464-49f9-43d7-8b77-ba4357a0a52c"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.704Z","phase":null} -->
## Claude state: queue-operation · 2026-09-02T21:51:08.704Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-09-02T21:51:08.704Z",
  "sessionId": "49a1f464-49f9-43d7-8b77-ba4357a0a52c",
  "content": "You are my second-opinion planning reviewer. Inspect only this artifact and do not edit any file:\n/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-09-02-claude-alias-and-dead-session-recovery.md\n\nUser goal: urgently fix OmniHarness rejecting Claude ACP's provider alias `opus[1m]` for requested `claude-opus-5`, including the directly linked failures that stranded session `76d5d121fe24`, then recover that session.\n\nContext and constraints:\n- Never create a branch or worktree and never delete files.\n- Preserve a heavily dirty worktree and make no unrelated changes.\n- Work test-first and keep model matching fail-closed across family/version.\n- Every server decision must remain observable; user-visible failures emit typed events.\n- Do not inspect any other file. Do not call any tool except Read on the exact plan path above.\n\nPlease judge whether this plan is ready to execute.\n\nLook for missing requirements, scope creep, ambiguous ownership or recovery behavior, unsafe session replay, test gaps, and unclear acceptance criteria.\n\nReturn exactly:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.706Z","phase":null} -->
## Claude state: queue-operation · 2026-09-02T21:51:08.706Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-09-02T21:51:08.706Z",
  "sessionId": "49a1f464-49f9-43d7-8b77-ba4357a0a52c"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-09-02T21:51:08.722Z","phase":null} -->
## User · 2026-09-02T21:51:08.722Z

You are my second-opinion planning reviewer. Inspect only this artifact and do not edit any file:
/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-09-02-claude-alias-and-dead-session-recovery.md

User goal: urgently fix OmniHarness rejecting Claude ACP's provider alias `opus[1m]` for requested `claude-opus-5`, including the directly linked failures that stranded session `76d5d121fe24`, then recover that session.

Context and constraints:
- Never create a branch or worktree and never delete files.
- Preserve a heavily dirty worktree and make no unrelated changes.
- Work test-first and keep model matching fail-closed across family/version.
- Every server decision must remain observable; user-visible failures emit typed events.
- Do not inspect any other file. Do not call any tool except Read on the exact plan path above.

Please judge whether this plan is ready to execute.

Look for missing requirements, scope creep, ambiguous ownership or recovery behavior, unsafe session replay, test gaps, and unclear acceptance criteria.

Return exactly:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone

uuid: 88da109a-3091-4318-8fa0-3e7a7ffda37e

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.722Z","phase":null} -->
## Claude attachment · 2026-09-02T21:51:08.722Z

```text
{
  "type": "deferred_tools_delta",
  "addedNames": [
    "CronDelete",
    "CronList",
    "DesignSync",
    "EnterWorktree",
    "ExitWorktree",
    "NotebookEdit",
    "PushNotification",
    "SendMessage",
    "TaskOutput",
    "TaskStop",
    "WebSearch"
  ],
  "addedLines": [
    "CronDelete",
    "CronList",
    "DesignSync",
    "EnterWorktree",
    "ExitWorktree",
    "NotebookEdit",
    "PushNotification",
    "SendMessage",
    "TaskOutput",
    "TaskStop",
    "WebSearch"
  ],
  "removedNames": [],
  "wireHiddenNames": [],
  "readdedNames": [],
  "pendingMcpServers": [],
  "needsAuthMcpServers": [],
  "failedMcpServers": []
}

binary omitted from archive

uuid: c2b53051-2e38-4d24-ac12-41dd93d99cc7
parent: 88da109a-3091-4318-8fa0-3e7a7ffda37e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.722Z","phase":null} -->
## Claude attachment · 2026-09-02T21:51:08.722Z

```text
{
  "type": "agent_listing_delta",
  "addedTypes": [
    "claude",
    "Explore",
    "general-purpose",
    "Plan"
  ],
  "addedLines": [
    "- claude: Catch-all for any task that doesn't fit a more specific agent. FleetView's default when no agent name is typed. (Tools: *)",
    "- Explore: Read-only search agent for broad fan-out searches — when answering means sweeping many files, directories, or naming conventions and you only need the conclusion, not the file dumps. It reads excerpts rather than whole files, so it locates code; it doesn't review or audit it. Specify search breadth: \"medium\" for moderate exploration, \"very thorough\" for multiple locations and naming conventions. (Tools: All tools except Agent, Artifact, ArtifactComments, ArtifactData, ArtifactCheck, ExitPlanMode, Edit, Write, NotebookEdit)",
    "- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)",
    "- Plan: Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools except Agent, Artifact, ArtifactComments, ArtifactData, ArtifactCheck, ExitPlanMode, Edit, Write, NotebookEdit)"
  ],
  "removedTypes": [],
  "isInitial": true,
  "showConcurrencyNote": true
}

binary omitted from archive

uuid: 706cae79-80b0-4906-b91a-88aeff729ecb
parent: c2b53051-2e38-4d24-ac12-41dd93d99cc7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.722Z","phase":null} -->
## Claude attachment · 2026-09-02T21:51:08.722Z

```text
{
  "type": "skill_listing",
  "content": "- dataviz: Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium — an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts, …), an image/PNG you will render and upload, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard. When the destination is a first-party document connector (host-designated, never self-described) that renders live charts, hand it the rows (inline, or as an uploaded data file the chart cites) rather than a rendered PNG/SVG — a picture of a chart loses hover, data inspection and per-value comments. Produces visualizations that read as one system — elegant, accessible, consistent in light and dark — using a brand-neutral placeholder palette you swap for your own. Teaches a design-system-agnostic method: a form heuristic, a color formula with a runnable validator, mark specs, and interaction rules. A validated default palette is documented in `references/palette.md` — swap that file's values for your brand's. Triggers on: \"chart\", \"graph\", \"plot\", \"data viz\", \"visualization\", \"dashboard\", \"analytics\", \"visualize data\", \"categorical colors\", \"sequential / diverging palette\", \"stat tile\", \"sparkline\", \"heatmap\", \"legend\", \"axis\", \"tooltip\", \"chart colors\", \"color by series\".\n- update-config: Use this skill to configure the Claude Code harness via settings.json. Automated behaviors (\"from now on when X\", \"each time X\", \"whenever X\", \"before/after X\") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions (\"allow X\", \"add permission\", \"move permission to\"), env vars (\"set X=Y\"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: \"allow npm commands\", \"add bq permission to global settings\", \"move permission to user settings\", \"set DEBUG=true\", \"when claude stops show X\". For simple settings like theme/model, suggest the /config command.\n- keybindings-help: Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: \"rebind ctrl+s\", \"add a chord shortcut\", \"change the submit key\", \"customize keybindings\".\n- code-review: Review the current diff, or a PR number/branch/path target, for correctness bugs and reuse/simplification/efficiency cleanups at the given effort level (low/medium: fewer, high-confidence findings; high→max: broader coverage, may include uncertain findings; ultra: deep multi-agent review in the cloud); with no level given, it reuses the level you typed last. Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review. For ultra on a GitHub.com PR target, --post asks to post the finished review’s findings to the PR as a single comment from the user’s GitHub account (not a review; the launch dialog still confirms in interactive sessions, while non-interactive mode posts on the flag alone) and --no-post hides that option.\n- simplify: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.\n- fewer-permission-prompts: Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.\n- loop: Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace. - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. \"check the deploy every 5 minutes\", \"keep running /babysit-prs\"). Do NOT invoke for one-off tasks.\n- schedule: Create, update, list, or run scheduled cloud agents (routines) that execute on a cron schedule. - When the user wants to schedule a recurring cloud agent, set up automated tasks, create a cron job for Claude Code, or manage their scheduled agents/routines. Also use when the user wants a one-time scheduled run (\"run this once at 3pm\", \"remind me to check X tomorrow\").\n- claude-api: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.\nTRIGGER — read BEFORE opening the target file; don't skip because it \"looks like a one-liner\" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).\nSKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file).\n- workflow-authoring: Reference for writing a Workflow tool script (script API and gotchas, resume, quality patterns, worked examples). Load before authoring a script for a workflow the user already opted into; it does not itself authorize running one.\n- run: Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).\n- init: Initialize a new CLAUDE.md file with codebase documentation\n- security-review: Complete a security review of the pending changes on the current branch",
  "skillCount": 13,
  "isInitial": true,
  "names": [
    "dataviz",
    "update-config",
    "keybindings-help",
    "code-review",
    "simplify",
    "fewer-permission-prompts",
    "loop",
    "schedule",
    "claude-api",
    "workflow-authoring",
    "run",
    "init",
    "security-review"
  ]
}

binary omitted from archive

uuid: 1f845886-9413-4bef-86c3-5726d0eec96b
parent: 706cae79-80b0-4906-b91a-88aeff729ecb
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.722Z","phase":null} -->
## Claude attachment · 2026-09-02T21:51:08.722Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-my-second-opinion-sleepy-owl.md",
  "planExists": false
}

binary omitted from archive

uuid: 0588f155-9688-420f-971d-2a24c5367f03
parent: 1f845886-9413-4bef-86c3-5726d0eec96b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:08.722Z","phase":null} -->
## Claude attachment · 2026-09-02T21:51:08.722Z

```text
{
  "type": "total_tokens_reminder",
  "text": "<total_tokens>15000000 tokens left</total_tokens>"
}

binary omitted from archive

uuid: 45819ccc-b8a8-407c-8f2c-42052aeb4bc3
parent: 0588f155-9688-420f-971d-2a24c5367f03
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-09-02T21:51:18.385Z","phase":null} -->
## Claude thinking · 2026-09-02T21:51:18.385Z



uuid: 64ae2feb-ab1f-4fc4-b704-5563c769c7c3
parent: 45819ccc-b8a8-407c-8f2c-42052aeb4bc3

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-09-02T21:51:18.903Z","phase":null} -->
## Claude tool call: Read · 2026-09-02T21:51:18.903Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-09-02-claude-alias-and-dead-session-recovery.md"
}

uuid: 6433a550-4e97-4e2e-9fe9-b0d78fff7665
parent: 64ae2feb-ab1f-4fc4-b704-5563c769c7c3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-09-02T21:51:18.912Z","phase":null} -->
## Claude tool result: toolu_01PWhL1JryxEep3FBbFZHXYp · 2026-09-02T21:51:18.912Z

```text
1	# Claude Alias And Dead Session Recovery Implementation Plan
2	
3	> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
4	
5	**Goal:** Make a canonical Claude Opus 5 request accept the provider-verified `opus[1m]` alias without permitting cross-model substitution, contain every failed startup/disconnect, keep lost workers in an honest recovery state, and replay session `76d5d121fe24`.
6	
7	**Architecture:** Treat the Claude ACP model menu as the authority for alias identity while keeping family and version checks fail-closed. Give every pre-registration ACP process explicit cleanup ownership, treat HTTP disconnects as normal cancellation rather than zlib failures, and make persisted `lost` workers classify as recovery-required instead of healthy/running.
8	
9	**Tech Stack:** TypeScript, ACP, Node child processes and streams, Drizzle/SQLite, Vitest, OmniHarness lifecycle harness.
10	
11	**North Star Product:** A worker launch either runs the exact model identity the user selected or fails visibly, and every interrupted run converges to a truthful, actionable state without leaking processes or crashing the runner.
12	
13	**Current Milestone:** Fix and regression-test the four failure modes that stranded session `76d5d121fe24`, then safely resume that persisted user request.
14	
15	**Final Functionality Standard:** The real Claude adapter alias launches successfully, incompatible aliases still refuse, rejected launches leave no child behind, compressed client disconnects cannot take down the runner, lost workers cannot be marked healthy/running, and the affected session produces a persisted worker response.
16	
17	---
18	
19	## File map and invariants
20	
21	- Modify `src/lib/claude-session-model.ts`: keep provider alias verification family/version-safe and document canonical-request-to-provider-alias behavior.
22	- Modify `src/server/agent-runtime/manager.ts`: use the verified model resolution for explicit Claude selections and clean every acquired startup resource on pre-registration failure. This file is already over 1,200 lines; keep the edit local and move cohesive cleanup logic to a small helper rather than growing the launch path further.
23	- Create or modify a focused helper under `src/server/agent-runtime/` only if cleanup ownership cannot remain clear in the existing launch scope.
24	- Modify `src/runtime/http/stream-response.ts`: make disconnect cancellation non-exceptional for gzip and settle both producer and consumer work.
25	- Modify `src/server/conversations/sync.ts` and `src/server/runs/recovery-state.ts`: map `lost` to recovery-required and never allow it to fall through to `running`/`healthy`. `sync.ts` is near 1,200 lines, so add only the narrow status rule and keep classification logic in `recovery-state.ts`.
26	- Modify `tests/lib/claude-session-model.test.ts` and `tests/server/agent-runtime/claude-model-pin.test.ts`: cover the exact `claude-opus-5` → provider-reported `opus[1m]` case, incompatible-version refusal, and failed-launch process cleanup.
27	- Modify `tests/runtime/http-server.test.ts`: abort a real gzip/SSE client and prove the server remains usable with no uncaught stream failure.
28	- Modify `tests/server/runs/recovery-state.test.ts` and `tests/server/conversations-sync.test.ts`: prove a persisted lost direct worker without session metadata remains `needs_recovery` and keeps an unsettled incident.
29	- Add a headless scenario under `tests/lifecycle/scenarios/` if the existing lifecycle harness can reproduce the persisted-lost transition without production-only fault injection; otherwise cover the same real state transition through the server integration suite and run the full lifecycle suite.
30	- Create `docs/superpowers/learnings/2026-09-02-provider-aliases-and-startup-ownership.md` and update the lifecycle architecture invariant with the durable lesson.
31	- No frontend files or user-facing copy are required. No new settings or persistence surfaces are introduced.
32	- Stable ownership: the requested model remains canonical intent; the ACP-reported menu choice is observed runtime identity; the manager owns an ACP child until it is either registered or fully disposed; the recovery classifier owns persisted run truth.
33	- Ordering: model verification completes before worker registration and prompting; failed startup cleanup settles before the rejection escapes; a disconnect cancels the body reader and compressor before the response task finishes; recovery classification happens before sync can rewrite a run.
34	- Completeness: an absent live worker plus persisted `lost` status is complete evidence of non-health, regardless of whether a queued message or bridge session id exists.
35	- Observability: existing `error.surfaced` and recovery named events remain the user-visible failure path; no silent branch is added.
36	- `.gitignore` already excludes `*.db`, `.omniharness/`, dependency caches, logs, and build artifacts used by this work.
37	
38	## Tasks
39	
40	- [ ] Add failing tests for the Opus 5 provider alias and pre-registration process cleanup; run them alone and capture the red failures.
41	- [ ] Implement verified explicit-model alias acceptance while preserving family/version refusal, and implement deterministic startup resource cleanup; rerun the focused tests green.
42	- [ ] Add a failing real HTTP regression that disconnects from a gzip stream and then successfully requests another endpoint; run it red.
43	- [ ] Make gzip disconnect cancellation fully settled and non-fatal; rerun the focused runtime HTTP test green.
44	- [ ] Add failing recovery classifier and conversation-sync tests for a persisted `lost` direct worker with no ACP metadata; run them red.
45	- [ ] Make `lost` recovery-required in both classification and persisted sync projection, retaining/creating the named recovery incident; rerun focused tests green.
46	- [ ] Add or select the narrow headless lifecycle regression, then run `pnpm test:lifecycle` to verify event/state behavior through HTTP/SSE.
47	- [ ] Run focused suites, `pnpm typecheck`, and the relevant complete server/runtime test files. No interface build is required because no frontend file is changed by this fix.
48	- [ ] Inspect the final diff against the dirty baseline, write the learning note and architecture rule, and rerun verification after documentation/code adjustments.
49	- [ ] Clean only test-created conversations/artifacts, terminate only confirmed unregistered leaked ACP children, safely resume session `76d5d121fe24`, and verify its run, worker, incident, event, and unified worker stream state from SQLite/artifacts.
50	
51	## Deterministic acceptance checks
52	
53	- A fake adapter that reports `opus[1m]` with menu metadata identifying Opus 5 starts for requested `claude-opus-5`, records requested and effective identities separately, and never calls the model menu mutation.
54	- The same request still refuses a reported Fable alias or an Opus alias whose menu metadata identifies another version.
55	- Every startup failure after process creation causes the fake ACP child to exit and leaves no registered or pooled agent.
56	- Cancelling a compressed SSE response produces no uncaught exception or unhandled rejection; the same server answers a follow-up health request.
57	- A running direct run with a persisted `lost` worker and no live agent/session classifies and persists as `needs_recovery`; sync cannot resolve its incident as healthy.
58	- Session `76d5d121fe24` has a live/replacement worker or terminal successful worker output, a truthful run status, and no stale open recovery incident after replay.
59	
60	## Approval-gated journey testing
61	
62	No browser-based agentic journey is proposed: this is a backend/control-plane regression, and the deterministic ACP, HTTP, SQLite, and lifecycle tests exercise the relevant real boundaries more directly.
63	

uuid: 87f3b165-ba08-427a-bb4f-515e519dec44
parent: 6433a550-4e97-4e2e-9fe9-b0d78fff7665
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-09-02T21:51:18.945Z","phase":null} -->
## Claude attachment · 2026-09-02T21:51:18.945Z

```text
{
  "type": "total_tokens_reminder",
  "text": "<total_tokens>14982207 tokens left</total_tokens>"
}

binary omitted from archive

uuid: 596004b9-0f04-4ad8-8793-651bb177510d
parent: 87f3b165-ba08-427a-bb4f-515e519dec44
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-09-02T21:52:13.244Z","phase":null} -->
## Claude thinking · 2026-09-02T21:52:13.244Z



uuid: c54043c5-6c03-4f33-b0cd-36dc0000f137
parent: 596004b9-0f04-4ad8-8793-651bb177510d

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-09-02T21:52:46.328Z","phase":null} -->
## Claude · 2026-09-02T21:52:46.328Z

I read only the plan file, and made no edits. Note: I did not verify the `opus[1m]` alias against the repo's Claude model reference, since you scoped me to that one file — finding 1 depends on that check.

## 1. Verdict

**HARDEN.** The engineering shape is right (test-first, fail-closed, ownership named), but the two things you actually care about — what `opus[1m]` is allowed to mean, and what "resume session `76d5d121fe24`" does — are both underspecified, and the session recovery as written can take irreversible action against a dirty worktree.

## 2. Highest-impact findings

**1. The alias mapping is asserted, never defined — and `[1m]` is a variant qualifier, not just a name.**
The plan says accept `opus[1m]` when "menu metadata identifies Opus 5," but never writes down the mapping or what happens when metadata is absent or ambiguous. If `opus[1m]` resolves to a different Opus version with a 1M-context beta, accepting it *is* the cross-model substitution the plan forbids — the plan would pass its own acceptance checks while violating its goal.
*Fix:* put an explicit table in the plan (alias → family, version, variant), validated against the authoritative model-id reference rather than whatever the adapter reports; add the rule "metadata missing/unparseable → refuse" as a first-class fail-closed case; and state whether a variant difference (context window / beta tier) is a permitted match or must be surfaced as divergence.

**2. "Safely resume session `76d5d121fe24`" is undefined, and it is the urgent goal.**
Re-prompting the original message is side-effecting: the agent may re-run tool calls and re-edit files in a heavily dirty tree, with no idempotency guard against a message that already partially executed.
*Fix:* split task 10 into (a) read-only forensics — dump the persisted run, worker, queued message, incident, and events for that session and report them; (b) an explicit replay decision with defined semantics (reattach to transcript vs. re-deliver prompt) confirmed by the user before execution; (c) execution; (d) verification. Add a double-delivery guard and an explicit "if the persisted message already produced partial tool side effects, stop and report" stop rule.

**3. The cleanup/kill step can destroy unrelated live work.**
"Terminate only confirmed unregistered leaked ACP children" gives no confirmation procedure, and "clean only test-created conversations/artifacts" is a delete against live state under a no-delete constraint.
*Fix:* define leak identification concretely (PID/process-group recorded at spawn, cross-checked against the registry) with "if unsure, do not kill" as the default and a printed kill list for approval. Eliminate the cleanup step entirely by requiring tests to run against a throwaway DB/temp dir so there is nothing to clean.

**4. Scope creep: three of four fixes are only assumed to be on the causal chain.**
gzip/SSE disconnect, `lost` classification, and startup-cleanup ownership are separate subsystems; the plan asserts they stranded the session but shows no evidence.
*Fix:* add a task-zero that reconstructs the failure chain from that session's persisted events, and demote anything not on the chain out of this urgent change (or get explicit sign-off to include it). Also drop "rerun verification after documentation adjustments" — doc edits cannot invalidate tests — and be careful that the architecture-doc edit targets a file already dirty in your tree.

**5. Observability is claimed by preservation, not by coverage.**
"No silent branch is added" is not the same as "every new decision emits a typed event," and no acceptance check asserts on events. Making gzip disconnect "non-exceptional" specifically risks making it *invisible*.
*Fix:* require a typed event for each new decision — alias accepted with requested ≠ effective; alias refused with a reason code distinguishing family / version / missing-metadata; startup cleanup and child termination; disconnect cancellation; `lost` → needs_recovery — and assert on emitted event types in the acceptance checks, not just on resulting state.

**6. Test gaps that let the real regressions through.**
Missing: a refusal test for absent/ambiguous menu metadata; an assertion that the model-menu **mutation is never called on the refusal path** (only the accept path is covered, line 53); a table-driven test over the full alias set, which is what survives a provider menu change; a concurrency case for two launches racing a startup failure (cleanup-ownership bugs are races); an explicit process-level `unhandledRejection`/`uncaughtException` listener plus repeated-abort leak check in the gzip test, since one abort passes trivially; and an assertion that the *canonical requested id* remains what is persisted as user intent.
*Fix:* add these; and replace line 29's "otherwise cover it another way" escape hatch with a concrete decision made now.

**7. Ambiguous ownership decisions deferred to implementation time.**
Line 23 ("create a helper only if ownership cannot remain clear") and line 25 (split the `lost` rule across `sync.ts` and `recovery-state.ts`) both defer structure to an implementer under time pressure, and line 25 creates two places that can disagree.
*Fix:* decide the helper now, yes or no. Make `recovery-state.ts` the sole authority, `sync.ts` a pure caller with zero status logic, and add a test asserting sync has no independent `lost` branch.

**8. No recorded baseline and no stop/rollback rule.**
Task 9 inspects "the final diff against the dirty baseline," but no baseline is captured, so "no unrelated changes" is unverifiable. There is also no commit strategy, which matters because on a dirty tree a bad fix cannot be cleanly reverted.
*Fix:* first task captures `git status --porcelain` and `git diff --stat` to a scratch record; add an explicit prohibition on branch/worktree/`checkout`/`restore`/`clean` (recovery work tempts exactly these); land the four fixes as independently revertible units.

**9. The session acceptance check is not falsifiable, and forbids the honest-failure outcome.**
"Live/replacement worker **or** terminal successful output, a truthful run status, no stale open incident" — "truthful" is unassertable, and if the session genuinely cannot be recovered, the correct end state is a closed incident with a failure reason, which this check reads as a violation.
*Fix:* name the exact run status, worker row state, incident reason code, event types, and stream content expected — and define "unrecoverable, honestly terminal" as a passing outcome. Your constraint is honest state, not success.

## 3. What I would deliberately leave alone

- **The red-then-green per-subsystem task ordering.** It is the strongest part of the plan; don't collapse it under urgency.
- **Skipping browser journey testing.** Correct call for a control-plane regression.
- **No frontend, settings, or persistence surfaces.** Right minimalism — even for alias divergence, emit the event now and defer any UI.
- **The core architectural stance** (ACP menu as alias authority, family/version fail-closed). Sound; finding 1 asks you to make the mapping explicit, not to change the stance.
- **The file-size caution on `manager.ts` and `sync.ts`.** Keep the edits local; do not let this become a refactor.
- **No general ACP process supervisor or reaper.** Out of scope for a hotfix, however tempting finding 3 makes it.

uuid: 86228102-64aa-4c98-b8b3-496ff49106f7
parent: c54043c5-6c03-4f33-b0cd-36dc0000f137

<!-- /codex-event -->

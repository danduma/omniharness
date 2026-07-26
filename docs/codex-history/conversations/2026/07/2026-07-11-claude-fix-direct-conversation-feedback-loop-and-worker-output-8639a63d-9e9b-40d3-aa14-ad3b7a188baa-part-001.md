---
provider: "claude"
codex_thread_id: "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
title: "Fix direct conversation feedback loop and worker output"
started_at: "2026-07-11T12:05:03.384Z"
updated_at: "2026-07-11T12:14:52.738Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Fix direct conversation feedback loop and worker output

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:03.384Z","phase":null} -->
## Claude state: queue-operation · 2026-07-11T12:05:03.384Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-11T12:05:03.384Z",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa",
  "content": "Review this focused bug-fix plan without editing files. User goal: fix the selected direct conversation feedback loop, then inspect its hidden pending worker output. Confirmed loop: getRunLatestUnreadTimestamp uses run.updatedAt for awaiting_user; selected-run effect POSTs mark_read; markRunRead always upserts and emits conversation.read; SSE wakes, syncConversationSessions and updateDirectRunStatusFromWorkerOutput rewrite unchanged worker/run updatedAt; client sees newer timestamp and repeats. Proposed defenses: (1) regression-test unread timestamp so unchanged messages do not advance merely because awaiting run.updatedAt changes, (2) markRunRead is idempotent and emits only when marker strictly advances, (3) synchronization only writes direct worker/run rows when semantic fields change, preserving updatedAt on no-op observations. Inspect current relevant code/tests and return READY or HARDEN with exact high-impact concerns. Account for existing dirty worktree. Do not edit anything."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:03.384Z","phase":null} -->
## Claude state: queue-operation · 2026-07-11T12:05:03.384Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-11T12:05:03.384Z",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-11T12:05:03.393Z","phase":null} -->
## User · 2026-07-11T12:05:03.393Z

Review this focused bug-fix plan without editing files. User goal: fix the selected direct conversation feedback loop, then inspect its hidden pending worker output. Confirmed loop: getRunLatestUnreadTimestamp uses run.updatedAt for awaiting_user; selected-run effect POSTs mark_read; markRunRead always upserts and emits conversation.read; SSE wakes, syncConversationSessions and updateDirectRunStatusFromWorkerOutput rewrite unchanged worker/run updatedAt; client sees newer timestamp and repeats. Proposed defenses: (1) regression-test unread timestamp so unchanged messages do not advance merely because awaiting run.updatedAt changes, (2) markRunRead is idempotent and emits only when marker strictly advances, (3) synchronization only writes direct worker/run rows when semantic fields change, preserving updatedAt on no-op observations. Inspect current relevant code/tests and return READY or HARDEN with exact high-impact concerns. Account for existing dirty worktree. Do not edit anything.

uuid: a3801759-3a58-42bd-8ee5-c6f1d4cf3858

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:03.393Z","phase":null} -->
## Claude attachment · 2026-07-11T12:05:03.393Z

```text
{
  "type": "deferred_tools_delta",
  "addedNames": [
    "CronCreate",
    "CronDelete",
    "CronList",
    "DesignSync",
    "EnterWorktree",
    "ExitWorktree",
    "Monitor",
    "NotebookEdit",
    "PushNotification",
    "RemoteTrigger",
    "SendMessage",
    "TaskCreate",
    "TaskGet",
    "TaskList",
    "TaskOutput",
    "TaskStop",
    "TaskUpdate",
    "WebFetch",
    "WebSearch"
  ],
  "addedLines": [
    "CronCreate",
    "CronDelete",
    "CronList",
    "DesignSync",
    "EnterWorktree",
    "ExitWorktree",
    "Monitor",
    "NotebookEdit",
    "PushNotification",
    "RemoteTrigger",
    "SendMessage",
    "TaskCreate",
    "TaskGet",
    "TaskList",
    "TaskOutput",
    "TaskStop",
    "TaskUpdate",
    "WebFetch",
    "WebSearch"
  ],
  "removedNames": [],
  "readdedNames": [],
  "pendingMcpServers": [
    "claude.ai Gmail",
    "claude.ai Google Calendar",
    "claude.ai Google Drive"
  ],
  "needsAuthMcpServers": []
}

binary omitted from archive

uuid: d3d66930-dfb9-43a7-b45a-05f3eddbb4bc
parent: a3801759-3a58-42bd-8ee5-c6f1d4cf3858
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:03.393Z","phase":null} -->
## Claude attachment · 2026-07-11T12:05:03.393Z

```text
{
  "type": "agent_listing_delta",
  "addedTypes": [
    "claude",
    "Explore",
    "general-purpose",
    "Plan",
    "statusline-setup"
  ],
  "addedLines": [
    "- claude: Catch-all for any task that doesn't fit a more specific agent. FleetView's default when no agent name is typed. (Tools: *)",
    "- Explore: Fast read-only search agent for locating code. Use it to find files by pattern (eg. \"src/components/**/*.tsx\"), grep for symbols or keywords (eg. \"API endpoints\"), or answer \"where is X defined / which files reference Y.\" Do NOT use it for code review, design-doc auditing, cross-file consistency checks, or open-ended analysis — it reads excerpts rather than whole files and will miss content past its read window. When calling, specify search breadth: \"quick\" for a single targeted lookup, \"medium\" for moderate exploration, or \"very thorough\" to search across multiple locations and naming conventions. (Tools: All tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit)",
    "- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)",
    "- Plan: Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit)",
    "- statusline-setup: Use this agent to configure the user's Claude Code status line setting. (Tools: Read, Edit)"
  ],
  "removedTypes": [],
  "isInitial": true,
  "showConcurrencyNote": false
}

binary omitted from archive

uuid: e7a24fd9-18de-4afa-94c9-d539b2804b97
parent: d3d66930-dfb9-43a7-b45a-05f3eddbb4bc
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:03.393Z","phase":null} -->
## Claude attachment · 2026-07-11T12:05:03.393Z

```text
{
  "type": "skill_listing",
  "content": "- agentic-user-journey-testing: Use when validating app, UI, or product-surface work through the running app, especially when logs/tests pass but a user job may still be blocked or unclear\n- brainstorming: Use before substantial product, UI, feature, or behavior work with ambiguity, user-journey impact, or multiple plausible approaches\n- building-react-apps: Use when building, refactoring, planning, or debugging React or Next.js apps, React components, hooks, routing, frontend state, SSR, hydration, bundles, imports, or UI settings\n- client-server-state-invariants: Use when planning, building, reviewing, or debugging React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization\n- designing-settings-dialogs: Use when designing, planning, building, or reviewing settings dialogs, settings dialogues, preferences panels, configuration modals, option tabs, or UI settings surfaces\n- dispatching-parallel-agents: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies\n- executing-plans: Use when you have a written implementation plan to execute inline with review checkpoints\n- find-skills: Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.\n- implementing-react-i18n: Use when adding, fixing, or reviewing React internationalization, language selectors, locale resources, translated UI copy, or bugs where changing language does not update user-facing strings\n- improve: Survey any codebase as a senior advisor and produce prioritized, self-contained implementation plans for OTHER models/agents to execute. Strictly read-only on source code — never implements, fixes, or refactors anything itself. Use when asked to audit a codebase, find improvement opportunities (bugs, security, performance, test coverage, tech debt, migrations, DX), suggest features or where to take the project next (roadmap, product direction), or generate handoff plans for another agent to implement.\n- instrumenting-control-planes: Use when building, planning, reviewing, or debugging apps with backend decisions, agent workflows, long-running jobs, SSE/WebSocket streams, recovery paths, deletes, retries, or user-visible failures\n- learning-from-bugs: Use when a meaningful bug, regression, architecture flaw, storage issue, memory problem, persistence failure, control-plane failure, or system-level failure has been diagnosed or fixed\n- optimizing-react-next-apps: Use when a React or Next.js app feels slow, cluttered, overbundled, slow to compile, slow to load, ineffective at SSR, hydration-heavy, or likely burdened by unnecessary imports or UI dependencies\n- receiving-code-review: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation\n- requesting-code-review: Use when completing tasks, implementing major features, or before merging to verify work meets requirements\n- second-opinion: Use when writing or hardening substantial specs, implementation plans, architecture plans, design plans, or unusually hard creative decisions before execution\n- subagent-driven-development: Use when executing implementation plans with independent tasks in the current session\n- systematic-debugging: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes\n- test-driven-development: Use when implementing any feature or bugfix, before writing implementation code\n- using-ultrapowers: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before acting\n- verification-before-completion: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always\n- writing-plans: Use when you have an approved spec or clear requirements for a multi-step task, before implementation\n- writing-skills: Use when creating new skills, editing existing skills, or verifying skills work before deployment\n- dataviz: Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium — an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts, …), an image/PNG you will render and upload, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard. Produces visualizations that read as one system — elegant, accessible, consistent in light and dark — using a brand-neutral placeholder palette you swap for your own. Teaches a design-system-agnostic method: a form heuristic, a color formula with a runnable validator, mark specs, and interaction rules. A validated default palette is documented in `references/palette.md` — swap that file's values for your brand's. Triggers on: \"chart\", \"graph\", \"plot\", \"data viz\", \"visualization\", \"dashboard\", \"analytics\", \"visualize data\", \"categorical colors\", \"sequential / diverging palette\", \"stat tile\", \"sparkline\", \"heatmap\", \"legend\", \"axis\", \"tooltip\", \"chart colors\", \"color by series\".\n- update-config: Use this skill to configure the Claude Code harness via settings.json. Automated behaviors (\"from now on when X\", \"each time X\", \"whenever X\", \"before/after X\") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions (\"allow X\", \"add permission\", \"move permission to\"), env vars (\"set X=Y\"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: \"allow npm commands\", \"add bq permission to global settings\", \"move permission to user settings\", \"set DEBUG=true\", \"when claude stops show X\". For simple settings like theme/model, suggest the /config command.\n- keybindings-help: Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: \"rebind ctrl+s\", \"add a chord shortcut\", \"change the submit key\", \"customize keybindings\".\n- verify: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck. Run before committing nontrivial changes; bootstraps this repo's project verify skill if none exists yet. Don't invoke it on a diff that only touches tests, docs, or other code with no runtime surface to drive (a change to product source always has one) — there's nothing to observe.\n- code-review: Review the current diff for correctness bugs and reuse/simplification/efficiency cleanups at the given effort level (low/medium: fewer, high-confidence findings; high→max: broader coverage, may include uncertain findings; ultra: deep multi-agent review in the cloud). Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review.\n- simplify: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.\n- fewer-permission-prompts: Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.\n- loop: Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace. - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. \"check the deploy every 5 minutes\", \"keep running /babysit-prs\"). Do NOT invoke for one-off tasks.\n- schedule: Create, update, list, or run scheduled cloud agents (routines) that execute on a cron schedule. - When the user wants to schedule a recurring cloud agent, set up automated tasks, create a cron job for Claude Code, or manage their scheduled agents/routines. Also use when the user wants a one-time scheduled run (\"run this once at 3pm\", \"remind me to check X tomorrow\").\n- claude-api: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.\nTRIGGER — read BEFORE opening the target file; don't skip because it \"looks like a one-liner\" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).\nSKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file).\n- run: Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).\n- init: Initialize a new CLAUDE.md file with codebase documentation\n- review: Review a GitHub pull request; for your working diff use /code-review\n- security-review: Complete a security review of the pending changes on the current branch",
  "skillCount": 37,
  "isInitial": true,
  "names": [
    "agentic-user-journey-testing",
    "brainstorming",
    "building-react-apps",
    "client-server-state-invariants",
    "designing-settings-dialogs",
    "dispatching-parallel-agents",
    "executing-plans",
    "find-skills",
    "implementing-react-i18n",
    "improve",
    "instrumenting-control-planes",
    "learning-from-bugs",
    "optimizing-react-next-apps",
    "receiving-code-review",
    "requesting-code-review",
    "second-opinion",
    "subagent-driven-development",
    "systematic-debugging",
    "test-driven-development",
    "using-ultrapowers",
    "verification-before-completion",
    "writing-plans",
    "writing-skills",
    "dataviz",
    "update-config",
    "keybindings-help",
    "verify",
    "code-review",
    "simplify",
    "fewer-permission-prompts",
    "loop",
    "schedule",
    "claude-api",
    "run",
    "init",
    "review",
    "security-review"
  ]
}

binary omitted from archive

uuid: bd468e37-7cf1-4ec5-8383-9cef764d63c6
parent: e7a24fd9-18de-4afa-94c9-d539b2804b97
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:08.810Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:08.810Z



uuid: 5c66e023-8fe0-465e-b58f-80d4b3869b76
parent: bd468e37-7cf1-4ec5-8383-9cef764d63c6

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-11T12:05:09.200Z","phase":null} -->
## Claude · 2026-07-11T12:05:09.200Z

I'll locate and inspect the code paths involved in this feedback loop before assessing the plan.

uuid: e2edf122-bd10-4fb5-99fb-84e59944f2d3
parent: 5c66e023-8fe0-465e-b58f-80d4b3869b76

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:10.055Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:10.055Z

```json
{
  "pattern": "getRunLatestUnreadTimestamp",
  "output_mode": "files_with_matches"
}

uuid: 3c3a5338-92a6-407f-a731-fc10ddf1472e
parent: e2edf122-bd10-4fb5-99fb-84e59944f2d3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:10.133Z","phase":null} -->
## Claude tool result: toolu_016Lksoq2yawmymZmmj4PCvw · 2026-07-11T12:05:10.133Z

```text
Found 7 files
src/runtime/http/routes/runs.ts
src/app/home/sidebar-activity.ts
src/app/home/useRunSelectionEffects.ts
src/components/home/ConversationSidebar.tsx
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md
tests/lib/conversation-state.test.ts
src/lib/conversation-state.ts

uuid: 50f4421b-4017-4c7b-ab30-9377ac1b6b57
parent: 3c3a5338-92a6-407f-a731-fc10ddf1472e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:10.277Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:10.277Z

```json
{
  "pattern": "markRunRead",
  "output_mode": "files_with_matches"
}

uuid: 932345be-8d9f-458f-97f3-3053bf90bc67
parent: 50f4421b-4017-4c7b-ab30-9377ac1b6b57
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:10.301Z","phase":null} -->
## Claude tool result: toolu_01FG7Du7tHqvq5yzUWWNoZyP · 2026-07-11T12:05:10.301Z

```text
Found 1 file
src/runtime/http/routes/runs.ts

uuid: aa5db0a5-7b79-43e6-b34a-ea50c440b9a5
parent: 932345be-8d9f-458f-97f3-3053bf90bc67
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:10.638Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:10.638Z

```json
{
  "pattern": "updateDirectRunStatusFromWorkerOutput",
  "output_mode": "files_with_matches"
}

uuid: 46fb2063-3201-4c1f-b081-0463d89faaa1
parent: aa5db0a5-7b79-43e6-b34a-ea50c440b9a5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:10.685Z","phase":null} -->
## Claude tool result: toolu_01GxnVVQaXoXrZoP9JbYHcRW · 2026-07-11T12:05:10.685Z

```text
Found 11 files
src/server/conversations/create.ts
src/server/conversations/sync.ts
src/server/runs/recovery.ts
src/server/conversations/queued-messages.ts
src/server/conversations/send-message.ts
tests/conversations/direct-run-status.test.ts
src/server/workers/stuck-worker-reaper.ts
src/server/conversations/direct-run-status.ts
docs/superpowers/learnings/2026-06-24-direct-run-optional-followups-are-not-blocking.md
docs/superpowers/learnings/2026-06-14-direct-runs-auto-commit.md
docs/architecture/direct-control-session-regressions.md

uuid: 268883c3-b700-4b99-afb0-111905daf3b4
parent: 46fb2063-3201-4c1f-b081-0463d89faaa1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:10.983Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:10.983Z

```json
{
  "pattern": "syncConversationSessions",
  "output_mode": "files_with_matches"
}

uuid: b8cecfd1-6ff6-4698-9fa1-4de46f3b2496
parent: 268883c3-b700-4b99-afb0-111905daf3b4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:11.041Z","phase":null} -->
## Claude tool result: toolu_01R3AgSzKKBiBK8HsHSvH7VG · 2026-07-11T12:05:11.041Z

```text
Found 11 files
src/server/conversations/sync.ts
tests/lifecycle/scenarios/quota-stop-terminal.test.ts
docs/superpowers/learnings/2026-07-05-quota-waits-must-block-generic-live-sync.md
tests/server/conversations-sync.test.ts
src/runtime/http/routes/events.ts
src/server/supervisor/runtime-watchdog.ts
tests/server/conversations-sync-concurrency.test.ts
src/server/workers/stuck-worker-reaper.ts
docs/superpowers/learnings/2026-06-24-direct-run-optional-followups-are-not-blocking.md
docs/superpowers/learnings/2026-05-20-direct-adapter-stale-working.md
docs/superpowers/plans/2026-04-23-worker-detail-streaming.md

uuid: 006b430c-b15e-467f-83f3-30101d82c0fd
parent: b8cecfd1-6ff6-4698-9fa1-4de46f3b2496
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:13.326Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:13.326Z



uuid: 3e7e953e-6e81-4c2e-aeae-cdd818334cc7
parent: 006b430c-b15e-467f-83f3-30101d82c0fd

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:14.063Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:14.063Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/lib/conversation-state.ts"
}

uuid: a9e4d93a-2911-4c76-bbe5-0ecea062fc51
parent: 3e7e953e-6e81-4c2e-aeae-cdd818334cc7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:14.073Z","phase":null} -->
## Claude tool result: toolu_016RmEGX23tmwnbsAjFAVWr4 · 2026-07-11T12:05:14.073Z

```text
1	export function getRunLatestMessageTimestamp(
2	  runId: string,
3	  messages: Array<{ runId: string; createdAt: string }>
4	) {
5	  let latest: string | null = null;
6	
7	  for (const message of messages) {
8	    if (message.runId !== runId) {
9	      continue;
10	    }
11	
12	    if (!latest || new Date(message.createdAt).getTime() > new Date(latest).getTime()) {
13	      latest = message.createdAt;
14	    }
15	  }
16	
17	  return latest;
18	}
19	
20	function timestampMs(value: string | null | undefined) {
21	  if (!value) {
22	    return 0;
23	  }
24	
25	  const time = new Date(value).getTime();
26	  return Number.isFinite(time) ? time : 0;
27	}
28	
29	function laterTimestamp(left: string | null, right: string | null | undefined) {
30	  if (!right) {
31	    return left;
32	  }
33	
34	  if (!left || timestampMs(right) > timestampMs(left)) {
35	    return right;
36	  }
37	
38	  return left;
39	}
40	
41	export function getRunLatestUnreadTimestamp(
42	  run: { id: string; status?: string | null; updatedAt?: string | null; createdAt?: string | null },
43	  messages: Array<{ runId: string; createdAt: string }>
44	) {
45	  const latestMessageAt = getRunLatestMessageTimestamp(run.id, messages);
46	  const status = run.status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
47	
48	  if (status === "done" || status === "awaiting_user" || status === "failed" || status === "needs_recovery") {
49	    return laterTimestamp(latestMessageAt, run.updatedAt ?? run.createdAt ?? null);
50	  }
51	
52	  return latestMessageAt;
53	}
54	
55	export function isRunUnread(args: {
56	  latestMessageAt: string | null;
57	  lastReadAt: string | null;
58	}) {
59	  if (!args.latestMessageAt) {
60	    return false;
61	  }
62	
63	  if (!args.lastReadAt) {
64	    return true;
65	  }
66	
67	  return new Date(args.latestMessageAt).getTime() > new Date(args.lastReadAt).getTime();
68	}
69	

uuid: 85bdd3a5-6590-460e-a9e4-34bb563f0df2
parent: a9e4d93a-2911-4c76-bbe5-0ecea062fc51
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:15.177Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:15.177Z

```json
{
  "pattern": "markRunRead|mark_read|conversation\\.read",
  "path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts",
  "output_mode": "content",
  "-n": true,
  "-C": 15
}

uuid: b87f6d11-2940-451d-8747-9d20a74421cc
parent: 85bdd3a5-6590-460e-a9e4-34bb563f0df2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:15.191Z","phase":null} -->
## Claude tool result: toolu_01UKZFg9k8v5633tPePYXFnA · 2026-07-11T12:05:15.191Z

```text
86-
87-function isPermanentAccountFailure(message: string | null | undefined) {
88-  return /\b(?:api key|authentication required|auth(?:entication)? failed|billing required|api billing|cap_exceeded|insufficient quota|resource exhausted)\b/i.test(message ?? "");
89-}
90-
91-function actionLabelForPostAction(action: unknown) {
92-  switch (action) {
93-    case "stop_supervisor":
94-      return "Stop supervisor";
95-    case "stop_worker":
96-      return "Stop worker";
97-    case "stop_worker_terminal":
98-      return "Stop worker terminal";
99-    case "archive":
100-      return "Archive";
101:    case "mark_read":
102-      return "Mark read";
103-    case "retry":
104-    case "edit":
105-    case "fork":
106-    default:
107-      return "Recover conversation";
108-  }
109-}
110-
111-function gitWorkspaceStatus(error: unknown) {
112-  if (!(error instanceof GitWorkspaceError)) {
113-    return null;
114-  }
115-  if (
116-    error.code.startsWith("stale_")
--
280-    stoppedWorkerId,
281-    cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
282-  }, stoppedWorkerId);
283-
284-  await db.insert(messages).values({
285-    id: randomUUID(),
286-    runId,
287-    role: "supervisor",
288-    kind: "clarification",
289-    content: USER_STOPPED_WORKER_QUESTION,
290-    createdAt: new Date(),
291-  });
292-  await pauseForClarifications(runId, [USER_STOPPED_WORKER_QUESTION]);
293-}
294-
295:async function markRunRead(runId: string, run: typeof runs.$inferSelect) {
296-  const runMessages = await db.select({
297-    runId: messages.runId,
298-    createdAt: messages.createdAt,
299-  }).from(messages).where(eq(messages.runId, runId));
300-  const lastReadAtIso = getRunLatestUnreadTimestamp(
301-    {
302-      id: run.id,
303-      status: run.status,
304-      createdAt: run.createdAt.toISOString(),
305-      updatedAt: run.updatedAt.toISOString(),
306-    },
307-    runMessages.map((message) => ({
308-      runId: message.runId,
309-      createdAt: message.createdAt.toISOString(),
310-    })),
--
319-  await db.insert(conversationReadMarkers)
320-    .values({
321-      runId,
322-      lastReadAt,
323-      createdAt: now,
324-      updatedAt: now,
325-    })
326-    .onConflictDoUpdate({
327-      target: conversationReadMarkers.runId,
328-      set: {
329-        lastReadAt,
330-        updatedAt: now,
331-      },
332-    });
333-
334:  emitNamedEvent({ kind: "conversation.read", runId, lastReadAt: lastReadAt.toISOString() });
335-  return lastReadAt.toISOString();
336-}
337-
338-export const handleRunPatchRequest: OmniHttpHandler = async (request, context) => {
339-  let patchActionLabel = "Update";
340-  try {
341-    if (request.method !== "PATCH") {
342-      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
343-        status: 405,
344-        headers: { allow: "PATCH" },
345-      });
346-    }
347-
348-    const auth = await requireApiSession(toNextRequest(request), {
349-      source: "Runs",
--
475-
476-    const runId = requireRunId(context);
477-    const body = await request.json();
478-    probe.mark("body");
479-    const action = body?.action;
480-    postActionLabel = actionLabelForPostAction(action);
481-    const actionRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
482-    probe.mark(`q.runLookup[action=${String(action ?? "?")}]`);
483-    if (!actionRun) {
484-      return errorResponse("Run not found", {
485-        status: 404,
486-        source: "Runs",
487-        action: postActionLabel,
488-      });
489-    }
490:    if (action === "mark_read") {
491:      const lastReadAt = await markRunRead(runId, actionRun);
492-      return Response.json({ ok: true, runId, lastReadAt });
493-    }
494-
495-    const sessionType = normalizeSessionType(actionRun.sessionType);
496-    if (sessionType === "process" && action !== "archive") {
497-      if (action === "stop_supervisor" || action === "stop_worker") {
498-        const provider = getSessionProvider("process");
499-        return Response.json(await provider.stop({ runId, reason: "user" }));
500-      }
501-      const reason = `Action ${String(action ?? "unknown")} is not supported for process sessions.`;
502-      emitUnsupportedSessionAction({ runId, sessionType, action: String(action ?? "unknown"), reason });
503-      return errorResponse(reason, {
504-        status: 409,
505-        source: "Runs",
506-        action: postActionLabel,

uuid: a41ed480-a7f3-4ba8-b680-21f5cf5792d5
parent: b87f6d11-2940-451d-8747-9d20a74421cc
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:15.301Z","phase":null} -->
## Claude attachment · 2026-07-11T12:05:15.301Z

```text
{
  "type": "deferred_tools_delta",
  "addedNames": [
    "mcp__claude_ai_Gmail__apply_sensitive_message_label",
    "mcp__claude_ai_Gmail__apply_sensitive_thread_label",
    "mcp__claude_ai_Gmail__create_draft",
    "mcp__claude_ai_Gmail__create_label",
    "mcp__claude_ai_Gmail__get_message",
    "mcp__claude_ai_Gmail__get_thread",
    "mcp__claude_ai_Gmail__label_message",
    "mcp__claude_ai_Gmail__label_thread",
    "mcp__claude_ai_Gmail__list_drafts",
    "mcp__claude_ai_Gmail__list_labels",
    "mcp__claude_ai_Gmail__search_threads",
    "mcp__claude_ai_Gmail__unlabel_message",
    "mcp__claude_ai_Gmail__unlabel_thread",
    "mcp__claude_ai_Google_Calendar__create_event",
    "mcp__claude_ai_Google_Calendar__delete_event",
    "mcp__claude_ai_Google_Calendar__get_event",
    "mcp__claude_ai_Google_Calendar__list_calendars",
    "mcp__claude_ai_Google_Calendar__list_events",
    "mcp__claude_ai_Google_Calendar__respond_to_event",
    "mcp__claude_ai_Google_Calendar__search_events",
    "mcp__claude_ai_Google_Calendar__suggest_time",
    "mcp__claude_ai_Google_Calendar__update_event",
    "mcp__claude_ai_Google_Drive__copy_file",
    "mcp__claude_ai_Google_Drive__create_file",
    "mcp__claude_ai_Google_Drive__download_file_content",
    "mcp__claude_ai_Google_Drive__get_file_metadata",
    "mcp__claude_ai_Google_Drive__get_file_permissions",
    "mcp__claude_ai_Google_Drive__list_recent_files",
    "mcp__claude_ai_Google_Drive__read_file_content",
    "mcp__claude_ai_Google_Drive__search_files"
  ],
  "addedLines": [
    "mcp__claude_ai_Gmail__apply_sensitive_message_label",
    "mcp__claude_ai_Gmail__apply_sensitive_thread_label",
    "mcp__claude_ai_Gmail__create_draft",
    "mcp__claude_ai_Gmail__create_label",
    "mcp__claude_ai_Gmail__get_message",
    "mcp__claude_ai_Gmail__get_thread",
    "mcp__claude_ai_Gmail__label_message",
    "mcp__claude_ai_Gmail__label_thread",
    "mcp__claude_ai_Gmail__list_drafts",
    "mcp__claude_ai_Gmail__list_labels",
    "mcp__claude_ai_Gmail__search_threads",
    "mcp__claude_ai_Gmail__unlabel_message",
    "mcp__claude_ai_Gmail__unlabel_thread",
    "mcp__claude_ai_Google_Calendar__create_event",
    "mcp__claude_ai_Google_Calendar__delete_event",
    "mcp__claude_ai_Google_Calendar__get_event",
    "mcp__claude_ai_Google_Calendar__list_calendars",
    "mcp__claude_ai_Google_Calendar__list_events",
    "mcp__claude_ai_Google_Calendar__respond_to_event",
    "mcp__claude_ai_Google_Calendar__search_events",
    "mcp__claude_ai_Google_Calendar__suggest_time",
    "mcp__claude_ai_Google_Calendar__update_event",
    "mcp__claude_ai_Google_Drive__copy_file",
    "mcp__claude_ai_Google_Drive__create_file",
    "mcp__claude_ai_Google_Drive__download_file_content",
    "mcp__claude_ai_Google_Drive__get_file_metadata",
    "mcp__claude_ai_Google_Drive__get_file_permissions",
    "mcp__claude_ai_Google_Drive__list_recent_files",
    "mcp__claude_ai_Google_Drive__read_file_content",
    "mcp__claude_ai_Google_Drive__search_files"
  ],
  "removedNames": [],
  "readdedNames": [],
  "pendingMcpServers": [],
  "needsAuthMcpServers": []
}

binary omitted from archive

uuid: d75c6a28-3897-48dd-8d7f-9ca2a6e617ff
parent: a41ed480-a7f3-4ba8-b680-21f5cf5792d5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:18.241Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:18.241Z



uuid: d893b2ab-6b6c-47fe-a178-8211b2b95c90
parent: d75c6a28-3897-48dd-8d7f-9ca2a6e617ff

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:19.413Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:19.413Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts",
  "offset": 295,
  "limit": 40
}

uuid: bce6f960-7afe-4eaa-883d-88f3638238fe
parent: d893b2ab-6b6c-47fe-a178-8211b2b95c90
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:19.415Z","phase":null} -->
## Claude tool result: toolu_01DBrmgjWsC4mjAYDQNYW9QW · 2026-07-11T12:05:19.415Z

```text
295	async function markRunRead(runId: string, run: typeof runs.$inferSelect) {
296	  const runMessages = await db.select({
297	    runId: messages.runId,
298	    createdAt: messages.createdAt,
299	  }).from(messages).where(eq(messages.runId, runId));
300	  const lastReadAtIso = getRunLatestUnreadTimestamp(
301	    {
302	      id: run.id,
303	      status: run.status,
304	      createdAt: run.createdAt.toISOString(),
305	      updatedAt: run.updatedAt.toISOString(),
306	    },
307	    runMessages.map((message) => ({
308	      runId: message.runId,
309	      createdAt: message.createdAt.toISOString(),
310	    })),
311	  );
312	
313	  if (!lastReadAtIso) {
314	    return null;
315	  }
316	
317	  const now = new Date();
318	  const lastReadAt = new Date(lastReadAtIso);
319	  await db.insert(conversationReadMarkers)
320	    .values({
321	      runId,
322	      lastReadAt,
323	      createdAt: now,
324	      updatedAt: now,
325	    })
326	    .onConflictDoUpdate({
327	      target: conversationReadMarkers.runId,
328	      set: {
329	        lastReadAt,
330	        updatedAt: now,
331	      },
332	    });
333	
334	  emitNamedEvent({ kind: "conversation.read", runId, lastReadAt: lastReadAt.toISOString() });

uuid: ace4ca4f-1975-4b6b-8a6c-3b3343ce2f44
parent: bce6f960-7afe-4eaa-883d-88f3638238fe
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:20.675Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:20.675Z

```json
{
  "pattern": "markRunRead|mark_read|conversation\\.read|latestUnreadTimestamp|getRunLatestUnreadTimestamp",
  "path": "/Users/masterman/NLP/omniharness/src/app/home/useRunSelectionEffects.ts",
  "output_mode": "content",
  "-n": true,
  "-C": 10
}

uuid: 7e91096a-c796-45cf-b461-e99d02dd1562
parent: ace4ca4f-1975-4b6b-8a6c-3b3343ce2f44
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:20.684Z","phase":null} -->
## Claude tool result: toolu_013KDxkMMCCEw61Vb6yTcZEe · 2026-07-11T12:05:20.684Z

```text
1-import { useEffect, useLayoutEffect, useRef } from "react";
2-import type React from "react";
3-import { conversationMainManager } from "@/components/component-state-managers";
4:import { getRunLatestUnreadTimestamp } from "@/lib/conversation-state";
5-import type { ComposerMode } from "./types";
6-import type { AgentSnapshot, ComposerWorkerOption, MessageRecord, RunRecord, WorkerType } from "./types";
7-import { parseWorkerType, resolveComposerEffortLabel, resolveComposerModelValue } from "./utils";
8-
9-const CONVERSATION_BOTTOM_THRESHOLD_PX = 8;
10-const CONVERSATION_MEANINGFUL_OVERFLOW_PX = 112;
11-const SCROLL_AREA_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]';
12-
13-function textVersion(value: string | null | undefined) {
14-  const text = value ?? "";
--
336-
337-  useEffect(() => {
338-    if (!selectedRunId) {
339-      return;
340-    }
341-
342-    if (!selectedRun) {
343-      return;
344-    }
345-
346:    const latestForSelected = getRunLatestUnreadTimestamp(selectedRun, state.messages || []);
347-    if (!latestForSelected) {
348-      return;
349-    }
350-
351-    if (readMarkers[selectedRunId] === latestForSelected) {
352-      return;
353-    }
354-
355-    setReadMarkers((current) => {
356-      if (current[selectedRunId] === latestForSelected) {
--
361-
362-    const persistedKey = `${selectedRunId}:${latestForSelected}`;
363-    if (persistedReadMarkerRef.current.get(selectedRunId) === persistedKey) {
364-      return;
365-    }
366-    persistedReadMarkerRef.current.set(selectedRunId, persistedKey);
367-
368-    void fetch(`/api/runs/${encodeURIComponent(selectedRunId)}`, {
369-      method: "POST",
370-      headers: { "Content-Type": "application/json" },
371:      body: JSON.stringify({ action: "mark_read" }),
372-    }).catch((error) => {
373-      persistedReadMarkerRef.current.delete(selectedRunId);
374-      console.warn("Failed to persist conversation read marker:", error);
375-    });
376-  }, [readMarkers, selectedRunId, selectedRun, state.messages, setReadMarkers]);
377-}

uuid: 990ece19-e208-4c73-a8bc-adca51190be0
parent: 7e91096a-c796-45cf-b461-e99d02dd1562
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:23.150Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:23.150Z



uuid: 822dc918-bbb9-4361-91cf-d1f4320412c6
parent: 990ece19-e208-4c73-a8bc-adca51190be0

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:24.158Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:24.158Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/app/home/useRunSelectionEffects.ts",
  "offset": 300,
  "limit": 80
}

uuid: 7b510df7-17b9-4143-a654-75f692cb350b
parent: 822dc918-bbb9-4361-91cf-d1f4320412c6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:24.167Z","phase":null} -->
## Claude tool result: toolu_01XLqhirjmuTFvqqSzLmLXfs · 2026-07-11T12:05:24.167Z

```text
300	    selectedCliAgent,
301	    selectedEffort,
302	    selectedModel,
303	    selectedRun,
304	    selectedRunId,
305	    setHydratedRunSelectionId,
306	    setSelectedCliAgent,
307	    setSelectedEffort,
308	    setSelectedModel,
309	  ]);
310	
311	  useEffect(() => {
312	    if (availableWorkerTypes.length === 0) {
313	      return;
314	    }
315	
316	    const availableSet = new Set(availableWorkerTypes);
317	    const sanitizedAllowed = configuredAllowedWorkerTypes.filter((type) => availableSet.has(type));
318	    const nextAllowed = sanitizedAllowed.length > 0 ? sanitizedAllowed : [...availableWorkerTypes];
319	    const normalizedDefault = nextAllowed.includes(apiKeys.WORKER_DEFAULT_TYPE as WorkerType)
320	      ? apiKeys.WORKER_DEFAULT_TYPE
321	      : nextAllowed[0];
322	
323	    if (
324	      JSON.stringify(nextAllowed) === JSON.stringify(configuredAllowedWorkerTypes) &&
325	      normalizedDefault === apiKeys.WORKER_DEFAULT_TYPE
326	    ) {
327	      return;
328	    }
329	
330	    setApiKeys((current) => ({
331	      ...current,
332	      WORKER_ALLOWED_TYPES: JSON.stringify(nextAllowed),
333	      WORKER_DEFAULT_TYPE: normalizedDefault,
334	    }));
335	  }, [apiKeys.WORKER_DEFAULT_TYPE, availableWorkerTypes, configuredAllowedWorkerTypes, setApiKeys]);
336	
337	  useEffect(() => {
338	    if (!selectedRunId) {
339	      return;
340	    }
341	
342	    if (!selectedRun) {
343	      return;
344	    }
345	
346	    const latestForSelected = getRunLatestUnreadTimestamp(selectedRun, state.messages || []);
347	    if (!latestForSelected) {
348	      return;
349	    }
350	
351	    if (readMarkers[selectedRunId] === latestForSelected) {
352	      return;
353	    }
354	
355	    setReadMarkers((current) => {
356	      if (current[selectedRunId] === latestForSelected) {
357	        return current;
358	      }
359	      return { ...current, [selectedRunId]: latestForSelected };
360	    });
361	
362	    const persistedKey = `${selectedRunId}:${latestForSelected}`;
363	    if (persistedReadMarkerRef.current.get(selectedRunId) === persistedKey) {
364	      return;
365	    }
366	    persistedReadMarkerRef.current.set(selectedRunId, persistedKey);
367	
368	    void fetch(`/api/runs/${encodeURIComponent(selectedRunId)}`, {
369	      method: "POST",
370	      headers: { "Content-Type": "application/json" },
371	      body: JSON.stringify({ action: "mark_read" }),
372	    }).catch((error) => {
373	      persistedReadMarkerRef.current.delete(selectedRunId);
374	      console.warn("Failed to persist conversation read marker:", error);
375	    });
376	  }, [readMarkers, selectedRunId, selectedRun, state.messages, setReadMarkers]);
377	}
378	

uuid: 616fa4f5-d026-46a3-854d-7e13b6602fc9
parent: 7b510df7-17b9-4143-a654-75f692cb350b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:05:24.202Z","phase":null} -->
## Claude attachment · 2026-07-11T12:05:24.202Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: 1db34bff-d731-4f9d-9ec5-52abe7b01b30
parent: 616fa4f5-d026-46a3-854d-7e13b6602fc9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:29.598Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:29.598Z



uuid: f84507c2-23be-4e51-b638-39a2ceba7b21
parent: 1db34bff-d731-4f9d-9ec5-52abe7b01b30

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:30.760Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:30.760Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/direct-run-status.ts"
}

uuid: 3bdb8149-026b-4135-9e1a-e7152b2199d8
parent: f84507c2-23be-4e51-b638-39a2ceba7b21
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:30.766Z","phase":null} -->
## Claude tool result: toolu_01C81uV1HcXzGZ9BgdFGUCKi · 2026-07-11T12:05:30.766Z

```text
1	import { eq } from "drizzle-orm";
2	import { db } from "@/server/db";
3	import { runs } from "@/server/db/schema";
4	import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
5	import { emitNamedEvent } from "@/server/events/named-events";
6	import { recordExecutionEvent } from "@/server/events/execution-event-store";
7	import { runMilestoneAutoCommit } from "@/server/git/run-auto-commit";
8	
9	type OutputEntryLike = {
10	  type?: string | null;
11	  text?: string | null;
12	  status?: string | null;
13	  raw?: unknown;
14	};
15	
16	type WorkerOutputSource = {
17	  workerStatus?: string | null;
18	  responseText?: string | null;
19	  renderedOutput?: string | null;
20	  currentText?: string | null;
21	  lastText?: string | null;
22	  outputLog?: string | null;
23	  outputEntries?: readonly OutputEntryLike[] | null;
24	  outputEntriesJson?: string | null;
25	  pendingPermissions?: readonly unknown[] | null;
26	  pendingElicitations?: readonly unknown[] | null;
27	};
28	
29	const ACTIVE_DIRECT_WORKER_STATUSES = new Set(["starting", "working", "stuck", "recovering"]);
30	
31	function normalizeWorkerStatus(value: string | null | undefined) {
32	  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
33	}
34	
35	function parseOutputEntriesJson(value: string | null | undefined): OutputEntryLike[] {
36	  if (!value?.trim()) {
37	    return [];
38	  }
39	
40	  try {
41	    const parsed = JSON.parse(value) as unknown;
42	    return Array.isArray(parsed) ? parsed.filter((entry): entry is OutputEntryLike => {
43	      return typeof entry === "object" && entry !== null;
44	    }) : [];
45	  } catch {
46	    return [];
47	  }
48	}
49	
50	function visibleEntryText(entries: readonly OutputEntryLike[] | null | undefined) {
51	  return (entries ?? [])
52	    .filter((entry) => !entry.type || entry.type === "message")
53	    .map((entry) => entry.text ?? "")
54	    .filter((text) => text.trim().length > 0);
55	}
56	
57	function latestVisibleEntryText(entries: readonly OutputEntryLike[] | null | undefined) {
58	  return visibleEntryText(entries).at(-1) ?? "";
59	}
60	
61	function firstNonEmptyText(values: ReadonlyArray<string | null | undefined>) {
62	  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
63	}
64	
65	function isOpenHumanInputEntry(entry: OutputEntryLike) {
66	  if (entry.type !== "permission" && entry.type !== "elicitation") {
67	    return false;
68	  }
69	  const status = (entry.status ?? "pending").trim().toLowerCase();
70	  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected", "skipped"].includes(status);
71	}
72	
73	function entryRequestId(entry: OutputEntryLike) {
74	  const raw = entry.raw;
75	  if (typeof raw !== "object" || raw === null) {
76	    return null;
77	  }
78	  const requestId = (raw as { requestId?: unknown }).requestId;
79	  return typeof requestId === "number" && Number.isFinite(requestId) ? requestId : null;
80	}
81	
82	function entriesHaveOpenHumanInput(entries: readonly OutputEntryLike[]) {
83	  const pendingByRequestId = new Map<string, boolean>();
84	
85	  for (const entry of entries) {
86	    if (entry.type !== "permission" && entry.type !== "elicitation") {
87	      continue;
88	    }
89	
90	    const open = isOpenHumanInputEntry(entry);
91	    const requestId = entryRequestId(entry);
92	    if (requestId === null) {
93	      if (open) {
94	        return true;
95	      }
96	      continue;
97	    }
98	
99	    pendingByRequestId.set(`${entry.type}:${requestId}`, open);
100	  }
101	
102	  return [...pendingByRequestId.values()].some(Boolean);
103	}
104	
105	export function directWorkerOutputHasPendingHumanInput(source: WorkerOutputSource) {
106	  return (
107	    (source.pendingPermissions?.length ?? 0) > 0
108	    || (source.pendingElicitations?.length ?? 0) > 0
109	    || entriesHaveOpenHumanInput(source.outputEntries ?? [])
110	    || entriesHaveOpenHumanInput(parseOutputEntriesJson(source.outputEntriesJson))
111	  );
112	}
113	
114	export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
115	  if (directWorkerOutputHasPendingHumanInput(source)) {
116	    return "awaiting_user";
117	  }
118	
119	  if (ACTIVE_DIRECT_WORKER_STATUSES.has(normalizeWorkerStatus(source.workerStatus))) {
120	    return "running";
121	  }
122	
123	  return "done";
124	}
125	
126	export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
127	  runId: string;
128	  workerId?: string | null;
129	}) {
130	  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
131	  if (!run || (run.mode !== "direct" && run.mode !== "commit")) {
132	    return null;
133	  }
134	
135	  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
136	  const now = new Date();
137	  await db.update(runs).set({
138	    status: nextStatus,
139	    failedAt: null,
140	    lastError: null,
141	    updatedAt: now,
142	  }).where(eq(runs.id, args.runId));
143	
144	  if (nextStatus === "awaiting_user" && run.status !== "awaiting_user") {
145	    emitNamedEvent({
146	      kind: "conversation.awaiting_user",
147	      runId: args.runId,
148	      workerId: args.workerId ?? undefined,
149	      reason: "worker_requested_input",
150	    });
151	    await recordExecutionEvent({
152	      runId: args.runId,
153	      workerId: args.workerId ?? null,
154	      planItemId: null,
155	      eventType: "direct_worker_awaiting_user",
156	      details: { reason: "worker_requested_input" },
157	      createdAt: now,
158	    });
159	  } else if (run.mode === "direct" && nextStatus === "done" && run.status !== "done") {
160	    await runMilestoneAutoCommit(args.runId, firstNonEmptyText([
161	      args.responseText,
162	      args.currentText,
163	      args.lastText,
164	      latestVisibleEntryText(args.outputEntries),
165	      latestVisibleEntryText(parseOutputEntriesJson(args.outputEntriesJson)),
166	      args.renderedOutput,
167	      args.outputLog,
168	    ]));
169	    notifyEventStreamSubscribers();
170	  } else if (nextStatus !== run.status || run.failedAt || run.lastError) {
171	    notifyEventStreamSubscribers();
172	  }
173	
174	  return nextStatus;
175	}
176	
177	export async function updateDirectRunAwaitingUserInputIfRequested(args: WorkerOutputSource & {
178	  runId: string;
179	  workerId?: string | null;
180	}) {
181	  if (!directWorkerOutputHasPendingHumanInput(args)) {
182	    return false;
183	  }
184	
185	  await updateDirectRunStatusFromWorkerOutput(args);
186	  return true;
187	}
188	

uuid: 085971aa-e14a-42a5-8231-606ace415e9f
parent: 3bdb8149-026b-4135-9e1a-e7152b2199d8
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:30.817Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:30.817Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/sync.ts"
}

uuid: c0f6f31e-dc4b-4c13-9268-65d096ea967d
parent: 085971aa-e14a-42a5-8231-606ace415e9f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:31.021Z","phase":null} -->
## Claude tool result: toolu_01YL4W5fQSEdc5p7e8gBsmbY · 2026-07-11T12:05:31.021Z

```text
1	import { and, eq } from "drizzle-orm";
2	import { db } from "@/server/db";
3	import { withSqliteBusyRetry } from "@/server/db/retry";
4	import { messages, queuedConversationMessages, recoveryIncidents, runs, workers } from "@/server/db/schema";
5	import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
6	import { listAgents, normalizeAgentRecord, type AgentRecord } from "@/server/bridge-client";
7	import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
8	import { recordExecutionEvent } from "@/server/events/execution-event-store";
9	import { emitNamedEvent } from "@/server/events/named-events";
10	import { persistRunFailure } from "@/server/runs/failures";
11	import { isTerminalRunStatus } from "@/server/runs/status";
12	import { isLongWorkerCompletionText } from "@/server/supervisor/worker-completion";
13	import { startSupervisorRun } from "@/server/supervisor/start";
14	import { isRecoverableConnectionSupervisorError, isTransientSupervisorError } from "@/server/supervisor/retry";
15	import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";
16	import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
17	import { drainQueuedWorkerMessages } from "./queued-messages";
18	import {
19	  resolveDirectRunStatusFromWorkerOutput,
20	  updateDirectRunStatusFromWorkerOutput,
21	} from "./direct-run-status";
22	
23	const EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output.";
24	const MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";
25	
26	function isDirectRunMode(mode: string | null | undefined) {
27	  return mode === "direct" || mode === "commit";
28	}
29	
30	function hasAgentOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
31	  return Boolean(
32	    agent.renderedOutput?.trim()
33	    || agent.currentText.trim()
34	    || agent.lastText.trim()
35	    || agent.outputEntries?.some((entry) => entry.text.trim()),
36	  );
37	}
38	
39	function normalizedStatus(value: string | null | undefined) {
40	  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
41	}
42	
43	function parseIncidentDetails(details: string | null | undefined): Record<string, unknown> {
44	  if (!details) {
45	    return {};
46	  }
47	  try {
48	    const parsed: unknown = JSON.parse(details);
49	    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
50	      ? parsed as Record<string, unknown>
51	      : {};
52	  } catch {
53	    return {};
54	  }
55	}
56	
57	function incidentResumeAt(details: string | null | undefined) {
58	  const value = parseIncidentDetails(details).resumeAt;
59	  if (typeof value !== "string") {
60	    return null;
61	  }
62	  const date = new Date(value);
63	  return Number.isFinite(date.getTime()) ? date : null;
64	}
65	
66	function isCompletedEntryStatus(value: string | null | undefined) {
67	  const status = normalizedStatus(value);
68	  return !status || [
69	    "approved",
70	    "cancelled",
71	    "canceled",
72	    "completed",
73	    "denied",
74	    "error",
75	    "failed",
76	    "success",
77	  ].includes(status);
78	}
79	
80	function isInputEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
81	  const type = (entry as { type?: string | null }).type;
82	  return type === "user_input" || type === "supervisor_input";
83	}
84	
85	function isOpenWorkEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
86	  if (entry.type !== "tool_call" && entry.type !== "tool_call_update" && entry.type !== "permission" && entry.type !== "elicitation") {
87	    return false;
88	  }
89	
90	  return !isCompletedEntryStatus(entry.status);
91	}
92	
93	function hasPendingElicitationSignal(snapshot: ReturnType<typeof normalizeAgentRecord> | null) {
94	  return Boolean(
95	    (snapshot?.pendingElicitations?.length ?? 0) > 0
96	    || snapshot?.outputEntries?.some((entry) => entry.type === "elicitation" && !isCompletedEntryStatus(entry.status)),
97	  );
98	}
99	
100	function directLiveAgentHasCompletedTurn(agent: ReturnType<typeof normalizeAgentRecord>) {
101	  const state = normalizedStatus(agent.state);
102	  if (state !== "working" && state !== "starting" && state !== "stuck") {
103	    return false;
104	  }
105	
106	  if (!agent.stopReason?.trim() && !isLongWorkerCompletionText(agent.currentText || agent.lastText || agent.renderedOutput)) {
107	    return false;
108	  }
109	
110	  if ((agent.pendingPermissions?.length ?? 0) > 0) {
111	    return false;
112	  }
113	
114	  if ((agent.pendingElicitations?.length ?? 0) > 0) {
115	    return false;
116	  }
117	
118	  const entries = agent.outputEntries ?? [];
119	  if (entries.length === 0) {
120	    return false;
121	  }
122	
123	  const lastInputIndex = entries.findLastIndex(isInputEntry);
124	  const turnEntries = entries.slice(lastInputIndex + 1);
125	  if (turnEntries.some(isOpenWorkEntry)) {
126	    return false;
127	  }
128	
129	  const currentText = agent.currentText.trim();
130	  const lastText = agent.lastText.trim();
131	  if (currentText && lastText && currentText !== lastText) {
132	    return false;
133	  }
134	
135	  const latestMeaningfulEntry = [...turnEntries].reverse().find((entry) => (
136	    entry.status !== "archived"
137	    && entry.text.trim().length > 0
138	  ));
139	
140	  return latestMeaningfulEntry?.type === "message";
141	}
142	
143	async function hasPersistedWorkerOutput(worker: typeof workers.$inferSelect) {
144	  if (
145	    worker.outputLog.trim()
146	    || worker.currentText.trim()
147	    || worker.lastText.trim()
148	  ) {
149	    return true;
150	  }
151	
152	  const entries = await readWorkerOutputEntries(worker.runId, worker.id);
153	  return entries.some((entry) => {
154	    const text = (entry as { text?: unknown }).text;
155	    return typeof text === "string" && text.trim().length > 0;
156	  });
157	}
158	
159	function resolveSyncedRunState(run: typeof runs.$inferSelect, agent: ReturnType<typeof normalizeAgentRecord>) {
160	  if (agent.state === "error") {
161	    return "failed";
162	  }
163	
164	  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...agent, workerStatus: agent.state }) === "awaiting_user") {
165	    return "awaiting_user";
166	  }
167	
168	  if (isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent)) {
169	    return "done";
170	  }
171	
172	  if (isDirectRunMode(run.mode) && agent.state === "idle" && hasAgentOutput(agent)) {
173	    return "done";
174	  }
175	
176	  if (
177	    ["stopped", "cancelled", "done", "completed"].includes(agent.state)
178	    || (agent.state === "idle" && agent.stopReason === "end_turn" && hasAgentOutput(agent))
179	  ) {
180	    return "done";
181	  }
182	
183	  return "running";
184	}
185	
186	async function resolvePersistedRunState(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
187	  const status = normalizedStatus(worker.status);
188	
189	  if (status === "error") {
190	    return "failed";
191	  }
192	
193	  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...worker, workerStatus: worker.status }) === "awaiting_user") {
194	    return "awaiting_user";
195	  }
196	
197	  if (
198	    ["stopped", "cancelled", "done", "completed"].includes(status)
199	    || (status === "idle" && await hasPersistedWorkerOutput(worker))
200	  ) {
201	    return "done";
202	  }
203	
204	  return "running";
205	}
206	
207	async function isEmptyIdlePersistedWorker(worker: typeof workers.$inferSelect) {
208	  const status = normalizedStatus(worker.status);
209	  return status === "idle" && !(await hasPersistedWorkerOutput(worker));
210	}
211	
212	function isIdleLiveAgentWithoutOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
213	  return agent.state === "idle" && !hasAgentOutput(agent);
214	}
215	
216	function isAgentBusyRunFailure(run: typeof runs.$inferSelect) {
217	  return run.status === "failed" && /\bagent is busy\b/i.test(run.lastError ?? "");
218	}
219	
220	function isRecoverableImplementationTransientFailure(run: typeof runs.$inferSelect) {
221	  const lastError = run.lastError ?? "";
222	  return run.mode === "implementation"
223	    && run.status === "failed"
224	    && Boolean(lastError.trim())
225	    && isTransientSupervisorError(new Error(lastError));
226	}
227	
228	function isRecoverableImplementationConnectionFailure(run: typeof runs.$inferSelect) {
229	  const lastError = run.lastError ?? "";
230	  return run.mode === "implementation"
231	    && run.status === "failed"
232	    && Boolean(lastError.trim())
233	    && isRecoverableConnectionSupervisorError(new Error(lastError));
234	}
235	
236	function isCleanLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
237	  return agent.state !== "error" && !agent.lastError?.trim();
238	}
239	
240	function isActiveLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
241	  const state = normalizedStatus(agent.state);
242	  return ["starting", "working", "stuck"].includes(state) || Boolean(agent.currentText.trim());
243	}
244	
245	function isWorkerQueueDrainableStatus(status: string) {
246	  const normalized = normalizedStatus(status);
247	  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
248	}
249	
250	async function pendingWorkerQueueCount(runId: string, workerId: string) {
251	  const records = await db.select({ id: queuedConversationMessages.id })
252	    .from(queuedConversationMessages)
253	    .where(and(
254	      eq(queuedConversationMessages.runId, runId),
255	      eq(queuedConversationMessages.targetWorkerId, workerId),
256	      eq(queuedConversationMessages.status, "pending"),
257	    ));
258	  return records.length;
259	}
260	
261	async function recordQueueDrainDecision(args: {
262	  runId: string;
263	  workerId: string;
264	  source: string;
265	  workerStatus: string;
266	  pendingCount: number;
267	  decision: "drain" | "skip";
268	  reason: string;
269	}) {
270	  emitNamedEvent({
271	    kind: "queue.drain_decision",
272	    runId: args.runId,
273	    workerId: args.workerId,
274	    source: args.source,
275	    workerStatus: args.workerStatus,
276	    pendingCount: args.pendingCount,
277	    decision: args.decision,
278	    reason: args.reason,
279	  });
280	  await recordExecutionEvent({
281	    runId: args.runId,
282	    workerId: args.workerId,
283	    eventType: "queue_drain_decision",
284	    details: {
285	      summary: args.decision === "drain"
286	        ? `Draining ${args.pendingCount} queued message(s) for ${args.workerId}.`
287	        : `Skipped queue drain for ${args.workerId}: ${args.reason}.`,
288	      source: args.source,
289	      workerStatus: args.workerStatus,
290	      pendingCount: args.pendingCount,
291	      decision: args.decision,
292	      reason: args.reason,
293	    },
294	  });
295	}
296	
297	async function drainQueuedWorkerMessagesWithObservation(args: {
298	  runId: string;
299	  workerId: string;
300	  workerStatus: string;
301	  source: string;
302	  snapshot?: ReturnType<typeof normalizeAgentRecord> | null;
303	}) {
304	  const pendingCount = await pendingWorkerQueueCount(args.runId, args.workerId);
305	  if (pendingCount === 0) {
306	    return 0;
307	  }
308	
309	  const snapshot = args.snapshot ?? null;
310	  const hasPendingElicitation = hasPendingElicitationSignal(snapshot);
311	  const drainable = hasPendingElicitation || isWorkerQueueDrainableStatus(args.workerStatus);
312	  await recordQueueDrainDecision({
313	    ...args,
314	    pendingCount,
315	    decision: drainable ? "drain" : "skip",
316	    reason: hasPendingElicitation
317	      ? "pending_elicitation"
318	      : drainable
319	        ? "worker_drainable"
320	        : "worker_not_drainable",
321	  });
322	  if (!drainable) {
323	    return 0;
324	  }
325	
326	  const deliveredCount = await drainQueuedWorkerMessages({
327	    runId: args.runId,
328	    workerId: args.workerId,
329	    snapshot,
330	  });
331	  emitNamedEvent({
332	    kind: "queue.drain_finished",
333	    runId: args.runId,
334	    workerId: args.workerId,
335	    source: args.source,
336	    pendingCount,
337	    deliveredCount,
338	  });
339	  await recordExecutionEvent({
340	    runId: args.runId,
341	    workerId: args.workerId,
342	    eventType: "queue_drain_finished",
343	    details: {
344	      summary: `Queue drain finished for ${args.workerId}: delivered ${deliveredCount} of ${pendingCount}.`,
345	      source: args.source,
346	      pendingCount,
347	      deliveredCount,
348	    },
349	  });
350	  return deliveredCount;
351	}
352	
353	function isRecoverableMissingDirectWorkerStatus(status: string) {
354	  const normalized = normalizedStatus(status);
355	  return ["starting", "working", "stuck", "recovering"].includes(normalized);
356	}
357	
358	function isCancelledWorkerStatus(status: string | null | undefined) {
359	  const normalized = normalizedStatus(status);
360	  return normalized === "cancelled" || normalized === "canceled";
361	}
362	
363	function isIdleDirectWorkerWithStaleCurrentText(worker: typeof workers.$inferSelect) {
364	  if (normalizedStatus(worker.status) !== "idle") {
365	    return false;
366	  }
367	
368	  const currentText = worker.currentText.trim();
369	  if (!currentText) {
370	    return false;
371	  }
372	
373	  const lastText = worker.lastText.trim();
374	  return !lastText || currentText === lastText;
375	}
376	
377	async function clearStaleDirectCurrentText(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
378	  if (!isDirectRunMode(run.mode) || !isTerminalRunStatus(run.status) || !isIdleDirectWorkerWithStaleCurrentText(worker)) {
379	    return false;
380	  }
381	
382	  await withSqliteBusyRetry(() => db.update(workers).set({
383	    currentText: "",
384	    lastText: worker.lastText || worker.currentText,
385	    updatedAt: new Date(),
386	  }).where(eq(workers.id, worker.id)));
387	  notifyEventStreamSubscribers();
388	  return true;
389	}
390	
391	function workerCreatedAtMs(worker: typeof workers.$inferSelect) {
392	  const time = worker.createdAt.getTime();
393	  return Number.isFinite(time) ? time : 0;
394	}
395	
396	function compareWorkersForFollowUp(a: typeof workers.$inferSelect, b: typeof workers.$inferSelect) {
397	  const workerNumberDiff = (b.workerNumber ?? 0) - (a.workerNumber ?? 0);
398	  if (workerNumberDiff !== 0) {
399	    return workerNumberDiff;
400	  }
401	
402	  const createdAtDiff = workerCreatedAtMs(b) - workerCreatedAtMs(a);
403	  if (createdAtDiff !== 0) {
404	    return createdAtDiff;
405	  }
406	
407	  return b.id.localeCompare(a.id);
408	}
409	
410	function selectConversationWorker(runId: string, allWorkers: Array<typeof workers.$inferSelect>) {
411	  const sortedWorkers = allWorkers
412	    .filter((candidate) => candidate.runId === runId)
413	    .sort(compareWorkersForFollowUp);
414	  return sortedWorkers.find((worker) => !isCancelledWorkerStatus(worker.status)) ?? sortedWorkers[0] ?? null;
415	}
416	
417	async function clearMatchingRunFailureMessage(run: typeof runs.$inferSelect) {
418	  if (!run.lastError) {
419	    return;
420	  }
421	
422	  await db.delete(messages).where(and(
423	    eq(messages.runId, run.id),
424	    eq(messages.role, "system"),
425	    eq(messages.kind, "error"),
426	    eq(messages.content, `Run failed: ${run.lastError}`),
427	  ));
428	}
429	
430	let bridgeSyncInFlight: Promise<void> | null = null;
431	
432	/**
433	 * Watchdog-driven reconciliation between the bridge runtime and persisted
434	 * worker/run state. Turn completions are normally persisted by the awaiting
435	 * send-message call, or by the SSE-driven sync that runs while a client is
436	 * connected — but both die with their in-flight request (server restart,
437	 * dropped ACP roundtrip, phone backgrounded the tab). A worker then sits at
438	 * status='working' forever while the bridge agent finished its turn long
439	 * ago, and the stuck-worker reaper keeps cancelling and re-delivering the
440	 * same prompt every timeout window. This sweep closes the gap from the 15s
441	 * watchdog without requiring any connected client.
442	 */
443	export function syncConversationSessionsFromBridge(): Promise<void> {
444	  if (bridgeSyncInFlight) {
445	    return bridgeSyncInFlight;
446	  }
447	
448	  bridgeSyncInFlight = (async () => {
449	    let rawAgents: unknown[];
450	    try {
451	      rawAgents = await listAgents({ retryIndefinitely: false });
452	    } catch {
453	      // Bridge down or unreachable — there is no live state to reconcile
454	      // against; the next sweep will retry.
455	      return;
456	    }
457	    await syncConversationSessions(rawAgents);
458	  })().finally(() => {
459	    bridgeSyncInFlight = null;
460	  });
461	  return bridgeSyncInFlight;
462	}
463	
464	type SyncConversationSessionsOptions = {
465	  selectedRunId?: string | null;
466	  refreshPlanningArtifacts?: boolean;
467	};
468	
469	let liveSyncQueue: Promise<void> = Promise.resolve();
470	
471	export function __resetSyncConversationSessionsQueueForTests() {
472	  liveSyncQueue = Promise.resolve();
473	}
474	
475	export async function syncConversationSessions(rawAgents: unknown[], options: SyncConversationSessionsOptions = {}) {
476	  const runSync = () => syncConversationSessionsUnlocked(rawAgents, options);
477	  const nextSync = liveSyncQueue.then(runSync, runSync);
478	  liveSyncQueue = nextSync.catch(() => undefined);
479	  return nextSync;
480	}
481	
482	async function syncConversationSessionsUnlocked(rawAgents: unknown[], options: SyncConversationSessionsOptions = {}) {
483	  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
484	  const selectedRunId = options.selectedRunId?.trim() || null;
485	  const refreshPlanningArtifacts = options.refreshPlanningArtifacts !== false;
486	  const allRuns = selectedRunId
487	    ? await db.select().from(runs).where(eq(runs.id, selectedRunId))
488	    : await db.select().from(runs);
489	  const allWorkers = selectedRunId
490	    ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
491	    : await db.select().from(workers);
492	  const openQuotaIncidents = (selectedRunId
493	    ? await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, selectedRunId))
494	    : await db.select().from(recoveryIncidents)
495	  ).filter((incident) => (
496	    incident.kind === "quota_exhausted"
497	    && (incident.status === "open" || incident.status === "recovering")
498	    && (incidentResumeAt(incident.details)?.getTime() ?? 0) > Date.now()
499	  ));
500	
501	  for (const run of allRuns) {
502	    // A user cancellation is authoritative. The bridge can report the old
503	    // turn as working until cancellation reaches the provider, but that late
504	    // snapshot must not reopen recovery or revive the conversation.
505	    if (isCancelledWorkerStatus(run.status)) {
506	      continue;
507	    }
508	
509	    const quotaIncident = openQuotaIncidents.find((incident) => incident.runId === run.id);
510	    if (quotaIncident) {
511	      if (run.status !== "quota_waiting" || run.lastError || run.failedAt) {
512	        await withSqliteBusyRetry(() => db.update(runs).set({
513	          status: "quota_waiting",
514	          failedAt: null,
515	          lastError: null,
516	          updatedAt: new Date(),
517	        }).where(eq(runs.id, run.id)));
518	      }
519	      continue;
520	    }
521	
522	    const staleBusyFailure = isAgentBusyRunFailure(run);
523	    const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
524	    const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);
525	    if (run.mode === "implementation") {
526	      const implementationWorkers = allWorkers.filter((candidate) => candidate.runId === run.id);
527	      let syncedActiveLiveWorker = false;
528	
529	      for (const implementationWorker of implementationWorkers) {
530	        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
531	        const cancelledWorkerHasMatchingLiveSession = Boolean(
532	          implementationAgent
533	          && implementationWorker.bridgeSessionId
534	          && implementationWorker.bridgeSessionMode
535	          && implementationAgent.sessionId === implementationWorker.bridgeSessionId
536	          && implementationAgent.sessionMode === implementationWorker.bridgeSessionMode,
537	        );
538	        if (isCancelledWorkerStatus(implementationWorker.status)
539	          && !cancelledWorkerHasMatchingLiveSession) {
540	          continue;
541	        }
542	        if (!implementationAgent || !isCleanLiveAgent(implementationAgent) || !isActiveLiveAgent(implementationAgent)) {
543	          continue;
544	        }
545	
546	        await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
547	        await withSqliteBusyRetry(() => db.update(workers).set({
548	          status: implementationAgent.state,
549	          cwd: implementationAgent.cwd || implementationWorker.cwd,
550	          currentText: implementationAgent.currentText,
551	          lastText: implementationAgent.lastText,
552	          bridgeSessionId: implementationAgent.sessionId ?? implementationWorker.bridgeSessionId,
553	          bridgeSessionMode: implementationAgent.sessionMode ?? implementationWorker.bridgeSessionMode,
554	          updatedAt: new Date(),
555	        }).where(eq(workers.id, implementationWorker.id)));
556	        syncedActiveLiveWorker = true;
557	      }
558	
559	      if (syncedActiveLiveWorker) {
560	        if (run.status !== "running" || run.failedAt || run.lastError) {
561	          await withSqliteBusyRetry(() => db.update(runs).set({
562	            status: "running",
563	            failedAt: null,
564	            lastError: null,
565	            updatedAt: new Date(),
566	          }).where(eq(runs.id, run.id)));
567	          await clearMatchingRunFailureMessage(run);
568	          startSupervisorRun(run.id);
569	        }
570	        continue;
571	      }
572	
573	      if (!staleImplementationTransientFailure) {
574	        continue;
575	      }
576	
577	      const implementationWorker = implementationWorkers[0];
578	      const implementationAgent = implementationWorker
579	        ? agents.find((candidate) => candidate.name === implementationWorker.id)
580	        : null;
581	      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
582	        if (staleImplementationConnectionFailure) {
583	          const resumableWorker = implementationWorkers.find((worker) => worker.bridgeSessionId?.trim());
584	          if (resumableWorker) {
585	            await withSqliteBusyRetry(() => db.update(runs).set({
586	              status: "running",
587	              failedAt: null,
588	              lastError: null,
589	              updatedAt: new Date(),
590	            }).where(eq(runs.id, run.id)));
591	            await clearMatchingRunFailureMessage(run);
592	            startSupervisorRun(run.id);
593	          }
594	        }
595	        continue;
596	      }
597	
598	      await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
599	      await withSqliteBusyRetry(() => db.update(workers).set({
600	        status: implementationAgent.state,
601	        cwd: implementationAgent.cwd || implementationWorker.cwd,
602	        currentText: implementationAgent.currentText,
603	        lastText: implementationAgent.lastText,
604	        updatedAt: new Date(),
605	      }).where(eq(workers.id, implementationWorker.id)));
606	      await withSqliteBusyRetry(() => db.update(runs).set({
607	        status: "running",
608	        failedAt: null,
609	        lastError: null,
610	        updatedAt: new Date(),
611	      }).where(eq(runs.id, run.id)));
612	      await clearMatchingRunFailureMessage(run);
613	      startSupervisorRun(run.id);
614	      continue;
615	    }
616	
617	    const worker = selectConversationWorker(run.id, allWorkers);
618	    if (!worker) {
619	      continue;
620	    }
621	
622	    if (await clearStaleDirectCurrentText(run, worker)) {
623	      continue;
624	    }
625	
626	    const agent = agents.find((candidate) => candidate.name === worker.id);
627	    const selectedTerminalDirectRunStillStreaming = Boolean(
628	      options.selectedRunId === run.id
629	      && isDirectRunMode(run.mode)
630	      && agent
631	      && isActiveLiveAgent(agent),
632	    );
633	    if (isTerminalRunStatus(run.status) && !staleBusyFailure && !selectedTerminalDirectRunStillStreaming) {
634	      continue;
635	    }
636	
637	    if (!agent) {
638	      continue;
639	    }
640	
641	    if (
642	      isDirectRunMode(run.mode)
643	      && worker.status.trim().toLowerCase().split(":")[0]?.trim() === "idle"
644	      && isIdleLiveAgentWithoutOutput(agent)
645	    ) {
646	      await withSqliteBusyRetry(() => db.update(workers).set({
647	        status: "error",
648	        cwd: agent.cwd || worker.cwd,
649	        currentText: agent.currentText,
650	        lastText: agent.lastText,
651	        outputLog: EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
652	        updatedAt: new Date(),
653	      }).where(eq(workers.id, worker.id)));
654	      await persistRunFailure(run.id, new Error(EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
655	        surface: { code: "worker.idle.empty_output", workerId: worker.id },
656	      });
657	      continue;
658	    }
659	
660	    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
661	    const nextRunState = resolveSyncedRunState(run, agent);
662	    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
663	    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
664	    await withSqliteBusyRetry(() => db.update(workers).set({
665	      status: nextWorkerStatus,
666	      cwd: agent.cwd || worker.cwd,
667	      currentText: quiescedDirectWorker ? "" : agent.currentText,
668	      lastText: agent.lastText,
669	      updatedAt: new Date(),
670	    }).where(eq(workers.id, worker.id)));
671	    if (worker.status !== nextWorkerStatus) {
672	      emitNamedEvent({
673	        kind: "worker.status",
674	        runId: run.id,
675	        workerId: worker.id,
676	        prev: worker.status,
677	        next: nextWorkerStatus,
678	      });
679	    }
680	
681	    if (run.mode === "planning") {
682	      if (refreshPlanningArtifacts) {
683	        const result = await refreshPlanningArtifactsForRun({
684	          run,
685	          worker,
686	          snapshot: agent,
687	          status: nextRunState === "running" ? "working" : undefined,
688	        });
689	        if (staleBusyFailure && result.status !== "failed") {
690	          await clearMatchingRunFailureMessage(run);
691	        }
692	      }
693	      await drainQueuedWorkerMessagesWithObservation({
694	        runId: run.id,
695	        workerId: worker.id,
696	        workerStatus: agent.state,
697	        source: "live_planning_sync",
698	      });
699	      continue;
700	    }
701	
702	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
703	      await updateDirectRunStatusFromWorkerOutput({
704	        runId: run.id,
705	        workerId: worker.id,
706	        workerStatus: nextWorkerStatus,
707	        renderedOutput: agent.renderedOutput,
708	        currentText: agent.currentText,
709	        lastText: agent.lastText,
710	        outputEntries: agent.outputEntries,
711	        pendingPermissions: agent.pendingPermissions,
712	        pendingElicitations: agent.pendingElicitations,
713	      });
714	    } else {
715	      await withSqliteBusyRetry(() => db.update(runs).set({
716	        status: nextRunState,
717	        lastError: nextRunState === "failed" ? agent.lastError || run.lastError : null,
718	        failedAt: nextRunState === "failed" ? run.failedAt : null,
719	        updatedAt: new Date(),
720	      }).where(eq(runs.id, run.id)));
721	    }
722	    if (staleBusyFailure && nextRunState !== "failed") {
723	      await clearMatchingRunFailureMessage(run);
724	    }
725	    await drainQueuedWorkerMessagesWithObservation({
726	      runId: run.id,
727	      workerId: worker.id,
728	      workerStatus: nextWorkerStatus,
729	      source: "live_worker_sync",
730	      snapshot: agent,
731	    });
732	  }
733	
734	  for (const run of allRuns) {
735	    const staleBusyFailure = isAgentBusyRunFailure(run);
736	    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
737	      continue;
738	    }
739	
740	    const worker = selectConversationWorker(run.id, allWorkers);
741	    if (!worker || agents.some((agent) => agent.name === worker.id)) {
742	      continue;
743	    }
744	
745	    if (
746	      options.selectedRunId === run.id
747	      && isRecoverableMissingDirectWorkerStatus(worker.status)
748	    ) {
749	      const recoveryResult = await reconcileRunRecovery({
750	        runId: run.id,
751	        liveAgents: agents,
752	        source: "conversation-sync",
753	      });
754	      if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
755	        continue;
756	      }
757	    }
758	
759	    if (await isEmptyIdlePersistedWorker(worker)) {
760	      await withSqliteBusyRetry(() => db.update(workers).set({
761	        status: "error",
762	        outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
763	        updatedAt: new Date(),
764	      }).where(eq(workers.id, worker.id)));
765	      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
766	        surface: { code: "worker.idle.missing_output", workerId: worker.id },
767	      });
768	      continue;
769	    }
770	
771	    const nextRunState = await resolvePersistedRunState(run, worker);
772	    if (run.mode === "planning") {
773	      if (refreshPlanningArtifacts) {
774	        await refreshPlanningArtifactsForRun({
775	          run,
776	          worker,
777	          status: nextRunState === "running" ? "working" : undefined,
778	        });
779	      }
780	      continue;
781	    }
782	
783	    if (nextRunState === run.status) {
784	      await drainQueuedWorkerMessagesWithObservation({
785	        runId: run.id,
786	        workerId: worker.id,
787	        workerStatus: worker.status,
788	        source: "persisted_state_unchanged",
789	      });
790	      continue;
791	    }
792	
793	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
794	      await updateDirectRunStatusFromWorkerOutput({
795	        runId: run.id,
796	        workerId: worker.id,
797	        workerStatus: worker.status,
798	        outputLog: worker.outputLog,
799	        currentText: worker.currentText,
800	        lastText: worker.lastText,
801	        outputEntriesJson: worker.outputEntriesJson,
802	      });
803	      await drainQueuedWorkerMessagesWithObservation({
804	        runId: run.id,
805	        workerId: worker.id,
806	        workerStatus: worker.status,
807	        source: "persisted_direct_completion",
808	      });
809	    } else {
810	      await withSqliteBusyRetry(() => db.update(runs).set({
811	        status: nextRunState,
812	        updatedAt: new Date(),
813	      }).where(eq(runs.id, run.id)));
814	    }
815	  }
816	}
817	

uuid: f8aa46d5-b419-475f-abf4-68de5410ae1c
parent: c0f6f31e-dc4b-4c13-9268-65d096ea967d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:48.525Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:48.525Z



uuid: b1d45f53-5aee-4277-8790-13afc3b1c884
parent: f8aa46d5-b419-475f-abf4-68de5410ae1c

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:49.261Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:49.261Z

```json
{
  "pattern": "conversation\\.read",
  "output_mode": "content",
  "-n": true,
  "-C": 5
}

uuid: 17bc66ea-1024-4c1e-b3ec-f5396276b66b
parent: b1d45f53-5aee-4277-8790-13afc3b1c884
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:49.318Z","phase":null} -->
## Claude tool result: toolu_018AA1P4XS99pnSxLXQ4KTnm · 2026-07-11T12:05:49.318Z

```text
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-329-        lastReadAt,
src/runtime/http/routes/runs.ts-330-        updatedAt: now,
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-331-      },
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-332-    });
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-333-
src/runtime/http/routes/runs.ts:334:  emitNamedEvent({ kind: "conversation.read", runId, lastReadAt: lastReadAt.toISOString() });
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-335-  return lastReadAt.toISOString();
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-336-}
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-337-
src/runtime/http/routes/runs.ts-338-export const handleRunPatchRequest: OmniHttpHandler = async (request, context) => {
/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts-339-  let patchActionLabel = "Update";
--
src/server/events/named-events.ts-268-  | { kind: "account.usage_recorded"; accountId: string; runId: string; workerId?: string; workerType: string; inputTokens: number; outputTokens: number; costUsd: number }
src/server/events/named-events.ts-269-  | { kind: "account.login_required"; accountId: string; workerType: string; reason: string };
/Users/masterman/NLP/omniharness/src/server/events/named-events.ts-270-
/Users/masterman/NLP/omniharness/src/server/events/named-events.ts-271-export type ConversationEvent =
src/server/events/named-events.ts-272-  | { kind: "conversation.awaiting_user"; runId: string; workerId?: string; reason: "worker_requested_input" }
src/server/events/named-events.ts:273:  | { kind: "conversation.read"; runId: string; lastReadAt: string }
src/server/events/named-events.ts-274-  | { kind: "conversation.project_moved"; runId: string; previousProjectPath: string | null; projectPath: string }
src/server/events/named-events.ts-275-  | { kind: "conversation.deleted"; runId: string }
src/server/events/named-events.ts-276-  | { kind: "conversation.delete_failed"; runId: string; blockingTable: string | null }
/Users/masterman/NLP/omniharness/src/server/events/named-events.ts-277-  | {
src/server/events/named-events.ts-278-      kind: "queue.drain_decision";

uuid: cffa2ae2-07ac-4088-9c21-e4f11a7cde54
parent: 17bc66ea-1024-4c1e-b3ec-f5396276b66b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:50.510Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:50.510Z

```json
{
  "pattern": "emitNamedEvent|notifyEventStreamSubscribers",
  "path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes/events.ts",
  "output_mode": "content",
  "-n": true
}

uuid: 17d245d2-90c4-49ce-8d3c-c16150f3a942
parent: cffa2ae2-07ac-4088-9c21-e4f11a7cde54
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:50.516Z","phase":null} -->
## Claude tool result: toolu_01XFyc89h2FsnBbk7VG4HNa9 · 2026-07-11T12:05:50.516Z

```text
No matches found

uuid: 8a3d90c5-46b7-4ed6-84dd-620f49331b26
parent: 17d245d2-90c4-49ce-8d3c-c16150f3a942
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:52.578Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:52.578Z



uuid: 28b142cc-40fd-4571-b9b8-5af2ccb51e36
parent: 8a3d90c5-46b7-4ed6-84dd-620f49331b26

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:53.648Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:53.648Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/events/named-events.ts",
  "offset": 1,
  "limit": 60
}

uuid: 6ac1e1c7-d0c9-4bee-99db-8437330ddc61
parent: 28b142cc-40fd-4571-b9b8-5af2ccb51e36
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:53.656Z","phase":null} -->
## Claude tool result: toolu_011egzYmdZHWGRg5MxfGD7Wt · 2026-07-11T12:05:53.656Z

```text
1	/**
2	 * Named lifecycle events emitted alongside the snapshot stream.
3	 *
4	 * See docs/architecture/lifecycle-observability-and-testing.md for the
5	 * design rationale. The short version:
6	 *
7	 *   - Every server-side decision that the user, the UI, or a test client
8	 *     might want to observe is published here as a typed event.
9	 *   - Events share a single monotonic id namespace with the `update`
10	 *     snapshot frames emitted by /api/events. That keeps SSE
11	 *     `Last-Event-ID` resume unambiguous.
12	 *   - A bounded ring buffer remembers recent emissions so reconnecting
13	 *     clients can replay events they missed during disconnect.
14	 *
15	 * This module is intentionally synchronous and in-process. The ring
16	 * resets when the server restarts; clients then bootstrap via
17	 * `/api/events?snapshot=1` and resume from the new cursor.
18	 */
19	import { notifyEventStreamSubscribers } from "./live-updates";
20	
21	// ---------------------------------------------------------------------------
22	// Event union
23	// ---------------------------------------------------------------------------
24	
25	export type SurfacedErrorCode =
26	  | "plan.review.leftover_state"
27	  | "plan.review.failed"
28	  | "conversation.delete.foreign_key"
29	  | "conversation.delete.failed"
30	  | "conversation.continue.failed"
31	  | "process.spawn.failed"
32	  | "process.cwd.invalid"
33	  | "process.stdin.closed"
34	  | "process.stop.failed"
35	  | "process.orphaned_after_restart"
36	  | "recovery.gave_up"
37	  | "recovery.needs_user"
38	  | "recovery.run_failed"
39	  | "runtime.resource_pressure"
40	  | "runtime.settings_apply_failed"
41	  | "runtime.start_failed"
42	  | "account.invalid_explicit"
43	  | "account.login_required"
44	  | "account.quota_switch_failed"
45	  | "account.resolution_failed"
46	  | "account.secret_decryption_failed"
47	  | "account.migration_failed"
48	  | "session.provider.unknown"
49	  | "session.action.unsupported"
50	  | "queue.interrupt.refused"
51	  | "queue.interrupt.cancel_failed"
52	  | "queue.interrupt.delivery_failed"
53	  | "supervisor.gave_up"
54	  | "supervisor.wake.failed"
55	  | "surface.bridge_failed"
56	  | "worker.spawn.failed"
57	  | "worker.spawn.resource_exhausted"
58	  | "worker.failover.failed"
59	  | "worker.bridge.fatal_stderr"
60	  | "worker.environment_mismatch"

uuid: cf3297c7-92c1-44c6-a6df-66b440164d07
parent: 6ac1e1c7-d0c9-4bee-99db-8437330ddc61
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:54.286Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:54.286Z

```json
{
  "pattern": "named-events|onNamedEvent|subscribeNamedEvents",
  "path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes",
  "output_mode": "files_with_matches"
}

uuid: 5d363583-3cc4-4806-bc8f-de88ca497e41
parent: cf3297c7-92c1-44c6-a6df-66b440164d07
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:54.309Z","phase":null} -->
## Claude tool result: toolu_01XFqX8SDUyo3Zfr9jRjxkvo · 2026-07-11T12:05:54.309Z

```text
Found 7 files
src/runtime/http/routes/conversations.ts
src/runtime/http/routes/runs.ts
src/runtime/http/routes/accounts.ts
src/runtime/http/routes/conversation-messages.ts
src/runtime/http/routes/events.ts
src/runtime/http/routes/settings.ts
src/runtime/http/routes/events-log.ts

uuid: 5432efe1-cb5b-496e-94cc-00e6c97b96e4
parent: 5d363583-3cc4-4806-bc8f-de88ca497e41
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:05:58.324Z","phase":null} -->
## Claude thinking · 2026-07-11T12:05:58.324Z



uuid: 447f2a06-694e-467c-b771-81ab5733be8c
parent: 5432efe1-cb5b-496e-94cc-00e6c97b96e4

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:59.424Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:05:59.424Z

```json
{
  "pattern": "function emitNamedEvent",
  "path": "/Users/masterman/NLP/omniharness/src/server/events/named-events.ts",
  "-A": 15
}

uuid: 6f2c344a-9bfc-48ea-b4b4-1a30ff631e54
parent: 447f2a06-694e-467c-b771-81ab5733be8c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:05:59.443Z","phase":null} -->
## Claude tool result: toolu_013wKKEUGRKHESBGEywjp7Fn · 2026-07-11T12:05:59.443Z

```text
Found 1 file
src/server/events/named-events.ts

uuid: 4d505e87-a0a3-4cce-b156-77a3b1386044
parent: 6f2c344a-9bfc-48ea-b4b4-1a30ff631e54
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:05:59.776Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:05:59.776Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes/events.ts"
}

uuid: fff1eb3a-46fb-408f-a0a7-0e369b51bd8c
parent: 4d505e87-a0a3-4cce-b156-77a3b1386044
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:00.036Z","phase":null} -->
## Claude tool result: toolu_01D6bJUF1jhyqnJqEkTpRDJM · 2026-07-11T12:06:00.036Z

```text
1	import { db } from "@/server/db";
2	import { messages, plans, runs, accounts, workers, planItems, clarifications, queuedConversationMessages, recoveryIncidents, planningReviewRuns, planningReviewRounds, processSessions, conversationReadMarkers } from "@/server/db/schema";
3	import { listExecutionEventsForSnapshot } from "@/server/events/execution-event-store";
4	import { listSupervisorInterventionsForSnapshot } from "@/server/supervisor/intervention-store";
5	import { listPlanningReviewFindingsForSnapshot } from "@/server/planning/review-artifact-store";
6	import { BRIDGE_URL } from "@/server/bridge-client";
7	import { isTerminalRunStatus } from "@/lib/run-status";
8	import { buildAppError, type AppErrorPayload } from "@/server/api-errors";
9	import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
10	import { requireApiSession } from "@/server/auth/guards";
11	import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
12	import { readWorkerLatestSeq } from "@/server/workers/output-store";
13	import { getEventStreamNotificationVersion, waitForEventStreamNotification } from "@/server/events/live-updates";
14	import {
15	  getEventCursor,
16	  getNamedEventsSince,
17	  recordSnapshotMarker,
18	} from "@/server/events/named-events";
19	import { withEventPayloadChecksum } from "@/server/events/payload-checksum";
20	import { isTransientSupervisorError } from "@/server/supervisor/retry";
21	import { serializeMessageRecord } from "@/server/conversations/message-records";
22	import { serializeQueuedConversationMessage } from "@/server/conversations/queued-message-records";
23	import { buildAwaitingUserQuestionInvariantErrors } from "@/server/events/lifecycle-invariants";
24	import { serializeSessionRecord } from "@/server/session-providers/session-records";
25	import { reconcileOrphanedProcessSessions } from "@/server/session-providers/process-store";
26	import { reconcilePersistedReloadZombies } from "@/server/runs/persisted-zombie-reconciler";
27	import { toAccountDto } from "@/server/accounts/dto";
28	import type { OmniHttpHandler } from "@/runtime/http/registry";
29	import { startSlowProbe } from "@/server/slow-probe";
30	import { toNextRequest } from "./next-request";
31	
32	const STREAM_REFRESH_INTERVAL_MS = 15_000;
33	const RUNTIME_AGENT_GRACE_MS = 150;
34	const RUNTIME_AGENT_TIMEOUT_MS = 5000;
35	const EXECUTION_EVENT_LIMIT = 100;
36	const SUPERVISOR_INTERVENTION_LIMIT = 50;
37	const PLANNING_REVIEW_FINDING_LIMIT = 50;
38	const EVENT_PAYLOAD_CACHE_LIMIT = 50;
39	
40	async function fetchWithTimeout(url: string, timeoutMs: number) {
41	  const controller = new AbortController();
42	  let timeout: ReturnType<typeof setTimeout> | null = null;
43	
44	  try {
45	    return await Promise.race([
46	      fetch(url, { signal: controller.signal }),
47	      new Promise<Response>((_, reject) => {
48	        timeout = setTimeout(() => {
49	          controller.abort();
50	          reject(new Error(`Agent runtime list request timed out after ${timeoutMs}ms.`));
51	        }, timeoutMs);
52	      }),
53	    ]);
54	  } finally {
55	    if (timeout) {
56	      clearTimeout(timeout);
57	    }
58	  }
59	}
60	
61	async function readPersistedEventRecords(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
62	  await reconcileOrphanedProcessSessions();
63	  probe?.mark("reconcile");
64	  await reconcilePersistedReloadZombies({
65	    selectedRunId: options.selectedRunId,
66	    source: "events-snapshot",
67	  });
68	  probe?.mark("reconcile.zombies");
69	  const requestedSelectedRunId = options.selectedRunId?.trim() || null;
70	  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
71	  probe?.mark("q.plans");
72	  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
73	  probe?.mark("q.runs");
74	  const visibleRunIds = allRuns.map((run) => run.id);
75	  const selectedRun = requestedSelectedRunId ? allRuns.find((run) => run.id === requestedSelectedRunId) ?? null : null;
76	  const selectedRunId = selectedRun?.id ?? null;
77	  const selectedPlanId = selectedRun?.planId ?? null;
78	  const transcriptRunIds = selectedRunId
79	    ? [
80	        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
81	        selectedRunId,
82	      ]
83	    : [];
84	
85	  const [
86	    msgs,
87	    allAccounts,
88	    allWorkers,
89	    selectedAgentWorkers,
90	    allPlanItems,
91	    allClarifications,
92	    allExecutionEvents,
93	    allSupervisorInterventions,
94	    allQueuedMessages,
95	    allRecoveryIncidents,
96	    allReviewRuns,
97	    allReviewRounds,
98	    allReviewFindings,
99	    allProcessSessions,
100	    allReadMarkers,
101	  ] = await Promise.all([
102	    selectedRunId
103	      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
104	      : [],
105	    db.select().from(accounts),
106	    db.select({
107	      id: workers.id,
108	      runId: workers.runId,
109	      type: workers.type,
110	      status: workers.status,
111	      workerNumber: workers.workerNumber,
112	      title: workers.title,
113	      initialPrompt: workers.initialPrompt,
114	      createdAt: workers.createdAt,
115	      updatedAt: workers.updatedAt,
116	    }).from(workers).where(visibleRunIds.length > 0 ? inArray(workers.runId, visibleRunIds) : eq(workers.id, "__none__")).orderBy(asc(workers.runId), asc(workers.createdAt), asc(workers.id)),
117	    selectedRunId
118	      ? db.select({
119	        id: workers.id,
120	        runId: workers.runId,
121	        type: workers.type,
122	        status: workers.status,
123	        cwd: workers.cwd,
124	        outputLog: workers.outputLog,
125	        currentText: workers.currentText,
126	        lastText: workers.lastText,
127	        bridgeSessionId: workers.bridgeSessionId,
128	        bridgeSessionMode: workers.bridgeSessionMode,
129	        workerNumber: workers.workerNumber,
130	        title: workers.title,
131	        initialPrompt: workers.initialPrompt,
132	        activeWorkStartedAt: workers.activeWorkStartedAt,
133	        activeWorkDurationMs: workers.activeWorkDurationMs,
134	        createdAt: workers.createdAt,
135	        updatedAt: workers.updatedAt,
136	      }).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
137	      : [],
138	    selectedPlanId
139	      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
140	      : [],
141	    selectedRunId
142	      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt), desc(clarifications.id))
143	      : [],
144	    selectedRunId
145	      ? listExecutionEventsForSnapshot(selectedRunId, EXECUTION_EVENT_LIMIT)
146	      : [],
147	    selectedRunId
148	      ? listSupervisorInterventionsForSnapshot(selectedRunId, SUPERVISOR_INTERVENTION_LIMIT)
149	      : [],
150	    selectedRunId
151	      ? db.select().from(queuedConversationMessages)
152	        .where(and(
153	          eq(queuedConversationMessages.runId, selectedRunId),
154	          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
155	        ))
156	        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
157	      : [],
158	    selectedRunId
159	      ? db.select().from(recoveryIncidents)
160	        .where(eq(recoveryIncidents.runId, selectedRunId))
161	        .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
162	        .limit(20)
163	      : [],
164	    selectedRunId
165	      ? db.select().from(planningReviewRuns).where(eq(planningReviewRuns.runId, selectedRunId)).orderBy(desc(planningReviewRuns.createdAt), desc(planningReviewRuns.id))
166	      : [],
167	    selectedRunId
168	      ? db.select().from(planningReviewRounds).where(eq(planningReviewRounds.runId, selectedRunId)).orderBy(asc(planningReviewRounds.roundNumber))
169	      : [],
170	    selectedRunId
171	      ? listPlanningReviewFindingsForSnapshot(selectedRunId, PLANNING_REVIEW_FINDING_LIMIT)
172	      : [],
173	    db.select().from(processSessions),
174	    db.select().from(conversationReadMarkers).where(visibleRunIds.length > 0 ? inArray(conversationReadMarkers.runId, visibleRunIds) : eq(conversationReadMarkers.runId, "__none__")),
175	  ]);
176	  probe?.mark("q.parallel15");
177	
178	  return {
179	    msgs,
180	    allPlans,
181	    allRuns,
182	    allAccounts,
183	    allWorkers,
184	    selectedAgentWorkers,
185	    allPlanItems,
186	    allClarifications,
187	    allExecutionEvents,
188	    allSupervisorInterventions,
189	    allQueuedMessages,
190	    allRecoveryIncidents,
191	    allReviewRuns,
192	    allReviewRounds,
193	    allReviewFindings,
194	    allProcessSessions,
195	    allReadMarkers,
196	  };
197	}
198	
199	
200	type EventPayloadOptions = {
201	  selectedRunId?: string | null;
202	};
203	
204	type PersistedEventRecords = Awaited<ReturnType<typeof readPersistedEventRecords>>;
205	type EventPayload = ReturnType<typeof buildEventPayload>;
206	
207	const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
208	const AGENT_TEXT_FIELD_LIMIT = 4_000;
209	const EXECUTION_EVENT_DETAIL_LIMIT = 1_000;
210	const SUPERVISOR_INTERVENTION_TEXT_LIMIT = 2_000;
211	
212	function truncateText(value: string | null | undefined, limit: number) {
213	  if (!value || value.length <= limit) {
214	    return value ?? "";
215	  }
216	
217	  return `${value.slice(0, limit)}
218	
219	[Truncated ${value.length - limit} characters in live payload]`;
220	}
221	
222	function compactWorkerRecord(worker: PersistedEventRecords["allWorkers"][number]) {
223	  return {
224	    id: worker.id,
225	    runId: worker.runId,
226	    type: worker.type,
227	    status: worker.status,
228	    workerNumber: worker.workerNumber,
229	    title: worker.title,
230	    initialPrompt: truncateText(worker.initialPrompt, WORKER_INITIAL_PROMPT_PREVIEW_LIMIT),
231	    createdAt: worker.createdAt,
232	    updatedAt: worker.updatedAt,
233	  };
234	}
235	
236	function selectedRunWorkers(
237	  records: PersistedEventRecords,
238	  options: EventPayloadOptions,
239	) {
240	  const selectedRunId = resolveVisibleSelectedRunId(records, options);
241	  if (!selectedRunId) {
242	    return [];
243	  }
244	
245	  return records.selectedAgentWorkers;
246	}
247	
248	function resolveVisibleSelectedRunId(records: PersistedEventRecords, options: EventPayloadOptions) {
249	  const requested = options.selectedRunId?.trim();
250	  if (!requested) {
251	    return null;
252	  }
253	
254	  return records.allRuns.some((run) => run.id === requested) ? requested : null;
255	}
256	
257	function visibleSelectedRunIds(records: PersistedEventRecords, options: EventPayloadOptions) {
258	  const selectedRunId = resolveVisibleSelectedRunId(records, options);
259	  return selectedRunId ? new Set([selectedRunId]) : null;
260	}
261	
262	function selectedMessageRunIds(records: PersistedEventRecords, options: EventPayloadOptions) {
263	  const selectedRunId = resolveVisibleSelectedRunId(records, options);
264	  if (!selectedRunId) {
265	    return [];
266	  }
267	
268	  const selectedRun = records.allRuns.find((run) => run.id === selectedRunId);
269	  return [
270	    ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
271	    selectedRunId,
272	  ];
273	}
274	
275	function compactExecutionEvent(event: PersistedEventRecords["allExecutionEvents"][number]) {
276	  return {
277	    ...event,
278	    details: compactExecutionEventDetails(event.details),
279	  };
280	}
281	
282	function compactExecutionEventDetails(details: string | null) {
283	  if (!details?.trim()) {
284	    return details ?? null;
285	  }
286	
287	  try {
288	    const parsed = JSON.parse(details) as Record<string, unknown>;
289	    const compacted: Record<string, unknown> = {};
290	
291	    for (const key of [
292	      "summary",
293	      "reason",
294	      "error",
295	      "mode",
296	      "seconds",
297	      "recoveryState",
298	      "recommendedAction",
299	      "resetAt",
300	      "resumeAt",
301	      "scheduledWakeAt",
302	      "quotaResetSource",
303	      "quotaResetConfidence",
304	      "retryAfterMs",
305	      "provider",
306	      "sourceType",
307	      "rawText",
308	    ]) {
309	      const value = parsed[key];
310	      if (typeof value === "string") {
311	        compacted[key] = truncateText(value, EXECUTION_EVENT_DETAIL_LIMIT);
312	      } else if (typeof value === "number") {
313	        compacted[key] = value;
314	      }
315	    }
316	
317	    return Object.keys(compacted).length > 0 ? JSON.stringify(compacted) : "{}";
318	  } catch {
319	    return JSON.stringify({
320	      summary: truncateText(details, EXECUTION_EVENT_DETAIL_LIMIT),
321	    });
322	  }
323	}
324	
325	function compactSupervisorIntervention(intervention: PersistedEventRecords["allSupervisorInterventions"][number]) {
326	  return {
327	    ...intervention,
328	    prompt: truncateText(intervention.prompt, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
329	    summary: truncateText(intervention.summary, SUPERVISOR_INTERVENTION_TEXT_LIMIT),
330	  };
331	}
332	
333	function compactReviewFinding(finding: PersistedEventRecords["allReviewFindings"][number]) {
334	  return {
335	    ...finding,
336	    details: truncateText(finding.details, 2_000),
337	    recommendation: truncateText(finding.recommendation, 2_000),
338	  };
339	}
340	
341	function compactRecoveryIncident(incident: PersistedEventRecords["allRecoveryIncidents"][number]) {
342	  return {
343	    id: incident.id,
344	    runId: incident.runId,
345	    workerId: incident.workerId,
346	    queuedMessageId: incident.queuedMessageId,
347	    kind: incident.kind,
348	    status: incident.status,
349	    autoAttemptCount: incident.autoAttemptCount,
350	    lastError: truncateText(incident.lastError, 2_000),
351	    details: compactExecutionEventDetails(incident.details),
352	    detectedAt: incident.detectedAt,
353	    updatedAt: incident.updatedAt,
354	    resolvedAt: incident.resolvedAt,
355	  };
356	}
357	
358	function deriveRecoveryState(incidents: PersistedEventRecords["allRecoveryIncidents"]) {
359	  const active = incidents.find((incident) => (
360	    incident.status === "open"
361	    || incident.status === "recovering"
362	    || incident.status === "needs_user"
363	    || incident.status === "failed"
364	  ));
365	  if (!active) {
366	    return null;
367	  }
368	
369	  let parsedDetails: Record<string, unknown> = {};
370	  try {
371	    parsedDetails = active.details ? JSON.parse(active.details) as Record<string, unknown> : {};
372	  } catch {
373	    parsedDetails = {};
374	  }
375	
376	  return {
377	    kind: String(parsedDetails.recoveryState ?? active.kind),
378	    status: active.status,
379	    workerId: active.workerId,
380	    queuedMessageId: active.queuedMessageId,
381	    message: typeof parsedDetails.reason === "string" ? parsedDetails.reason : active.lastError,
382	    recommendedAction: String(parsedDetails.recommendedAction ?? (
383	      active.status === "recovering" ? "none" : "manual_resume"
384	    )),
385	    lastError: active.lastError,
386	    attemptCount: active.autoAttemptCount,
387	    nextAttemptAt: typeof parsedDetails.nextAttemptAt === "string" ? parsedDetails.nextAttemptAt : null,
388	    resumeAt: typeof parsedDetails.resumeAt === "string" ? parsedDetails.resumeAt : null,
389	    quotaResetSource: typeof parsedDetails.quotaResetSource === "string" ? parsedDetails.quotaResetSource : null,
390	    quotaResetConfidence: typeof parsedDetails.quotaResetConfidence === "string" ? parsedDetails.quotaResetConfidence : null,
391	    policyDecision: typeof parsedDetails.decision === "string" ? parsedDetails.decision : null,
392	  };
393	}
394	
395	function compactAgentSnapshot(agent: ReturnType<typeof buildLiveWorkerSnapshots>[number]) {
396	  // Worker conversation content (outputEntries) is no longer carried
397	  // on the /api/events snapshot. Clients fetch it via
398	  // /api/workers/:workerId/entries through `WorkerEntriesManager`. The
399	  // agents[] array stays for non-content metadata: state, the
400	  // "thinking…" indicator, bridge-missing flag, last error.
401	  return {
402	    ...agent,
403	    outputEntries: [],
404	    renderedOutput: null,
405	    currentText: truncateText(agent.currentText, AGENT_TEXT_FIELD_LIMIT),
406	    lastText: truncateText(agent.lastText, AGENT_TEXT_FIELD_LIMIT),
407	    outputLog: truncateText(agent.outputLog, AGENT_TEXT_FIELD_LIMIT),
408	    displayText: truncateText(agent.displayText, AGENT_TEXT_FIELD_LIMIT),
409	    stderrBuffer: (agent.stderrBuffer ?? []).slice(-10).map((line) => truncateText(line, 2_000)),
410	  };
411	}
412	
413	async function buildWorkerEntrySeqs(workers: Array<{ id: string; runId: string }>) {
414	  const seqs = await Promise.all(
415	    workers.map(async (worker) => {
416	      const seq = await readWorkerLatestSeq(worker.runId, worker.id);
417	      return seq > 0 ? [worker.id, seq] as const : null;
418	    }),
419	  );
420	  return Object.fromEntries(seqs.filter((seq): seq is readonly [string, number] => Boolean(seq)));
421	}
422	
423	function filterRuntimeAgentsForWorkers(rawAgents: unknown[], scopedWorkers: PersistedEventRecords["allWorkers"]) {
424	  const workerIds = new Set(scopedWorkers.map((worker) => worker.id));
425	  if (workerIds.size === 0) {
426	    return [];
427	  }
428	
429	  return rawAgents.filter((agent) => {
430	    if (typeof agent !== "object" || agent === null) {
431	      return false;
432	    }
433	
434	    const name = (agent as { name?: unknown }).name;
435	    return typeof name === "string" && workerIds.has(name);
436	  });
437	}
438	
439	function buildEventPayload(
440	  records: PersistedEventRecords,
441	  agentsData: ReturnType<typeof buildLiveWorkerSnapshots>,
442	  frontendErrors: AppErrorPayload[] = [],
443	  options: EventPayloadOptions = {},
444	  workerEntrySeqs: Record<string, number> = {},
445	) {
446	  const selectedRunId = resolveVisibleSelectedRunId(records, options);
447	  const runIds = visibleSelectedRunIds(records, options);
448	  const messageRunIds = selectedMessageRunIds(records, options);
449	  const lifecycleErrors = buildAwaitingUserQuestionInvariantErrors({
450	    runs: records.allRuns,
451	    messages: records.msgs,
452	    clarifications: records.allClarifications,
453	    selectedRunId: options.selectedRunId,
454	  });
455	  const processSessionsByRunId = new Map<string, PersistedEventRecords["allProcessSessions"][number]>(
456	    records.allProcessSessions.map((session) => [session.runId, session]),
457	  );
458	  const workersByRunId = new Map<string, PersistedEventRecords["allWorkers"][number]>();
459	  for (const worker of records.allWorkers) {
460	    if (!workersByRunId.has(worker.runId)) {
461	      workersByRunId.set(worker.runId, worker);
462	    }
463	  }
464	  const sessions = records.allRuns.map((run) => serializeSessionRecord({
465	    run,
466	    primaryWorker: workersByRunId.get(run.id) ?? null,
467	    processSession: processSessionsByRunId.get(run.id) ?? null,
468	  }));
469	  const readMarkers = Object.fromEntries(
470	    records.allReadMarkers.map((marker) => [marker.runId, marker.lastReadAt.toISOString()]),
471	  );
472	  // Worker conversation content now lives in the unified worker stream
473	  // (per-worker JSONL, fetched via /api/workers/:workerId/entries). The
474	  // previous `synthesizeStreamingWorkerMessages` path that fabricated
475	  // pseudo-messages from `agent.outputEntries` is gone; clients render
476	  // worker content via `WorkerEntriesManager` instead.
477	  return withEventPayloadChecksum({
478	    messages: records.msgs.map(serializeMessageRecord),
479	    readMarkers,
480	    plans: records.allPlans,
481	    runs: records.allRuns,
482	    sessions,
483	    accounts: records.allAccounts.map(toAccountDto),
484	    agents: agentsData.map(compactAgentSnapshot),
485	    workers: records.allWorkers.map(compactWorkerRecord),
486	    planItems: records.allPlanItems,
487	    clarifications: records.allClarifications,
488	    executionEvents: records.allExecutionEvents
489	      .slice(0, EXECUTION_EVENT_LIMIT)
490	      .map(compactExecutionEvent),
491	    supervisorInterventions: records.allSupervisorInterventions
492	      .map(compactSupervisorIntervention),
493	    queuedMessages: records.allQueuedMessages
494	      .filter((message) => message.status === "pending" || message.status === "delivering")
495	      .map(serializeQueuedConversationMessage),
496	    recoveryIncidents: records.allRecoveryIncidents
497	      .map(compactRecoveryIncident),
498	    recoveryState: runIds && !isTerminalRunStatus(
499	      records.allRuns.find((run) => runIds.has(run.id))?.status,
500	    )
501	      ? deriveRecoveryState(records.allRecoveryIncidents)
502	      : null,
503	    reviewRuns: records.allReviewRuns,
504	    reviewRounds: records.allReviewRounds,
505	    reviewFindings: records.allReviewFindings
506	      .map(compactReviewFinding),
507	    frontendErrors: [...frontendErrors, ...lifecycleErrors],
508	    snapshotRunId: selectedRunId,
509	    messageScope: {
510	      runIds: messageRunIds,
511	      complete: true,
512	    },
513	    // Bounded selected-run collections: list a cursor + completeness
514	    // flag so the UI can distinguish "full transcript loaded" from
515	    // "preview/tail only" and trigger pagination if it wants the rest.
516	    // Artifact-backed payloads MAY be partial; the cursor lets a
517	    // follow-up query request older entries.
518	    snapshotScope: {
519	      catalog: {
520	        complete: true,
521	      },
522	      executionEvents: {
523	        limit: EXECUTION_EVENT_LIMIT,
524	        complete: records.allExecutionEvents.length < EXECUTION_EVENT_LIMIT,
525	        oldestCreatedAt: records.allExecutionEvents.length > 0
526	          ? records.allExecutionEvents[records.allExecutionEvents.length - 1]!.createdAt.toISOString()
527	          : null,
528	      },
529	      supervisorInterventions: {
530	        limit: SUPERVISOR_INTERVENTION_LIMIT,
531	        complete: records.allSupervisorInterventions.length < SUPERVISOR_INTERVENTION_LIMIT,
532	        oldestCreatedAt: records.allSupervisorInterventions.length > 0
533	          ? records.allSupervisorInterventions[records.allSupervisorInterventions.length - 1]!.createdAt.toISOString()
534	          : null,
535	      },
536	      planningReviewFindings: {
537	        limit: PLANNING_REVIEW_FINDING_LIMIT,
538	        complete: records.allReviewFindings.length < PLANNING_REVIEW_FINDING_LIMIT,
539	        oldestCreatedAt: records.allReviewFindings.length > 0
540	          ? records.allReviewFindings[records.allReviewFindings.length - 1]!.createdAt.toISOString()
541	          : null,
542	      },
543	    },
544	    workerEntrySeqs,
545	  });
546	}
547	
548	async function buildPersistedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
549	  const records = await readPersistedEventRecords(options, probe);
550	  probe?.mark("readRecords.total");
551	  const scopedWorkers = selectedRunWorkers(records, options);
552	  const workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
553	  probe?.mark(`workerSeqs[${scopedWorkers.length}]`);
554	  const payload = buildEventPayload(
555	    records,
556	    buildLiveWorkerSnapshots({
557	      workers: scopedWorkers,
558	      runs: records.allRuns,
559	    }),
560	    undefined,
561	    options,
562	    workerEntrySeqs,
563	  );
564	  probe?.mark("buildPayload");
565	  return payload;
566	}
567	
568	type EventPayloadCacheEntry = {
569	  version: number;
570	  promise: Promise<EventPayload>;
571	};
572	
573	const cachedPersistedPayloads = new Map<string, EventPayloadCacheEntry>();
574	const cachedRuntimePayloads = new Map<string, EventPayloadCacheEntry>();
575	
576	export function __clearEventPayloadCachesForTests() {
577	  cachedPersistedPayloads.clear();
578	  cachedRuntimePayloads.clear();
579	}
580	
581	function eventPayloadCacheKey(options: EventPayloadOptions = {}) {
582	  return options.selectedRunId?.trim() || "__all__";
583	}
584	
585	function shareInFlightEventPayload(
586	  cache: Map<string, EventPayloadCacheEntry>,
587	  options: EventPayloadOptions,
588	  build: () => Promise<EventPayload>,
589	) {
590	  const key = eventPayloadCacheKey(options);
591	  const version = getEventStreamNotificationVersion();
592	  const existing = cache.get(key);
593	  if (existing?.version === version) {
594	    return existing.promise;
595	  }
596	
597	  const pending = build().catch((error) => {
598	    const cached = cache.get(key);
599	    if (cached?.promise === pending) {
600	      cache.delete(key);
601	    }
602	    throw error;
603	  });
604	  cache.set(key, { version, promise: pending });
605	  pruneEventPayloadCache(cache);
606	  return pending;
607	}
608	
609	function pruneEventPayloadCache(cache: Map<string, EventPayloadCacheEntry>) {
610	  while (cache.size > EVENT_PAYLOAD_CACHE_LIMIT) {
611	    const oldestKey = cache.keys().next().value;
612	    if (!oldestKey) {
613	      return;
614	    }
615	    cache.delete(oldestKey);
616	  }
617	}
618	
619	function buildSharedPersistedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
620	  return shareInFlightEventPayload(
621	    cachedPersistedPayloads,
622	    options,
623	    () => buildPersistedEventPayload(options, probe),
624	  );
625	}
626	
627	async function buildRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
628	  let records = await readPersistedEventRecords(options, probe);
629	  probe?.mark("readRecords#1.total");
630	  let scopedWorkers = selectedRunWorkers(records, options);
631	  let workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
632	  probe?.mark(`workerSeqs#1[${scopedWorkers.length}]`);
633	  let agentsData = buildLiveWorkerSnapshots({
634	    workers: scopedWorkers,
635	    runs: records.allRuns,
636	  });
637	  const frontendErrors: AppErrorPayload[] = [];
638	
639	  try {
640	    const res = await fetchWithTimeout(`${BRIDGE_URL}/agents`, RUNTIME_AGENT_TIMEOUT_MS);
641	    probe?.mark("bridge.fetch");
642	    if (res.ok) {
643	      const rawAgentsPayload = await res.json();
644	      const rawAgents = Array.isArray(rawAgentsPayload) ? rawAgentsPayload : [];
645	      const { syncConversationSessions } = await import("@/server/conversations/sync");
646	      await syncConversationSessions(rawAgents, {
647	        selectedRunId: options.selectedRunId,
648	        refreshPlanningArtifacts: false,
649	      });
650	      probe?.mark("bridge.sync");
651	      // Second reconciliation pass — this one knows what's actually in
652	      // the bridge, so it can detect workers that were "working" when
653	      // the bridge died and are now stranded with no live agent. The
654	      // earlier pass (inside readPersistedEventRecords) couldn't see
655	      // this because it ran before we fetched the bridge agent list.
656	      const bridgeAgentNames = new Set<string>();
657	      for (const agent of rawAgents) {
658	        if (typeof agent === "object" && agent !== null) {
659	          const name = (agent as { name?: unknown }).name;
660	          if (typeof name === "string" && name.length > 0) {
661	            bridgeAgentNames.add(name);
662	          }
663	        }
664	      }
665	      await reconcilePersistedReloadZombies({
666	        selectedRunId: options.selectedRunId,
667	        source: "events-snapshot-post-bridge",
668	        bridgeAgentNames,
669	      });
670	      probe?.mark("reconcile.bridge-orphans");
671	      records = await readPersistedEventRecords(options);
672	      probe?.mark("readRecords#2.total");
673	      scopedWorkers = selectedRunWorkers(records, options);
674	      workerEntrySeqs = await buildWorkerEntrySeqs(scopedWorkers);
675	      probe?.mark(`workerSeqs#2[${scopedWorkers.length}]`);
676	      agentsData = buildLiveWorkerSnapshots({
677	        agents: filterRuntimeAgentsForWorkers(rawAgents, scopedWorkers),
678	        workers: scopedWorkers,
679	        runs: records.allRuns,
680	      });
681	    } else {
682	      const bridgeError = new Error(`Agent runtime list request failed with status ${res.status}.`);
683	      agentsData = buildLiveWorkerSnapshots({
684	        workers: scopedWorkers,
685	        runs: records.allRuns,
686	        bridgeError,
687	      });
688	      if (!isTransientSupervisorError(bridgeError)) {
689	        frontendErrors.push(buildAppError(
690	          bridgeError,
691	          {
692	            source: "Agent runtime",
693	            action: "Stream live agent state",
694	          },
695	        ));
696	      }
697	    }
698	  } catch (error) {
699	    agentsData = buildLiveWorkerSnapshots({
700	      workers: scopedWorkers,
701	      runs: records.allRuns,
702	      bridgeError: error,
703	    });
704	    if (!isTransientSupervisorError(error)) {
705	      frontendErrors.push(buildAppError(error, {
706	        source: "Agent runtime",
707	        action: "Stream live agent state",
708	      }));
709	    }
710	  }
711	
712	  return buildEventPayload(records, agentsData, frontendErrors, options, workerEntrySeqs);
713	}
714	
715	function buildSharedRuntimeEnrichedEventPayload(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
716	  return shareInFlightEventPayload(
717	    cachedRuntimePayloads,
718	    options,
719	    () => buildRuntimeEnrichedEventPayload(options, probe),
720	  );
721	}
722	
723	function delay(ms: number) {
724	  return new Promise<void>((resolve) => setTimeout(resolve, ms));
725	}
726	
727	function parseLastEventId(raw: string | null | undefined): number | null {
728	  if (!raw) {
729	    return null;
730	  }
731	  const trimmed = raw.trim();
732	  if (!trimmed) {
733	    return null;
734	  }
735	  const parsed = Number.parseInt(trimmed, 10);
736	  if (!Number.isFinite(parsed) || parsed < 0) {
737	    return null;
738	  }
739	  return parsed;
740	}
741	
742	export const handleEventsRequest: OmniHttpHandler = async (request) => {
743	  const url = new URL(request.url);
744	  const isSnapshot = url.searchParams.get("snapshot") === "1";
745	  const persistedOnly = url.searchParams.get("persisted") === "1";
746	  const probe = isSnapshot
747	    ? startSlowProbe(`GET /api/events?snapshot=1${persistedOnly ? "&persisted=1" : ""}${url.searchParams.get("runId") ? `&runId=${url.searchParams.get("runId")}` : ""}`)
748	    : null;
749	  const auth = await requireApiSession(toNextRequest(request), {
750	    source: "Events",
751	    action: "Stream live updates",
752	  });
753	  probe?.mark("auth");
754	  if (auth.response) {
755	    probe?.end();
756	    return auth.response;
757	  }
758	
759	  const eventPayloadOptions = {
760	    selectedRunId: url.searchParams.get("runId"),
761	  } satisfies EventPayloadOptions;
762	
763	  if (isSnapshot) {
764	    const payload = persistedOnly
765	      ? await buildSharedPersistedEventPayload(eventPayloadOptions, probe ?? undefined)
766	      : await (async () => {
767	        const { ensureSupervisorRuntimeStarted } = await import("@/server/supervisor/runtime-watchdog");
768	        await ensureSupervisorRuntimeStarted();
769	        probe?.mark("ensureSupervisor");
770	        return buildSharedRuntimeEnrichedEventPayload(eventPayloadOptions, probe ?? undefined);
771	      })();
772	    probe?.mark("payload.total");
773	    const requestedChecksum = url.searchParams.get("checksum")?.trim() || "";
774	
775	    // Anchor the snapshot to the current cursor so a subsequent SSE
776	    // connection can pass `Last-Event-ID: <lastEventId>` (or
777	    // `?lastEventId=`) and receive only events newer than this body.
778	    // Exposed as a response header to avoid changing the JSON shape
779	    // that the UI consumes.
780	    const response = Response.json(
781	      requestedChecksum && requestedChecksum === payload.snapshotChecksum
782	        ? {
783	          notModified: true,
784	          snapshotChecksum: payload.snapshotChecksum,
785	          workerEntrySeqs: payload.workerEntrySeqs,
786	        }
787	        : payload,
788	    );
789	    response.headers.set("x-omni-last-event-id", String(getEventCursor()));
790	    if (payload.snapshotChecksum) {
791	      response.headers.set("x-omni-snapshot-checksum", payload.snapshotChecksum);
792	    }
793	    probe?.end();
794	    return response;
795	  }
796	
797	  const { ensureSupervisorRuntimeStarted } = await import("@/server/supervisor/runtime-watchdog");
798	  await ensureSupervisorRuntimeStarted();
799	
800	  const lastEventIdHeader = request.headers.get("last-event-id");
801	  const resumeFromHeader = parseLastEventId(lastEventIdHeader);
802	  const resumeFromQuery = parseLastEventId(url.searchParams.get("lastEventId"));
803	  const resumeFromId = resumeFromHeader ?? resumeFromQuery;
804	  const runIdScope = eventPayloadOptions.selectedRunId ?? null;
805	
806	  let streamClosed = false;
807	  const stream = new ReadableStream({
808	    async start(controller) {
809	      const encoder = new TextEncoder();
810	      let lastUpdatePayload = "";
811	      // Cursor tracking the highest id we've already streamed to this
812	      // client; used to drain only newly-buffered named events on each
813	      // poll iteration without re-emitting events we already replayed.
814	      let lastDeliveredId = resumeFromId ?? getEventCursor();
815	
816	      const writeFrame = (id: number | null, event: string, serializedData: string) => {
817	        try {
818	          const idLine = id === null ? "" : `id: ${id}\n`;
819	          controller.enqueue(encoder.encode(`${idLine}event: ${event}\ndata: ${serializedData}\n\n`));
820	        } catch {
821	          // Stream might be closed
822	        }
823	      };
824	      // eslint-disable-next-line @typescript-eslint/no-explicit-any
825	      const sendEvent = (event: string, data: any, id: number | null = null) => {
826	        writeFrame(id, event, JSON.stringify(data));
827	      };
828	      const sendHeartbeat = () => {
829	        try {
830	          controller.enqueue(encoder.encode(": heartbeat\n\n"));
831	        } catch {
832	          // Stream might be closed
833	        }
834	      };
835	      const drainBufferedEvents = (options: { throughId?: number | null } = {}) => {
836	        const replay = getNamedEventsSince(lastDeliveredId, {
837	          runId: runIdScope,
838	          throughId: options.throughId,
839	        });
840	        if (replay.resyncRequired) {
841	          // Anchor the resync frame to the current cursor so the
842	          // client's resume position advances; without an id, the
843	          // next reconnect would replay this same control message.
844	          sendEvent("stream.resync_required", { reason: "id_out_of_buffer" }, replay.lastEventId);
845	          lastDeliveredId = replay.lastEventId;
846	          return;
847	        }
848	        for (const entry of replay.events) {
849	          if (entry.event.kind === "snapshot.marker") {
850	            continue;
851	          }
852	          writeFrame(entry.id, entry.event.kind, JSON.stringify(entry.event));
853	          lastDeliveredId = entry.id;
854	        }
855	      };
856	      const sendUpdateIfChanged = (payload: Awaited<ReturnType<typeof buildPersistedEventPayload>>) => {
857	        const serializedPayload = JSON.stringify(payload);
858	        if (serializedPayload === lastUpdatePayload) {
859	          sendHeartbeat();
860	          return;
861	        }
862	
863	        // Flush any named events that landed in the ring *during* the
864	        // snapshot build before allocating the marker id. Without this,
865	        // the marker's id would leapfrog those events and the next
866	        // drain (which uses lastDeliveredId = marker.id) would treat
867	        // them as already-delivered, silently dropping them.
868	        drainBufferedEvents();
869	
870	        lastUpdatePayload = serializedPayload;
871	        const version = getEventStreamNotificationVersion();
872	        const marker = recordSnapshotMarker(version, runIdScope);
873	        // A named event can still land in the tiny window between the
874	        // pre-marker drain above and marker allocation. Drain only up
875	        // through the id immediately before the marker, then let the
876	        // snapshot frame advance the client to the marker id. Events
877	        // emitted after the marker are delivered by the post-snapshot
878	        // drain below, preserving monotonic SSE ids.
879	        drainBufferedEvents({ throughId: marker.id - 1 });
880	        lastDeliveredId = marker.id;
881	        writeFrame(marker.id, "update", serializedPayload);
882	      };
883	
884	      request.signal.addEventListener("abort", () => {
885	        streamClosed = true;
886	      });
887	
888	      // Replay any events the client missed during disconnect. If their
889	      // last id has fallen out of the ring, the resync event tells the
890	      // client to re-bootstrap from /api/events?snapshot=1.
891	      if (resumeFromId !== null) {
892	        drainBufferedEvents();
893	      }
894	
895	      let notificationVersionAtStart = getEventStreamNotificationVersion();
896	      while (!streamClosed) {
897	        try {
898	          notificationVersionAtStart = getEventStreamNotificationVersion();
899	          drainBufferedEvents();
900	          const runtimePayloadPromise = buildSharedRuntimeEnrichedEventPayload(eventPayloadOptions);
901	          const runtimePayload = await Promise.race([
902	            runtimePayloadPromise,
903	            delay(RUNTIME_AGENT_GRACE_MS).then(() => null),
904	          ]);
905	
906	          if (runtimePayload) {
907	            sendUpdateIfChanged(runtimePayload);
908	          } else {
909	            sendUpdateIfChanged(await buildSharedPersistedEventPayload(eventPayloadOptions));
910	            const enrichedPayload = await runtimePayloadPromise;
911	            if (!streamClosed) {
912	              sendUpdateIfChanged(enrichedPayload);
913	            }
914	          }
915	          // Named events emitted during snapshot construction must be
916	          // flushed before we park; otherwise a worker.* event fired
917	          // mid-build would wait an entire idle cycle to reach the
918	          // client.
919	          drainBufferedEvents();
920	        } catch (e) {
921	          console.error("SSE Poll Error", e);
922	          sendEvent("update_error", buildAppError(e, {
923	            source: "Events",
924	            action: "Stream live updates",
925	          }));
926	        }
927	
928	        if (!streamClosed) {
929	          while (!streamClosed) {
930	            const waitResult = await waitForEventStreamNotification(STREAM_REFRESH_INTERVAL_MS, notificationVersionAtStart);
931	            if (waitResult.notified) {
932	              break;
933	            }
934	            sendHeartbeat();
935	          }
936	        }
937	      }
938	    },
939	    cancel() {
940	      streamClosed = true;
941	    },
942	  });
943	
944	  return new Response(stream, {
945	    headers: {
946	      "Content-Type": "text/event-stream",
947	      "Cache-Control": "no-cache",
948	      "Connection": "keep-alive",
949	    },
950	  });
951	};
952	

uuid: b81a083e-1560-4056-bae7-ac98a54712b6
parent: fff1eb3a-46fb-408f-a0a7-0e369b51bd8c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:06:07.650Z","phase":null} -->
## Claude thinking · 2026-07-11T12:06:07.650Z



uuid: 1dbc04ef-0f13-4835-b06b-774fe48a82c3
parent: b81a083e-1560-4056-bae7-ac98a54712b6

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:09.107Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:06:09.107Z

```json
{
  "pattern": "function emitNamedEvent|notifyEventStreamSubscribers",
  "path": "/Users/masterman/NLP/omniharness/src/server/events/named-events.ts",
  "-n": true,
  "-A": 10
}

uuid: 7d8a169f-952b-4bfc-8adb-3ff5e28af892
parent: 1dbc04ef-0f13-4835-b06b-774fe48a82c3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:09.145Z","phase":null} -->
## Claude tool result: toolu_017ewQ6gQBTuUJxV9rn5r8zk · 2026-07-11T12:06:09.145Z

```text
Found 1 file
src/server/events/named-events.ts

uuid: 88dd4e2b-a81f-4076-9530-f17e87893931
parent: 7d8a169f-952b-4bfc-8adb-3ff5e28af892
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:09.838Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:06:09.838Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/tests/conversations/direct-run-status.test.ts"
}

uuid: 561d3a4a-2811-4cc6-810b-4927849cc8e1
parent: 88dd4e2b-a81f-4076-9530-f17e87893931
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:09.853Z","phase":null} -->
## Claude tool result: toolu_01131qjSgTfV767ej7NFCq2D · 2026-07-11T12:06:09.853Z

```text
1	import { beforeEach, describe, expect, it, vi } from "vitest";
2	import { db } from "@/server/db";
3	import { plans, runs } from "@/server/db/schema";
4	
5	const { mockRunMilestoneAutoCommit } = vi.hoisted(() => ({
6	  mockRunMilestoneAutoCommit: vi.fn(),
7	}));
8	
9	vi.mock("@/server/git/run-auto-commit", () => ({
10	  runMilestoneAutoCommit: mockRunMilestoneAutoCommit,
11	}));
12	
13	import {
14	  directWorkerOutputHasPendingHumanInput,
15	  resolveDirectRunStatusFromWorkerOutput,
16	  updateDirectRunStatusFromWorkerOutput,
17	} from "@/server/conversations/direct-run-status";
18	
19	describe("directWorkerOutputHasPendingHumanInput", () => {
20	  beforeEach(async () => {
21	    mockRunMilestoneAutoCommit.mockReset();
22	    await db.delete(runs);
23	    await db.delete(plans);
24	  });
25	
26	  it("does not treat quoted product copy as a request for user input", () => {
27	    expect(directWorkerOutputHasPendingHumanInput({
28	      currentText: "I replaced the empty-state heading with a translated \"What shall we build, Network School?\" line and the logo above it.",
29	    })).toBe(false);
30	  });
31	
32	  it("does not infer pending input from prose requests", () => {
33	    expect(directWorkerOutputHasPendingHumanInput({
34	      currentText: "Before I proceed, please confirm which approach you want.",
35	    })).toBe(false);
36	  });
37	
38	  it("does not treat optional post-completion follow-up as blocking input", () => {
39	    expect(directWorkerOutputHasPendingHumanInput({
40	      currentText: [
41	        "Done. The modified files are grouped into three logical commits and pushed to `origin/master`.",
42	        "Let me know if you actually want either committed or added to `.gitignore`.",
43	      ].join("\n"),
44	    })).toBe(false);
45	  });
46	
47	  it("detects structured pending human input only", () => {
48	    expect(directWorkerOutputHasPendingHumanInput({
49	      outputEntries: [
50	        { type: "elicitation", status: "pending", text: "Question for user" },
51	      ],
52	    })).toBe(true);
53	    expect(directWorkerOutputHasPendingHumanInput({
54	      outputEntries: [
55	        { type: "permission", status: "pending", text: "Permission requested", raw: { requestId: 64 } },
56	        { type: "permission", status: "approved", text: "Permission approved", raw: { requestId: 64 } },
57	      ],
58	    })).toBe(false);
59	    expect(directWorkerOutputHasPendingHumanInput({
60	      outputEntries: [
61	        { type: "permission", status: "approved", text: "Permission approved" },
62	      ],
63	    })).toBe(false);
64	    expect(directWorkerOutputHasPendingHumanInput({
65	      pendingElicitations: [{ requestId: 1 }],
66	    })).toBe(true);
67	  });
68	
69	  it("keeps active direct workers running after structured input is answered", () => {
70	    expect(resolveDirectRunStatusFromWorkerOutput({
71	      workerStatus: "working",
72	      outputEntries: [
73	        {
74	          type: "elicitation",
75	          status: "pending",
76	          text: "Question for user",
77	          raw: { requestId: 2 },
78	        },
79	        {
80	          type: "elicitation",
81	          status: "answered",
82	          text: "Question answered",
83	          raw: { requestId: 2 },
84	        },
85	        {
86	          type: "tool_call",
87	          status: "pending",
88	          text: "Read File",
89	        },
90	      ],
91	    })).toBe("running");
92	  });
93	
94	  it("runs milestone auto-commit when a direct run finishes", async () => {
95	    const now = new Date();
96	    await db.insert(plans).values({
97	      id: "plan-direct-auto-commit",
98	      path: "vibes/ad-hoc/direct-auto-commit.md",
99	      status: "running",
100	      createdAt: now,
101	      updatedAt: now,
102	    });
103	    await db.insert(runs).values({
104	      id: "run-direct-auto-commit",
105	      planId: "plan-direct-auto-commit",
106	      mode: "direct",
107	      projectPath: "/workspace/app",
108	      title: "Direct change",
109	      status: "running",
110	      autoCommitMilestones: true,
111	      pushOnCommit: true,
112	      gitBaselineJson: JSON.stringify({ status: "not_git", reason: "test baseline" }),
113	      createdAt: now,
114	      updatedAt: now,
115	    });
116	
117	    await updateDirectRunStatusFromWorkerOutput({
118	      runId: "run-direct-auto-commit",
119	      workerId: "worker-1",
120	      responseText: "Done.",
121	    });
122	
123	    expect(mockRunMilestoneAutoCommit).toHaveBeenCalledWith("run-direct-auto-commit", "Done.");
124	  });
125	
126	  it("preserves the run activity timestamp when repeated input observations do not change state", async () => {
127	    const originalUpdatedAt = new Date("2026-07-11T10:00:00.000Z");
128	    await db.insert(plans).values({
129	      id: "plan-direct-awaiting-noop",
130	      path: "vibes/ad-hoc/direct-awaiting-noop.md",
131	      status: "running",
132	      createdAt: originalUpdatedAt,
133	      updatedAt: originalUpdatedAt,
134	    });
135	    await db.insert(runs).values({
136	      id: "run-direct-awaiting-noop",
137	      planId: "plan-direct-awaiting-noop",
138	      mode: "direct",
139	      title: "Direct awaiting no-op",
140	      status: "awaiting_user",
141	      createdAt: originalUpdatedAt,
142	      updatedAt: originalUpdatedAt,
143	    });
144	
145	    await updateDirectRunStatusFromWorkerOutput({
146	      runId: "run-direct-awaiting-noop",
147	      workerId: "worker-1",
148	      workerStatus: "working",
149	      pendingElicitations: [{ requestId: 2 }],
150	    });
151	
152	    const run = await db.select().from(runs).where(eq(runs.id, "run-direct-awaiting-noop")).get();
153	    expect(run?.status).toBe("awaiting_user");
154	    expect(run?.updatedAt).toEqual(originalUpdatedAt);
155	  });
156	});
157	

uuid: 7acb57de-fc03-424a-ad3a-dd3bdf7172ec
parent: 561d3a4a-2811-4cc6-810b-4927849cc8e1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:09.921Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:06:09.921Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/tests/lib/conversation-state.test.ts"
}

uuid: 3ce278ea-79f1-4f2d-be87-098fca753215
parent: 7acb57de-fc03-424a-ad3a-dd3bdf7172ec
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:09.928Z","phase":null} -->
## Claude tool result: toolu_01PxeE5cpUJ4yA3gnPsMmAVU · 2026-07-11T12:06:09.928Z

```text
1	import { describe, expect, it } from "vitest";
2	import { getRunLatestMessageTimestamp, getRunLatestUnreadTimestamp, isRunUnread } from "@/lib/conversation-state";
3	
4	describe("conversation-state helpers", () => {
5	  it("returns the latest message timestamp for a run", () => {
6	    const latest = getRunLatestMessageTimestamp("run-1", [
7	      { runId: "run-1", createdAt: "2026-04-20T10:00:00.000Z" },
8	      { runId: "run-2", createdAt: "2026-04-20T11:00:00.000Z" },
9	      { runId: "run-1", createdAt: "2026-04-20T12:00:00.000Z" },
10	    ]);
11	
12	    expect(latest).toBe("2026-04-20T12:00:00.000Z");
13	  });
14	
15	  it("treats a run as unread when there are newer messages than the last read marker", () => {
16	    expect(
17	      isRunUnread({
18	        latestMessageAt: "2026-04-20T12:00:00.000Z",
19	        lastReadAt: "2026-04-20T11:00:00.000Z",
20	      })
21	    ).toBe(true);
22	  });
23	
24	  it("treats a run as read when the last read marker is current", () => {
25	    expect(
26	      isRunUnread({
27	        latestMessageAt: "2026-04-20T12:00:00.000Z",
28	        lastReadAt: "2026-04-20T12:00:00.000Z",
29	      })
30	    ).toBe(false);
31	  });
32	
33	  it("uses completed run updates as unread activity when no worker message row is written", () => {
34	    const latest = getRunLatestUnreadTimestamp(
35	      {
36	        id: "run-1",
37	        status: "done",
38	        createdAt: "2026-04-20T09:00:00.000Z",
39	        updatedAt: "2026-04-20T12:30:00.000Z",
40	      },
41	      [
42	        { runId: "run-1", createdAt: "2026-04-20T12:00:00.000Z" },
43	      ],
44	    );
45	
46	    expect(latest).toBe("2026-04-20T12:30:00.000Z");
47	  });
48	
49	  it("keeps running run unread activity tied to messages instead of sync churn", () => {
50	    const latest = getRunLatestUnreadTimestamp(
51	      {
52	        id: "run-1",
53	        status: "running",
54	        createdAt: "2026-04-20T09:00:00.000Z",
55	        updatedAt: "2026-04-20T12:30:00.000Z",
56	      },
57	      [
58	        { runId: "run-1", createdAt: "2026-04-20T12:00:00.000Z" },
59	      ],
60	    );
61	
62	    expect(latest).toBe("2026-04-20T12:00:00.000Z");
63	  });
64	});
65	

uuid: adf1cde1-0889-4b7a-8e9e-75573e1db03a
parent: 3ce278ea-79f1-4f2d-be87-098fca753215
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:06:09.952Z","phase":null} -->
## Claude attachment · 2026-07-11T12:06:09.952Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: 7cf010e7-0c8d-4675-89d6-4f31aadc117c
parent: adf1cde1-0889-4b7a-8e9e-75573e1db03a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:06:26.133Z","phase":null} -->
## Claude thinking · 2026-07-11T12:06:26.133Z



uuid: 2751883b-4890-41da-97dc-8750a68a4b8e
parent: 7cf010e7-0c8d-4675-89d6-4f31aadc117c

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:27.565Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:27.565Z

```json
{
  "command": "git status --porcelain -- tests/conversations/direct-run-status.test.ts src/server/conversations/direct-run-status.ts src/lib/conversation-state.ts tests/lib/conversation-state.test.ts src/runtime/http/routes/runs.ts src/server/conversations/sync.ts src/app/home/useRunSelectionEffects.ts"
}

uuid: 06199fc2-e8d5-4a63-9ee9-a2e894caaf0b
parent: 2751883b-4890-41da-97dc-8750a68a4b8e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:28.044Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:28.044Z

```json
{
  "command": "git diff -- tests/conversations/direct-run-status.test.ts src/server/conversations/direct-run-status.ts"
}

uuid: 1d5f9c60-f415-40d4-9739-2798bdbf4090
parent: 06199fc2-e8d5-4a63-9ee9-a2e894caaf0b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:28.093Z","phase":null} -->
## Claude tool result: toolu_01StyMg3Psr1x4fs1BJubG65 · 2026-07-11T12:06:28.093Z

```text
 M src/app/home/useRunSelectionEffects.ts
 M src/runtime/http/routes/runs.ts
 M src/server/conversations/sync.ts
 M tests/conversations/direct-run-status.test.ts

uuid: 6a5d74ec-13d3-4c15-9c8a-4a5873abd870
parent: 06199fc2-e8d5-4a63-9ee9-a2e894caaf0b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:28.094Z","phase":null} -->
## Claude tool result: toolu_01TURBGgDwdubsFBPQegAYGz · 2026-07-11T12:06:28.094Z

```text
diff --git a/tests/conversations/direct-run-status.test.ts b/tests/conversations/direct-run-status.test.ts
index 5255e6f..b0c29d0 100644
--- a/tests/conversations/direct-run-status.test.ts
+++ b/tests/conversations/direct-run-status.test.ts
@@ -1,4 +1,5 @@
 import { beforeEach, describe, expect, it, vi } from "vitest";
+import { eq } from "drizzle-orm";
 import { db } from "@/server/db";
 import { plans, runs } from "@/server/db/schema";
 
@@ -122,4 +123,35 @@ describe("directWorkerOutputHasPendingHumanInput", () => {
 
     expect(mockRunMilestoneAutoCommit).toHaveBeenCalledWith("run-direct-auto-commit", "Done.");
   });
+
+  it("preserves the run activity timestamp when repeated input observations do not change state", async () => {
+    const originalUpdatedAt = new Date("2026-07-11T10:00:00.000Z");
+    await db.insert(plans).values({
+      id: "plan-direct-awaiting-noop",
+      path: "vibes/ad-hoc/direct-awaiting-noop.md",
+      status: "running",
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+    await db.insert(runs).values({
+      id: "run-direct-awaiting-noop",
+      planId: "plan-direct-awaiting-noop",
+      mode: "direct",
+      title: "Direct awaiting no-op",
+      status: "awaiting_user",
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+
+    await updateDirectRunStatusFromWorkerOutput({
+      runId: "run-direct-awaiting-noop",
+      workerId: "worker-1",
+      workerStatus: "working",
+      pendingElicitations: [{ requestId: 2 }],
+    });
+
+    const run = await db.select().from(runs).where(eq(runs.id, "run-direct-awaiting-noop")).get();
+    expect(run?.status).toBe("awaiting_user");
+    expect(run?.updatedAt).toEqual(originalUpdatedAt);
+  });
 });

uuid: 42a47fa5-7cfc-418b-b514-7b3df096e09c
parent: 1d5f9c60-f415-40d4-9739-2798bdbf4090
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:06:31.735Z","phase":null} -->
## Claude thinking · 2026-07-11T12:06:31.735Z



uuid: 97d210c8-1583-4994-bf05-d07fea3c7273
parent: 42a47fa5-7cfc-418b-b514-7b3df096e09c

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:32.005Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:32.005Z

```json
{
  "command": "git diff -- src/app/home/useRunSelectionEffects.ts src/runtime/http/routes/runs.ts src/server/conversations/sync.ts"
}

uuid: f36216f5-104c-4e1f-bfa3-7c25d865d81a
parent: 97d210c8-1583-4994-bf05-d07fea3c7273
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:32.053Z","phase":null} -->
## Claude tool result: toolu_01CjiUvQFXncbY81hVERZktG · 2026-07-11T12:06:32.053Z

```text
diff --git a/src/app/home/useRunSelectionEffects.ts b/src/app/home/useRunSelectionEffects.ts
index 0d30db4..a0c4635 100644
--- a/src/app/home/useRunSelectionEffects.ts
+++ b/src/app/home/useRunSelectionEffects.ts
@@ -10,6 +10,14 @@ const CONVERSATION_BOTTOM_THRESHOLD_PX = 8;
 const CONVERSATION_MEANINGFUL_OVERFLOW_PX = 112;
 const SCROLL_AREA_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]';
 
+function textVersion(value: string | null | undefined) {
+  const text = value ?? "";
+  if (text.length <= 128) {
+    return text;
+  }
+  return `${text.length}:${text.slice(0, 64)}:${text.slice(-64)}`;
+}
+
 export function shouldConversationFollowLatest(
   metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
 ) {
@@ -73,14 +81,14 @@ export function getConversationOutputVersion(
 
   const messageVersion = (messages ?? [])
     .filter((message) => message.runId === selectedRunId)
-    .map((message) => `${message.id}:${message.createdAt}:${message.content.length}`)
+    .map((message) => `${message.id}:${message.createdAt}:${textVersion(message.content)}`)
     .join("|");
   const agentVersion = (agents ?? [])
     .map((agent) => {
       const outputEntriesVersion = (agent.outputEntries ?? [])
-        .map((entry) => `${entry.id}:${entry.text.length}:${entry.timestamp}`)
+        .map((entry) => `${entry.id}:${entry.type}:${entry.status ?? ""}:${textVersion(entry.text)}`)
         .join(",");
-      return `${agent.name}:${agent.currentText?.length ?? 0}:${agent.lastText?.length ?? 0}:${outputEntriesVersion}`;
+      return `${agent.name}:${textVersion(agent.currentText)}:${textVersion(agent.lastText)}:${outputEntriesVersion}`;
     })
     .join("|");
 
diff --git a/src/runtime/http/routes/runs.ts b/src/runtime/http/routes/runs.ts
index e7c1498..25f064c 100644
--- a/src/runtime/http/routes/runs.ts
+++ b/src/runtime/http/routes/runs.ts
@@ -7,6 +7,7 @@ import { errorResponse } from "@/server/api-errors";
 import { recoverRun } from "@/server/runs/recovery";
 import { stopRunObserver } from "@/server/supervisor/observer";
 import { cancelSupervisorWake } from "@/server/supervisor/wake";
+import { cancelDurableSupervisorWake } from "@/server/supervisor/wake-schedule";
 import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
 import { getAppDataPath } from "@/server/app-root";
 import { requireApiSession } from "@/server/auth/guards";
@@ -18,6 +19,7 @@ import { compactRunOutputs } from "@/server/workers/output-store";
 import { cleanupRunArtifacts } from "@/server/artifacts/cleanup";
 import { pauseForClarifications } from "@/server/clarifications/loop";
 import { isArchivableRunStatus, isTerminalRunStatus } from "@/server/runs/status";
+import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
 import {
   plans,
   runs,
@@ -34,6 +36,8 @@ import {
   settings,
   workerCounters,
   workerAssignments,
+  workerCredentialAllocations,
+  workerTokenUsage,
   planningReviewRuns,
   planningReviewRounds,
   planningReviewFindings,
@@ -76,7 +80,8 @@ function isActiveWorkerStatus(status: string | null | undefined) {
 }
 
 function isSupervisorStopAlreadySettled(status: string | null | undefined) {
-  return normalizeWorkerStatus(status) !== "running";
+  const normalized = normalizeWorkerStatus(status);
+  return normalized !== "running" && normalized !== "quota_waiting";
 }
 
 function isPermanentAccountFailure(message: string | null | undefined) {
@@ -209,6 +214,8 @@ async function cancelWorker(worker: typeof workers.$inferSelect) {
   const previousStatus = worker.status;
   await db.update(workers).set({
     status: "cancelled",
+    currentText: "",
+    lastText: worker.currentText || worker.lastText,
     updatedAt: new Date(),
   }).where(eq(workers.id, worker.id));
 
@@ -233,6 +240,28 @@ async function cancelWorker(worker: typeof workers.$inferSelect) {
   }
 }
 
+async function settleRunRecoveryAfterUserStop(runId: string) {
+  cancelSupervisorWake(runId);
+  await cancelDurableSupervisorWake(runId);
+  await clearSupervisorWakeLease(runId);
+
+  const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
+  const unresolvedIncidents = incidents.filter((incident) => (
+    incident.status === "open"
+    || incident.status === "recovering"
+    || incident.status === "needs_user"
+  ));
+  for (const incident of unresolvedIncidents) {
+    await markRecoveryIncidentResolved({
+      incidentId: incident.id,
+      runId,
+      workerId: incident.workerId,
+      summary: "Recovery cancelled because the user stopped the conversation.",
+      details: { reason: "user_stopped" },
+    });
+  }
+}
+
 async function pauseImplementationRunAfterWorkerStop(runId: string, stoppedWorkerId: string) {
   cancelSupervisorWake(runId);
   stopRunObserver(runId);
@@ -529,9 +558,8 @@ export const handleRunPostRequest: OmniHttpHandler = async (request, context) =>
         });
       }
 
-      cancelSupervisorWake(runId);
       stopRunObserver(runId);
-      await clearSupervisorWakeLease(runId);
+      await settleRunRecoveryAfterUserStop(runId);
 
       const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
       const activeWorkers = runWorkers.filter((worker) => isActiveWorkerStatus(worker.status));
@@ -585,6 +613,7 @@ export const handleRunPostRequest: OmniHttpHandler = async (request, context) =>
       const updatedRunWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
       const hasActiveWorker = updatedRunWorkers.some((candidate) => isActiveWorkerStatus(candidate.status));
       if (!hasActiveWorker) {
+        await settleRunRecoveryAfterUserStop(runId);
         await db.update(runs).set({
           status: "cancelled",
           updatedAt: new Date(),
@@ -784,6 +813,8 @@ export const handleRunDeleteRequest: OmniHttpHandler = async (request, context)
     await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
     await db.delete(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId));
     await db.delete(workerAssignments).where(eq(workerAssignments.runId, runId));
+    await db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.runId, runId));
+    await db.delete(workerTokenUsage).where(eq(workerTokenUsage.runId, runId));
     await db.delete(planningReviewFindings).where(eq(planningReviewFindings.runId, runId));
     await db.delete(planningReviewRounds).where(eq(planningReviewRounds.runId, runId));
     await db.delete(planningReviewRuns).where(eq(planningReviewRuns.runId, runId));
diff --git a/src/server/conversations/sync.ts b/src/server/conversations/sync.ts
index d67c054..537bda0 100644
--- a/src/server/conversations/sync.ts
+++ b/src/server/conversations/sync.ts
@@ -1,7 +1,7 @@
 import { and, eq } from "drizzle-orm";
 import { db } from "@/server/db";
 import { withSqliteBusyRetry } from "@/server/db/retry";
-import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
+import { messages, queuedConversationMessages, recoveryIncidents, runs, workers } from "@/server/db/schema";
 import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
 import { listAgents, normalizeAgentRecord, type AgentRecord } from "@/server/bridge-client";
 import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
@@ -40,6 +40,29 @@ function normalizedStatus(value: string | null | undefined) {
   return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
 }
 
+function parseIncidentDetails(details: string | null | undefined): Record<string, unknown> {
+  if (!details) {
+    return {};
+  }
+  try {
+    const parsed: unknown = JSON.parse(details);
+    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
+      ? parsed as Record<string, unknown>
+      : {};
+  } catch {
+    return {};
+  }
+}
+
+function incidentResumeAt(details: string | null | undefined) {
+  const value = parseIncidentDetails(details).resumeAt;
+  if (typeof value !== "string") {
+    return null;
+  }
+  const date = new Date(value);
+  return Number.isFinite(date.getTime()) ? date : null;
+}
+
 function isCompletedEntryStatus(value: string | null | undefined) {
   const status = normalizedStatus(value);
   return !status || [
@@ -466,8 +489,36 @@ async function syncConversationSessionsUnlocked(rawAgents: unknown[], options: S
   const allWorkers = selectedRunId
     ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
     : await db.select().from(workers);
+  const openQuotaIncidents = (selectedRunId
+    ? await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, selectedRunId))
+    : await db.select().from(recoveryIncidents)
+  ).filter((incident) => (
+    incident.kind === "quota_exhausted"
+    && (incident.status === "open" || incident.status === "recovering")
+    && (incidentResumeAt(incident.details)?.getTime() ?? 0) > Date.now()
+  ));
 
   for (const run of allRuns) {
+    // A user cancellation is authoritative. The bridge can report the old
+    // turn as working until cancellation reaches the provider, but that late
+    // snapshot must not reopen recovery or revive the conversation.
+    if (isCancelledWorkerStatus(run.status)) {
+      continue;
+    }
+
+    const quotaIncident = openQuotaIncidents.find((incident) => incident.runId === run.id);
+    if (quotaIncident) {
+      if (run.status !== "quota_waiting" || run.lastError || run.failedAt) {
+        await withSqliteBusyRetry(() => db.update(runs).set({
+          status: "quota_waiting",
+          failedAt: null,
+          lastError: null,
+          updatedAt: new Date(),
+        }).where(eq(runs.id, run.id)));
+      }
+      continue;
+    }
+
     const staleBusyFailure = isAgentBusyRunFailure(run);
     const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
     const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);

uuid: 81580d45-04ff-4141-8c43-9f13ac7643ff
parent: f36216f5-104c-4e1f-bfa3-7c25d865d81a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:06:37.609Z","phase":null} -->
## Claude thinking · 2026-07-11T12:06:37.609Z



uuid: 4251996d-0dd9-4129-a628-2038690428aa
parent: 81580d45-04ff-4141-8c43-9f13ac7643ff

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:38.197Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:38.197Z

```json
{
  "command": "npx vitest run tests/conversations/direct-run-status.test.ts 2>&1 | tail -60"
}

uuid: a67b7048-8ccb-4832-bade-8e4b7a2e7593
parent: 4251996d-0dd9-4129-a628-2038690428aa
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:38.209Z","phase":null} -->
## Claude tool result: toolu_01NCaThxavaYziXLnwVcqsu4 · 2026-07-11T12:06:38.209Z

```text
This Bash command contains multiple operations. The following part requires approval: npx vitest run tests/conversations/direct-run-status.test.ts 2>&1

uuid: 9042998b-950c-44c2-9da9-8eab0a1e2dfa
parent: a67b7048-8ccb-4832-bade-8e4b7a2e7593
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:41.332Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:41.332Z

```json
{
  "command": "npx vitest run tests/conversations/direct-run-status.test.ts"
}

uuid: 527e8710-5545-41bb-b209-cfe5a3df8588
parent: 9042998b-950c-44c2-9da9-8eab0a1e2dfa
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:41.344Z","phase":null} -->
## Claude tool result: toolu_014buPEHiy2vaDCcwx6qF5Hq · 2026-07-11T12:06:41.344Z

```text
This command requires approval

uuid: 6df0fc72-fe37-4148-8eb3-73aa04f8b85e
parent: 527e8710-5545-41bb-b209-cfe5a3df8588
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:43.577Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:43.577Z

```json
{
  "command": "npx vitest run tests/conversations/direct-run-status.test.ts > /tmp/vitest_out.txt 2>&1; tail -80 /tmp/vitest_out.txt"
}

uuid: 0d261959-69e0-4647-ad23-185e6f3ae31c
parent: 6df0fc72-fe37-4148-8eb3-73aa04f8b85e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:43.598Z","phase":null} -->
## Claude tool result: toolu_01Ar26WAGS99yzhtFuiK4Ebi · 2026-07-11T12:06:43.598Z

```text
This Bash command contains multiple operations. The following parts require approval: npx vitest run tests/conversations/direct-run-status.test.ts, tail -80 /tmp/vitest_out.txt

uuid: d49ca6be-1df9-4a2c-8151-f49126d3d1db
parent: 0d261959-69e0-4647-ad23-185e6f3ae31c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:06:45.409Z","phase":null} -->
## Claude thinking · 2026-07-11T12:06:45.409Z



uuid: f906d494-d005-4c24-bc01-f698ab167adb
parent: d49ca6be-1df9-4a2c-8151-f49126d3d1db

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:06:45.583Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:06:45.583Z

```json
{
  "command": "npx vitest run tests/conversations/direct-run-status.test.ts"
}

uuid: 5cd27919-a01e-44a4-87a1-478e0ace68ed
parent: f906d494-d005-4c24-bc01-f698ab167adb
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:06:45.592Z","phase":null} -->
## Claude tool result: toolu_01AqpFYd5DAeBxx9xH5tsECf · 2026-07-11T12:06:45.592Z

```text
This command requires approval

uuid: 591356a1-79fc-4663-98c5-2e2990ef2835
parent: 5cd27919-a01e-44a4-87a1-478e0ace68ed
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:07:28.599Z","phase":null} -->
## Claude thinking · 2026-07-11T12:07:28.599Z



uuid: b6a921b8-95b9-4b03-957e-ae47b012b60b
parent: 591356a1-79fc-4663-98c5-2e2990ef2835

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:07:29.705Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:07:29.705Z

```json
{
  "pattern": "updatedAt",
  "path": "/Users/masterman/NLP/omniharness/src/app/home/sidebar-activity.ts",
  "-n": true
}

uuid: f1a45f1a-a2a0-4f98-b53c-db4b1817d77a
parent: b6a921b8-95b9-4b03-957e-ae47b012b60b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:07:29.729Z","phase":null} -->
## Claude tool result: toolu_011NaYHVNSLnbjV1dNUCZbxK · 2026-07-11T12:07:29.729Z

```text
Found 1 file
src/app/home/sidebar-activity.ts

uuid: f80823d2-dbd1-4cff-93ce-1788603d0011
parent: f1a45f1a-a2a0-4f98-b53c-db4b1817d77a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:07:30.169Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:07:30.169Z

```json
{
  "pattern": "worker\\.updatedAt|workers\\.updatedAt",
  "output_mode": "files_with_matches"
}

uuid: a9f79220-f405-4c54-88bb-b5e0123b8628
parent: f80823d2-dbd1-4cff-93ce-1788603d0011
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:07:30.208Z","phase":null} -->
## Claude tool result: toolu_0155gY4DSnxiRFY9PzowyB3S · 2026-07-11T12:07:30.208Z

```text
Found 10 files
src/server/supervisor/resume.ts
src/server/supervisor/observer.ts
src/runtime/http/routes/events.ts
src/server/events/persisted-snapshot.ts
src/server/runs/persisted-zombie-reconciler.ts
src/server/supervisor/context.ts
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md
src/lib/conversation-workers.ts
scripts/backfill-worker-initial-prompts.ts
src/server/runs/recovery-state.ts

uuid: 43343b65-6631-4bb6-8acd-643530a3de73
parent: a9f79220-f405-4c54-88bb-b5e0123b8628
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:07:36.986Z","phase":null} -->
## Claude thinking · 2026-07-11T12:07:36.986Z



uuid: 307f9dde-f9e9-4aa2-a73d-1a451e74bcf2
parent: 43343b65-6631-4bb6-8acd-643530a3de73

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:07:37.418Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:07:37.418Z

```json
{
  "pattern": "updatedAt",
  "path": "/Users/masterman/NLP/omniharness/src/app/home/sidebar-activity.ts",
  "-n": true,
  "-C": 3
}

uuid: 3af34a5b-4419-4b39-870a-39f59bb0d6c6
parent: 307f9dde-f9e9-4aa2-a73d-1a451e74bcf2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:07:37.458Z","phase":null} -->
## Claude tool result: toolu_01H73Mwk7pL4dM5AdHCGbZry · 2026-07-11T12:07:37.458Z

```text
Found 1 file
src/app/home/sidebar-activity.ts

uuid: 752cd865-4dda-49e2-9537-c87b99464b10
parent: 3af34a5b-4419-4b39-870a-39f59bb0d6c6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:07:37.462Z","phase":null} -->
## Claude attachment · 2026-07-11T12:07:37.462Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: 6539c8db-db43-4221-a0a2-da5fe558f39a
parent: 752cd865-4dda-49e2-9537-c87b99464b10
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:07:39.801Z","phase":null} -->
## Claude thinking · 2026-07-11T12:07:39.801Z



uuid: abd42088-c709-452a-b5ec-859e7b2eb793
parent: 6539c8db-db43-4221-a0a2-da5fe558f39a

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:07:40.403Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:07:40.403Z

```json
{
  "pattern": "\\.updatedAt",
  "path": "/Users/masterman/NLP/omniharness/src/app/home/sidebar-activity.ts",
  "output_mode": "content",
  "-n": true
}

uuid: fd1c3a6d-4c65-4c95-8b89-f840400ec6aa
parent: abd42088-c709-452a-b5ec-859e7b2eb793
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:07:40.412Z","phase":null} -->
## Claude tool result: toolu_014tSnWMot94HFhyTzLCBGCJ · 2026-07-11T12:07:40.412Z

```text
100:    const ts = qm.deliveredAt ?? qm.updatedAt ?? qm.createdAt;
126:    run.updatedAt,
127:    ...activeWorkers.map((w) => w.updatedAt),
128:    ...activeAgents.map((a) => a.updatedAt),
236:          updatedAt: (run as SidebarRun & { updatedAt?: string | null }).updatedAt ?? null,

uuid: 0f66f260-1e8c-4876-84c8-121053a66173
parent: fd1c3a6d-4c65-4c95-8b89-f840400ec6aa
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:16.309Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:16.309Z



uuid: 323e1e37-2785-46d3-9496-53e53db8502e
parent: 0f66f260-1e8c-4876-84c8-121053a66173

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:17.332Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:08:17.332Z

```json
{
  "pattern": "run\\.updatedAt|runs\\.updatedAt",
  "path": "/Users/masterman/NLP/omniharness/src/server/workers/stuck-worker-reaper.ts",
  "-n": true,
  "-C": 4
}

uuid: 3693160d-b82a-46ba-98d4-4fe3fcb6140c
parent: 323e1e37-2785-46d3-9496-53e53db8502e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:17.349Z","phase":null} -->
## Claude tool result: toolu_01KQ4YSu5EScffq7HqFG11it · 2026-07-11T12:08:17.349Z

```text
No files found

uuid: e9672c09-c49b-4f06-a341-53460382f670
parent: 3693160d-b82a-46ba-98d4-4fe3fcb6140c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:18.019Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:08:18.019Z

```json
{
  "pattern": "run\\.updatedAt|runs\\.updatedAt",
  "path": "/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts",
  "-n": true,
  "-C": 4
}

uuid: 1ab7359e-5ff0-4088-81e6-82900eab2e96
parent: e9672c09-c49b-4f06-a341-53460382f670
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:18.027Z","phase":null} -->
## Claude tool result: toolu_01VJB9kVDxxzGmYfPbz38vcs · 2026-07-11T12:08:18.027Z

```text
No files found

uuid: 8e266a13-da0c-45e6-8c36-a519bb2acc5f
parent: 1ab7359e-5ff0-4088-81e6-82900eab2e96
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:20.647Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:20.647Z



uuid: 36e1cef5-2514-4464-85e8-c776383646bd
parent: 8e266a13-da0c-45e6-8c36-a519bb2acc5f

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:21.224Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:08:21.224Z

```json
{
  "pattern": "\\brun\\.updatedAt\\b|runs\\.updatedAt",
  "output_mode": "files_with_matches"
}

uuid: 3b7ec2fd-6eb7-4065-85d5-46730afaac3e
parent: 36e1cef5-2514-4464-85e8-c776383646bd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:21.279Z","phase":null} -->
## Claude tool result: toolu_01W86gSueTTahC3QnNpMxx1Q · 2026-07-11T12:08:21.279Z

```text
Found 15 files
src/runtime/http/routes/runs.ts
src/app/home/useHomeViewModel.ts
src/app/home/sidebar-activity.ts
src/app/home/utils.ts
src/app/home/EventStreamStateManager.ts
src/server/events/persisted-snapshot.ts
src/server/omni-acp/agent.ts
scripts/_check-stale-runs.ts
scripts/cleanup-stale-sidebar-state.ts
src/lib/conversations.ts
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md
docs/superpowers/plans/2026-05-25-automatic-session-cleanup.md
tests/server/supervisor-ordering-source.test.ts
docs/architecture/state-staleness-and-session-lifecycle-lessons.md
src/lib/conversation-state.ts

uuid: 943e146a-506a-4fba-b0f0-88e062545601
parent: 3b7ec2fd-6eb7-4065-85d5-46730afaac3e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:25.369Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:25.369Z



uuid: ac6669cb-e20c-4265-8e40-d831cf89f5ec
parent: 943e146a-506a-4fba-b0f0-88e062545601

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:25.693Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:08:25.693Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/scripts/_check-stale-runs.ts"
}

uuid: 2feab943-40b6-477e-8787-653589af28ae
parent: ac6669cb-e20c-4265-8e40-d831cf89f5ec
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:25.706Z","phase":null} -->
## Claude tool result: toolu_018FezhqDnSvuz9MecyKjo4p · 2026-07-11T12:08:25.706Z

```text
1	import { db } from "@/server/db";
2	import { runs, messages, conversationReadMarkers } from "@/server/db/schema";
3	import { inArray } from "drizzle-orm";
4	
5	const ids = ["7048f1e07877", "e16f31e91c73", "13165a11-e7f5-4283-a6c5-7d8ea97ba319"];
6	
7	async function main() {
8	  const r = await db.select({ id: runs.id, status: runs.status, updatedAt: runs.updatedAt, title: runs.title })
9	    .from(runs).where(inArray(runs.id, ids));
10	  console.log("RUNS:", JSON.stringify(r, null, 2));
11	
12	  const m = await db.select({ runId: conversationReadMarkers.runId, lastReadAt: conversationReadMarkers.lastReadAt })
13	    .from(conversationReadMarkers).where(inArray(conversationReadMarkers.runId, ids));
14	  console.log("READ_MARKERS:", JSON.stringify(m, null, 2));
15	
16	  const msgs = await db.select({ runId: messages.runId, role: messages.role, createdAt: messages.createdAt })
17	    .from(messages).where(inArray(messages.runId, ids));
18	  console.log("MESSAGES:", JSON.stringify(msgs, null, 2));
19	}
20	
21	main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
22	

uuid: f8afda45-f336-496a-8a4f-0cc24a19184e
parent: 2feab943-40b6-477e-8787-653589af28ae
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:26.366Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:08:26.366Z

```json
{
  "pattern": "updatedAt",
  "path": "/Users/masterman/NLP/omniharness/docs/architecture/state-staleness-and-session-lifecycle-lessons.md",
  "-C": 4
}

uuid: 80d40131-3ee7-4fd9-9da1-0aa2081e2881
parent: f8afda45-f336-496a-8a4f-0cc24a19184e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:26.384Z","phase":null} -->
## Claude tool result: toolu_01HiGLVbfsMiqD5eGjM2MqWT · 2026-07-11T12:08:26.384Z

```text
Found 1 file
docs/architecture/state-staleness-and-session-lifecycle-lessons.md

uuid: ad9d2f45-d6de-4cde-bd53-da3c60d9af64
parent: 80d40131-3ee7-4fd9-9da1-0aa2081e2881
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:30.593Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:30.593Z



uuid: 2f926b3c-388e-4d4f-a3ec-142fe653cbd4
parent: ad9d2f45-d6de-4cde-bd53-da3c60d9af64

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:31.919Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:08:31.919Z

```json
{
  "pattern": "updatedAt",
  "path": "/Users/masterman/NLP/omniharness/docs/architecture/state-staleness-and-session-lifecycle-lessons.md",
  "output_mode": "content",
  "-n": true
}

uuid: 23a989f4-646f-4585-96db-63d0178c389f
parent: 2f926b3c-388e-4d4f-a3ec-142fe653cbd4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:31.941Z","phase":null} -->
## Claude tool result: toolu_01N77zRRwPj7rxwVek1wP9so · 2026-07-11T12:08:31.941Z

```text
122:- Completion can be represented by `run.updatedAt`, not only by message rows.
131:  `run.updatedAt`.
138:  visible through `run.updatedAt`.
139:- A running run's `updatedAt` changing by itself does not make it unread.
417:- `run.updatedAt` is meaningful only for terminal/user-relevant states.

uuid: 4ddd915a-3daa-4d6a-95b8-7a605510ea65
parent: 23a989f4-646f-4585-96db-63d0178c389f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:34.906Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:34.906Z



uuid: 4642e773-fe04-4b61-8b24-bf576d141f35
parent: 4ddd915a-3daa-4d6a-95b8-7a605510ea65

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:35.650Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:08:35.650Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/architecture/state-staleness-and-session-lifecycle-lessons.md",
  "offset": 100,
  "limit": 50
}

uuid: f7ea5588-53bb-43c4-8a5e-59bf2bb7fbed
parent: 4642e773-fe04-4b61-8b24-bf576d141f35
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:35.659Z","phase":null} -->
## Claude tool result: toolu_01MMTZrnLWQjGD39P9wajKRC · 2026-07-11T12:08:35.659Z

```text
100	  latest worker state.
101	
102	Tests to keep:
103	
104	- A stale legacy `outputLog` question cannot make a completed direct turn look
105	  like `awaiting_user`.
106	- Recovery/sync of an idle direct worker with visible output persists `done`.
107	- `awaiting_user` is emitted only when the latest visible output requests user
108	  input.
109	
110	### 3. Completion notifications stayed unread after being read
111	
112	Symptom:
113	
114	- `ecea142f7344` showed the blue unread dot.
115	- Opening the conversation appeared to mark it read.
116	- Switching away left the blue dot visible.
117	
118	Actual failure class:
119	
120	- The sidebar unread calculation and the selected-run read marker used
121	  different timestamp sources.
122	- Completion can be represented by `run.updatedAt`, not only by message rows.
123	- Running-state update churn must not create unread notifications.
124	
125	Guardrails:
126	
127	- Use one helper for both "is this run unread?" and "what timestamp should be
128	  marked read when this run is selected?"
129	- For terminal or user-relevant states (`done`, `awaiting_user`, `failed`,
130	  `needs_recovery`), compare against the later of latest message time and
131	  `run.updatedAt`.
132	- For `running`, use latest message time only. Do not turn polling/sync churn
133	  into unread notifications.
134	
135	Tests to keep:
136	
137	- Opening a completed run clears the unread dot even when completion is only
138	  visible through `run.updatedAt`.
139	- A running run's `updatedAt` changing by itself does not make it unread.
140	
141	### 4. Newly created sessions could disappear until reload
142	
143	Symptom:
144	
145	- `18fc406457f3` appeared in the sidebar after creation.
146	- It then promptly disappeared.
147	- Reloading the page brought it back.
148	
149	Actual failure class:

uuid: 2b989f9b-2687-4fbd-bf5a-94acb66c3f4b
parent: f7ea5588-53bb-43c4-8a5e-59bf2bb7fbed
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:36.414Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:08:36.414Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/architecture/state-staleness-and-session-lifecycle-lessons.md",
  "offset": 400,
  "limit": 30
}

uuid: 0be44ba2-0b60-4e82-ab17-92426fe047b7
parent: 2b989f9b-2687-4fbd-bf5a-94acb66c3f4b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:36.416Z","phase":null} -->
## Claude tool result: toolu_016Hzr2o2xfv6okvZXeEizPJ · 2026-07-11T12:08:36.416Z

```text
400	- Local optimistic state must be cleared by explicit success/failure paths, not
401	  by time alone.
402	- Any "stable window" heuristic must be treated as suspicious. Time passing is
403	  not proof that all older async work has drained.
404	
405	### Queue Delivery
406	
407	- Queue state is durable state. The database row wins over any closure-captured
408	  JavaScript object.
409	- Every long async delivery path must re-read queue status around bridge calls.
410	- `cancelled` is terminal. No catch block may transform it back into pending,
411	  failed, or delivered.
412	
413	### Read Markers
414	
415	- The timestamp used to display an unread indicator and the timestamp written
416	  when opening a run must come from the same helper.
417	- `run.updatedAt` is meaningful only for terminal/user-relevant states.
418	- Polling churn while running is not a notification.
419	
420	### Worker Transcript
421	
422	- Persist worker content through the unified worker stream.
423	- Render worker content through `WorkerEntriesManager` and `Terminal` entries.
424	- Do not add a second persistence layer to paper over stream loading bugs.
425	- If bridge output exists but the worker stream does not, fix persistence or
426	  sync. Do not teach the frontend to reconcile another source of truth.
427	- Use `messages` fallback rows only after the relevant worker stream is loaded.
428	  While entries are empty or partial, the client does not know enough to place
429	  fallback rows safely.

uuid: bf191a3d-2659-4fa2-b043-bc767b906d84
parent: 0be44ba2-0b60-4e82-ab17-92426fe047b7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:47.809Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:47.809Z



uuid: ac486063-2bdf-4551-9290-fc739253148d
parent: bf191a3d-2659-4fa2-b043-bc767b906d84

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:48.856Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:08:48.856Z

```json
{
  "pattern": "export function emitNamedEvent",
  "path": "/Users/masterman/NLP/omniharness/src/server/events/named-events.ts",
  "output_mode": "content",
  "-n": true,
  "-A": 20
}

uuid: 6d7a6904-e5e4-41d6-972f-a1e18fade814
parent: ac486063-2bdf-4551-9290-fc739253148d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:48.870Z","phase":null} -->
## Claude tool result: toolu_01WX1VC9qFHJ1s2cFTpDSXEk · 2026-07-11T12:08:48.870Z

```text
493:export function emitNamedEvent(event: NamedEvent): BufferedEntry {
494-  const entry = append(event);
495-  notifyEventStreamSubscribers();
496-  return entry;
497-}
498-
499-/**
500- * Reserve a ring-buffer id for an upcoming `update` snapshot frame.
501- * The marker itself carries no data the client renders — its only
502- * purpose is to keep the id sequence contiguous so `Last-Event-ID`
503- * resume after a snapshot frame can be resolved from the ring buffer.
504- *
505- * Note: this does NOT notify subscribers; the caller is mid-stream and
506- * will write the snapshot frame itself.
507- */
508-export function recordSnapshotMarker(
509-  version: number,
510-  runId: string | null = null,
511-): BufferedEntry {
512-  return append({ kind: "snapshot.marker", version }, runId);
513-}

uuid: b5eafc88-ea6f-409a-bc78-e3f9d7a36dde
parent: 6d7a6904-e5e4-41d6-972f-a1e18fade814
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:08:48.926Z","phase":null} -->
## Claude attachment · 2026-07-11T12:08:48.926Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: e436514b-a411-40bf-b2fb-42b458191eee
parent: b5eafc88-ea6f-409a-bc78-e3f9d7a36dde
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-11T12:08:52.149Z","phase":null} -->
## Claude · 2026-07-11T12:08:52.149Z

Confirmed: `emitNamedEvent` unconditionally calls `notifyEventStreamSubscribers()` (named-events.ts:493-497), which wakes every parked SSE loop (`waitForEventStreamNotification` in events.ts:929-935), closing the loop exactly as described. I have what I need to give a verdict.

uuid: 7b967e0c-18ed-4aed-8979-1a1d2ef9dc0f
parent: e436514b-a411-40bf-b2fb-42b458191eee

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:52.624Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:08:52.624Z

```json
{
  "command": "git status --porcelain -- tests/conversations/direct-run-status.test.ts scripts/_check-stale-runs.ts"
}

uuid: 7efa5c66-c2c6-40da-94bf-1a844e019779
parent: 7b967e0c-18ed-4aed-8979-1a1d2ef9dc0f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:52.683Z","phase":null} -->
## Claude tool result: toolu_014rYkGRmq5CHMfPLcei4x9Z · 2026-07-11T12:08:52.683Z

```text
 M tests/conversations/direct-run-status.test.ts

uuid: a5bf915b-9a17-4f21-bafe-68d7996f7a2a
parent: 7efa5c66-c2c6-40da-94bf-1a844e019779
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:08:54.514Z","phase":null} -->
## Claude thinking · 2026-07-11T12:08:54.514Z



uuid: 3b9ab3d8-e60f-487b-890c-b6b5a20d5274
parent: a5bf915b-9a17-4f21-bafe-68d7996f7a2a

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:08:54.844Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:08:54.844Z

```json
{
  "command": "git log -1 --format=%H -- scripts/_check-stale-runs.ts; git status --porcelain --ignored -- scripts/_check-stale-runs.ts"
}

uuid: a0d775c5-0185-4cbf-8af9-bfbc644270eb
parent: 3b9ab3d8-e60f-487b-890c-b6b5a20d5274
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:08:54.927Z","phase":null} -->
## Claude tool result: toolu_01NtzDmvM9jQJ3SSNoUWuPoy · 2026-07-11T12:08:54.927Z

```text
8947cc73fe5f15b0efdb4734cfab02051535f856

uuid: a0a2e158-5253-447e-b945-a376be86b5b5
parent: a0d775c5-0185-4cbf-8af9-bfbc644270eb
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-11T12:09:20.665Z","phase":null} -->
## Claude · 2026-07-11T12:09:20.665Z

Not relevant — it's a pre-existing committed debug script, untouched. I have enough to render a verdict.

## Verdict: **HARDEN**

The root-cause diagnosis is correct and fully verified against the current code — I traced the entire cycle: `updateDirectRunStatusFromWorkerOutput` (`src/server/conversations/direct-run-status.ts:137-142`) unconditionally writes `updatedAt: now` on every call, even when `nextStatus === run.status`. That stale-but-different `updatedAt` flows into `readPersistedEventRecords` → `buildEventPayload`, changes the serialized SSE payload, and `sendUpdateIfChanged` (`events.ts:856-882`) ships a new `update` frame. The client's `selectedRun` object changes, `useRunSelectionEffects.ts:346` recomputes `getRunLatestUnreadTimestamp` (which legitimately uses `run.updatedAt` for `awaiting_user` per documented design), re-POSTs `mark_read`, `markRunRead` (`runs.ts:295-336`) unconditionally emits `conversation.read`, which calls `emitNamedEvent` → `notifyEventStreamSubscribers()` (`named-events.ts:493-497`) → wakes every parked SSE loop → re-syncs → repeats. Confirmed self-sustaining.

**Dirty worktree**: the only piece of this plan already touched is a new test in `tests/conversations/direct-run-status.test.ts` ("preserves the run activity timestamp when repeated input observations do not change state") — and it is currently **red** against the unmodified `direct-run-status.ts`, since that file still does the unconditional write. Nothing else in the dirty tree relates to this plan; the other modified files (`useRunSelectionEffects.ts`, `runs.ts`, `sync.ts` diffs) are unrelated pre-existing work (quota-wait handling, worker cancellation, message-diff versioning) and shouldn't be touched or reverted incidentally.

**Concerns to harden before implementing:**

1. **Defense (1) is misdirected as literally stated, and conflicts with a documented invariant.** `docs/architecture/state-staleness-and-session-lifecycle-lessons.md:122-139` records this exact prior incident and establishes that `getRunLatestUnreadTimestamp` using `run.updatedAt` for `awaiting_user`/`done`/`failed`/`needs_recovery` is *intentional* — a genuine `awaiting_user` transition (e.g. a permission request) may have no `messages` row, so `run.updatedAt` is the only signal. Don't change the read-side helper to ignore `run.updatedAt` for `awaiting_user` — that would silently break "opening a run clears unread status when completion is only visible via `run.updatedAt`" (already tested in `tests/lib/conversation-state.test.ts`). Reframe (1) as: add a regression test proving unread timestamps stay stable when `run.updatedAt` doesn't actually change (i.e. test the *consumer* of a correctly-guarded write), not a change to the helper itself.

2. **Defense (2)'s "idempotent, emits only when marker strictly advances" needs an explicit read-before-write.** `markRunRead` currently has no comparison against the persisted `conversationReadMarkers` row — it unconditionally upserts and emits. Implement by selecting the existing marker first and skipping both the upsert and the `emitNamedEvent` when `lastReadAtIso <= existing.lastReadAt`. This is containment, not the root fix — without (3) it just reduces amplification.

3. **Defense (3) — the actual fix — must live inside `updateDirectRunStatusFromWorkerOutput` itself, not just at call sites.** The second loop in `sync.ts` (line 783: `if (nextRunState === run.status) { …continue }`) already guards its own call, but the first (live-agent) loop at `sync.ts:702-713` calls `updateDirectRunStatusFromWorkerOutput` unconditionally whenever `nextRunState` is `awaiting_user`/`done`, with no equality check — this is the actual path that fires every SSE poll while a direct run sits in `awaiting_user` with a still-live agent. Guarding only at call sites is fragile (other callers — `send-message.ts`, `queued-messages.ts`, `create.ts`, `recovery.ts`, `stuck-worker-reaper.ts` — all call this function directly). Put the no-op guard inside the function: skip the `db.update(runs)` write entirely when `nextStatus === run.status && !run.failedAt && !run.lastError`, matching the pattern already used for the existing `notifyEventStreamSubscribers` guard at lines 170-172. The already-added test in `direct-run-status.test.ts` targets exactly this function — implement here and it should go green.

4. **Scope gap: worker-row churn isn't covered by "worker/run rows" as currently described, but should be.** `sync.ts:664-670` (and the implementation-mode branches at 547-555, 599-605) unconditionally set `updatedAt: new Date()` on the `workers` table every live-sync pass, regardless of whether `status`/`cwd`/`currentText`/`lastText` changed. This doesn't feed the read-marker loop directly (`getRunLatestUnreadTimestamp` never reads `worker.updatedAt`), but `sidebar-activity.ts:126-128` folds `worker.updatedAt` into the sidebar's "latest activity" timestamp — so this same class of unconditional write will keep the sidebar looking perpetually active even after the read-marker loop is closed. Recommend including a matching no-op guard on the `workers` update (or at minimum flag it as a known follow-up, since the plan's own wording ("worker/run rows") already scopes it in).

5. **Verify before/after**: run `tests/conversations/direct-run-status.test.ts` once (3) lands — it's currently red by static inspection (unconditional `updatedAt: now` write contradicts the test's `expect(run?.updatedAt).toEqual(originalUpdatedAt)`), so it's a reliable canary that the fix is actually wired in, not just tested in isolation.

Net: plan direction is right and matches the code precisely, but ship it as scoped in points 1 and 3 (fix belongs inside `updateDirectRunStatusFromWorkerOutput`, not the read helper or only the call sites), add the read-before-write to `markRunRead`, and decide explicitly whether the `workers` row churn in `sync.ts` is in scope for this pass.

uuid: 73245988-73c5-4f88-8adf-532cafce6ca9
parent: a0a2e158-5253-447e-b945-a376be86b5b5

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:12:03.454Z","phase":null} -->
## Claude state: queue-operation · 2026-07-11T12:12:03.454Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-11T12:12:03.454Z",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa",
  "content": "Review the implemented fix now, without editing files. We kept getRunLatestUnreadTimestamp unchanged. We added an atomic conflict update with a strict lastReadAt comparison and only emit conversation.read when the insert/update returns a row; updateDirectRunStatusFromWorkerOutput skips unchanged writes; direct live worker sync skips unchanged worker writes; regression tests cover all three and pass. Inspect the current focused diff and return READY or HARDEN with only correctness/test gaps."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:12:03.454Z","phase":null} -->
## Claude state: queue-operation · 2026-07-11T12:12:03.454Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-11T12:12:03.454Z",
  "sessionId": "8639a63d-9e9b-40d3-aa14-ad3b7a188baa"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-11T12:12:03.480Z","phase":null} -->
## User · 2026-07-11T12:12:03.480Z

Review the implemented fix now, without editing files. We kept getRunLatestUnreadTimestamp unchanged. We added an atomic conflict update with a strict lastReadAt comparison and only emit conversation.read when the insert/update returns a row; updateDirectRunStatusFromWorkerOutput skips unchanged writes; direct live worker sync skips unchanged worker writes; regression tests cover all three and pass. Inspect the current focused diff and return READY or HARDEN with only correctness/test gaps.

uuid: 12fc4838-8596-4a67-9354-bdf61a920ff1
parent: 73245988-73c5-4f88-8adf-532cafce6ca9

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:12:03.480Z","phase":null} -->
## Claude attachment · 2026-07-11T12:12:03.480Z

```text
{
  "type": "deferred_tools_delta",
  "addedNames": [],
  "addedLines": [],
  "removedNames": [
    "mcp__claude_ai_Gmail__apply_sensitive_message_label",
    "mcp__claude_ai_Gmail__apply_sensitive_thread_label",
    "mcp__claude_ai_Gmail__create_draft",
    "mcp__claude_ai_Gmail__create_label",
    "mcp__claude_ai_Gmail__get_message",
    "mcp__claude_ai_Gmail__get_thread",
    "mcp__claude_ai_Gmail__label_message",
    "mcp__claude_ai_Gmail__label_thread",
    "mcp__claude_ai_Gmail__list_drafts",
    "mcp__claude_ai_Gmail__list_labels",
    "mcp__claude_ai_Gmail__search_threads",
    "mcp__claude_ai_Gmail__unlabel_message",
    "mcp__claude_ai_Gmail__unlabel_thread",
    "mcp__claude_ai_Google_Calendar__create_event",
    "mcp__claude_ai_Google_Calendar__delete_event",
    "mcp__claude_ai_Google_Calendar__get_event",
    "mcp__claude_ai_Google_Calendar__list_calendars",
    "mcp__claude_ai_Google_Calendar__list_events",
    "mcp__claude_ai_Google_Calendar__respond_to_event",
    "mcp__claude_ai_Google_Calendar__search_events",
    "mcp__claude_ai_Google_Calendar__suggest_time",
    "mcp__claude_ai_Google_Calendar__update_event",
    "mcp__claude_ai_Google_Drive__copy_file",
    "mcp__claude_ai_Google_Drive__create_file",
    "mcp__claude_ai_Google_Drive__download_file_content",
    "mcp__claude_ai_Google_Drive__get_file_metadata",
    "mcp__claude_ai_Google_Drive__get_file_permissions",
    "mcp__claude_ai_Google_Drive__list_recent_files",
    "mcp__claude_ai_Google_Drive__read_file_content",
    "mcp__claude_ai_Google_Drive__search_files"
  ],
  "readdedNames": [],
  "pendingMcpServers": [
    "claude.ai Gmail",
    "claude.ai Google Calendar",
    "claude.ai Google Drive"
  ],
  "needsAuthMcpServers": []
}

binary omitted from archive

uuid: baee5eef-fbc0-44a5-9c0e-4966c2cf421a
parent: 12fc4838-8596-4a67-9354-bdf61a920ff1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:12:06.291Z","phase":null} -->
## Claude thinking · 2026-07-11T12:12:06.291Z



uuid: 4866f211-5083-467a-88f1-775e7f73a71d
parent: baee5eef-fbc0-44a5-9c0e-4966c2cf421a

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:06.519Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:12:06.519Z

```json
{
  "command": "git status --porcelain"
}

uuid: 66d16339-d6ec-4cc1-93ac-2d4089778727
parent: 4866f211-5083-467a-88f1-775e7f73a71d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:07.003Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:12:07.003Z

```json
{
  "command": "git diff -- src/server/conversations/direct-run-status.ts src/runtime/http/routes/runs.ts src/server/conversations/sync.ts"
}

uuid: 5ab57e04-bd03-42ee-9cb4-512de472d27f
parent: 66d16339-d6ec-4cc1-93ac-2d4089778727
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:07.049Z","phase":null} -->
## Claude tool result: toolu_01TepqH9h2K9oyMXsUS6MzaW · 2026-07-11T12:12:07.049Z

```text
diff --git a/src/runtime/http/routes/runs.ts b/src/runtime/http/routes/runs.ts
index e7c1498..76cddc9 100644
--- a/src/runtime/http/routes/runs.ts
+++ b/src/runtime/http/routes/runs.ts
@@ -1,12 +1,13 @@
 import { randomUUID } from "crypto";
 import fs from "fs";
-import { eq } from "drizzle-orm";
+import { eq, lt } from "drizzle-orm";
 import { db } from "@/server/db";
 import { cancelAgent, cancelAgentTerminalProcess } from "@/server/bridge-client";
 import { errorResponse } from "@/server/api-errors";
 import { recoverRun } from "@/server/runs/recovery";
 import { stopRunObserver } from "@/server/supervisor/observer";
 import { cancelSupervisorWake } from "@/server/supervisor/wake";
+import { cancelDurableSupervisorWake } from "@/server/supervisor/wake-schedule";
 import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
 import { getAppDataPath } from "@/server/app-root";
 import { requireApiSession } from "@/server/auth/guards";
@@ -18,6 +19,7 @@ import { compactRunOutputs } from "@/server/workers/output-store";
 import { cleanupRunArtifacts } from "@/server/artifacts/cleanup";
 import { pauseForClarifications } from "@/server/clarifications/loop";
 import { isArchivableRunStatus, isTerminalRunStatus } from "@/server/runs/status";
+import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
 import {
   plans,
   runs,
@@ -34,6 +36,8 @@ import {
   settings,
   workerCounters,
   workerAssignments,
+  workerCredentialAllocations,
+  workerTokenUsage,
   planningReviewRuns,
   planningReviewRounds,
   planningReviewFindings,
@@ -76,7 +80,8 @@ function isActiveWorkerStatus(status: string | null | undefined) {
 }
 
 function isSupervisorStopAlreadySettled(status: string | null | undefined) {
-  return normalizeWorkerStatus(status) !== "running";
+  const normalized = normalizeWorkerStatus(status);
+  return normalized !== "running" && normalized !== "quota_waiting";
 }
 
 function isPermanentAccountFailure(message: string | null | undefined) {
@@ -209,6 +214,8 @@ async function cancelWorker(worker: typeof workers.$inferSelect) {
   const previousStatus = worker.status;
   await db.update(workers).set({
     status: "cancelled",
+    currentText: "",
+    lastText: worker.currentText || worker.lastText,
     updatedAt: new Date(),
   }).where(eq(workers.id, worker.id));
 
@@ -233,6 +240,28 @@ async function cancelWorker(worker: typeof workers.$inferSelect) {
   }
 }
 
+async function settleRunRecoveryAfterUserStop(runId: string) {
+  cancelSupervisorWake(runId);
+  await cancelDurableSupervisorWake(runId);
+  await clearSupervisorWakeLease(runId);
+
+  const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
+  const unresolvedIncidents = incidents.filter((incident) => (
+    incident.status === "open"
+    || incident.status === "recovering"
+    || incident.status === "needs_user"
+  ));
+  for (const incident of unresolvedIncidents) {
+    await markRecoveryIncidentResolved({
+      incidentId: incident.id,
+      runId,
+      workerId: incident.workerId,
+      summary: "Recovery cancelled because the user stopped the conversation.",
+      details: { reason: "user_stopped" },
+    });
+  }
+}
+
 async function pauseImplementationRunAfterWorkerStop(runId: string, stoppedWorkerId: string) {
   cancelSupervisorWake(runId);
   stopRunObserver(runId);
@@ -287,7 +316,7 @@ async function markRunRead(runId: string, run: typeof runs.$inferSelect) {
 
   const now = new Date();
   const lastReadAt = new Date(lastReadAtIso);
-  await db.insert(conversationReadMarkers)
+  const changedMarkers = await db.insert(conversationReadMarkers)
     .values({
       runId,
       lastReadAt,
@@ -300,7 +329,16 @@ async function markRunRead(runId: string, run: typeof runs.$inferSelect) {
         lastReadAt,
         updatedAt: now,
       },
-    });
+      setWhere: lt(conversationReadMarkers.lastReadAt, lastReadAt),
+    })
+    .returning({ lastReadAt: conversationReadMarkers.lastReadAt });
+
+  if (changedMarkers.length === 0) {
+    const currentMarker = await db.select({
+      lastReadAt: conversationReadMarkers.lastReadAt,
+    }).from(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId)).get();
+    return currentMarker?.lastReadAt.toISOString() ?? lastReadAt.toISOString();
+  }
 
   emitNamedEvent({ kind: "conversation.read", runId, lastReadAt: lastReadAt.toISOString() });
   return lastReadAt.toISOString();
@@ -529,9 +567,8 @@ export const handleRunPostRequest: OmniHttpHandler = async (request, context) =>
         });
       }
 
-      cancelSupervisorWake(runId);
       stopRunObserver(runId);
-      await clearSupervisorWakeLease(runId);
+      await settleRunRecoveryAfterUserStop(runId);
 
       const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
       const activeWorkers = runWorkers.filter((worker) => isActiveWorkerStatus(worker.status));
@@ -585,6 +622,7 @@ export const handleRunPostRequest: OmniHttpHandler = async (request, context) =>
       const updatedRunWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
       const hasActiveWorker = updatedRunWorkers.some((candidate) => isActiveWorkerStatus(candidate.status));
       if (!hasActiveWorker) {
+        await settleRunRecoveryAfterUserStop(runId);
         await db.update(runs).set({
           status: "cancelled",
           updatedAt: new Date(),
@@ -784,6 +822,8 @@ export const handleRunDeleteRequest: OmniHttpHandler = async (request, context)
     await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
     await db.delete(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId));
     await db.delete(workerAssignments).where(eq(workerAssignments.runId, runId));
+    await db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.runId, runId));
+    await db.delete(workerTokenUsage).where(eq(workerTokenUsage.runId, runId));
     await db.delete(planningReviewFindings).where(eq(planningReviewFindings.runId, runId));
     await db.delete(planningReviewRounds).where(eq(planningReviewRounds.runId, runId));
     await db.delete(planningReviewRuns).where(eq(planningReviewRuns.runId, runId));
diff --git a/src/server/conversations/direct-run-status.ts b/src/server/conversations/direct-run-status.ts
index 5d6cd58..627d56a 100644
--- a/src/server/conversations/direct-run-status.ts
+++ b/src/server/conversations/direct-run-status.ts
@@ -134,12 +134,14 @@ export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSo
 
   const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
   const now = new Date();
-  await db.update(runs).set({
-    status: nextStatus,
-    failedAt: null,
-    lastError: null,
-    updatedAt: now,
-  }).where(eq(runs.id, args.runId));
+  if (run.status !== nextStatus || run.failedAt || run.lastError) {
+    await db.update(runs).set({
+      status: nextStatus,
+      failedAt: null,
+      lastError: null,
+      updatedAt: now,
+    }).where(eq(runs.id, args.runId));
+  }
 
   if (nextStatus === "awaiting_user" && run.status !== "awaiting_user") {
     emitNamedEvent({
diff --git a/src/server/conversations/sync.ts b/src/server/conversations/sync.ts
index d67c054..b451ec0 100644
--- a/src/server/conversations/sync.ts
+++ b/src/server/conversations/sync.ts
@@ -1,7 +1,7 @@
 import { and, eq } from "drizzle-orm";
 import { db } from "@/server/db";
 import { withSqliteBusyRetry } from "@/server/db/retry";
-import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
+import { messages, queuedConversationMessages, recoveryIncidents, runs, workers } from "@/server/db/schema";
 import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
 import { listAgents, normalizeAgentRecord, type AgentRecord } from "@/server/bridge-client";
 import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
@@ -40,6 +40,29 @@ function normalizedStatus(value: string | null | undefined) {
   return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
 }
 
+function parseIncidentDetails(details: string | null | undefined): Record<string, unknown> {
+  if (!details) {
+    return {};
+  }
+  try {
+    const parsed: unknown = JSON.parse(details);
+    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
+      ? parsed as Record<string, unknown>
+      : {};
+  } catch {
+    return {};
+  }
+}
+
+function incidentResumeAt(details: string | null | undefined) {
+  const value = parseIncidentDetails(details).resumeAt;
+  if (typeof value !== "string") {
+    return null;
+  }
+  const date = new Date(value);
+  return Number.isFinite(date.getTime()) ? date : null;
+}
+
 function isCompletedEntryStatus(value: string | null | undefined) {
   const status = normalizedStatus(value);
   return !status || [
@@ -466,8 +489,36 @@ async function syncConversationSessionsUnlocked(rawAgents: unknown[], options: S
   const allWorkers = selectedRunId
     ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
     : await db.select().from(workers);
+  const openQuotaIncidents = (selectedRunId
+    ? await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, selectedRunId))
+    : await db.select().from(recoveryIncidents)
+  ).filter((incident) => (
+    incident.kind === "quota_exhausted"
+    && (incident.status === "open" || incident.status === "recovering")
+    && (incidentResumeAt(incident.details)?.getTime() ?? 0) > Date.now()
+  ));
 
   for (const run of allRuns) {
+    // A user cancellation is authoritative. The bridge can report the old
+    // turn as working until cancellation reaches the provider, but that late
+    // snapshot must not reopen recovery or revive the conversation.
+    if (isCancelledWorkerStatus(run.status)) {
+      continue;
+    }
+
+    const quotaIncident = openQuotaIncidents.find((incident) => incident.runId === run.id);
+    if (quotaIncident) {
+      if (run.status !== "quota_waiting" || run.lastError || run.failedAt) {
+        await withSqliteBusyRetry(() => db.update(runs).set({
+          status: "quota_waiting",
+          failedAt: null,
+          lastError: null,
+          updatedAt: new Date(),
+        }).where(eq(runs.id, run.id)));
+      }
+      continue;
+    }
+
     const staleBusyFailure = isAgentBusyRunFailure(run);
     const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
     const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);
@@ -610,13 +661,21 @@ async function syncConversationSessionsUnlocked(rawAgents: unknown[], options: S
     const nextRunState = resolveSyncedRunState(run, agent);
     const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
     const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
-    await withSqliteBusyRetry(() => db.update(workers).set({
-      status: nextWorkerStatus,
-      cwd: agent.cwd || worker.cwd,
-      currentText: quiescedDirectWorker ? "" : agent.currentText,
-      lastText: agent.lastText,
-      updatedAt: new Date(),
-    }).where(eq(workers.id, worker.id)));
+    const nextWorkerCwd = agent.cwd || worker.cwd;
+    const nextWorkerCurrentText = quiescedDirectWorker ? "" : agent.currentText;
+    const workerChanged = worker.status !== nextWorkerStatus
+      || worker.cwd !== nextWorkerCwd
+      || worker.currentText !== nextWorkerCurrentText
+      || worker.lastText !== agent.lastText;
+    if (workerChanged) {
+      await withSqliteBusyRetry(() => db.update(workers).set({
+        status: nextWorkerStatus,
+        cwd: nextWorkerCwd,
+        currentText: nextWorkerCurrentText,
+        lastText: agent.lastText,
+        updatedAt: new Date(),
+      }).where(eq(workers.id, worker.id)));
+    }
     if (worker.status !== nextWorkerStatus) {
       emitNamedEvent({
         kind: "worker.status",

uuid: b7bb00e5-336d-4f41-906d-b0894e1bbda4
parent: 5ab57e04-bd03-42ee-9cb4-512de472d27f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:07.055Z","phase":null} -->
## Claude tool result: toolu_01WDh2cyfCUxeKKAPcTKHbSh · 2026-07-11T12:12:07.055Z

```text
 M config/accounts.yml
 M docs/architecture/lifecycle-observability-and-testing.md
 M shared/locales/de.json
 M shared/locales/en.json
 M shared/locales/es.json
 M shared/locales/fr.json
 M shared/locales/it.json
 M shared/locales/ja.json
 M shared/locales/ko.json
 M shared/locales/pt.json
 M shared/locales/zh-CN.json
 M src/app/home/HomeApp.tsx
 M src/app/home/HomeUiStateManager.ts
 M src/app/home/constants.ts
 M src/app/home/direct-control-activity.ts
 M src/app/home/sidebar-activity.ts
 M src/app/home/useConversationActions.ts
 M src/app/home/useHomeViewModel.ts
 M src/app/home/useRunRecoveryState.ts
 M src/app/home/useRunSelectionEffects.ts
 M src/app/home/utils.ts
 M src/components/MarkdownContent.tsx
 M src/components/Terminal.tsx
 M src/components/home/ConversationMain.tsx
 M src/components/home/RunRecoveryNotice.tsx
 M src/lib/project-file-links.ts
 M src/runtime/http/routes/conversations.ts
 M src/runtime/http/routes/runs.ts
 M src/server/accounts/account-allocator.ts
 M src/server/accounts/account-resolver.ts
 M src/server/accounts/migration.ts
 M src/server/agent-runtime/output-store.ts
 M src/server/bridge-client/index.ts
 M src/server/conversations/create.ts
 M src/server/conversations/direct-run-status.ts
 M src/server/conversations/queued-messages.ts
 M src/server/conversations/send-message.ts
 M src/server/conversations/sync.ts
 M src/server/git/run-auto-commit.ts
 M src/server/quota/reset-parser.ts
 M src/server/quota/worker-resume.ts
 M src/server/runs/recovery.ts
 M src/server/supervisor/resume.ts
 M src/server/supervisor/wake.ts
 M src/server/worker-models.ts
 M src/server/workers/output-store.ts
 M tests/api/conversations-route.test.ts
 M tests/api/run-route.test.ts
 M tests/app/direct-control-activity.test.ts
 M tests/app/home-view-model.test.ts
 M tests/app/home/sidebar-activity.test.ts
 M tests/conversations/direct-run-status.test.ts
 M tests/lib/project-file-links.test.ts
 M tests/server/accounts/account-allocator.test.ts
 M tests/server/accounts/account-migration.test.ts
 M tests/server/accounts/account-resolver.test.ts
 M tests/server/agent-runtime/http.test.ts
 M tests/server/agent-runtime/output-store.test.ts
 M tests/server/conversations-sync.test.ts
 M tests/server/git/run-auto-commit.test.ts
 M tests/server/quota/recovery.test.ts
 M tests/server/quota/reset-parser.test.ts
 M tests/server/workers/output-store.test.ts
 M tests/supervisor/wake.test.ts
 M tests/ui/composer-shell.test.ts
 M tests/ui/conversation-actions.test.ts
 M tests/ui/markdown-content.test.ts
 M tests/ui/sidebar-layout.test.ts
 M tests/ui/terminal-fit.test.ts
?? docs/superpowers/learnings/2026-07-02-auto-commit-messages-must-be-project-neutral.md
?? docs/superpowers/learnings/2026-07-04-account-allocation-must-rank-real-credentials.md
?? docs/superpowers/learnings/2026-07-05-direct-recovery-ask-errors-must-enter-quota-flow.md
?? docs/superpowers/learnings/2026-07-05-quota-waits-must-block-generic-live-sync.md
?? docs/superpowers/learnings/2026-07-09-cancelled-workers-must-clear-live-state.md
?? docs/superpowers/learnings/2026-07-09-quota-resume-must-clear-stale-ui-state.md
?? docs/superpowers/learnings/2026-07-09-quota-waits-must-suppress-working-ui.md
?? docs/superpowers/learnings/2026-07-09-recovery-busy-is-not-failure.md
?? docs/superpowers/learnings/2026-07-09-tail-windows-must-not-split-streamed-messages.md
?? docs/superpowers/learnings/2026-07-09-user-stop-must-retire-recovery-state.md
?? docs/superpowers/learnings/2026-07-09-worker-and-account-selection-is-compound-state.md
?? src/app/home/account-labels.ts
?? tests/app/account-labels.test.ts
?? tests/app/use-run-recovery-state.test.ts
?? tests/lifecycle/scenarios/quota-stop-terminal.test.ts

uuid: c59876c8-0b57-4e72-9953-5d4bbad55051
parent: 66d16339-d6ec-4cc1-93ac-2d4089778727
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:12:12.989Z","phase":null} -->
## Claude thinking · 2026-07-11T12:12:12.989Z



uuid: 9ce45f91-a389-4ebc-a58d-6c5a0ec08035
parent: c59876c8-0b57-4e72-9953-5d4bbad55051

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:13.342Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:13.342Z

```json
{
  "pattern": "setWhere",
  "output_mode": "files_with_matches"
}

uuid: a4ed87dd-28fe-4f2a-be21-c7d04bd9bd2e
parent: 9ce45f91-a389-4ebc-a58d-6c5a0ec08035
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:13.395Z","phase":null} -->
## Claude tool result: toolu_01Qn29uvivdZFVvpp4P9LH4d · 2026-07-11T12:12:13.395Z

```text
Found 2 files
src/runtime/http/routes/runs.ts
src/server/supervisor/wake-schedule.ts

uuid: c580d5ea-da7f-4b02-9794-a1d4539b15de
parent: a4ed87dd-28fe-4f2a-be21-c7d04bd9bd2e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:14.869Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:14.869Z

```json
{
  "pattern": "\"drizzle-orm\"",
  "path": "/Users/masterman/NLP/omniharness/package.json",
  "output_mode": "content"
}

uuid: 2f3d41a2-df49-4761-b1bf-d81fb350952a
parent: c580d5ea-da7f-4b02-9794-a1d4539b15de
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:14.879Z","phase":null} -->
## Claude tool result: toolu_01HHMVRcUCL76s1noMt3c3Nx · 2026-07-11T12:12:14.879Z

```text
52:    "drizzle-orm": "^0.45.2",

uuid: d5fe8d76-7ee5-4757-a735-eb061b4b269d
parent: 2f3d41a2-df49-4761-b1bf-d81fb350952a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:15.759Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:15.759Z

```json
{
  "pattern": "conversationReadMarkers",
  "path": "/Users/masterman/NLP/omniharness/src/server/db/schema.ts",
  "-n": true,
  "-A": 10
}

uuid: df47125a-a3a4-4b95-b73c-ceb0f0b3f01d
parent: d5fe8d76-7ee5-4757-a735-eb061b4b269d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:15.781Z","phase":null} -->
## Claude tool result: toolu_01KDqSSChETr6YLZym9cvgtK · 2026-07-11T12:12:15.781Z

```text
Found 1 file
src/server/db/schema.ts

uuid: 91eafc12-82bf-41a7-b1ae-085bf38142e3
parent: df47125a-a3a4-4b95-b73c-ceb0f0b3f01d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:12:15.986Z","phase":null} -->
## Claude attachment · 2026-07-11T12:12:15.986Z

```text
{
  "type": "deferred_tools_delta",
  "addedNames": [
    "mcp__claude_ai_Gmail__apply_sensitive_message_label",
    "mcp__claude_ai_Gmail__apply_sensitive_thread_label",
    "mcp__claude_ai_Gmail__create_draft",
    "mcp__claude_ai_Gmail__create_label",
    "mcp__claude_ai_Gmail__get_message",
    "mcp__claude_ai_Gmail__get_thread",
    "mcp__claude_ai_Gmail__label_message",
    "mcp__claude_ai_Gmail__label_thread",
    "mcp__claude_ai_Gmail__list_drafts",
    "mcp__claude_ai_Gmail__list_labels",
    "mcp__claude_ai_Gmail__search_threads",
    "mcp__claude_ai_Gmail__unlabel_message",
    "mcp__claude_ai_Gmail__unlabel_thread",
    "mcp__claude_ai_Google_Calendar__create_event",
    "mcp__claude_ai_Google_Calendar__delete_event",
    "mcp__claude_ai_Google_Calendar__get_event",
    "mcp__claude_ai_Google_Calendar__list_calendars",
    "mcp__claude_ai_Google_Calendar__list_events",
    "mcp__claude_ai_Google_Calendar__respond_to_event",
    "mcp__claude_ai_Google_Calendar__search_events",
    "mcp__claude_ai_Google_Calendar__suggest_time",
    "mcp__claude_ai_Google_Calendar__update_event",
    "mcp__claude_ai_Google_Drive__copy_file",
    "mcp__claude_ai_Google_Drive__create_file",
    "mcp__claude_ai_Google_Drive__download_file_content",
    "mcp__claude_ai_Google_Drive__get_file_metadata",
    "mcp__claude_ai_Google_Drive__get_file_permissions",
    "mcp__claude_ai_Google_Drive__list_recent_files",
    "mcp__claude_ai_Google_Drive__read_file_content",
    "mcp__claude_ai_Google_Drive__search_files"
  ],
  "addedLines": [],
  "removedNames": [],
  "readdedNames": [
    "mcp__claude_ai_Gmail__apply_sensitive_message_label",
    "mcp__claude_ai_Gmail__apply_sensitive_thread_label",
    "mcp__claude_ai_Gmail__create_draft",
    "mcp__claude_ai_Gmail__create_label",
    "mcp__claude_ai_Gmail__get_message",
    "mcp__claude_ai_Gmail__get_thread",
    "mcp__claude_ai_Gmail__label_message",
    "mcp__claude_ai_Gmail__label_thread",
    "mcp__claude_ai_Gmail__list_drafts",
    "mcp__claude_ai_Gmail__list_labels",
    "mcp__claude_ai_Gmail__search_threads",
    "mcp__claude_ai_Gmail__unlabel_message",
    "mcp__claude_ai_Gmail__unlabel_thread",
    "mcp__claude_ai_Google_Calendar__create_event",
    "mcp__claude_ai_Google_Calendar__delete_event",
    "mcp__claude_ai_Google_Calendar__get_event",
    "mcp__claude_ai_Google_Calendar__list_calendars",
    "mcp__claude_ai_Google_Calendar__list_events",
    "mcp__claude_ai_Google_Calendar__respond_to_event",
    "mcp__claude_ai_Google_Calendar__search_events",
    "mcp__claude_ai_Google_Calendar__suggest_time",
    "mcp__claude_ai_Google_Calendar__update_event",
    "mcp__claude_ai_Google_Drive__copy_file",
    "mcp__claude_ai_Google_Drive__create_file",
    "mcp__claude_ai_Google_Drive__download_file_content",
    "mcp__claude_ai_Google_Drive__get_file_metadata",
    "mcp__claude_ai_Google_Drive__get_file_permissions",
    "mcp__claude_ai_Google_Drive__list_recent_files",
    "mcp__claude_ai_Google_Drive__read_file_content",
    "mcp__claude_ai_Google_Drive__search_files"
  ],
  "pendingMcpServers": [],
  "needsAuthMcpServers": []
}

binary omitted from archive

uuid: ee700690-3b22-46ee-8ae7-d9a2d1a93e92
parent: 91eafc12-82bf-41a7-b1ae-085bf38142e3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:12:18.716Z","phase":null} -->
## Claude thinking · 2026-07-11T12:12:18.716Z



uuid: 9de5008c-0bba-42fb-8370-4edc0bc5f62b
parent: ee700690-3b22-46ee-8ae7-d9a2d1a93e92

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:19.809Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:19.809Z

```json
{
  "pattern": "setWhere",
  "path": "/Users/masterman/NLP/omniharness/src/server/supervisor/wake-schedule.ts",
  "-B": 10,
  "-A": 5
}

uuid: 393d9de1-56f8-4228-894b-54b2fc343eb7
parent: 9de5008c-0bba-42fb-8370-4edc0bc5f62b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:19.845Z","phase":null} -->
## Claude tool result: toolu_01SGxjW9EVjQF39DWLByGwgk · 2026-07-11T12:12:19.845Z

```text
Found 1 file
src/server/supervisor/wake-schedule.ts

uuid: 24066a22-40ad-4311-9562-58bb15683696
parent: 393d9de1-56f8-4228-894b-54b2fc343eb7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:20.534Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:12:20.534Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/db/schema.ts",
  "offset": 1,
  "limit": 1
}

uuid: bc1836aa-9e1d-466b-8693-d94acf3643e5
parent: 24066a22-40ad-4311-9562-58bb15683696
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:20.546Z","phase":null} -->
## Claude tool result: toolu_01ViDrfKj8SkYUJcwdVx4dVz · 2026-07-11T12:12:20.546Z

```text
1	import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

uuid: 32612985-715d-4e3f-9859-d31422cfdc05
parent: bc1836aa-9e1d-466b-8693-d94acf3643e5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:21.276Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:21.276Z

```json
{
  "pattern": "conversationReadMarkers = sqliteTable|export const conversationReadMarkers",
  "path": "/Users/masterman/NLP/omniharness/src/server/db/schema.ts",
  "-n": true,
  "-A": 10
}

uuid: 6eedaf0d-36fc-4aab-9665-1420b2607773
parent: 32612985-715d-4e3f-9859-d31422cfdc05
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:21.300Z","phase":null} -->
## Claude tool result: toolu_01EGSWf7Kqvd9y2u1NoEy1qH · 2026-07-11T12:12:21.300Z

```text
Found 1 file
src/server/db/schema.ts

uuid: 6b47b445-c7d1-4f88-9c8c-75901820b5e7
parent: 6eedaf0d-36fc-4aab-9665-1420b2607773
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:12:21.308Z","phase":null} -->
## Claude attachment · 2026-07-11T12:12:21.308Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: 86bfa632-0c19-4084-9b92-ca9b24469416
parent: 6b47b445-c7d1-4f88-9c8c-75901820b5e7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:12:25.772Z","phase":null} -->
## Claude thinking · 2026-07-11T12:12:25.772Z



uuid: 7d71ab19-0bdc-453f-9ef9-b4ab94e4ecfe
parent: 86bfa632-0c19-4084-9b92-ca9b24469416

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:26.375Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:12:26.375Z

```json
{
  "command": "find /Users/masterman/NLP/omniharness/node_modules/drizzle-orm/sqlite-core -iname \"*query-builders*\" 2>/dev/null | head -20"
}

uuid: e6729024-479f-4087-9505-d690ead24c53
parent: 7d71ab19-0bdc-453f-9ef9-b4ab94e4ecfe
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:26.418Z","phase":null} -->
## Claude tool result: toolu_015VdQiW9b3sTMVBSwxquaFk · 2026-07-11T12:12:26.418Z

```text
/Users/masterman/NLP/omniharness/node_modules/drizzle-orm/sqlite-core/query-builders

uuid: ae4d0ea7-a0a6-4ebe-9c06-2225c5bb2da2
parent: e6729024-479f-4087-9505-d690ead24c53
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:29.469Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:29.469Z

```json
{
  "pattern": "setWhere|onConflictDoUpdate",
  "path": "/Users/masterman/NLP/omniharness/node_modules/drizzle-orm/sqlite-core/query-builders",
  "-n": true,
  "output_mode": "content"
}

uuid: 71076c06-3598-4bb4-b7f5-9346da1978c0
parent: ae4d0ea7-a0a6-4ebe-9c06-2225c5bb2da2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:29.495Z","phase":null} -->
## Claude tool result: toolu_01LyyfVAjB3WHAPBfbf8GHpH · 2026-07-11T12:12:29.495Z

```text
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:104:   *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:112:   *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:119:  onConflictDoUpdate(config) {
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:120:    if (config.where && (config.targetWhere || config.setWhere)) {
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:122:        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:128:    const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js:132:      sql` on conflict ${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:128:   *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:136:   *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:143:  onConflictDoUpdate(config) {
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:144:    if (config.where && (config.targetWhere || config.setWhere)) {
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:146:        'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:152:    const setWhereSql = config.setWhere ? import_sql.sql` where ${config.setWhere}` : void 0;
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs:156:      import_sql.sql` on conflict ${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:51:    /** @deprecated - use either `targetWhere` or `setWhere` */
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:54:    setWhere?: SQL;
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:148:     *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:156:     *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:163:    onConflictDoUpdate(config: SQLiteInsertOnConflictDoUpdateConfig<this>): this;
node_modules/drizzle-orm/sqlite-core/query-builders/insert.js.map:1:[Omitted long matching line]
node_modules/drizzle-orm/sqlite-core/query-builders/insert.cjs.map:1:[Omitted long matching line]
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.cts:51:    /** @deprecated - use either `targetWhere` or `setWhere` */
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.cts:54:    setWhere?: SQL;
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.cts:148:     *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.cts:156:     *   .onConflictDoUpdate({
node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.cts:163:    onConflictDoUpdate(config: SQLiteInsertOnConflictDoUpdateConfig<this>): this;

uuid: 8cc36f6c-95c3-45e6-927a-50ee27b3c99a
parent: 71076c06-3598-4bb4-b7f5-9346da1978c0
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:12:50.310Z","phase":null} -->
## Claude thinking · 2026-07-11T12:12:50.310Z



uuid: 19a357ba-15ca-4c55-935d-d15442972ae1
parent: 8cc36f6c-95c3-45e6-927a-50ee27b3c99a

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:51.680Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:51.680Z

```json
{
  "pattern": "export (async )?function writeWorkerOutputEntries",
  "path": "/Users/masterman/NLP/omniharness/src/server/workers/output-store.ts",
  "-n": true,
  "-A": 25
}

uuid: 21016fe6-daf0-4e2b-9980-57b598e312ff
parent: 19a357ba-15ca-4c55-935d-d15442972ae1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:51.692Z","phase":null} -->
## Claude tool result: toolu_01BvX4WR5xk7uTFs2a2taFuU · 2026-07-11T12:12:51.692Z

```text
Found 1 file
src/server/workers/output-store.ts

uuid: d2edfed5-dfe7-45c9-87f4-f76b9a5b5c6f
parent: 21016fe6-daf0-4e2b-9980-57b598e312ff
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:12:54.947Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:12:54.947Z

```json
{
  "pattern": "writeWorkerOutputEntries",
  "path": "/Users/masterman/NLP/omniharness/src/server/workers/output-store.ts",
  "output_mode": "content",
  "-n": true,
  "-A": 30
}

uuid: a3b2dde5-230b-4eff-8cd7-1438d38bcd02
parent: d2edfed5-dfe7-45c9-87f4-f76b9a5b5c6f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:12:54.954Z","phase":null} -->
## Claude tool result: toolu_019Q2SDefQtTidaGUa26Jbfb · 2026-07-11T12:12:54.954Z

```text
924:export async function writeWorkerOutputEntries(
925-  runId: string,
926-  workerId: string,
927-  entries: AgentRecord["outputEntries"],
928-) {
929-  if (!Array.isArray(entries) || entries.length === 0) {
930-    return;
931-  }
932-
933-  await runOnChain(runId, workerId, async () => {
934-    await withWorkerFileLock(runId, workerId, async (paths) => {
935-      await expandWorkerOutputFileInternal(paths);
936-
937-      const { fingerprints } = await refreshChainCaches(runId, workerId);
938-      const newEntries: AgentOutputEntry[] = [];
939-      const acceptedFingerprintsById = new Map<string, string>();
940-      for (const entry of entries) {
941-        if (!entry) continue;
942-        // The agent-runtime live view prepends a synthetic archive marker
943-        // ("X older raw worker activity records are only in archived
944-        // history…") when entries have been pruned past the live window.
945-        // It is a render-time hint, not real conversation content — never
946-        // persist it into the unified worker stream.
947-        if (entry.id === "output-archive-marker") {
948-          continue;
949-        }
950-        // Real bridge entries always carry an id; tooling/migration code that
951-        // hands us synthetic snapshots may not. In that case, treat the entry
952-        // as opaque and always append (no dedup possible).
953-        //
954-        / Dedup keyed on (id, fingerprint): re-writing the exact same
--
981:        throw new Error(`writeWorkerOutputEntries: missing nextSeq for ${key}`);
982-      }
983-
984-      const target = paths.filePath;
985-      const newlineGuard = await needsLeadingNewline(target);
986-
987-      const lines: string[] = [];
988-      const appendedEntries: WorkerEntry[] = [];
989-      for (const entry of newEntries) {
990-        const id = typeof entry.id === "string" && entry.id ? entry.id : `synthetic-${nextSeq}`;
991-        / Preserve input shape: spread the entry first, then layer on
992-        // id/seq. Adding null placeholders for absent optional fields
993-        // would change the on-disk shape callers expect to round-trip.
994-        const promoted = {
995-          ...(entry as unknown as Record<string, unknown>),
996-          id,
997-          seq: nextSeq,
998-        };
999-        const compact = compactEntryForHistory(promoted as unknown as CompactableEntry) as unknown as WorkerEntry;
1000-        lines.push(JSON.stringify(compact));
1001-        appendedEntries.push(compact);
1002-        fingerprints.set(id, workerEntryFingerprint(compact));
1003-        nextSeq += 1;
1004-      }
1005-      const body = lines.join("\n") + "\n";
1006-
1007-      const handle = await fs.open(target, "a");
1008-      try {
1009-        await handle.appendFile(newlineGuard ? "\n" + body : body, "utf8");
1010-        await handle.sync();
1011-      } finally {
--
1749:  // the same Node process as this reader (see writeWorkerOutputEntries
1750-  // call sites — sync.ts, snapshots.ts, recovery-reconciler.ts), so
1751-  // this cache cannot fall behind disk.
1752-  const nextSeq = nextSeqByKey.get(key);
1753-  if (nextSeq !== undefined && nextSeq > 0) {
1754-    return nextSeq - 1;
1755-  }
1756-
1757-  const { filePath } = await workerStreamPaths(runId, workerId, "read");
1758-  let statForCache: { size: number; mtimeMs: number } | null = null;
1759-  try {
1760-    const stat = await fs.stat(filePath);
1761-    statForCache = { size: stat.size, mtimeMs: stat.mtimeMs };
1762-    const cached = readLatestSeqByKey.get(key);
1763-    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
1764-      return cached.latestSeq;
1765-    }
1766-    if (stat.size > 0) {
1767-      / Prefer the sparse seq→offset index: seek to the last indexed
1768-      // point (within INDEX_CADENCE records of EOF) and read forward
1769-      // instead of scanning backward from EOF in 64KB chunks. Falls
1770-      // back to the backward scan when the index is missing.
1771-      const seqViaIndex = await readLatestSeqViaIndex(filePath, stat.size);
1772-      if (seqViaIndex !== null) {
1773-        readLatestSeqByKey.set(key, { latestSeq: seqViaIndex, size: stat.size, mtimeMs: stat.mtimeMs });
1774-        return seqViaIndex;
1775-      }
1776-      const seq = await readLatestSeqFromJsonlTail(filePath, stat.size);
1777-      if (seq !== null) {
1778-        readLatestSeqByKey.set(key, { latestSeq: seq, size: stat.size, mtimeMs: stat.mtimeMs });
1779-        return seq;

uuid: 8d86a54c-4f8b-462e-888a-fdbf3f19a82c
parent: a3b2dde5-230b-4eff-8cd7-1438d38bcd02
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:12:59.825Z","phase":null} -->
## Claude thinking · 2026-07-11T12:12:59.825Z



uuid: e1766fbe-71b3-4fe6-8707-1ccded1cfba2
parent: 8d86a54c-4f8b-462e-888a-fdbf3f19a82c

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:00.068Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:13:00.068Z

```json
{
  "command": "git diff -- tests/conversations/direct-run-status.test.ts tests/api/run-route.test.ts tests/server/conversations-sync.test.ts"
}

uuid: b1fa5509-2e17-4de6-a182-7f2cfec4073e
parent: e1766fbe-71b3-4fe6-8707-1ccded1cfba2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:00.132Z","phase":null} -->
## Claude tool result: toolu_01SVCTnAh9hBAxmSYh8goJtt · 2026-07-11T12:13:00.132Z

```text
diff --git a/tests/api/run-route.test.ts b/tests/api/run-route.test.ts
index 4c9113d..7df9bf8 100644
--- a/tests/api/run-route.test.ts
+++ b/tests/api/run-route.test.ts
@@ -19,8 +19,12 @@ import {
   executionEvents,
   creditEvents,
   accounts,
+  recoveryIncidents,
   settings,
+  supervisorScheduledWakes,
   workerAssignments,
+  workerCredentialAllocations,
+  workerTokenUsage,
 } from "@/server/db/schema";
 import { PATCH, DELETE, POST } from "@/app/api/runs/[id]/route";
 
@@ -306,6 +310,44 @@ describe("POST /api/runs/[id]", () => {
     expect(marker?.lastReadAt).toEqual(completedAt);
   });
 
+  it("does not emit another read event when the persisted marker is already current", async () => {
+    __resetNamedEventsForTests();
+    const planId = randomUUID();
+    const runId = randomUUID();
+    const createdAt = new Date("2026-07-11T10:00:00.000Z");
+    const awaitingAt = new Date("2026-07-11T10:05:00.000Z");
+
+    await db.insert(plans).values({
+      id: planId,
+      path: "vibes/ad-hoc/idempotent-mark-read.md",
+      status: "running",
+      createdAt,
+      updatedAt: awaitingAt,
+    });
+    await db.insert(runs).values({
+      id: runId,
+      planId,
+      mode: "direct",
+      title: "Idempotent mark read",
+      status: "awaiting_user",
+      createdAt,
+      updatedAt: awaitingAt,
+    });
+
+    const markRead = () => POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
+      method: "POST",
+      body: JSON.stringify({ action: "mark_read" }),
+    }), { params: Promise.resolve({ id: runId }) });
+
+    expect((await markRead()).status).toBe(200);
+    expect((await markRead()).status).toBe(200);
+
+    const readEvents = getNamedEventsSince(0).events.filter((entry) => (
+      entry.event.kind === "conversation.read" && entry.event.runId === runId
+    ));
+    expect(readEvents).toHaveLength(1);
+  });
+
   it("archives a conversation without deleting its persisted records", async () => {
     const planId = randomUUID();
     const runId = randomUUID();
@@ -532,6 +574,162 @@ describe("POST /api/runs/[id]", () => {
     expect(stopEvents.filter((event) => event.eventType === "supervisor_stopped")).toHaveLength(1);
   });
 
+  it("stops a quota-waiting run instead of treating it as already settled", async () => {
+    __resetNamedEventsForTests();
+    mockCancelAgent.mockClear();
+    mockStopRunObserver.mockClear();
+    mockCancelSupervisorWake.mockClear();
+    const planId = randomUUID();
+    const runId = randomUUID();
+    const workerId = randomUUID();
+    const incidentId = randomUUID();
+    const now = new Date();
+
+    await db.insert(plans).values({
+      id: planId,
+      path: "vibes/ad-hoc/stop-quota-wait.md",
+      status: "running",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(runs).values({
+      id: runId,
+      planId,
+      mode: "direct",
+      title: "Stop quota wait",
+      status: "quota_waiting",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(workers).values({
+      id: workerId,
+      runId,
+      type: "claude",
+      status: "cred-exhausted",
+      cwd: process.cwd(),
+      outputLog: "",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(recoveryIncidents).values({
+      id: incidentId,
+      runId,
+      workerId,
+      kind: "quota_exhausted",
+      status: "open",
+      details: JSON.stringify({ recoveryState: "quota_waiting", resumeAt: new Date(now.getTime() + 60_000).toISOString() }),
+      detectedAt: now,
+      updatedAt: now,
+    });
+    await db.insert(supervisorScheduledWakes).values({
+      runId,
+      wakeAt: new Date(now.getTime() + 60_000),
+      reason: "quota_wait",
+      source: "test",
+      incidentId,
+      details: JSON.stringify({ recoveryState: "quota_waiting" }),
+      createdAt: now,
+      updatedAt: now,
+    });
+
+    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
+      method: "POST",
+      body: JSON.stringify({ action: "stop_supervisor" }),
+    }), { params: Promise.resolve({ id: runId }) });
+    const payload = await response.json();
+    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
+    const updatedIncident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
+    const scheduledWake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
+    const stopEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
+    const namedEvents = getNamedEventsSince(0).events.map((entry) => entry.event);
+
+    expect(response.status).toBe(200);
+    expect(payload).toMatchObject({ ok: true, runId });
+    expect(payload).not.toHaveProperty("alreadyStopped");
+    expect(updatedRun?.status).toBe("cancelled");
+    expect(updatedIncident?.status).toBe("resolved");
+    expect(updatedIncident?.resolvedAt).toBeInstanceOf(Date);
+    expect(scheduledWake).toBeUndefined();
+    expect(mockCancelSupervisorWake).toHaveBeenCalledWith(runId);
+    expect(mockStopRunObserver).toHaveBeenCalledWith(runId);
+    expect(mockCancelAgent).not.toHaveBeenCalled();
+    expect(stopEvents.some((event) => event.eventType === "supervisor_stopped")).toBe(true);
+    expect(namedEvents).toContainEqual({
+      kind: "recovery.resolved",
+      runId,
+      incidentId,
+    });
+  });
+
+  it("keeps a direct quota-waiting conversation stopped after stop_worker", async () => {
+    const planId = randomUUID();
+    const runId = randomUUID();
+    const workerId = randomUUID();
+    const incidentId = randomUUID();
+    const now = new Date();
+
+    await db.insert(plans).values({
+      id: planId,
+      path: "vibes/ad-hoc/stop-direct-quota-wait.md",
+      status: "running",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(runs).values({
+      id: runId,
+      planId,
+      mode: "direct",
+      title: "Stop direct quota wait",
+      status: "quota_waiting",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(workers).values({
+      id: workerId,
+      runId,
+      type: "claude",
+      status: "cred-exhausted",
+      cwd: process.cwd(),
+      outputLog: "",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(recoveryIncidents).values({
+      id: incidentId,
+      runId,
+      workerId,
+      kind: "quota_exhausted",
+      status: "open",
+      details: JSON.stringify({ resumeAt: new Date(now.getTime() + 60_000).toISOString() }),
+      detectedAt: now,
+      updatedAt: now,
+    });
+    await db.insert(supervisorScheduledWakes).values({
+      runId,
+      wakeAt: new Date(now.getTime() + 60_000),
+      reason: "quota_wait",
+      source: "test",
+      incidentId,
+      createdAt: now,
+      updatedAt: now,
+    });
+
+    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
+      method: "POST",
+      body: JSON.stringify({ action: "stop_worker", workerId }),
+    }), { params: Promise.resolve({ id: runId }) });
+    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
+    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
+    const updatedIncident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
+    const scheduledWake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
+
+    expect(response.status).toBe(200);
+    expect(updatedRun?.status).toBe("cancelled");
+    expect(updatedWorker?.status).toBe("cancelled");
+    expect(updatedIncident?.status).toBe("resolved");
+    expect(scheduledWake).toBeUndefined();
+  });
+
   it("stops a single direct worker without stopping the supervisor", async () => {
     mockCancelAgent.mockClear();
     mockStopRunObserver.mockClear();
@@ -788,6 +986,8 @@ describe("POST /api/runs/[id]", () => {
       status: "working",
       cwd: process.cwd(),
       outputLog: "",
+      currentText: "Still streaming stale work",
+      lastText: "",
       createdAt: now,
       updatedAt: now,
     });
@@ -813,6 +1013,8 @@ describe("POST /api/runs/[id]", () => {
     expect(mockCancelAgent).toHaveBeenCalledWith(targetWorkerId);
     expect(updatedRun?.status).toBe("cancelled");
     expect(updatedWorker?.status).toBe("cancelled");
+    expect(updatedWorker?.currentText).toBe("");
+    expect(updatedWorker?.lastText).toBe("Still streaming stale work");
     expect(stopEvent?.eventType).toBe("worker_cancelled");
     expect(JSON.parse(stopEvent?.details || "{}")).toMatchObject({ runCancelled: true });
   });
@@ -1842,6 +2044,200 @@ describe("POST /api/runs/[id]", () => {
     }));
   });
 
+  it("does not fail direct recovery when the saved worker is already active", async () => {
+    mockAskAgent.mockClear();
+    mockGetAgent.mockClear();
+    mockSpawnAgent.mockClear();
+    mockStartSupervisorRun.mockClear();
+    const planId = randomUUID();
+    const runId = randomUUID();
+    const workerId = `${runId}-worker-1`;
+    const userMessageId = randomUUID();
+
+    await db.insert(plans).values({
+      id: planId,
+      path: path.join("vibes", "ad-hoc", `${randomUUID()}.md`),
+      status: "failed",
+      createdAt: new Date(),
+      updatedAt: new Date(),
+    });
+    await db.insert(runs).values({
+      id: runId,
+      planId,
+      mode: "direct",
+      title: "Already active recovery",
+      projectPath: "/workspace/app",
+      status: "failed",
+      lastError: `Ask failed: Agent not found: ${workerId}`,
+      failedAt: new Date("2026-05-10T10:55:35Z"),
+      createdAt: new Date("2026-05-10T10:55:30Z"),
+      updatedAt: new Date("2026-05-10T10:55:35Z"),
+    });
+    await db.insert(workers).values({
+      id: workerId,
+      runId,
+      type: "claude",
+      status: "error",
+      cwd: "/workspace/app",
+      outputLog: "",
+      bridgeSessionId: "saved-session",
+      bridgeSessionMode: "full-access",
+      createdAt: new Date(),
+      updatedAt: new Date(),
+    });
+    await db.insert(messages).values({
+      id: userMessageId,
+      runId,
+      role: "user",
+      kind: "checkpoint",
+      content: "continue the walkthrough",
+      createdAt: new Date("2026-05-10T10:55:32Z"),
+    });
+
+    mockSpawnAgent.mockRejectedValueOnce(new Error(`Agent already exists: ${workerId}`));
+    mockGetAgent.mockResolvedValueOnce({
+      name: workerId,
+      type: "claude",
+      state: "working",
+      cwd: "/workspace/app",
+      sessionId: "saved-session",
+      sessionMode: "full-access",
+      currentText: "Already working",
+      lastText: "",
+      outputEntries: [],
+      stderrBuffer: [],
+      stopReason: null,
+    });
+
+    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
+      method: "POST",
+      body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
+    }), { params: Promise.resolve({ id: runId }) });
+    const payload = await response.json();
+    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
+    const storedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
+    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
+
+    expect(response.status).toBe(200);
+    expect(payload).toMatchObject({ ok: true, runId });
+    expect(mockAskAgent).not.toHaveBeenCalled();
+    expect(storedRun?.status).toBe("running");
+    expect(storedRun?.lastError).toBeNull();
+    expect(storedRun?.failedAt).toBeNull();
+    expect(storedWorker?.status).toBe("working");
+    expect(events.some((event) => event.eventType === "direct_retry_worker_already_active")).toBe(true);
+  });
+
+  it("parks direct saved-session recovery when Claude hits its session limit", async () => {
+    vi.useFakeTimers();
+    const localNow = new Date(2026, 6, 5, 16, 0, 0, 0);
+    vi.setSystemTime(localNow);
+    try {
+      mockAskAgent.mockClear();
+      mockCancelAgent.mockClear();
+      mockGetAgent.mockClear();
+      mockSpawnAgent.mockClear();
+      mockStartSupervisorRun.mockClear();
+      const planId = randomUUID();
+      const runId = randomUUID();
+      const workerId = `${runId}-worker-1`;
+      const userMessageId = randomUUID();
+
+      await db.insert(plans).values({
+        id: planId,
+        path: path.join("vibes", "ad-hoc", `${randomUUID()}.md`),
+        status: "running",
+        createdAt: localNow,
+        updatedAt: localNow,
+      });
+
+      await db.insert(runs).values({
+        id: runId,
+        planId,
+        mode: "direct",
+        title: "Direct Claude quota resume",
+        projectPath: "/workspace/app",
+        preferredWorkerType: "claude",
+        preferredWorkerModel: "claude-sonnet-5",
+        preferredWorkerEffort: "high",
+        status: "failed",
+        lastError: `Ask failed: Agent not found: ${workerId}`,
+        failedAt: localNow,
+        createdAt: localNow,
+        updatedAt: localNow,
+      });
+
+      await db.insert(workers).values({
+        id: workerId,
+        runId,
+        type: "claude",
+        status: "error",
+        cwd: "/workspace/app",
+        bridgeSessionId: "saved-session",
+        bridgeSessionMode: "direct",
+        outputLog: "",
+        outputEntriesJson: "[]",
+        currentText: "",
+        lastText: "Previous answer.",
+        createdAt: localNow,
+        updatedAt: localNow,
+      });
+
+      await db.insert(messages).values({
+        id: userMessageId,
+        runId,
+        role: "user",
+        kind: "checkpoint",
+        content: "continue the walkthrough",
+        createdAt: localNow,
+      });
+
+      mockSpawnAgent.mockResolvedValueOnce({
+        name: workerId,
+        type: "claude",
+        state: "idle",
+        cwd: "/workspace/app",
+        sessionId: "resumed-session",
+        sessionMode: "direct",
+        lastText: "Previous answer.",
+        currentText: "",
+        outputEntries: [],
+        stderrBuffer: [],
+        stopReason: null,
+      });
+      mockAskAgent.mockRejectedValueOnce(Object.assign(
+        new Error("Ask failed: Internal error: You've hit your session limit · resets 4:50pm (Europe/Madrid)"),
+        { data: { errorKind: "rate_limit" } },
+      ));
+
+      const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
+        method: "POST",
+        body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
+      }), { params: Promise.resolve({ id: runId }) });
+      const payload = await response.json();
+
+      const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
+      const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
+      const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
+      const wake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
+      const details = incident?.details ? JSON.parse(incident.details) as Record<string, unknown> : {};
+
+      expect(response.status).toBe(200);
+      expect(payload).toMatchObject({ ok: true, runId, recoveryState: "quota_waiting" });
+      expect(updatedRun?.status).toBe("quota_waiting");
+      expect(updatedRun?.lastError).toBeNull();
+      expect(updatedWorker?.status).toBe("cred-exhausted");
+      expect(incident).toMatchObject({ kind: "quota_exhausted", status: "open" });
+      expect(details.recommendedAction).toBe("wait_for_quota_reset");
+      expect(details.quotaResetSource).toBe("time-of-day");
+      expect(wake?.wakeAt.getHours()).toBe(16);
+      expect(wake?.wakeAt.getMinutes()).toBe(50);
+      expect(wake?.wakeAt.getSeconds()).toBe(1);
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+
   it("retries a direct conversation with a fresh worker when saved session metadata is missing", async () => {
     __resetNamedEventsForTests();
     mockAskAgent.mockClear();
@@ -2668,6 +3064,32 @@ describe("DELETE /api/runs/[id]", () => {
       createdAt: new Date(),
     });
 
+    await db.insert(workerCredentialAllocations).values({
+      id: randomUUID(),
+      runId,
+      workerId,
+      workerType: "codex",
+      accountId,
+      strategy: "manual",
+      selectionReason: "delete regression test",
+      explicit: true,
+      createdAt: new Date(),
+      updatedAt: new Date(),
+    });
+
+    await db.insert(workerTokenUsage).values({
+      id: randomUUID(),
+      runId,
+      workerId,
+      workerType: "codex",
+      accountId,
+      model: "gpt-5",
+      inputTokens: 10,
+      outputTokens: 5,
+      occurredAt: new Date(),
+      createdAt: new Date(),
+    });
+
     const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
       method: "DELETE",
     });
@@ -2681,6 +3103,8 @@ describe("DELETE /api/runs/[id]", () => {
     expect(await db.select().from(workers).where(eq(workers.id, workerId)).get()).toBeUndefined();
     expect(await db.select().from(planItems).where(eq(planItems.id, itemId)).get()).toBeUndefined();
     expect(await db.select().from(workerAssignments).where(eq(workerAssignments.runId, runId))).toHaveLength(0);
+    expect(await db.select().from(workerCredentialAllocations).where(eq(workerCredentialAllocations.runId, runId))).toHaveLength(0);
+    expect(await db.select().from(workerTokenUsage).where(eq(workerTokenUsage.runId, runId))).toHaveLength(0);
     expect(fs.existsSync(adHocAbsolutePath)).toBe(false);
   });
 });
diff --git a/tests/conversations/direct-run-status.test.ts b/tests/conversations/direct-run-status.test.ts
index 5255e6f..b0c29d0 100644
--- a/tests/conversations/direct-run-status.test.ts
+++ b/tests/conversations/direct-run-status.test.ts
@@ -1,4 +1,5 @@
 import { beforeEach, describe, expect, it, vi } from "vitest";
+import { eq } from "drizzle-orm";
 import { db } from "@/server/db";
 import { plans, runs } from "@/server/db/schema";
 
@@ -122,4 +123,35 @@ describe("directWorkerOutputHasPendingHumanInput", () => {
 
     expect(mockRunMilestoneAutoCommit).toHaveBeenCalledWith("run-direct-auto-commit", "Done.");
   });
+
+  it("preserves the run activity timestamp when repeated input observations do not change state", async () => {
+    const originalUpdatedAt = new Date("2026-07-11T10:00:00.000Z");
+    await db.insert(plans).values({
+      id: "plan-direct-awaiting-noop",
+      path: "vibes/ad-hoc/direct-awaiting-noop.md",
+      status: "running",
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+    await db.insert(runs).values({
+      id: "run-direct-awaiting-noop",
+      planId: "plan-direct-awaiting-noop",
+      mode: "direct",
+      title: "Direct awaiting no-op",
+      status: "awaiting_user",
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+
+    await updateDirectRunStatusFromWorkerOutput({
+      runId: "run-direct-awaiting-noop",
+      workerId: "worker-1",
+      workerStatus: "working",
+      pendingElicitations: [{ requestId: 2 }],
+    });
+
+    const run = await db.select().from(runs).where(eq(runs.id, "run-direct-awaiting-noop")).get();
+    expect(run?.status).toBe("awaiting_user");
+    expect(run?.updatedAt).toEqual(originalUpdatedAt);
+  });
 });
diff --git a/tests/server/conversations-sync.test.ts b/tests/server/conversations-sync.test.ts
index 44a53f6..b83d917 100644
--- a/tests/server/conversations-sync.test.ts
+++ b/tests/server/conversations-sync.test.ts
@@ -146,6 +146,92 @@ describe("syncConversationSessions", () => {
     expect(mockStartSupervisorRun).not.toHaveBeenCalled();
   });
 
+  it("preserves direct quota waits even when the bridge still reports a live worker", async () => {
+    const planId = randomUUID();
+    const runId = randomUUID();
+    const workerId = `${runId}-worker-1`;
+    const now = new Date();
+    const resumeAt = new Date(now.getTime() + 60 * 60_000);
+
+    await db.insert(plans).values({
+      id: planId,
+      path: "vibes/ad-hoc/direct-quota.md",
+      status: "running",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(runs).values({
+      id: runId,
+      planId,
+      mode: "direct",
+      status: "running",
+      lastError: "stale failure",
+      title: "Direct quota wait",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(workers).values({
+      id: workerId,
+      runId,
+      type: "claude",
+      status: "cred-exhausted",
+      cwd: process.cwd(),
+      bridgeSessionId: "claude-session-1",
+      bridgeSessionMode: "full-access",
+      outputLog: "",
+      outputEntriesJson: "[]",
+      currentText: "You've hit your session limit · resets 10:40am (Europe/Madrid)",
+      lastText: "You've hit your session limit · resets 10:40am (Europe/Madrid)",
+      createdAt: now,
+      updatedAt: now,
+    });
+    await db.insert(recoveryIncidents).values({
+      id: randomUUID(),
+      runId,
+      workerId,
+      queuedMessageId: null,
+      kind: "quota_exhausted",
+      status: "open",
+      autoAttemptCount: 0,
+      lastError: "session limit",
+      details: JSON.stringify({
+        recoveryState: "quota_waiting",
+        recommendedAction: "wait_for_quota_reset",
+        resumeAt: resumeAt.toISOString(),
+      }),
+      detectedAt: now,
+      updatedAt: now,
+      resolvedAt: null,
+    });
+
+    await syncConversationSessions([{
+      name: workerId,
+      type: "claude",
+      cwd: process.cwd(),
+      state: "working",
+      sessionId: "claude-session-1",
+      sessionMode: "full-access",
+      currentText: "still live",
+      lastText: "",
+      renderedOutput: "",
+      outputEntries: [],
+      pendingPermissions: [],
+      pendingElicitations: [],
+      stderrBuffer: [],
+      stopReason: null,
+      lastError: null,
+    }], { selectedRunId: runId });
+
+    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
+    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
+
+    expect(run?.status).toBe("quota_waiting");
+    expect(run?.lastError).toBeNull();
+    expect(worker?.status).toBe("cred-exhausted");
+    expect(worker?.currentText).toContain("session limit");
+    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
+  });
+
   it("marks a selected planning run for recovery when its active worker is missing without a saved session", async () => {
     const planId = randomUUID();
     const runId = randomUUID();
@@ -835,6 +921,77 @@ describe("syncConversationSessions", () => {
     expect(worker?.status).toBe("working");
   });
 
+  it("does not rewrite an unchanged direct worker that is still awaiting the same elicitation", async () => {
+    const planId = randomUUID();
+    const runId = randomUUID();
+    const workerId = `${runId}-worker-1`;
+    const originalUpdatedAt = new Date("2026-07-11T10:00:00.000Z");
+    const question = "Which niche can you reach first?";
+
+    await db.insert(plans).values({
+      id: planId,
+      path: "vibes/ad-hoc/direct-elicitation-noop.md",
+      status: "running",
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+    await db.insert(runs).values({
+      id: runId,
+      planId,
+      mode: "direct",
+      status: "awaiting_user",
+      title: "Direct elicitation no-op",
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+    await db.insert(workers).values({
+      id: workerId,
+      runId,
+      type: "claude",
+      status: "working",
+      cwd: process.cwd(),
+      outputLog: "",
+      outputEntriesJson: "[]",
+      currentText: question,
+      lastText: question,
+      workerNumber: 1,
+      createdAt: originalUpdatedAt,
+      updatedAt: originalUpdatedAt,
+    });
+
+    await syncConversationSessions([{
+      name: workerId,
+      type: "claude",
+      cwd: process.cwd(),
+      state: "working",
+      sessionId: "elicitation-session",
+      sessionMode: "full-access",
+      currentText: question,
+      lastText: question,
+      renderedOutput: question,
+      outputEntries: [],
+      pendingElicitations: [{
+        requestId: 2,
+        requestedAt: originalUpdatedAt.toISOString(),
+        sessionId: "elicitation-session",
+        toolCallId: "ask-tool",
+        message: question,
+        requestedSchema: { type: "object", properties: {} },
+      }],
+      pendingPermissions: [],
+      stderrBuffer: [],
+      stopReason: null,
+    }], { selectedRunId: runId });
+
+    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
+    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
+
+    expect(run?.status).toBe("awaiting_user");
+    expect(run?.updatedAt).toEqual(originalUpdatedAt);
+    expect(worker?.status).toBe("working");
+    expect(worker?.updatedAt).toEqual(originalUpdatedAt);
+  });
+
   it("drains an awaiting direct worker when the list snapshot only has an open elicitation entry", async () => {
     const planId = randomUUID();
     const runId = randomUUID();

uuid: a6c2081d-0321-491a-a53d-f6f72898d6de
parent: b1fa5509-2e17-4de6-a182-7f2cfec4073e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:05.109Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:05.109Z



uuid: e9c4e57c-8fbb-4aba-bf08-d8a65a6c0633
parent: a6c2081d-0321-491a-a53d-f6f72898d6de

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:05.749Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:13:05.749Z

```json
{
  "command": "npx vitest run tests/conversations/direct-run-status.test.ts tests/api/run-route.test.ts tests/server/conversations-sync.test.ts --reporter=basic 2>&1 | tail -100"
}

uuid: 651d6b8f-5130-4c60-9d82-5d65f4f78b3e
parent: e9c4e57c-8fbb-4aba-bf08-d8a65a6c0633
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:05.766Z","phase":null} -->
## Claude tool result: toolu_01KaBnyghNHFjiQoSFFWQ4zv · 2026-07-11T12:13:05.766Z

```text
This Bash command contains multiple operations. The following part requires approval: npx vitest run tests/conversations/direct-run-status.test.ts tests/api/run-route.test.ts tests/server/conversations-sync.test.ts --reporter=basic 2>&1

uuid: 5bd79ea0-90b8-49f4-a964-d66ed8b8877d
parent: 651d6b8f-5130-4c60-9d82-5d65f4f78b3e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:09.218Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:09.218Z



uuid: 67984914-7f44-498e-add6-ea0be0879d48
parent: 5bd79ea0-90b8-49f4-a964-d66ed8b8877d

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:09.371Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:13:09.371Z

```json
{
  "command": "npx vitest run tests/conversations/direct-run-status.test.ts"
}

uuid: 57e61ecc-0e9e-4df6-ac23-7ddc7a6ef09f
parent: 67984914-7f44-498e-add6-ea0be0879d48
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:09.388Z","phase":null} -->
## Claude tool result: toolu_01R5kqDTckBCuzN6tB9nobzo · 2026-07-11T12:13:09.388Z

```text
This command requires approval

uuid: 50e789b3-f9df-4f13-a311-b33b1c0fbded
parent: 57e61ecc-0e9e-4df6-ac23-7ddc7a6ef09f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:13.674Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:13.674Z



uuid: be10d5bc-2662-4972-a6ac-6321f9892791
parent: 50e789b3-f9df-4f13-a311-b33b1c0fbded

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:14.627Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:13:14.627Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts",
  "offset": 295,
  "limit": 50
}

uuid: 76de088e-2b7f-4cb7-8482-d1ae5a5a3d3f
parent: be10d5bc-2662-4972-a6ac-6321f9892791
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:14.639Z","phase":null} -->
## Claude tool result: toolu_01MiziGbcmk7mdLXL5HTMWjB · 2026-07-11T12:13:14.639Z

```text
295	async function markRunRead(runId: string, run: typeof runs.$inferSelect) {
296	  const runMessages = await db.select({
297	    runId: messages.runId,
298	    createdAt: messages.createdAt,
299	  }).from(messages).where(eq(messages.runId, runId));
300	  const lastReadAtIso = getRunLatestUnreadTimestamp(
301	    {
302	      id: run.id,
303	      status: run.status,
304	      createdAt: run.createdAt.toISOString(),
305	      updatedAt: run.updatedAt.toISOString(),
306	    },
307	    runMessages.map((message) => ({
308	      runId: message.runId,
309	      createdAt: message.createdAt.toISOString(),
310	    })),
311	  );
312	
313	  if (!lastReadAtIso) {
314	    return null;
315	  }
316	
317	  const now = new Date();
318	  const lastReadAt = new Date(lastReadAtIso);
319	  const changedMarkers = await db.insert(conversationReadMarkers)
320	    .values({
321	      runId,
322	      lastReadAt,
323	      createdAt: now,
324	      updatedAt: now,
325	    })
326	    .onConflictDoUpdate({
327	      target: conversationReadMarkers.runId,
328	      set: {
329	        lastReadAt,
330	        updatedAt: now,
331	      },
332	      setWhere: lt(conversationReadMarkers.lastReadAt, lastReadAt),
333	    })
334	    .returning({ lastReadAt: conversationReadMarkers.lastReadAt });
335	
336	  if (changedMarkers.length === 0) {
337	    const currentMarker = await db.select({
338	      lastReadAt: conversationReadMarkers.lastReadAt,
339	    }).from(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId)).get();
340	    return currentMarker?.lastReadAt.toISOString() ?? lastReadAt.toISOString();
341	  }
342	
343	  emitNamedEvent({ kind: "conversation.read", runId, lastReadAt: lastReadAt.toISOString() });
344	  return lastReadAt.toISOString();

uuid: 00a4c172-c5f5-4994-a7e9-c0f2f41b4195
parent: 76de088e-2b7f-4cb7-8482-d1ae5a5a3d3f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:30.766Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:30.766Z



uuid: 46178baf-7760-43f8-a87c-dbcbafaad833
parent: 00a4c172-c5f5-4994-a7e9-c0f2f41b4195

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:30.801Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:13:30.801Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/direct-run-status.ts",
  "offset": 126,
  "limit": 50
}

uuid: c5c99e43-08d3-473d-bcb6-130a2a7bd554
parent: 46178baf-7760-43f8-a87c-dbcbafaad833
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:30.809Z","phase":null} -->
## Claude tool result: toolu_01YZLz2NxcpKSB3KKD2dW4Qx · 2026-07-11T12:13:30.809Z

```text
126	export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
127	  runId: string;
128	  workerId?: string | null;
129	}) {
130	  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
131	  if (!run || (run.mode !== "direct" && run.mode !== "commit")) {
132	    return null;
133	  }
134	
135	  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
136	  const now = new Date();
137	  if (run.status !== nextStatus || run.failedAt || run.lastError) {
138	    await db.update(runs).set({
139	      status: nextStatus,
140	      failedAt: null,
141	      lastError: null,
142	      updatedAt: now,
143	    }).where(eq(runs.id, args.runId));
144	  }
145	
146	  if (nextStatus === "awaiting_user" && run.status !== "awaiting_user") {
147	    emitNamedEvent({
148	      kind: "conversation.awaiting_user",
149	      runId: args.runId,
150	      workerId: args.workerId ?? undefined,
151	      reason: "worker_requested_input",
152	    });
153	    await recordExecutionEvent({
154	      runId: args.runId,
155	      workerId: args.workerId ?? null,
156	      planItemId: null,
157	      eventType: "direct_worker_awaiting_user",
158	      details: { reason: "worker_requested_input" },
159	      createdAt: now,
160	    });
161	  } else if (run.mode === "direct" && nextStatus === "done" && run.status !== "done") {
162	    await runMilestoneAutoCommit(args.runId, firstNonEmptyText([
163	      args.responseText,
164	      args.currentText,
165	      args.lastText,
166	      latestVisibleEntryText(args.outputEntries),
167	      latestVisibleEntryText(parseOutputEntriesJson(args.outputEntriesJson)),
168	      args.renderedOutput,
169	      args.outputLog,
170	    ]));
171	    notifyEventStreamSubscribers();
172	  } else if (nextStatus !== run.status || run.failedAt || run.lastError) {
173	    notifyEventStreamSubscribers();
174	  }
175	

uuid: cc35fce6-0a41-416b-b68d-67ae4764ccc8
parent: c5c99e43-08d3-473d-bcb6-130a2a7bd554
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:37.444Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:37.444Z



uuid: 1b70e6dc-15ee-4f80-85cf-4597e8bfa252
parent: cc35fce6-0a41-416b-b68d-67ae4764ccc8

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:38.334Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:13:38.334Z

```json
{
  "pattern": "updateDirectRunStatusFromWorkerOutput",
  "output_mode": "content",
  "-n": true,
  "-B": 3,
  "-A": 8
}

uuid: bf8dae12-4273-4ad0-8816-c9a2fd3f53ef
parent: 1b70e6dc-15ee-4f80-85cf-4597e8bfa252
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:38.397Z","phase":null} -->
## Claude tool result: toolu_01K6HCLXXF8peJopQCXCgL91 · 2026-07-11T12:13:38.397Z

```text
<persisted-output>
Output too large (26.3KB). Full output saved to: /Users/masterman/.claude/projects/-Users-masterman-NLP-omniharness/8639a63d-9e9b-40d3-aa14-ad3b7a188baa/tool-results/toolu_01K6HCLXXF8peJopQCXCgL91.txt

Preview (first 2KB):
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-34-import { appendWorkerSessionMetadata, readWorkerSessionMetadata } from "@/server/workers/session-metadata";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-35-import { buildTranscriptReplayPrompt, canRecreateRejectedSavedSession, isRejectedSavedSessionErrorMessage, materializeProviderSessionFromWorkerStream } from "@/server/workers/session-recovery";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-36-import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
src/server/runs/recovery.ts:37:import { updateDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-38-import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-39-import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-40-import { emitNamedEvent } from "@/server/events/named-events";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-41-import { createBranchWorktree } from "@/server/git/workspaces";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-42-import { pendingOrphanWorktreeError } from "@/server/git/orphan-recovery";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-43-import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-44-import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-45-import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";
--
src/server/runs/recovery.ts-777-    updatedAt: completedAt,
/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts-778-  }).where(eq(workers.id, worker.id));
...
</persisted-output>

uuid: 8c19165d-ce70-4ef7-bde1-494533abb5f5
parent: bf8dae12-4273-4ad0-8816-c9a2fd3f53ef
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-11T12:13:38.398Z","phase":null} -->
## Claude attachment · 2026-07-11T12:13:38.398Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: ae30b643-ad10-4acd-b76a-e680b20f8ec4
parent: 8c19165d-ce70-4ef7-bde1-494533abb5f5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:42.179Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:42.179Z



uuid: 6fc0e7a8-9b5a-4aa8-afe7-7d253013a1c1
parent: ae30b643-ad10-4acd-b76a-e680b20f8ec4

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:42.821Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:13:42.821Z

```json
{
  "pattern": "await updateDirectRunStatusFromWorkerOutput\\(",
  "output_mode": "content",
  "-n": true,
  "-A": 3
}

uuid: 7cec94cd-cac5-4384-8f9b-68b7de25ef8f
parent: 6fc0e7a8-9b5a-4aa8-afe7-7d253013a1c1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:42.886Z","phase":null} -->
## Claude tool result: toolu_01SrEboBwdFQSNvtLNva3giS · 2026-07-11T12:13:42.886Z

```text
tests/conversations/direct-run-status.test.ts:118:    await updateDirectRunStatusFromWorkerOutput({
tests/conversations/direct-run-status.test.ts-119-      runId: "run-direct-auto-commit",
tests/conversations/direct-run-status.test.ts-120-      workerId: "worker-1",
tests/conversations/direct-run-status.test.ts-121-      responseText: "Done.",
--
tests/conversations/direct-run-status.test.ts:146:    await updateDirectRunStatusFromWorkerOutput({
tests/conversations/direct-run-status.test.ts-147-      runId: "run-direct-awaiting-noop",
tests/conversations/direct-run-status.test.ts-148-      workerId: "worker-1",
tests/conversations/direct-run-status.test.ts-149-      workerStatus: "working",
--
src/server/runs/recovery.ts:780:  await updateDirectRunStatusFromWorkerOutput({
src/server/runs/recovery.ts-781-    runId: run.id,
src/server/runs/recovery.ts-782-    workerId: worker.id,
src/server/runs/recovery.ts-783-    workerStatus: finalWorkerStatus,
--
src/server/conversations/sync.ts:711:      await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/sync.ts-712-        runId: run.id,
src/server/conversations/sync.ts-713-        workerId: worker.id,
src/server/conversations/sync.ts-714-        workerStatus: nextWorkerStatus,
--
src/server/conversations/sync.ts:802:      await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/sync.ts-803-        runId: run.id,
src/server/conversations/sync.ts-804-        workerId: worker.id,
src/server/conversations/sync.ts-805-        workerStatus: worker.status,
--
src/server/conversations/create.ts:423:      await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/create.ts-424-        runId: args.runId,
src/server/conversations/create.ts-425-        workerId: args.workerId,
src/server/conversations/create.ts-426-        workerStatus: snapshot?.state ?? response.state,
--
src/server/conversations/send-message.ts:694:      await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/send-message.ts-695-        runId: run.id,
src/server/conversations/send-message.ts-696-        workerId: worker.id,
src/server/conversations/send-message.ts-697-        workerStatus: snapshot?.state ?? response.state,
--
src/server/conversations/queued-messages.ts:385:    await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/queued-messages.ts-386-      runId: run.id,
/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts-387-      workerId,
src/server/conversations/queued-messages.ts-388-      workerStatus: snapshot?.state ?? response.state,
--
src/server/conversations/direct-run-status.ts:187:  await updateDirectRunStatusFromWorkerOutput(args);
/Users/masterman/NLP/omniharness/src/server/conversations/direct-run-status.ts-188-  return true;
/Users/masterman/NLP/omniharness/src/server/conversations/direct-run-status.ts-189-}
--
src/server/workers/stuck-worker-reaper.ts:99:  await updateDirectRunStatusFromWorkerOutput({
src/server/workers/stuck-worker-reaper.ts-100-    runId: args.worker.runId,
src/server/workers/stuck-worker-reaper.ts-101-    workerId: args.worker.id,
src/server/workers/stuck-worker-reaper.ts-102-    workerStatus: snapshot?.state ?? "idle",

uuid: 0dc214d2-2cb7-4c55-b829-20af8dce9616
parent: 7cec94cd-cac5-4384-8f9b-68b7de25ef8f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:13:47.893Z","phase":null} -->
## Claude thinking · 2026-07-11T12:13:47.893Z



uuid: 244b79af-740a-421f-9e94-0709dfb6377e
parent: 0dc214d2-2cb7-4c55-b829-20af8dce9616

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:13:48.700Z","phase":null} -->
## Claude tool call: Read · 2026-07-11T12:13:48.700Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/sync.ts",
  "offset": 655,
  "limit": 50
}

uuid: 32fd5337-f1f3-4459-82e6-0b030c3c9fff
parent: 244b79af-740a-421f-9e94-0709dfb6377e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:13:48.710Z","phase":null} -->
## Claude tool result: toolu_01F93UXnqrVVtLNQDnnsfKsy · 2026-07-11T12:13:48.710Z

```text
655	        surface: { code: "worker.idle.empty_output", workerId: worker.id },
656	      });
657	      continue;
658	    }
659	
660	    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
661	    const nextRunState = resolveSyncedRunState(run, agent);
662	    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
663	    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
664	    const nextWorkerCwd = agent.cwd || worker.cwd;
665	    const nextWorkerCurrentText = quiescedDirectWorker ? "" : agent.currentText;
666	    const workerChanged = worker.status !== nextWorkerStatus
667	      || worker.cwd !== nextWorkerCwd
668	      || worker.currentText !== nextWorkerCurrentText
669	      || worker.lastText !== agent.lastText;
670	    if (workerChanged) {
671	      await withSqliteBusyRetry(() => db.update(workers).set({
672	        status: nextWorkerStatus,
673	        cwd: nextWorkerCwd,
674	        currentText: nextWorkerCurrentText,
675	        lastText: agent.lastText,
676	        updatedAt: new Date(),
677	      }).where(eq(workers.id, worker.id)));
678	    }
679	    if (worker.status !== nextWorkerStatus) {
680	      emitNamedEvent({
681	        kind: "worker.status",
682	        runId: run.id,
683	        workerId: worker.id,
684	        prev: worker.status,
685	        next: nextWorkerStatus,
686	      });
687	    }
688	
689	    if (run.mode === "planning") {
690	      if (refreshPlanningArtifacts) {
691	        const result = await refreshPlanningArtifactsForRun({
692	          run,
693	          worker,
694	          snapshot: agent,
695	          status: nextRunState === "running" ? "working" : undefined,
696	        });
697	        if (staleBusyFailure && result.status !== "failed") {
698	          await clearMatchingRunFailureMessage(run);
699	        }
700	      }
701	      await drainQueuedWorkerMessagesWithObservation({
702	        runId: run.id,
703	        workerId: worker.id,
704	        workerStatus: agent.state,

uuid: c23e00e9-1df5-49c5-8f60-fe137e1385e0
parent: 32fd5337-f1f3-4459-82e6-0b030c3c9fff
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:14:12.833Z","phase":null} -->
## Claude thinking · 2026-07-11T12:14:12.833Z



uuid: 5c3c8e1e-345a-41d1-a0a1-d122160957e4
parent: c23e00e9-1df5-49c5-8f60-fe137e1385e0

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:14:13.094Z","phase":null} -->
## Claude tool call: Bash · 2026-07-11T12:14:13.094Z

```json
{
  "command": "git diff --stat -- src/lib/conversation-state.ts tests/lib/conversation-state.test.ts"
}

uuid: 2450233b-37c7-4dc3-aaba-99840544744d
parent: 5c3c8e1e-345a-41d1-a0a1-d122160957e4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:14:13.134Z","phase":null} -->
## Claude tool result: toolu_01T46PmDokdHCme5QkEjdc2n · 2026-07-11T12:14:13.134Z

```text
(Bash completed with no output)

uuid: 93e567d0-f61f-4ff0-a19b-f60785db8e4d
parent: 2450233b-37c7-4dc3-aaba-99840544744d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:14:18.579Z","phase":null} -->
## Claude thinking · 2026-07-11T12:14:18.579Z



uuid: 37a36cb8-d161-41d9-877a-95aac2fd5775
parent: 93e567d0-f61f-4ff0-a19b-f60785db8e4d

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:14:19.730Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:14:19.730Z

```json
{
  "pattern": "getNamedEventsSince|__resetNamedEventsForTests",
  "path": "/Users/masterman/NLP/omniharness/tests/api/run-route.test.ts",
  "-n": true,
  "head_limit": 10
}

uuid: 6d6fb0ab-9b6b-41e3-813c-241299c8b3c0
parent: 37a36cb8-d161-41d9-877a-95aac2fd5775
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:14:19.774Z","phase":null} -->
## Claude tool result: toolu_01C42fbsh7W43KFf8Ujq129t · 2026-07-11T12:14:19.774Z

```text
Found 1 file
tests/api/run-route.test.ts

uuid: 7890b6c0-a2c2-4a88-b03b-c50c77251415
parent: 6d6fb0ab-9b6b-41e3-813c-241299c8b3c0
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:14:22.037Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:14:22.037Z

```json
{
  "pattern": "getNamedEventsSince|__resetNamedEventsForTests",
  "path": "/Users/masterman/NLP/omniharness/tests/api/run-route.test.ts",
  "output_mode": "content",
  "-n": true
}

uuid: 3f8888e8-d317-49d9-ae58-52437631cda5
parent: 7890b6c0-a2c2-4a88-b03b-c50c77251415
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:14:22.059Z","phase":null} -->
## Claude tool result: toolu_014akaXiE4ukKxGwm1NQ1zzr · 2026-07-11T12:14:22.059Z

```text
10:import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
163:    __resetNamedEventsForTests();
205:    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
314:    __resetNamedEventsForTests();
345:    const readEvents = getNamedEventsSince(0).events.filter((entry) => (
578:    __resetNamedEventsForTests();
644:    const namedEvents = getNamedEventsSince(0).events.map((entry) => entry.event);
808:    __resetNamedEventsForTests();
850:    const events = getNamedEventsSince(0).events
876:    __resetNamedEventsForTests();
942:    const terminalEvents = getNamedEventsSince(0).events
1537:    __resetNamedEventsForTests();
1820:    __resetNamedEventsForTests();
1895:    const surfacedErrors = getNamedEventsSince(0).events
1917:    __resetNamedEventsForTests();
2040:    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
2242:    __resetNamedEventsForTests();
2341:    const surfacedErrors = getNamedEventsSince(0, { runId }).events
2353:    __resetNamedEventsForTests();
2458:    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
2466:    __resetNamedEventsForTests();
2576:    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({

uuid: 1eb93b3e-6ec4-4a46-8c42-e2be1a7fd507
parent: 3f8888e8-d317-49d9-ae58-52437631cda5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-11T12:14:25.806Z","phase":null} -->
## Claude · 2026-07-11T12:14:25.806Z

Good — imports are correctly in place, established test pattern already used throughout the file. Everything checks out statically.

uuid: 4d4d7a84-5d3f-429c-aaa9-dc7e74be3f9c
parent: 1eb93b3e-6ec4-4a46-8c42-e2be1a7fd507

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:14:26.495Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:14:26.495Z

```json
{
  "pattern": "conversationReadMarkers = sqliteTable",
  "path": "/Users/masterman/NLP/omniharness/src/server/db/schema.ts",
  "-A": 10
}

uuid: cf3a8e98-b4d1-46b5-b2ba-d8cbf2587685
parent: 4d4d7a84-5d3f-429c-aaa9-dc7e74be3f9c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:14:26.519Z","phase":null} -->
## Claude tool result: toolu_01UgHsSkeDr7hzTAoLH9mHoF · 2026-07-11T12:14:26.519Z

```text
Found 1 file
src/server/db/schema.ts

uuid: 5290508b-1067-4f6b-aeb8-10bb6845f70c
parent: cf3a8e98-b4d1-46b5-b2ba-d8cbf2587685
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-11T12:14:28.958Z","phase":null} -->
## Claude tool call: Grep · 2026-07-11T12:14:28.958Z

```json
{
  "pattern": "conversation_read_markers|conversationReadMarkers",
  "path": "/Users/masterman/NLP/omniharness/src/server/db/schema.ts",
  "output_mode": "content",
  "-n": true,
  "-A": 8
}

uuid: 56a003c2-cda5-4914-a472-7e382c59f45f
parent: 5290508b-1067-4f6b-aeb8-10bb6845f70c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-11T12:14:28.966Z","phase":null} -->
## Claude tool result: toolu_015LokLAY1zQo4npRp8nohnz · 2026-07-11T12:14:28.966Z

```text
114:export const conversationReadMarkers = sqliteTable('conversation_read_markers', {
115-  runId: text('run_id').primaryKey().references(() => runs.id),
116-  lastReadAt: integer('last_read_at', { mode: 'timestamp' }).notNull(),
117-  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
118-  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
119-});
120-
121-export const queuedConversationMessages = sqliteTable('queued_conversation_messages', {
122-  id: text('id').primaryKey(),

uuid: c9fb4484-9819-49b7-8eb3-c86ff455e106
parent: 56a003c2-cda5-4914-a472-7e382c59f45f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-11T12:14:41.323Z","phase":null} -->
## Claude thinking · 2026-07-11T12:14:41.323Z



uuid: 2f13e850-b16b-4081-9362-a9095e052c6b
parent: c9fb4484-9819-49b7-8eb3-c86ff455e106

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-11T12:14:52.738Z","phase":null} -->
## Claude · 2026-07-11T12:14:52.738Z

## Verdict: **READY**

I traced all three changes line-by-line against actual behavior (SQLite UPSERT semantics, drizzle-orm's `setWhere` option, and the exact test scenarios) rather than just reading the diff. Findings:

**1. `markRunRead` atomic upsert (`runs.ts:319-341`)** — Correct. `setWhere: lt(conversationReadMarkers.lastReadAt, lastReadAt)` is a real, non-deprecated drizzle-orm sqlite-core option (verified in `node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:54`) that compiles to `on conflict(run_id) do update set ... where last_read_at < ?`. Per SQLite's UPSERT spec, a false `WHERE` on the update branch means neither insert nor update happens for that row, so `.returning()` correctly comes back empty — `changedMarkers.length === 0` reliably detects the no-op case, falls back to reading the persisted value, and skips `emitNamedEvent`. This closes the loop's amplification point.

**2. `updateDirectRunStatusFromWorkerOutput` write guard (`direct-run-status.ts:137-144`)** — Correct, and consistent with the pre-existing notify guard at line 172 (`nextStatus !== run.status || run.failedAt || run.lastError`) — same condition, so write and notify never diverge. Checked all 7 call sites (`recovery.ts`, `sync.ts` ×2, `create.ts`, `send-message.ts`, `queued-messages.ts`, `stuck-worker-reaper.ts`) — none depend on `updatedAt` advancing unconditionally as a side effect.

**3. Worker-row write guard (`sync.ts:660-678`)** — Correct. Compares all four written fields (`status`, `cwd`, `currentText`, `lastText`) before writing; `writeWorkerOutputEntries` just above it is a separate file-based JSONL store (confirmed in `output-store.ts:924-931`, dedupes by fingerprint, doesn't touch the `workers` DB row), so it doesn't interfere with this guard's effectiveness. This also closes the secondary sidebar-activity churn I flagged last round.

**Tests**: hand-traced `tests/conversations/direct-run-status.test.ts` (no-op preserves `updatedAt`), `tests/api/run-route.test.ts` (`"does not emit another read event when the persisted marker is already current"` — two POSTs, exactly 1 `conversation.read`), and `tests/server/conversations-sync.test.ts` (`"does not rewrite an unchanged direct worker that is still awaiting the same elicitation"` — asserts both `run.updatedAt` and `worker.updatedAt` stable). Walked through the actual code paths each exercises; all three assertions follow correctly from the implementation as written.

**Design invariant preserved**: `getRunLatestUnreadTimestamp` and its tests are untouched, so the documented behavior in `docs/architecture/state-staleness-and-session-lifecycle-lessons.md:122-139` (genuine `awaiting_user` transitions must still surface via `run.updatedAt`) is intact — the fix is correctly upstream at the write sites, not the read helper.

**Caveat**: Bash execution required approval I couldn't obtain in this session, so I verified test correctness by static trace-through rather than actually running the suite. Logic checks out cleanly, but run `vitest run tests/conversations/direct-run-status.test.ts tests/api/run-route.test.ts tests/server/conversations-sync.test.ts` before merging as a final confirmation.

uuid: 7fb1f60a-71e7-4c0b-9a03-1818bcd54191
parent: 2f13e850-b16b-4081-9362-a9095e052c6b

<!-- /codex-event -->

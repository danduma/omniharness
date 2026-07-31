---
provider: "claude"
codex_thread_id: "47d790b2-c00c-4209-9242-4a4800481dac"
title: "Review interface runner platform apps documentation readiness"
started_at: "2026-07-30T22:37:29.447Z"
updated_at: "2026-07-30T22:40:48.898Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review interface runner platform apps documentation readiness

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:37:29.447Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T22:37:29.447Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-30T22:37:29.447Z",
  "sessionId": "47d790b2-c00c-4209-9242-4a4800481dac",
  "content": "Final readiness pass on docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md against the approved spec and AGENTS.md. Prior remaining blockers B1-B7 were: bootstrap.server teardown, Task1/2 boundary gate, Next dynamic/image/font ownership, live 3035 audit exclusions, active-runner deep links, CLI rekey/auth init/token handling, and same-origin/cookie-bearer profile invariants. Confirm those are now owned and dependency ordering is executable. Return exactly READY or HARDEN first, followed only by remaining blockers and deliberate non-goals. Do not edit files."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:37:29.456Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T22:37:29.456Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-30T22:37:29.456Z",
  "sessionId": "47d790b2-c00c-4209-9242-4a4800481dac"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:37:29.592Z","phase":null} -->
## Claude attachment · 2026-07-30T22:37:29.592Z

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
  "pendingMcpServers": [],
  "needsAuthMcpServers": []
}

binary omitted from archive

uuid: fe72ba8e-c8d8-4f37-9586-db3eabb54d18
parent: 40b0770c-669f-40a7-ab55-cbafe68d86ba
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:37:29.592Z","phase":null} -->
## Claude attachment · 2026-07-30T22:37:29.592Z

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
    "- Explore: Read-only search agent for broad fan-out searches — when answering means sweeping many files, directories, or naming conventions and you only need the conclusion, not the file dumps. It reads excerpts rather than whole files, so it locates code; it doesn't review or audit it. Specify search breadth: \"medium\" for moderate exploration, \"very thorough\" for multiple locations and naming conventions. (Tools: All tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit)",
    "- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)",
    "- Plan: Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit)",
    "- statusline-setup: Use this agent to configure the user's Claude Code status line setting. (Tools: Read, Edit)"
  ],
  "removedTypes": [],
  "isInitial": true,
  "showConcurrencyNote": true
}

binary omitted from archive

uuid: 842ba8c2-db35-4b80-8c22-4733270a046d
parent: fe72ba8e-c8d8-4f37-9586-db3eabb54d18
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:37:29.592Z","phase":null} -->
## Claude attachment · 2026-07-30T22:37:29.592Z

```text
{
  "type": "skill_listing",
  "content": "- agentic-user-journey-testing: Use when validating app, UI, or product-surface work through the running app, especially when logs/tests pass but a user job may still be blocked or unclear\n- brainstorming: Use before substantial product, UI, feature, or behavior work with ambiguity, user-journey impact, or multiple plausible approaches\n- building-react-apps: Use when building, refactoring, planning, or debugging React or Next.js apps, React components, hooks, routing, frontend state, SSR, hydration, bundles, imports, or UI settings\n- client-server-state-invariants: Use when planning, building, reviewing, or debugging React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization\n- designing-settings-dialogs: Use when designing, planning, building, or reviewing settings dialogs, settings dialogues, preferences panels, configuration modals, option tabs, or UI settings surfaces\n- dispatching-parallel-agents: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies\n- executing-plans: Use when you have a written implementation plan to execute inline with review checkpoints\n- find-skills: Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.\n- implementing-react-i18n: Use when adding, fixing, or reviewing React internationalization, language selectors, locale resources, translated UI copy, or bugs where changing language does not update user-facing strings\n- improve: Survey any codebase as a senior advisor and produce prioritized, self-contained implementation plans for OTHER models/agents to execute. Strictly read-only on source code — never implements, fixes, or refactors anything itself. Use when asked to audit a codebase, find improvement opportunities (bugs, security, performance, test coverage, tech debt, migrations, DX), suggest features or where to take the project next (roadmap, product direction), or generate handoff plans for another agent to implement.\n- instrumenting-control-planes: Use when building, planning, reviewing, or debugging apps with backend decisions, agent workflows, long-running jobs, SSE/WebSocket streams, recovery paths, deletes, retries, or user-visible failures\n- learning-from-bugs: Use when a meaningful bug, regression, architecture flaw, storage issue, memory problem, persistence failure, control-plane failure, or system-level failure has been diagnosed or fixed\n- optimizing-react-next-apps: Use when a React or Next.js app feels slow, cluttered, overbundled, slow to compile, slow to load, ineffective at SSR, hydration-heavy, or likely burdened by unnecessary imports or UI dependencies\n- receiving-code-review: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation\n- requesting-code-review: Use when completing tasks, implementing major features, or before merging to verify work meets requirements\n- second-opinion: Use when writing or hardening substantial specs, implementation plans, architecture plans, design plans, or unusually hard creative decisions before execution\n- subagent-driven-development: Use when executing implementation plans with independent tasks in the current session\n- systematic-debugging: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes\n- test-driven-development: Use when implementing any feature or bugfix, before writing implementation code\n- using-ultrapowers: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before acting\n- verification-before-completion: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always\n- writing-plans: Use when you have an approved spec or clear requirements for a multi-step task, before implementation\n- writing-skills: Use when creating new skills, editing existing skills, or verifying skills work before deployment\n- dataviz: Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium — an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts, …), an image/PNG you will render and upload, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard. Produces visualizations that read as one system — elegant, accessible, consistent in light and dark — using a brand-neutral placeholder palette you swap for your own. Teaches a design-system-agnostic method: a form heuristic, a color formula with a runnable validator, mark specs, and interaction rules. A validated default palette is documented in `references/palette.md` — swap that file's values for your brand's. Triggers on: \"chart\", \"graph\", \"plot\", \"data viz\", \"visualization\", \"dashboard\", \"analytics\", \"visualize data\", \"categorical colors\", \"sequential / diverging palette\", \"stat tile\", \"sparkline\", \"heatmap\", \"legend\", \"axis\", \"tooltip\", \"chart colors\", \"color by series\".\n- update-config: Use this skill to configure the Claude Code harness via settings.json. Automated behaviors (\"from now on when X\", \"each time X\", \"whenever X\", \"before/after X\") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions (\"allow X\", \"add permission\", \"move permission to\"), env vars (\"set X=Y\"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: \"allow npm commands\", \"add bq permission to global settings\", \"move permission to user settings\", \"set DEBUG=true\", \"when claude stops show X\". For simple settings like theme/model, suggest the /config command.\n- keybindings-help: Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: \"rebind ctrl+s\", \"add a chord shortcut\", \"change the submit key\", \"customize keybindings\".\n- simplify: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.\n- fewer-permission-prompts: Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.\n- loop: Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace. - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. \"check the deploy every 5 minutes\", \"keep running /babysit-prs\"). Do NOT invoke for one-off tasks.\n- schedule: Create, update, list, or run scheduled cloud agents (routines) that execute on a cron schedule. - When the user wants to schedule a recurring cloud agent, set up automated tasks, create a cron job for Claude Code, or manage their scheduled agents/routines. Also use when the user wants a one-time scheduled run (\"run this once at 3pm\", \"remind me to check X tomorrow\").\n- claude-api: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.\nTRIGGER — read BEFORE opening the target file; don't skip because it \"looks like a one-liner\" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).\nSKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file).\n- run: Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).\n- init: Initialize a new CLAUDE.md file with codebase documentation\n- review: Review a GitHub pull request; for your working diff use /code-review\n- security-review: Complete a security review of the pending changes on the current branch",
  "skillCount": 35,
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

uuid: 5f3d3045-e4ac-4303-8566-23e197596b1f
parent: 842ba8c2-db35-4b80-8c22-4733270a046d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-30T22:37:29.593Z","phase":null} -->
## User · 2026-07-30T22:37:29.593Z

Final readiness pass on docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md against the approved spec and AGENTS.md. Prior remaining blockers B1-B7 were: bootstrap.server teardown, Task1/2 boundary gate, Next dynamic/image/font ownership, live 3035 audit exclusions, active-runner deep links, CLI rekey/auth init/token handling, and same-origin/cookie-bearer profile invariants. Confirm those are now owned and dependency ordering is executable. Return exactly READY or HARDEN first, followed only by remaining blockers and deliberate non-goals. Do not edit files.

uuid: 40b0770c-669f-40a7-ab55-cbafe68d86ba

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:37:31.788Z","phase":null} -->
## Claude · 2026-07-30T22:37:31.788Z

I'll read the plan and the governing docs, then verify each blocker.

uuid: 914ec341-f480-4520-abbb-7ba95f69457e
parent: 5f3d3045-e4ac-4303-8566-23e197596b1f

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:37:33.374Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:37:33.374Z

```json
{
  "command": "ls docs/superpowers/plans/ && wc -l docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md AGENTS.md agents.md 2>/dev/null",
  "description": "List plans and line counts"
}

uuid: beef6241-2eee-48d3-bf17-d1b0b91ebd25
parent: 914ec341-f480-4520-abbb-7ba95f69457e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:37:34.094Z","phase":null} -->
## Claude tool result: toolu_014w8q4YqhNa3UdUPCZWUMzU · 2026-07-30T22:37:34.094Z

```text
2026-04-20-ultrapowers-implementation.md
2026-04-21-conversation-recovery-controls.md
2026-04-21-generic-supervisor-redesign-implementation.md
2026-04-21-pm-pass-north-star.md
2026-04-21-story-derived-completeness.md
2026-04-21-v1-product-completeness.md
2026-04-22-agent-output-activity-feed.md
2026-04-23-conversation-modes-implementation.md
2026-04-23-remote-access-pwa.md
2026-04-23-worker-detail-streaming.md
2026-04-24-page-refactor.md
2026-04-27-worker-conversation-presence.md
2026-04-28-managed-agent-tool-environment.md
2026-04-30-internal-agent-runtime.md
2026-05-02-busy-conversation-steer-queue.md
2026-05-02-chat-file-attachments.md
2026-05-02-completion-git-workflow-settings.md
2026-05-02-native-macos-remote-wrapper.md
2026-05-03-acp-worker-terminal-processes.md
2026-05-05-agent-output-spool.md
2026-05-06-side-window-file-tabs.md
2026-05-07-i18n-resource-library.md
2026-05-07-memorable-cloudflared-subdomains.md
2026-05-08-settings-reorganization.md
2026-05-09-recoverable-run-state-machine.md
2026-05-10-hosted-remote-access-control-plane.md
2026-05-10-quota-reset-auto-resume.md
2026-05-11-app-architecture-react-performance.md
2026-05-11-supervisor-memory.md
2026-05-11-top-bar-commit-workflow.md
2026-05-12-branch-workspace-management.md
2026-05-14-planning-review-agents.md
2026-05-15-cli-quota-tracking.md
2026-05-16-codex-subscription-supervisor.md
2026-05-16-infinite-scroll-output-history.md
2026-05-16-intelligent-worker-failover.md
2026-05-16-unified-worker-conversation-stream.md
2026-05-18-common-runtime-multi-surface.md
2026-05-19-session-provider-decoupling.md
2026-05-20-append-only-artifact-storage.md
2026-05-25-automatic-session-cleanup.md
2026-05-26-active-sessions-sidebar-tabs.md
2026-06-14-escape-interrupt-queued-message.md
2026-06-14-multi-server-standalone-interface.md
2026-06-14-visual-improve-mode.md
2026-07-11-complete-acp-client.md
2026-07-13-claude-gpt56-live-lifecycle-journey.md
2026-07-13-managed-claude-model-gateway.md
2026-07-30-interface-runner-platform-apps.md
cli-quota-tracking.md
lifecycle-observability-and-chaos-harness.md
plan-readiness-llm-judge.md
     458 docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md
      42 AGENTS.md
      42 agents.md
     542 total

uuid: 0e149630-0603-470d-bbd8-de65cdc26bdb
parent: beef6241-2eee-48d3-bf17-d1b0b91ebd25
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:37:35.918Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:37:35.918Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md"
}

uuid: 8a48653e-036b-486b-b537-fc6fac10e152
parent: 0e149630-0603-470d-bbd8-de65cdc26bdb
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:37:36.172Z","phase":null} -->
## Claude tool result: toolu_01NhSGEXFdEtFVyGBqyQunVh · 2026-07-30T22:37:36.172Z

```text
1	# Interface / Runner / Platform Apps Implementation Plan
2	
3	> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
4	
5	**Goal:** Ship OmniHarness as one logical headless runner plus one shared interface delivered through web/PWA, Electron desktop, Capacitor iOS/Android, and VSCode, with every authenticated runner profile concurrently connected while the client process is active.
6	
7	**Architecture:** Keep the repository as one pnpm package with enforced runner/shared/interface boundaries. The runner remains a managed API-server + local ACP-bridge deployment; clients use transport-neutral `RuntimeAPIs` over HTTP/SSE or validated native bridges. The existing shared password creates revocable cookie or bearer sessions, while browser-to-browser authorization uses a same-runner S256 PKCE approval window rather than open-CORS password login.
8	
9	**Tech Stack:** Node 22+, TypeScript, React 19, Vite, TanStack Query, Base UI/shadcn, SQLite/Drizzle, HTTP/SSE, Electron, Capacitor iOS/Android, Swift Keychain Services, Android Keystore, VSCode extension APIs, Vitest, Playwright.
10	
11	**North Star Product:** One interface installed anywhere, keeping all of a builder's runners visible and connected, with platform-native security and capabilities but one shared product experience.
12	
13	**Current Milestone:** Deliver the entire approved v1 in the seven architecture milestones below; this plan does not stop after the runner or web split.
14	
15	**Future Product Direction:** Merged cross-runner dashboards, native push after mobile suspension, runner-to-runner handoff, and later package extraction remain context only.
16	
17	**Final Functionality Standard:** Completion requires real runner, browser, Electron, VSCode, iOS, and Android functionality; password authentication and session administration; concurrent live runner streams; restart/resync safety; platform-secure credential storage; end-to-end migration/recovery states; and the full verification matrix. No mock shell, placeholder connection, canned runner data, or fake native bridge can satisfy a task.
18	
19	---
20	
21	## Approved product decisions
22	
23	- One logical runner deployment owns SQLite, supervisor, agents, ACP bridge, PTYs, auth, and events. The API server and bridge remain separate co-located processes.
24	- Desktop uses Electron. iOS and Android use Capacitor. Web/PWA and VSCode remain first-class.
25	- Every saved authenticated runner keeps one main event connection live while the app process is active. The interface renders one runner workspace at a time.
26	- The existing shared runner password is the only login secret. It creates separate revocable sessions; clients do not persist the password.
27	- Browser/PWA cross-origin login uses a target-runner approval window + S256 PKCE. Native hosts use originless direct password login and never expose bearer tokens to renderers/WebViews.
28	- Work stays in the current checkout. Do not create a branch or worktree. Preserve all existing user changes.
29	
30	## Product and state model
31	
32	### Primary journeys
33	
34	1. Start a headless runner and use it through API/SSE, with or without a static interface artifact.
35	2. Add runners from web/PWA through the target-runner authorization window.
36	3. Add runners from Electron, Capacitor, VSCode, or CLI with URL + shared password.
37	4. Keep all authenticated profiles connected, switch the visible workspace without closing inactive main streams, and receive runner-named notifications.
38	5. Return after restart with profiles, per-runner drafts, cursors, and preferences restored.
39	6. Recover honestly from offline, deferred, needs-reauth, TLS-untrusted, identity-mismatch, incompatible, degraded/resync, and runner-stopping states.
40	7. List/revoke sessions, rotate the shared password, forget/edit profiles, rename a runner, and migrate existing Electron state.
41	
42	### Ownership and invariants
43	
44	- Runner owns all domain state. Client persistence is limited to profiles, credentials through a platform adapter, UI preferences, bounded preview caches, cursors, and drafts.
45	- `runnerInstanceId` is the durable scope after identity is known; profile UUID is only the pre-login/list-key fallback.
46	- Every async response, mutation, timer, reconnect, snapshot, and frame carries/checks runner scope before updating a Manager or Query cache.
47	- Bootstrap/snapshot proves authority and completeness. Preview caches never satisfy a fresh-load gate.
48	- SSE ids are `<streamEpoch>:<sequence>`. Every event frame carries an id. Resync has a stable reason and a separate anti-storm governor.
49	- One profile has one main event stream. Terminal streams exist only for the visible runner and reload bounded scrollback on activation.
50	- Query keys, drafts, cursors, worker caches, notifications, and errors are runner-scoped.
51	- Every server decision/refusal/failure emits a typed named event; user-relevant server failures additionally emit `error.surfaced`.
52	- All new user-facing copy is added to every file in `shared/locales/*.json` and rendered with `t()`.
53	- Shared Manager subscriptions remain narrow; draft text, cursors, hover/open state, and other high-churn fields cannot repaint the full application shell.
54	
55	## File map
56	
57	### Create
58	
59	- `src/shared/runtime.ts` — runtime surface/stop/event-id primitives shared across boundaries.
60	- `src/shared/bootstrap.ts` — runner identity, capabilities, bootstrap, and compatibility payload types.
61	- `src/shared/api-revision.ts` — revision window, capability ids, and declared contract-change classifications.
62	- `src/shared/worker-entries.ts` — client/server worker-entry types.
63	- `src/shared/planning-review.ts` — planning review schemas/types safe for the interface.
64	- `src/shared/worker-types.ts` — supported worker types and display labels used by both sides.
65	- `tsconfig.shared.json`, `tsconfig.runner.json`, `tsconfig.interface.json` — independent typecheck projects.
66	- `src/server/runner/config.ts` — isolated runner/bridge/gateway/static/TLS configuration.
67	- `src/server/runner/ManagedBridgeController.ts` — bridge adopt/start/retry/ownership state machine.
68	- `src/server/runner/RunnerReadinessManager.ts` — bounded in-memory readiness/bridge/static state.
69	- `src/server/runner/shutdown.ts` — ordered server/SSE/PTY/gateway/bridge shutdown.
70	- `scripts/runner.ts` — production/development runner entry.
71	- `src/runtime/http/stream-response.ts` — bounded Web-stream to Node response bridge.
72	- `src/runtime/http/static-files.ts` — safe SPA/static serving, cache policy, manifest validation.
73	- `src/runtime/http/bootstrap-html.ts` — escaped bootstrap injection.
74	- `src/runtime/http/security-headers.ts` — web and packaged CSP/referrer headers.
75	- `apps/interface/index.html`, `apps/interface/app-shell.html`, `apps/interface/vite.config.ts`, `apps/interface/src/main.tsx` — Vite interface target.
76	- `src/interface/providers.tsx`, `src/interface/styles/**` — Vite-owned providers and styles moved from `src/app`.
77	- `apps/interface/vite-csp-manifest.ts` — build-time theme hash/asset manifest output.
78	- `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js` — Vite-owned PWA assets.
79	- `src/runtime-api/stream.ts` — transport-neutral stream/frame contract.
80	- `src/runtime-api/request.ts` — redirect-safe request/error primitives.
81	- `src/runtime-api/domains/*.ts` — typed API domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
82	- `src/server/auth/browser-authorization.ts` — S256 approval-code lifecycle.
83	- `src/server/auth/stream-tickets.ts` — atomic single-use path-bound SSE tickets.
84	- `src/server/auth/trusted-proxy.ts` — socket-derived protocol/client identity.
85	- `src/server/auth/cors.ts` — route-aware bearer CORS with no credentials flag.
86	- `src/runtime/http/routes/auth-browser-authorization.ts` — authorization/code-exchange routes.
87	- `src/runtime/http/routes/auth-stream-ticket.ts` — ticket route.
88	- `src/runtime/http/routes/auth-sessions.ts` — session list/revoke routes.
89	- `src/interface/auth/InterfaceAuthorizationScreen.tsx` — same-runner origin approval screen.
90	- `src/interface/runners/RunnerProfile.ts` — versioned profile and status types.
91	- `src/interface/runners/RunnerCredentialStore.ts` — platform credential-store interface.
92	- `src/interface/runners/RunnerProfileStore.ts` — platform profile/prefs persistence interface.
93	- `src/interface/runners/RunnerConnection.ts` — one runner's transport, managers, caches, state machine, cursor, retries.
94	- `src/interface/runners/RunnerRegistry.ts` — all profiles/connections + active selection.
95	- `src/interface/runners/RunnerRegistryProvider.tsx` — narrow active/all-runner React subscriptions.
96	- `src/interface/runners/RunnerSwitcher.tsx` — shadcn `sidebar-07`-derived switcher.
97	- `src/interface/runners/ConnectRunnerScreen.tsx` — shadcn `login-03`-derived onboarding.
98	- `src/interface/runners/RunnerSessionsPanel.tsx` — compact session/revocation control surface.
99	- `src/interface/home/mutations/*.ts` — split conversation/run/planning/settings/auth mutations.
100	- `src/components/terminal/*.tsx` and `src/components/terminal/*.ts` — split terminal rendering/stream/control responsibilities.
101	- `apps/electron/src/ProfileStore.ts`, `CredentialStore.ts`, `RuntimeBridge.ts`, `TlsPinStore.ts`, `migration.ts` — remote-only desktop host.
102	- `src/runtime-api/capacitor.ts` — Capacitor bridge-backed interface adapter.
103	- `apps/mobile/capacitor.config.ts`, `apps/mobile/package.json` — shared mobile shell config.
104	- `apps/mobile/src/native-contract.ts` — validated JavaScript/native request contract.
105	- `apps/mobile/ios/App/App/OmniNativePlugin.swift` — URLSession/SSE, Keychain, TLS pinning, links/notifications.
106	- `apps/mobile/android/app/src/main/java/.../OmniNativePlugin.kt` — OkHttp/SSE, Android Keystore, TLS pinning, links/notifications.
107	- `tests/runtime/route-contract-fixture.ts` and versioned fixture data — portable route contract after Next deletion.
108	- New tests under `tests/runtime`, `tests/server/runner`, `tests/server/auth`, `tests/runtime-api`, `tests/interface/runners`, `tests/electron`, `tests/vscode`, `tests/mobile`, `tests/lifecycle/scenarios`, and `tests/e2e`.
109	
110	### Modify
111	
112	- `.gitignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `components.json`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`.
113	- `src/server/events/named-events.ts`, `src/server/events/live-updates.ts`, `src/runtime/http/routes/events.ts`, `src/runtime/http/server.ts`.
114	- `scripts/dev.ts`, `scripts/start.ts`, `scripts/measure-local-dev.mjs`, `scripts/free-port.sh`, `controller.sh`, `omni.sh`, `start.sh`.
115	- `src/server/db/schema.ts`, `src/server/db/index.ts`.
116	- `src/server/auth/config.ts`, `password.ts`, `session.ts`, `guards.ts`, `rate-limit.ts`, `audit.ts`.
117	- `src/server/api-errors.ts`, `src/runtime/http/routes/index.ts`, `auth-login.ts`, `runtime-bootstrap.ts`, `terminals.ts`, `settings.ts`.
118	- `src/runtime-api/types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`.
119	- `src/ui/render-web.tsx`, `src/ui/OmniApp.tsx`, then `src/interface/providers.tsx`.
120	- All direct browser API/SSE owners listed in `docs/architecture/common-runtime-multi-surface.md`.
121	- `src/interface/home/HomeApp.tsx`, `useHomeMutations.ts`, `useHomeQueries.ts`, `LiveEventConnectionManager.ts`, `WorkerEntriesManager.ts`, `EventStreamStateManager.ts`, `EventStreamSnapshotCacheManager.ts`, `ConversationNotificationManager.ts`, `GitWorkspaceManager.ts`, `ProjectMemoryPanelManager.ts` after the import-only move in Task 11A.
122	- `src/components/InteractiveTerminal.tsx`, `Terminal.tsx`, file/folder/attachment components, planning controls, and `ConversationMain.tsx`.
123	- All nine `shared/locales/*.json`.
124	- `apps/electron/main.ts`, `preload.ts`, `scripts/build.mjs`, `package.json`, `README.md`.
125	- `apps/vscode/src/extension.ts`, `webview/main.tsx`, `package.json`, `README.md`, `src/vscode-extension/bridge.ts`.
126	- `src/server/cli/options.ts`, `src/server/cli/runner.ts`, `scripts/auth-password.mjs`.
127	- `README.md`, `.env.example`, `AGENTS.md`, `docs/architecture/common-runtime-multi-surface.md`, lifecycle docs, deployment/TLS docs.
128	
129	### Remove at the M2 cutover
130	
131	These removals are explicitly part of the approved Next-removal design and happen only after route parity, Vite packaged e2e, and PWA tests pass:
132	
133	- `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/instrumentation.ts`.
134	- `src/app/home/bootstrap.server.ts` after its interface type consumer moves to `src/shared/bootstrap`.
135	- `next.config.ts`, `next-env.d.ts`, Next-only dependencies/configuration.
136	- Old Next-owned PWA copies after their Vite-owned replacements pass tests.
137	- No file outside this enumerated list is removed as part of the cutover.
138	
139	### Existing large-file rule
140	
141	- `src/app/home/useHomeMutations.ts` (1,269 lines), `HomeApp.tsx` (1,697), and `src/components/Terminal.tsx` (2,553) are split before adding the new behavior they own.
142	- Do not add runner work to already oversized `src/server/supervisor/index.ts` or `src/server/agent-runtime/manager.ts`; use the new focused runner modules.
143	
144	### `.gitignore` requirements
145	
146	- Add `/dist/`, `/apps/mobile/ios/App/Pods/`, `/apps/mobile/ios/DerivedData/`, `/apps/mobile/android/.gradle/`, `/apps/mobile/android/**/build/`, `/apps/mobile/android/local.properties`, signing files, provisioning profiles, keystores, generated release archives, and native SDK caches.
147	- Keep native project source/configuration versioned. Never stage `.env`, auth keys, SQLite files, tokens, certificates/private keys, build output, logs, or local signing state.
148	
149	## Execution checklist
150	
151	### Task 1 — Baseline and boundary tests
152	
153	**Files:** `tests/architecture/interface-boundary.test.ts`, `tests/architecture/typecheck-projects.test.ts`, `eslint.config.mjs`, `tsconfig*.json`, `.gitignore`.
154	
155	- [ ] Record `git status --short` plus the full diff/untracked-file inventory in a scratch note outside the repository. Preserve and re-verify the existing edits to `Terminal.tsx`, model selection, agent runtime, named events, external-session discovery, and their tests after Tasks 3 and 12; do not branch, stash, reset, or overwrite them.
156	- [ ] Extend `scripts/measure-local-dev.mjs` to sample peak and final RSS for the whole process tree under a deterministic 10-minute fixture-agent workload with no live model; check in the pre-split baseline report.
157	- [ ] Add failing architecture tests that enumerate interface entry imports and reject runtime imports from `@/server/*`/`@/runtime/*`, except declared `@/shared/*`.
158	- [ ] Add failing tests that require separate shared/runner/interface typecheck configs and mobile/build ignores.
159	- [ ] Run the new tests and confirm they fail for the current cross-boundary imports/config.
160	- [ ] Create the three tsconfig projects, ESLint restrictions, and `.gitignore` entries; keep the root `typecheck` script running all projects.
161	- [ ] Verify the typecheck-project and `.gitignore` tests pass. Confirm the interface-boundary test fails only for the imports owned by Task 2; Task 2 turns that test green and enforces the ESLint restriction as an error.
162	
163	### Task 2 — Extract genuinely shared types and values
164	
165	**Files:** new `src/shared/*.ts`; old `src/server/workers/entries-types.ts`, `src/server/planning/review-preferences.ts`, `src/server/supervisor/worker-types.ts`; `src/runtime/bootstrap.ts`; affected interface imports.
166	
167	- [ ] Add failing import/runtime tests for worker entry types, planning schema, worker labels, runtime primitives, and bootstrap types from `src/shared`.
168	- [ ] Move pure definitions to the new shared modules; leave server-side re-export shims so unrelated server imports do not churn.
169	- [ ] Move `HomeBootstrapPayload` and runner/capability types out of `src/runtime/bootstrap.ts` so the Vite graph never imports runner modules.
170	- [ ] Update interface imports and prove the Vite-side module graph contains no server/runtime source.
171	- [ ] Repoint `HomeApp.tsx` to `@/shared/bootstrap`, turn the interface-boundary test green, and enforce the interface `no-restricted-imports` rule as an error.
172	- [ ] Run targeted shared/import tests plus all three typechecks.
173	
174	### Task 3 — Epoch-aware event ids, heartbeat, replay, and resync
175	
176	**Files:** `src/shared/runtime.ts`, `src/server/events/named-events.ts`, `src/runtime/http/routes/events.ts`, `src/app/home/LiveEventConnectionManager.ts`, event/lifecycle tests.
177	
178	- [ ] Add failing tests for `<epoch>:<seq>` parsing/comparison, every event frame carrying an id, a process-global id-bearing heartbeat, restart epoch mismatch, cursor below ring floor, and resync reasons.
179	- [ ] Add failing client tests for cursor persistence behind an injectable scope key and clear-on-resync; durable `runnerInstanceId` scoping and the resync governor land after Tasks 13 and 18.
180	- [ ] Implement the per-process epoch, 4096-entry ring, heartbeat event, header/query cursor parsing (`cursor` wins), and stable resync reasons.
181	- [ ] Update `LiveEventCursorManager` to compare epoch + sequence rather than treating all nonnumeric ids as newer.
182	- [ ] Emit the subscriber-overflow diagnostic and add its typed event/error codes without overwriting existing named-event work.
183	- [ ] Verify event-route, cursor, lifecycle reconnect/restart, and event-log tests.
184	
185	### Task 4 — Bounded Node streaming and shutdown behavior
186	
187	**Files:** `src/runtime/http/stream-response.ts`, `src/runtime/http/server.ts`, `src/runtime/http/routes/events.ts`, terminal stream route, server tests.
188	
189	- [ ] Add failing real-server tests for immediate headers, per-frame flush, compressing-proxy flush, `drain` handling, client disconnect cleanup, and upstream reader cancellation.
190	- [ ] Add a non-reading consumer test that drives output past 256 frames/1 MiB, observes eviction/resync or socket close, and samples flat runner RSS.
191	- [ ] Implement streaming without `arrayBuffer()`, with Nagle disabled for SSE and bounded subscriber queues independent of the global ring.
192	- [ ] Track open streams so shutdown stops accepts, emits id-bearing `runner.stopping`, gives a bounded flush window, then aborts readers.
193	- [ ] Verify standalone server, event SSE, terminal SSE, and lifecycle graceful-stop tests.
194	
195	### Task 5 — Isolated managed runner and degraded bridge lifecycle
196	
197	**Files:** new `src/server/runner/*`, `scripts/runner.ts`, extracted pieces from `scripts/dev.ts`, `src/instrumentation.ts`, runner/lifecycle tests.
198	
199	- [ ] Add failing controller tests for adopt, spawn, missing runtime, unhealthy bridge, lock contention, child crash, retry/backoff, ownership-aware shutdown, and explicit instance roots/ports/lockfiles.
200	- [ ] Add failing runner tests proving bridge failure does not prevent health/API/bootstrap, while bind conflict and invalid auth/static configuration fail fast with typed events/errors.
201	- [ ] Implement `ManagedBridgeController` and `RunnerReadinessManager` as Manager-owned state machines; no silent returns/catches.
202	- [ ] Implement `scripts/runner.ts` boot order and isolated gateway port-0 strategy for tests.
203	- [ ] Implement ordered shutdown for HTTP/SSE, PTYs, gateway, and owned/adopted bridge.
204	- [ ] Emit all bridge/runner/error events specified by the design; static-UI events belong to Task 9.
205	- [ ] Point `scripts/start.ts`, controller scripts, and lifecycle subprocess harness at the runner.
206	- [ ] Verify runner unit tests and `pnpm test:lifecycle`; clean all test roots/processes.
207	
208	### Task 6 — Portable route registry, health, and terminal replay contract
209	
210	**Files:** `src/runtime/http/routes/index.ts`, all route modules, `src/runtime/http/server.ts`, `tests/runtime/route-contract-fixture.ts`, `tests/runtime/fixtures/routes.v1.json`, terminal route/tests.
211	
212	- [ ] Generate a checked-in route-contract fixture from the current 49 Next route handlers and 63 registered standalone routes. Add a table-driven `tests/runtime/next-standalone-route-parity.test.ts` that executes every registry route through both adapters against separate per-adapter data/database roots and compares status, normalized headers (including `Set-Cookie` values/security semantics), and body semantics.
213	- [ ] Add parity cases for multipart upload and every SSE endpoint. Compare a bounded normalized frame sequence, abort both clients, and assert subscriber/readers are cleaned up.
214	- [ ] Add failing tests for minimal cross-origin `/api/healthz`, authenticated bootstrap while the bridge is degraded, API 404 behavior, and exactly one response per request.
215	- [ ] Test whether a terminal attach receives bounded scrollback before live output. If it does not, add a failing contract test and implement a size-bounded server replay window before client work begins.
216	- [ ] Move any remaining route-only logic out of `src/app/api/**` into portable route/service modules, with Next handlers temporarily delegating to them.
217	- [ ] Make route registration metadata drive `OPTIONS`, auth, and the contract fixture rather than maintaining parallel lists.
218	- [ ] Verify route parity, health, terminal replay, and lifecycle tests before changing the interface build.
219	
220	### Task 7 — Transport-neutral Runtime APIs
221	
222	**Files:** `src/runtime-api/request.ts`, `stream.ts`, `domains/*.ts`, `types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`, adapter contract tests.
223	
224	- [ ] Inventory every existing API/SSE call in a checked-in `docs/architecture/runtime-api-migration-inventory.md`, mapping each call site to its target domain method; update `common-runtime-multi-surface.md` from the same inventory. Add failing compile/runtime tests for typed request, abort, redirect refusal, error normalization, stream frames, and all domain methods.
225	- [ ] Define one `RuntimeAPIs` surface with domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
226	- [ ] Implement the web adapter with injectable `fetch`/stream creation and no direct global network access in shared consumers.
227	- [ ] Keep Electron and VSCode adapters behaviorally compatible while their host transports are replaced later.
228	- [ ] Run identical adapter contract tests against web and fake validated host transports.
229	
230	### Task 8 — Vite interface scaffold and selected shadcn blocks
231	
232	**Files:** `apps/interface/**`, `components.json`, `package.json`, `pnpm-lock.yaml`, `src/ui/OmniApp.tsx`, current `src/app/home/HomeApp.tsx` (moved in Task 11A), `src/components/Terminal.tsx`, `src/components/cli-brand-icons.tsx`, `src/components/AttachmentImagePreviewDialog.tsx`, `src/components/home/{HomeHeader,ConversationMain,UserInputMessage,ConversationComposer}.tsx`, interface build/import tests.
233	
234	- [ ] Add failing build tests requiring browser and packaged Vite outputs, correct aliases, no Node/server modules, and a mountable `app-shell.html`.
235	- [ ] Add Vite, React plugin, split build scripts, and interface HTML/entry files. Keep the existing interface rendering through `src/ui/render-web.tsx`.
236	- [ ] Replace the four `next/dynamic` usages with `React.lazy` + `Suspense`, the five `next/image` usages with appropriate native `<img>` rendering, and `next/font/google` Geist/Geist Mono with self-hosted `@fontsource` packages in the interface HTML/styles.
237	- [ ] Run `pnpm dlx shadcn@latest add sidebar-07` and `pnpm dlx shadcn@latest add login-03`; record the generated files and run build/typecheck before adapting either block.
238	- [ ] Keep the generated primitives, tokens, and dependency additions; remove only demo-page wiring that conflicts with the real app.
239	- [ ] Add a Vite backstop test that fails if an interface chunk contains `src/server`, `src/runtime/http`, `node:*`, or a server-only package.
240	- [ ] Verify both Vite targets, interface typecheck, and the existing component test suite.
241	
242	### Task 9 — Static interface serving, bootstrap, and security headers
243	
244	**Files:** `src/runtime/http/static-files.ts`, `bootstrap-html.ts`, `security-headers.ts`, `vite-csp-manifest.ts`, `src/runtime/http/server.ts`, static/CSP tests.
245	
246	- [ ] Add failing tests for SPA fallback, API/asset 404s, cache headers, traversal/symlink rejection, escaped bootstrap data, malformed/missing CSP manifest, and exactly one `runner.static_ui_enabled` or `runner.static_ui_missing` boot event.
247	- [ ] Preserve deep links: add failing tests for `/session/<uuid>` and `/session/<12-hex>` resolving to the same selected run as `/?run=`, then parse the path into bootstrap and make the interface entry use `location.pathname` when `?run=` is absent. Keep `?project=` and legacy `?pair=` bootstrap behavior intact.
248	- [ ] Add failing CSP tests for no third-party scripts, web versus packaged `connect-src`, `frame-ancestors`, `base-uri`, referrer policy, and an approved theme-script hash.
249	- [ ] Serve the built interface without buffering and validate `csp-manifest.json` at startup.
250	- [ ] Ship Trusted Types in `Content-Security-Policy-Report-Only`; exercise xterm, Markdown, highlighting, and dialogs. Enforce it only if those paths pass with the application policy, otherwise document the narrow exception and keep the report-only test as a release gate.
251	- [ ] Add `--static-dir`, `--no-static`, and clear fail-fast configuration behavior to runner CLI/config.
252	- [ ] Verify static-server, CSP, runner-startup, and packaged-interface tests.
253	
254	### Task 10 — PWA application shell and offline behavior
255	
256	**Files:** `apps/interface/app-shell.html`, `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js`, PWA tests; old `public/` copies at cutover.
257	
258	- [ ] Add failing tests that the manifest starts at the mountable app shell, same-origin app assets are cached, runner API/SSE requests are always network pass-through, and no bearer/session response enters Cache Storage.
259	- [ ] Implement install/update/activate logic with versioned static caches and deterministic cleanup.
260	- [ ] Render the normal shared interface offline with runner profiles and honest stale/offline states instead of a separate dead-end page.
261	- [ ] Verify offline launch, online recovery, update activation, and multi-origin pass-through in Playwright.
262	
263	### Task 11 — Vite cutover and removal of Next
264	
265	**Files:** `package.json`, configs, scripts, `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/home/bootstrap.server.ts`, `src/instrumentation.ts`, old PWA files, `AGENTS.md`, `playwright.live.config.ts`, `tests/ui/ssr-bootstrap.test.ts`, `tests/e2e/live/{auth,auth.test,safety.test,playwright-live-config.test}.ts`, `tests/runtime-api/web-runtime-api.test.ts`, `tests/server/restart-control.test.ts`, `tests/electron/runtime-shell.test.ts`, `tests/vscode/bridge.test.ts`, `apps/vscode/package.json`, `scripts/{dev,dev-compression-proxy,remote-restart,measure-local-dev,free-port,cleanup-live-agent-journey}.*`, app READMEs.
266	
267	- [ ] Add a failing cutover test that rejects `next`, `.next`, Next route ownership, and Next-only environment assumptions.
268	- [ ] Make `dev`, `build`, `start`, local-size measurement, and port cleanup use the runner plus Vite.
269	- [ ] Grep-audit every live `3035` reference outside `docs/codex-history/**`, `docs/superpowers/**`, and dated retrospective documents under `docs/architecture/**`. Update or retire each operator source/script/config/test/doc reference, including `AGENTS.md`, Playwright/live helpers, dev/restart/measurement/cleanup scripts, app READMEs, `common-runtime-multi-surface.md`, and the listed tests; add a test asserting no live reference remains under that exclusion set.
270	- [ ] Retiring the old dev compression proxy must retain the compressing-proxy SSE harness proven in Task 4.
271	- [ ] Re-run the whole-process measurement and enforce the calibrated `<2 GB` development and `<1 GB` production-runner thresholds; a miss blocks cutover.
272	- [ ] Run `tests/runtime/next-standalone-route-parity.test.ts`, packaged-interface e2e, PWA, lint, all typechecks, unit tests, lifecycle tests, and production build.
273	- [ ] Only after those gates pass, print the exact approved deletion list and remove only the explicitly enumerated Next files/dependencies and old Vite-replaced PWA copies. The user's instruction to fully implement this plan authorizes that exact list; any added deletion requires fresh confirmation.
274	- [ ] Retarget `tests/ui/ssr-bootstrap.test.ts` from the removed `bootstrap.server.ts` file to the portable runner bootstrap route.
275	- [ ] Re-run the full cutover matrix and confirm local development has one runner process tree and no hidden second server.
276	
277	### Task 11A — Move the interface out of `src/app`
278	
279	**Files:** `src/app/home/**` → `src/interface/home/**`; `src/app/providers.tsx` → `src/interface/providers.tsx`; app styles/assets → `src/interface/styles/**` or `apps/interface/**`; affected imports/tests.
280	
281	- [ ] Add a failing architecture test that no shared interface entry imports from or lives under the Next-owned `src/app` tree.
282	- [ ] Move `home/**` and `providers.tsx` with import-path-only changes; move `globals.css`, `fx.css`, `fx/`, `fx-spike/`, and `favicon.ico` under Vite-owned interface paths and import them from `apps/interface/src/main.tsx`.
283	- [ ] Repoint `tests/app/**` imports without changing test behavior or creating a second test suite.
284	- [ ] Verify interface typecheck, unit tests, visual CSS smoke tests, and the Vite build before any behavior work resumes.
285	
286	### Task 11B — Keep Electron working through the Vite cutover
287	
288	**Files:** `apps/electron/main.ts`, `apps/electron/scripts/build.mjs`, Electron bootstrap/migration helper, Electron tests.
289	
290	- [ ] Add failing tests that the transitional Electron shell loads `dist/interface`, keeps its current local `startOmniServer` transport, and does not build a second renderer artifact or inline HTML.
291	- [ ] Before changing renderer origin, export legacy localStorage preferences and drafts from the current renderer origin into an atomic versioned payload under Electron `userData`; test success, retry, corrupt payload, and idempotence.
292	- [ ] Point the shell at the Vite production artifact and remove the old esbuild renderer pipeline while leaving remote-only conversion for Task 22.
293	- [ ] Verify Electron build and current desktop journeys at the M2 boundary.
294	
295	### Task 12 — Migrate direct network consumers and split oversized owners
296	
297	**Files:** every call site in `docs/architecture/runtime-api-migration-inventory.md`; `src/interface/home/mutations/*.ts`; `src/components/terminal/*`; `HomeApp.tsx`; query/Manager files.
298	
299	- [ ] Add failing architecture tests that reject direct `fetch`, `EventSource`, absolute API construction, or transport-specific IPC outside runtime adapters.
300	- [ ] Split `useHomeMutations.ts`, `HomeApp.tsx`, and `Terminal.tsx` into focused Manager/domain/render modules before adding runner behavior; preserve the user's current `Terminal.tsx` changes.
301	- [ ] Move each mutation/query/stream consumer to `RuntimeAPIs`; preserve abort, optimistic update, and server-authority behavior with focused tests.
302	- [ ] Replace terminal stream ownership only after the bounded replay contract from Task 6 is proven.
303	- [ ] Keep all shared domain state in Manager classes and verify narrow subscriptions for high-churn terminal/draft/cursor state.
304	- [ ] Verify migrated consumer tests, interface boundary tests, typechecks, and current end-to-end journeys.
305	
306	### Task 13 — Runner identity, compatibility, capabilities, and auth persistence
307	
308	**Files:** `src/shared/bootstrap.ts`, `api-revision.ts`, `src/server/db/schema.ts`, migrations, bootstrap route, session/auth tests.
309	
310	- [ ] Add failing migration tests for durable `runnerInstanceId`, session kind/origin/device metadata, idle/absolute expiry, last-used throttling, and existing database upgrades.
311	- [ ] Add failing contract tests for `current`/`minimum` revisions, declared additive-capability versus transport-breaking changes, unknown additive capabilities, and undeclared fixture diffs.
312	- [ ] Persist runner identity once per data root and return identity, revision window, capability ids, display name, bridge/readiness state, and stream epoch from bootstrap.
313	- [ ] Implement API-change classification in `src/shared/api-revision.ts` and make route fixture diffs fail unless declared.
314	- [ ] Verify clean and upgraded databases, bootstrap schema, revision compatibility, and identity stability across restart.
315	
316	### Task 14 — Password login, native-session rules, CORS, proxy trust, and TLS policy
317	
318	**Files:** `src/server/auth/{config,password,session,guards,rate-limit,audit,cors,trusted-proxy}.ts`, login/health routes, runner config, auth/security tests.
319	
320	- [ ] Add failing tests for cookie login, originless native bearer login, rejection when native login carries `Origin`, `Referer`, or fetch-metadata headers, later native-session origin rejection, password never being returned or stored, cookie tokens never being accepted as bearer tokens, and bearer tokens never being accepted as cookies.
321	- [ ] Add failing CORS tests for exact stored browser origin, `Vary: Origin`, error responses, registry-driven preflight, cookie-route exclusion, and `Access-Control-Allow-Credentials` never appearing.
322	- [ ] Add failing tests for socket-derived client/protocol identity, explicitly configured trusted proxies, plaintext non-loopback refusal, and loopback development allowance.
323	- [ ] Implement one rate-limit/audit path shared by password and browser authorization entry points.
324	- [ ] Define native TLS behavior: standard platform trust first; a per-profile SPKI pin may be used only after trust failure, requires explicit fingerprint confirmation, and requires explicit re-pin on change.
325	- [ ] Verify auth, CORS, proxy-spoofing, TLS-policy, and lifecycle tests.
326	
327	### Task 15 — Browser approval with S256 PKCE
328	
329	**Files:** `src/server/auth/browser-authorization.ts`, authorization routes, `src/interface/auth/InterfaceAuthorizationScreen.tsx`, web adapter, locales, auth/e2e tests.
330	
331	- [ ] Add failing tests for S256-only verifier/challenge length and alphabet, exact HTTPS or loopback-HTTP requesting origin, user gesture, state binding, 60-second expiry, atomic single use, origin binding, and no code/token logging.
332	- [ ] Add failing browser tests for popup success, blocked popup, user denial, timeout, wrong origin/state, replay, opener loss with platform return link, and reauthorization.
333	- [ ] Implement the target runner's same-origin approval page using the existing password session and localized copy in every locale.
334	- [ ] Exchange the code only for the bound origin and persist the resulting browser bearer session, never the password or PKCE verifier.
335	- [ ] Verify password-login routes still have no cross-origin support and the complete two-origin PKCE journey passes.
336	
337	### Task 16 — Stream tickets and cross-origin streams
338	
339	**Files:** `src/server/auth/stream-tickets.ts`, ticket route, events/terminal routes, web stream adapter, stream/auth tests.
340	
341	- [ ] Add failing tests for 60-second expiry, atomic single use, exact session/path/origin binding, fresh ticket per reconnect, ticket redaction, and session revalidation at redemption.
342	- [ ] Add a real cross-origin `EventSource` test requiring `Access-Control-Allow-Origin: <boundOrigin>` and `Vary: Origin` on the successful ticketed 200 response.
343	- [ ] Implement ticket issuance/redemption for main and terminal streams; keep cursor separate and non-secret.
344	- [ ] Make the web adapter close native `EventSource` retry, request a fresh ticket, and reconnect under `RunnerConnection` control.
345	- [ ] Verify cross-origin main/terminal streaming, restart/resync, session revocation, and no credential leakage in logs.
346	
347	### Task 17 — Session administration, password rotation, runner naming, and CLI
348	
349	**Files:** sessions/settings routes, auth modules, `src/server/cli/*`, `scripts/auth-password.mjs`, CLI/session tests.
350	
351	- [ ] Add failing tests for 30-day idle/90-day absolute browser sessions, 90-day idle/365-day absolute native sessions, at-most-once-per-minute touch, maximum 50 active sessions, and successful-login LRU eviction excluding the new session.
352	- [ ] Add failing list/current/revoke/revoke-all tests, including immediate stream/mutation invalidation and stable audit/named events.
353	- [ ] Implement `--runner <url>` with `OMNI_TOKEN`, `--token-file`, or token stdin; never put a token in `process.argv`. If the legacy `--token` argv form is retained for compatibility, emit an explicit warning and test its redaction.
354	- [ ] Add `omni auth init` as the provisioning alias and `--password-file` for unattended setup; refuse password files whose mode is not `0600`.
355	- [ ] Make password rotation revoke all sessions by default, with an explicit audited `--keep-sessions` override.
356	- [ ] Add authenticated runner rename with validation, audit/event emission, and bootstrap propagation.
357	- [ ] Add `omni runner rekey`. A valid same-origin session automatically re-pins the new runner identity; remote profiles require explicit login and identity confirmation.
358	- [ ] Verify API, CLI, lifecycle, and concurrent-session tests.
359	
360	### Task 18 — Profile and credential stores
361	
362	**Files:** `src/interface/runners/{RunnerProfile,RunnerProfileStore,RunnerCredentialStore}.ts`, web implementations, migration/store tests.
363	
364	- [ ] Add failing tests for versioned profile migrations, pre-login profile UUID scope, post-login `runnerInstanceId` rekey, duplicate identity merge, URL edits, forget behavior, and per-runner preferences/drafts/cursors.
365	- [ ] Implement profile metadata persistence separately from credentials; expose credential handles, never raw secrets, to interface Managers.
366	- [ ] Implement web profile storage and browser bearer storage with exact-origin/identity checks and explicit clearing on forget/revocation, including a non-deletable same-origin profile that survives migration and corrupt-store reset-to-default with a visible localized notice.
367	- [ ] Test rekey handling: a valid same-origin session automatically accepts the new identity while remote profiles remain blocked until explicit login/confirmation.
368	- [ ] Add collision and identity-mismatch recovery states without silently replacing trusted identity.
369	- [ ] Verify restart, migration, failed-write, partial-profile, and store-isolation tests.
370	
371	### Task 19 — Concurrent RunnerConnection and RunnerRegistry Managers
372	
373	**Files:** `src/interface/runners/{RunnerConnection,RunnerRegistry,RunnerRegistryProvider}.ts(x)`, existing stream/cache/notification Managers, runner-state tests.
374	
375	- [ ] Add failing state-machine tests for connecting, online, offline, deferred, needs-reauth, TLS-untrusted, identity-mismatch, incompatible, degraded/resync, and runner-stopping.
376	- [ ] Add race tests for stale responses after runner switch, delete/re-add, auth replacement, delayed bootstrap, reconnect timers, and mutation completion.
377	- [ ] Add failing tests that cursors persist per durable `runnerInstanceId`, clear on resync or trusted-identity change, and more than three resyncs within five minutes enter degraded jittered backoff.
378	- [ ] Implement one live main stream per authenticated profile, runner-scoped Query clients/keys, jittered exponential retry capped at five minutes, and the resync anti-storm governor.
379	- [ ] Keep only the active runner's terminal streams; detach on switch and request bounded scrollback on reactivation.
380	- [ ] Resolve `/session/:runId` against the active runner only. If the active snapshot does not contain the run, show an explicit not-found state without probing other connections; test deep-link arrival while another runner is active.
381	- [ ] Bound per-runner preview caches and global LRU memory while keeping persisted drafts/cursors authoritative to their store.
382	- [ ] Verify switching does not close inactive main streams or cancel their mutations and all manager subscriptions remain narrow.
383	
384	### Task 20 — Runner switcher, connect flow, sessions UI, notifications, and i18n
385	
386	**Files:** runner UI components, shared shell/home components, notification Manager, all nine `shared/locales/*.json`, UI/accessibility tests.
387	
388	- [ ] Add failing UI tests for first-run onboarding, add/edit/forget, active switching, status labels, reauth, TLS confirm/re-pin, identity mismatch, incompatibility, deferred runner, session revoke, and runner rename.
389	- [ ] Adapt the installed `sidebar-07` block into the persistent runner switcher and `login-03` into connect/authorize screens while retaining existing OmniHarness visual language.
390	- [ ] Keep runner-switcher controls hidden in the transitional Electron shell until Task 22 enables the remote-only host.
391	- [ ] Render one workspace at a time; make inactive runner activity visible through bounded counts and runner-named notifications.
392	- [ ] Add every new string to all nine locale files and use `useI18nSnapshot()` + `t()` at render boundaries.
393	- [ ] Verify keyboard navigation, focus restoration, screen-reader labels, reduced motion, narrow desktop/mobile widths, and live language switching.
394	
395	### Task 21 — Web/PWA two-runner and scale acceptance
396	
397	**Files:** `tests/e2e/multi-runner*.spec.ts`, fixtures/runner harness, memory scripts, Playwright config.
398	
399	- [ ] Start two isolated real runners on port 0 with distinct roots/passwords/identities and the packaged Vite artifact; do not reuse production/user data.
400	- [ ] Test add/login/PKCE, both live streams, active switching, inactive mutation completion, terminal detach/replay, offline/restart/epoch resync, revoke/reauth, identity mismatch, and PWA recovery.
401	- [ ] Run an eight-runner benchmark with all main streams live and bounded activity; require less than 40 MB incremental client memory per added idle runner and less than 750 MB aggregate under the specified workload.
402	- [ ] Run one runner at the declared `minimum` API revision and one at `current`; keep both connected, hide only unsupported additive capabilities with an explanation, and block only transport-breaking incompatibility.
403	- [ ] Assert retry jitter, deferred/background status when the platform limits sockets, and no uncaught browser errors or secret-bearing logs.
404	- [ ] Clean all test sessions, databases, processes, and generated run artifacts.
405	
406	### Task 22 — Remote-only Electron host and migration
407	
408	**Files:** `apps/electron/{main,preload,scripts/build,package}.ts/json/mjs`, new Electron store/bridge/TLS/migration modules, Electron tests/docs.
409	
410	- [ ] Add failing tests proving Electron never imports or starts the runner, renderer network access to runners is blocked, and IPC contracts validate every request/response/frame.
411	- [ ] Implement remote HTTP/SSE in the main process, `safeStorage` credential persistence, per-profile SPKI confirmation/re-pin, bounded stream delivery, and renderer-safe error objects.
412	- [ ] Import the versioned legacy preferences/drafts payload exported in Task 11B, then add an explicit path to profile the former embedded runtime as a local or remote runner; never silently abandon existing data.
413	- [ ] Test app restart, multiple runners, offline/reconnect, revoke, deep links, notifications, migration success/failure/rollback, and packaged CSP.
414	- [ ] Build and smoke-test the signed-development/unsigned-local package supported by the host environment.
415	
416	### Task 23 — VSCode remote runner client
417	
418	**Files:** `apps/vscode/src/extension.ts`, `webview/main.tsx`, `src/vscode-extension/bridge.ts`, VSCode manifest/docs/tests.
419	
420	- [ ] Add failing bridge tests for all-profile connection ownership, bearer-only host networking, validated messages, stream reconnect/cursor behavior, and renderer token isolation.
421	- [ ] Store sessions only in `ExtensionContext.secrets`; migrate and clear the current plain setting without logging its value.
422	- [ ] Implement the same profile/status/switching/session flows through the shared interface and VSCode host adapter.
423	- [ ] Verify multi-runner restart/reload, revoke/reauth, identity mismatch, notifications, and extension build/package.
424	
425	### Task 24 — Capacitor iOS and Android hosts
426	
427	**Files:** `apps/mobile/**`, `src/runtime-api/capacitor.ts`, root workspace/scripts, mobile/native contract tests.
428	
429	- [ ] Add Capacitor packages/config and generate committed iOS/Android source projects; add only `packages: ["apps/mobile"]` to `pnpm-workspace.yaml` (never an `apps/*` glob), keep generated build/signing/cache output ignored, and prove Electron/VSCode builds are unchanged by workspace membership.
430	- [ ] Point `capacitor.config.ts` `webDir` at the single `../../dist/interface` artifact. Add iOS `NSLocalNetworkUsageDescription` with strict ATS outside loopback development, and Android `usesCleartextTraffic=false` with a debug-only loopback network-security configuration; assert release builds never bypass certificate checks.
431	- [ ] Add failing JavaScript/native contract tests for request, abort, SSE frames, bounded queues, credential handles, TLS trust failure, explicit pin/re-pin, deep links, lifecycle suspension/resume, and notifications.
432	- [ ] Implement iOS networking/SSE with `URLSession`, secrets with Keychain Services, per-profile trust/pinning, links, and local notifications in a custom Capacitor plugin.
433	- [ ] Implement Android networking/SSE with OkHttp, encrypted token material backed by Android Keystore, per-profile trust/pinning, links, and local notifications in the matching plugin.
434	- [ ] Keep bearer tokens inside native code and block direct WebView runner networking with packaged CSP.
435	- [ ] Implement all-profile connections while active; when the OS suspends the app, persist cursors and reconnect/resync honestly on resume—no v1 push guarantee.
436	- [ ] Run native unit/contract tests, `cap sync`, Android debug build/tests, and iOS simulator no-sign build/tests on the available host.
437	
438	### Task 25 — Security, deployment, migration, and operator documentation
439	
440	**Files:** `README.md`, `.env.example`, app READMEs, architecture/lifecycle docs, new deployment/TLS/session/migration docs.
441	
442	- [ ] Document the logical runner/process model, bridge-degraded behavior, static/no-static modes, ports/locks/data roots, TLS requirements, trusted proxy configuration, and backup/restore.
443	- [ ] Document password login, browser approval, session TTL/list/revoke, password rotation, URL changes, identity mismatch, SPKI confirmation/re-pin, and credential-storage boundaries.
444	- [ ] Document Electron migration, VSCode secret migration, mobile build/signing prerequisites, PWA offline limits, platform socket/suspension limits, and v1 non-goals.
445	- [ ] Add copy-paste smoke commands that use temporary roots and never expose passwords in process listings or logs.
446	- [ ] Validate every documented command in a disposable test environment.
447	
448	### Task 26 — Full verification, security review, and clean handoff
449	
450	**Files:** all changed files and generated contract/build reports; no new product behavior.
451	
452	- [ ] Run targeted suites after each task, then final `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:lifecycle`, `pnpm build`, and `pnpm test:e2e`.
453	- [ ] Run runner route/static/security tests, two-runner and eight-runner suites, Electron build/tests, VSCode build/tests, Capacitor contract/sync, Android build/tests, and iOS simulator build/tests.
454	- [ ] Inspect logs/event ring for silent decisions, missing `error.surfaced`, missing SSE ids, leaked passwords/tokens/tickets/codes, CORS credentials, and unbounded subscriber/cache growth.
455	- [ ] Compare the final route fixture and API revision declaration; require every contract change to be additive-capability or transport-breaking-revision classified.
456	- [ ] Confirm Next/server code is absent from interface artifacts, native renderers cannot directly reach runners, and all credentials survive/revoke only through platform-secure stores.
457	- [ ] Clean only test-created sessions, roots, databases, processes, and build artifacts covered by test cleanup; preserve all user-owned files and pre-existing changes.
458	- [ ] Record exact command results, platform limitations if a required native toolchain is unavailable, and any explicitly documented Trusted Types exception before claiming completion.
459	

uuid: b468ed71-3068-4e72-836e-282b3fcb2c58
parent: 8a48653e-036b-486b-b537-fc6fac10e152
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:37:36.175Z","phase":null} -->
## Claude attachment · 2026-07-30T22:37:36.175Z

```text
{
  "type": "deferred_tools_delta",
  "addedNames": [],
  "addedLines": [],
  "removedNames": [],
  "readdedNames": [],
  "pendingMcpServers": [],
  "needsAuthMcpServers": [
    "claude.ai Gmail",
    "claude.ai Google Calendar",
    "claude.ai Google Drive"
  ]
}

binary omitted from archive

uuid: 2a05f82b-28ab-4993-ae36-ea1d32b32c92
parent: b468ed71-3068-4e72-836e-282b3fcb2c58
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:37:38.196Z","phase":null} -->
## Claude thinking · 2026-07-30T22:37:38.196Z



uuid: dc7c2e62-e746-47f9-8399-9cee667e5da6
parent: 2a05f82b-28ab-4993-ae36-ea1d32b32c92

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:37:38.700Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:37:38.700Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/AGENTS.md"
}

uuid: 7e81a34d-9a0e-4355-b291-ae25f7889f4d
parent: dc7c2e62-e746-47f9-8399-9cee667e5da6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:37:38.706Z","phase":null} -->
## Claude tool result: toolu_019wFCReMVDRZtSAp1L9ZjVS · 2026-07-30T22:37:38.706Z

```text
1	CRITICAL!!: 
2	- NEVER EVER EVER create a branch!!! branches are FORBIDDEN!!!
3	- NEVER EVER EVER delete the `bugdrop-screenshots` branch, locally or remotely. It is protected project history.
4	- NEVER create a worktree, UNLESS the user has specifically asked for it!
5	- NEVER delete files unless the user has specifically asked for it. If you think a file is misplaced, unrelated, or stale, that is an entirely separate request — ask first. "Looks unrelated to this task" is not authorization to delete.
6	
7	- When the user gives a UUID and asks what is going on with it, treat it as an OmniHarness conversation/session lookup: check `sqlite.db`, starting with the `runs` row for that UUID, then inspect related `workers`, `messages`, `execution_events`, queued messages, and validation/plan records as needed.
8	- To delete all conversations and associated persisted artifacts, use `scripts/delete-conversations.sh`
9	
10	Testing:
11	- When testing the app, use the already-running process if one exists instead of starting another server.
12	- The normal local app URL is `http://localhost:3035`; the compressed Next dev server is usually at `http://localhost:3050`.
13	- Clean up any test sessions/conversations and their associated persisted artifacts before finishing.
14	- For lifecycle / chaos-style regressions (reconnect, restart, FK-on-delete, plan-review leftover state), use `pnpm test:lifecycle`. Scenarios live under `tests/lifecycle/scenarios/` and drive the control plane via HTTP/SSE — no Chromium. To debug a specific reported bug, mirror it as a new scenario file.
15	- Read `docs/architecture/lifecycle-observability-and-testing.md` before adding new server-side state transitions. It is the spec all new code is held to.
16	- Worker conversation content (direct-control and supervisor-driven worker turns) lives in the unified worker stream — one append-only JSONL per worker at `app-data/run-data/<runId>/<workerId>.jsonl`. Persist new worker content through `appendWorkerEntry` in `src/server/workers/output-store.ts`; render it through `WorkerEntriesManager` and the `entries` prop on `Terminal`. Do NOT add a parallel persistence layer (a sibling JSONL, a new `messages.kind`, an in-memory cache that the frontend reconciles against the stream). See `docs/architecture/worker-conversation-stream.md`.
17	
18	Lifecycle observability rules (full doc: `docs/architecture/lifecycle-observability-and-testing.md`):
19	- Every server-side decision (spawn, reattach, recreate, give up, refuse, delete, fail) emits a typed named event via `emitNamedEvent` from `@/server/events/named-events`. Silent early returns and bare `catch {}` are bugs.
20	- User-relevant failures additionally emit `error.surfaced` with a stable `code` (typed union in `named-events.ts`), `surface`, and at least one relevant subject id such as `runId`/`workerId`/`conversationId`/`accountId`. Never funnel through a blanket wrapper in `api-errors.ts`.
21	- All SSE frames carry an `id:`. Clients reconnect with `Last-Event-ID`; the server replays from the ring buffer or emits `stream.resync_required`. Snapshot bootstrap is `GET /api/events?snapshot=1` (anchor id in the `x-omni-last-event-id` response header).
22	- Dev-only event log: `GET /api/events/log?since=<id>&runId=<id>` returns the ring buffer as JSON. Use this when triaging "X didn't happen" bug reports — if the event isn't there, the server didn't do the thing, and the next step is finding the silent branch.
23	- Chaos is a client-side concern. Never add fault-injection code paths to server code.
24	
25	Frontend i18n:
26	- EVERY user-facing frontend string MUST live in `shared/locales/*.json` and be rendered with the `t()` function from `@/lib/i18n`.
27	- NEVER hardcode user-facing JSX text, button labels, dialog titles, aria-labels, titles, placeholders, empty states, status labels, help text, error fallback text, or visible option labels directly in components.
28	- For every new user-facing string, add the key to `shared/locales/en.json` and every other locale file in `shared/locales/` in the same change. Use stable dotted keys like `settings.runtime.recovery` or `conversation.sidebar.search`.
29	- Components that render translated strings and need to update when the language changes MUST subscribe to the i18n manager by calling `useI18nSnapshot()` from `@/lib/i18n`; then render text with the existing `t("key", params?)` function. The hook is only for re-rendering; `t()` is the translation API.
30	- Non-React modules that produce user-visible text must still use `t("key", params?)` at the boundary where text is produced. Protocol values, storage keys, API paths, CSS classes, model ids, and database values are not translation keys unless they are displayed as copy.
31	- Do not pass translated strings through transactions or persist translated UI copy. Store stable ids/values and translate at render time.
32	
33	React Best Practices:
34	- MutableRefObject is deprecated in React; use RefObject instead.
35	- NEVER use require() to import modules. Use import instead.
36	- ALWAYS centralize all state in global single source of truth Manager classes. Components/listeners subscribe to updates from Managers and use Manager methods to update data.
37	- Always implement a custom data manager for any data structure. NEVER use separate state variables and arrays as the source of truth.
38	- NEVER send data around in transactions.
39	- Avoid using useEffect() to update state. Prefer useCallback() or Manager methods for explicit state transitions.
40	- Avoid callback hell, race conditions, and infinite loops.
41	- NEVER store string literals or UI settings for the frontend in the .env file. Use literals in files, inline arrays, or .json files instead.
42	- When debugging React: if a fix did not work, think hard about whether this is a race condition. Race conditions are common in React.
43	

uuid: 21cb1fa0-a54a-4417-b3be-10c96ae0454b
parent: 7e81a34d-9a0e-4355-b291-ae25f7889f4d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:37:57.183Z","phase":null} -->
## Claude thinking · 2026-07-30T22:37:57.183Z



uuid: 4f6e3cbf-d77c-4708-80c2-86320e51b98f
parent: 21cb1fa0-a54a-4417-b3be-10c96ae0454b

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:37:59.935Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:37:59.935Z

```json
{
  "command": "echo \"=== bootstrap.server consumers ===\" && grep -rn \"bootstrap.server\\|bootstrap\\.server\" --include=*.ts --include=*.tsx src apps tests scripts | head -30 && echo \"=== next route handlers ===\" && find src/app/api -name \"route.ts\" | wc -l && echo \"=== registered standalone routes ===\" && grep -c \"path:\" src/runtime/http/routes/index.ts 2>/dev/null; echo \"=== electron next dep ===\" && grep -n \"next\\|esbuild\\|vite\" apps/electron/package.json apps/electron/scripts/build.mjs 2>/dev/null | head -20"
}

uuid: d8338635-dbea-401d-a7eb-13a514a56bb3
parent: 4f6e3cbf-d77c-4708-80c2-86320e51b98f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:38:00.074Z","phase":null} -->
## Claude tool result: toolu_01765weabMzAWUQNUoRTz5vm · 2026-07-30T22:38:00.074Z

```text
=== bootstrap.server consumers ===
(eval):1: no matches found: --include=*.ts
=== next route handlers ===
      49
=== registered standalone routes ===
0
=== electron next dep ===
apps/electron/scripts/build.mjs:1:import { build } from "esbuild";

uuid: ed0d7034-a743-4b48-a6bd-46094689efc6
parent: d8338635-dbea-401d-a7eb-13a514a56bb3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:38:03.003Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:38:03.003Z

```json
{
  "command": "echo \"=== bootstrap.server consumers ===\" && grep -rn \"bootstrap\\.server\" src apps tests scripts 2>/dev/null | head -30 && echo \"=== routes index ===\" && ls src/runtime/http/routes/ | head -40 && echo \"=== route count ===\" && grep -rn \"registerRoute\\|method:\" src/runtime/http/routes/index.ts | wc -l"
}

uuid: 54893f2a-79c8-44a0-bde7-687df1675fb6
parent: ed0d7034-a743-4b48-a6bd-46094689efc6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:38:03.131Z","phase":null} -->
## Claude tool result: toolu_01NQsMvJr59ELeCaV9vwmFhc · 2026-07-30T22:38:03.131Z

```text
=== bootstrap.server consumers ===
src/app/page.tsx:2:import { buildHomeBootstrap } from "./home/bootstrap.server";
apps/vscode/webview/main.tsx:162:    void this.apis.native?.openExternal({ url: bootstrap.serverUrl });
apps/vscode/webview/main.tsx:246:        <div>{bootstrap.serverUrl}</div>
tests/ui/ssr-bootstrap.test.ts:34:    const homeBootstrapSource = readSource("src/app/home/bootstrap.server.ts");
=== routes index ===
accounts.ts
agent-detail.ts
agents-catalog.ts
agents.ts
attachments.ts
auth-login.ts
auth-logout.ts
auth-pair-redeem.ts
auth-pair.ts
auth-session.ts
claude-model-gateway.ts
codex-auth-status.ts
conversation-messages.ts
conversation-transcript.ts
conversations.ts
cookies.ts
events-log.ts
events.ts
external-sessions.ts
filesystem.ts
git.ts
index.ts
llm-models.ts
messages.ts
next-request.ts
notifications.ts
planning.ts
plans.ts
prewarm-worker.ts
project-memory.ts
run-answer.ts
run-resume.ts
runs.ts
runtime-bootstrap.ts
settings.ts
supervisor.ts
terminals.ts
worker-entries.ts
=== route count ===
       0

uuid: 8283e4d2-a7d2-4d8a-84a1-193a7737e3a5
parent: 54893f2a-79c8-44a0-bde7-687df1675fb6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:38:05.980Z","phase":null} -->
## Claude thinking · 2026-07-30T22:38:05.980Z



uuid: 936dd157-55d7-4028-a591-5a7225b87e27
parent: 8283e4d2-a7d2-4d8a-84a1-193a7737e3a5

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:38:07.521Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:38:07.521Z

```json
{
  "command": "head -60 src/runtime/http/routes/index.ts && echo \"---- total route entries ----\" && grep -rno \"createRoute\\|defineRoute\\|{ *method:\" src/runtime/http/routes/*.ts | wc -l"
}

uuid: d8fde4ef-aca1-4e2d-83be-9f85fbc1b48d
parent: 936dd157-55d7-4028-a591-5a7225b87e27
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:38:07.619Z","phase":null} -->
## Claude tool result: toolu_01PeSeRGsFGqpRXKjHDGpz9g · 2026-07-30T22:38:07.619Z

```text
import { createOmniHttpRegistry } from "@/runtime/http/registry";
import { handleAuthSessionRequest } from "./auth-session";
import { handleAuthLoginRequest } from "./auth-login";
import { handleAuthLogoutRequest } from "./auth-logout";
import { handleAuthPairRequest } from "./auth-pair";
import { handleAuthPairRedeemRequest } from "./auth-pair-redeem";
import { handleSettingsRequest } from "./settings";
import { handleClaudeModelGatewayRequest } from "./claude-model-gateway";
import { handleAccountDetailRequest, handleAccountStatusRequest, handleAccountsRequest } from "./accounts";
import { handleAgentsRequest } from "./agents";
import { handleAgentsCatalogRequest } from "./agents-catalog";
import { handleAgentAcpRequest, handleAgentDetailRequest, handleAgentElicitationRequest, handleAgentPermissionRequest } from "./agent-detail";
import { handlePrewarmWorkerRequest } from "./prewarm-worker";
import { handleLlmModelsRequest } from "./llm-models";
import { handleCodexAuthStatusRequest } from "./codex-auth-status";
import { handleRuntimeBootstrapRequest } from "./runtime-bootstrap";
import { handleNotificationsRequest } from "./notifications";
import { handlePlansRequest } from "./plans";
import { handleProjectMemoryRequest } from "./project-memory";
import { handleAttachmentsRequest } from "./attachments";
import { handlePlanningPromoteRequest, handlePlanningReviewRequest } from "./planning";
import { handleBrowseFilesystemRequest, handleProjectFilesRequest } from "./filesystem";
import { handleGitRequest } from "./git";
import { handleMessagesRequest } from "./messages";
import { handleConversationsRequest } from "./conversations";
import {
  handleConversationMessagesRequest,
  handleQueuedConversationMessageRequest,
  handleQueuedConversationMessageInterruptRequest,
  handleQueuedConversationMessageInterruptNextRequest,
} from "./conversation-messages";
import { handleWorkerEntriesRequest } from "./worker-entries";
import { handleConversationTranscriptRequest } from "./conversation-transcript";
import { handleEventsLogRequest } from "./events-log";
import { handleEventsRequest } from "./events";
import { handleSupervisorRequest } from "./supervisor";
import { handleRunAnswerRequest } from "./run-answer";
import { handleRunResumeRequest } from "./run-resume";
import { handleRunDeleteRequest, handleRunPatchRequest, handleRunPostRequest } from "./runs";
import { handleExternalSessionsRequest } from "./external-sessions";
import {
  handleTerminalCreateRequest,
  handleTerminalDeleteRequest,
  handleTerminalInputRequest,
  handleTerminalResizeRequest,
  handleTerminalStreamRequest,
} from "./terminals";

export function createOmniRuntimeHttpRegistry() {
  return createOmniHttpRegistry()
    .route("GET", "/api/runtime/bootstrap", handleRuntimeBootstrapRequest)
    .route("GET", "/api/auth/session", handleAuthSessionRequest)
    .route("DELETE", "/api/auth/session", handleAuthSessionRequest)
    .route("POST", "/api/auth/login", handleAuthLoginRequest)
    .route("POST", "/api/auth/logout", handleAuthLogoutRequest)
    .route("GET", "/api/auth/pair", handleAuthPairRequest)
    .route("POST", "/api/auth/pair", handleAuthPairRequest)
    .route("POST", "/api/auth/pair/redeem", handleAuthPairRedeemRequest)
    .route("GET", "/api/settings", handleSettingsRequest)
    .route("POST", "/api/settings", handleSettingsRequest)
---- total route entries ----
       0

uuid: 4de0bbaf-7eb0-4653-a0ab-eba163b61a36
parent: d8fde4ef-aca1-4e2d-83be-9f85fbc1b48d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:38:11.445Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:38:11.445Z

```json
{
  "command": "grep -c '\\.route(' src/runtime/http/routes/index.ts; echo \"=== next/dynamic,image,font usages ===\"; grep -rn 'next/dynamic' src | wc -l; grep -rn 'next/image' src | wc -l; grep -rn 'next/font' src | wc -l; echo \"=== deep links today ===\"; grep -rn 'session/' src/app/page.tsx src/app/home/bootstrap.server.ts 2>/dev/null | head; echo \"=== 3035 live refs ===\"; grep -rln '3035' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . 2>/dev/null | grep -v 'docs/codex-history' | grep -v 'docs/superpowers' | head -40"
}

uuid: 8f4d957d-ad93-4552-81e8-87ba8b607bb3
parent: 4de0bbaf-7eb0-4653-a0ab-eba163b61a36
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:38:11.851Z","phase":null} -->
## Claude tool result: toolu_01T7qkquHQvbRAL8MDwJ8v6Z · 2026-07-30T22:38:11.851Z

```text
63
=== next/dynamic,image,font usages ===
       4
       5
       1
=== deep links today ===
=== 3035 live refs ===
playwright.live.config.ts
AGENTS.md
tests/runtime-api/web-runtime-api.test.ts
tests/server/restart-control.test.ts
tests/e2e/live/playwright-live-config.test.ts
tests/e2e/live/auth.ts
tests/e2e/live/auth.test.ts
tests/electron/runtime-shell.test.ts
tests/e2e/live/safety.test.ts
tests/vscode/bridge.test.ts
docs/architecture/conversation-ui-regression-lessons.md
docs/architecture/hot-path-responsiveness-and-resource-leaks.md
docs/architecture/common-runtime-multi-surface.md
docs/architecture/frontend-state-and-rendering.md
scripts/remote-restart.ts
scripts/cleanup-live-agent-journey.ts
scripts/dev-compression-proxy.ts
scripts/dev.ts
scripts/measure-local-dev.mjs
scripts/free-port.sh
apps/vscode/webview/main.tsx
apps/vscode/src/extension.ts
apps/vscode/README.md
src/server/restart-control.ts
apps/electron/README.md
apps/vscode/package.json
src/components/cli-brand-icons.tsx

uuid: d3e32e8d-18d1-4d56-9758-6f56acc01788
parent: 8f4d957d-ad93-4552-81e8-87ba8b607bb3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:38:21.835Z","phase":null} -->
## Claude thinking · 2026-07-30T22:38:21.835Z



uuid: 88af8be2-b049-441d-b329-6ee6c4b34d77
parent: d3e32e8d-18d1-4d56-9758-6f56acc01788

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:38:23.489Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:38:23.489Z

```json
{
  "command": "grep -rn '3035' src/server/restart-control.ts src/components/cli-brand-icons.tsx apps/vscode/src/extension.ts apps/vscode/webview/main.tsx apps/vscode/package.json 2>/dev/null | head -20; echo \"=== arch docs ===\"; grep -rn '3035' docs/architecture/conversation-ui-regression-lessons.md docs/architecture/hot-path-responsiveness-and-resource-leaks.md docs/architecture/frontend-state-and-rendering.md | head -10; echo \"=== dated arch docs? ===\"; ls docs/architecture | head -50"
}

uuid: feb300c2-004c-4cb8-a6c7-25f6ce3566a2
parent: 88af8be2-b049-441d-b329-6ee6c4b34d77
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:38:23.553Z","phase":null} -->
## Claude tool result: toolu_018Gyvtmt6zvd9GxfpX24dP8 · 2026-07-30T22:38:23.553Z

```text
src/server/restart-control.ts:63:  const ports = (value || "3035,3050,7800")
src/components/cli-brand-icons.tsx:12:const CLAUDE_ICON_PATH = "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";
apps/vscode/src/extension.ts:12:  const serverUrl = (config.get<string>("serverUrl") || "http://localhost:3035").trim() || "http://localhost:3035";
apps/vscode/webview/main.tsx:42:  serverUrl: "http://localhost:3035",
apps/vscode/package.json:62:          "default": "http://localhost:3035",
apps/vscode/package.json:63:          "description": "OmniHarness server URL. Use http://localhost:3035 for the normal local app, or http://localhost:3050 for the raw Next dev server."
=== arch docs ===
docs/architecture/conversation-ui-regression-lessons.md:262:The local app's normal URL is `http://localhost:3035`. Use an already-running server when available.
docs/architecture/hot-path-responsiveness-and-resource-leaks.md:377:curl --max-time 10 -sS -o /tmp/omni-root.out -w 'root status=%{http_code} time=%{time_total}\n' http://127.0.0.1:3035/
docs/architecture/hot-path-responsiveness-and-resource-leaks.md:378:curl --max-time 10 -sS -o /tmp/omni-auth.out -w 'auth status=%{http_code} time=%{time_total}\n' http://127.0.0.1:3035/api/auth/session
docs/architecture/hot-path-responsiveness-and-resource-leaks.md:379:curl --max-time 10 -sS -o /tmp/omni-worker.out -w 'worker status=%{http_code} time=%{time_total}\n' 'http://127.0.0.1:3035/api/workers/<workerId>/entries?afterSeq=0'
docs/architecture/frontend-state-and-rendering.md:127:# Make sure :3035 is free or a dev server is already running on it
docs/architecture/frontend-state-and-rendering.md:128:lsof -nP -iTCP:3035 -sTCP:LISTEN
=== dated arch docs? ===
common-runtime-multi-surface.md
conversation-ui-regression-lessons.md
direct-control-session-regressions.md
frontend-state-and-rendering.md
hot-path-responsiveness-and-resource-leaks.md
lifecycle-observability-and-testing.md
plan-readiness.md
routing-decision.md
session-provider-model.md
state-staleness-and-session-lifecycle-lessons.md
supervisor-worker-switching-incident.md
timing-determinism-audit.md
worker-conversation-stream.md
worker-runtime-recovery-lessons.md

uuid: 3942c6b5-23da-487c-af1b-b421548ea4bb
parent: feb300c2-004c-4cb8-a6c7-25f6ce3566a2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:38:57.503Z","phase":null} -->
## Claude thinking · 2026-07-30T22:38:57.503Z



uuid: 0a9373df-af16-43a7-835c-b2fb3ed816c9
parent: 3942c6b5-23da-487c-af1b-b421548ea4bb

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:38:59.463Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:38:59.463Z

```json
{
  "command": "echo \"=== session deep link today ===\"; ls src/app; find src/app -name \"*.tsx\" -path \"*session*\" | head; grep -rn \"pathname\" src/app/page.tsx src/ui/render-web.tsx 2>/dev/null | head; echo \"=== electron renderer entry ===\"; grep -n \"entryPoints\\|outfile\\|loadFile\\|loadURL\" apps/electron/scripts/build.mjs apps/electron/main.ts | head -20; echo \"=== globals.css importers ===\"; grep -rn \"globals.css\\|fx.css\" src apps --include=*.ts --include=*.tsx 2>/dev/null | head"
}

uuid: b202bd02-625c-472e-b50d-e75366a81645
parent: 0a9373df-af16-43a7-835c-b2fb3ed816c9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:38:59.887Z","phase":null} -->
## Claude tool result: toolu_01Pyg12DvWBa9hTir1fnxQ1S · 2026-07-30T22:38:59.887Z

```text
=== session deep link today ===
api
favicon.ico
fx
fx-spike
fx.css
globals.css
home
layout.tsx
page.tsx
providers.tsx
=== electron renderer entry ===
apps/electron/scripts/build.mjs:48:  entryPoints: [path.join(appRoot, "main.ts")],
apps/electron/scripts/build.mjs:49:  outfile: path.join(appRoot, "dist", "main.js"),
apps/electron/scripts/build.mjs:61:  entryPoints: [path.join(appRoot, "preload.ts")],
apps/electron/scripts/build.mjs:62:  outfile: path.join(appRoot, "dist", "preload.js"),
apps/electron/scripts/build.mjs:76:  entryPoints: [path.join(repoRoot, "src", "ui", "render-web.tsx")],
apps/electron/scripts/build.mjs:77:  outfile: path.join(rendererOutdir, "renderer.js"),
apps/electron/main.ts:33:  await mainWindow.loadURL(rendererUrl);
=== globals.css importers ===
(eval):1: no matches found: --include=*.ts

uuid: 0e6cac30-2bd6-4baf-908e-9dd95df647b8
parent: b202bd02-625c-472e-b50d-e75366a81645
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:38:59.966Z","phase":null} -->
## Claude attachment · 2026-07-30T22:38:59.966Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: 6329b466-a44a-4891-81d5-d5281408d1cd
parent: 0e6cac30-2bd6-4baf-908e-9dd95df647b8
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:39:02.342Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:39:02.342Z

```json
{
  "command": "grep -rn \"globals.css\\|fx.css\" src apps 2>/dev/null | grep -v node_modules | head; echo \"=== render-web css ===\"; head -20 src/ui/render-web.tsx; echo \"=== electron renderer html ===\"; grep -n \"css\\|html\" apps/electron/scripts/build.mjs | head -20"
}

uuid: 54cb27bb-75e1-460d-bed9-a202c9175712
parent: 6329b466-a44a-4891-81d5-d5281408d1cd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:39:02.460Z","phase":null} -->
## Claude tool result: toolu_01UP5kugu2iEdQrZpX8BGDFw · 2026-07-30T22:39:02.460Z

```text
src/app/layout.tsx:3:import "./globals.css";
src/app/layout.tsx:4:import "./fx.css";
src/app/fx.css:1:/* src/app/fx.css — Layer 1: Motion primitives */
src/app/fx/Fx.tsx:3:// fx.css is a GLOBAL stylesheet — class names are plain strings, not module imports.
=== render-web css ===
"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import { t } from "@/lib/i18n";
import { OmniApp } from "@/ui/OmniApp";
import { createElectronRuntimeAPIs } from "@/runtime-api/electron";
import { createWebRuntimeAPIs } from "@/runtime-api/web";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";

function createRuntimeApis() {
  if (typeof window !== "undefined" && window.omniElectron) {
    return createElectronRuntimeAPIs();
  }
  return createWebRuntimeAPIs();
}

async function mount() {
  const root = document.getElementById("root");
  if (!root) {
=== electron renderer html ===
88:await writeFile(path.join(rendererOutdir, "index.html"), `<!doctype html>
89:<html lang="en">
100:</html>

uuid: 2cb5d296-6ae3-4035-8bfa-02c2561e6030
parent: 54cb27bb-75e1-460d-bed9-a202c9175712
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:39:08.948Z","phase":null} -->
## Claude thinking · 2026-07-30T22:39:08.948Z



uuid: f88c7800-f826-4f66-a949-5723cfa30090
parent: 2cb5d296-6ae3-4035-8bfa-02c2561e6030

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:39:09.457Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:39:09.457Z

```json
{
  "command": "ls src/shared 2>/dev/null || echo \"NO src/shared\"; echo \"---\"; sed -n '80,105p' apps/electron/scripts/build.mjs"
}

uuid: 08e5cdbe-de71-4d2e-948b-a7d1c15dd8c0
parent: f88c7800-f826-4f66-a949-5723cfa30090
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:39:09.610Z","phase":null} -->
## Claude tool result: toolu_01VvdDqzbjhr66Y6p2EFTtM4 · 2026-07-30T22:39:09.610Z

```text
bootstrap.ts
home-types.ts
planning-review.ts
worker-entries.ts
worker-types.ts
---
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  plugins: [aliasPlugin],
  sourcemap: true,
  logLevel: "info",
});

await writeFile(path.join(rendererOutdir, "index.html"), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;">
    <title>OmniHarness</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="/renderer.js"></script>
  </body>
</html>
`, "utf8");

uuid: c3001fef-871f-4185-95ce-272d98063ba8
parent: 08e5cdbe-de71-4d2e-948b-a7d1c15dd8c0
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:39:18.018Z","phase":null} -->
## Claude thinking · 2026-07-30T22:39:18.018Z



uuid: 1772a70f-c638-4dcf-9096-63951dffc8ea
parent: c3001fef-871f-4185-95ce-272d98063ba8

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:39:18.618Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:39:18.618Z

```json
{
  "command": "git status --short src/shared src/interface apps 2>/dev/null; echo \"--- tracked? ---\"; git ls-files src/shared; echo \"--- log ---\"; git log --oneline -3 -- src/shared"
}

uuid: 5b2f7c92-18e9-48f5-b38e-a30a3c3ac85c
parent: 1772a70f-c638-4dcf-9096-63951dffc8ea
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:39:19.599Z","phase":null} -->
## Claude tool result: toolu_012n6N1tqZQowNda8C8AQ8gM · 2026-07-30T22:39:19.599Z

```text
?? src/shared/
--- tracked? ---
--- log ---

uuid: 379f9dcb-be72-439e-8b02-f9227be181a8
parent: 5b2f7c92-18e9-48f5-b38e-a30a3c3ac85c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:39:30.120Z","phase":null} -->
## Claude thinking · 2026-07-30T22:39:30.120Z



uuid: 10f4f458-77bc-4e18-bf71-ba8b1a075bdf
parent: 379f9dcb-be72-439e-8b02-f9227be181a8

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:39:31.582Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:39:31.582Z

```json
{
  "command": "echo \"=== @/shared importers ===\"; grep -rn \"@/shared/\" src apps tests 2>/dev/null | grep -v node_modules | wc -l; grep -rl \"@/shared/\" src apps tests 2>/dev/null | head -30; echo; echo \"=== server shims ===\"; head -5 src/server/workers/entries-types.ts src/server/supervisor/worker-types.ts src/server/planning/review-preferences.ts; echo \"=== runtime/bootstrap ===\"; head -12 src/runtime/bootstrap.ts"
}

uuid: df172605-0872-4cf2-b26a-2a978629f126
parent: 10f4f458-77bc-4e18-bf71-ba8b1a075bdf
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:39:31.854Z","phase":null} -->
## Claude tool result: toolu_013K3annrMMpmF3ppwXtYfpC · 2026-07-30T22:39:31.854Z

```text
=== @/shared importers ===
      29
src/ui/OmniApp.tsx
src/app/home/PlanningReviewPreferencesManager.ts
src/app/home/types.ts
src/app/home/HomeApp.tsx
src/app/home/direct-worker-stream-loading.ts
src/ui/render-web.tsx
src/app/home/worker-elicitations.ts
src/runtime/bootstrap.ts
src/app/home/ConversationTranscriptManager.ts
src/app/home/WorkerEntriesManager.ts
src/app/home/useHomeMutations.ts
src/app/home/bootstrap.server.ts
src/server/auth/session-state.ts
src/server/settings/read.ts
src/server/planning/review-preferences.ts
src/server/workers/entries-types.ts
src/server/events/persisted-snapshot.ts
src/shared/home-types.ts
src/shared/bootstrap.ts
src/components/WorkerCard.tsx
src/components/Terminal.tsx
src/lib/agent-output.ts
src/components/home/ConversationMain.tsx
src/server/supervisor/worker-types.ts
src/components/PlanningArtifactsPanel.tsx
src/components/PlanningReviewControls.tsx

=== server shims ===
==> src/server/workers/entries-types.ts <==
export * from "@/shared/worker-entries";

==> src/server/supervisor/worker-types.ts <==
export * from "@/shared/worker-types";

==> src/server/planning/review-preferences.ts <==
export * from "@/shared/planning-review";
=== runtime/bootstrap ===
import { buildAuthSessionState } from "@/server/auth/session-state";
import { buildPersistedEventPayload } from "@/server/events/persisted-snapshot";
import { getEventCursor } from "@/server/events/named-events";
import { readSettingsState } from "@/server/settings/read";
import type { HomeBootstrapPayload } from "@/shared/bootstrap";

export type { HomeBootstrapPayload } from "@/shared/bootstrap";

type PageSearchParams = Record<string, string | string[] | undefined>;

export type RuntimeBootstrapOptions = {
  searchParams?: PageSearchParams;

uuid: 98288124-68f7-49fb-9b78-04bb3856c746
parent: df172605-0872-4cf2-b26a-2a978629f126
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:39:37.961Z","phase":null} -->
## Claude thinking · 2026-07-30T22:39:37.961Z



uuid: 9a6a868a-8e6e-42d8-91a0-5dd649f7db81
parent: 98288124-68f7-49fb-9b78-04bb3856c746

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:39:39.770Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:39:39.770Z

```json
{
  "command": "ls tsconfig*.json; echo \"=== eslint restricted imports ===\"; grep -n \"no-restricted-imports\\|@/server\\|@/runtime\" eslint.config.mjs | head -20; echo; echo \"=== interface files importing server/runtime ===\"; grep -rn \"from \\\"@/server/\\|from \\\"@/runtime/\" src/app/home src/components src/ui src/lib src/runtime-api 2>/dev/null | grep -v \"bootstrap.server\" | head -20; echo \"=== arch tests ===\"; ls tests/architecture 2>/dev/null || echo \"NO tests/architecture\""
}

uuid: 35e7da29-8d06-4f9a-8449-7c9db9c6b767
parent: 9a6a868a-8e6e-42d8-91a0-5dd649f7db81
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:39:39.927Z","phase":null} -->
## Claude tool result: toolu_01PUCejpmenm1VqMGBnXEKsu · 2026-07-30T22:39:39.927Z

```text
tsconfig.interface.json
tsconfig.json
tsconfig.lifecycle-subprocess.json
tsconfig.runner.json
tsconfig.shared.json
=== eslint restricted imports ===
41:      "no-restricted-imports": [
47:                "@/server",
48:                "@/server/**",
49:                "@/runtime",
50:                "@/runtime/**",

=== interface files importing server/runtime ===
=== arch tests ===
interface-boundary.test.ts
typecheck-projects.test.ts

uuid: 9ebaa7bf-d1eb-4829-acc3-ade3a56bfdbe
parent: 35e7da29-8d06-4f9a-8449-7c9db9c6b767
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:39:46.434Z","phase":null} -->
## Claude thinking · 2026-07-30T22:39:46.434Z



uuid: e3a7d049-e3be-4b7b-bbb9-eeaf6b1840f9
parent: 9ebaa7bf-d1eb-4829-acc3-ade3a56bfdbe

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:39:48.069Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:39:48.069Z

```json
{
  "command": "sed -n '35,70p' eslint.config.mjs; echo \"=== measure-local-dev RSS ===\"; grep -n \"rss\\|RSS\\|peak\" scripts/measure-local-dev.mjs | head; echo \"=== baseline report ===\"; ls docs/architecture/*baseline* docs/*baseline* 2>/dev/null; git status --short docs/ 2>/dev/null | grep -iv codex-history | head"
}

uuid: 4afe9d46-4d04-447a-be6d-c010225095d6
parent: e3a7d049-e3be-4b7b-bbb9-eeaf6b1840f9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:39:48.306Z","phase":null} -->
## Claude tool result: toolu_01TBzG1BheafYgWwTRGM42Vm · 2026-07-30T22:39:48.306Z

```text
    ],
    ignores: [
      "src/app/home/**/*.server.ts",
      "src/app/home/**/*.server.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/**",
                "@/runtime",
                "@/runtime/**",
                "**/*.server",
              ],
              message: "Interface code must depend on shared contracts or RuntimeAPIs, not runner modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
=== measure-local-dev RSS ===
=== baseline report ===
(eval):1: no matches found: docs/architecture/*baseline*
?? docs/superpowers/learnings/2026-07-27-model-selection-must-never-cross-families.md
?? docs/superpowers/learnings/2026-07-31-claude-desktop-session-identity.md
?? docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md
?? docs/superpowers/specs/2026-07-29-interface-runner-split-design.md

uuid: b36f8896-9d2e-4e41-84b4-aef48f35b677
parent: 4afe9d46-4d04-447a-be6d-c010225095d6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:40:24.413Z","phase":null} -->
## Claude thinking · 2026-07-30T22:40:24.413Z



uuid: b451dd90-8fd6-4057-9c08-87dc24e4eed8
parent: b36f8896-9d2e-4e41-84b4-aef48f35b677

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:40:48.898Z","phase":null} -->
## Claude · 2026-07-30T22:40:48.898Z

HARDEN

## Remaining blockers

**H1 — Plan baseline is two tasks behind the working tree (highest risk).** Tasks 1 and 2 are already implemented as uncommitted work: `src/shared/{bootstrap,home-types,planning-review,worker-entries,worker-types}.ts` exist and are **entirely untracked** (`git status` → `?? src/shared/`); `src/server/{workers/entries-types,supervisor/worker-types,planning/review-preferences}.ts` are already one-line `export * from "@/shared/*"` shims; `src/runtime/bootstrap.ts:5` already imports `HomeBootstrapPayload` from `@/shared/bootstrap`; `tsconfig.{shared,runner,interface}.json`, the `no-restricted-imports` rule at `eslint.config.mjs:41` (already `"error"`, with the `*.server` ignore), and `tests/architecture/{interface-boundary,typecheck-projects}.test.ts` all exist; zero interface files import `@/server/*` or `@/runtime/*`. Task 2's "add failing tests / move pure definitions" is therefore a no-op that an executing agent may satisfy by rewriting files it did not create. Task 1's preservation clause (line 155) enumerates Terminal.tsx, model selection, agent runtime, named events, external-session discovery — it does **not** name `src/shared/**`, and `src/shared/home-types.ts` appears nowhere in the plan's Create list. Fix: restate Tasks 1–2 as verify-and-preserve, add `src/shared/**` + the shim files to the preservation clause, and reconcile `home-types.ts` into the file map. This also voids B2's Task1/2 handshake (lines 161, 171) as written — the boundary test is already green.

**H2 — The one Task 1 step still outstanding gates Task 11.** `scripts/measure-local-dev.mjs` has no RSS/peak sampling and no pre-split baseline report is checked in. Task 11 line 271 enforces "the **calibrated** `<2 GB` / `<1 GB` thresholds; a miss blocks cutover." With the rest of Task 1 already done, a resuming agent will mark Task 1 complete and lose the calibration input. Fix: hoist Task 1 step 2 out as an explicit standalone prerequisite of Task 11.

**H3 — B4's 3035 audit is not executable as literally specified.** Three defects in line 269: (a) `src/components/cli-brand-icons.tsx:12` contains the literal `3035` inside an SVG path `d` attribute — a false positive the plan gives no rule to exclude, so the "no live reference remains" test cannot be written against a plain grep; (b) the exclusion "dated retrospective documents under `docs/architecture/**`" matches **nothing** — no architecture filename carries a date — so `conversation-ui-regression-lessons.md`, `hot-path-responsiveness-and-resource-leaks.md`, and `frontend-state-and-rendering.md` fall in scope beyond the named `common-runtime-multi-surface.md`, unacknowledged; (c) `src/server/restart-control.ts:63` hardcodes the port allowlist `"3035,3050,7800"` and is in **no** task's Modify list, though `tests/server/restart-control.test.ts` is listed in Task 11. Fix: pin the audit to a port-context regex, enumerate the four architecture docs explicitly, and add `src/server/restart-control.ts` to Task 11's file map.

**H4 — Stylesheet ownership straddles the cutover gate.** `globals.css`/`fx.css` are imported by exactly one file, `src/app/layout.tsx:3-4`, which Task 11 deletes (line 133). The Vite entry does not import them until Task 11A step 2 (line 282), and visual CSS smoke tests land in 11A step 4 — both **after** Task 11's pre-deletion gate (line 272: packaged-interface e2e, PWA, production build). Task 8 never assigns stylesheet wiring to the Vite entry. Fix: either give Task 8 a transitional style import, or move 11A ahead of Task 11's gate.

B1, B3, B5, B6, B7 are confirmed owned and consistent. B1: only surviving consumers of `bootstrap.server.ts` are `src/app/page.tsx` (deleted in the same task) and `tests/ui/ssr-bootstrap.test.ts` (retargeted at line 274). B3: counts verified exactly — 4 `next/dynamic`, 5 `next/image`, 1 `next/font`. B5: line 247 owns path→bootstrap parsing, line 380 owns active-runner-only resolution with an explicit not-found state and a deep-link-while-другой-runner-active test. B6: lines 353–357 cover `OMNI_TOKEN`/`--token-file`/stdin, no token in `argv`, legacy `--token` warning + redaction test, `omni auth init`, `--password-file` 0600 refusal, rotation revoking by default, and `omni runner rekey`; paired client-side at line 367. B7: line 320 (cookie↔bearer non-interchangeability), line 321 (no `Access-Control-Allow-Credentials`, cookie-route preflight exclusion), line 366 (non-deletable same-origin profile surviving migration, corrupt-store reset with localized notice). Task 11B ordering is fine as checked — Electron's renderer is esbuild-built from `src/ui/render-web.tsx` with inline HTML and no Next dependency, so it survives the deletions.

## Deliberate non-goals

- Merged cross-runner dashboards, native push after mobile suspension, runner-to-runner handoff, and package extraction (line 15) — context only.
- No v1 push guarantee on mobile; suspension is handled by cursor persistence and honest resync on resume (line 435).
- Trusted Types may ship enforcement-off: report-only with a documented narrow exception and the report-only test retained as a release gate (line 250).
- Deep links resolve against the active runner only; no probing of other connections (line 380).
- No branch, no worktree, no stash — work stays in the current checkout with all pre-existing user changes preserved (line 28).
- Deletions are restricted to the enumerated M2 list (line 137); anything beyond it needs fresh confirmation (line 273).

Typo above: "другой" should read "another" — no change to the finding.

uuid: 91d49f3f-341b-498d-b225-b3b9b9dbd033
parent: b451dd90-8fd6-4057-9c08-87dc24e4eed8

<!-- /codex-event -->

---
provider: "claude"
codex_thread_id: "bc69c08b-3486-402f-abcd-8b5c45ca7530"
title: "Review interface runner platform apps readiness"
started_at: "2026-07-30T22:47:42.356Z"
updated_at: "2026-07-30T22:49:34.117Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review interface runner platform apps readiness

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:47:42.356Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T22:47:42.356Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-30T22:47:42.356Z",
  "sessionId": "bc69c08b-3486-402f-abcd-8b5c45ca7530",
  "content": "One final concise readiness check of docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md against the approved spec and AGENTS.md. The previous H1-H4 were just fixed: completed boundary work is marked/preserved including src/shared/home-types, pre-split memory baseline is Task 2A and a Task 11 prerequisite, the 3035 audit is port-context-based with explicit retrospective exclusions and restart-control ownership, and Vite imports current styles before deletion. Return READY if no implementation-blocking issue remains; otherwise HARDEN with only precise blockers. Do not edit files."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:47:42.356Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T22:47:42.356Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-30T22:47:42.356Z",
  "sessionId": "bc69c08b-3486-402f-abcd-8b5c45ca7530"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:47:42.430Z","phase":null} -->
## Claude attachment · 2026-07-30T22:47:42.430Z

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

uuid: 20fd64a3-ba39-4172-92c5-6c2b67ac5089
parent: b9e12595-df93-4908-9545-45ce374b3fa6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:47:42.430Z","phase":null} -->
## Claude attachment · 2026-07-30T22:47:42.430Z

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

uuid: 624de1dc-8c3d-4e50-b470-4c11cb77484d
parent: 20fd64a3-ba39-4172-92c5-6c2b67ac5089
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:47:42.430Z","phase":null} -->
## Claude attachment · 2026-07-30T22:47:42.430Z

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

uuid: feae910f-a7c4-4128-a8ef-5f9e84c660f5
parent: 624de1dc-8c3d-4e50-b470-4c11cb77484d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-30T22:47:42.432Z","phase":null} -->
## User · 2026-07-30T22:47:42.432Z

One final concise readiness check of docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md against the approved spec and AGENTS.md. The previous H1-H4 were just fixed: completed boundary work is marked/preserved including src/shared/home-types, pre-split memory baseline is Task 2A and a Task 11 prerequisite, the 3035 audit is port-context-based with explicit retrospective exclusions and restart-control ownership, and Vite imports current styles before deletion. Return READY if no implementation-blocking issue remains; otherwise HARDEN with only precise blockers. Do not edit files.

uuid: b9e12595-df93-4908-9545-45ce374b3fa6

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:47:44.407Z","phase":null} -->
## Claude · 2026-07-30T22:47:44.407Z

I'll read the plan and the referenced standards to do the readiness check.

uuid: 7be91c4d-a3bd-4666-b13c-0209d072e5f7
parent: feae910f-a7c4-4128-a8ef-5f9e84c660f5

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:47:45.895Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:47:45.895Z

```json
{
  "command": "ls docs/superpowers/plans/ && wc -l docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md agents.md 2>/dev/null",
  "description": "List plans and count lines"
}

uuid: 857c675c-7d3e-4513-938d-9109e2bfe4a2
parent: 7be91c4d-a3bd-4666-b13c-0209d072e5f7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:47:47.294Z","phase":null} -->
## Claude tool result: toolu_01FfPdW5HBrHszT7vt5EGtRq · 2026-07-30T22:47:47.294Z

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
     469 docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md
      42 agents.md
     511 total

uuid: b4474621-2e51-4f10-92f2-bf3903f15b80
parent: 857c675c-7d3e-4513-938d-9109e2bfe4a2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:47:49.131Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:47:49.131Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md"
}

uuid: 09145ffa-3b1e-4242-aa4d-8bc90adb7da3
parent: b4474621-2e51-4f10-92f2-bf3903f15b80
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:47:49.402Z","phase":null} -->
## Claude tool result: toolu_01VScm4aiRCdRYFttk7YT5sz · 2026-07-30T22:47:49.402Z

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
61	- `src/shared/home-types.ts` — portable on-wire home/event/settings/session records with an interface re-export shim.
62	- `src/shared/api-revision.ts` — revision window, capability ids, and declared contract-change classifications.
63	- `src/shared/worker-entries.ts` — client/server worker-entry types.
64	- `src/shared/planning-review.ts` — planning review schemas/types safe for the interface.
65	- `src/shared/worker-types.ts` — supported worker types and display labels used by both sides.
66	- `tsconfig.shared.json`, `tsconfig.runner.json`, `tsconfig.interface.json` — independent typecheck projects.
67	- `src/server/runner/config.ts` — isolated runner/bridge/gateway/static/TLS configuration.
68	- `src/server/runner/ManagedBridgeController.ts` — bridge adopt/start/retry/ownership state machine.
69	- `src/server/runner/RunnerReadinessManager.ts` — bounded in-memory readiness/bridge/static state.
70	- `src/server/runner/shutdown.ts` — ordered server/SSE/PTY/gateway/bridge shutdown.
71	- `scripts/runner.ts` — production/development runner entry.
72	- `src/runtime/http/stream-response.ts` — bounded Web-stream to Node response bridge.
73	- `src/runtime/http/static-files.ts` — safe SPA/static serving, cache policy, manifest validation.
74	- `src/runtime/http/bootstrap-html.ts` — escaped bootstrap injection.
75	- `src/runtime/http/security-headers.ts` — web and packaged CSP/referrer headers.
76	- `apps/interface/index.html`, `apps/interface/app-shell.html`, `apps/interface/vite.config.ts`, `apps/interface/src/main.tsx` — Vite interface target.
77	- `src/interface/providers.tsx`, `src/interface/styles/**` — Vite-owned providers and styles moved from `src/app`.
78	- `apps/interface/vite-csp-manifest.ts` — build-time theme hash/asset manifest output.
79	- `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js` — Vite-owned PWA assets.
80	- `src/runtime-api/stream.ts` — transport-neutral stream/frame contract.
81	- `src/runtime-api/request.ts` — redirect-safe request/error primitives.
82	- `src/runtime-api/domains/*.ts` — typed API domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
83	- `src/server/auth/browser-authorization.ts` — S256 approval-code lifecycle.
84	- `src/server/auth/stream-tickets.ts` — atomic single-use path-bound SSE tickets.
85	- `src/server/auth/trusted-proxy.ts` — socket-derived protocol/client identity.
86	- `src/server/auth/cors.ts` — route-aware bearer CORS with no credentials flag.
87	- `src/runtime/http/routes/auth-browser-authorization.ts` — authorization/code-exchange routes.
88	- `src/runtime/http/routes/auth-stream-ticket.ts` — ticket route.
89	- `src/runtime/http/routes/auth-sessions.ts` — session list/revoke routes.
90	- `src/interface/auth/InterfaceAuthorizationScreen.tsx` — same-runner origin approval screen.
91	- `src/interface/runners/RunnerProfile.ts` — versioned profile and status types.
92	- `src/interface/runners/RunnerCredentialStore.ts` — platform credential-store interface.
93	- `src/interface/runners/RunnerProfileStore.ts` — platform profile/prefs persistence interface.
94	- `src/interface/runners/RunnerConnection.ts` — one runner's transport, managers, caches, state machine, cursor, retries.
95	- `src/interface/runners/RunnerRegistry.ts` — all profiles/connections + active selection.
96	- `src/interface/runners/RunnerRegistryProvider.tsx` — narrow active/all-runner React subscriptions.
97	- `src/interface/runners/RunnerSwitcher.tsx` — shadcn `sidebar-07`-derived switcher.
98	- `src/interface/runners/ConnectRunnerScreen.tsx` — shadcn `login-03`-derived onboarding.
99	- `src/interface/runners/RunnerSessionsPanel.tsx` — compact session/revocation control surface.
100	- `src/interface/home/mutations/*.ts` — split conversation/run/planning/settings/auth mutations.
101	- `src/components/terminal/*.tsx` and `src/components/terminal/*.ts` — split terminal rendering/stream/control responsibilities.
102	- `apps/electron/src/ProfileStore.ts`, `CredentialStore.ts`, `RuntimeBridge.ts`, `TlsPinStore.ts`, `migration.ts` — remote-only desktop host.
103	- `src/runtime-api/capacitor.ts` — Capacitor bridge-backed interface adapter.
104	- `apps/mobile/capacitor.config.ts`, `apps/mobile/package.json` — shared mobile shell config.
105	- `apps/mobile/src/native-contract.ts` — validated JavaScript/native request contract.
106	- `apps/mobile/ios/App/App/OmniNativePlugin.swift` — URLSession/SSE, Keychain, TLS pinning, links/notifications.
107	- `apps/mobile/android/app/src/main/java/.../OmniNativePlugin.kt` — OkHttp/SSE, Android Keystore, TLS pinning, links/notifications.
108	- `tests/runtime/route-contract-fixture.ts` and versioned fixture data — portable route contract after Next deletion.
109	- New tests under `tests/runtime`, `tests/server/runner`, `tests/server/auth`, `tests/runtime-api`, `tests/interface/runners`, `tests/electron`, `tests/vscode`, `tests/mobile`, `tests/lifecycle/scenarios`, and `tests/e2e`.
110	
111	### Modify
112	
113	- `.gitignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `components.json`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`.
114	- `src/server/events/named-events.ts`, `src/server/events/live-updates.ts`, `src/runtime/http/routes/events.ts`, `src/runtime/http/server.ts`.
115	- `scripts/dev.ts`, `scripts/start.ts`, `scripts/measure-local-dev.mjs`, `scripts/free-port.sh`, `controller.sh`, `omni.sh`, `start.sh`.
116	- `src/server/db/schema.ts`, `src/server/db/index.ts`.
117	- `src/server/auth/config.ts`, `password.ts`, `session.ts`, `guards.ts`, `rate-limit.ts`, `audit.ts`.
118	- `src/server/api-errors.ts`, `src/runtime/http/routes/index.ts`, `auth-login.ts`, `runtime-bootstrap.ts`, `terminals.ts`, `settings.ts`.
119	- `src/runtime-api/types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`.
120	- `src/ui/render-web.tsx`, `src/ui/OmniApp.tsx`, then `src/interface/providers.tsx`.
121	- All direct browser API/SSE owners listed in `docs/architecture/common-runtime-multi-surface.md`.
122	- `src/interface/home/HomeApp.tsx`, `useHomeMutations.ts`, `useHomeQueries.ts`, `LiveEventConnectionManager.ts`, `WorkerEntriesManager.ts`, `EventStreamStateManager.ts`, `EventStreamSnapshotCacheManager.ts`, `ConversationNotificationManager.ts`, `GitWorkspaceManager.ts`, `ProjectMemoryPanelManager.ts` after the import-only move in Task 11A.
123	- `src/components/InteractiveTerminal.tsx`, `Terminal.tsx`, file/folder/attachment components, planning controls, and `ConversationMain.tsx`.
124	- All nine `shared/locales/*.json`.
125	- `apps/electron/main.ts`, `preload.ts`, `scripts/build.mjs`, `package.json`, `README.md`.
126	- `apps/vscode/src/extension.ts`, `webview/main.tsx`, `package.json`, `README.md`, `src/vscode-extension/bridge.ts`.
127	- `src/server/cli/options.ts`, `src/server/cli/runner.ts`, `scripts/auth-password.mjs`.
128	- `README.md`, `.env.example`, `AGENTS.md`, `docs/architecture/common-runtime-multi-surface.md`, lifecycle docs, deployment/TLS docs.
129	
130	### Remove at the M2 cutover
131	
132	These removals are explicitly part of the approved Next-removal design and happen only after route parity, Vite packaged e2e, and PWA tests pass:
133	
134	- `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/instrumentation.ts`.
135	- `src/app/home/bootstrap.server.ts` after its interface type consumer moves to `src/shared/bootstrap`.
136	- `next.config.ts`, `next-env.d.ts`, Next-only dependencies/configuration.
137	- Old Next-owned PWA copies after their Vite-owned replacements pass tests.
138	- No file outside this enumerated list is removed as part of the cutover.
139	
140	### Existing large-file rule
141	
142	- `src/app/home/useHomeMutations.ts` (1,269 lines), `HomeApp.tsx` (1,697), and `src/components/Terminal.tsx` (2,553) are split before adding the new behavior they own.
143	- Do not add runner work to already oversized `src/server/supervisor/index.ts` or `src/server/agent-runtime/manager.ts`; use the new focused runner modules.
144	
145	### `.gitignore` requirements
146	
147	- Add `/dist/`, `/apps/mobile/ios/App/Pods/`, `/apps/mobile/ios/DerivedData/`, `/apps/mobile/android/.gradle/`, `/apps/mobile/android/**/build/`, `/apps/mobile/android/local.properties`, signing files, provisioning profiles, keystores, generated release archives, and native SDK caches.
148	- Keep native project source/configuration versioned. Never stage `.env`, auth keys, SQLite files, tokens, certificates/private keys, build output, logs, or local signing state.
149	
150	## Execution checklist
151	
152	### Task 1 — Baseline and boundary tests
153	
154	**Files:** `tests/architecture/interface-boundary.test.ts`, `tests/architecture/typecheck-projects.test.ts`, `eslint.config.mjs`, `tsconfig*.json`, `.gitignore`.
155	
156	**Current-checkout note (2026-07-31):** The boundary work below is implemented and verified but uncommitted. Preserve `src/shared/**`, the three server re-export shims, the tsconfig files, architecture tests, and ESLint/gitignore edits alongside the user's earlier `Terminal.tsx`, model-selection, agent-runtime, named-events, external-session discovery, and test changes. Do not branch, stash, reset, or rewrite completed moves.
157	
158	- [x] Record `git status --short` and the full diff/untracked-file inventory. Preserve and re-verify all named existing edits after Tasks 3 and 12.
159	- [x] Add architecture tests that enumerate interface entry imports and reject runtime imports from `@/server/*`/`@/runtime/*`, except declared `@/shared/*`.
160	- [x] Add tests that require separate shared/runner/interface typecheck configs and mobile/build ignores; observe the intended red failures.
161	- [x] Create the three tsconfig projects, enforce the ESLint restriction, and add `.gitignore` entries; keep root `typecheck` running all projects.
162	- [x] Verify the architecture tests, all typecheck projects, focused shared tests, and lint with zero errors.
163	
164	### Task 2 — Extract genuinely shared types and values
165	
166	**Files:** new `src/shared/*.ts`; old `src/server/workers/entries-types.ts`, `src/server/planning/review-preferences.ts`, `src/server/supervisor/worker-types.ts`; `src/runtime/bootstrap.ts`; affected interface imports.
167	
168	- [x] Add failing import/runtime tests for worker entry types, planning schema, worker labels, runtime primitives, home wire records, and bootstrap types from `src/shared`.
169	- [x] Move pure definitions to shared modules; leave server-side and interface re-export shims so unrelated imports do not churn.
170	- [x] Move `HomeBootstrapPayload` and runner/capability types out of `src/runtime/bootstrap.ts`.
171	- [x] Update interface imports, including `src/lib/agent-output.ts`, and prove the interface graph contains no server/runtime source.
172	- [x] Repoint `HomeApp.tsx` to `@/shared/bootstrap`, turn the interface-boundary test green, and enforce `no-restricted-imports` as an error.
173	- [x] Run targeted shared/import tests, all three project typechecks, the root typecheck, and lint.
174	
175	### Task 2A — Record the pre-split process-memory baseline
176	
177	**Files:** `scripts/measure-local-dev.mjs`, deterministic fixture-agent harness, checked-in baseline report under `docs/architecture/benchmarks/`, measurement tests.
178	
179	- [ ] Add failing parser/sampler tests for process-tree discovery, peak/final RSS aggregation, deterministic workload timing, and child exit cleanup.
180	- [ ] Extend the measurement script to run a deterministic 10-minute fixture-agent workload with no live model and sample the whole current Next/runner/bridge process tree.
181	- [ ] Record the pre-split baseline while the current Next development topology is still intact. Task 11 cannot calibrate or authorize cutover without this report.
182	- [ ] Verify repeat runs stay within the documented tolerance and clean every fixture session/process/artifact.
183	
184	### Task 3 — Epoch-aware event ids, heartbeat, replay, and resync
185	
186	**Files:** `src/shared/runtime.ts`, `src/server/events/named-events.ts`, `src/runtime/http/routes/events.ts`, `src/app/home/LiveEventConnectionManager.ts`, event/lifecycle tests.
187	
188	- [ ] Add failing tests for `<epoch>:<seq>` parsing/comparison, every event frame carrying an id, a process-global id-bearing heartbeat, restart epoch mismatch, cursor below ring floor, and resync reasons.
189	- [ ] Add failing client tests for cursor persistence behind an injectable scope key and clear-on-resync; durable `runnerInstanceId` scoping and the resync governor land after Tasks 13 and 18.
190	- [ ] Implement the per-process epoch, 4096-entry ring, heartbeat event, header/query cursor parsing (`cursor` wins), and stable resync reasons.
191	- [ ] Update `LiveEventCursorManager` to compare epoch + sequence rather than treating all nonnumeric ids as newer.
192	- [ ] Emit the subscriber-overflow diagnostic and add its typed event/error codes without overwriting existing named-event work.
193	- [ ] Verify event-route, cursor, lifecycle reconnect/restart, and event-log tests.
194	
195	### Task 4 — Bounded Node streaming and shutdown behavior
196	
197	**Files:** `src/runtime/http/stream-response.ts`, `src/runtime/http/server.ts`, `src/runtime/http/routes/events.ts`, terminal stream route, server tests.
198	
199	- [ ] Add failing real-server tests for immediate headers, per-frame flush, compressing-proxy flush, `drain` handling, client disconnect cleanup, and upstream reader cancellation.
200	- [ ] Add a non-reading consumer test that drives output past 256 frames/1 MiB, observes eviction/resync or socket close, and samples flat runner RSS.
201	- [ ] Implement streaming without `arrayBuffer()`, with Nagle disabled for SSE and bounded subscriber queues independent of the global ring.
202	- [ ] Track open streams so shutdown stops accepts, emits id-bearing `runner.stopping`, gives a bounded flush window, then aborts readers.
203	- [ ] Verify standalone server, event SSE, terminal SSE, and lifecycle graceful-stop tests.
204	
205	### Task 5 — Isolated managed runner and degraded bridge lifecycle
206	
207	**Files:** new `src/server/runner/*`, `scripts/runner.ts`, extracted pieces from `scripts/dev.ts`, `src/instrumentation.ts`, runner/lifecycle tests.
208	
209	- [ ] Add failing controller tests for adopt, spawn, missing runtime, unhealthy bridge, lock contention, child crash, retry/backoff, ownership-aware shutdown, and explicit instance roots/ports/lockfiles.
210	- [ ] Add failing runner tests proving bridge failure does not prevent health/API/bootstrap, while bind conflict and invalid auth/static configuration fail fast with typed events/errors.
211	- [ ] Implement `ManagedBridgeController` and `RunnerReadinessManager` as Manager-owned state machines; no silent returns/catches.
212	- [ ] Implement `scripts/runner.ts` boot order and isolated gateway port-0 strategy for tests.
213	- [ ] Implement ordered shutdown for HTTP/SSE, PTYs, gateway, and owned/adopted bridge.
214	- [ ] Emit all bridge/runner/error events specified by the design; static-UI events belong to Task 9.
215	- [ ] Point `scripts/start.ts`, controller scripts, and lifecycle subprocess harness at the runner.
216	- [ ] Verify runner unit tests and `pnpm test:lifecycle`; clean all test roots/processes.
217	
218	### Task 6 — Portable route registry, health, and terminal replay contract
219	
220	**Files:** `src/runtime/http/routes/index.ts`, all route modules, `src/runtime/http/server.ts`, `tests/runtime/route-contract-fixture.ts`, `tests/runtime/fixtures/routes.v1.json`, terminal route/tests.
221	
222	- [ ] Generate a checked-in route-contract fixture from the current 49 Next route handlers and 63 registered standalone routes. Add a table-driven `tests/runtime/next-standalone-route-parity.test.ts` that executes every registry route through both adapters against separate per-adapter data/database roots and compares status, normalized headers (including `Set-Cookie` values/security semantics), and body semantics.
223	- [ ] Add parity cases for multipart upload and every SSE endpoint. Compare a bounded normalized frame sequence, abort both clients, and assert subscriber/readers are cleaned up.
224	- [ ] Add failing tests for minimal cross-origin `/api/healthz`, authenticated bootstrap while the bridge is degraded, API 404 behavior, and exactly one response per request.
225	- [ ] Test whether a terminal attach receives bounded scrollback before live output. If it does not, add a failing contract test and implement a size-bounded server replay window before client work begins.
226	- [ ] Move any remaining route-only logic out of `src/app/api/**` into portable route/service modules, with Next handlers temporarily delegating to them.
227	- [ ] Make route registration metadata drive `OPTIONS`, auth, and the contract fixture rather than maintaining parallel lists.
228	- [ ] Verify route parity, health, terminal replay, and lifecycle tests before changing the interface build.
229	
230	### Task 7 — Transport-neutral Runtime APIs
231	
232	**Files:** `src/runtime-api/request.ts`, `stream.ts`, `domains/*.ts`, `types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`, adapter contract tests.
233	
234	- [ ] Inventory every existing API/SSE call in a checked-in `docs/architecture/runtime-api-migration-inventory.md`, mapping each call site to its target domain method; update `common-runtime-multi-surface.md` from the same inventory. Add failing compile/runtime tests for typed request, abort, redirect refusal, error normalization, stream frames, and all domain methods.
235	- [ ] Define one `RuntimeAPIs` surface with domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
236	- [ ] Implement the web adapter with injectable `fetch`/stream creation and no direct global network access in shared consumers.
237	- [ ] Keep Electron and VSCode adapters behaviorally compatible while their host transports are replaced later.
238	- [ ] Run identical adapter contract tests against web and fake validated host transports.
239	
240	### Task 8 — Vite interface scaffold and selected shadcn blocks
241	
242	**Files:** `apps/interface/**`, `components.json`, `package.json`, `pnpm-lock.yaml`, `src/ui/OmniApp.tsx`, current `src/app/home/HomeApp.tsx` (moved in Task 11A), `src/components/Terminal.tsx`, `src/components/cli-brand-icons.tsx`, `src/components/AttachmentImagePreviewDialog.tsx`, `src/components/home/{HomeHeader,ConversationMain,UserInputMessage,ConversationComposer}.tsx`, interface build/import tests.
243	
244	- [ ] Add failing build tests requiring browser and packaged Vite outputs, correct aliases, no Node/server modules, and a mountable `app-shell.html`.
245	- [ ] Add Vite, React plugin, split build scripts, and interface HTML/entry files. Keep the existing interface rendering through `src/ui/render-web.tsx`.
246	- [ ] Import the current `src/app/globals.css` and `src/app/fx.css` from the Vite entry before any Next deletion so packaged-interface/PWA/visual gates exercise the real styles; Task 11A later moves those files without a behavior change.
247	- [ ] Replace the four `next/dynamic` usages with `React.lazy` + `Suspense`, the five `next/image` usages with appropriate native `<img>` rendering, and `next/font/google` Geist/Geist Mono with self-hosted `@fontsource` packages in the interface HTML/styles.
248	- [ ] Run `pnpm dlx shadcn@latest add sidebar-07` and `pnpm dlx shadcn@latest add login-03`; record the generated files and run build/typecheck before adapting either block.
249	- [ ] Keep the generated primitives, tokens, and dependency additions; remove only demo-page wiring that conflicts with the real app.
250	- [ ] Add a Vite backstop test that fails if an interface chunk contains `src/server`, `src/runtime/http`, `node:*`, or a server-only package.
251	- [ ] Verify both Vite targets, interface typecheck, and the existing component test suite.
252	
253	### Task 9 — Static interface serving, bootstrap, and security headers
254	
255	**Files:** `src/runtime/http/static-files.ts`, `bootstrap-html.ts`, `security-headers.ts`, `vite-csp-manifest.ts`, `src/runtime/http/server.ts`, static/CSP tests.
256	
257	- [ ] Add failing tests for SPA fallback, API/asset 404s, cache headers, traversal/symlink rejection, escaped bootstrap data, malformed/missing CSP manifest, and exactly one `runner.static_ui_enabled` or `runner.static_ui_missing` boot event.
258	- [ ] Preserve deep links: add failing tests for `/session/<uuid>` and `/session/<12-hex>` resolving to the same selected run as `/?run=`, then parse the path into bootstrap and make the interface entry use `location.pathname` when `?run=` is absent. Keep `?project=` and legacy `?pair=` bootstrap behavior intact.
259	- [ ] Add failing CSP tests for no third-party scripts, web versus packaged `connect-src`, `frame-ancestors`, `base-uri`, referrer policy, and an approved theme-script hash.
260	- [ ] Serve the built interface without buffering and validate `csp-manifest.json` at startup.
261	- [ ] Ship Trusted Types in `Content-Security-Policy-Report-Only`; exercise xterm, Markdown, highlighting, and dialogs. Enforce it only if those paths pass with the application policy, otherwise document the narrow exception and keep the report-only test as a release gate.
262	- [ ] Add `--static-dir`, `--no-static`, and clear fail-fast configuration behavior to runner CLI/config.
263	- [ ] Verify static-server, CSP, runner-startup, and packaged-interface tests.
264	
265	### Task 10 — PWA application shell and offline behavior
266	
267	**Files:** `apps/interface/app-shell.html`, `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js`, PWA tests; old `public/` copies at cutover.
268	
269	- [ ] Add failing tests that the manifest starts at the mountable app shell, same-origin app assets are cached, runner API/SSE requests are always network pass-through, and no bearer/session response enters Cache Storage.
270	- [ ] Implement install/update/activate logic with versioned static caches and deterministic cleanup.
271	- [ ] Render the normal shared interface offline with runner profiles and honest stale/offline states instead of a separate dead-end page.
272	- [ ] Verify offline launch, online recovery, update activation, and multi-origin pass-through in Playwright.
273	
274	### Task 11 — Vite cutover and removal of Next
275	
276	**Files:** `package.json`, configs, scripts, `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/home/bootstrap.server.ts`, `src/instrumentation.ts`, old PWA files, `AGENTS.md`, `playwright.live.config.ts`, `src/server/restart-control.ts`, `tests/ui/ssr-bootstrap.test.ts`, `tests/e2e/live/{auth,auth.test,safety.test,playwright-live-config.test}.ts`, `tests/runtime-api/web-runtime-api.test.ts`, `tests/server/restart-control.test.ts`, `tests/electron/runtime-shell.test.ts`, `tests/vscode/bridge.test.ts`, `apps/vscode/package.json`, `scripts/{dev,dev-compression-proxy,remote-restart,measure-local-dev,free-port,cleanup-live-agent-journey}.*`, app READMEs.
277	
278	- [ ] Add a failing cutover test that rejects `next`, `.next`, Next route ownership, and Next-only environment assumptions.
279	- [ ] Make `dev`, `build`, `start`, local-size measurement, and port cleanup use the runner plus Vite.
280	- [ ] Audit port references with a port-context matcher such as `(?:localhost|127\.0\.0\.1|PORT|port|:)\\D{0,20}3035`, not a bare-number grep (an SVG path also contains `3035`). Exclude `docs/codex-history/**`, `docs/superpowers/**`, and the retrospective `docs/architecture/{conversation-ui-regression-lessons,hot-path-responsiveness-and-resource-leaks,frontend-state-and-rendering}.md`; update or retire every live operator source/script/config/test/doc reference, including `AGENTS.md`, `src/server/restart-control.ts`, Playwright/live helpers, dev/restart/measurement/cleanup scripts, app READMEs, `common-runtime-multi-surface.md`, and the listed tests. Add a test asserting no live reference remains under that exact rule.
281	- [ ] Retiring the old dev compression proxy must retain the compressing-proxy SSE harness proven in Task 4.
282	- [ ] Re-run the whole-process measurement and enforce the calibrated `<2 GB` development and `<1 GB` production-runner thresholds; a miss blocks cutover.
283	- [ ] Run `tests/runtime/next-standalone-route-parity.test.ts`, packaged-interface e2e, PWA, lint, all typechecks, unit tests, lifecycle tests, and production build.
284	- [ ] Only after those gates pass, print the exact approved deletion list and remove only the explicitly enumerated Next files/dependencies and old Vite-replaced PWA copies. The user's instruction to fully implement this plan authorizes that exact list; any added deletion requires fresh confirmation.
285	- [ ] Retarget `tests/ui/ssr-bootstrap.test.ts` from the removed `bootstrap.server.ts` file to the portable runner bootstrap route.
286	- [ ] Re-run the full cutover matrix and confirm local development has one runner process tree and no hidden second server.
287	
288	### Task 11A — Move the interface out of `src/app`
289	
290	**Files:** `src/app/home/**` → `src/interface/home/**`; `src/app/providers.tsx` → `src/interface/providers.tsx`; app styles/assets → `src/interface/styles/**` or `apps/interface/**`; affected imports/tests.
291	
292	- [ ] Add a failing architecture test that no shared interface entry imports from or lives under the Next-owned `src/app` tree.
293	- [ ] Move `home/**` and `providers.tsx` with import-path-only changes; move `globals.css`, `fx.css`, `fx/`, `fx-spike/`, and `favicon.ico` under Vite-owned interface paths and import them from `apps/interface/src/main.tsx`.
294	- [ ] Repoint `tests/app/**` imports without changing test behavior or creating a second test suite.
295	- [ ] Verify interface typecheck, unit tests, visual CSS smoke tests, and the Vite build before any behavior work resumes.
296	
297	### Task 11B — Keep Electron working through the Vite cutover
298	
299	**Files:** `apps/electron/main.ts`, `apps/electron/scripts/build.mjs`, Electron bootstrap/migration helper, Electron tests.
300	
301	- [ ] Add failing tests that the transitional Electron shell loads `dist/interface`, keeps its current local `startOmniServer` transport, and does not build a second renderer artifact or inline HTML.
302	- [ ] Before changing renderer origin, export legacy localStorage preferences and drafts from the current renderer origin into an atomic versioned payload under Electron `userData`; test success, retry, corrupt payload, and idempotence.
303	- [ ] Point the shell at the Vite production artifact and remove the old esbuild renderer pipeline while leaving remote-only conversion for Task 22.
304	- [ ] Verify Electron build and current desktop journeys at the M2 boundary.
305	
306	### Task 12 — Migrate direct network consumers and split oversized owners
307	
308	**Files:** every call site in `docs/architecture/runtime-api-migration-inventory.md`; `src/interface/home/mutations/*.ts`; `src/components/terminal/*`; `HomeApp.tsx`; query/Manager files.
309	
310	- [ ] Add failing architecture tests that reject direct `fetch`, `EventSource`, absolute API construction, or transport-specific IPC outside runtime adapters.
311	- [ ] Split `useHomeMutations.ts`, `HomeApp.tsx`, and `Terminal.tsx` into focused Manager/domain/render modules before adding runner behavior; preserve the user's current `Terminal.tsx` changes.
312	- [ ] Move each mutation/query/stream consumer to `RuntimeAPIs`; preserve abort, optimistic update, and server-authority behavior with focused tests.
313	- [ ] Replace terminal stream ownership only after the bounded replay contract from Task 6 is proven.
314	- [ ] Keep all shared domain state in Manager classes and verify narrow subscriptions for high-churn terminal/draft/cursor state.
315	- [ ] Verify migrated consumer tests, interface boundary tests, typechecks, and current end-to-end journeys.
316	
317	### Task 13 — Runner identity, compatibility, capabilities, and auth persistence
318	
319	**Files:** `src/shared/bootstrap.ts`, `api-revision.ts`, `src/server/db/schema.ts`, migrations, bootstrap route, session/auth tests.
320	
321	- [ ] Add failing migration tests for durable `runnerInstanceId`, session kind/origin/device metadata, idle/absolute expiry, last-used throttling, and existing database upgrades.
322	- [ ] Add failing contract tests for `current`/`minimum` revisions, declared additive-capability versus transport-breaking changes, unknown additive capabilities, and undeclared fixture diffs.
323	- [ ] Persist runner identity once per data root and return identity, revision window, capability ids, display name, bridge/readiness state, and stream epoch from bootstrap.
324	- [ ] Implement API-change classification in `src/shared/api-revision.ts` and make route fixture diffs fail unless declared.
325	- [ ] Verify clean and upgraded databases, bootstrap schema, revision compatibility, and identity stability across restart.
326	
327	### Task 14 — Password login, native-session rules, CORS, proxy trust, and TLS policy
328	
329	**Files:** `src/server/auth/{config,password,session,guards,rate-limit,audit,cors,trusted-proxy}.ts`, login/health routes, runner config, auth/security tests.
330	
331	- [ ] Add failing tests for cookie login, originless native bearer login, rejection when native login carries `Origin`, `Referer`, or fetch-metadata headers, later native-session origin rejection, password never being returned or stored, cookie tokens never being accepted as bearer tokens, and bearer tokens never being accepted as cookies.
332	- [ ] Add failing CORS tests for exact stored browser origin, `Vary: Origin`, error responses, registry-driven preflight, cookie-route exclusion, and `Access-Control-Allow-Credentials` never appearing.
333	- [ ] Add failing tests for socket-derived client/protocol identity, explicitly configured trusted proxies, plaintext non-loopback refusal, and loopback development allowance.
334	- [ ] Implement one rate-limit/audit path shared by password and browser authorization entry points.
335	- [ ] Define native TLS behavior: standard platform trust first; a per-profile SPKI pin may be used only after trust failure, requires explicit fingerprint confirmation, and requires explicit re-pin on change.
336	- [ ] Verify auth, CORS, proxy-spoofing, TLS-policy, and lifecycle tests.
337	
338	### Task 15 — Browser approval with S256 PKCE
339	
340	**Files:** `src/server/auth/browser-authorization.ts`, authorization routes, `src/interface/auth/InterfaceAuthorizationScreen.tsx`, web adapter, locales, auth/e2e tests.
341	
342	- [ ] Add failing tests for S256-only verifier/challenge length and alphabet, exact HTTPS or loopback-HTTP requesting origin, user gesture, state binding, 60-second expiry, atomic single use, origin binding, and no code/token logging.
343	- [ ] Add failing browser tests for popup success, blocked popup, user denial, timeout, wrong origin/state, replay, opener loss with platform return link, and reauthorization.
344	- [ ] Implement the target runner's same-origin approval page using the existing password session and localized copy in every locale.
345	- [ ] Exchange the code only for the bound origin and persist the resulting browser bearer session, never the password or PKCE verifier.
346	- [ ] Verify password-login routes still have no cross-origin support and the complete two-origin PKCE journey passes.
347	
348	### Task 16 — Stream tickets and cross-origin streams
349	
350	**Files:** `src/server/auth/stream-tickets.ts`, ticket route, events/terminal routes, web stream adapter, stream/auth tests.
351	
352	- [ ] Add failing tests for 60-second expiry, atomic single use, exact session/path/origin binding, fresh ticket per reconnect, ticket redaction, and session revalidation at redemption.
353	- [ ] Add a real cross-origin `EventSource` test requiring `Access-Control-Allow-Origin: <boundOrigin>` and `Vary: Origin` on the successful ticketed 200 response.
354	- [ ] Implement ticket issuance/redemption for main and terminal streams; keep cursor separate and non-secret.
355	- [ ] Make the web adapter close native `EventSource` retry, request a fresh ticket, and reconnect under `RunnerConnection` control.
356	- [ ] Verify cross-origin main/terminal streaming, restart/resync, session revocation, and no credential leakage in logs.
357	
358	### Task 17 — Session administration, password rotation, runner naming, and CLI
359	
360	**Files:** sessions/settings routes, auth modules, `src/server/cli/*`, `scripts/auth-password.mjs`, CLI/session tests.
361	
362	- [ ] Add failing tests for 30-day idle/90-day absolute browser sessions, 90-day idle/365-day absolute native sessions, at-most-once-per-minute touch, maximum 50 active sessions, and successful-login LRU eviction excluding the new session.
363	- [ ] Add failing list/current/revoke/revoke-all tests, including immediate stream/mutation invalidation and stable audit/named events.
364	- [ ] Implement `--runner <url>` with `OMNI_TOKEN`, `--token-file`, or token stdin; never put a token in `process.argv`. If the legacy `--token` argv form is retained for compatibility, emit an explicit warning and test its redaction.
365	- [ ] Add `omni auth init` as the provisioning alias and `--password-file` for unattended setup; refuse password files whose mode is not `0600`.
366	- [ ] Make password rotation revoke all sessions by default, with an explicit audited `--keep-sessions` override.
367	- [ ] Add authenticated runner rename with validation, audit/event emission, and bootstrap propagation.
368	- [ ] Add `omni runner rekey`. A valid same-origin session automatically re-pins the new runner identity; remote profiles require explicit login and identity confirmation.
369	- [ ] Verify API, CLI, lifecycle, and concurrent-session tests.
370	
371	### Task 18 — Profile and credential stores
372	
373	**Files:** `src/interface/runners/{RunnerProfile,RunnerProfileStore,RunnerCredentialStore}.ts`, web implementations, migration/store tests.
374	
375	- [ ] Add failing tests for versioned profile migrations, pre-login profile UUID scope, post-login `runnerInstanceId` rekey, duplicate identity merge, URL edits, forget behavior, and per-runner preferences/drafts/cursors.
376	- [ ] Implement profile metadata persistence separately from credentials; expose credential handles, never raw secrets, to interface Managers.
377	- [ ] Implement web profile storage and browser bearer storage with exact-origin/identity checks and explicit clearing on forget/revocation, including a non-deletable same-origin profile that survives migration and corrupt-store reset-to-default with a visible localized notice.
378	- [ ] Test rekey handling: a valid same-origin session automatically accepts the new identity while remote profiles remain blocked until explicit login/confirmation.
379	- [ ] Add collision and identity-mismatch recovery states without silently replacing trusted identity.
380	- [ ] Verify restart, migration, failed-write, partial-profile, and store-isolation tests.
381	
382	### Task 19 — Concurrent RunnerConnection and RunnerRegistry Managers
383	
384	**Files:** `src/interface/runners/{RunnerConnection,RunnerRegistry,RunnerRegistryProvider}.ts(x)`, existing stream/cache/notification Managers, runner-state tests.
385	
386	- [ ] Add failing state-machine tests for connecting, online, offline, deferred, needs-reauth, TLS-untrusted, identity-mismatch, incompatible, degraded/resync, and runner-stopping.
387	- [ ] Add race tests for stale responses after runner switch, delete/re-add, auth replacement, delayed bootstrap, reconnect timers, and mutation completion.
388	- [ ] Add failing tests that cursors persist per durable `runnerInstanceId`, clear on resync or trusted-identity change, and more than three resyncs within five minutes enter degraded jittered backoff.
389	- [ ] Implement one live main stream per authenticated profile, runner-scoped Query clients/keys, jittered exponential retry capped at five minutes, and the resync anti-storm governor.
390	- [ ] Keep only the active runner's terminal streams; detach on switch and request bounded scrollback on reactivation.
391	- [ ] Resolve `/session/:runId` against the active runner only. If the active snapshot does not contain the run, show an explicit not-found state without probing other connections; test deep-link arrival while another runner is active.
392	- [ ] Bound per-runner preview caches and global LRU memory while keeping persisted drafts/cursors authoritative to their store.
393	- [ ] Verify switching does not close inactive main streams or cancel their mutations and all manager subscriptions remain narrow.
394	
395	### Task 20 — Runner switcher, connect flow, sessions UI, notifications, and i18n
396	
397	**Files:** runner UI components, shared shell/home components, notification Manager, all nine `shared/locales/*.json`, UI/accessibility tests.
398	
399	- [ ] Add failing UI tests for first-run onboarding, add/edit/forget, active switching, status labels, reauth, TLS confirm/re-pin, identity mismatch, incompatibility, deferred runner, session revoke, and runner rename.
400	- [ ] Adapt the installed `sidebar-07` block into the persistent runner switcher and `login-03` into connect/authorize screens while retaining existing OmniHarness visual language.
401	- [ ] Keep runner-switcher controls hidden in the transitional Electron shell until Task 22 enables the remote-only host.
402	- [ ] Render one workspace at a time; make inactive runner activity visible through bounded counts and runner-named notifications.
403	- [ ] Add every new string to all nine locale files and use `useI18nSnapshot()` + `t()` at render boundaries.
404	- [ ] Verify keyboard navigation, focus restoration, screen-reader labels, reduced motion, narrow desktop/mobile widths, and live language switching.
405	
406	### Task 21 — Web/PWA two-runner and scale acceptance
407	
408	**Files:** `tests/e2e/multi-runner*.spec.ts`, fixtures/runner harness, memory scripts, Playwright config.
409	
410	- [ ] Start two isolated real runners on port 0 with distinct roots/passwords/identities and the packaged Vite artifact; do not reuse production/user data.
411	- [ ] Test add/login/PKCE, both live streams, active switching, inactive mutation completion, terminal detach/replay, offline/restart/epoch resync, revoke/reauth, identity mismatch, and PWA recovery.
412	- [ ] Run an eight-runner benchmark with all main streams live and bounded activity; require less than 40 MB incremental client memory per added idle runner and less than 750 MB aggregate under the specified workload.
413	- [ ] Run one runner at the declared `minimum` API revision and one at `current`; keep both connected, hide only unsupported additive capabilities with an explanation, and block only transport-breaking incompatibility.
414	- [ ] Assert retry jitter, deferred/background status when the platform limits sockets, and no uncaught browser errors or secret-bearing logs.
415	- [ ] Clean all test sessions, databases, processes, and generated run artifacts.
416	
417	### Task 22 — Remote-only Electron host and migration
418	
419	**Files:** `apps/electron/{main,preload,scripts/build,package}.ts/json/mjs`, new Electron store/bridge/TLS/migration modules, Electron tests/docs.
420	
421	- [ ] Add failing tests proving Electron never imports or starts the runner, renderer network access to runners is blocked, and IPC contracts validate every request/response/frame.
422	- [ ] Implement remote HTTP/SSE in the main process, `safeStorage` credential persistence, per-profile SPKI confirmation/re-pin, bounded stream delivery, and renderer-safe error objects.
423	- [ ] Import the versioned legacy preferences/drafts payload exported in Task 11B, then add an explicit path to profile the former embedded runtime as a local or remote runner; never silently abandon existing data.
424	- [ ] Test app restart, multiple runners, offline/reconnect, revoke, deep links, notifications, migration success/failure/rollback, and packaged CSP.
425	- [ ] Build and smoke-test the signed-development/unsigned-local package supported by the host environment.
426	
427	### Task 23 — VSCode remote runner client
428	
429	**Files:** `apps/vscode/src/extension.ts`, `webview/main.tsx`, `src/vscode-extension/bridge.ts`, VSCode manifest/docs/tests.
430	
431	- [ ] Add failing bridge tests for all-profile connection ownership, bearer-only host networking, validated messages, stream reconnect/cursor behavior, and renderer token isolation.
432	- [ ] Store sessions only in `ExtensionContext.secrets`; migrate and clear the current plain setting without logging its value.
433	- [ ] Implement the same profile/status/switching/session flows through the shared interface and VSCode host adapter.
434	- [ ] Verify multi-runner restart/reload, revoke/reauth, identity mismatch, notifications, and extension build/package.
435	
436	### Task 24 — Capacitor iOS and Android hosts
437	
438	**Files:** `apps/mobile/**`, `src/runtime-api/capacitor.ts`, root workspace/scripts, mobile/native contract tests.
439	
440	- [ ] Add Capacitor packages/config and generate committed iOS/Android source projects; add only `packages: ["apps/mobile"]` to `pnpm-workspace.yaml` (never an `apps/*` glob), keep generated build/signing/cache output ignored, and prove Electron/VSCode builds are unchanged by workspace membership.
441	- [ ] Point `capacitor.config.ts` `webDir` at the single `../../dist/interface` artifact. Add iOS `NSLocalNetworkUsageDescription` with strict ATS outside loopback development, and Android `usesCleartextTraffic=false` with a debug-only loopback network-security configuration; assert release builds never bypass certificate checks.
442	- [ ] Add failing JavaScript/native contract tests for request, abort, SSE frames, bounded queues, credential handles, TLS trust failure, explicit pin/re-pin, deep links, lifecycle suspension/resume, and notifications.
443	- [ ] Implement iOS networking/SSE with `URLSession`, secrets with Keychain Services, per-profile trust/pinning, links, and local notifications in a custom Capacitor plugin.
444	- [ ] Implement Android networking/SSE with OkHttp, encrypted token material backed by Android Keystore, per-profile trust/pinning, links, and local notifications in the matching plugin.
445	- [ ] Keep bearer tokens inside native code and block direct WebView runner networking with packaged CSP.
446	- [ ] Implement all-profile connections while active; when the OS suspends the app, persist cursors and reconnect/resync honestly on resume—no v1 push guarantee.
447	- [ ] Run native unit/contract tests, `cap sync`, Android debug build/tests, and iOS simulator no-sign build/tests on the available host.
448	
449	### Task 25 — Security, deployment, migration, and operator documentation
450	
451	**Files:** `README.md`, `.env.example`, app READMEs, architecture/lifecycle docs, new deployment/TLS/session/migration docs.
452	
453	- [ ] Document the logical runner/process model, bridge-degraded behavior, static/no-static modes, ports/locks/data roots, TLS requirements, trusted proxy configuration, and backup/restore.
454	- [ ] Document password login, browser approval, session TTL/list/revoke, password rotation, URL changes, identity mismatch, SPKI confirmation/re-pin, and credential-storage boundaries.
455	- [ ] Document Electron migration, VSCode secret migration, mobile build/signing prerequisites, PWA offline limits, platform socket/suspension limits, and v1 non-goals.
456	- [ ] Add copy-paste smoke commands that use temporary roots and never expose passwords in process listings or logs.
457	- [ ] Validate every documented command in a disposable test environment.
458	
459	### Task 26 — Full verification, security review, and clean handoff
460	
461	**Files:** all changed files and generated contract/build reports; no new product behavior.
462	
463	- [ ] Run targeted suites after each task, then final `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:lifecycle`, `pnpm build`, and `pnpm test:e2e`.
464	- [ ] Run runner route/static/security tests, two-runner and eight-runner suites, Electron build/tests, VSCode build/tests, Capacitor contract/sync, Android build/tests, and iOS simulator build/tests.
465	- [ ] Inspect logs/event ring for silent decisions, missing `error.surfaced`, missing SSE ids, leaked passwords/tokens/tickets/codes, CORS credentials, and unbounded subscriber/cache growth.
466	- [ ] Compare the final route fixture and API revision declaration; require every contract change to be additive-capability or transport-breaking-revision classified.
467	- [ ] Confirm Next/server code is absent from interface artifacts, native renderers cannot directly reach runners, and all credentials survive/revoke only through platform-secure stores.
468	- [ ] Clean only test-created sessions, roots, databases, processes, and build artifacts covered by test cleanup; preserve all user-owned files and pre-existing changes.
469	- [ ] Record exact command results, platform limitations if a required native toolchain is unavailable, and any explicitly documented Trusted Types exception before claiming completion.
470	

uuid: 44e889fb-0318-4137-8c33-8c7c3805f901
parent: 09145ffa-3b1e-4242-aa4d-8bc90adb7da3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:47:49.529Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:47:49.529Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/agents.md"
}

uuid: 130cc798-3ebd-48b7-a9bb-7c834f0e06a2
parent: 44e889fb-0318-4137-8c33-8c7c3805f901
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:47:49.540Z","phase":null} -->
## Claude tool result: toolu_01N2FrdLpX6N1pN5GiRwjawr · 2026-07-30T22:47:49.540Z

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

uuid: 6fac0d38-65c6-4a9d-9bef-f70f559b7d72
parent: 130cc798-3ebd-48b7-a9bb-7c834f0e06a2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:47:49.569Z","phase":null} -->
## Claude attachment · 2026-07-30T22:47:49.569Z

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

uuid: 96446ea5-aa62-45c5-802b-f6d702ab64aa
parent: 6fac0d38-65c6-4a9d-9bef-f70f559b7d72
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:48:03.476Z","phase":null} -->
## Claude thinking · 2026-07-30T22:48:03.476Z



uuid: 66b4a53f-1429-41c2-ba8e-fc02fa9aceb8
parent: 96446ea5-aa62-45c5-802b-f6d702ab64aa

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:48:06.880Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:48:06.880Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness\necho \"=== locales ===\"; ls shared/locales/*.json | wc -l\necho \"=== next route handlers (src/app/api route.ts) ===\"; find src/app/api -name \"route.ts\" | wc -l\necho \"=== next/dynamic ===\"; grep -rn \"next/dynamic\" src/ apps/ 2>/dev/null | wc -l\necho \"=== next/image ===\"; grep -rn \"next/image\" src/ apps/ 2>/dev/null | wc -l\necho \"=== next/font ===\"; grep -rn \"next/font\" src/ apps/ 2>/dev/null\necho \"=== restart-control ===\"; ls src/server/restart-control.ts 2>&1\necho \"=== shared dir ===\"; ls src/shared/ 2>&1\necho \"=== tsconfigs ===\"; ls tsconfig*.json 2>&1\necho \"=== arch tests ===\"; ls tests/architecture/ 2>&1",
  "description": "Verify plan factual claims"
}

uuid: 90aad562-b22e-47c9-bd3f-7ee381859bc8
parent: 66b4a53f-1429-41c2-ba8e-fc02fa9aceb8
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:48:07.089Z","phase":null} -->
## Claude tool result: toolu_015fXaEniEbaGf8DtqhUn7Zp · 2026-07-30T22:48:07.089Z

```text
=== locales ===
       9
=== next route handlers (src/app/api route.ts) ===
      49
=== next/dynamic ===
       4
=== next/image ===
       5
=== next/font ===
src/app/layout.tsx:2:import { Geist, Geist_Mono } from "next/font/google";
=== restart-control ===
src/server/restart-control.ts
=== shared dir ===
bootstrap.ts
home-types.ts
planning-review.ts
runtime.ts
worker-entries.ts
worker-types.ts
=== tsconfigs ===
tsconfig.interface.json
tsconfig.json
tsconfig.lifecycle-subprocess.json
tsconfig.runner.json
tsconfig.shared.json
=== arch tests ===
interface-boundary.test.ts
typecheck-projects.test.ts

uuid: 549bb1cd-8be0-403b-a39e-ede45556a08c
parent: 90aad562-b22e-47c9-bd3f-7ee381859bc8
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:48:13.094Z","phase":null} -->
## Claude thinking · 2026-07-30T22:48:13.094Z



uuid: ef88ba34-b08b-4f58-a739-cac91f4e0027
parent: 549bb1cd-8be0-403b-a39e-ede45556a08c

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:48:16.323Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:48:16.323Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness\necho \"=== standalone registered routes ===\"; grep -rno \"path:\" src/runtime/http/routes/index.ts | wc -l; grep -rn \"registerRoute\\|routes: \\[\" src/runtime/http/routes/index.ts | head -5\necho \"=== port-context 3035 hits (excluding node_modules,.next,dist) ===\"\ngrep -rEIl '(localhost|127\\.0\\.0\\.1|PORT|port|:)[^0-9]{0,20}3035' . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.git 2>/dev/null | grep -v \"^./docs/codex-history/\" | grep -v \"^./docs/superpowers/\" | sort",
  "description": "Audit route counts and 3035 references"
}

uuid: 3f7cb404-f431-4947-b36b-59c401b1faf6
parent: ef88ba34-b08b-4f58-a739-cac91f4e0027
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:48:16.537Z","phase":null} -->
## Claude tool result: toolu_014B4cyUjVxHA58gsmVVYjxM · 2026-07-30T22:48:16.537Z

```text
=== standalone registered routes ===
       0
=== port-context 3035 hits (excluding node_modules,.next,dist) ===
AGENTS.md
apps/electron/README.md
apps/vscode/README.md
apps/vscode/package.json
apps/vscode/src/extension.ts
apps/vscode/webview/main.tsx
docs/architecture/common-runtime-multi-surface.md
docs/architecture/conversation-ui-regression-lessons.md
docs/architecture/frontend-state-and-rendering.md
docs/architecture/hot-path-responsiveness-and-resource-leaks.md
docs/codex-history/attachments/019f5a1b-f57d-7a23-8bc4-b1dc53fc42db/tool-result-tool-result-custom_tool_call_output-call_3I4tQ09iDBLMg9IWO3o1tyap-part-001.txt
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec6cc-019ec6cc-eac4-7643-b6c2-f1c7e8b21700-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec6fb-019ec6fb-7a2d-7100-9a72-f3cd19ec1851-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec701-019ec701-2a4a-7f62-8a48-2c961fec483c-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec701-019ec701-cd12-74e1-b1bc-5500e64d0904-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec736-019ec736-702e-7f83-a09a-7c254e1a1a17-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec737-019ec737-a9d1-79f0-bd91-5757fb88c60b-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec740-019ec740-0740-7443-900f-6b3264bbae93-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-codex-conversation-019ec74e-019ec74e-9493-7a21-9eb6-940005805579-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-fix-session-opens-at-top-019ec6b2-6b55-74b1-910b-be642c9996de-part-001.md
docs/codex-history/conversations/2026/06/2026-06-14-oh-multi-server-single-app-019ec6c7-4c64-72d1-a22e-134185cd20de-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-add-collapse-all-button-019ecb84-2c90-7c10-8c22-bf6021750dc3-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-add-draggable-project-ordering-019ecc11-a5c5-7262-985a-59d3082c63c4-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-align-other-sessions-chevron-019ecb8e-96b0-7f10-b9f1-e6df04da3437-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-codex-conversation-019ecbab-019ecbab-9681-78a0-b1cf-b8c6f05b15d1-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-fix-cli-feedback-prompt-handling-019ecb93-bf00-77d1-be64-cedc66cc0abb-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-freeze-recent-tab-list-019ecb8b-bdab-7312-bc8d-cc9d15180151-part-001.md
docs/codex-history/conversations/2026/06/2026-06-15-windows-install-019ecbd6-a803-7e80-a804-efa540c2b847-part-001.md
docs/codex-history/conversations/2026/06/2026-06-16-fix-queued-messages-after-steer-019ed25f-7558-78e0-8c6c-88c0a8ba0731-part-001.md
docs/codex-history/conversations/2026/06/2026-06-20-codex-conversation-019ee639-019ee639-35a1-73f2-a5f5-7fd31f025257-part-001.md
docs/codex-history/conversations/2026/06/2026-06-21-codex-conversation-019eead9-019eead9-0603-7710-adc1-ab1cf3a67401-part-001.md
docs/codex-history/conversations/2026/06/2026-06-21-ignore-.omniharness-by-default-019ee92d-8587-71f3-a259-2239de3af597-part-001.md
docs/codex-history/conversations/2026/06/2026-06-23-fix-resume-session-selection-019ef4a1-c3a7-70f1-8d7d-925ee8ff4326-part-001.md
docs/codex-history/conversations/2026/06/2026-06-23-investigate-session-block-019ef6c9-5d4f-78c0-876f-cd356989e2bb-part-001.md
docs/codex-history/conversations/2026/06/2026-06-24-fix-stale-session-warning-019efb62-fe95-7da1-93d6-4d4494095b22-part-001.md
docs/codex-history/conversations/2026/06/2026-06-24-fix-waiting-input-state-019efb78-b3e4-7a63-bbf6-f53d1a8142c4-part-001.md
docs/codex-history/conversations/2026/06/2026-06-26-find-typing-lag-cause-019f05aa-b96a-73b1-952d-6bace01598b5-part-001.md
docs/codex-history/conversations/2026/06/2026-06-28-fix-session-recovery-019f0fff-7685-7af2-a1a4-ef6a9b64cf3c-part-001.md
docs/codex-history/conversations/2026/06/2026-06-29-fix-finished-session-spinner-019f152e-285b-7cf1-af15-abebdecb36ba-part-001.md
docs/codex-history/conversations/2026/06/2026-06-29-fix-gemini-api-key-missing-error-019f1380-22b8-76a1-8e79-11c2cf1a5f88-part-001.md
docs/codex-history/conversations/2026/06/2026-06-30-claude-add-global-alias-for-claude-cli-shortcut-7fbc2d86-7528-48a8-9f43-07b4ef66c6b3-part-001.md
docs/codex-history/conversations/2026/06/2026-06-30-fix-agent-tool-denial-019f1876-6646-7880-8c63-7bbee9790217-part-001.md
docs/codex-history/conversations/2026/06/2026-06-30-inspect-session-output-loss-019f1923-0b86-74a3-91d0-2cc735fc9a07-part-001.md
docs/codex-history/conversations/2026/07/2026-07-01-codex-conversation-019f1d16-019f1d16-920e-7a53-81f6-5bc49b6c3171-part-001.md
docs/codex-history/conversations/2026/07/2026-07-04-fix-claude-code-auth-errors-019f2d4b-f68f-7a12-af08-ea106eeaf1fa-part-001.md
docs/codex-history/conversations/2026/07/2026-07-05-fix-output-omission-019f31b5-ca45-7f53-b8f4-cd31f6780a03-part-001.md
docs/codex-history/conversations/2026/07/2026-07-07-codex-conversation-019f3e84-019f3e84-873e-78b0-b144-9e0f91cda31a-part-001.md
docs/codex-history/conversations/2026/07/2026-07-09-claude-analyze-landing-site-and-conversion-funnel-strategy-6a999834-c6a5-41c9-b51c-b470358df68e-part-001.md
docs/codex-history/conversations/2026/07/2026-07-09-codex-conversation-019f45fd-019f45fd-3130-7430-8cd8-87c154b22801-part-001.md
docs/codex-history/conversations/2026/07/2026-07-09-codex-conversation-019f460c-019f460c-3922-76d3-9e97-51ccf65c3def-part-001.md
docs/codex-history/conversations/2026/07/2026-07-09-fix-stuck-session-state-019f48c9-384c-7c70-8006-c418278639ff-part-001.md
docs/codex-history/conversations/2026/07/2026-07-09-quota-reset-019f4683-670f-7b21-b15b-39fa2e22f4a8-part-001.md
docs/codex-history/conversations/2026/07/2026-07-11-claude-review-acp-client-design-and-implementation-plan-d2fd7ddd-3671-4699-9add-2b11ec9db00f-part-001.md
docs/codex-history/conversations/2026/07/2026-07-11-oh-implement-new-acp-commands-for-cc-019f510a-6840-7f40-88d9-33d938ce93a7-part-001.md
docs/codex-history/conversations/2026/07/2026-07-13-claude-review-managed-claude-model-gateway-design-and-plan-7c932a45-da0e-4519-af6a-c0da27ea6c0d-part-001.md
docs/codex-history/conversations/2026/07/2026-07-13-claude-review-omniharness-lifecycle-journey-design-and-plan-f134a257-0b70-417d-9c9c-ec7170400cc9-part-001.md
docs/codex-history/conversations/2026/07/2026-07-13-codex-conversation-019f5af5-019f5af5-fcc4-7761-bd4b-5d49bb6540a4-part-001.md
docs/codex-history/conversations/2026/07/2026-07-13-fix-account-toggles-and-cleanup-019f5d91-a739-73e2-b111-6914fab5347e-part-001.md
docs/codex-history/conversations/2026/07/2026-07-13-gpt5.6-in-claude-code-019f5a1b-f57d-7a23-8bc4-b1dc53fc42db-part-001.md
docs/codex-history/conversations/2026/07/2026-07-13-we-need-an-option-to-copy-full-path-to-a-file-in-the-file-v...-019f5cda-ee0c-7fb0-80d1-fd6a53067350-part-001.md
docs/codex-history/conversations/2026/07/2026-07-28-claude-omniharness-code-session-b87bc6bb-ca24-4abe-9708-fcc09d1fc0a6-part-001.md
docs/codex-history/conversations/2026/07/2026-07-29-claude-omniharness-code-session-065549d0-1f18-46aa-b5a0-9d8900b1302e-part-001.md
docs/codex-history/conversations/2026/07/2026-07-30-review-interface-runner-split-019fb3be-ae68-7c53-9bf2-6b040cdf055c-part-001.md
docs/superpowers/journeys/2026-05-13-branch-workspace-management.md
docs/superpowers/learnings/2026-05-20-native-terminal-pending-scroll.md
docs/superpowers/plans/2026-05-11-app-architecture-react-performance.md
docs/superpowers/plans/2026-05-12-branch-workspace-management.md
docs/superpowers/plans/2026-05-14-planning-review-agents.md
docs/superpowers/plans/2026-05-18-common-runtime-multi-surface.md
docs/superpowers/plans/2026-05-25-automatic-session-cleanup.md
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md
docs/superpowers/plans/2026-06-14-escape-interrupt-queued-message.md
docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
docs/superpowers/plans/2026-06-14-visual-improve-mode.md
docs/superpowers/plans/2026-07-11-complete-acp-client.md
docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md
docs/superpowers/plans/2026-07-13-managed-claude-model-gateway.md
playwright.live.config.ts
scripts/cleanup-live-agent-journey.ts
scripts/dev-compression-proxy.ts
scripts/dev.ts
scripts/measure-local-dev.mjs
scripts/remote-restart.ts
src/server/restart-control.ts
tests/e2e/live/auth.test.ts
tests/e2e/live/auth.ts
tests/e2e/live/playwright-live-config.test.ts
tests/e2e/live/safety.test.ts
tests/electron/runtime-shell.test.ts
tests/runtime-api/web-runtime-api.test.ts
tests/server/restart-control.test.ts
tests/vscode/bridge.test.ts

uuid: ada72666-f054-445d-91bc-83647cb75c0e
parent: 3f7cb404-f431-4947-b36b-59c401b1faf6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:48:32.053Z","phase":null} -->
## Claude thinking · 2026-07-30T22:48:32.053Z



uuid: 7d03f457-0c17-4659-9657-9106a6ea9375
parent: ada72666-f054-445d-91bc-83647cb75c0e

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:48:33.520Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:48:33.520Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness\necho \"=== routes/index.ts head ===\"; head -40 src/runtime/http/routes/index.ts\necho \"=== route module count ===\"; ls src/runtime/http/routes/ | wc -l",
  "description": "Inspect standalone route registry"
}

uuid: 8e7bcf79-49da-4213-9fb2-5b41bea1c2e8
parent: 7d03f457-0c17-4659-9657-9106a6ea9375
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:48:33.562Z","phase":null} -->
## Claude tool result: toolu_0199r87KcHpt4Bhut2vW2nfb · 2026-07-30T22:48:33.562Z

```text
=== routes/index.ts head ===
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
=== route module count ===
      38

uuid: f7e742a8-3ade-41d6-bac4-8150bd1620c0
parent: 8e7bcf79-49da-4213-9fb2-5b41bea1c2e8
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:48:38.019Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:48:38.019Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness\ngrep -n \"register\\|\\.route(\\|createOmniHttpRegistry\" src/runtime/http/routes/index.ts | head -20\necho \"--- count of registry entries ---\"\ngrep -cE '^\\s*\\{?\\s*(pattern|method|path)' src/runtime/http/routes/index.ts\necho \"--- sample body ---\"; sed -n '45,80p' src/runtime/http/routes/index.ts",
  "description": "Count registered standalone routes"
}

uuid: 893987ee-4e16-40e2-95c9-173e07985aa6
parent: f7e742a8-3ade-41d6-bac4-8150bd1620c0
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:48:38.106Z","phase":null} -->
## Claude tool result: toolu_01TtDTYuRYnCeHQH1BAy5j9q · 2026-07-30T22:48:38.106Z

```text
1:import { createOmniHttpRegistry } from "@/runtime/http/registry";
50:  return createOmniHttpRegistry()
51:    .route("GET", "/api/runtime/bootstrap", handleRuntimeBootstrapRequest)
52:    .route("GET", "/api/auth/session", handleAuthSessionRequest)
53:    .route("DELETE", "/api/auth/session", handleAuthSessionRequest)
54:    .route("POST", "/api/auth/login", handleAuthLoginRequest)
55:    .route("POST", "/api/auth/logout", handleAuthLogoutRequest)
56:    .route("GET", "/api/auth/pair", handleAuthPairRequest)
57:    .route("POST", "/api/auth/pair", handleAuthPairRequest)
58:    .route("POST", "/api/auth/pair/redeem", handleAuthPairRedeemRequest)
59:    .route("GET", "/api/settings", handleSettingsRequest)
60:    .route("POST", "/api/settings", handleSettingsRequest)
61:    .route("GET", "/api/integrations/claude-model-gateway", handleClaudeModelGatewayRequest)
62:    .route("POST", "/api/integrations/claude-model-gateway", handleClaudeModelGatewayRequest)
63:    .route("OPTIONS", "/api/integrations/claude-model-gateway", handleClaudeModelGatewayRequest)
64:    .route("GET", "/api/accounts", handleAccountsRequest)
65:    .route("POST", "/api/accounts", handleAccountsRequest)
66:    .route("PATCH", "/api/accounts/:id", handleAccountDetailRequest)
67:    .route("DELETE", "/api/accounts/:id", handleAccountDetailRequest)
68:    .route("POST", "/api/accounts/:id/status", handleAccountStatusRequest)
--- count of registry entries ---
0
--- sample body ---
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
    .route("GET", "/api/integrations/claude-model-gateway", handleClaudeModelGatewayRequest)
    .route("POST", "/api/integrations/claude-model-gateway", handleClaudeModelGatewayRequest)
    .route("OPTIONS", "/api/integrations/claude-model-gateway", handleClaudeModelGatewayRequest)
    .route("GET", "/api/accounts", handleAccountsRequest)
    .route("POST", "/api/accounts", handleAccountsRequest)
    .route("PATCH", "/api/accounts/:id", handleAccountDetailRequest)
    .route("DELETE", "/api/accounts/:id", handleAccountDetailRequest)
    .route("POST", "/api/accounts/:id/status", handleAccountStatusRequest)
    .route("GET", "/api/agents", handleAgentsRequest)
    .route("GET", "/api/agents/:name", handleAgentDetailRequest)
    .route("POST", "/api/agents/:name/elicitation", handleAgentElicitationRequest)
    .route("POST", "/api/agents/:name/permission", handleAgentPermissionRequest)
    .route("POST", "/api/agents/:name/acp", handleAgentAcpRequest)
    .route("GET", "/api/agents/catalog", handleAgentsCatalogRequest)
    .route("POST", "/api/agents/prewarm-worker", handlePrewarmWorkerRequest)
    .route("POST", "/api/llm-models", handleLlmModelsRequest)
    .route("GET", "/api/codex-auth/status", handleCodexAuthStatusRequest)
    .route("GET", "/api/notifications", handleNotificationsRequest)
    .route("POST", "/api/notifications", handleNotificationsRequest)
    .route("DELETE", "/api/notifications", handleNotificationsRequest)

uuid: 205a1884-d180-4c65-a876-6eade0205764
parent: 893987ee-4e16-40e2-95c9-173e07985aa6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:48:42.758Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:48:42.758Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness; grep -c '\\.route(' src/runtime/http/routes/index.ts",
  "description": "Count .route registrations"
}

uuid: 95c47736-1b7f-4b57-b258-312248a713a2
parent: 205a1884-d180-4c65-a876-6eade0205764
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:48:42.806Z","phase":null} -->
## Claude tool result: toolu_01W2bzFm31sWB9BcXDUEQg1A · 2026-07-30T22:48:42.806Z

```text
63

uuid: 3e3faf6a-6dd0-49cd-a96d-bde040f3e2b0
parent: 95c47736-1b7f-4b57-b258-312248a713a2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:49:05.263Z","phase":null} -->
## Claude thinking · 2026-07-30T22:49:05.263Z



uuid: 363b355c-eeac-4bde-ab1d-4987bbb59c4d
parent: 3e3faf6a-6dd0-49cd-a96d-bde040f3e2b0

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:49:09.047Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:49:09.047Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness\nfor f in src/app/providers.tsx src/app/globals.css src/app/fx.css src/app/favicon.ico src/instrumentation.ts scripts/dev.ts scripts/start.ts scripts/free-port.sh playwright.live.config.ts tests/ui/ssr-bootstrap.test.ts docs/architecture/common-runtime-multi-surface.md components.json pnpm-workspace.yaml src/app/home/bootstrap.server.ts src/lib/agent-output.ts; do [ -e \"$f\" ] && echo \"OK   $f\" || echo \"MISS $f\"; done\nfor d in src/app/fx src/app/fx-spike apps/electron apps/vscode; do [ -d \"$d\" ] && echo \"OK   $d/\" || echo \"MISS $d/\"; done\necho \"--- sizes ---\"; wc -l src/app/home/useHomeMutations.ts src/app/home/HomeApp.tsx src/components/Terminal.tsx src/server/supervisor/index.ts src/server/agent-runtime/manager.ts\necho \"--- workspace ---\"; cat pnpm-workspace.yaml",
  "description": "Verify plan-referenced paths exist"
}

uuid: a3d9562e-761e-4c17-8db1-a5718be4ab9c
parent: 363b355c-eeac-4bde-ab1d-4987bbb59c4d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:49:09.156Z","phase":null} -->
## Claude tool result: toolu_014ePzx6RJH66EZeuz4hsxL2 · 2026-07-30T22:49:09.156Z

```text
OK   src/app/providers.tsx
OK   src/app/globals.css
OK   src/app/fx.css
OK   src/app/favicon.ico
OK   src/instrumentation.ts
OK   scripts/dev.ts
OK   scripts/start.ts
OK   scripts/free-port.sh
OK   playwright.live.config.ts
OK   tests/ui/ssr-bootstrap.test.ts
OK   docs/architecture/common-runtime-multi-surface.md
OK   components.json
OK   pnpm-workspace.yaml
OK   src/app/home/bootstrap.server.ts
OK   src/lib/agent-output.ts
OK   src/app/fx/
OK   src/app/fx-spike/
OK   apps/electron/
OK   apps/vscode/
--- sizes ---
    1269 src/app/home/useHomeMutations.ts
    1697 src/app/home/HomeApp.tsx
    2553 src/components/Terminal.tsx
    2093 src/server/supervisor/index.ts
    2783 src/server/agent-runtime/manager.ts
   10395 total
--- workspace ---
packageManagerStrict: warn

overrides:
  fast-xml-parser: ^5.7.2
  esbuild: ^0.28.0
  form-data: ^4.0.5
  lodash: ^4.18.1
  postcss: ^8.5.12
  qs: ^6.15.1
  "@smithy/config-resolver": ^4.4.17
  uuid: ^14.0.0
  xml2js: ^0.6.2

allowBuilds:
  "@danduma/i18n": true
  '@danduma/i18n@https://codeload.github.com/danduma/i18n/tar.gz/ab2a85dddd2e176b61bec18d55736dbdd151fe41': true
  better-sqlite3: true
  esbuild: true
  msw: true
  node-pty: true
  sharp: true
  unrs-resolver: true

uuid: 5134160f-96bf-41a5-a6f1-09db20394c56
parent: a3d9562e-761e-4c17-8db1-a5718be4ab9c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:49:09.160Z","phase":null} -->
## Claude attachment · 2026-07-30T22:49:09.160Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: 7a030edc-8700-4e60-82f4-257a3a794c74
parent: 5134160f-96bf-41a5-a6f1-09db20394c56
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:49:21.946Z","phase":null} -->
## Claude thinking · 2026-07-30T22:49:21.946Z



uuid: 85aeda1b-6483-49ae-93cd-1312f9209290
parent: 7a030edc-8700-4e60-82f4-257a3a794c74

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:49:34.117Z","phase":null} -->
## Claude · 2026-07-30T22:49:34.117Z

Verified the plan against the repo and AGENTS.md. All four prior hardening points are in place, and every factual claim I could check statically holds.

**Fix verification**
- **H1 (completed work preserved):** `docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md:156` carries the current-checkout note; Tasks 1 and 2 are `[x]`. On disk: `src/shared/{runtime,bootstrap,home-types,planning-review,worker-entries,worker-types}.ts`, `tsconfig.{shared,runner,interface}.json`, and `tests/architecture/{interface-boundary,typecheck-projects}.test.ts` all exist. `src/shared/home-types.ts` is explicitly named in the preservation list and in the File map (line 61).
- **H2 (pre-split baseline):** Task 2A sits before Task 3, states the Next topology must still be intact, and line 181 makes it a hard Task 11 prerequisite; Task 11 line 282 consumes it as the calibrated threshold gate.
- **H3 (3035 audit):** line 280 uses the port-context matcher, excludes `docs/codex-history/**`, `docs/superpowers/**`, and the three named retrospective docs, names `src/server/restart-control.ts` as an owned update target, and requires an assertion test. I ran that matcher: every live hit falls under the plan's enumerated targets or its exclusions — no uncovered category.
- **H4 (styles before deletion):** line 246 imports the real `src/app/globals.css` / `fx.css` from the Vite entry before any Next deletion; line 293 moves them in 11A. The M2 removal list (lines 134-138) does not contain those files, and line 138 forbids unlisted removals.

**Independent fact checks (all match)**
49 Next route handlers · 63 `.route(` registrations in `src/runtime/http/routes/index.ts` · 9 locale files · 4 `next/dynamic` · 5 `next/image` · 1 `next/font/google` · line counts exactly 1,269 / 1,697 / 2,553 · every path in the File map and Task 11 file list exists. `pnpm-workspace.yaml` has no `packages:` key today, so Task 24's "add only `packages: ["apps/mobile"]`" is correct as written and cannot accidentally enroll `apps/electron` or `apps/vscode`.

**READY** — no implementation-blocking issue remains.

Two non-blocking observations, recorded only so you're not surprised mid-execution: Task 3's note says the resync governor lands "after Tasks 13 and 18" while it's actually implemented in Task 19 (a cross-reference imprecision, not a dependency error), and `apps/vscode/src/extension.ts` / `webview/main.tsx` hold live 3035 references without being named in Task 11's file list — the audit rule and its assertion test still catch them, and Task 23 owns those files.

uuid: 5a6f9c91-8c68-434c-8c5c-fb210b459d39
parent: 85aeda1b-6483-49ae-93cd-1312f9209290

<!-- /codex-event -->

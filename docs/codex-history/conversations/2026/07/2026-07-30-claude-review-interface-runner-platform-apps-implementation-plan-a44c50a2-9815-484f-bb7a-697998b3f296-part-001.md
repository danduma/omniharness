---
provider: "claude"
codex_thread_id: "a44c50a2-9815-484f-bb7a-697998b3f296"
title: "Review interface runner platform apps implementation plan"
started_at: "2026-07-30T22:30:30.661Z"
updated_at: "2026-07-30T22:34:34.310Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review interface runner platform apps implementation plan

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:30:30.661Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T22:30:30.661Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-30T22:30:30.661Z",
  "sessionId": "a44c50a2-9815-484f-bb7a-697998b3f296",
  "content": "Re-review the revised implementation plan at docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md against docs/superpowers/specs/2026-07-29-interface-runner-split-design.md and AGENTS.md. The prior review raised F1-F11: src/app teardown, deep links, M2 Electron transition/export, executable dual-adapter route parity, runner memory gate, port 3035 audit, workspace membership, cursor identity ordering, migration inventory/event ownership, dirty checkout/deletion scope, mixed-version/native config acceptance. Confirm each is resolved without introducing a dependency-order bug. Return exactly: (1) READY or HARDEN, (2) only remaining implementation blockers with precise edits, (3) deliberate non-goals. Do not edit files."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:30:30.661Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T22:30:30.661Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-30T22:30:30.661Z",
  "sessionId": "a44c50a2-9815-484f-bb7a-697998b3f296"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:30:30.720Z","phase":null} -->
## Claude attachment · 2026-07-30T22:30:30.720Z

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

uuid: 42a37926-794e-47cd-9e4c-810da6e416c1
parent: 73ab324b-742f-4859-bcea-c886fec8d96d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:30:30.720Z","phase":null} -->
## Claude attachment · 2026-07-30T22:30:30.720Z

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

uuid: 30002ca5-1806-4037-b783-508dd2034196
parent: 42a37926-794e-47cd-9e4c-810da6e416c1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:30:30.720Z","phase":null} -->
## Claude attachment · 2026-07-30T22:30:30.720Z

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

uuid: c674b8ac-b012-4daa-8824-3e714cb8cd1f
parent: 30002ca5-1806-4037-b783-508dd2034196
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-30T22:30:30.721Z","phase":null} -->
## User · 2026-07-30T22:30:30.721Z

Re-review the revised implementation plan at docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md against docs/superpowers/specs/2026-07-29-interface-runner-split-design.md and AGENTS.md. The prior review raised F1-F11: src/app teardown, deep links, M2 Electron transition/export, executable dual-adapter route parity, runner memory gate, port 3035 audit, workspace membership, cursor identity ordering, migration inventory/event ownership, dirty checkout/deletion scope, mixed-version/native config acceptance. Confirm each is resolved without introducing a dependency-order bug. Return exactly: (1) READY or HARDEN, (2) only remaining implementation blockers with precise edits, (3) deliberate non-goals. Do not edit files.

uuid: 73ab324b-742f-4859-bcea-c886fec8d96d

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:30:32.340Z","phase":null} -->
## Claude · 2026-07-30T22:30:32.340Z

I'll read the three documents and verify each finding.

uuid: d0afead9-d964-4f33-b818-a696315403b6
parent: c674b8ac-b012-4daa-8824-3e714cb8cd1f

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:30:33.645Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:30:33.645Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md"
}

uuid: a550ee62-50fb-4cc2-84e7-3c9ab49f1937
parent: d0afead9-d964-4f33-b818-a696315403b6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:30:33.877Z","phase":null} -->
## Claude tool result: toolu_01ATviTNZRg5d6P76iRHzh9q · 2026-07-30T22:30:33.877Z

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
134	- `next.config.ts`, `next-env.d.ts`, Next-only dependencies/configuration.
135	- Old Next-owned PWA copies after their Vite-owned replacements pass tests.
136	- No file outside this enumerated list is removed as part of the cutover.
137	
138	### Existing large-file rule
139	
140	- `src/app/home/useHomeMutations.ts` (1,269 lines), `HomeApp.tsx` (1,697), and `src/components/Terminal.tsx` (2,553) are split before adding the new behavior they own.
141	- Do not add runner work to already oversized `src/server/supervisor/index.ts` or `src/server/agent-runtime/manager.ts`; use the new focused runner modules.
142	
143	### `.gitignore` requirements
144	
145	- Add `/dist/`, `/apps/mobile/ios/App/Pods/`, `/apps/mobile/ios/DerivedData/`, `/apps/mobile/android/.gradle/`, `/apps/mobile/android/**/build/`, `/apps/mobile/android/local.properties`, signing files, provisioning profiles, keystores, generated release archives, and native SDK caches.
146	- Keep native project source/configuration versioned. Never stage `.env`, auth keys, SQLite files, tokens, certificates/private keys, build output, logs, or local signing state.
147	
148	## Execution checklist
149	
150	### Task 1 — Baseline and boundary tests
151	
152	**Files:** `tests/architecture/interface-boundary.test.ts`, `tests/architecture/typecheck-projects.test.ts`, `eslint.config.mjs`, `tsconfig*.json`, `.gitignore`.
153	
154	- [ ] Record `git status --short` plus the full diff/untracked-file inventory in a scratch note outside the repository. Preserve and re-verify the existing edits to `Terminal.tsx`, model selection, agent runtime, named events, external-session discovery, and their tests after Tasks 3 and 12; do not branch, stash, reset, or overwrite them.
155	- [ ] Extend `scripts/measure-local-dev.mjs` to sample peak and final RSS for the whole process tree under a deterministic 10-minute fixture-agent workload with no live model; check in the pre-split baseline report.
156	- [ ] Add failing architecture tests that enumerate interface entry imports and reject runtime imports from `@/server/*`/`@/runtime/*`, except declared `@/shared/*`.
157	- [ ] Add failing tests that require separate shared/runner/interface typecheck configs and mobile/build ignores.
158	- [ ] Run the new tests and confirm they fail for the current cross-boundary imports/config.
159	- [ ] Create the three tsconfig projects, ESLint restrictions, and `.gitignore` entries; keep the root `typecheck` script running all projects.
160	- [ ] Verify the architecture tests, `pnpm lint`, and each `tsc -p ... --noEmit`.
161	
162	### Task 2 — Extract genuinely shared types and values
163	
164	**Files:** new `src/shared/*.ts`; old `src/server/workers/entries-types.ts`, `src/server/planning/review-preferences.ts`, `src/server/supervisor/worker-types.ts`; `src/runtime/bootstrap.ts`; affected interface imports.
165	
166	- [ ] Add failing import/runtime tests for worker entry types, planning schema, worker labels, runtime primitives, and bootstrap types from `src/shared`.
167	- [ ] Move pure definitions to the new shared modules; leave server-side re-export shims so unrelated server imports do not churn.
168	- [ ] Move `HomeBootstrapPayload` and runner/capability types out of `src/runtime/bootstrap.ts` so the Vite graph never imports runner modules.
169	- [ ] Update interface imports and prove the Vite-side module graph contains no server/runtime source.
170	- [ ] Run targeted shared/import tests plus all three typechecks.
171	
172	### Task 3 — Epoch-aware event ids, heartbeat, replay, and resync
173	
174	**Files:** `src/shared/runtime.ts`, `src/server/events/named-events.ts`, `src/runtime/http/routes/events.ts`, `src/app/home/LiveEventConnectionManager.ts`, event/lifecycle tests.
175	
176	- [ ] Add failing tests for `<epoch>:<seq>` parsing/comparison, every event frame carrying an id, a process-global id-bearing heartbeat, restart epoch mismatch, cursor below ring floor, and resync reasons.
177	- [ ] Add failing client tests for cursor persistence behind an injectable scope key and clear-on-resync; durable `runnerInstanceId` scoping and the resync governor land after Tasks 13 and 18.
178	- [ ] Implement the per-process epoch, 4096-entry ring, heartbeat event, header/query cursor parsing (`cursor` wins), and stable resync reasons.
179	- [ ] Update `LiveEventCursorManager` to compare epoch + sequence rather than treating all nonnumeric ids as newer.
180	- [ ] Emit the subscriber-overflow diagnostic and add its typed event/error codes without overwriting existing named-event work.
181	- [ ] Verify event-route, cursor, lifecycle reconnect/restart, and event-log tests.
182	
183	### Task 4 — Bounded Node streaming and shutdown behavior
184	
185	**Files:** `src/runtime/http/stream-response.ts`, `src/runtime/http/server.ts`, `src/runtime/http/routes/events.ts`, terminal stream route, server tests.
186	
187	- [ ] Add failing real-server tests for immediate headers, per-frame flush, compressing-proxy flush, `drain` handling, client disconnect cleanup, and upstream reader cancellation.
188	- [ ] Add a non-reading consumer test that drives output past 256 frames/1 MiB, observes eviction/resync or socket close, and samples flat runner RSS.
189	- [ ] Implement streaming without `arrayBuffer()`, with Nagle disabled for SSE and bounded subscriber queues independent of the global ring.
190	- [ ] Track open streams so shutdown stops accepts, emits id-bearing `runner.stopping`, gives a bounded flush window, then aborts readers.
191	- [ ] Verify standalone server, event SSE, terminal SSE, and lifecycle graceful-stop tests.
192	
193	### Task 5 — Isolated managed runner and degraded bridge lifecycle
194	
195	**Files:** new `src/server/runner/*`, `scripts/runner.ts`, extracted pieces from `scripts/dev.ts`, `src/instrumentation.ts`, runner/lifecycle tests.
196	
197	- [ ] Add failing controller tests for adopt, spawn, missing runtime, unhealthy bridge, lock contention, child crash, retry/backoff, ownership-aware shutdown, and explicit instance roots/ports/lockfiles.
198	- [ ] Add failing runner tests proving bridge failure does not prevent health/API/bootstrap, while bind conflict and invalid auth/static configuration fail fast with typed events/errors.
199	- [ ] Implement `ManagedBridgeController` and `RunnerReadinessManager` as Manager-owned state machines; no silent returns/catches.
200	- [ ] Implement `scripts/runner.ts` boot order and isolated gateway port-0 strategy for tests.
201	- [ ] Implement ordered shutdown for HTTP/SSE, PTYs, gateway, and owned/adopted bridge.
202	- [ ] Emit all bridge/runner/error events specified by the design; static-UI events belong to Task 9.
203	- [ ] Point `scripts/start.ts`, controller scripts, and lifecycle subprocess harness at the runner.
204	- [ ] Verify runner unit tests and `pnpm test:lifecycle`; clean all test roots/processes.
205	
206	### Task 6 — Portable route registry, health, and terminal replay contract
207	
208	**Files:** `src/runtime/http/routes/index.ts`, all route modules, `src/runtime/http/server.ts`, `tests/runtime/route-contract-fixture.ts`, `tests/runtime/fixtures/routes.v1.json`, terminal route/tests.
209	
210	- [ ] Generate a checked-in route-contract fixture from the current 49 Next route handlers and 63 registered standalone routes. Add a table-driven `tests/runtime/next-standalone-route-parity.test.ts` that executes every registry route through both adapters against separate per-adapter data/database roots and compares status, normalized headers (including `Set-Cookie` values/security semantics), and body semantics.
211	- [ ] Add parity cases for multipart upload and every SSE endpoint. Compare a bounded normalized frame sequence, abort both clients, and assert subscriber/readers are cleaned up.
212	- [ ] Add failing tests for minimal cross-origin `/api/healthz`, authenticated bootstrap while the bridge is degraded, API 404 behavior, and exactly one response per request.
213	- [ ] Test whether a terminal attach receives bounded scrollback before live output. If it does not, add a failing contract test and implement a size-bounded server replay window before client work begins.
214	- [ ] Move any remaining route-only logic out of `src/app/api/**` into portable route/service modules, with Next handlers temporarily delegating to them.
215	- [ ] Make route registration metadata drive `OPTIONS`, auth, and the contract fixture rather than maintaining parallel lists.
216	- [ ] Verify route parity, health, terminal replay, and lifecycle tests before changing the interface build.
217	
218	### Task 7 — Transport-neutral Runtime APIs
219	
220	**Files:** `src/runtime-api/request.ts`, `stream.ts`, `domains/*.ts`, `types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`, adapter contract tests.
221	
222	- [ ] Inventory every existing API/SSE call in a checked-in `docs/architecture/runtime-api-migration-inventory.md`, mapping each call site to its target domain method; update `common-runtime-multi-surface.md` from the same inventory. Add failing compile/runtime tests for typed request, abort, redirect refusal, error normalization, stream frames, and all domain methods.
223	- [ ] Define one `RuntimeAPIs` surface with domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
224	- [ ] Implement the web adapter with injectable `fetch`/stream creation and no direct global network access in shared consumers.
225	- [ ] Keep Electron and VSCode adapters behaviorally compatible while their host transports are replaced later.
226	- [ ] Run identical adapter contract tests against web and fake validated host transports.
227	
228	### Task 8 — Vite interface scaffold and selected shadcn blocks
229	
230	**Files:** `apps/interface/**`, `components.json`, `package.json`, `pnpm-lock.yaml`, interface build/import tests.
231	
232	- [ ] Add failing build tests requiring browser and packaged Vite outputs, correct aliases, no Node/server modules, and a mountable `app-shell.html`.
233	- [ ] Add Vite, React plugin, split build scripts, and interface HTML/entry files. Keep the existing interface rendering through `src/ui/render-web.tsx`.
234	- [ ] Run `pnpm dlx shadcn@latest add sidebar-07` and `pnpm dlx shadcn@latest add login-03`; record the generated files and run build/typecheck before adapting either block.
235	- [ ] Keep the generated primitives, tokens, and dependency additions; remove only demo-page wiring that conflicts with the real app.
236	- [ ] Add a Vite backstop test that fails if an interface chunk contains `src/server`, `src/runtime/http`, `node:*`, or a server-only package.
237	- [ ] Verify both Vite targets, interface typecheck, and the existing component test suite.
238	
239	### Task 9 — Static interface serving, bootstrap, and security headers
240	
241	**Files:** `src/runtime/http/static-files.ts`, `bootstrap-html.ts`, `security-headers.ts`, `vite-csp-manifest.ts`, `src/runtime/http/server.ts`, static/CSP tests.
242	
243	- [ ] Add failing tests for SPA fallback, API/asset 404s, cache headers, traversal/symlink rejection, escaped bootstrap data, malformed/missing CSP manifest, and exactly one `runner.static_ui_enabled` or `runner.static_ui_missing` boot event.
244	- [ ] Preserve deep links: add failing tests for `/session/<uuid>` and `/session/<12-hex>` resolving to the same selected run as `/?run=`, then parse the path into bootstrap and make the interface entry use `location.pathname` when `?run=` is absent. Keep `?project=` and legacy `?pair=` bootstrap behavior intact.
245	- [ ] Add failing CSP tests for no third-party scripts, web versus packaged `connect-src`, `frame-ancestors`, `base-uri`, referrer policy, and an approved theme-script hash.
246	- [ ] Serve the built interface without buffering and validate `csp-manifest.json` at startup.
247	- [ ] Ship Trusted Types in `Content-Security-Policy-Report-Only`; exercise xterm, Markdown, highlighting, and dialogs. Enforce it only if those paths pass with the application policy, otherwise document the narrow exception and keep the report-only test as a release gate.
248	- [ ] Add `--static-dir`, `--no-static`, and clear fail-fast configuration behavior to runner CLI/config.
249	- [ ] Verify static-server, CSP, runner-startup, and packaged-interface tests.
250	
251	### Task 10 — PWA application shell and offline behavior
252	
253	**Files:** `apps/interface/app-shell.html`, `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js`, PWA tests; old `public/` copies at cutover.
254	
255	- [ ] Add failing tests that the manifest starts at the mountable app shell, same-origin app assets are cached, runner API/SSE requests are always network pass-through, and no bearer/session response enters Cache Storage.
256	- [ ] Implement install/update/activate logic with versioned static caches and deterministic cleanup.
257	- [ ] Render the normal shared interface offline with runner profiles and honest stale/offline states instead of a separate dead-end page.
258	- [ ] Verify offline launch, online recovery, update activation, and multi-origin pass-through in Playwright.
259	
260	### Task 11 — Vite cutover and removal of Next
261	
262	**Files:** `package.json`, configs, scripts, `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/instrumentation.ts`, old PWA files, `AGENTS.md`, `playwright.live.config.ts`, `tests/e2e/live/{auth,auth.test,safety.test,playwright-live-config.test}.ts`, `tests/runtime-api/web-runtime-api.test.ts`, `tests/server/restart-control.test.ts`, `tests/electron/runtime-shell.test.ts`, `tests/vscode/bridge.test.ts`, `apps/vscode/package.json`, `scripts/dev-compression-proxy.ts`.
263	
264	- [ ] Add a failing cutover test that rejects `next`, `.next`, Next route ownership, and Next-only environment assumptions.
265	- [ ] Make `dev`, `build`, `start`, local-size measurement, and port cleanup use the runner plus Vite.
266	- [ ] Grep-audit every `3035` reference outside `docs/codex-history/**`, update or retire each source/script/config/doc/test reference, and add a test asserting no non-archival reference remains.
267	- [ ] Re-run the whole-process measurement and enforce the calibrated `<2 GB` development and `<1 GB` production-runner thresholds; a miss blocks cutover.
268	- [ ] Run `tests/runtime/next-standalone-route-parity.test.ts`, packaged-interface e2e, PWA, lint, all typechecks, unit tests, lifecycle tests, and production build.
269	- [ ] Only after those gates pass, print the exact approved deletion list and remove only the explicitly enumerated Next files/dependencies and old Vite-replaced PWA copies. The user's instruction to fully implement this plan authorizes that exact list; any added deletion requires fresh confirmation.
270	- [ ] Re-run the full cutover matrix and confirm local development has one runner process tree and no hidden second server.
271	
272	### Task 11A — Move the interface out of `src/app`
273	
274	**Files:** `src/app/home/**` → `src/interface/home/**`; `src/app/providers.tsx` → `src/interface/providers.tsx`; app styles/assets → `src/interface/styles/**` or `apps/interface/**`; affected imports/tests.
275	
276	- [ ] Add a failing architecture test that no shared interface entry imports from or lives under the Next-owned `src/app` tree.
277	- [ ] Move `home/**` and `providers.tsx` with import-path-only changes; move `globals.css`, `fx.css`, `fx/`, `fx-spike/`, and `favicon.ico` under Vite-owned interface paths and import them from `apps/interface/src/main.tsx`.
278	- [ ] Repoint `tests/app/**` imports without changing test behavior or creating a second test suite.
279	- [ ] Verify interface typecheck, unit tests, visual CSS smoke tests, and the Vite build before any behavior work resumes.
280	
281	### Task 11B — Keep Electron working through the Vite cutover
282	
283	**Files:** `apps/electron/main.ts`, `apps/electron/scripts/build.mjs`, Electron bootstrap/migration helper, Electron tests.
284	
285	- [ ] Add failing tests that the transitional Electron shell loads `dist/interface`, keeps its current local `startOmniServer` transport, and does not build a second renderer artifact or inline HTML.
286	- [ ] Before changing renderer origin, export legacy localStorage preferences and drafts from the current renderer origin into an atomic versioned payload under Electron `userData`; test success, retry, corrupt payload, and idempotence.
287	- [ ] Point the shell at the Vite production artifact and remove the old esbuild renderer pipeline while leaving remote-only conversion for Task 22.
288	- [ ] Verify Electron build and current desktop journeys at the M2 boundary.
289	
290	### Task 12 — Migrate direct network consumers and split oversized owners
291	
292	**Files:** every call site in `docs/architecture/runtime-api-migration-inventory.md`; `src/interface/home/mutations/*.ts`; `src/components/terminal/*`; `HomeApp.tsx`; query/Manager files.
293	
294	- [ ] Add failing architecture tests that reject direct `fetch`, `EventSource`, absolute API construction, or transport-specific IPC outside runtime adapters.
295	- [ ] Split `useHomeMutations.ts`, `HomeApp.tsx`, and `Terminal.tsx` into focused Manager/domain/render modules before adding runner behavior; preserve the user's current `Terminal.tsx` changes.
296	- [ ] Move each mutation/query/stream consumer to `RuntimeAPIs`; preserve abort, optimistic update, and server-authority behavior with focused tests.
297	- [ ] Replace terminal stream ownership only after the bounded replay contract from Task 6 is proven.
298	- [ ] Keep all shared domain state in Manager classes and verify narrow subscriptions for high-churn terminal/draft/cursor state.
299	- [ ] Verify migrated consumer tests, interface boundary tests, typechecks, and current end-to-end journeys.
300	
301	### Task 13 — Runner identity, compatibility, capabilities, and auth persistence
302	
303	**Files:** `src/shared/bootstrap.ts`, `api-revision.ts`, `src/server/db/schema.ts`, migrations, bootstrap route, session/auth tests.
304	
305	- [ ] Add failing migration tests for durable `runnerInstanceId`, session kind/origin/device metadata, idle/absolute expiry, last-used throttling, and existing database upgrades.
306	- [ ] Add failing contract tests for `current`/`minimum` revisions, declared additive-capability versus transport-breaking changes, unknown additive capabilities, and undeclared fixture diffs.
307	- [ ] Persist runner identity once per data root and return identity, revision window, capability ids, display name, bridge/readiness state, and stream epoch from bootstrap.
308	- [ ] Implement API-change classification in `src/shared/api-revision.ts` and make route fixture diffs fail unless declared.
309	- [ ] Verify clean and upgraded databases, bootstrap schema, revision compatibility, and identity stability across restart.
310	
311	### Task 14 — Password login, native-session rules, CORS, proxy trust, and TLS policy
312	
313	**Files:** `src/server/auth/{config,password,session,guards,rate-limit,audit,cors,trusted-proxy}.ts`, login/health routes, runner config, auth/security tests.
314	
315	- [ ] Add failing tests for cookie login, originless native bearer login, rejection when native login carries `Origin`, `Referer`, or fetch-metadata headers, later native-session origin rejection, and password never being returned or stored.
316	- [ ] Add failing CORS tests for exact stored browser origin, `Vary: Origin`, error responses, registry-driven preflight, cookie-route exclusion, and `Access-Control-Allow-Credentials` never appearing.
317	- [ ] Add failing tests for socket-derived client/protocol identity, explicitly configured trusted proxies, plaintext non-loopback refusal, and loopback development allowance.
318	- [ ] Implement one rate-limit/audit path shared by password and browser authorization entry points.
319	- [ ] Define native TLS behavior: standard platform trust first; a per-profile SPKI pin may be used only after trust failure, requires explicit fingerprint confirmation, and requires explicit re-pin on change.
320	- [ ] Verify auth, CORS, proxy-spoofing, TLS-policy, and lifecycle tests.
321	
322	### Task 15 — Browser approval with S256 PKCE
323	
324	**Files:** `src/server/auth/browser-authorization.ts`, authorization routes, `src/interface/auth/InterfaceAuthorizationScreen.tsx`, web adapter, locales, auth/e2e tests.
325	
326	- [ ] Add failing tests for S256-only verifier/challenge length and alphabet, exact HTTPS or loopback-HTTP requesting origin, user gesture, state binding, 60-second expiry, atomic single use, origin binding, and no code/token logging.
327	- [ ] Add failing browser tests for popup success, blocked popup, user denial, timeout, wrong origin/state, replay, opener loss with platform return link, and reauthorization.
328	- [ ] Implement the target runner's same-origin approval page using the existing password session and localized copy in every locale.
329	- [ ] Exchange the code only for the bound origin and persist the resulting browser bearer session, never the password or PKCE verifier.
330	- [ ] Verify password-login routes still have no cross-origin support and the complete two-origin PKCE journey passes.
331	
332	### Task 16 — Stream tickets and cross-origin streams
333	
334	**Files:** `src/server/auth/stream-tickets.ts`, ticket route, events/terminal routes, web stream adapter, stream/auth tests.
335	
336	- [ ] Add failing tests for 60-second expiry, atomic single use, exact session/path/origin binding, fresh ticket per reconnect, ticket redaction, and session revalidation at redemption.
337	- [ ] Add a real cross-origin `EventSource` test requiring `Access-Control-Allow-Origin: <boundOrigin>` and `Vary: Origin` on the successful ticketed 200 response.
338	- [ ] Implement ticket issuance/redemption for main and terminal streams; keep cursor separate and non-secret.
339	- [ ] Make the web adapter close native `EventSource` retry, request a fresh ticket, and reconnect under `RunnerConnection` control.
340	- [ ] Verify cross-origin main/terminal streaming, restart/resync, session revocation, and no credential leakage in logs.
341	
342	### Task 17 — Session administration, password rotation, runner naming, and CLI
343	
344	**Files:** sessions/settings routes, auth modules, `src/server/cli/*`, `scripts/auth-password.mjs`, CLI/session tests.
345	
346	- [ ] Add failing tests for 30-day idle/90-day absolute browser sessions, 90-day idle/365-day absolute native sessions, at-most-once-per-minute touch, maximum 50 active sessions, and successful-login LRU eviction excluding the new session.
347	- [ ] Add failing list/current/revoke/revoke-all tests, including immediate stream/mutation invalidation and stable audit/named events.
348	- [ ] Implement remote CLI flags for runner URL/password or stored native-style session; keep local administrative paths explicit.
349	- [ ] Make password rotation revoke all sessions by default, with an explicit audited `--keep-sessions` override.
350	- [ ] Add authenticated runner rename with validation, audit/event emission, and bootstrap propagation.
351	- [ ] Verify API, CLI, lifecycle, and concurrent-session tests.
352	
353	### Task 18 — Profile and credential stores
354	
355	**Files:** `src/interface/runners/{RunnerProfile,RunnerProfileStore,RunnerCredentialStore}.ts`, web implementations, migration/store tests.
356	
357	- [ ] Add failing tests for versioned profile migrations, pre-login profile UUID scope, post-login `runnerInstanceId` rekey, duplicate identity merge, URL edits, forget behavior, and per-runner preferences/drafts/cursors.
358	- [ ] Implement profile metadata persistence separately from credentials; expose credential handles, never raw secrets, to interface Managers.
359	- [ ] Implement web profile storage and browser bearer storage with exact-origin/identity checks and explicit clearing on forget/revocation.
360	- [ ] Add collision and identity-mismatch recovery states without silently replacing trusted identity.
361	- [ ] Verify restart, migration, failed-write, partial-profile, and store-isolation tests.
362	
363	### Task 19 — Concurrent RunnerConnection and RunnerRegistry Managers
364	
365	**Files:** `src/interface/runners/{RunnerConnection,RunnerRegistry,RunnerRegistryProvider}.ts(x)`, existing stream/cache/notification Managers, runner-state tests.
366	
367	- [ ] Add failing state-machine tests for connecting, online, offline, deferred, needs-reauth, TLS-untrusted, identity-mismatch, incompatible, degraded/resync, and runner-stopping.
368	- [ ] Add race tests for stale responses after runner switch, delete/re-add, auth replacement, delayed bootstrap, reconnect timers, and mutation completion.
369	- [ ] Add failing tests that cursors persist per durable `runnerInstanceId`, clear on resync or trusted-identity change, and more than three resyncs within five minutes enter degraded jittered backoff.
370	- [ ] Implement one live main stream per authenticated profile, runner-scoped Query clients/keys, jittered exponential retry capped at five minutes, and the resync anti-storm governor.
371	- [ ] Keep only the active runner's terminal streams; detach on switch and request bounded scrollback on reactivation.
372	- [ ] Bound per-runner preview caches and global LRU memory while keeping persisted drafts/cursors authoritative to their store.
373	- [ ] Verify switching does not close inactive main streams or cancel their mutations and all manager subscriptions remain narrow.
374	
375	### Task 20 — Runner switcher, connect flow, sessions UI, notifications, and i18n
376	
377	**Files:** runner UI components, shared shell/home components, notification Manager, all nine `shared/locales/*.json`, UI/accessibility tests.
378	
379	- [ ] Add failing UI tests for first-run onboarding, add/edit/forget, active switching, status labels, reauth, TLS confirm/re-pin, identity mismatch, incompatibility, deferred runner, session revoke, and runner rename.
380	- [ ] Adapt the installed `sidebar-07` block into the persistent runner switcher and `login-03` into connect/authorize screens while retaining existing OmniHarness visual language.
381	- [ ] Keep runner-switcher controls hidden in the transitional Electron shell until Task 22 enables the remote-only host.
382	- [ ] Render one workspace at a time; make inactive runner activity visible through bounded counts and runner-named notifications.
383	- [ ] Add every new string to all nine locale files and use `useI18nSnapshot()` + `t()` at render boundaries.
384	- [ ] Verify keyboard navigation, focus restoration, screen-reader labels, reduced motion, narrow desktop/mobile widths, and live language switching.
385	
386	### Task 21 — Web/PWA two-runner and scale acceptance
387	
388	**Files:** `tests/e2e/multi-runner*.spec.ts`, fixtures/runner harness, memory scripts, Playwright config.
389	
390	- [ ] Start two isolated real runners on port 0 with distinct roots/passwords/identities and the packaged Vite artifact; do not reuse production/user data.
391	- [ ] Test add/login/PKCE, both live streams, active switching, inactive mutation completion, terminal detach/replay, offline/restart/epoch resync, revoke/reauth, identity mismatch, and PWA recovery.
392	- [ ] Run an eight-runner benchmark with all main streams live and bounded activity; require less than 40 MB incremental client memory per added idle runner and less than 750 MB aggregate under the specified workload.
393	- [ ] Run one runner at the declared `minimum` API revision and one at `current`; keep both connected, hide only unsupported additive capabilities with an explanation, and block only transport-breaking incompatibility.
394	- [ ] Assert retry jitter, deferred/background status when the platform limits sockets, and no uncaught browser errors or secret-bearing logs.
395	- [ ] Clean all test sessions, databases, processes, and generated run artifacts.
396	
397	### Task 22 — Remote-only Electron host and migration
398	
399	**Files:** `apps/electron/{main,preload,scripts/build,package}.ts/json/mjs`, new Electron store/bridge/TLS/migration modules, Electron tests/docs.
400	
401	- [ ] Add failing tests proving Electron never imports or starts the runner, renderer network access to runners is blocked, and IPC contracts validate every request/response/frame.
402	- [ ] Implement remote HTTP/SSE in the main process, `safeStorage` credential persistence, per-profile SPKI confirmation/re-pin, bounded stream delivery, and renderer-safe error objects.
403	- [ ] Import the versioned legacy preferences/drafts payload exported in Task 11B, then add an explicit path to profile the former embedded runtime as a local or remote runner; never silently abandon existing data.
404	- [ ] Test app restart, multiple runners, offline/reconnect, revoke, deep links, notifications, migration success/failure/rollback, and packaged CSP.
405	- [ ] Build and smoke-test the signed-development/unsigned-local package supported by the host environment.
406	
407	### Task 23 — VSCode remote runner client
408	
409	**Files:** `apps/vscode/src/extension.ts`, `webview/main.tsx`, `src/vscode-extension/bridge.ts`, VSCode manifest/docs/tests.
410	
411	- [ ] Add failing bridge tests for all-profile connection ownership, bearer-only host networking, validated messages, stream reconnect/cursor behavior, and renderer token isolation.
412	- [ ] Store sessions only in `ExtensionContext.secrets`; migrate and clear the current plain setting without logging its value.
413	- [ ] Implement the same profile/status/switching/session flows through the shared interface and VSCode host adapter.
414	- [ ] Verify multi-runner restart/reload, revoke/reauth, identity mismatch, notifications, and extension build/package.
415	
416	### Task 24 — Capacitor iOS and Android hosts
417	
418	**Files:** `apps/mobile/**`, `src/runtime-api/capacitor.ts`, root workspace/scripts, mobile/native contract tests.
419	
420	- [ ] Add Capacitor packages/config and generate committed iOS/Android source projects; add only `packages: ["apps/mobile"]` to `pnpm-workspace.yaml` (never an `apps/*` glob), keep generated build/signing/cache output ignored, and prove Electron/VSCode builds are unchanged by workspace membership.
421	- [ ] Point `capacitor.config.ts` `webDir` at the single `../../dist/interface` artifact. Add iOS `NSLocalNetworkUsageDescription` with strict ATS outside loopback development, and Android `usesCleartextTraffic=false` with a debug-only loopback network-security configuration; assert release builds never bypass certificate checks.
422	- [ ] Add failing JavaScript/native contract tests for request, abort, SSE frames, bounded queues, credential handles, TLS trust failure, explicit pin/re-pin, deep links, lifecycle suspension/resume, and notifications.
423	- [ ] Implement iOS networking/SSE with `URLSession`, secrets with Keychain Services, per-profile trust/pinning, links, and local notifications in a custom Capacitor plugin.
424	- [ ] Implement Android networking/SSE with OkHttp, encrypted token material backed by Android Keystore, per-profile trust/pinning, links, and local notifications in the matching plugin.
425	- [ ] Keep bearer tokens inside native code and block direct WebView runner networking with packaged CSP.
426	- [ ] Implement all-profile connections while active; when the OS suspends the app, persist cursors and reconnect/resync honestly on resume—no v1 push guarantee.
427	- [ ] Run native unit/contract tests, `cap sync`, Android debug build/tests, and iOS simulator no-sign build/tests on the available host.
428	
429	### Task 25 — Security, deployment, migration, and operator documentation
430	
431	**Files:** `README.md`, `.env.example`, app READMEs, architecture/lifecycle docs, new deployment/TLS/session/migration docs.
432	
433	- [ ] Document the logical runner/process model, bridge-degraded behavior, static/no-static modes, ports/locks/data roots, TLS requirements, trusted proxy configuration, and backup/restore.
434	- [ ] Document password login, browser approval, session TTL/list/revoke, password rotation, URL changes, identity mismatch, SPKI confirmation/re-pin, and credential-storage boundaries.
435	- [ ] Document Electron migration, VSCode secret migration, mobile build/signing prerequisites, PWA offline limits, platform socket/suspension limits, and v1 non-goals.
436	- [ ] Add copy-paste smoke commands that use temporary roots and never expose passwords in process listings or logs.
437	- [ ] Validate every documented command in a disposable test environment.
438	
439	### Task 26 — Full verification, security review, and clean handoff
440	
441	**Files:** all changed files and generated contract/build reports; no new product behavior.
442	
443	- [ ] Run targeted suites after each task, then final `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:lifecycle`, `pnpm build`, and `pnpm test:e2e`.
444	- [ ] Run runner route/static/security tests, two-runner and eight-runner suites, Electron build/tests, VSCode build/tests, Capacitor contract/sync, Android build/tests, and iOS simulator build/tests.
445	- [ ] Inspect logs/event ring for silent decisions, missing `error.surfaced`, missing SSE ids, leaked passwords/tokens/tickets/codes, CORS credentials, and unbounded subscriber/cache growth.
446	- [ ] Compare the final route fixture and API revision declaration; require every contract change to be additive-capability or transport-breaking-revision classified.
447	- [ ] Confirm Next/server code is absent from interface artifacts, native renderers cannot directly reach runners, and all credentials survive/revoke only through platform-secure stores.
448	- [ ] Clean only test-created sessions, roots, databases, processes, and build artifacts covered by test cleanup; preserve all user-owned files and pre-existing changes.
449	- [ ] Record exact command results, platform limitations if a required native toolchain is unavailable, and any explicitly documented Trusted Types exception before claiming completion.
450	

uuid: 3c4d27ce-78b4-45f3-b182-0a00247107d0
parent: a550ee62-50fb-4cc2-84e7-3c9ab49f1937
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:30:34.116Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:30:34.116Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/specs/2026-07-29-interface-runner-split-design.md"
}

uuid: 1c75aadc-525e-4fd2-99d7-85262e62e70a
parent: 3c4d27ce-78b4-45f3-b182-0a00247107d0
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:30:34.331Z","phase":null} -->
## Claude tool result: toolu_01E6Ej9aKC7FsMzLQRE4BeYn · 2026-07-30T22:30:34.331Z

````text
1	# Interface / Runner Split — Design
2	
3	Date: 2026-07-29
4	Status: Approved direction; hardened for implementation on 2026-07-30
5	
6	## 1. Goal
7	
8	Split OmniHarness into two independently runnable pieces:
9	
10	- **Runner** — one logical headless service that owns all domain state and processes:
11	  SQLite, supervisor, agent-runtime bridge, PTY terminals, SSE event stream, auth.
12	  No Next.js. Serves only data (plus the static interface bundle for the web/PWA
13	  path). A runner deployment is managed as one unit even though the API server
14	  and ACP bridge remain separate co-located processes internally.
15	- **Interface** — a self-contained static React SPA (Vite build) that connects to
16	  one or more runners over HTTP + SSE. Ships as: web page served by any runner,
17	  installable PWA, Electron desktop app (macOS/Windows/Linux), Capacitor native
18	  apps (iOS/Android), and the existing VSCode shell. Every installed client can
19	  save any number of runners and keeps all authenticated profiles connected
20	  while the app process is active.
21	
22	Motivations, in priority order:
23	
24	1. Interface installable on a phone/laptop connecting to **multiple remote
25	   runners**.
26	2. Backend runs as a lean process that does not also host a frontend toolchain
27	   (Next dev today balloons to 8 GB+ RSS).
28	3. Web version keeps working exactly as it does now (same URL shape, same UI).
29	
30	## 2. Decisions already made (user-confirmed)
31	
32	| Decision | Choice |
33	|---|---|
34	| Next.js | **Remove.** Interface becomes a Vite SPA; runner serves the built bundle and injects the bootstrap JSON into `index.html` at serve time (preserves today's zero-round-trip boot; verified that the app tree is `ssr:false` and SSR only emits the BootShell skeleton + bootstrap blob). |
35	| Native shells v1 | **Electron desktop** (existing `apps/electron`, converted to a pure remote client) plus **Capacitor iOS/Android** (`apps/mobile`, sharing the Vite bundle). PWA and VSCode remain supported. Tauri is out of scope. |
36	| Multi-runner UI v1 | **Runner switcher with concurrent connections**: save N runner profiles; keep every authenticated profile connected while the app is active; show one runner's workspace at a time. Merged cross-runner views remain out of scope. |
37	| Backend topology | **Keep two services** as today: the omni API server and the agent-runtime bridge (port 7800) stay separate processes. Clients only ever talk to the API server; the bridge keeps binding to localhost by default (`OMNIHARNESS_AGENT_RUNTIME_HOST`). A "runner" deployment = both processes co-located on one machine sharing one filesystem, managed by one start script. |
38	| Authentication v1 | **One shared runner password.** Cookie clients and bearer clients use the same password login. Login creates a separately revocable session token; clients never store the password. Pairing tokens and QR authentication are not required by the new client flow. |
39	
40	## 3. Verified current state (what we build on)
41	
42	The split is substantially pre-architected:
43	
44	- **Portable route registry**: `src/runtime/http/routes/index.ts` registers all 63
45	  method+path pairs framework-free (Fetch Request/Response). All 49 Next API
46	  routes are thin adapters over it.
47	- **Standalone server**: `src/runtime/http/server.ts` (`startOmniServer`) exists,
48	  with `staticDir` support — but cannot stream (buffers `arrayBuffer()`), so the
49	  two SSE endpoints (`/api/events`, `/api/terminals/:id/stream`) do not work
50	  through it yet.
51	- **Electron already uses the standalone server**, not Next:
52	  `apps/electron/src/runtime.ts` calls `startOmniServer`. The M2 transitional
53	  shell therefore survives Next removal; M6 changes ownership/networking, not
54	  its dependency on Next.
55	- **Client transport abstraction**: `src/runtime-api/` (`RuntimeAPIs` interface;
56	  `web.ts` already takes `baseUrl` + injectable `fetch`/`EventSource`).
57	- **Non-Next entry**: `src/ui/render-web.tsx` mounts `<OmniApp>` without Next.
58	- **Bootstrap over HTTP**: `GET /api/runtime/bootstrap` already mirrors the SSR
59	  bootstrap for Electron/VSCode.
60	- **Transports**: HTTP JSON + SSE only. No WebSockets, no server actions, no tRPC.
61	
62	Known debts that gate the split (from exploration):
63	
64	- **(B) Streaming**: standalone server buffers responses; SSE endpoints hang.
65	- **(C) Auth**: cookie + `SameSite=Lax` + `enforceSameOrigin` on all mutations +
66	  zero CORS headers → a cross-origin interface cannot authenticate.
67	- **(D) Runner identity**: `RuntimeAPIs` is a flat singleton; managers, SSE
68	  cursor, and query caches assume "the one server".
69	- **(H) 29 call sites** still hardcode `fetch('/api/...')`/`new EventSource('/api/...')`
70	  instead of going through `RuntimeAPIs` (list in
71	  `docs/architecture/common-runtime-multi-surface.md` §"debt").
72	- **(G) Client→server imports**: `src/server/workers/entries-types.ts` (types),
73	  `src/server/planning/review-preferences.ts` (runtime zod import) are imported
74	  by client components.
75	- **(A) Same-process event bus**: `src/server/events/named-events.ts` ring +
76	  `live-updates.ts` listener set are module-level memory → the API server must
77	  remain a single process. This is accepted and documented, not changed.
78	
79	## 4. Target architecture
80	
81	### 4.1 Repository shape (Approach A — in-place, two build targets)
82	
83	Stay one pnpm package for now. Two build targets with an enforced boundary,
84	no mass file moves:
85	
86	```
87	src/server/       → runner only (never bundled into interface)
88	src/runtime/      → runner only (HTTP registry, standalone server, bootstrap)
89	src/shared/       → NEW: types + pure logic importable by both sides
90	src/lib/          → interface-leaning isomorphic helpers (already clean)
91	src/runtime-api/  → interface transport layer (multi-runner aware)
92	src/ui/, src/components/, src/interface/home/ → interface
93	apps/interface/   → NEW: Vite app (index.html, vite.config.ts, entry that
94	                    reuses src/ui/render-web.tsx)
95	apps/electron/    → existing shell, becomes pure remote client
96	apps/mobile/      → NEW: Capacitor shell with iOS + Android native projects
97	apps/vscode/      → behavior unchanged; port/auth wiring updated
98	scripts/runner.ts → NEW: runner entrypoint (replaces Next start for backend)
99	```
100	
101	`src/app/` (Next) is deleted at the end of Milestone 2; `src/app/home/` is
102	interface code and moves to `src/interface/home/` (import-path rename only) so
103	the `src/app` deletion is clean.
104	
105	Boundary enforcement:
106	- ESLint `no-restricted-imports`: anything bundled by Vite may not import
107	  `@/server/*` or `@/runtime/*` (only `@/shared/*`).
108	- The two offending imports (G) move: `entries-types.ts` and
109	  `review-preferences.ts` → `src/shared/`, with re-export shims left at the old
110	  paths for server-side importers.
111	- Vite build failing on a server import is the backstop.
112	- Typechecking is split: separate `tsc --noEmit` projects for runner
113	  (`src/server` + `src/runtime`), shared, and interface, so a server-only type
114	  error can't hide in the SPA project and vice versa.
115	
116	**Production artifact contract** (what a headless box installs):
117	- `pnpm build` → `dist/interface/` (hashed static assets + `index.html`
118	  template). The runner itself keeps running from source via `tsx`
119	  (existing convention in `scripts/start.ts`); no Vite, Next, or watcher runs
120	  in production.
121	- Runner with `dist/interface` present → serves SPA + API. Absent → **API-only
122	  mode**: `/` returns a plain informational page, a named event
123	  `runner.static_ui_missing` is emitted, and everything else works (this is a
124	  supported deployment, not an error). If `--static-dir` is passed explicitly
125	  and missing, startup fails loudly.
126	  Exactly one of `runner.static_ui_enabled` or `runner.static_ui_missing`
127	  emits once during boot.
128	- `pnpm electron:build` packages that same interface bundle in Electron.
129	  `pnpm mobile:sync`, `pnpm mobile:build:ios`, and
130	  `pnpm mobile:build:android` synchronize and build the Capacitor projects.
131	  Native generated outputs, signing material, and local SDK state remain
132	  ignored; native project source and configuration are versioned.
133	- Memory acceptance: measured via `scripts/measure-local-dev.mjs` over the
134	  **whole process tree** (API process, bridge, gateway children, plus
135	  Vite/watchers in dev) — dev combined RSS **< 2 GB**, production runner
136	  **< 1 GB** — recording both peak and end-of-workload RSS after a scripted
137	  deterministic 10-minute fixture-agent conversation workload (no live model
138	  or network dependency). M1 records the current baseline; M2 enforces the
139	  calibrated thresholds. A controlled local benchmark gate, not a CI-hardware
140	  assertion. (Today's Next dev process alone exceeds 8 GB.)
141	
142	**Rejected alternatives**:
143	- *Approach B — full monorepo package extraction* (`packages/shared|runner|interface`):
144	  cleaner end state but moves ~460 files, breaks every open branch, buys
145	  nothing functional now. Revisit after the split is proven.
146	- *Approach C — keep Next as frontend host*: rejected by user (RAM, second
147	  pipeline).
148	
149	### 4.2 Runner
150	
151	**Entrypoint** `scripts/runner.ts`:
152	1. `await dbReady` (schema init).
153	2. Start supervisor watchdog (`ensureSupervisorRuntimeStarted()`).
154	3. Start Claude model gateway (`ensureClaudeModelGatewayStartedAtBoot()` + shutdown hooks).
155	4. Start/adopt the bridge through an extracted `ManagedBridgeController`
156	   (lockfile, health checks, build/install, retry, ownership). Unlike today's
157	   `scripts/dev.ts`, initial bridge failure is non-fatal: the controller enters
158	   `starting`/`unavailable`, retries with bounded exponential backoff, and emits
159	   lifecycle events while the API remains available.
160	5. `startOmniServer({ staticDir, port })` — one HTTP port for API + SSE + SPA.
161	
162	This replaces `src/instrumentation.ts` (deleted with Next).
163	
164	**Lifecycle contract**:
165	- `GET /api/healthz` (liveness, no auth, no state) and readiness reflected in
166	  the existing bootstrap route. Bridge unavailable at boot → runner starts,
167	  serves UI/API, reports `bridge: "starting" | "unavailable"` in bootstrap and
168	  emits `runner.bridge_unavailable`; bridge crash → existing supervisor
169	  sync/retry behavior, surfaced as named events (`runner.bridge_ready` on
170	  (re)connect). Port conflict → fail fast; the owning pid is reported
171	  best-effort via the runner's own lockfile (bridge-lock pattern), since bind
172	  errors don't carry it cross-platform. Shutdown order: stop accepting new
173	  connections → send a dedicated `runner.stopping` frame to open SSE streams
174	  (NOT `stream.resync_required`, which would trigger snapshot reloads against
175	  a dying server; clients show "runner stopping" and back off) → bounded
176	  flush window, then abort remaining readers → PTYs get SIGTERM with a
177	  deadline, then SIGKILL → gateway child likewise → bridge: terminated if
178	  this runner spawned it, released (lock only) if adopted.
179	- Runner and bridge configuration is instance-scoped: API port, bridge URL/
180	  port, bridge lockfile, gateway settings, database, and data root are explicit
181	  inputs derived from `OMNIHARNESS_ROOT`/`OMNIHARNESS_INSTANCE`. This lets the
182	  two-runner test start isolated deployments on one host without shared
183	  lockfiles or ports.
184	  Managed gateway instances bind port `0` in isolated tests and publish their
185	  chosen loopback URL into that runner's environment; production keeps the
186	  configured gateway URL. No test relies on the default gateway port.
187	- Every runner process mints a `streamEpoch` at boot. SSE ids are
188	  `<streamEpoch>:<sequence>`, and bootstrap includes the current epoch. A client
189	  reconnecting with another epoch always receives an id-bearing
190	  `stream.resync_required` frame and reboots from a snapshot. All frames,
191	  including `runner.stopping` and resync controls, carry ids; the client
192	  persists their epoch-aware cursor.
193	- A single process-global 15-second `stream.heartbeat` event advances the same
194	  id/ring sequence and is delivered to all subscribers. It is not synthesized
195	  independently per client. The ring holds at least 4096 entries so heartbeats
196	  do not collapse the useful reconnect window. Cursor sequence below the ring
197	  floor deterministically emits an id-bearing `stream.resync_required`.
198	
199	**Streaming fix (prerequisite for everything)**: `writeFetchResponse` in
200	`src/runtime/http/server.ts` pipes `Response.body` (Web `ReadableStream`) to the
201	Node `ServerResponse` chunk-by-chunk, flushes headers immediately, disables
202	Nagle for `text/event-stream`, and destroys the upstream reader on client
203	disconnect. Non-streaming responses keep the buffered path.
204	Each subscriber has a bounded pending queue: at most 256 frames or 1 MiB,
205	whichever comes first. A slow reader never blocks the process-global ring and
206	never buffers without bound. Overflow attempts one id-bearing
207	`stream.resync_required` frame, then destroys the socket if it cannot flush;
208	the client re-bootstraps from a snapshot. Resync carries a stable reason:
209	`epoch_mismatch`, `cursor_evicted`, or `subscriber_overflow`.
210	`subscriber_overflow` also emits a named diagnostic event.
211	
212	**Static serving + bootstrap injection contract**:
213	- `GET /` and `/session/:runId` (the deep-link rewrite from `next.config.ts`)
214	  serve `index.html` with
215	  `<script id="omni-bootstrap" type="application/json">…</script>` injected —
216	  same payload semantics as today's SSR (`includeInitialData: false`). JSON is
217	  serialized with `<`, `>`, `&`, U+2028, U+2029 escaped so it cannot terminate
218	  the script element.
219	- SPA fallback applies only to GET navigations without a file extension that
220	  aren't `/api/*`. `/api/*` and missing assets return proper 404s — never
221	  `index.html`.
222	- Hashed assets: `Cache-Control: public, max-age=31536000, immutable`.
223	  `index.html`: `no-store` (it contains per-request auth state).
224	- Vite emits `dist/interface/csp-manifest.json` containing the approved inline
225	  theme-script hash and asset metadata. The runner validates it at boot; an
226	  explicit static directory with a missing/mismatched manifest fails loudly.
227	- Static file resolution rejects path traversal and does not follow symlinks
228	  out of `staticDir`.
229	- **Frontend security policy** (browser tokens live in `localStorage`, so
230	  same-origin script injection is the main browser threat): interface pages ship a
231	  CSP **as an HTTP header** (meta tags can't enforce `frame-ancestors`) —
232	  `default-src 'self'`, `script-src 'self' 'sha256-<theme-bootstrap-hash>'`,
233	  `style-src`/`font-src`/`img-src`/`worker-src 'self'` (+ `data:`/`blob:`
234	  where the app needs them), `frame-ancestors 'none'`, `object-src 'none'`,
235	  `base-uri 'none'`, `require-trusted-types-for 'script'`, an
236	  application-specific `trusted-types` policy,
237	  `connect-src 'self' https: http://localhost:* http://127.0.0.1:*` (bearer
238	  runners are user-added HTTPS origins; loopback allowed for dev),
239	  `Referrer-Policy: no-referrer`. Because arbitrary user-added HTTPS runners
240	  must be reachable, web `connect-src` cannot prevent exfiltration after a
241	  successful same-origin script compromise; CSP reduces injection probability
242	  but is not token binding. Capacitor/Electron packaged pages use
243	  `connect-src 'self'` because all runner traffic crosses the native host
244	  bridge; direct renderer/WebView fetch to a runner is blocked and tested.
245	  Because xterm, Markdown/highlighting, and other dependencies may still touch
246	  HTML sinks, `require-trusted-types-for 'script'` first ships as
247	  `Content-Security-Policy-Report-Only`. The M2 exit gate is either verified
248	  enforcement with an application policy or a documented, narrowly scoped
249	  exception; it cannot silently remain untested. No third-party scripts, ever.
250	  All
251	  server-provided content (agent output, errors, project paths) renders
252	  through the existing markdown/text pipeline — a test asserts none of it can
253	  introduce executable markup.
254	- The interface reads the inline blob if present, else falls back to
255	  `GET /api/runtime/bootstrap` (Electron / remote / dev / offline-PWA path).
256	- Bootstrap injection is a bounded local read path. It never waits for a bridge
257	  health probe or reconciliation write; bridge readiness comes from the
258	  controller's in-memory read model and is explicitly marked stale/degraded
259	  when necessary.
260	
261	**Ports & processes** (unchanged topology, per user decision):
262	- API server: default 3050 (today's web port), configurable.
263	- Bridge: 7800, localhost-bound by default. Existing `OMNIHARNESS_*` env vars
264	  keep their meanings. The dev compression proxy (3035) is retired with Next
265	  dev; the VSCode default `serverUrl` moves to the runner port.
266	- `scripts/start.ts`, `controller.sh`, `omni.sh` launch the runner instead of
267	  Next.
268	
269	### 4.3 Auth & cross-origin model
270	
271	The runner has one shared password and two session transports against the same
272	`auth_sessions` table and expiry/revocation rules. This is deliberately a
273	single-user trust model: there are no accounts, roles, device pairing secrets,
274	or separate mobile credentials in v1.
275	
276	**Cookie sessions (unchanged)** — for the interface served by the runner itself
277	(web + PWA on that runner's origin). `POST /api/auth/login` verifies the shared
278	password, sets the existing `SameSite=Lax` HttpOnly cookie, and
279	`enforceSameOrigin` remains enabled on mutations. No CORS is involved.
280	
281	**Bearer sessions (new)** — for every cross-origin or native client: an
282	interface hosted by runner A talking to runner B, Electron, Capacitor,
283	VSCode, the Vite dev server, and the CLI.
284	
285	1. **Password login and issuance**: `POST /api/auth/login` accepts
286	   `{"password":"…","tokenTransport":"cookie"|"bearer","clientLabel":"…"}`.
287	   Cookie remains the default for same-origin compatibility. Bearer login
288	   returns one opaque session token in the response body. The password is
289	   verified once and is never persisted by a client; every device/profile gets
290	   a separately revocable session row.
291	
292	   Guards accept `Authorization: Bearer <token>`; same-origin enforcement is
293	   skipped for bearer requests because the credential is not ambient. Session
294	   rows gain stored provenance:
295	
296	   ```ts
297	   transport: "cookie" | "bearer";
298	   boundOrigin: string | null;       // exact browser origin at login
299	   clientKind: "browser" | "native"; // native host made the login request
300	   ```
301	
302	   - A browser bearer session always requires its exact stored `boundOrigin`;
303	     missing, different, or `Origin: null` is rejected and audited as
304	     `auth.bearer_origin_rejected`.
305	   - Electron main, Capacitor native host, VSCode extension host, and CLI use
306	     an originless native login transport and receive
307	     `clientKind: "native", boundOrigin: null`.
308	   - Native login is rejected when `Origin`, `Referer`, or any `Sec-Fetch-*`
309	     header is present. Its response never carries
310	     `Access-Control-Allow-Origin`. A native session is rejected on any later
311	     request that carries `Origin`; these invariants prevent a browser from
312	     requesting or replaying the longer-lived native credential.
313	   - Cookie tokens are never accepted as bearer tokens and bearer tokens are
314	     never accepted as cookies.
315	   - This is browser-origin isolation, not cryptographic token binding. Bearer
316	     tokens remain replayable secrets. DPoP/device keys and multi-user roles are
317	     outside the approved v1 scope.
318	2. **Browser authorization + CORS**: a runner never reflects an arbitrary
319	   origin on the password-login response. That would let any page visited by
320	   the user probe a loopback runner, attempt the shared password, and exfiltrate
321	   a bearer token. Browser/PWA runner addition therefore uses a same-runner
322	   authorization window:
323	   - Interface A creates a random `state`, PKCE verifier/challenge, and opens
324	     runner B at
325	     `/authorize-interface?origin=<A>&state=<state>&challenge=<challenge>`.
326	     PKCE is S256 only; `plain` is rejected. `state`, verifier, and challenge
327	     are base64url with bounded length (43–128 characters) before rendering,
328	     hashing, or persistence.
329	   - The authorization page is served by B, submits the password only to B's
330	     same origin, names requesting origin A, and requires explicit approval.
331	     An already-authenticated B session may approve without re-entering the
332	     password; first contact uses the same IP/rate-limit bucket and lockout as
333	     `/api/auth/login`.
334	   - B parses and validates A as an exact `https` or loopback-`http` origin,
335	     rejects every other scheme/shape as `auth.login_origin_rejected`, and
336	     renders the parsed A and B origins in full (not raw attacker text or
337	     truncated labels). Approval requires a real user gesture.
338	   - B creates a 60-second, single-use authorization code bound to exact
339	     origin A + PKCE challenge and sends it to the opener with
340	     `postMessage(..., A)` (or a platform return link when no opener exists).
341	   - A verifies `event.origin === B`, the `state`, then exchanges
342	     code + verifier at `/api/auth/browser-token`. Only the bound origin gets
343	     CORS on this exchange. The code is atomically consumed and never logged.
344	   - Native Electron/Capacitor/VSCode/CLI login stays direct: their host process
345	     sends URL + shared password to `/api/auth/login` without browser CORS.
346	   - Bearer requests from a stored browser `boundOrigin` get exactly that
347	     origin reflected with `Vary: Origin`, including error responses.
348	   - `GET /api/healthz` allows non-credentialed cross-origin GET and returns
349	     only `{"ok":true}`—no identity, version, hostname, or state.
350	   - Registry-wide `OPTIONS` handles bearer-route preflight with
351	     `authorization, content-type`, per-route methods, and a bounded
352	     `Access-Control-Max-Age`. Cookie routes never receive CORS headers.
353	     `Access-Control-Allow-Credentials` is never emitted on any route.
354	3. **SSE auth**: browser `EventSource` cannot set headers. Bearer clients call
355	   `POST /api/auth/stream-ticket` to create a 60-second, single-use,
356	   atomically consumed ticket bound to (session, exact stream path). The ticket
357	   is passed in `?ticket=`. Redemption revalidates the session's stored origin.
358	   `LiveEventConnectionManager` owns reconnection, closes native EventSource
359	   auto-retry on error, fetches a fresh ticket for every connection, and sends
360	   the saved epoch-aware cursor as `?cursor=<epoch>:<sequence>` because a newly
361	   constructed `EventSource` cannot set `Last-Event-ID`. The server also accepts
362	   the standard header; explicit `cursor` wins when both exist. Cursors are not
363	   credentials and may be logged. The same mechanism protects
364	   `/api/terminals/:id/stream`. A successful cross-origin ticketed stream
365	   response reflects the ticket/session's bound origin in
366	   `Access-Control-Allow-Origin` and sends `Vary: Origin`; otherwise the browser
367	   rejects the `EventSource` response even though ticket redemption succeeded.
368	4. **Network exposure**: authentication is already required by the current
369	   application. Binding to a non-loopback host with a missing/invalid password
370	   fails at startup. Bearer login and stream-ticket issuance over plaintext
371	   non-loopback HTTP are refused. Loopback HTTP remains available for local
372	   development; production remote clients use HTTPS/Tailscale/tunnels. There is
373	   no unauthenticated network override in the supported product path.
374	   TLS validation failure is a hard `tls-untrusted` profile status, with a
375	   precise cause (unknown issuer, hostname mismatch, expired certificate).
376	   Browsers/PWA require trust through the OS/browser and recommend Tailscale
377	   HTTPS/`tailscale cert`. Native shells may offer per-profile SPKI pinning
378	   only after standard trust validation fails: show the fingerprint, require
379	   explicit confirmation, and persist the pin. OS-trusted chains are never
380	   pinned. A later mismatch enters `tls-untrusted` with cause `pin-mismatch`;
381	   the UI shows stored and presented fingerprints and requires an explicit
382	   re-pin gesture while preserving the profile/credential. Re-pin emits an
383	   auditable client diagnostic. There is no global insecure mode and no
384	   `rejectUnauthorized: false`.
385	5. **Trusted proxies and rate limiting**: the runner honors
386	   `Forwarded`, `X-Forwarded-Proto`, and `X-Forwarded-For` only when the
387	   immediate socket peer is in `OMNIHARNESS_TRUSTED_PROXIES`
388	   (addresses/CIDRs). Otherwise protocol and rate-limit identity come from the
389	   actual socket. Credentialed requests use `redirect: "manual"` so passwords,
390	   bearer tokens, and tickets never follow redirects.
391	6. **First-run provisioning**: `pnpm auth:password set` remains the canonical
392	   interactive command and stores an Argon2 hash. `omni auth init` becomes a
393	   friendly alias that prompts for the same shared password and supports
394	   `--password-file` for unattended deployment (file must be mode `0600`).
395	   A headless runner with no valid password fails with instructions.
396	7. **Session lifetime and revocation**:
397	   - Cookie and browser-bearer sessions: 30-day idle, 90-day absolute expiry.
398	   - Native sessions: 90-day idle, 365-day absolute expiry.
399	   - `lastSeenAt`/idle expiry is touched at most once per minute to bound SQLite
400	     writes. A runner retains at most 50 active sessions; successful login at
401	     the cap evicts the least-recently-seen non-current session and emits
402	     `auth.session_revoked` with reason `session_limit`.
403	   - `GET /api/auth/sessions` lists redacted device/session metadata;
404	     `DELETE /api/auth/sessions/:id` revokes one; `DELETE /api/auth/sessions`
405	     revokes all except the current session. `omni auth sessions list|revoke`
406	     exposes the same control plane. Every decision emits
407	     `auth.session_revoked` and user-relevant failures emit `error.surfaced`.
408	   - Changing the shared password revokes every existing session by default.
409	     `pnpm auth:password set --keep-sessions` is an explicit compatibility
410	     override. "Forget runner" first attempts server revocation, always clears
411	     the local credential, and surfaces a warning if the server was unreachable.
412	8. **Client storage**:
413	   - Web/PWA stores bearer session tokens in the versioned runner-profile store
414	     in `localStorage`; the CSP/no-third-party-script policy is the protection
415	     boundary.
416	   - Electron stores tokens in the main process with `safeStorage`; the
417	     renderer never sees them.
418	   - Capacitor stores tokens with an audited Keychain/Keystore-backed secure
419	     storage plugin. Tokens are loaded into memory only for the native
420	     networking bridge and are never written to WebView local storage.
421	   - VSCode stores bearer tokens in `SecretStorage`.
422	9. **Redaction and audit**: password bodies, authorization codes/verifiers,
423	   `Authorization` headers, bearer
424	   tokens, stream tickets, and token-bearing URLs are scrubbed from logs,
425	   errors, and named-event details. Login success/failure/rate limiting,
426	   bearer issuance/rejection, ticket issuance/redemption/rejection, and session
427	   revocation remain auditable without secrets.
428	10. **Existing pairing compatibility**: the existing QR/pair-token flow remains
429	   available to current web users but is not required by the new desktop or
430	   mobile onboarding. New runner profiles use URL + shared password. No new
431	   security or product dependency is built on pairing tokens.
432	11. **Next removal**: `NextRequest` usage in `auth/guards.ts`,
433	    `auth/session.ts`, `api-errors.ts` is replaced with plain Fetch `Request`.
434	
435	### 4.4 Interface: Vite SPA
436	
437	- `apps/interface/` with Vite + React. Entry reuses `src/ui/render-web.tsx`;
438	  `src/app/layout.tsx` content is ported to `index.html` (theme bootstrap
439	  script, meta/manifest/icons) and a `<Providers>` root.
440	- Remove Next-isms (all verified small):
441	  - `next/dynamic` (4 files) → `React.lazy` + `Suspense`.
442	  - `next/image` (5 files) → `<img>` (all usages are local static assets).
443	  - `next/font/google` → self-hosted Geist via `@fontsource` (offline-friendly,
444	    no Google fetch at build or runtime).
445	  - `src/app/home/` → `src/interface/home/` (rename only).
446	- **PWA & service worker contract**:
447	  - `manifest.webmanifest`, `sw.js`, `PwaBootstrap` move to the Vite app,
448	    served by the runner → phone install keeps working per runner origin.
449	  - The SW **never caches `index.html`** (it carries per-request auth state).
450	    It precaches hashed assets plus `app-shell.html`, a static,
451	    non-personalized navigation fallback that boots without inline bootstrap
452	    and calls `/api/runtime/bootstrap`. The manifest `start_url` targets the
453	    shell, and navigation failures fall back to it.
454	  - **The app mounts and loads `RunnerRegistry` independently of same-origin
455	    bootstrap success**: if the hosting runner is down, its profile is marked
456	    offline but the switcher stays usable and a saved remote runner connects
457	    normally (the installed interface is not held hostage by its origin
458	    runner). Test: install from A, save B, stop A, launch from SW cache,
459	    connect to B.
460	  - SW versioning: build hash in the SW file; install uses `skipWaiting`,
461	    activate evicts old caches and calls `clients.claim`. Same-origin
462	    `apiRevision` mismatch requests one update + guarded reload; a persisted
463	    loop flag prevents reload storms. The offline shell response carries the
464	    same CSP header as live pages.
465	  - The service worker never caches or rewrites requests whose origin differs
466	    from its own; cross-origin runner API/SSE traffic passes through untouched.
467	- **Dev workflow**: `pnpm dev` = runner via `tsx watch` + Vite dev server
468	  proxying `/api` to the runner (cookies stay same-origin in dev; no CORS
469	  needed). **The dev UI lives at Vite's port (5173)**; the runner port serves
470	  whatever `dist/interface` build exists (or API-only mode) — it is the
471	  canonical URL for production and packaged-mode e2e, not for dev. Expected
472	  dev RSS per §4.1 contract. The Vite proxy preserves the browser's
473	  `Origin: http://localhost:5173` (`changeOrigin: false`) and auth tests assert
474	  that exact development path.
475	- **Prod web**: `vite build` output is what the runner serves.
476	- **Native packaging**:
477	  - Electron loads the packaged Vite bundle; all HTTP/SSE runs in its main
478	    process through an IPC `RuntimeAPIs` adapter.
479	  - Capacitor iOS/Android load the same bundle from the native WebView. A
480	    narrow native bridge owns secure credentials, HTTP/SSE, external links,
481	    and local notifications. The shared React tree never branches on platform
482	    except through `RuntimeAPIs.native` capabilities.
483	  - Mobile operating systems may suspend an app in the background. "Keep all
484	    runners connected" is guaranteed while the app process is active; reliable
485	    delivery while suspended requires native push infrastructure and is not
486	    falsely claimed by v1.
487	  - `apps/mobile/capacitor.config.ts` points `webDir` at
488	    `../../dist/interface`; native builds never maintain a second frontend
489	    artifact.
490	  - iOS declares `NSLocalNetworkUsageDescription` for LAN runners and keeps App
491	    Transport Security strict outside explicit loopback development. Android
492	    sets `usesCleartextTraffic=false` with a debug-only loopback network
493	    security configuration. Release builds never bypass certificate checks.
494	- **UI starting point**: preserve the existing OmniHarness workspace. Adapt
495	  the official shadcn `sidebar-07` team-switcher structure for the runner
496	  switcher and `login-03` for URL + password onboarding. Remove their demo
497	  content and wire real `RunnerRegistry` state; do not replace the existing
498	  conversation layout with a generic dashboard.
499	
500	### 4.5 Multi-runner client model
501	
502	**Runner identity is server-generated.** The bootstrap payload (inline and
503	`/api/runtime/bootstrap`) gains:
504	
505	```ts
506	runner: {
507	  instanceId: string;   // generated once, stored in the settings table
508	  name: string;         // user-configurable display name
509	  version: string;      // package version
510	  apiRevision: number;  // monotonically bumped on breaking API change
511	  capabilities: string[]; // additive feature/domain capability ids
512	}
513	```
514	
515	Identity travels with the dataset: a restored/cloned database keeps its
516	`instanceId` (documented rule), and `omni runner rekey` mints a new identity
517	for deliberate clones. The client never treats two simultaneously reachable
518	endpoints with one identity as interchangeable — it flags the conflict.
519	
520	Client-side profile:
521	
522	```ts
523	type RunnerProfile = {
524	  id: string;                 // client uuid for list keys only — NOT identity
525	  runnerInstanceId?: string;  // learned at first successful login/connect
526	  label: string; baseUrl: string;
527	  authTransport: "cookie" | "bearer";
528	  credentialRef?: string;     // token lives behind the platform credential store
529	  schemaVersion: 1;
530	  createdAt: string; lastConnectedAt?: string;
531	};
532	```
533	
534	- Identity rules: after login, the profile pins `runnerInstanceId`. If
535	  `baseUrl` later resolves to a different instance id → connection blocked
536	  with an explicit mismatch warning (log in again to accept). Editing
537	  `baseUrl` revokes/removes the local session credential. Two profiles
538	  resolving to the same instance id are flagged as duplicates. Authorization
539	  headers are never forwarded across redirects.
540	- API compatibility: `src/shared/api-revision.ts` publishes a supported
541	  revision window `[minimum, current]` and a deprecation policy that retains at
542	  least the previous two released revisions. Additive features gate on
543	  `capabilities` and degrade only that feature with an explained badge.
544	  Hard-blocking is reserved for revisions that break bootstrap/snapshot/event
545	  transport itself; equal-compatible revision with a different package version
546	  remains usable with an info badge.
547	  `src/shared/api-revision.ts` also records the declared classification for
548	  every route-contract fixture change: additive route/optional field changes
549	  must add/extend a capability without a revision bump; only
550	  bootstrap/snapshot/SSE-frame breaking changes may bump the revision and
551	  update `minimum`. Tests fail on an undeclared or misclassified contract diff.
552	  Same-origin mismatch triggers a service-worker update + one guarded reload;
553	  remote mismatch remains blocked. A valid same-origin session automatically
554	  re-pins after `omni runner rekey`; remote profiles require explicit login.
555	- **RunnerRegistry** (persisted): profiles + `activeRunnerId`, versioned
556	  schema (`schemaVersion`) with forward-migration and corrupt-store recovery
557	  (reset to same-origin default + toast, never a crash). Storage:
558	  `localStorage` on web/PWA (per-origin; the implicit same-origin runner is
559	  always present as a non-deletable profile); Electron profiles live in the
560	  main-process store; Capacitor profiles live in native preferences; VSCode
561	  profiles live in extension global state. Credential material uses the
562	  platform stores from §4.3.8.
563	- **Electron security boundary**: remote HTTP/SSE happens in the **main
564	  process** (mirroring the proven VSCode extension-host bridge pattern,
565	  `src/vscode-extension/bridge.ts`); the renderer gets an IPC-backed
566	  `RuntimeAPIs` implementation and never sees bearer tokens. IPC surface is
567	  validated per-channel; external links open in the OS browser; navigation is
568	  locked to the bundled SPA. `safeStorage.isEncryptionAvailable()` is checked:
569	  when the platform provides no key store, tokens are session-only (or
570	  persisted plaintext only after explicit user consent), and the degraded
571	  state is surfaced — never silently claimed as encrypted.
572	- **Electron migration**: Electron becomes remote-only in M6 and no longer
573	  starts an in-process runner. M2 adds a compatibility export bridge that
574	  copies the legacy renderer's preferences/drafts into Electron `userData`;
575	  M6 imports them into the new main-process profile/preferences store before
576	  loading `app://omniharness`. On first remote-only launch, it probes the
577	  legacy `http://127.0.0.1:3050` address and offers it as a profile when
578	  reachable. Otherwise the onboarding screen clearly offers "connect a remote
579	  runner" or documented `pnpm runner` startup instructions. The release notes
580	  call this process split out as a breaking operational change; the desktop app
581	  never silently launches or owns a runner.
582	- **Capacitor security boundary**: native projects allow navigation only to the
583	  bundled interface, validate every bridge method, open external URLs through
584	  the OS, and use Keychain/Keystore-backed credential storage. The native
585	  networking adapter attaches bearer tokens and obtains stream tickets; no
586	  token is placed in WebView storage, a URL, or a JavaScript bridge response.
587	- **Per-runner connection scope.** Everything currently keyed to "the server"
588	  becomes owned by a `RunnerConnection` created per profile: `RuntimeAPIs`
589	  instance, `LiveEventConnectionManager` (transport-neutral stream + cursor),
590	  `EventStreamStateManager`, snapshot cache, `WorkerEntriesManager`,
591	  notification manager. React context provides the *active* connection;
592	  TanStack Query keys use `runnerInstanceId` after identity is known, with the
593	  profile id only as a pre-login fallback and an atomic one-time cache/draft
594	  rekey when identity is learned.
595	- **Concurrent connection contract**: `RunnerRegistry` owns one
596	  `RunnerConnection` for every saved authenticated profile. All connections
597	  remain open while the app process is active, independently resume their SSE
598	  cursor, keep their cached run lists current, and retry with exponential
599	  backoff capped at five minutes. Switching changes only which connection is
600	  rendered; it does not close streams or cancel HTTP mutations. Offline and
601	  needs-reauth profiles keep their last non-authoritative cache for explicit
602	  stale display but never satisfy a fresh-load gate.
603	  - Each profile keeps one main event stream. Terminal streams belong only to
604	    the active visible connection; switching detaches them and reactivation
605	    reloads bounded scrollback before tailing again. M4 must first verify that
606	    `/api/terminals/:id/stream` already provides a bounded replay window on
607	    attach; if not, M4 adds that server contract before M5 client wiring. This
608	    prevents inactive PTY output from growing client memory and avoids
609	    exhausting browser HTTP/1.1 per-origin connection limits.
610	  - Worker/snapshot preview caches are size-bounded per connection and globally
611	    LRU-evicted; eviction never affects server authority or persisted drafts.
612	  - There is no product-level profile cap: every saved authenticated runner
613	    retains its main stream while the process is active. Retry timers are
614	    jittered so a network return does not create a reconnect storm. If a
615	    platform refuses another socket/resource, that profile enters explicit
616	    `deferred` rather than pretending to be offline and retries immediately
617	    when selected or capacity returns.
618	- **State invariants** (per `client-server-state-invariants`):
619	  - Ownership: all domain state belongs to the runner; the client persists
620	    only runner profiles, UI preferences, and drafts. Drafts are keyed by
621	    (`runnerInstanceId`, `conversationId`) after identity is known so switching
622	    runners never leaks a draft.
623	  - Provenance: every snapshot/event frame is tagged with runner scope at the
624	    connection layer; reducers reject frames whose scope doesn't match.
625	  - Freshness: each connection bootstraps from a scoped snapshot, then tails
626	    epoch-aware SSE. Epoch mismatch or an evicted cursor produces
627	    `stream.resync_required` and a complete scoped re-bootstrap. The cursor is
628	    persisted per `runnerInstanceId` in the platform profile store, cleared on
629	    resync/identity change, and never shared between profiles.
630	    Resync has its own governor: more than three resyncs for one profile in a
631	    rolling five-minute window applies jittered exponential delay before the
632	    next snapshot fetch (capped at five minutes) and marks the profile
633	    degraded. One slow connection cannot create a snapshot/resubscribe storm.
634	  - Mutations carry their `runnerId`. A mutation completing after a switch is
635	    **not** treated as cancelled: its cache updates apply to the originating
636	    runner's query keys (which may not be on screen), and failures surface
637	    as a notification naming the runner. Run/conversation ids are only unique
638	    per runner; all URL deep links (`/session/:runId`) resolve against the
639	    active runner only.
640	  - Races to test: rapid switching while every stream remains live; mutation
641	    resolving after switch; simultaneous events with the same run id from two
642	    runners; credential revocation (401 → only that profile becomes
643	    needs-reauth); process restart with an old epoch; instance-id mismatch;
644	    identity-learned cache/draft rekey; corrupt profile/credential stores.
645	- **Status derivation**: health failure means `offline`; health success followed
646	  by bootstrap 401 means `needs-reauth`; authenticated bootstrap with an
647	  unsupported revision means `incompatible`; identity change means
648	  `identity-mismatch`; certificate validation failure means `tls-untrusted`;
649	  platform socket/resource refusal means `deferred`; only snapshot authority
650	  plus a live stream means `connected`.
651	
652	### 4.6 The 29 direct-fetch call sites
653	
654	`RuntimeAPIs` defines transport-neutral request and stream primitives before
655	the migration starts. No shared consumer mentions `EventSource`, Electron IPC,
656	or a Capacitor plugin:
657	
658	```ts
659	type RuntimeStream = {
660	  onOpen(listener: () => void): () => void;
661	  onFrame(listener: (frame: RuntimeStreamFrame) => void): () => void;
662	  onError(listener: (error: RuntimeApiError) => void): () => void;
663	  close(): void;
664	};
665	
666	openStream(input: {
667	  path: string;
668	  cursor?: string | null;
669	  signal?: AbortSignal;
670	}): Promise<RuntimeStream>;
671	```
672	
673	The web adapter obtains a stream ticket and constructs `EventSource`; Electron
674	and Capacitor hosts obtain tickets and forward parsed frames over validated
675	bridges; VSCode does the same in its extension host. Every request adapter
676	disables redirects in its platform-native HTTP stack. Ticket acquisition and
677	credential attachment remain below the shared interface boundary.
678	
679	All migrate to methods on the per-runner `RuntimeAPIs` (extending
680	`src/runtime-api/types.ts` with the missing domains: runs, git, fs, attachments,
681	projects/memory, planning, accounts, notifications, terminals). Mechanical but
682	wide; `useHomeMutations.ts` (1,269 lines) is split by domain as part of the
683	migration (conversations / runs / planning / settings) to stay under the
684	1200-line rule. `InteractiveTerminal.tsx`'s `EventSource` goes through the
685	connection's ticket-aware stream opener.
686	
687	### 4.7 Filesystem semantics
688	
689	Paths shown in the UI (project pickers, file viewer, attachments) already flow
690	through runner APIs (`/api/fs`, `/api/fs/files`, `/api/attachments`) — they are
691	**runner paths** and keep working remotely. Co-location is a capability, not a
692	heuristic: desktop users may explicitly mark a profile as co-located. The
693	Electron app does not launch or own a runner process in v1. Only co-located
694	profiles offer `native.chooseFolder()` and OS editor links
695	(`project-file-links.ts`); everything else uses the `/api/fs` picker dialog and
696	the in-app file viewer. "localhost" in a URL proves nothing (SSH tunnels) and
697	is not used as a signal.
698	
699	### 4.8 Notifications
700	
701	- Web/PWA while open: every connected runner can produce an in-app
702	  notification naming the runner. Web push remains limited to the PWA's
703	  hosting runner because one service-worker registration holds one VAPID
704	  subscription.
705	- Electron and Capacitor: the native host observes notification-worthy events
706	  from every connected runner and posts a local notification naming the
707	  runner while the app process is active. Reliable notifications after a
708	  mobile OS suspends or kills the process require native push and are not part
709	  of this v1 acceptance contract.
710	
711	## 5. User stories (v1 acceptance)
712	
713	1. **Lean local dev** — As the builder, I run `pnpm dev` and get runner + Vite;
714	   combined RSS < 2 GB under the scripted workload (§4.1); the dev UI at
715	   Vite's port behaves identically to the current app. *(Acceptance: full
716	   existing e2e suite passes in packaged mode — built SPA served from the
717	   runner port — which is also the production parity gate.)*
718	2. **Headless runner** — I run `pnpm runner` on a box with no display; it
719	   serves API, SSE, and the built UI on one port (or API-only without
720	   `dist/interface`); `omni` CLI and `tests/lifecycle` drive it end-to-end.
721	3. **Phone/PWA** — I install the interface from one runner, add other runners
722	   with URL + shared password, and supervise any of them. If the hosting runner
723	   is down, the offline shell still opens and connects to the others.
724	4. **Native mobile** — I install the iOS or Android app, add runners with URL +
725	   shared password, and use the same terminal/composer/supervision interface.
726	   Session tokens persist in Keychain/Keystore and all profiles remain
727	   connected while the app process is active.
728	5. **Electron remote** — In the desktop app I add multiple runners by URL +
729	   shared password, see live status for all of them, switch without closing
730	   inactive streams, and receive runner-named notifications; tokens never
731	   reach the renderer.
732	6. **Failure honesty** — Unreachable runner → explicit offline banner with URL
733	   and error detail; reconnect resumes via the epoch-aware SSE cursor; 401 → named runner
734	   + password login CTA; process epoch mismatch → snapshot resync;
735	   instance-id mismatch → blocked with explanation.
736	7. **Return visit** — Runner profiles, active selection, per-runner drafts, and
737	   UI preferences survive restart on web, PWA, Electron, iOS, and Android; a
738	   corrupted profile or credential store recovers safely with a visible notice.
739	8. **Lost device/password rotation** — From an authenticated runner I can list
740	   sessions, revoke a lost device, and watch only that client transition to
741	   needs-reauth. Changing the shared password revokes all sessions unless I
742	   explicitly retain them.
743	9. **Graceful stop** — When a runner stops, every connected client shows
744	   "runner stopping," backs off, and does not create a snapshot/reconnect storm.
745	10. **Upgrade from current Electron** — Existing preferences and drafts are
746	    imported; the app either offers the reachable legacy local runner or gives
747	    exact instructions for starting/connecting a runner instead of failing.
748	11. **Profile administration** — I can save an unreachable URL as an offline
749	    profile, edit it (which clears its credential), forget it, rename a runner,
750	    and recover a same-origin PWA after an API revision/service-worker skew.
751	12. **API-only runner** — Electron, Capacitor, VSCode, and CLI can use a runner
752	    with no static interface artifact; web navigation receives the documented
753	    informational page without affecting API/SSE behavior.
754	13. **Mixed-version fleet** — A current interface remains connected to runners
755	    at revisions R and R-1 simultaneously. The older runner remains usable and
756	    only unsupported capabilities are hidden/explained; transport-incompatible
757	    revisions alone are blocked.
758	14. **Connection scale** — With eight saved authenticated runners, all main
759	    streams remain live with < 40 MB incremental RSS per additional fixture
760	    runner and < 750 MB aggregate client process-tree RSS in the controlled
761	    local benchmark. Network loss and restoration produces jittered reconnects
762	    rather than a thundering herd; platform resource refusal is shown as
763	    `deferred`.
764	
765	Switcher status states: connected / connecting / offline / needs-reauth /
766	incompatible (transport revision) / identity-mismatch / tls-untrusted /
767	deferred.
768	
769	Onboarding: Electron and Capacitor first launch show "Connect a runner"
770	(URL + shared password). Web/PWA starts with its non-deletable same-origin
771	profile and uses the same form to add remote runners.
772	
773	## 6. Error transparency & instrumentation
774	
775	- Existing posture (full error details + stack traces to the frontend) is
776	  preserved; `update_error` SSE frames and `app-errors.ts` flows unchanged —
777	  with the §4.3.9 redaction rules applied to credentials/tickets.
778	- New named events: `runner.bridge_ready`, `runner.bridge_unavailable`,
779	  `runner.static_ui_enabled`, `runner.static_ui_missing`, `runner.stopping`
780	  (also sent as the SSE goodbye frame), `auth.bearer_issued`,
781	  `auth.bearer_origin_rejected`, `auth.login_origin_rejected`,
782	  `auth.stream_ticket_issued`, `auth.stream_ticket_rejected`,
783	  `auth.login_rate_limited`, `auth.session_revoked`, plus existing
784	  `runtime.started/stopped`.
785	- User-relevant server failures additionally emit `error.surfaced` with new
786	  stable codes such as `runner.bridge.unavailable`,
787	  `runner.static_ui.missing`, `runner.auth.invalid`,
788	  `runner.auth.ticket_failed`, and `runner.network.insecure`. Client-owned
789	  failures (profile corruption, offline, compatibility and identity mismatch)
790	  live in the per-profile `RunnerConnection` diagnostics and notification
791	  manager because there may be no trustworthy runner to receive a server
792	  event.
793	- Client-side connection lifecycle is logged per profile through
794	  `LiveEventConnectionManager` diagnostics. Client-owned failures have stable
795	  codes; the switcher renders the already-redacted server/client message and
796	  tests assert the code rather than matching prose.
797	- Control plane: everything remains scriptable headless (`tests/lifecycle`
798	  already proves this). `omni` CLI gains `--runner <url>` plus token via
799	  `OMNI_TOKEN` env / `--token-file` / stdin — never a bare `--token` argv
800	  (shell history, `ps`) except as an explicitly warned compatibility flag.
801	
802	## 7. Testing strategy
803	
804	- **Unit/integration (vitest)**: streaming server (SSE via `startOmniServer`:
805	  heartbeat, epoch-aware cursor resume without duplicates, client-disconnect
806	  cleanup, backpressure, flush-per-frame through a compressing proxy,
807	  restart-epoch mismatch and id-bearing resync, non-reading consumer eviction
808	  with flat memory); password bearer auth (origin
809	  binding, wrong-origin rejection, preflight, redirect non-forwarding,
810	  trusted-proxy rate-limit identity, browser authorization
811	  state/S256-only PKCE bounds/origin/code replay/no-CORS-credentials);
812	  session list/revoke/expiry/max-count/password
813	  rotation; stream tickets (single-use atomicity,
814	  expiry, concurrent redemption, reconnect-with-fresh-ticket); static serving
815	  (bootstrap JSON
816	  escaping incl. `</script>`/U+2028, SPA-fallback scope, 404s for `/api/*`,
817	  traversal rejection, cache headers, CSP-manifest hash); RunnerRegistry
818	  (schema migration, corruption recovery, identity pinning/mismatch,
819	  baseUrl-edit credential clearing, identity rekey); concurrent connection
820	  races (§4.5 list), resync governor, inactive-terminal detachment and bounded
821	  caches; network exposure/TLS pin/re-pin policy; native-login header/CORS invariants;
822	  route-contract/api-revision/capability coupling; same-origin service-worker
823	  skew recovery and cross-origin SW pass-through.
824	- **Route parity gate before deleting Next adapters**: table-driven test
825	  hitting every registry route through both the Next adapter and
826	  `startOmniServer`, comparing status, headers (incl. cookies), and body
827	  semantics; includes multipart upload. Stateful routes run against isolated
828	  per-adapter fixtures (separate DB/data dirs), not sequentially on one DB.
829	  SSE endpoints compare status/headers plus a bounded sequence of normalized
830	  frames, then abort and assert subscriber cleanup (streams never "complete").
831	  `Set-Cookie` comparison normalizes attribute names/order while preserving
832	  values and security semantics.
833	  After the Next adapters are removed, the generated route/response contract
834	  fixtures remain as a standalone-registry regression suite rather than
835	  deleting the coverage with the adapters.
836	- **Lifecycle suite** (`tests/lifecycle`) runs against `scripts/runner.ts` —
837	  the primary backend regression gate.
838	- **Playwright e2e**: existing suites repointed at the runner-served SPA; new
839	  two-runner spec (two runner processes, separate DBs/data dirs/ports/
840	  identities): add with password → keep both streams live → switch → restart
841	  one runner → epoch resync. Browser cross-origin spec: SPA from runner A logs
842	  into and talks to runner B.
843	- **Eight-runner scale harness**: deterministic fixture runners with all main
844	  streams live; record per-connection and aggregate client RSS; disconnect and
845	  restore the network; assert bounded/jittered reconnect load and explicit
846	  `deferred` state if the platform refuses capacity.
847	- **Electron/VSCode**: `tests/electron` updated for the IPC RuntimeAPIs and
848	  main-process networking; `tests/vscode` updated for the new default port +
849	  bearer wiring ("behavior unchanged" still requires these test updates).
850	- **Capacitor**: unit tests for the bridge contract and credential adapter;
851	  Android Gradle and iOS Xcode build/sync smoke checks; a mobile-viewport
852	  packaged-interface Playwright suite for shared UI behavior; packaged CSP
853	  proves direct WebView fetch to a runner is blocked.
854	- **Candidate agentic user-journey tests** (require approval before running):
855	  (a) phone-viewport PWA password login + send message against two runners;
856	  (b) Electron keeps two runners connected and recovers one from restart;
857	  (c) Capacitor Android/iOS shell logs in, switches, and returns to saved
858	  profiles.
859	
860	## 8. Milestones
861	
862	Resequenced so the bundle boundary exists before Vite is introduced and
863	multi-runner ships dark until every request path is scoped:
864	
865	**M1 — Boundaries + standalone runner** *(Next still serves the UI)*
866	Move shared runtime values/types (including worker labels, entry types, and
867	planning review preferences) into `src/shared`; add interface/runner/shared
868	typecheck projects and import-boundary lint rules. Define the
869	transport-neutral request/stream contract used by web, IPC, VSCode, and
870	Capacitor before migrating callers. Implement stream epochs and
871	the streaming server fix; `scripts/runner.ts` with non-fatal managed-bridge
872	controller, lifecycle/shutdown contract, isolated instance configuration,
873	`healthz`; remove `next/server` dependencies from auth/api-errors; add the
874	route-parity rig and run lifecycle against the runner.
875	
876	**M2 — Interface on Vite, Next deleted**
877	`apps/interface`; layout ported; Next-isms removed; static-serving contract +
878	bootstrap injection/CSP manifest; `app-shell.html` SW/PWA contract;
879	`pnpm dev` = runner + Vite;
880	route-parity + Playwright green; then delete `src/app/api/*`, page/layout/
881	instrumentation, `next.config.ts`, Next deps; `src/app/home/` →
882	`src/interface/home/`; memory acceptance measured.
883	*Transitional shell contract*: Electron switches to loading the Vite
884	production bundle in this milestone while keeping its current local runtime
885	transport (it must not break for four milestones); VSCode's default port
886	moves off the retired 3035 here too, with its regression test.
887	
888	**M3 — Transport unification** *(no user-visible change)*
889	all 29 call sites through `RuntimeAPIs`; `useHomeMutations.ts` split by domain;
890	query keys and drafts gain a stable runner-scope prefix (still always local).
891	
892	**M4 — Shared-password remote auth protocol** *(dark: no switcher UI yet)*
893	Bearer sessions with stored-provenance origin binding (existing
894	`auth_sessions` rows migrate to `transport: "cookie"` without invalidating
895	live sessions); native password bearer login; same-origin browser
896	authorization-code + PKCE flow; session list/revoke routes and CLI; password
897	rotation semantics; stream tickets +
898	reconnect ownership in `LiveEventConnectionManager`; preflight handling;
899	trusted-proxy/rate-limit contract; first-run password provisioning; runner
900	identity (`instanceId`, editable `name`, `apiRevision`) in bootstrap and
901	settings route; network-exposure policy + redaction; `omni --runner` flags;
902	VSCode gains bearer wiring here.
903	
904	**M5 — Concurrent multi-runner UI (web/PWA)**
905	RunnerRegistry persistence (+ migration/recovery); `RunnerConnection` scoping
906	and all-profile lifecycle/retry; switcher adapted from shadcn `sidebar-07`;
907	URL+password onboarding adapted from `login-03`; status states; drafts keyed
908	per identity; session administration + runner-name controls; inactive-runner
909	notifications; two-runner Playwright +
910	cross-origin browser specs pass. Switcher controls stay hidden in Electron
911	until M6.
912	
913	**M6 — Electron + VSCode remote clients**
914	Main-process networking + IPC RuntimeAPIs; `safeStorage` tokens; co-location
915	capability gating for native pickers/editor links; switcher enabled in
916	Electron; VSCode `SecretStorage`; all-profile native notifications;
917	`tests/electron` and `tests/vscode` updated.
918	
919	**M7 — Capacitor iOS + Android**
920	`apps/mobile` Capacitor project; iOS and Android native projects; native
921	`RuntimeAPIs` networking/SSE bridge; Keychain/Keystore credential adapter;
922	external-link and local-notification capabilities; safe-area/mobile layout
923	verification; build/sync smoke checks and packaged mobile acceptance.
924	
925	Each milestone leaves all already-shipped shells working; M1–M3 are guarded by
926	parity tests, M4 ships dark, M5 turns concurrent multi-runner on for web/PWA,
927	M6 completes desktop/VSCode, and M7 completes the approved native platforms.
928	
929	## 9. Risks & trust surfaces
930	
931	- **Exposing runners on a network** is the point of this work. Mitigations:
932	  required shared password, refusal of plaintext non-loopback bearer login,
933	  origin-bound bearer sessions, single-use path-bound stream tickets,
934	  platform secure storage, no credentialed redirects, redaction, and
935	  rate-limited login.
936	  Docs recommend tailscale/tunnels over raw port-forwarding.
937	- **SSE through proxies/tunnels**: heartbeats exist; streaming rewrite must
938	  flush per-frame (tested through a compressing proxy — the scenario that
939	  motivated `dev-compression-proxy.ts`).
940	- **Single-process API server** remains a hard constraint (in-memory event
941	  bus/PTYs). Documented; horizontal scaling is a non-goal.
942	- **Churn risk**: M3 touches 29 files. Mitigated by per-domain mechanical PRs,
943	  parity tests, and shipping dark until M5.
944	- **Native-shell regression risk**: IPC/bridge and secure-storage contracts are
945	  covered by Electron/VSCode tests in M6 and Capacitor build/bridge tests in M7.
946	- **Mobile background limitation**: concurrent streams stay open while the app
947	  process is active; native push after suspension is a separate product
948	  capability and is not implied by local notifications.
949	
950	## 10. North star & future direction (context, not commitment)
951	
952	One interface, installed anywhere, showing all your runners: merged
953	cross-runner dashboard, cross-runner native push relay, runner health/resource
954	panel, Tauri as a possible desktop alternative, package extraction (Approach
955	B) once boundaries settle, and runner-to-runner work handoff.
956	
957	## 11. Implementation gates
958	
959	1. "Runner" remains one logical deployment consisting of the API server and
960	   co-located ACP bridge processes.
961	2. Before retiring the 3035 compression proxy, audit every consumer (scripts,
962	   docs, tunnels, VSCode settings) and update it in the same milestone.
963	3. Calibrate the memory thresholds (< 2 GB dev, < 1 GB production runner)
964	   against the controlled M1 baseline before treating them as failures.
965	4. Capacitor builds must use local developer signing configuration only;
966	   signing certificates, provisioning profiles, keystores, SDK caches, and
967	   generated release artifacts never enter the repository.
968	

uuid: 470ea881-55a1-4772-a6a7-4773d3066cb3
parent: 1c75aadc-525e-4fd2-99d7-85262e62e70a
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:30:34.482Z","phase":null} -->
## Claude tool call: Read · 2026-07-30T22:30:34.482Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/agents.md"
}

uuid: f5236264-8d32-489c-b1f4-c4a062d3203a
parent: 470ea881-55a1-4772-a6a7-4773d3066cb3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:30:34.489Z","phase":null} -->
## Claude tool result: toolu_01XLxxQecyUp2VcZZnCDyC5v · 2026-07-30T22:30:34.489Z

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

uuid: b6db3298-3990-4595-87f9-fd8def89addb
parent: f5236264-8d32-489c-b1f4-c4a062d3203a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:32:23.411Z","phase":null} -->
## Claude thinking · 2026-07-30T22:32:23.411Z



uuid: 13a6b68c-6582-4a23-8313-5a06c18e21b5
parent: b6db3298-3990-4595-87f9-fd8def89addb

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:32:27.042Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:32:27.042Z

```json
{
  "command": "echo \"=== next-isms ===\" && grep -rl \"next/dynamic\\|next/image\\|next/font\" src apps 2>/dev/null | head -30 && echo \"--- counts ---\" && grep -rn \"next/dynamic\\|next/image\\|next/font\" src apps 2>/dev/null | wc -l && echo \"=== client->server imports ===\" && grep -rn \"server/workers/entries-types\\|server/planning/review-preferences\" src --include=*.ts --include=*.tsx | grep -v \"^src/server\" | head -20 && echo \"=== pnpm-workspace ===\" && ls pnpm-workspace.yaml 2>&1 && cat pnpm-workspace.yaml 2>/dev/null && echo \"=== 3035 refs outside codex-history ===\" && grep -rln \"3035\" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . 2>/dev/null | grep -v \"docs/codex-history\" | head -40",
  "description": "Verify current-state facts referenced by the plan"
}

uuid: 5104ff33-a8a8-4901-a2f1-1332c99ac55e
parent: 13a6b68c-6582-4a23-8313-5a06c18e21b5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:32:27.854Z","phase":null} -->
## Claude tool result: toolu_01ALymCTudu4RVTKZb7566st · 2026-07-30T22:32:27.854Z

```text
=== next-isms ===
src/ui/OmniApp.tsx
src/app/layout.tsx
src/app/home/HomeApp.tsx
src/components/Terminal.tsx
src/components/cli-brand-icons.tsx
src/components/AttachmentImagePreviewDialog.tsx
src/components/home/UserInputMessage.tsx
src/components/home/ConversationMain.tsx
src/components/home/HomeHeader.tsx
src/components/home/ConversationComposer.tsx
--- counts ---
      10
=== client->server imports ===
(eval):1: no matches found: --include=*.ts
=== pnpm-workspace ===
pnpm-workspace.yaml
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
=== 3035 refs outside codex-history ===
playwright.live.config.ts
AGENTS.md
tests/runtime-api/web-runtime-api.test.ts
tests/server/restart-control.test.ts
tests/electron/runtime-shell.test.ts
tests/e2e/live/auth.ts
tests/e2e/live/auth.test.ts
tests/e2e/live/safety.test.ts
tests/vscode/bridge.test.ts
tests/e2e/live/playwright-live-config.test.ts
docs/architecture/frontend-state-and-rendering.md
docs/architecture/hot-path-responsiveness-and-resource-leaks.md
docs/architecture/conversation-ui-regression-lessons.md
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md
docs/superpowers/plans/lifecycle-observability-and-chaos-harness.md
docs/superpowers/plans/2026-06-14-visual-improve-mode.md
docs/architecture/common-runtime-multi-surface.md
docs/superpowers/plans/2026-07-30-interface-runner-platform-apps.md
docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md
docs/superpowers/plans/2026-05-14-planning-review-agents.md
docs/superpowers/plans/2026-05-25-automatic-session-cleanup.md
docs/superpowers/plans/2026-07-11-complete-acp-client.md
docs/superpowers/plans/2026-05-11-app-architecture-react-performance.md
docs/superpowers/plans/2026-05-12-branch-workspace-management.md
docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
docs/superpowers/specs/2026-07-29-interface-runner-split-design.md
docs/superpowers/plans/2026-05-18-common-runtime-multi-surface.md
docs/superpowers/plans/2026-07-13-managed-claude-model-gateway.md
docs/superpowers/plans/2026-06-14-escape-interrupt-queued-message.md
docs/superpowers/learnings/2026-07-25-restart-daemons-need-stable-codex-tool-discovery.md
docs/superpowers/learnings/2026-05-20-native-terminal-pending-scroll.md
docs/superpowers/journeys/2026-05-13-branch-workspace-management.md
scripts/remote-restart.ts
scripts/dev.ts
scripts/dev-compression-proxy.ts
scripts/measure-local-dev.mjs
scripts/free-port.sh
apps/electron/README.md
apps/vscode/README.md
scripts/cleanup-live-agent-journey.ts

uuid: bb73e14f-d6dc-4fe2-9bae-b89bb0e0628c
parent: 5104ff33-a8a8-4901-a2f1-1332c99ac55e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:32:27.858Z","phase":null} -->
## Claude attachment · 2026-07-30T22:32:27.858Z

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

uuid: 7eb1df0e-9d68-4417-8b9a-a3a37e263b6b
parent: bb73e14f-d6dc-4fe2-9bae-b89bb0e0628c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:32:33.105Z","phase":null} -->
## Claude thinking · 2026-07-30T22:32:33.105Z



uuid: dcbadda0-6396-406a-88bf-806390d317fb
parent: 7eb1df0e-9d68-4417-8b9a-a3a37e263b6b

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:32:35.808Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:32:35.808Z

```json
{
  "command": "echo \"=== client imports of server modules ===\" && grep -rn \"@/server/workers/entries-types\\|@/server/planning/review-preferences\\|from \\\"@/server\\|from '@/server\" src/components src/ui src/app/home src/lib src/runtime-api 2>/dev/null | head -30 && echo \"=== next/font ===\" && grep -rn \"next/font\\|next/dynamic\\|next/image\" src apps | head -20 && echo \"=== runtime imports from interface ===\" && grep -rn \"@/runtime/\" src/components src/ui src/app/home src/lib src/runtime-api 2>/dev/null | head -20",
  "description": "Check cross-boundary imports and Next-isms"
}

uuid: 2b12afbc-a177-4d6a-a1e0-197f13661d79
parent: dcbadda0-6396-406a-88bf-806390d317fb
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:32:35.876Z","phase":null} -->
## Claude tool result: toolu_01LVsgegfmvrLsr67rGGBCcb · 2026-07-30T22:32:35.876Z

```text
=== client imports of server modules ===
src/components/WorkerCard.tsx:16:import type { BridgeWorkerEntryType, WorkerEntry } from "@/server/workers/entries-types";
src/components/PlanningReviewControls.tsx:12:import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/components/Terminal.tsx:19:import type { WorkerEntry } from "@/server/workers/entries-types";
src/components/PlanningArtifactsPanel.tsx:14:import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/components/home/ConversationMain.tsx:41:import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/components/home/ConversationMain.tsx:42:import { WORKER_TYPE_LABELS, type SupportedWorkerType } from "@/server/supervisor/worker-types";
src/components/home/ConversationMain.tsx:43:import type { WorkerEntry } from "@/server/workers/entries-types";
src/app/home/PlanningReviewPreferencesManager.ts:11:} from "@/server/planning/review-preferences";
src/app/home/WorkerEntriesManager.ts:25:import type { WorkerEntry } from "@/server/workers/entries-types";
src/app/home/types.ts:6:import type { WorkerEntry } from "@/server/workers/entries-types";
src/app/home/useHomeMutations.ts:19:import type { PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/app/home/worker-elicitations.ts:1:import type { WorkerEntry } from "@/server/workers/entries-types";
src/app/home/direct-worker-stream-loading.ts:3:import type { WorkerEntry } from "@/server/workers/entries-types";
src/lib/agent-output.ts:1:import type { WorkerEntryChannel, WorkerEntryType } from "@/server/workers/entries-types";
src/app/home/ConversationTranscriptManager.ts:12:import type { WorkerEntry } from "@/server/workers/entries-types";
=== next/font ===
src/ui/OmniApp.tsx:4:import dynamic from "next/dynamic";
src/app/layout.tsx:2:import { Geist, Geist_Mono } from "next/font/google";
src/app/home/HomeApp.tsx:5:import dynamic from "next/dynamic";
src/components/Terminal.tsx:3:import Image from "next/image";
src/components/cli-brand-icons.tsx:2:import Image from "next/image";
src/components/AttachmentImagePreviewDialog.tsx:3:import Image from "next/image";
src/components/home/UserInputMessage.tsx:1:import Image from "next/image";
src/components/home/HomeHeader.tsx:2:import dynamic from "next/dynamic";
src/components/home/ConversationMain.tsx:2:import dynamic from "next/dynamic";
src/components/home/ConversationComposer.tsx:1:import Image from "next/image";
=== runtime imports from interface ===
src/ui/render-web.tsx:9:import type { HomeBootstrapPayload } from "@/runtime/bootstrap";
src/ui/OmniApp.tsx:6:import type { HomeBootstrapPayload } from "@/runtime/bootstrap";
src/app/home/bootstrap.server.ts:2:import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
src/app/home/bootstrap.server.ts:3:import type { HomeBootstrapPayload } from "@/runtime/bootstrap";

uuid: 411d25ee-37e6-46eb-be1f-cf9c836d179e
parent: 2b12afbc-a177-4d6a-a1e0-197f13661d79
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:32:44.745Z","phase":null} -->
## Claude thinking · 2026-07-30T22:32:44.745Z



uuid: b9cbdad3-9e74-4367-94fc-8ab6568621aa
parent: 411d25ee-37e6-46eb-be1f-cf9c836d179e

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:32:46.631Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:32:46.631Z

```json
{
  "command": "echo \"=== src/app/home server-side files ===\" && ls src/app/home | head -60 && echo \"=== who imports bootstrap.server ===\" && grep -rn \"bootstrap.server\" src apps tests 2>/dev/null | head && echo \"=== other server/runtime value imports under src/app/home ===\" && grep -rn \"from \\\"@/server/\\|from \\\"@/runtime/\" src/app/home | grep -v \"import type\" | head -20",
  "description": "Inspect src/app/home for server-only modules"
}

uuid: 92e57467-ac09-4f9d-b4b3-186ab72ef654
parent: b9cbdad3-9e74-4367-94fc-8ab6568621aa
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:32:46.782Z","phase":null} -->
## Claude tool result: toolu_019CdmQsn9mcngu2NS1pSvuk · 2026-07-30T22:32:46.782Z

```text
=== src/app/home server-side files ===
AppearancePreferencesManager.ts
BusyMessageQueueManager.ts
ClaudeModelGatewayManager.ts
ComposerContainer.tsx
ConversationNotificationManager.ts
ConversationTranscriptManager.ts
EventStreamSnapshotCacheManager.ts
EventStreamStateManager.ts
ExternalSessionsPicker.tsx
GitWorkspaceManager.ts
HomeApp.tsx
HomeUiStateManager.ts
LiveEventConnectionManager.ts
PlanningReviewPreferencesManager.ts
PreflightConfirmationActionsManager.ts
ProjectMemoryPanelManager.ts
SessionStateManager.ts
SettingsDraftManager.ts
SideWindowManager.ts
SidebarWorkerActivityManager.ts
WorkerEntriesManager.ts
account-labels.ts
auto-resume-selection.ts
bootstrap.server.ts
busy-message-behavior.ts
composer-keyboard.ts
constants.ts
direct-control-activity.ts
direct-worker-stream-loading.ts
recovery-utils.ts
side-window-viewport.ts
sidebar-activity.ts
supervisor-activity.ts
types.ts
upload-attachments.ts
useAppErrors.ts
useComposerController.ts
useConversationActions.ts
useConversationExecutionStatus.ts
useFrozenRecentOrder.ts
useHomeLayoutController.ts
useHomeLifecycle.ts
useHomeMutations.ts
useHomeQueries.ts
useHomeViewModel.ts
useQueuedMessageMutations.ts
useRunRecoveryState.ts
useRunSelectionEffects.ts
useTerminalPanelResize.ts
utils.ts
worker-elicitations.ts
=== who imports bootstrap.server ===
src/app/page.tsx:2:import { buildHomeBootstrap } from "./home/bootstrap.server";
src/app/home/HomeApp.tsx:67:import type { HomeBootstrapPayload } from "./bootstrap.server";
apps/vscode/webview/main.tsx:162:    void this.apis.native?.openExternal({ url: bootstrap.serverUrl });
apps/vscode/webview/main.tsx:246:        <div>{bootstrap.serverUrl}</div>
tests/ui/ssr-bootstrap.test.ts:34:    const homeBootstrapSource = readSource("src/app/home/bootstrap.server.ts");
=== other server/runtime value imports under src/app/home ===
src/app/home/PlanningReviewPreferencesManager.ts:11:} from "@/server/planning/review-preferences";
src/app/home/bootstrap.server.ts:2:import { buildRuntimeBootstrap } from "@/runtime/bootstrap";

uuid: 21fc7d14-2353-4309-896c-b8c76153bcfe
parent: 92e57467-ac09-4f9d-b4b3-186ab72ef654
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:33:00.659Z","phase":null} -->
## Claude thinking · 2026-07-30T22:33:00.659Z



uuid: 2752bb1b-d23a-4379-bc23-f341fe163665
parent: 21fc7d14-2353-4309-896c-b8c76153bcfe

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:33:01.167Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:33:01.167Z

```json
{
  "command": "ls src/app/ && echo \"=== tests referencing src/app paths ===\" && grep -rln \"src/app/\" tests | head -20",
  "description": "List src/app contents and tests referencing it"
}

uuid: 6fabcba0-b658-4287-8cb6-b45327eeb342
parent: 2752bb1b-d23a-4379-bc23-f341fe163665
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:33:01.209Z","phase":null} -->
## Claude tool result: toolu_01PdEoaP3L9id139aFMkAkoq · 2026-07-30T22:33:01.209Z

```text
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
=== tests referencing src/app paths ===
tests/ui/terminal-fit.test.ts
tests/ui/i18n-hardcoded-copy.test.ts
tests/ui/interactive-terminal.test.ts
tests/ui/settings-dialog.test.ts
tests/ui/claude-model-gateway-settings.test.tsx
tests/ui/branch-workspace-control.test.ts
tests/ui/pwa-bootstrap.test.ts
tests/ui/planning-review-controls.test.ts
tests/ui/theme-bootstrap.test.ts
tests/ui/file-attachment-picker-dialog.test.ts
tests/ui/sidebar-layout.test.ts
tests/ui/reload-conversation.test.ts
tests/ui/page-shell.test.ts
tests/ui/auth-boot-shell.test.ts
tests/ui/ssr-bootstrap.test.ts
tests/ui/composer-shell.test.ts
tests/ui/conversation-actions.test.ts
tests/server/supervisor-ordering-source.test.ts
tests/architecture/interface-boundary.test.ts
tests/server/git/run-auto-commit.test.ts

uuid: 3bf5f128-6684-4346-9202-683762337d64
parent: 6fabcba0-b658-4287-8cb6-b45327eeb342
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:33:03.778Z","phase":null} -->
## Claude thinking · 2026-07-30T22:33:03.778Z



uuid: da53f6e8-ad9b-4afe-a3d9-00538efc9421
parent: 3bf5f128-6684-4346-9202-683762337d64

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:33:04.999Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:33:04.999Z

```json
{
  "command": "wc -l tests/architecture/*.ts && head -60 tests/architecture/interface-boundary.test.ts && echo \"=== tests/ui path-reading tests (source-string based) ===\" && grep -rn \"src/app/\" tests/ui/*.ts tests/ui/*.tsx 2>/dev/null | wc -l",
  "description": "Inspect existing architecture boundary test"
}

uuid: 7914e547-8079-40dc-a6d7-a6476bde0702
parent: da53f6e8-ad9b-4afe-a3d9-00538efc9421
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:33:05.049Z","phase":null} -->
## Claude tool result: toolu_01FpZMkwTnWxHRDgipFC8mcf · 2026-07-30T22:33:05.049Z

```text
      52 tests/architecture/interface-boundary.test.ts
      49 tests/architecture/typecheck-projects.test.ts
     101 total
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../..");
const INTERFACE_ROOTS = [
  "src/app/home",
  "src/components",
  "src/runtime-api",
  "src/ui",
] as const;

function listTypeScriptFiles(relativeRoot: string): string[] {
  const absoluteRoot = path.join(REPOSITORY_ROOT, relativeRoot);
  const files: string[] = [];

  for (const entry of readdirSync(absoluteRoot)) {
    const absolutePath = path.join(absoluteRoot, entry);
    const relativePath = path.relative(REPOSITORY_ROOT, absolutePath);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listTypeScriptFiles(relativePath));
      continue;
    }
    if (/\.[cm]?tsx?$/.test(entry) && !entry.endsWith(".server.ts") && !entry.endsWith(".server.tsx")) {
      files.push(relativePath);
    }
  }

  return files;
}

function forbiddenImports(relativePath: string): string[] {
  const source = readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
  const violations: string[] = [];
  const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'](@\/(?:server|runtime)(?:\/[^"']*)?)["']/g;

  for (const match of source.matchAll(importPattern)) {
    violations.push(`${relativePath}: ${match[1]}`);
  }
  return violations;
}

describe("interface source boundary", () => {
  it("does not import runner or HTTP-runtime modules", () => {
    const violations = INTERFACE_ROOTS
      .flatMap(listTypeScriptFiles)
      .flatMap(forbiddenImports)
      .sort();

    expect(violations).toEqual([]);
  });
});
=== tests/ui path-reading tests (source-string based) ===
      91

uuid: 5db44e6c-8278-4af0-b1db-6442c79c44ad
parent: 7914e547-8079-40dc-a6d7-a6476bde0702
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:33:10.671Z","phase":null} -->
## Claude thinking · 2026-07-30T22:33:10.671Z



uuid: ee86daea-f6ad-4045-abf1-e7ab369f40a3
parent: 5db44e6c-8278-4af0-b1db-6442c79c44ad

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:33:11.621Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:33:11.621Z

```json
{
  "command": "timeout 180 npx vitest run tests/architecture/ 2>&1 | tail -40",
  "description": "Run existing architecture tests"
}

uuid: a045639d-1837-4dc6-8ec3-9b9391391073
parent: ee86daea-f6ad-4045-abf1-e7ab369f40a3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:33:11.681Z","phase":null} -->
## Claude tool result: toolu_01MiqQz9xz54jZw4qdGJBqxS · 2026-07-30T22:33:11.681Z

```text
(eval):1: command not found: timeout

uuid: 2fca630e-f039-4670-b182-3f3a0d37d70d
parent: a045639d-1837-4dc6-8ec3-9b9391391073
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T22:33:11.685Z","phase":null} -->
## Claude attachment · 2026-07-30T22:33:11.685Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: c74cad54-e23f-4fc6-b259-3a950d039436
parent: 2fca630e-f039-4670-b182-3f3a0d37d70d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-30T22:33:13.568Z","phase":null} -->
## Claude tool call: Bash · 2026-07-30T22:33:13.568Z

```json
{
  "command": "npx vitest run tests/architecture/ 2>&1 | tail -45",
  "description": "Run existing architecture tests",
  "timeout": 240000
}

uuid: 8da7ee8d-2396-45e7-981a-25db74dcba6d
parent: c74cad54-e23f-4fc6-b259-3a950d039436
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-30T22:33:15.346Z","phase":null} -->
## Claude tool result: toolu_01GeofppZ8hxVRvGdFUuhvjZ · 2026-07-30T22:33:15.346Z

```text
+ .pnpm-debug.log*
+
+ # env files
+ .env
+ .env.*
+ !.env.example
+
+ # vercel
+ .vercel
+
+ # typescript
+ *.tsbuildinfo
+ next-env.d.ts
+
+ # Per-run worker output entries — legacy global path
+ # (managed by src/server/workers/output-store.ts, kept as
+ # read-only/migration-source after append-only artifact migration).
+ run-data/
+
+ # Project-local append-only artifact streams (kept explicit for
+ # older Git clients and tests that probe this path directly).
+ **/.omniharness/run-data/
+

 ❯ tests/architecture/typecheck-projects.test.ts:41:23
     39| 
     40|     expect(gitignore).toContain("/dist/");
     41|     expect(gitignore).toContain("/apps/mobile/ios/App/Pods/");
       |                       ^
     42|     expect(gitignore).toContain("/apps/mobile/ios/DerivedData/");
     43|     expect(gitignore).toContain("/apps/mobile/android/.gradle/");

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯


 Test Files  2 failed (2)
      Tests  6 failed (6)
   Start at  00:33:14
   Duration  532ms (transform 47ms, setup 38ms, collect 20ms, tests 120ms, environment 0ms, prepare 208ms)

npm notice
npm notice New major version of npm available! 10.9.8 -> 12.0.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
npm notice To update run: npm install -g npm@12.0.2
npm notice

uuid: 77c63e57-aa86-4ffb-87ed-a1aaf09d92ee
parent: 8da7ee8d-2396-45e7-981a-25db74dcba6d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:33:51.506Z","phase":null} -->
## Claude thinking · 2026-07-30T22:33:51.506Z



uuid: ee29273d-b169-4dc9-b923-453c6211fcaf
parent: 77c63e57-aa86-4ffb-87ed-a1aaf09d92ee

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:34:34.310Z","phase":null} -->
## Claude · 2026-07-30T22:34:34.310Z

Read all three documents, then verified the plan's claims against the actual repo (imports, existing architecture tests, 3035 references, workspace file).

## (1) Verdict: **HARDEN**

F3, F4, F5, F7, F8, F9, F10, F11 are genuinely resolved. F1, F2, F6 are partially resolved and, as written, F1's fix (Task 11A) introduces a new dependency-order bug. One spec-required work item (Next-ism removal) is owned by no task and blocks Task 8.

---

## (2) Remaining implementation blockers

**B1 — Task 11A moves a Next-server module into the interface tree (new ordering bug from the F1 fix).**
`src/app/home/bootstrap.server.ts:2` does `import { buildRuntimeBootstrap } from "@/runtime/bootstrap"` — a *value* import. Its only value consumer is `src/app/page.tsx:2`, deleted in Task 11. But plan:133-136 enumerates removals and states "No file outside this enumerated list is removed", so it survives Task 11; plan:277 then moves all of `src/app/home/**` with "import-path-only changes", landing runner code in `src/interface/home/`. That breaks 11A's own new test (plan:276), the Task 1 ESLint rule, and Task 2's "Vite module graph contains no server/runtime source". Two dependents also need repointing: `HomeApp.tsx:67` type-imports `HomeBootstrapPayload` from `./bootstrap.server`, and `tests/ui/ssr-bootstrap.test.ts:34` reads the file by path.
*Edit:* add `src/app/home/bootstrap.server.ts` to the Task 11 removal list (plan:133) alongside `page.tsx`/`layout.tsx`; add a Task 2 bullet repointing `HomeApp.tsx` to `@/shared/bootstrap`; add `tests/ui/ssr-bootstrap.test.ts` to Task 11's Files with a bullet retargeting it at the runner bootstrap route.

**B2 — Task 1's exit gate is unsatisfiable until Task 2.**
Plan:160 says "Verify the architecture tests, `pnpm lint`, and each `tsc -p ... --noEmit`". `tests/architecture/interface-boundary.test.ts` already exists and is red (I ran it: 6 failures across both files) for 15 client→server imports that Task 2 fixes — `src/components/WorkerCard.tsx:16`, `Terminal.tsx:19`, `PlanningReviewControls.tsx:12`, `PlanningArtifactsPanel.tsx:14`, `home/ConversationMain.tsx:41-43`, `src/lib/agent-output.ts:1`, `src/app/home/{types,WorkerEntriesManager,useHomeMutations,worker-elicitations,direct-worker-stream-loading,ConversationTranscriptManager,PlanningReviewPreferencesManager}.ts`. The ESLint restriction added at plan:159 makes `pnpm lint` fail for the same reason.
*Edit:* change plan:160 to "Verify the typecheck-project and `.gitignore` tests pass; confirm `interface-boundary.test.ts` fails with exactly the enumerated Task 2 violations and no others. Land the ESLint `no-restricted-imports` rule as `warn` in Task 1 and flip it to `error` in Task 2." Add "flip the ESLint rule to `error` and turn `interface-boundary.test.ts` green" as Task 2's final bullet (plan:170).

**B3 — Next-ism removal is owned by no task, blocking Task 8.**
Spec §4.4 requires `next/dynamic`→`React.lazy`, `next/image`→`<img>`, `next/font/google`→`@fontsource`. Ten live imports remain: `src/ui/OmniApp.tsx:4`, `src/app/home/HomeApp.tsx:5`, `src/components/home/{HomeHeader.tsx:2,ConversationMain.tsx:2}` (dynamic); `src/components/{Terminal.tsx:3,cli-brand-icons.tsx:2,AttachmentImagePreviewDialog.tsx:3,home/UserInputMessage.tsx:1,home/ConversationComposer.tsx:1}` (image); `src/app/layout.tsx:2` (font). Task 8 keeps rendering through `src/ui/render-web.tsx` → `OmniApp.tsx`, so the Vite build test at plan:232 cannot pass.
*Edit:* insert a bullet before plan:233: "Replace `next/dynamic` with `React.lazy` + `Suspense` (4 files), `next/image` with `<img>` (5 files), and port `next/font/google` Geist/Geist_Mono to self-hosted `@fontsource` in the interface HTML; add the `@fontsource` dependencies to `package.json`." Add those nine component files to Task 8's Files list.

**B4 — Task 11's 3035 assertion will fail against the project's own historical documents.**
Plan:266 excludes only `docs/codex-history/**`. `3035` currently appears in 18 files under `docs/superpowers/{plans,specs,learnings,journeys}/**` (including this plan and the spec being reviewed) and 3 historical lesson docs under `docs/architecture/` (`frontend-state-and-rendering.md`, `hot-path-responsiveness-and-resource-leaks.md`, `conversation-ui-regression-lessons.md`). Rewriting those is wrong and, per AGENTS.md, deleting them is unauthorized.
*Edit:* rewrite plan:266 to "…outside `docs/codex-history/**`, `docs/superpowers/**`, and dated retrospective docs under `docs/architecture/**`; update or retire each live source/script/config/test/operator-doc reference (`AGENTS.md:12`, `playwright.live.config.ts`, `scripts/{dev,dev-compression-proxy,remote-restart,measure-local-dev,free-port,cleanup-live-agent-journey}`, `apps/{electron,vscode}/README.md`, `docs/architecture/common-runtime-multi-surface.md`, and the six 3035-bearing tests already listed in this task's Files), and add a test asserting no live reference remains under that exclusion set." Also add: "retiring the dev proxy script does not remove the compressing-proxy SSE harness proven in Task 4."

**B5 — Deep links are only half-resolved (F2).**
Task 9 (plan:244) fixes server-side path parsing, but spec:638 requires "all URL deep links (`/session/:runId`) resolve against the active runner only" — run ids are unique per runner. No bullet in Task 19 or 20 covers this.
*Edit:* add to Task 19 (after plan:371): "Resolve `/session/:runId` deep links against the active runner only; a deep link that does not match the active runner's snapshot surfaces an explicit not-found state rather than probing other connections. Test deep-link arrival while a different runner is active."

**B6 — Spec-required CLI/auth surfaces owned by no task.**
- `omni runner rekey` and the "valid same-origin session automatically re-pins after rekey; remote profiles require explicit login" rule (spec:517, 554) — Task 17 has rename only. *Edit:* add a bullet to Task 17 after plan:350, and a Task 18 test for the same-origin auto-re-pin versus remote-blocked path.
- `omni auth init` alias + `--password-file` (mode `0600`) unattended provisioning (spec:391-395). *Edit:* add a bullet to Task 17 with a mode-check failure test.
- Token handling: `--runner <url>` with `OMNI_TOKEN` / `--token-file` / stdin, never a bare `--token` argv except as an explicitly warned compatibility flag (spec:798-800). Plan:348 is too vague to test. *Edit:* restate that rule verbatim in plan:348 with a test asserting no token appears in `process.argv`.

**B7 — Two invariants missing from Task 18/14 acceptance.**
- Spec:560 requires the web profile store to always carry a **non-deletable same-origin profile**, and spec:557-559 requires corrupt-store recovery to "reset to same-origin default + toast, never a crash". Task 18 (plan:357-361) covers versioning and forget, but neither invariant. *Edit:* add to plan:359: "…including a non-deletable same-origin profile that survives migration and corrupt-store reset-to-default with a visible notice."
- Spec:313 requires "cookie tokens are never accepted as bearer tokens and bearer tokens are never accepted as cookies". Not in Task 14's test list. *Edit:* append it to plan:315.

**Non-blocking note:** `pnpm-workspace.yaml` currently has no `packages:` key at all, so the root is a single non-workspace package. Task 24's `packages: ["apps/mobile"]` converts the root into a workspace root; plan:420 already requires proving Electron/VSCode builds are unchanged, which covers it — no edit needed, but expect lockfile churn.

---

## (3) Deliberate non-goals (correctly scoped, do not re-open)

- Package extraction to `packages/shared|runner|interface` (Approach B); repo stays one pnpm package.
- Merged cross-runner dashboards, runner-to-runner handoff, cross-runner push relay.
- Native push after mobile OS suspension; "all runners connected" is scoped to app-process-active only.
- Multi-user accounts, roles, device pairing secrets, DPoP/cryptographic token binding. Bearer tokens remain replayable secrets protected by origin binding.
- Horizontal scaling of the API server; the module-level event ring and PTY ownership keep it single-process by design.
- Tauri as a desktop alternative.
- QR/pair-token flow retained for existing web users but carries no new dependency.
- Web `connect-src` cannot prevent exfiltration after same-origin script compromise — explicitly accepted, not mitigated.
- Trusted Types may ship enforced *or* as a documented narrow report-only exception; it cannot silently remain untested.
- Memory thresholds are a controlled local benchmark gate, not a CI-hardware assertion.

uuid: c595f4be-eb95-41ab-bb69-2cde4298f82d
parent: ee29273d-b169-4dc9-b923-453c6211fcaf

<!-- /codex-event -->

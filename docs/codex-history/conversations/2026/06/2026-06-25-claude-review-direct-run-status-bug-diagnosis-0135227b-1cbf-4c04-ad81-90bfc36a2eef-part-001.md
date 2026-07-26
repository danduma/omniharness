---
provider: "claude"
codex_thread_id: "0135227b-1cbf-4c04-ad81-90bfc36a2eef"
title: "Review direct-run status bug diagnosis"
started_at: "2026-06-25T21:19:47.880Z"
updated_at: "2026-06-25T21:23:57.717Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review direct-run status bug diagnosis

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-25T21:19:47.880Z","phase":null} -->
## Claude state: queue-operation · 2026-06-25T21:19:47.880Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-06-25T21:19:47.880Z",
  "sessionId": "0135227b-1cbf-4c04-ad81-90bfc36a2eef",
  "content": "In /Users/masterman/NLP/omniharness, review this bug diagnosis without editing files: direct-control session 279f067d7f7c had a Claude AskUserQuestion elicitation in the unified worker stream (pending requestId 2, then answered), but the UI showed a generic 'Asking for your input' / 'Please answer...' and state bounced between working and not working. Current dirty tree already changes direct-run-status to use structured pending human input instead of prose regex. I plan to patch resolveDirectRunStatusFromWorkerOutput to accept workerStatus/agent state so it returns awaiting_user only for open permission/elicitation, running for active worker states, done only for non-active output; update sync/create/send/recovery/reaper call sites to pass worker state; add tests. Please identify any missed call sites or better invariant. Do not modify files."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-25T21:19:47.880Z","phase":null} -->
## Claude state: queue-operation · 2026-06-25T21:19:47.880Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-06-25T21:19:47.880Z",
  "sessionId": "0135227b-1cbf-4c04-ad81-90bfc36a2eef"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-25T21:19:47.908Z","phase":null} -->
## User · 2026-06-25T21:19:47.908Z

In /Users/masterman/NLP/omniharness, review this bug diagnosis without editing files: direct-control session 279f067d7f7c had a Claude AskUserQuestion elicitation in the unified worker stream (pending requestId 2, then answered), but the UI showed a generic 'Asking for your input' / 'Please answer...' and state bounced between working and not working. Current dirty tree already changes direct-run-status to use structured pending human input instead of prose regex. I plan to patch resolveDirectRunStatusFromWorkerOutput to accept workerStatus/agent state so it returns awaiting_user only for open permission/elicitation, running for active worker states, done only for non-active output; update sync/create/send/recovery/reaper call sites to pass worker state; add tests. Please identify any missed call sites or better invariant. Do not modify files.

uuid: 8d004e87-3c29-4089-a8d6-bc24cc117757

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-25T21:19:47.908Z","phase":null} -->
## Claude attachment · 2026-06-25T21:19:47.908Z

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

uuid: 51b8daad-4b55-4333-a290-36fd65632e53
parent: 8d004e87-3c29-4089-a8d6-bc24cc117757
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-25T21:19:47.908Z","phase":null} -->
## Claude attachment · 2026-06-25T21:19:47.908Z

```text
{
  "type": "skill_listing",
  "content": "- agentic-user-journey-testing: Use when validating app, UI, or product-surface work through the running app, especially when logs/tests pass but a user job may still be blocked or unclear\n- brainstorming: Use before substantial product, UI, feature, or behavior work with ambiguity, user-journey impact, or multiple plausible approaches\n- building-react-apps: Use when building, refactoring, planning, or debugging React or Next.js apps, React components, hooks, routing, frontend state, SSR, hydration, bundles, imports, or UI settings\n- client-server-state-invariants: Use when planning, building, reviewing, or debugging React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization\n- designing-settings-dialogs: Use when designing, planning, building, or reviewing settings dialogs, settings dialogues, preferences panels, configuration modals, option tabs, or UI settings surfaces\n- dispatching-parallel-agents: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies\n- executing-plans: Use when you have a written implementation plan to execute inline with review checkpoints\n- find-skills: Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.\n- implementing-react-i18n: Use when adding, fixing, or reviewing React internationalization, language selectors, locale resources, translated UI copy, or bugs where changing language does not update user-facing strings\n- improve: Survey any codebase as a senior advisor and produce prioritized, self-contained implementation plans for OTHER models/agents to execute. Strictly read-only on source code — never implements, fixes, or refactors anything itself. Use when asked to audit a codebase, find improvement opportunities (bugs, security, performance, test coverage, tech debt, migrations, DX), suggest features or where to take the project next (roadmap, product direction), or generate handoff plans for another agent to implement.\n- instrumenting-control-planes: Use when building, planning, reviewing, or debugging apps with backend decisions, agent workflows, long-running jobs, SSE/WebSocket streams, recovery paths, deletes, retries, or user-visible failures\n- learning-from-bugs: Use when a meaningful bug, regression, architecture flaw, storage issue, memory problem, persistence failure, control-plane failure, or system-level failure has been diagnosed or fixed\n- optimizing-react-next-apps: Use when a React or Next.js app feels slow, cluttered, overbundled, slow to compile, slow to load, ineffective at SSR, hydration-heavy, or likely burdened by unnecessary imports or UI dependencies\n- receiving-code-review: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation\n- requesting-code-review: Use when completing tasks, implementing major features, or before merging to verify work meets requirements\n- second-opinion: Use when writing or hardening substantial specs, implementation plans, architecture plans, design plans, or unusually hard creative decisions before execution\n- subagent-driven-development: Use when executing implementation plans with independent tasks in the current session\n- systematic-debugging: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes\n- test-driven-development: Use when implementing any feature or bugfix, before writing implementation code\n- using-ultrapowers: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before acting\n- verification-before-completion: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always\n- writing-plans: Use when you have an approved spec or clear requirements for a multi-step task, before implementation\n- writing-skills: Use when creating new skills, editing existing skills, or verifying skills work before deployment\n- deep-research: Deep research harness — fan-out web searches, fetch sources, adversarially verify claims, synthesize a cited report. - When the user wants a deep, multi-source, fact-checked research report on any topic. BEFORE invoking, check if the question is specific enough to research directly — if underspecified (e.g., \"what car to buy\" without budget/use-case/region), ask 2-3 clarifying questions to narrow scope. Then pass the refined question as args, weaving the answers in.\n- update-config: Use this skill to configure the Claude Code harness via settings.json. Automated behaviors (\"from now on when X\", \"each time X\", \"whenever X\", \"before/after X\") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions (\"allow X\", \"add permission\", \"move permission to\"), env vars (\"set X=Y\"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: \"allow npm commands\", \"add bq permission to global settings\", \"move permission to user settings\", \"set DEBUG=true\", \"when claude stops show X\". For simple settings like theme/model, suggest the /config command.\n- keybindings-help: Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: \"rebind ctrl+s\", \"add a chord shortcut\", \"change the submit key\", \"customize keybindings\".\n- verify: Verify that a code change actually does what it's supposed to by running the app and observing behavior. Use when asked to verify a PR, confirm a fix works, test a change manually, check that a feature works, or validate local changes before pushing.\n- code-review: Review the current diff for correctness bugs and reuse/simplification/efficiency cleanups at the given effort level (low/medium: fewer, high-confidence findings; high→max: broader coverage, may include uncertain findings). Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review.\n- simplify: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.\n- fewer-permission-prompts: Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.\n- loop: Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace. - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. \"check the deploy every 5 minutes\", \"keep running /babysit-prs\"). Do NOT invoke for one-off tasks.\n- claude-api: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.\nTRIGGER — read BEFORE opening the target file; don't skip because it \"looks like a one-liner\" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).\nSKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file).\n- run: Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).\n- init: Initialize a new CLAUDE.md file with codebase documentation\n- review: Review a GitHub pull request; for your working diff use /code-review\n- security-review: Complete a security review of the pending changes on the current branch",
  "skillCount": 36,
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
    "deep-research",
    "update-config",
    "keybindings-help",
    "verify",
    "code-review",
    "simplify",
    "fewer-permission-prompts",
    "loop",
    "claude-api",
    "run",
    "init",
    "review",
    "security-review"
  ]
}

binary omitted from archive

uuid: 21a0c314-9969-4ab9-a056-4a87af05f273
parent: 51b8daad-4b55-4333-a290-36fd65632e53
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:19:53.591Z","phase":null} -->
## Claude thinking · 2026-06-25T21:19:53.591Z

I need to review this bug diagnosis without making edits, so I'm starting by exploring the code structure to understand `resolveDirectRunStatusFromWorkerOutput` and where it's being called from.

uuid: 4be114f0-663a-430c-a6eb-e4abfd66b670
parent: 21a0c314-9969-4ab9-a056-4a87af05f273

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:19:53.597Z","phase":null} -->
## Claude · 2026-06-25T21:19:53.597Z

I'll review this bug diagnosis. Let me explore the relevant code to understand the current state and identify any missed call sites or better invariants.

uuid: 6a6acc26-41ca-4b30-8fdd-3faef12e4164
parent: 4be114f0-663a-430c-a6eb-e4abfd66b670

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:19:53.614Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:19:53.614Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/direct-run-status.ts"
}

uuid: f96ce814-6e2c-44a7-a3d2-34efc91943d4
parent: 6a6acc26-41ca-4b30-8fdd-3faef12e4164
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:19:53.631Z","phase":null} -->
## Claude tool result: toolu_01NzTatR4uqo1NuACkNNweSb · 2026-06-25T21:19:53.631Z

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
17	  responseText?: string | null;
18	  renderedOutput?: string | null;
19	  currentText?: string | null;
20	  lastText?: string | null;
21	  outputLog?: string | null;
22	  outputEntries?: readonly OutputEntryLike[] | null;
23	  outputEntriesJson?: string | null;
24	  pendingPermissions?: readonly unknown[] | null;
25	  pendingElicitations?: readonly unknown[] | null;
26	};
27	
28	function parseOutputEntriesJson(value: string | null | undefined): OutputEntryLike[] {
29	  if (!value?.trim()) {
30	    return [];
31	  }
32	
33	  try {
34	    const parsed = JSON.parse(value) as unknown;
35	    return Array.isArray(parsed) ? parsed.filter((entry): entry is OutputEntryLike => {
36	      return typeof entry === "object" && entry !== null;
37	    }) : [];
38	  } catch {
39	    return [];
40	  }
41	}
42	
43	function visibleEntryText(entries: readonly OutputEntryLike[] | null | undefined) {
44	  return (entries ?? [])
45	    .filter((entry) => !entry.type || entry.type === "message")
46	    .map((entry) => entry.text ?? "")
47	    .filter((text) => text.trim().length > 0);
48	}
49	
50	function latestVisibleEntryText(entries: readonly OutputEntryLike[] | null | undefined) {
51	  return visibleEntryText(entries).at(-1) ?? "";
52	}
53	
54	function firstNonEmptyText(values: ReadonlyArray<string | null | undefined>) {
55	  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
56	}
57	
58	function isOpenHumanInputEntry(entry: OutputEntryLike) {
59	  if (entry.type !== "permission" && entry.type !== "elicitation") {
60	    return false;
61	  }
62	  const status = (entry.status ?? "pending").trim().toLowerCase();
63	  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected", "skipped"].includes(status);
64	}
65	
66	function entryRequestId(entry: OutputEntryLike) {
67	  const raw = entry.raw;
68	  if (typeof raw !== "object" || raw === null) {
69	    return null;
70	  }
71	  const requestId = (raw as { requestId?: unknown }).requestId;
72	  return typeof requestId === "number" && Number.isFinite(requestId) ? requestId : null;
73	}
74	
75	function entriesHaveOpenHumanInput(entries: readonly OutputEntryLike[]) {
76	  const pendingByRequestId = new Map<string, boolean>();
77	
78	  for (const entry of entries) {
79	    if (entry.type !== "permission" && entry.type !== "elicitation") {
80	      continue;
81	    }
82	
83	    const open = isOpenHumanInputEntry(entry);
84	    const requestId = entryRequestId(entry);
85	    if (requestId === null) {
86	      if (open) {
87	        return true;
88	      }
89	      continue;
90	    }
91	
92	    pendingByRequestId.set(`${entry.type}:${requestId}`, open);
93	  }
94	
95	  return [...pendingByRequestId.values()].some(Boolean);
96	}
97	
98	export function directWorkerOutputHasPendingHumanInput(source: WorkerOutputSource) {
99	  return (
100	    (source.pendingPermissions?.length ?? 0) > 0
101	    || (source.pendingElicitations?.length ?? 0) > 0
102	    || entriesHaveOpenHumanInput(source.outputEntries ?? [])
103	    || entriesHaveOpenHumanInput(parseOutputEntriesJson(source.outputEntriesJson))
104	  );
105	}
106	
107	export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
108	  return directWorkerOutputHasPendingHumanInput(source) ? "awaiting_user" : "done";
109	}
110	
111	export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
112	  runId: string;
113	  workerId?: string | null;
114	}) {
115	  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
116	  if (!run || (run.mode !== "direct" && run.mode !== "commit")) {
117	    return null;
118	  }
119	
120	  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
121	  const now = new Date();
122	  await db.update(runs).set({
123	    status: nextStatus,
124	    failedAt: null,
125	    lastError: null,
126	    updatedAt: now,
127	  }).where(eq(runs.id, args.runId));
128	
129	  if (nextStatus === "awaiting_user" && run.status !== "awaiting_user") {
130	    emitNamedEvent({
131	      kind: "conversation.awaiting_user",
132	      runId: args.runId,
133	      workerId: args.workerId ?? undefined,
134	      reason: "worker_requested_input",
135	    });
136	    await recordExecutionEvent({
137	      runId: args.runId,
138	      workerId: args.workerId ?? null,
139	      planItemId: null,
140	      eventType: "direct_worker_awaiting_user",
141	      details: { reason: "worker_requested_input" },
142	      createdAt: now,
143	    });
144	  } else if (run.mode === "direct" && nextStatus === "done" && run.status !== "done") {
145	    await runMilestoneAutoCommit(args.runId, firstNonEmptyText([
146	      args.responseText,
147	      args.currentText,
148	      args.lastText,
149	      latestVisibleEntryText(args.outputEntries),
150	      latestVisibleEntryText(parseOutputEntriesJson(args.outputEntriesJson)),
151	      args.renderedOutput,
152	      args.outputLog,
153	    ]));
154	    notifyEventStreamSubscribers();
155	  } else if (nextStatus !== run.status || run.failedAt || run.lastError) {
156	    notifyEventStreamSubscribers();
157	  }
158	
159	  return nextStatus;
160	}
161	
162	export async function updateDirectRunAwaitingUserInputIfRequested(args: WorkerOutputSource & {
163	  runId: string;
164	  workerId?: string | null;
165	}) {
166	  if (!directWorkerOutputHasPendingHumanInput(args)) {
167	    return false;
168	  }
169	
170	  await updateDirectRunStatusFromWorkerOutput(args);
171	  return true;
172	}
173	

uuid: 70c9019f-e362-4b2a-88af-849a7843235a
parent: f96ce814-6e2c-44a7-a3d2-34efc91943d4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:19:53.713Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:19:53.713Z

```json
{
  "command": "git diff --stat HEAD",
  "description": "Show diff stat of dirty tree"
}

uuid: 9a788c2e-6795-485b-a084-ab2bae126471
parent: 70c9019f-e362-4b2a-88af-849a7843235a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:19:54.176Z","phase":null} -->
## Claude tool result: toolu_012zH1rz1CNspjjsxWcYXiMQ · 2026-06-25T21:19:54.176Z

```text
 plans/001-verification-ci-and-typecheck-script.md  |  30 +++-
 plans/README.md                                    |  54 ++++++-
 src/app/home/direct-control-activity.ts            |   2 +-
 src/app/home/useConversationActions.ts             |   3 -
 src/app/home/useConversationExecutionStatus.ts     |   2 +-
 src/components/WorkerCard.tsx                      |  19 ++-
 src/server/conversations/create.ts                 |   5 +
 src/server/conversations/direct-run-status.ts      |  83 ++++++----
 .../conversations/queued-message-interrupt.ts      |   6 +-
 src/server/conversations/queued-messages.ts        |  85 ++++++++++-
 src/server/conversations/send-message.ts           |   8 +-
 src/server/conversations/sync.ts                   |  20 ++-
 src/server/git/auto-commit.ts                      |  12 +-
 src/server/runs/recovery-reconciler.ts             |   2 +
 tests/api/conversation-messages-route.test.ts      |   8 +
 tests/api/conversations-route.test.ts              |  54 +++++++
 tests/app/home-ui-state-manager.test.ts            |  13 ++
 tests/app/home-utils.test.ts                       |   2 +-
 tests/conversations/direct-run-status.test.ts      |  41 ++++-
 tests/server/conversations-sync.test.ts            | 167 ++++++++++++++++++++-
 tests/server/git/auto-commit.test.ts               |  31 +++-
 tests/server/git/run-auto-commit.test.ts           |  43 +++++-
 tests/server/queued-messages.test.ts               |   2 +-
 tests/ui/composer-shell.test.ts                    |  17 +++
 24 files changed, 627 insertions(+), 82 deletions(-)

uuid: 1018e0a3-046d-4cda-8385-b655e252a106
parent: 9a788c2e-6795-485b-a084-ab2bae126471
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:19:54.778Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:19:54.778Z

```json
{
  "command": "grep -rn \"resolveDirectRunStatusFromWorkerOutput\\|resolveDirectRunStatus\" src/ tests/ --include=\"*.ts\" --include=\"*.tsx\"",
  "description": "Find all call sites of resolveDirectRunStatus functions"
}

uuid: 795f4855-0d4d-414d-924e-fb8a72e6d703
parent: 1018e0a3-046d-4cda-8385-b655e252a106
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:19:54.829Z","phase":null} -->
## Claude tool result: toolu_01McBstH833JuiALnw2soXwW · 2026-06-25T21:19:54.829Z

```text
src/server/conversations/sync.ts:18:  resolveDirectRunStatusFromWorkerOutput,
src/server/conversations/sync.ts:140:  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(agent) === "awaiting_user") {
src/server/conversations/sync.ts:169:  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(worker) === "awaiting_user") {
src/server/conversations/direct-run-status.ts:107:export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
src/server/conversations/direct-run-status.ts:120:  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
src/server/runs/recovery-reconciler.ts:11:import { resolveDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
src/server/runs/recovery-reconciler.ts:222:    ? resolveDirectRunStatusFromWorkerOutput({

uuid: 84c7c2d4-ef42-4e43-8f35-c121e8263336
parent: 795f4855-0d4d-414d-924e-fb8a72e6d703
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:19:58.939Z","phase":null} -->
## Claude thinking · 2026-06-25T21:19:58.939Z

I'm examining the call sites to understand how to modify `resolveDirectRunStatusFromWorkerOutput` so it can accept worker status and agent state, allowing it to return `awaiting_user` only for open permission or elicitation requests, `running` for active worker states, and `done` only when the worker is no longer active.

uuid: dc34e672-8398-4c47-94b8-a3b8d3d26075
parent: 84c7c2d4-ef42-4e43-8f35-c121e8263336

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:19:58.979Z","phase":null} -->
## Claude · 2026-06-25T21:19:58.979Z

Let me examine the call sites and related state machinery in detail.

uuid: 4f75a2ee-c6fb-446e-b463-39a6bd73b0d6
parent: dc34e672-8398-4c47-94b8-a3b8d3d26075

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:19:59.728Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:19:59.728Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/sync.ts"
}

uuid: c2673ef1-7be2-4915-8ae2-5af374b29ebd
parent: 4f75a2ee-c6fb-446e-b463-39a6bd73b0d6
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:20:00.042Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:20:00.042Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/runs/recovery-reconciler.ts",
  "offset": 180,
  "limit": 90
}

uuid: 943b392a-8096-44cf-b91b-b3525761e946
parent: c2673ef1-7be2-4915-8ae2-5af374b29ebd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:20:00.049Z","phase":null} -->
## Claude tool result: toolu_013fubfcGSUAyybu7UR5Spxo · 2026-06-25T21:20:00.049Z

```text
1	import { and, eq } from "drizzle-orm";
2	import { db } from "@/server/db";
3	import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
4	import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
5	import { listAgents, normalizeAgentRecord, type AgentRecord } from "@/server/bridge-client";
6	import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
7	import { recordExecutionEvent } from "@/server/events/execution-event-store";
8	import { emitNamedEvent } from "@/server/events/named-events";
9	import { persistRunFailure } from "@/server/runs/failures";
10	import { isTerminalRunStatus } from "@/server/runs/status";
11	import { isLongWorkerCompletionText } from "@/server/supervisor/worker-completion";
12	import { startSupervisorRun } from "@/server/supervisor/start";
13	import { isRecoverableConnectionSupervisorError, isTransientSupervisorError } from "@/server/supervisor/retry";
14	import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";
15	import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
16	import { drainQueuedWorkerMessages } from "./queued-messages";
17	import {
18	  resolveDirectRunStatusFromWorkerOutput,
19	  updateDirectRunStatusFromWorkerOutput,
20	} from "./direct-run-status";
21	
22	const EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output.";
23	const MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";
24	
25	function isDirectRunMode(mode: string | null | undefined) {
26	  return mode === "direct" || mode === "commit";
27	}
28	
29	function hasAgentOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
30	  return Boolean(
31	    agent.renderedOutput?.trim()
32	    || agent.currentText.trim()
33	    || agent.lastText.trim()
34	    || agent.outputEntries?.some((entry) => entry.text.trim()),
35	  );
36	}
37	
38	function normalizedStatus(value: string | null | undefined) {
39	  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
40	}
41	
42	function isCompletedEntryStatus(value: string | null | undefined) {
43	  const status = normalizedStatus(value);
44	  return !status || [
45	    "approved",
46	    "cancelled",
47	    "canceled",
48	    "completed",
49	    "denied",
50	    "error",
51	    "failed",
52	    "success",
53	  ].includes(status);
54	}
55	
56	function isInputEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
57	  const type = (entry as { type?: string | null }).type;
58	  return type === "user_input" || type === "supervisor_input";
59	}
60	
61	function isOpenWorkEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
62	  if (entry.type !== "tool_call" && entry.type !== "tool_call_update" && entry.type !== "permission" && entry.type !== "elicitation") {
63	    return false;
64	  }
65	
66	  return !isCompletedEntryStatus(entry.status);
67	}
68	
69	function hasPendingElicitationSignal(snapshot: ReturnType<typeof normalizeAgentRecord> | null) {
70	  return Boolean(
71	    (snapshot?.pendingElicitations?.length ?? 0) > 0
72	    || snapshot?.outputEntries?.some((entry) => entry.type === "elicitation" && !isCompletedEntryStatus(entry.status)),
73	  );
74	}
75	
76	function directLiveAgentHasCompletedTurn(agent: ReturnType<typeof normalizeAgentRecord>) {
77	  const state = normalizedStatus(agent.state);
78	  if (state !== "working" && state !== "starting" && state !== "stuck") {
79	    return false;
80	  }
81	
82	  if (!agent.stopReason?.trim() && !isLongWorkerCompletionText(agent.currentText || agent.lastText || agent.renderedOutput)) {
83	    return false;
84	  }
85	
86	  if ((agent.pendingPermissions?.length ?? 0) > 0) {
87	    return false;
88	  }
89	
90	  if ((agent.pendingElicitations?.length ?? 0) > 0) {
91	    return false;
92	  }
93	
94	  const entries = agent.outputEntries ?? [];
95	  if (entries.length === 0) {
96	    return false;
97	  }
98	
99	  const lastInputIndex = entries.findLastIndex(isInputEntry);
100	  const turnEntries = entries.slice(lastInputIndex + 1);
101	  if (turnEntries.some(isOpenWorkEntry)) {
102	    return false;
103	  }
104	
105	  const currentText = agent.currentText.trim();
106	  const lastText = agent.lastText.trim();
107	  if (currentText && lastText && currentText !== lastText) {
108	    return false;
109	  }
110	
111	  const latestMeaningfulEntry = [...turnEntries].reverse().find((entry) => (
112	    entry.status !== "archived"
113	    && entry.text.trim().length > 0
114	  ));
115	
116	  return latestMeaningfulEntry?.type === "message";
117	}
118	
119	async function hasPersistedWorkerOutput(worker: typeof workers.$inferSelect) {
120	  if (
121	    worker.outputLog.trim()
122	    || worker.currentText.trim()
123	    || worker.lastText.trim()
124	  ) {
125	    return true;
126	  }
127	
128	  const entries = await readWorkerOutputEntries(worker.runId, worker.id);
129	  return entries.some((entry) => {
130	    const text = (entry as { text?: unknown }).text;
131	    return typeof text === "string" && text.trim().length > 0;
132	  });
133	}
134	
135	function resolveSyncedRunState(run: typeof runs.$inferSelect, agent: ReturnType<typeof normalizeAgentRecord>) {
136	  if (agent.state === "error") {
137	    return "failed";
138	  }
139	
140	  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(agent) === "awaiting_user") {
141	    return "awaiting_user";
142	  }
143	
144	  if (isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent)) {
145	    return "done";
146	  }
147	
148	  if (isDirectRunMode(run.mode) && agent.state === "idle" && hasAgentOutput(agent)) {
149	    return "done";
150	  }
151	
152	  if (
153	    ["stopped", "cancelled", "done", "completed"].includes(agent.state)
154	    || (agent.state === "idle" && agent.stopReason === "end_turn" && hasAgentOutput(agent))
155	  ) {
156	    return "done";
157	  }
158	
159	  return "running";
160	}
161	
162	async function resolvePersistedRunState(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
163	  const status = normalizedStatus(worker.status);
164	
165	  if (status === "error") {
166	    return "failed";
167	  }
168	
169	  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(worker) === "awaiting_user") {
170	    return "awaiting_user";
171	  }
172	
173	  if (
174	    ["stopped", "cancelled", "done", "completed"].includes(status)
175	    || (status === "idle" && await hasPersistedWorkerOutput(worker))
176	  ) {
177	    return "done";
178	  }
179	
180	  return "running";
181	}
182	
183	async function isEmptyIdlePersistedWorker(worker: typeof workers.$inferSelect) {
184	  const status = normalizedStatus(worker.status);
185	  return status === "idle" && !(await hasPersistedWorkerOutput(worker));
186	}
187	
188	function isIdleLiveAgentWithoutOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
189	  return agent.state === "idle" && !hasAgentOutput(agent);
190	}
191	
192	function isAgentBusyRunFailure(run: typeof runs.$inferSelect) {
193	  return run.status === "failed" && /\bagent is busy\b/i.test(run.lastError ?? "");
194	}
195	
196	function isRecoverableImplementationTransientFailure(run: typeof runs.$inferSelect) {
197	  const lastError = run.lastError ?? "";
198	  return run.mode === "implementation"
199	    && run.status === "failed"
200	    && Boolean(lastError.trim())
201	    && isTransientSupervisorError(new Error(lastError));
202	}
203	
204	function isRecoverableImplementationConnectionFailure(run: typeof runs.$inferSelect) {
205	  const lastError = run.lastError ?? "";
206	  return run.mode === "implementation"
207	    && run.status === "failed"
208	    && Boolean(lastError.trim())
209	    && isRecoverableConnectionSupervisorError(new Error(lastError));
210	}
211	
212	function isCleanLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
213	  return agent.state !== "error" && !agent.lastError?.trim();
214	}
215	
216	function isActiveLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
217	  const state = normalizedStatus(agent.state);
218	  return ["starting", "working", "stuck"].includes(state) || Boolean(agent.currentText.trim());
219	}
220	
221	function isWorkerQueueDrainableStatus(status: string) {
222	  const normalized = normalizedStatus(status);
223	  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
224	}
225	
226	async function pendingWorkerQueueCount(runId: string, workerId: string) {
227	  const records = await db.select({ id: queuedConversationMessages.id })
228	    .from(queuedConversationMessages)
229	    .where(and(
230	      eq(queuedConversationMessages.runId, runId),
231	      eq(queuedConversationMessages.targetWorkerId, workerId),
232	      eq(queuedConversationMessages.status, "pending"),
233	    ));
234	  return records.length;
235	}
236	
237	async function recordQueueDrainDecision(args: {
238	  runId: string;
239	  workerId: string;
240	  source: string;
241	  workerStatus: string;
242	  pendingCount: number;
243	  decision: "drain" | "skip";
244	  reason: string;
245	}) {
246	  emitNamedEvent({
247	    kind: "queue.drain_decision",
248	    runId: args.runId,
249	    workerId: args.workerId,
250	    source: args.source,
251	    workerStatus: args.workerStatus,
252	    pendingCount: args.pendingCount,
253	    decision: args.decision,
254	    reason: args.reason,
255	  });
256	  await recordExecutionEvent({
257	    runId: args.runId,
258	    workerId: args.workerId,
259	    eventType: "queue_drain_decision",
260	    details: {
261	      summary: args.decision === "drain"
262	        ? `Draining ${args.pendingCount} queued message(s) for ${args.workerId}.`
263	        : `Skipped queue drain for ${args.workerId}: ${args.reason}.`,
264	      source: args.source,
265	      workerStatus: args.workerStatus,
266	      pendingCount: args.pendingCount,
267	      decision: args.decision,
268	      reason: args.reason,
269	    },
270	  });
271	}
272	
273	async function drainQueuedWorkerMessagesWithObservation(args: {
274	  runId: string;
275	  workerId: string;
276	  workerStatus: string;
277	  source: string;
278	  snapshot?: ReturnType<typeof normalizeAgentRecord> | null;
279	}) {
280	  const pendingCount = await pendingWorkerQueueCount(args.runId, args.workerId);
281	  if (pendingCount === 0) {
282	    return 0;
283	  }
284	
285	  const snapshot = args.snapshot ?? null;
286	  const hasPendingElicitation = hasPendingElicitationSignal(snapshot);
287	  const drainable = hasPendingElicitation || isWorkerQueueDrainableStatus(args.workerStatus);
288	  await recordQueueDrainDecision({
289	    ...args,
290	    pendingCount,
291	    decision: drainable ? "drain" : "skip",
292	    reason: hasPendingElicitation
293	      ? "pending_elicitation"
294	      : drainable
295	        ? "worker_drainable"
296	        : "worker_not_drainable",
297	  });
298	  if (!drainable) {
299	    return 0;
300	  }
301	
302	  const deliveredCount = await drainQueuedWorkerMessages({
303	    runId: args.runId,
304	    workerId: args.workerId,
305	    snapshot,
306	  });
307	  emitNamedEvent({
308	    kind: "queue.drain_finished",
309	    runId: args.runId,
310	    workerId: args.workerId,
311	    source: args.source,
312	    pendingCount,
313	    deliveredCount,
314	  });
315	  await recordExecutionEvent({
316	    runId: args.runId,
317	    workerId: args.workerId,
318	    eventType: "queue_drain_finished",
319	    details: {
320	      summary: `Queue drain finished for ${args.workerId}: delivered ${deliveredCount} of ${pendingCount}.`,
321	      source: args.source,
322	      pendingCount,
323	      deliveredCount,
324	    },
325	  });
326	  return deliveredCount;
327	}
328	
329	function isRecoverableMissingDirectWorkerStatus(status: string) {
330	  const normalized = normalizedStatus(status);
331	  return ["starting", "working", "stuck", "recovering"].includes(normalized);
332	}
333	
334	function isCancelledWorkerStatus(status: string | null | undefined) {
335	  const normalized = normalizedStatus(status);
336	  return normalized === "cancelled" || normalized === "canceled";
337	}
338	
339	function isIdleDirectWorkerWithStaleCurrentText(worker: typeof workers.$inferSelect) {
340	  if (normalizedStatus(worker.status) !== "idle") {
341	    return false;
342	  }
343	
344	  const currentText = worker.currentText.trim();
345	  if (!currentText) {
346	    return false;
347	  }
348	
349	  const lastText = worker.lastText.trim();
350	  return !lastText || currentText === lastText;
351	}
352	
353	async function clearStaleDirectCurrentText(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
354	  if (!isDirectRunMode(run.mode) || !isTerminalRunStatus(run.status) || !isIdleDirectWorkerWithStaleCurrentText(worker)) {
355	    return false;
356	  }
357	
358	  await db.update(workers).set({
359	    currentText: "",
360	    lastText: worker.lastText || worker.currentText,
361	    updatedAt: new Date(),
362	  }).where(eq(workers.id, worker.id));
363	  notifyEventStreamSubscribers();
364	  return true;
365	}
366	
367	function workerCreatedAtMs(worker: typeof workers.$inferSelect) {
368	  const time = worker.createdAt.getTime();
369	  return Number.isFinite(time) ? time : 0;
370	}
371	
372	function compareWorkersForFollowUp(a: typeof workers.$inferSelect, b: typeof workers.$inferSelect) {
373	  const workerNumberDiff = (b.workerNumber ?? 0) - (a.workerNumber ?? 0);
374	  if (workerNumberDiff !== 0) {
375	    return workerNumberDiff;
376	  }
377	
378	  const createdAtDiff = workerCreatedAtMs(b) - workerCreatedAtMs(a);
379	  if (createdAtDiff !== 0) {
380	    return createdAtDiff;
381	  }
382	
383	  return b.id.localeCompare(a.id);
384	}
385	
386	function selectConversationWorker(runId: string, allWorkers: Array<typeof workers.$inferSelect>) {
387	  const sortedWorkers = allWorkers
388	    .filter((candidate) => candidate.runId === runId)
389	    .sort(compareWorkersForFollowUp);
390	  return sortedWorkers.find((worker) => !isCancelledWorkerStatus(worker.status)) ?? sortedWorkers[0] ?? null;
391	}
392	
393	async function clearMatchingRunFailureMessage(run: typeof runs.$inferSelect) {
394	  if (!run.lastError) {
395	    return;
396	  }
397	
398	  await db.delete(messages).where(and(
399	    eq(messages.runId, run.id),
400	    eq(messages.role, "system"),
401	    eq(messages.kind, "error"),
402	    eq(messages.content, `Run failed: ${run.lastError}`),
403	  ));
404	}
405	
406	let bridgeSyncInFlight: Promise<void> | null = null;
407	
408	/**
409	 * Watchdog-driven reconciliation between the bridge runtime and persisted
410	 * worker/run state. Turn completions are normally persisted by the awaiting
411	 * send-message call, or by the SSE-driven sync that runs while a client is
412	 * connected — but both die with their in-flight request (server restart,
413	 * dropped ACP roundtrip, phone backgrounded the tab). A worker then sits at
414	 * status='working' forever while the bridge agent finished its turn long
415	 * ago, and the stuck-worker reaper keeps cancelling and re-delivering the
416	 * same prompt every timeout window. This sweep closes the gap from the 15s
417	 * watchdog without requiring any connected client.
418	 */
419	export function syncConversationSessionsFromBridge(): Promise<void> {
420	  if (bridgeSyncInFlight) {
421	    return bridgeSyncInFlight;
422	  }
423	
424	  bridgeSyncInFlight = (async () => {
425	    let rawAgents: unknown[];
426	    try {
427	      rawAgents = await listAgents({ retryIndefinitely: false });
428	    } catch {
429	      // Bridge down or unreachable — there is no live state to reconcile
430	      // against; the next sweep will retry.
431	      return;
432	    }
433	    await syncConversationSessions(rawAgents);
434	  })().finally(() => {
435	    bridgeSyncInFlight = null;
436	  });
437	  return bridgeSyncInFlight;
438	}
439	
440	export async function syncConversationSessions(rawAgents: unknown[], options: { selectedRunId?: string | null } = {}) {
441	  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
442	  const selectedRunId = options.selectedRunId?.trim() || null;
443	  const allRuns = selectedRunId
444	    ? await db.select().from(runs).where(eq(runs.id, selectedRunId))
445	    : await db.select().from(runs);
446	  const allWorkers = selectedRunId
447	    ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
448	    : await db.select().from(workers);
449	
450	  for (const run of allRuns) {
451	    const staleBusyFailure = isAgentBusyRunFailure(run);
452	    const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
453	    const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);
454	    if (run.mode === "implementation") {
455	      const implementationWorkers = allWorkers.filter((candidate) => candidate.runId === run.id);
456	      let syncedActiveLiveWorker = false;
457	
458	      for (const implementationWorker of implementationWorkers) {
459	        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
460	        const cancelledWorkerHasMatchingLiveSession = Boolean(
461	          implementationAgent
462	          && implementationWorker.bridgeSessionId
463	          && implementationWorker.bridgeSessionMode
464	          && implementationAgent.sessionId === implementationWorker.bridgeSessionId
465	          && implementationAgent.sessionMode === implementationWorker.bridgeSessionMode,
466	        );
467	        if (isCancelledWorkerStatus(implementationWorker.status)
468	          && !cancelledWorkerHasMatchingLiveSession) {
469	          continue;
470	        }
471	        if (!implementationAgent || !isCleanLiveAgent(implementationAgent) || !isActiveLiveAgent(implementationAgent)) {
472	          continue;
473	        }
474	
475	        await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
476	        await db.update(workers).set({
477	          status: implementationAgent.state,
478	          cwd: implementationAgent.cwd || implementationWorker.cwd,
479	          currentText: implementationAgent.currentText,
480	          lastText: implementationAgent.lastText,
481	          bridgeSessionId: implementationAgent.sessionId ?? implementationWorker.bridgeSessionId,
482	          bridgeSessionMode: implementationAgent.sessionMode ?? implementationWorker.bridgeSessionMode,
483	          updatedAt: new Date(),
484	        }).where(eq(workers.id, implementationWorker.id));
485	        syncedActiveLiveWorker = true;
486	      }
487	
488	      if (syncedActiveLiveWorker) {
489	        if (run.status !== "running" || run.failedAt || run.lastError) {
490	          await db.update(runs).set({
491	            status: "running",
492	            failedAt: null,
493	            lastError: null,
494	            updatedAt: new Date(),
495	          }).where(eq(runs.id, run.id));
496	          await clearMatchingRunFailureMessage(run);
497	          startSupervisorRun(run.id);
498	        }
499	        continue;
500	      }
501	
502	      if (!staleImplementationTransientFailure) {
503	        continue;
504	      }
505	
506	      const implementationWorker = implementationWorkers[0];
507	      const implementationAgent = implementationWorker
508	        ? agents.find((candidate) => candidate.name === implementationWorker.id)
509	        : null;
510	      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
511	        if (staleImplementationConnectionFailure) {
512	          const resumableWorker = implementationWorkers.find((worker) => worker.bridgeSessionId?.trim());
513	          if (resumableWorker) {
514	            await db.update(runs).set({
515	              status: "running",
516	              failedAt: null,
517	              lastError: null,
518	              updatedAt: new Date(),
519	            }).where(eq(runs.id, run.id));
520	            await clearMatchingRunFailureMessage(run);
521	            startSupervisorRun(run.id);
522	          }
523	        }
524	        continue;
525	      }
526	
527	      await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
528	      await db.update(workers).set({
529	        status: implementationAgent.state,
530	        cwd: implementationAgent.cwd || implementationWorker.cwd,
531	        currentText: implementationAgent.currentText,
532	        lastText: implementationAgent.lastText,
533	        updatedAt: new Date(),
534	      }).where(eq(workers.id, implementationWorker.id));
535	      await db.update(runs).set({
536	        status: "running",
537	        failedAt: null,
538	        lastError: null,
539	        updatedAt: new Date(),
540	      }).where(eq(runs.id, run.id));
541	      await clearMatchingRunFailureMessage(run);
542	      startSupervisorRun(run.id);
543	      continue;
544	    }
545	
546	    const worker = selectConversationWorker(run.id, allWorkers);
547	    if (!worker) {
548	      continue;
549	    }
550	
551	    if (await clearStaleDirectCurrentText(run, worker)) {
552	      continue;
553	    }
554	
555	    const agent = agents.find((candidate) => candidate.name === worker.id);
556	    const selectedTerminalDirectRunStillStreaming = Boolean(
557	      options.selectedRunId === run.id
558	      && isDirectRunMode(run.mode)
559	      && agent
560	      && isActiveLiveAgent(agent),
561	    );
562	    if (isTerminalRunStatus(run.status) && !staleBusyFailure && !selectedTerminalDirectRunStillStreaming) {
563	      continue;
564	    }
565	
566	    if (!agent) {
567	      continue;
568	    }
569	
570	    if (
571	      isDirectRunMode(run.mode)
572	      && worker.status.trim().toLowerCase().split(":")[0]?.trim() === "idle"
573	      && isIdleLiveAgentWithoutOutput(agent)
574	    ) {
575	      await db.update(workers).set({
576	        status: "error",
577	        cwd: agent.cwd || worker.cwd,
578	        currentText: agent.currentText,
579	        lastText: agent.lastText,
580	        outputLog: EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
581	        updatedAt: new Date(),
582	      }).where(eq(workers.id, worker.id));
583	      await persistRunFailure(run.id, new Error(EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
584	        surface: { code: "worker.idle.empty_output", workerId: worker.id },
585	      });
586	      continue;
587	    }
588	
589	    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
590	    const nextRunState = resolveSyncedRunState(run, agent);
591	    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
592	    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
593	    await db.update(workers).set({
594	      status: nextWorkerStatus,
595	      cwd: agent.cwd || worker.cwd,
596	      currentText: quiescedDirectWorker ? "" : agent.currentText,
597	      lastText: agent.lastText,
598	      updatedAt: new Date(),
599	    }).where(eq(workers.id, worker.id));
600	    if (worker.status !== nextWorkerStatus) {
601	      emitNamedEvent({
602	        kind: "worker.status",
603	        runId: run.id,
604	        workerId: worker.id,
605	        prev: worker.status,
606	        next: nextWorkerStatus,
607	      });
608	    }
609	
610	    if (run.mode === "planning") {
611	      const result = await refreshPlanningArtifactsForRun({
612	        run,
613	        worker,
614	        snapshot: agent,
615	        status: nextRunState === "running" ? "working" : undefined,
616	      });
617	      if (staleBusyFailure && result.status !== "failed") {
618	        await clearMatchingRunFailureMessage(run);
619	      }
620	      await drainQueuedWorkerMessagesWithObservation({
621	        runId: run.id,
622	        workerId: worker.id,
623	        workerStatus: agent.state,
624	        source: "live_planning_sync",
625	      });
626	      continue;
627	    }
628	
629	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
630	      await updateDirectRunStatusFromWorkerOutput({
631	        runId: run.id,
632	        workerId: worker.id,
633	        renderedOutput: agent.renderedOutput,
634	        currentText: agent.currentText,
635	        lastText: agent.lastText,
636	        outputEntries: agent.outputEntries,
637	        pendingPermissions: agent.pendingPermissions,
638	        pendingElicitations: agent.pendingElicitations,
639	      });
640	    } else {
641	      await db.update(runs).set({
642	        status: nextRunState,
643	        lastError: nextRunState === "failed" ? agent.lastError || run.lastError : null,
644	        failedAt: nextRunState === "failed" ? run.failedAt : null,
645	        updatedAt: new Date(),
646	      }).where(eq(runs.id, run.id));
647	    }
648	    if (staleBusyFailure && nextRunState !== "failed") {
649	      await clearMatchingRunFailureMessage(run);
650	    }
651	    await drainQueuedWorkerMessagesWithObservation({
652	      runId: run.id,
653	      workerId: worker.id,
654	      workerStatus: nextWorkerStatus,
655	      source: "live_worker_sync",
656	      snapshot: agent,
657	    });
658	  }
659	
660	  for (const run of allRuns) {
661	    const staleBusyFailure = isAgentBusyRunFailure(run);
662	    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
663	      continue;
664	    }
665	
666	    const worker = selectConversationWorker(run.id, allWorkers);
667	    if (!worker || agents.some((agent) => agent.name === worker.id)) {
668	      continue;
669	    }
670	
671	    if (
672	      options.selectedRunId === run.id
673	      && isRecoverableMissingDirectWorkerStatus(worker.status)
674	    ) {
675	      const recoveryResult = await reconcileRunRecovery({
676	        runId: run.id,
677	        liveAgents: agents,
678	        source: "conversation-sync",
679	      });
680	      if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
681	        continue;
682	      }
683	    }
684	
685	    if (await isEmptyIdlePersistedWorker(worker)) {
686	      await db.update(workers).set({
687	        status: "error",
688	        outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
689	        updatedAt: new Date(),
690	      }).where(eq(workers.id, worker.id));
691	      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
692	        surface: { code: "worker.idle.missing_output", workerId: worker.id },
693	      });
694	      continue;
695	    }
696	
697	    const nextRunState = await resolvePersistedRunState(run, worker);
698	    if (run.mode === "planning") {
699	      await refreshPlanningArtifactsForRun({
700	        run,
701	        worker,
702	        status: nextRunState === "running" ? "working" : undefined,
703	      });
704	      continue;
705	    }
706	
707	    if (nextRunState === run.status) {
708	      await drainQueuedWorkerMessagesWithObservation({
709	        runId: run.id,
710	        workerId: worker.id,
711	        workerStatus: worker.status,
712	        source: "persisted_state_unchanged",
713	      });
714	      continue;
715	    }
716	
717	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
718	      await updateDirectRunStatusFromWorkerOutput({
719	        runId: run.id,
720	        workerId: worker.id,
721	        outputLog: worker.outputLog,
722	        currentText: worker.currentText,
723	        lastText: worker.lastText,
724	        outputEntriesJson: worker.outputEntriesJson,
725	      });
726	      await drainQueuedWorkerMessagesWithObservation({
727	        runId: run.id,
728	        workerId: worker.id,
729	        workerStatus: worker.status,
730	        source: "persisted_direct_completion",
731	      });
732	    } else {
733	      await db.update(runs).set({
734	        status: nextRunState,
735	        updatedAt: new Date(),
736	      }).where(eq(runs.id, run.id));
737	    }
738	  }
739	}
740	

uuid: 9cc65b26-341b-4464-807a-094bae6e5663
parent: c2673ef1-7be2-4915-8ae2-5af374b29ebd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:20:00.057Z","phase":null} -->
## Claude tool result: toolu_01NSWwdcZjqn47nDBW7GWJR9 · 2026-06-25T21:20:00.057Z

```text
180	  let resumed: AgentRecord;
181	  let recreatedFromMissingSession = false;
182	  try {
183	    resumed = await spawnAgent({
184	      type: args.worker.type,
185	      cwd: args.worker.cwd,
186	      name: args.worker.id,
187	      ...(workerMode ? { mode: workerMode } : {}),
188	      env: envParams,
189	      ...(args.run.preferredWorkerModel ? { model: args.run.preferredWorkerModel } : {}),
190	      ...(args.run.preferredWorkerEffort ? { effort: args.run.preferredWorkerEffort } : {}),
191	      resumeSessionId: sessionId,
192	    }) as AgentRecord;
193	  } catch (error) {
194	    const reason = error instanceof Error ? error.message : String(error);
195	    if (!isCorruptResumeFileError(reason) || args.run.mode !== "implementation") {
196	      throw error;
197	    }
198	
199	    await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_missing", {
200	      summary: `Saved bridge session for ${args.worker.id} is no longer available`,
201	      reason,
202	      sessionId,
203	    });
204	    await db.update(workers).set({
205	      status: "starting",
206	      bridgeSessionId: null,
207	      bridgeSessionMode: null,
208	      updatedAt: new Date(),
209	    }).where(eq(workers.id, args.worker.id));
210	    resumed = await spawnAgent({
211	      type: args.worker.type,
212	      cwd: args.worker.cwd,
213	      name: args.worker.id,
214	      ...(workerMode ? { mode: workerMode } : {}),
215	      env: envParams,
216	      ...(args.run.preferredWorkerModel ? { model: args.run.preferredWorkerModel } : {}),
217	      ...(args.run.preferredWorkerEffort ? { effort: args.run.preferredWorkerEffort } : {}),
218	    }) as AgentRecord;
219	    recreatedFromMissingSession = true;
220	  }
221	  const nextRunStatus = args.run.mode === "direct" || args.run.mode === "commit"
222	    ? resolveDirectRunStatusFromWorkerOutput({
223	      renderedOutput: resumed.renderedOutput,
224	      currentText: resumed.currentText,
225	      lastText: resumed.lastText,
226	      outputEntries: resumed.outputEntries,
227	      pendingPermissions: resumed.pendingPermissions,
228	      pendingElicitations: resumed.pendingElicitations,
229	    })
230	    : "running";
231	
232	  if (resumed.outputEntries) {
233	    await writeWorkerOutputEntries(args.run.id, args.worker.id, resumed.outputEntries);
234	  }
235	
236	  await db.update(workers).set({
237	    status: resumed.state,
238	    currentText: resumed.currentText,
239	    lastText: resumed.lastText,
240	    bridgeSessionId: resumed.sessionId ?? (recreatedFromMissingSession ? null : sessionId),
241	    bridgeSessionMode: resumed.sessionMode ?? args.worker.bridgeSessionMode ?? null,
242	    updatedAt: new Date(),
243	  }).where(eq(workers.id, args.worker.id));
244	  emitNamedEvent({
245	    kind: recreatedFromMissingSession ? "worker.recreated" : "worker.reattached",
246	    runId: args.run.id,
247	    workerId: args.worker.id,
248	  });
249	  if (recreatedFromMissingSession) {
250	    await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_recreated", {
251	      summary: `Started a fresh runtime worker for ${args.worker.id} after its saved session was rejected.`,
252	      rejectedSessionId: sessionId,
253	      newSessionId: resumed.sessionId ?? null,
254	      reason: "recovery_resume_missing_agent",
255	    });
256	  }
257	  await db.update(runs).set({
258	    status: nextRunStatus,
259	    failedAt: null,
260	    lastError: null,
261	    updatedAt: new Date(),
262	  }).where(eq(runs.id, args.run.id));
263	  await markRecoveryIncidentResolved({
264	    incidentId: args.incidentId,
265	    runId: args.run.id,
266	    workerId: args.worker.id,
267	    summary: `Resumed ${args.worker.id} from saved session.`,
268	    details: {
269	      sessionId,

uuid: dc74f220-dad7-4f5a-9fd4-8acb09edbf5b
parent: 943b392a-8096-44cf-b91b-b3525761e946
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:20:06.307Z","phase":null} -->
## Claude thinking · 2026-06-25T21:20:06.307Z

I need to trace through the call sites in create.ts, send-message.ts, queued-messages.ts, and the recovery-reconciler to understand how they interact, then check what's already been modified in direct-run-status.ts versus the original state so I can plan the next change to resolveDirectRunStatusFromWorkerOutput to accept worker state.

uuid: 43eb2011-a3c2-41c1-a9ea-620c2d9eb754
parent: dc74f220-dad7-4f5a-9fd4-8acb09edbf5b

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:20:06.660Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:20:06.660Z

```json
{
  "command": "git diff HEAD -- src/server/conversations/direct-run-status.ts",
  "description": "Show dirty diff of direct-run-status.ts"
}

uuid: cfb26f9d-3368-4b28-9200-a54cc319d273
parent: 43eb2011-a3c2-41c1-a9ea-620c2d9eb754
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:20:06.714Z","phase":null} -->
## Claude tool result: toolu_01UvKkP3m1YQD6t1reaBX7Ne · 2026-06-25T21:20:06.714Z

```text
diff --git a/src/server/conversations/direct-run-status.ts b/src/server/conversations/direct-run-status.ts
index 30c8554..5d6cd58 100644
--- a/src/server/conversations/direct-run-status.ts
+++ b/src/server/conversations/direct-run-status.ts
@@ -9,9 +9,12 @@ import { runMilestoneAutoCommit } from "@/server/git/run-auto-commit";
 type OutputEntryLike = {
   type?: string | null;
   text?: string | null;
+  status?: string | null;
+  raw?: unknown;
 };
 
 type WorkerOutputSource = {
+  workerStatus?: string | null;
   responseText?: string | null;
   renderedOutput?: string | null;
   currentText?: string | null;
@@ -19,24 +22,14 @@ type WorkerOutputSource = {
   outputLog?: string | null;
   outputEntries?: readonly OutputEntryLike[] | null;
   outputEntriesJson?: string | null;
+  pendingPermissions?: readonly unknown[] | null;
+  pendingElicitations?: readonly unknown[] | null;
 };
 
-const USER_INPUT_REQUEST_PATTERNS = [
-  /\bwhich\s+(?:approach|option|path|one|choice|of these)\b.{0,120}\b(?:do you want|would you like|should i|should we)\b/i,
-  /\b(?:what|how)\b.{0,120}\b(?:do you want|would you like)\b/i,
-  /\bshould\s+(?:i|we)\b/i,
-  /\bdo you want me to\b/i,
-  /\bwould you like me to\b/i,
-  /\bplease\s+(?:confirm|choose|pick|select|tell me|let me know)\b/i,
-  /\b(?:choose|pick|select)\s+(?:an?\s+)?(?:option|approach|path|choice)\b/i,
-  /\blet me know\s+(?:which|whether|how|what|if)\b/i,
-  /\bneed\s+(?:your|a)\s+(?:confirmation|decision|approval|input|direction)\b/i,
-  /\bwaiting for\s+(?:your|user)\s+(?:confirmation|decision|approval|input|direction)\b/i,
-  /\bbefore\s+(?:i|we)\s+(?:proceed|continue|do that|make|merge|delete|change|apply|commit|stash)\b/i,
-];
-
-function normalizeOutputText(text: string) {
-  return text.replace(/\s+/g, " ").trim();
+const ACTIVE_DIRECT_WORKER_STATUSES = new Set(["starting", "working", "stuck", "recovering"]);
+
+function normalizeWorkerStatus(value: string | null | undefined) {
+  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
 }
 
 function parseOutputEntriesJson(value: string | null | undefined): OutputEntryLike[] {
@@ -69,26 +62,65 @@ function firstNonEmptyText(values: ReadonlyArray<string | null | undefined>) {
   return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
 }
 
-export function directWorkerOutputRequestsUserInput(source: WorkerOutputSource) {
-  const text = normalizeOutputText(firstNonEmptyText([
-    source.responseText,
-    source.currentText,
-    source.lastText,
-    latestVisibleEntryText(source.outputEntries),
-    latestVisibleEntryText(parseOutputEntriesJson(source.outputEntriesJson)),
-    source.renderedOutput,
-    source.outputLog,
-  ]));
-
-  if (!text) {
+function isOpenHumanInputEntry(entry: OutputEntryLike) {
+  if (entry.type !== "permission" && entry.type !== "elicitation") {
     return false;
   }
+  const status = (entry.status ?? "pending").trim().toLowerCase();
+  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected", "skipped"].includes(status);
+}
 
-  return USER_INPUT_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
+function entryRequestId(entry: OutputEntryLike) {
+  const raw = entry.raw;
+  if (typeof raw !== "object" || raw === null) {
+    return null;
+  }
+  const requestId = (raw as { requestId?: unknown }).requestId;
+  return typeof requestId === "number" && Number.isFinite(requestId) ? requestId : null;
+}
+
+function entriesHaveOpenHumanInput(entries: readonly OutputEntryLike[]) {
+  const pendingByRequestId = new Map<string, boolean>();
+
+  for (const entry of entries) {
+    if (entry.type !== "permission" && entry.type !== "elicitation") {
+      continue;
+    }
+
+    const open = isOpenHumanInputEntry(entry);
+    const requestId = entryRequestId(entry);
+    if (requestId === null) {
+      if (open) {
+        return true;
+      }
+      continue;
+    }
+
+    pendingByRequestId.set(`${entry.type}:${requestId}`, open);
+  }
+
+  return [...pendingByRequestId.values()].some(Boolean);
+}
+
+export function directWorkerOutputHasPendingHumanInput(source: WorkerOutputSource) {
+  return (
+    (source.pendingPermissions?.length ?? 0) > 0
+    || (source.pendingElicitations?.length ?? 0) > 0
+    || entriesHaveOpenHumanInput(source.outputEntries ?? [])
+    || entriesHaveOpenHumanInput(parseOutputEntriesJson(source.outputEntriesJson))
+  );
 }
 
 export function resolveDirectRunStatusFromWorkerOutput(source: WorkerOutputSource) {
-  return directWorkerOutputRequestsUserInput(source) ? "awaiting_user" : "done";
+  if (directWorkerOutputHasPendingHumanInput(source)) {
+    return "awaiting_user";
+  }
+
+  if (ACTIVE_DIRECT_WORKER_STATUSES.has(normalizeWorkerStatus(source.workerStatus))) {
+    return "running";
+  }
+
+  return "done";
 }
 
 export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
@@ -146,7 +178,7 @@ export async function updateDirectRunAwaitingUserInputIfRequested(args: WorkerOu
   runId: string;
   workerId?: string | null;
 }) {
-  if (!directWorkerOutputRequestsUserInput(args)) {
+  if (!directWorkerOutputHasPendingHumanInput(args)) {
     return false;
   }

uuid: 44976654-dfc9-431c-9bf6-861e2590b3db
parent: cfb26f9d-3368-4b28-9200-a54cc319d273
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:20:07.780Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:20:07.780Z

```json
{
  "command": "grep -rn \"updateDirectRunStatusFromWorkerOutput\\|updateDirectRunAwaitingUserInputIfRequested\\|directWorkerOutputHasPendingHumanInput\" src/ --include=\"*.ts\" --include=\"*.tsx\"",
  "description": "Find all callers of the update/has-pending helpers"
}

uuid: 3a0c6f5d-09c1-45b3-99ed-a2b6cfc6d8da
parent: 44976654-dfc9-431c-9bf6-861e2590b3db
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:20:07.822Z","phase":null} -->
## Claude tool result: toolu_01GaxSsTUJvaxVo3SdPMaC4M · 2026-06-25T21:20:07.822Z

```text
src/server/conversations/send-message.ts:27:import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
src/server/conversations/send-message.ts:616:      await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/queued-messages.ts:20:import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
src/server/conversations/queued-messages.ts:362:    await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/sync.ts:19:  updateDirectRunStatusFromWorkerOutput,
src/server/conversations/sync.ts:630:      await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/sync.ts:719:      await updateDirectRunStatusFromWorkerOutput({
src/server/workers/stuck-worker-reaper.ts:27:import { updateDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
src/server/workers/stuck-worker-reaper.ts:99:  await updateDirectRunStatusFromWorkerOutput({
src/server/conversations/direct-run-status.ts:105:export function directWorkerOutputHasPendingHumanInput(source: WorkerOutputSource) {
src/server/conversations/direct-run-status.ts:115:  if (directWorkerOutputHasPendingHumanInput(source)) {
src/server/conversations/direct-run-status.ts:126:export async function updateDirectRunStatusFromWorkerOutput(args: WorkerOutputSource & {
src/server/conversations/direct-run-status.ts:177:export async function updateDirectRunAwaitingUserInputIfRequested(args: WorkerOutputSource & {
src/server/conversations/direct-run-status.ts:181:  if (!directWorkerOutputHasPendingHumanInput(args)) {
src/server/conversations/direct-run-status.ts:185:  await updateDirectRunStatusFromWorkerOutput(args);
src/server/conversations/create.ts:39:import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
src/server/conversations/create.ts:397:      await updateDirectRunStatusFromWorkerOutput({
src/server/runs/recovery.ts:37:import { updateDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
src/server/runs/recovery.ts:685:  await updateDirectRunStatusFromWorkerOutput({

uuid: c0b5ff52-03e9-40e6-a764-bc4f9f38f69c
parent: 3a0c6f5d-09c1-45b3-99ed-a2b6cfc6d8da
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:20:30.144Z","phase":null} -->
## Claude thinking · 2026-06-25T21:20:30.144Z

I'm noticing a discrepancy — the git diff shows that `ACTIVE_DIRECT_WORKER_STATUSES`, the `workerStatus` parameter, and `normalizeWorkerStatus` have already been added to `resolveDirectRunStatusFromWorkerOutput`, but when I looked at the file earlier around line 107-109, those changes weren't there. Let me double-check what I actually read. I'm noticing a discrepancy between what the git diff shows should be added and what the actual file currently contains. The Read output doesn't include the `workerStatus` field in the `WorkerOutputSource` type, nor does it have the `ACTIVE_DIRECT_WORKER_STATUSES` constant or the `normalizeWorkerStatus` function that the diff indicates should be there. This suggests either the git diff is showing staged changes that haven't been applied yet, or there's a mismatch in what I'm looking at. Let me just verify the actual file state to settle this.

uuid: 0273f724-e7d4-4fe9-a437-697ad8ef69aa
parent: c0b5ff52-03e9-40e6-a764-bc4f9f38f69c

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:20:30.177Z","phase":null} -->
## Claude · 2026-06-25T21:20:30.177Z

The git diff and my earlier Read of `direct-run-status.ts` disagree — the diff shows the `workerStatus`/`ACTIVE_DIRECT_WORKER_STATUSES` logic already present, but my Read didn't. Let me get ground truth and check the remaining call sites.

uuid: a81106b2-dbfa-40a9-b798-e9f5b3723cd0
parent: 0273f724-e7d4-4fe9-a437-697ad8ef69aa

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:20:31.599Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:20:31.599Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/direct-run-status.ts",
  "offset": 98,
  "limit": 30
}

uuid: 5bd3e1aa-0113-4ca6-9487-0983937b9b0c
parent: a81106b2-dbfa-40a9-b798-e9f5b3723cd0
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:20:31.604Z","phase":null} -->
## Claude tool result: toolu_01BfX2vvvpKk9ZSKTkjq8pvm · 2026-06-25T21:20:31.604Z

```text
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

uuid: 95a66be8-26d2-4777-b465-bc249ba10bfd
parent: 5bd3e1aa-0113-4ca6-9487-0983937b9b0c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:20:32.536Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:20:32.536Z

```json
{
  "command": "git stash list; echo \"---STATUS---\"; git status --short src/server/conversations/direct-run-status.ts; echo \"---HEAD VERSION head---\"; git show HEAD:src/server/conversations/direct-run-status.ts | sed -n '95,115p'",
  "description": "Check stash and HEAD version of the file"
}

uuid: a782ccfc-6782-4bc3-8f3a-165b97344c01
parent: 95a66be8-26d2-4777-b465-bc249ba10bfd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:20:32.621Z","phase":null} -->
## Claude tool result: toolu_01WBdG4LU3U4mQQnfhTdFBwZ · 2026-06-25T21:20:32.621Z

```text
stash@{0}: On master: pre-coauthor-strip
---STATUS---
 M src/server/conversations/direct-run-status.ts
---HEAD VERSION head---
  runId: string;
  workerId?: string | null;
}) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || (run.mode !== "direct" && run.mode !== "commit")) {
    return null;
  }

  const nextStatus = resolveDirectRunStatusFromWorkerOutput(args);
  const now = new Date();
  await db.update(runs).set({
    status: nextStatus,
    failedAt: null,
    lastError: null,
    updatedAt: now,
  }).where(eq(runs.id, args.runId));

  if (nextStatus === "awaiting_user" && run.status !== "awaiting_user") {
    emitNamedEvent({
      kind: "conversation.awaiting_user",
      runId: args.runId,

uuid: d79c2f08-6caa-4183-a8f8-42dfc6fdbc2e
parent: a782ccfc-6782-4bc3-8f3a-165b97344c01
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-25T21:20:32.623Z","phase":null} -->
## Claude attachment · 2026-06-25T21:20:32.623Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: dac86227-0abf-4485-8598-10793dd686ba
parent: d79c2f08-6caa-4183-a8f8-42dfc6fdbc2e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:21:02.211Z","phase":null} -->
## Claude thinking · 2026-06-25T21:21:02.211Z

I'm realizing the file already contains the workerStatus logic that was described as a plan—the implementation at lines 114-124 shows `resolveDirectRunStatusFromWorkerOutput` already handles the worker status and returns "running" for active states. So the user's proposed changes are actually already in place in the working tree, and I need to identify what might still be missing or needs adjustment.

Now I'm checking each call site to see if they're actually passing `workerStatus` so the new "running" branch can execute. The first call at sync.ts:140 passes an agent object that has a `state` field but not `workerStatus`, so `normalizeWorkerStatus` would receive undefined and return an empty string—meaning the "running" guard never triggers there. But looking at the context, that call site only cares about the "awaiting_user" case anyway, so it doesn't need the workerStatus distinction. The second call at sync.ts:169 has the same issue: it's passing a worker object with a `status` field rather than `workerStatus`, so again the new logic wouldn't activate there either.

The critical missed call site is in recovery-reconciler.ts:222, where an explicit object is constructed without including `workerStatus`. When resuming a worker that's actively working, this would incorrectly return "done" because there's no pending input and no workerStatus passed—even though the resumed agent is mid-turn. This causes the run to be marked done while the worker is still working, which is exactly the bounce behavior. The fix would be to pass `workerStatus: resumed.state` to capture the actual working state. I need to trace through the remaining call sites of `updateDirectRunStatusFromWorkerOutput` to see which ones are also missing the workerStatus parameter. At sync.ts:630 and 719, the calls pass some arguments but omit workerStatus, so the inner recomputation of status should align with the outer guard's decision—both should reach "done" or "awaiting_user" consistently. The real risk is in callers that invoke update directly without pre-gating on a computed nextRunState, expecting update itself to distinguish between "running", "awaiting_user", and "done". That's where the "running" status becomes critical—some caller might invoke update while the worker is still actively processing.

uuid: 58063234-61ef-47fb-9865-3c46ce0298e5
parent: dac86227-0abf-4485-8598-10793dd686ba

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:21:02.218Z","phase":null} -->
## Claude · 2026-06-25T21:21:02.218Z

Now I have ground truth: the working tree **already implements** the plan — `resolveDirectRunStatusFromWorkerOutput` at lines 114-124 already accepts `workerStatus` and returns `"running"` for active states. (My first Read was a stale snapshot.) So the real review question is: **which call sites pass `workerStatus`, and which silently fall through to `"done"`.** Let me audit every caller.

uuid: 38adf4de-741d-449d-adfa-80baf5958764
parent: 58063234-61ef-47fb-9865-3c46ce0298e5

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:03.621Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:21:03.621Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/create.ts",
  "offset": 380,
  "limit": 30
}

uuid: 39685481-37e8-4047-9774-0be7ba091a8f
parent: 38adf4de-741d-449d-adfa-80baf5958764
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:03.625Z","phase":null} -->
## Claude tool result: toolu_01DxfBr2wCRhyhyrzaW6qeyX · 2026-06-25T21:21:03.625Z

```text
380	
381	    // Worker response now lives in the unified worker stream via the
382	    // bridge entries written by persistWorkerSnapshot above. The
383	    // legacy role:"worker" messages row is no longer written.
384	
385	    if (args.mode === "planning") {
386	      const latestRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
387	      const latestWorker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
388	      if (latestRun) {
389	        await refreshPlanningArtifactsForRun({
390	          run: latestRun,
391	          worker: latestWorker,
392	          snapshot,
393	          responseText: response.response,
394	        });
395	      }
396	    } else {
397	      await updateDirectRunStatusFromWorkerOutput({
398	        runId: args.runId,
399	        workerId: args.workerId,
400	        workerStatus: snapshot?.state ?? response.state,
401	        responseText: response.response,
402	        renderedOutput: snapshot?.renderedOutput,
403	        currentText: snapshot?.currentText,
404	        lastText: snapshot?.lastText,
405	        outputEntries: snapshot?.outputEntries,
406	        pendingPermissions: snapshot?.pendingPermissions,
407	        pendingElicitations: snapshot?.pendingElicitations,
408	      });
409	    }

uuid: da462af5-a592-4380-b4a9-9b053e2bc63b
parent: 39685481-37e8-4047-9774-0be7ba091a8f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:04.497Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:21:04.497Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts",
  "offset": 595,
  "limit": 40
}

uuid: 583498c0-4110-4189-a034-731ef096626c
parent: da462af5-a592-4380-b4a9-9b053e2bc63b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:04.502Z","phase":null} -->
## Claude tool result: toolu_017AVXoZ3s4PgfwoYziLyhh6 · 2026-06-25T21:21:04.502Z

```text
595	    await db.update(workers).set({
596	      status: snapshot?.state ?? response.state,
597	      updatedAt: new Date(),
598	    }).where(eq(workers.id, worker.id));
599	
600	    // Worker response now lives in the unified worker stream — the
601	    // bridge entries written by persistWorkerSnapshot above carry the
602	    // response text. The legacy role:"worker" messages row is gone.
603	
604	    if (isPlanningRun(run)) {
605	      const latestRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
606	      const latestWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
607	      if (latestRun) {
608	        await refreshPlanningArtifactsForRun({
609	          run: latestRun,
610	          worker: latestWorker,
611	          snapshot,
612	          responseText: response.response,
613	        });
614	      }
615	    } else if (isDirectRunMode(run.mode)) {
616	      await updateDirectRunStatusFromWorkerOutput({
617	        runId: run.id,
618	        workerId: worker.id,
619	        workerStatus: snapshot?.state ?? response.state,
620	        responseText: response.response,
621	        renderedOutput: snapshot?.renderedOutput,
622	        currentText: snapshot?.currentText,
623	        lastText: snapshot?.lastText,
624	        outputEntries: snapshot?.outputEntries,
625	        pendingPermissions: snapshot?.pendingPermissions,
626	        pendingElicitations: snapshot?.pendingElicitations,
627	      });
628	    }
629	
630	    notifyEventStreamSubscribers();
631	  } catch (error) {
632	    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
633	    if (isWorkerCancelled(currentWorker)) {
634	      notifyEventStreamSubscribers();

uuid: 9f05ab46-67cb-4a10-8539-240c699c11fb
parent: 583498c0-4110-4189-a034-731ef096626c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:05.043Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:21:05.043Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts",
  "offset": 330,
  "limit": 50
}

uuid: 2a07c92c-f8ac-43ee-b51d-1427d41a97a1
parent: 9f05ab46-67cb-4a10-8539-240c699c11fb
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:05.056Z","phase":null} -->
## Claude tool result: toolu_01Gnan4EzkTqDVJGzFufQMGP · 2026-06-25T21:21:05.056Z

```text
330	  userInputEntryId,
331	}: {
332	  run: WorkerResponseRun;
333	  workerId: string;
334	  response: WorkerAskResponse;
335	  deliveredAt: Date;
336	  userInputEntryId: string;
337	}) {
338	  const snapshot = await Promise.resolve(getAgent(workerId)).catch(() => null);
339	  if (snapshot) {
340	    await persistWorkerSnapshot(workerId, snapshot);
341	  }
342	  await appendAskResponseFallbackEntry({
343	    runId: run.id,
344	    workerId,
345	    responseText: response.response,
346	    snapshot,
347	  });
348	  await assertQueuedDeliveryProducedOutput({
349	    runId: run.id,
350	    workerId,
351	    userInputEntryId,
352	    response,
353	    snapshot,
354	  });
355	
356	  await db.update(workers).set({
357	    status: snapshot?.state ?? response.state,
358	    updatedAt: deliveredAt,
359	  }).where(eq(workers.id, workerId));
360	
361	  if (run.mode === "direct" || run.mode === "commit") {
362	    await updateDirectRunStatusFromWorkerOutput({
363	      runId: run.id,
364	      workerId,
365	      workerStatus: snapshot?.state ?? response.state,
366	      responseText: response.response,
367	      renderedOutput: snapshot?.renderedOutput,
368	      currentText: snapshot?.currentText,
369	      lastText: snapshot?.lastText,
370	      outputEntries: snapshot?.outputEntries,
371	      pendingPermissions: snapshot?.pendingPermissions,
372	      pendingElicitations: snapshot?.pendingElicitations,
373	    });
374	  }
375	}
376	
377	async function insertQueueExecutionEvent(
378	  runId: string,
379	  eventType: string,

uuid: 0be2d45b-f7ab-4d98-a59a-fb7334a3826e
parent: 2a07c92c-f8ac-43ee-b51d-1427d41a97a1
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:21:09.039Z","phase":null} -->
## Claude thinking · 2026-06-25T21:21:09.039Z

I've verified that create.ts, send-message.ts, and queued-messages.ts are all correctly passing the workerStatus parameter. Now I need to check a few more files—stuck-worker-reaper.ts, recovery.ts, and recovery-reconciler.ts—to make sure they're handling this consistently as well.

uuid: 43b6c051-07d6-443b-bb0d-1e6be682f34d
parent: 0be2d45b-f7ab-4d98-a59a-fb7334a3826e

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:21:09.044Z","phase":null} -->
## Claude · 2026-06-25T21:21:09.044Z

create.ts, send-message.ts, and queued-messages.ts all pass `workerStatus`. Now the remaining three callers — the reaper, recovery.ts, and recovery-reconciler.ts:

uuid: 9d726b92-2855-44fc-9918-84ff0cd7b089
parent: 43b6c051-07d6-443b-bb0d-1e6be682f34d

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:10.499Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:21:10.499Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/workers/stuck-worker-reaper.ts",
  "offset": 75,
  "limit": 40
}

uuid: 3e7668b3-45ff-4375-9a2d-6bbfb784e6ff
parent: 9d726b92-2855-44fc-9918-84ff0cd7b089
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:10.504Z","phase":null} -->
## Claude tool result: toolu_01GETTMpZ3s5czydhZLBYGV7 · 2026-06-25T21:21:10.504Z

```text
75	 * and five minutes later the reaper declared it stuck again — an infinite
76	 * cancel/re-deliver loop that re-ran the same prompt forever.
77	 */
78	async function persistRedeliveredTurnResult(args: {
79	  worker: typeof workers.$inferSelect;
80	  responseText: string | null | undefined;
81	}) {
82	  const workerAfter = await db
83	    .select()
84	    .from(workers)
85	    .where(eq(workers.id, args.worker.id))
86	    .get();
87	  if (!workerAfter || ["cancelled", "canceled"].includes(normalizeStatus(workerAfter.status))) {
88	    return;
89	  }
90	
91	  const snapshot = await readLiveAgent(args.worker.id);
92	  if (snapshot) {
93	    await persistWorkerSnapshot(args.worker.id, snapshot);
94	  }
95	  await db.update(workers).set({
96	    status: snapshot?.state ?? "idle",
97	    updatedAt: new Date(),
98	  }).where(eq(workers.id, args.worker.id));
99	  await updateDirectRunStatusFromWorkerOutput({
100	    runId: args.worker.runId,
101	    workerId: args.worker.id,
102	    responseText: args.responseText,
103	    renderedOutput: snapshot?.renderedOutput,
104	    currentText: snapshot?.currentText,
105	    lastText: snapshot?.lastText,
106	    outputEntries: snapshot?.outputEntries,
107	  });
108	}
109	
110	/**
111	 * Scan direct-mode workers for stuckness and recover them. Returns counts;
112	 * never throws. Safe to call repeatedly from the watchdog sweep.
113	 */
114	export async function reapStuckDirectWorkers(now: Date = new Date()): Promise<ReaperOutcome> {

uuid: ad699677-0b6e-4be2-8bdb-c8f764f6aa77
parent: 3e7668b3-45ff-4375-9a2d-6bbfb784e6ff
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:11.067Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:21:11.067Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/runs/recovery.ts",
  "offset": 660,
  "limit": 45
}

uuid: e9699dff-5bed-4a2b-a112-27185da68939
parent: ad699677-0b6e-4be2-8bdb-c8f764f6aa77
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:11.069Z","phase":null} -->
## Claude tool result: toolu_01KWXumkaYoj4412wuxymRmB · 2026-06-25T21:21:11.069Z

```text
660	    workerId: worker.id,
661	    text: content,
662	    deliveredAt: new Date(),
663	    attachments: workerEntryAttachments(targetMessage),
664	  });
665	  let snapshot: AgentRecord | null = null;
666	  try {
667	    snapshot = await getAgent(worker.id);
668	    await persistWorkerSnapshot(worker.id, snapshot);
669	  } catch {
670	    // The restored worker response is enough to update the conversation.
671	  }
672	  await appendAskResponseFallbackEntry({
673	    runId: run.id,
674	    workerId: worker.id,
675	    responseText: response.response,
676	    snapshot,
677	  });
678	
679	  const completedAt = new Date();
680	  await db.update(workers).set({
681	    status: snapshot?.state ?? response.state,
682	    updatedAt: completedAt,
683	  }).where(eq(workers.id, worker.id));
684	  // Worker response now lives in the unified worker stream.
685	  await updateDirectRunStatusFromWorkerOutput({
686	    runId: run.id,
687	    workerId: worker.id,
688	    workerStatus: snapshot?.state ?? response.state,
689	    responseText: response.response,
690	    renderedOutput: snapshot?.renderedOutput,
691	    currentText: snapshot?.currentText,
692	    lastText: snapshot?.lastText,
693	    outputEntries: snapshot?.outputEntries,
694	    pendingPermissions: snapshot?.pendingPermissions,
695	    pendingElicitations: snapshot?.pendingElicitations,
696	  });
697	  await resolveOpenRecoveryIncidentsForRun(run.id, worker.id, `Recovered ${worker.id}.`);
698	
699	  return { runId: run.id };
700	}
701	
702	async function startImplementationRerun(
703	  run: typeof runs.$inferSelect,
704	  plan: typeof plans.$inferSelect,

uuid: d881f553-1dd0-41bb-9abd-a1f6bd94dd4b
parent: e9699dff-5bed-4a2b-a112-27185da68939
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:21:26.338Z","phase":null} -->
## Claude thinking · 2026-06-25T21:21:26.338Z

I found another problematic call site in stuck-worker-reaper.ts at line 99 where `updateDirectRunStatusFromWorkerOutput` is invoked without passing `workerStatus` or the pending permissions and elicitations, relying only on output entries to determine if input is needed. This means if a worker is still actively processing, the run could be marked as done prematurely and trigger an unintended auto-commit.

I also spotted the same issue in recovery-reconciler.ts at line 222 where `resolveDirectRunStatusFromWorkerOutput` is called without `workerStatus` when resuming an agent that might still be mid-turn, causing it to incorrectly mark the run as done while the worker state indicates it's still working.

Looking back at the plan, recovery.ts:685 already passes `workerStatus` correctly, but recovery-reconciler.ts:222 doesn't. The user mentioned both recovery and reaper paths need fixing, so there are two files that need updates here.

Now I'm checking the git status to see what was actually modified in the dirty tree — recovery-reconciler.ts shows as modified with a small diff, but stuck-worker-reaper.ts doesn't appear in the git status at all, meaning the reaper call site at line 99 was never touched and is definitely a missed call site.

uuid: 8eb82e04-6225-4007-8d3b-a97d9b983a5b
parent: d881f553-1dd0-41bb-9abd-a1f6bd94dd4b

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:21:26.339Z","phase":null} -->
## Claude · 2026-06-25T21:21:26.339Z

Found the gaps. Let me confirm what the dirty tree actually changed in the recovery files and the reaper, and check the AgentRecord shape used at the bare `resolveDirectRunStatusFromWorkerOutput(agent)`/`(worker)` sites.

uuid: 7a1645be-c832-410d-96ac-3e8084e916d7
parent: 8eb82e04-6225-4007-8d3b-a97d9b983a5b

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:29.016Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:21:29.016Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness; echo \"=== recovery-reconciler.ts diff ===\"; git diff HEAD -- src/server/runs/recovery-reconciler.ts; echo; echo \"=== is stuck-worker-reaper.ts modified? ===\"; git status --short src/server/workers/stuck-worker-reaper.ts || echo \"(clean)\"; echo; echo \"=== is recovery.ts modified? ===\"; git status --short src/server/runs/recovery.ts || echo \"(clean)\"",
  "description": "Check recovery-reconciler diff and modification status of reaper/recovery"
}

uuid: 07e38831-b787-48fc-8716-d30a45cdbdd9
parent: 7a1645be-c832-410d-96ac-3e8084e916d7
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:29.100Z","phase":null} -->
## Claude tool result: toolu_016SZUsy2xqRpLuWfv2PKa8Q · 2026-06-25T21:21:29.100Z

```text
=== recovery-reconciler.ts diff ===
diff --git a/src/server/runs/recovery-reconciler.ts b/src/server/runs/recovery-reconciler.ts
index b1bdaf5..0f9683a 100644
--- a/src/server/runs/recovery-reconciler.ts
+++ b/src/server/runs/recovery-reconciler.ts
@@ -220,10 +220,13 @@ async function resumeSavedWorkerSession(args: {
   }
   const nextRunStatus = args.run.mode === "direct" || args.run.mode === "commit"
     ? resolveDirectRunStatusFromWorkerOutput({
+      workerStatus: resumed.state,
       renderedOutput: resumed.renderedOutput,
       currentText: resumed.currentText,
       lastText: resumed.lastText,
       outputEntries: resumed.outputEntries,
+      pendingPermissions: resumed.pendingPermissions,
+      pendingElicitations: resumed.pendingElicitations,
     })
     : "running";
 

=== is stuck-worker-reaper.ts modified? ===
 M src/server/workers/stuck-worker-reaper.ts

=== is recovery.ts modified? ===
 M src/server/runs/recovery.ts

uuid: c1ffae2d-6075-4dbf-97f1-a7d2096bc483
parent: 07e38831-b787-48fc-8716-d30a45cdbdd9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:21:34.354Z","phase":null} -->
## Claude thinking · 2026-06-25T21:21:34.354Z

I'm checking whether stuck-worker-reaper.ts was actually modified—the initial git status didn't show it, but now it appears changed. Let me verify the actual diff to see if the call at line 99 was updated to pass the new parameters.

uuid: 1f5b350b-13dd-4ecb-ae55-9aad92e27efb
parent: c1ffae2d-6075-4dbf-97f1-a7d2096bc483

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:21:34.928Z","phase":null} -->
## Claude · 2026-06-25T21:21:34.928Z

`recovery-reconciler.ts` was updated. But the reaper call I read at line 99 still lacks `workerStatus` AND the pending-input fields — yet git says the file is modified. Let me see exactly what changed in the reaper.

uuid: 6081a224-b982-4022-923e-281059830c2b
parent: 1f5b350b-13dd-4ecb-ae55-9aad92e27efb

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:35.514Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:21:35.514Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness; git diff HEAD -- src/server/workers/stuck-worker-reaper.ts",
  "description": "Show reaper diff"
}

uuid: 843c015b-d265-4e19-9141-baa0ee25229d
parent: 6081a224-b982-4022-923e-281059830c2b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:35.571Z","phase":null} -->
## Claude tool result: toolu_01R1sD1oDaDDS7Hj7GLMGUv4 · 2026-06-25T21:21:35.571Z

```text
diff --git a/src/server/workers/stuck-worker-reaper.ts b/src/server/workers/stuck-worker-reaper.ts
index 3a6a54f..f21fbfd 100644
--- a/src/server/workers/stuck-worker-reaper.ts
+++ b/src/server/workers/stuck-worker-reaper.ts
@@ -99,11 +99,14 @@ async function persistRedeliveredTurnResult(args: {
   await updateDirectRunStatusFromWorkerOutput({
     runId: args.worker.runId,
     workerId: args.worker.id,
+    workerStatus: snapshot?.state ?? "idle",
     responseText: args.responseText,
     renderedOutput: snapshot?.renderedOutput,
     currentText: snapshot?.currentText,
     lastText: snapshot?.lastText,
     outputEntries: snapshot?.outputEntries,
+    pendingPermissions: snapshot?.pendingPermissions,
+    pendingElicitations: snapshot?.pendingElicitations,
   });
 }

uuid: 1edc72d7-cc62-4ac2-b688-793722dc7d66
parent: 843c015b-d265-4e19-9141-baa0ee25229d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-25T21:21:35.572Z","phase":null} -->
## Claude attachment · 2026-06-25T21:21:35.572Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: c5a0b864-28a4-46a7-9d10-362650b183a7
parent: 1edc72d7-cc62-4ac2-b688-793722dc7d66
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:21:49.070Z","phase":null} -->
## Claude thinking · 2026-06-25T21:21:49.070Z

I'm realizing the Read at line 99 was stale too—the reaper has been updated as well. Now I need to verify that all callers of `updateDirectRunStatusFromWorkerOutput` are passing the workerStatus parameter. I've confirmed it in create.ts, send-message.ts, and queued-messages.ts, but sync.ts at line 630 is missing it, and I need to check whether that particular read actually included the workerStatus argument.

Let me re-examine sync.ts fresh since the diff showed 20 lines changed. I also need to look at the bare `resolveDirectRunStatusFromWorkerOutput` callers at lines 140 and 169—these pass agent and worker objects directly, which have `.state` and `.status` fields respectively, not `.workerStatus`. Since these callers only care about the "awaiting_user" result and the running/done distinction is handled elsewhere in resolveSyncedRunState, passing undefined for workerStatus is intentional and harmless.

There's a subtle naming footgun though: `resolveDirectRunStatusFromWorkerOutput(worker)` receives a workers.$inferSelect with a `.status` field, but the function reads `.workerStatus`, so it silently ignores the actual status data. This works fine for the current awaiting_user-only usage, but it's a latent bug if someone later expects this function to correctly return "running" or "done" for worker objects. Let me re-read sync.ts lines 630 and 719 to see if they've been updated to pass workerStatus properly.

uuid: a88a6e05-da6a-4112-a3ec-9308555e9906
parent: c5a0b864-28a4-46a7-9d10-362650b183a7

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:21:49.108Z","phase":null} -->
## Claude · 2026-06-25T21:21:49.108Z

My earlier Reads were stale snapshots — the reaper IS updated. Let me re-read the sync.ts call sites fresh (my earlier read may also be stale) and verify the two bare-object callers.

uuid: a493c37c-e633-49ec-8d09-dcf36c1d0607
parent: a88a6e05-da6a-4112-a3ec-9308555e9906

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:21:49.142Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:21:49.142Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness; git diff HEAD -- src/server/conversations/sync.ts",
  "description": "Show full sync.ts diff"
}

uuid: f3def224-a9a1-499c-9692-ec652fd8d0a3
parent: a493c37c-e633-49ec-8d09-dcf36c1d0607
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:21:49.186Z","phase":null} -->
## Claude tool result: toolu_01TyZUTcodxumABYbkviu9Uc · 2026-06-25T21:21:49.186Z

```text
diff --git a/src/server/conversations/sync.ts b/src/server/conversations/sync.ts
index 1b0813b..38007b1 100644
--- a/src/server/conversations/sync.ts
+++ b/src/server/conversations/sync.ts
@@ -59,13 +59,20 @@ function isInputEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number])
 }
 
 function isOpenWorkEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
-  if (entry.type !== "tool_call" && entry.type !== "tool_call_update" && entry.type !== "permission") {
+  if (entry.type !== "tool_call" && entry.type !== "tool_call_update" && entry.type !== "permission" && entry.type !== "elicitation") {
     return false;
   }
 
   return !isCompletedEntryStatus(entry.status);
 }
 
+function hasPendingElicitationSignal(snapshot: ReturnType<typeof normalizeAgentRecord> | null) {
+  return Boolean(
+    (snapshot?.pendingElicitations?.length ?? 0) > 0
+    || snapshot?.outputEntries?.some((entry) => entry.type === "elicitation" && !isCompletedEntryStatus(entry.status)),
+  );
+}
+
 function directLiveAgentHasCompletedTurn(agent: ReturnType<typeof normalizeAgentRecord>) {
   const state = normalizedStatus(agent.state);
   if (state !== "working" && state !== "starting" && state !== "stuck") {
@@ -80,6 +87,10 @@ function directLiveAgentHasCompletedTurn(agent: ReturnType<typeof normalizeAgent
     return false;
   }
 
+  if ((agent.pendingElicitations?.length ?? 0) > 0) {
+    return false;
+  }
+
   const entries = agent.outputEntries ?? [];
   if (entries.length === 0) {
     return false;
@@ -126,7 +137,7 @@ function resolveSyncedRunState(run: typeof runs.$inferSelect, agent: ReturnType<
     return "failed";
   }
 
-  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(agent) === "awaiting_user") {
+  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...agent, workerStatus: agent.state }) === "awaiting_user") {
     return "awaiting_user";
   }
 
@@ -155,7 +166,7 @@ async function resolvePersistedRunState(run: typeof runs.$inferSelect, worker: t
     return "failed";
   }
 
-  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(worker) === "awaiting_user") {
+  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...worker, workerStatus: worker.status }) === "awaiting_user") {
     return "awaiting_user";
   }
 
@@ -271,7 +282,8 @@ async function drainQueuedWorkerMessagesWithObservation(args: {
     return 0;
   }
 
-  const hasPendingElicitation = (args.snapshot?.pendingElicitations?.length ?? 0) > 0;
+  const snapshot = args.snapshot ?? null;
+  const hasPendingElicitation = hasPendingElicitationSignal(snapshot);
   const drainable = hasPendingElicitation || isWorkerQueueDrainableStatus(args.workerStatus);
   await recordQueueDrainDecision({
     ...args,
@@ -290,7 +302,7 @@ async function drainQueuedWorkerMessagesWithObservation(args: {
   const deliveredCount = await drainQueuedWorkerMessages({
     runId: args.runId,
     workerId: args.workerId,
-    snapshot: args.snapshot,
+    snapshot,
   });
   emitNamedEvent({
     kind: "queue.drain_finished",
@@ -618,10 +630,13 @@ export async function syncConversationSessions(rawAgents: unknown[], options: {
       await updateDirectRunStatusFromWorkerOutput({
         runId: run.id,
         workerId: worker.id,
+        workerStatus: agent.state,
         renderedOutput: agent.renderedOutput,
         currentText: agent.currentText,
         lastText: agent.lastText,
         outputEntries: agent.outputEntries,
+        pendingPermissions: agent.pendingPermissions,
+        pendingElicitations: agent.pendingElicitations,
       });
     } else {
       await db.update(runs).set({
@@ -704,6 +719,7 @@ export async function syncConversationSessions(rawAgents: unknown[], options: {
       await updateDirectRunStatusFromWorkerOutput({
         runId: run.id,
         workerId: worker.id,
+        workerStatus: worker.status,
         outputLog: worker.outputLog,
         currentText: worker.currentText,
         lastText: worker.lastText,

uuid: 9ef45238-b309-4265-8641-e12102d2d82f
parent: f3def224-a9a1-499c-9692-ec652fd8d0a3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:23:01.955Z","phase":null} -->
## Claude thinking · 2026-06-25T21:23:01.955Z

I've verified all the call sites have been updated correctly—each one now explicitly spreads the object and passes the appropriate status field as `workerStatus`.

The key insight is that the two bare callers at sync.ts:140 and :169 spread the full agent/worker object, which includes `pendingPermissions`, `pendingElicitations`, and `outputEntries`, so those properties are available to the function even though they're not explicitly named. Since these calls only check for `=== "awaiting_user"`, the `workerStatus` addition doesn't affect their logic, but it's still the correct pattern to follow.

The bigger concern is whether there are other places in the codebase that directly set a direct run's status to "done" without going through this function—that would be a potential source of inconsistency where a run could be marked done while the worker is still working. The core invariant question is about precedence: if a worker is actively working but has an open elicitation, should the run be "awaiting_user" or "running"?

Looking at the actual flow, when Claude raises an AskUserQuestion, the worker state is often still "working" because the turn hasn't returned yet—so yes, both conditions can be true simultaneously, and awaiting_user must take precedence, which the implementation does correctly. In resolveSyncedRunState, awaiting_user is checked before other conditions, and directLiveAgentHasCompletedTurn now also checks for pending elicitations so a completed turn with an open request won't be falsely marked done. When the resolved state is "running", sync.ts writes that directly, but when it's awaiting_user or done, it goes through updateDirectRunStatusFromWorkerOutput which...

Wait, I'm seeing a critical bug here. If directLiveAgentHasCompletedTurn returns true (meaning the turn finished even though agent.state is still "working"), nextRunState becomes "done". But then updateDirectRunStatusFromWorkerOutput gets called with workerStatus: "working", which is in the ACTIVE set, so it returns "running" instead of "done". The run ends up marked as running when it should be done—a direct contradiction between what the turn completion logic determined and what the worker status recomputation produces.

The root issue is even more subtle: at line 591-592, nextWorkerStatus is set to "idle" when the turn quiesces, and the persisted worker row gets "idle". But then at line 632, updateDirectRunStatusFromWorkerOutput receives the stale agent.state ("working") instead of nextWorkerStatus ("idle"). So the function sees "working", returns "running", and the run gets stuck—the auto-commit milestone never fires, and the state bounces or repeats on the next sweep. The fix would be passing nextWorkerStatus instead of agent.state to updateDirectRunStatusFromWorkerOutput, or more robustly, ensuring the quiesced state is used when determining the run status. So when a turn completes while the agent state is still "working", the code detects it via directLiveAgentHasCompletedTurn and sets nextRunState to "done", but then updateDirectRunStatusFromWorkerOutput recomputes it back to "running" because the worker status is still "working". This creates a loop where the run gets stuck at "running" status with an idle worker — the auto-commit never fires because the status keeps bouncing between "done" and "running" on each sweep.

The root cause is that sync.ts passes the current agent.state as workerStatus instead of the quiesced nextWorkerStatus, so the completed-turn detection gets overridden. The design relies on catching this case precisely because agent.state may stay stuck at "working", so waiting for a later sweep where it becomes "idle" defeats the whole purpose of the watchdog. The persisted branch handles stuck workers correctly because the persisted status is already normalized to idle, so the state machine stays consistent. The only problematic site is the live quiesced path where `agent.state` gets passed instead of the correct `nextWorkerStatus`. There's also some redundancy in how completion detection is split between two places — the directLiveAgentHasCompletedTurn check in sync and the workerStatus heuristic in the run-status resolver — which creates a footgun when the live state lags behind actual completion.

The fix is either to have the caller pass the already-resolved status and trust it, or to pass the post-quiesce status so both layers agree. I should also check recovery-reconciler.ts to see if it has the same issue, and then search for other places where direct run status gets written to catch any missed call sites.

uuid: 7dcae257-7f18-411a-9907-e023e7004159
parent: 9ef45238-b309-4265-8641-e12102d2d82f

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:23:02.128Z","phase":null} -->
## Claude · 2026-06-25T21:23:02.128Z

All call sites are actually updated (my first reads were stale). Now let me verify the one place I suspect a real defect — the interaction between `directLiveAgentHasCompletedTurn` and the `workerStatus` passed at sync.ts:632 — and grep for any other direct-run status writers that bypass the helper.

uuid: 62a5ea15-f02c-4e4e-bc96-33d894976038
parent: 7dcae257-7f18-411a-9907-e023e7004159

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:23:04.004Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:23:04.004Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/sync.ts",
  "offset": 588,
  "limit": 52
}

uuid: f23b8558-1120-468f-951f-600d878a1b6d
parent: 62a5ea15-f02c-4e4e-bc96-33d894976038
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:23:04.018Z","phase":null} -->
## Claude tool result: toolu_0112d8E2HukNqPMugvCw5CHA · 2026-06-25T21:23:04.018Z

```text
588	
589	    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
590	    const nextRunState = resolveSyncedRunState(run, agent);
591	    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
592	    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
593	    await db.update(workers).set({
594	      status: nextWorkerStatus,
595	      cwd: agent.cwd || worker.cwd,
596	      currentText: quiescedDirectWorker ? "" : agent.currentText,
597	      lastText: agent.lastText,
598	      updatedAt: new Date(),
599	    }).where(eq(workers.id, worker.id));
600	    if (worker.status !== nextWorkerStatus) {
601	      emitNamedEvent({
602	        kind: "worker.status",
603	        runId: run.id,
604	        workerId: worker.id,
605	        prev: worker.status,
606	        next: nextWorkerStatus,
607	      });
608	    }
609	
610	    if (run.mode === "planning") {
611	      const result = await refreshPlanningArtifactsForRun({
612	        run,
613	        worker,
614	        snapshot: agent,
615	        status: nextRunState === "running" ? "working" : undefined,
616	      });
617	      if (staleBusyFailure && result.status !== "failed") {
618	        await clearMatchingRunFailureMessage(run);
619	      }
620	      await drainQueuedWorkerMessagesWithObservation({
621	        runId: run.id,
622	        workerId: worker.id,
623	        workerStatus: agent.state,
624	        source: "live_planning_sync",
625	      });
626	      continue;
627	    }
628	
629	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
630	      await updateDirectRunStatusFromWorkerOutput({
631	        runId: run.id,
632	        workerId: worker.id,
633	        workerStatus: agent.state,
634	        renderedOutput: agent.renderedOutput,
635	        currentText: agent.currentText,
636	        lastText: agent.lastText,
637	        outputEntries: agent.outputEntries,
638	        pendingPermissions: agent.pendingPermissions,
639	        pendingElicitations: agent.pendingElicitations,

uuid: 92394114-8393-4a81-8d2a-25990bc647f8
parent: f23b8558-1120-468f-951f-600d878a1b6d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:23:05.593Z","phase":null} -->
## Claude tool call: Bash · 2026-06-25T21:23:05.593Z

```json
{
  "command": "cd /Users/masterman/NLP/omniharness; echo \"=== direct/commit run status writes (status: done/awaiting_user/running) ===\"; grep -rn \"status: \\\"done\\\"\\|status: \\\"awaiting_user\\\"\\|status: \\\"running\\\"\" src/server --include=\"*.ts\" | grep -iv \"worker\\|implementation\" | head -50",
  "description": "Find run status writers"
}

uuid: 6b216895-e9e5-47e1-967e-0216c393ef32
parent: 92394114-8393-4a81-8d2a-25990bc647f8
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:23:05.658Z","phase":null} -->
## Claude tool result: toolu_01CUmCq7ueoGM2FMwvbaeT1t · 2026-06-25T21:23:05.658Z

```text
=== direct/commit run status writes (status: done/awaiting_user/running) ===
src/server/session-providers/process-provider.ts:58:      status: "running",
src/server/session-providers/process-provider.ts:69:      status: "running",
src/server/session-providers/process-store.ts:265:    status: "running",
src/server/planning/promote.ts:120:    status: "running",
src/server/planning/promote.ts:137:    status: "running",
src/server/planning/transition.ts:43:    status: "running",
src/server/planning/transition.ts:49:    status: "running",
src/server/planning/review.ts:219:    status: "running",
src/server/planning/review.ts:237:  return { reviewRunId, status: "running" };
src/server/conversations/queued-messages.ts:310:    status: "running",
src/server/conversations/queued-messages.ts:709:      status: "running",
src/server/conversations/sync.ts:491:            status: "running",
src/server/conversations/sync.ts:515:              status: "running",
src/server/conversations/sync.ts:536:        status: "running",
src/server/conversations/send-message.ts:177:    status: "running",
src/server/conversations/send-message.ts:487:      status: "running",
src/server/conversations/send-message.ts:1014:      status: "running",
src/server/conversations/create.ts:483:      status: "awaiting_user",
src/server/conversations/create.ts:491:      status: "running",
src/server/clarifications/loop.ts:37:  await db.update(runs).set({ status: "awaiting_user", updatedAt: now }).where(eq(runs.id, runId));
src/server/supervisor/wake.ts:159:      status: "running",
src/server/runs/recovery-actions.ts:129:      status: "running",
src/server/runs/recovery-actions.ts:135:    status: "running",
src/server/runs/recovery.ts:650:    status: "running",
src/server/runs/recovery.ts:730:    status: "running",
src/server/runs/recovery.ts:734:    status: "running",
src/server/runs/recovery.ts:749:    status: "running",
src/server/runs/recovery.ts:753:    status: "running",
src/server/runs/recovery.ts:874:        status: "running",
src/server/runs/recovery.ts:892:        status: "running",
src/server/runs/recovery.ts:1000:    status: "running",
src/server/supervisor/resume.ts:30:      status: "running",
src/server/supervisor/resume.ts:60:  await db.update(runs).set({ status: "running", updatedAt: new Date() }).where(eq(runs.id, runId));
src/server/supervisor/runtime-watchdog.ts:45:    status: "running",
src/server/supervisor/runtime-watchdog.ts:49:    status: "running",
src/server/supervisor/index.ts:373:    await tx.update(runs).set({ status: "awaiting_user", updatedAt: now }).where(eq(runs.id, args.runId));
src/server/supervisor/index.ts:1096:      status: "running",
src/server/supervisor/index.ts:1135:      await db.update(runs).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(runs.id, this.runId));
src/server/supervisor/index.ts:1940:          await db.update(runs).set({ status: "done", updatedAt: new Date() }).where(eq(runs.id, this.runId));

uuid: 5eb2d64f-264f-4fed-9a4c-7e6f9b16afaa
parent: 6b216895-e9e5-47e1-967e-0216c393ef32
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:23:21.159Z","phase":null} -->
## Claude thinking · 2026-06-25T21:23:21.159Z

I've found the bug. The issue is in sync.ts at line 591 where `quiescedDirectWorker` gets set based on whether the agent has completed its turn, but this only returns true when the agent is in certain states like working, starting, or stuck. When the agent is actually quiesced, the sync state resolves to "done" instead, which causes the worker row to be set incorrectly.

The real problem surfaces at line 633: when passing the worker status to `updateDirectRunStatusFromWorkerOutput`, the code passes `agent.state` (which is still active like "working" or "starting") instead of `nextWorkerStatus` (which would be "idle" when quiesced). This inconsistency means the run status gets set to "running" instead of "done", so the auto-commit milestone is never reached and the run gets stuck in a "running" state with an idle worker.

The fix is straightforward—pass `nextWorkerStatus` instead of `agent.state` at that line to keep the completion logic consistent. I've verified all the call sites and this is the only real bug in the direct worker output path, so I'm ready to write up the review.

Let me just double-check the initial run creation paths in create.ts around lines 483 and 491 to make sure they're not direct-output paths that should be using the helper.

uuid: 1a88c7da-9624-4035-af3a-1a466a44c856
parent: 5eb2d64f-264f-4fed-9a4c-7e6f9b16afaa

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:23:21.297Z","phase":null} -->
## Claude · 2026-06-25T21:23:21.297Z

Confirmed the defect. Let me quickly check the `create.ts:483/491` status writes to be sure they aren't a direct-output path that bypasses the helper.

uuid: 69092365-7d67-4433-b1ca-c2839d48ea32
parent: 1a88c7da-9624-4035-af3a-1a466a44c856

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-25T21:23:22.338Z","phase":null} -->
## Claude tool call: Read · 2026-06-25T21:23:22.338Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/create.ts",
  "offset": 470,
  "limit": 30
}

uuid: 51d80285-13b7-496b-8c7c-0616642cbbbd
parent: 69092365-7d67-4433-b1ca-c2839d48ea32
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-25T21:23:22.349Z","phase":null} -->
## Claude tool result: toolu_018DcJyqiVQ48yUQe4VFBooi · 2026-06-25T21:23:22.349Z

```text
470	      runId: args.runId,
471	      workerId: args.workerId,
472	      mode: "direct",
473	      error,
474	    });
475	    console.error("Initial direct conversation worker spawn failed:", error);
476	    return;
477	  }
478	
479	  // When resuming an external session with no initial command, just connect the
480	  // agent and leave the worker in awaiting_user state for the next message.
481	  if (args.externalClaudeSessionId && !args.command) {
482	    await db.update(workers).set({
483	      status: "awaiting_user",
484	      type: agent.type || args.workerType,
485	      cwd: agent.cwd || args.cwd,
486	      bridgeSessionId: agent.sessionId ?? null,
487	      bridgeSessionMode: agent.sessionMode ?? null,
488	      updatedAt: new Date(),
489	    }).where(eq(workers.id, args.workerId));
490	    await db.update(runs).set({
491	      status: "running",
492	      updatedAt: new Date(),
493	    }).where(eq(runs.id, args.runId));
494	    notifyEventStreamSubscribers();
495	    return;
496	  }
497	
498	  try {
499	    await runWorkerTurn(args.workerId, () => runInitialWorkerTurn({

uuid: d03aebcc-23a4-4df8-bb3f-3d77dd6c51ac
parent: 51d80285-13b7-496b-8c7c-0616642cbbbd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-25T21:23:32.735Z","phase":null} -->
## Claude thinking · 2026-06-25T21:23:32.735Z

I'm noting that resuming an external session without a command is a special case where the worker enters an awaiting_user state while the run stays active — that's the intended initial connect behavior, not something that needs reconciliation. I have what I need to write up the review now, and the main finding is that the plan is essentially already implemented in the current codebase.

The critical bug is in sync.ts:633, where `workerStatus: agent.state` gets passed instead of `nextWorkerStatus`. Since `directLiveAgentHasCompletedTurn` only returns true for active states, the quiesced-completion path correctly computes nextRunState as "done", but then update() re-derives it back to "running" — preventing the milestone auto-commit from firing. The fix is establishing a single source of truth: either pass nextWorkerStatus consistently or have update() trust the caller's resolved status instead of re-deriving it. The two bare callers at lines 140 and 169 are harmless since they only use the awaiting_user result and could call directWorkerOutputHasPendingHumanInput directly. All other call sites check out correctly.

uuid: fb7fe946-d8a5-44c4-a876-ff4150048abf
parent: d03aebcc-23a4-4df8-bb3f-3d77dd6c51ac

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-25T21:23:57.717Z","phase":null} -->
## Claude · 2026-06-25T21:23:57.717Z

I've now traced the full picture with ground truth (my first two file Reads were stale pre-edit snapshots — the working tree already implements the plan). Here's the review.

## Bottom line

The plan is **already implemented** in your dirty tree, and all ten `resolveDirectRunStatusFromWorkerOutput` / `updateDirectRunStatusFromWorkerOutput` call sites pass worker state. The diagnosis and structured-pending-input approach are sound. But there is **one real defect in the wiring** that reproduces the exact "bounces between working and not working" symptom, plus an invariant weakness behind it.

## Call-site audit (all verified against the actual files, not the stale snapshots)

| Site | Passes `workerStatus`? | Verdict |
|---|---|---|
| `create.ts:397` | `snapshot?.state ?? response.state` | ✅ |
| `send-message.ts:616` | ✅ | ✅ |
| `queued-messages.ts:362` | ✅ | ✅ |
| `stuck-worker-reaper.ts:99` | `snapshot?.state ?? "idle"` (+pending) | ✅ |
| `recovery.ts:685` | `snapshot?.state ?? response.state` | ✅ |
| `recovery-reconciler.ts:222` | `resumed.state` (+pending) | ✅ |
| `sync.ts:140` (`resolveSyncedRunState`) | `{...agent, workerStatus: agent.state}` | ✅ (but inert, see below) |
| `sync.ts:169` (`resolvePersistedRunState`) | `{...worker, workerStatus: worker.status}` | ✅ (inert) |
| `sync.ts:719` (persisted done/await) | `worker.status` | ✅ |
| `sync.ts:630` (live done/await) | `agent.state` | ⚠️ **bug — see below** |

No missed call sites: I grepped every direct/commit run-status writer; the rest (`supervisor/*`, `planning/*`, `recovery.ts` restart paths, `create.ts:491` external-resume connect) are not driven by reconciled worker output and correctly stay outside this helper.

## The real defect: `sync.ts:630` passes `agent.state`, not the quiesced status

Trace the live completed-turn path:

1. `sync.ts:591` — `quiescedDirectWorker = directLiveAgentHasCompletedTurn(agent)`.
2. `directLiveAgentHasCompletedTurn` (sync.ts:77-78) **only returns true when `agent.state` ∈ {`working`, `starting`, `stuck`}** — all of which are in `ACTIVE_DIRECT_WORKER_STATUSES`.
3. So when the turn has quiesced, `resolveSyncedRunState` → `"done"`, and the worker row is written as `nextWorkerStatus = "idle"` (line 592-594).
4. But line 633 passes `workerStatus: agent.state` (still `"working"`), **not** `nextWorkerStatus`.
5. Inside `updateDirectRunStatusFromWorkerOutput`, `resolveDirectRunStatusFromWorkerOutput(args)` re-derives: no pending input → `workerStatus` is active → returns **`"running"`**, never `"done"`.

Consequence: the run is written `"running"` with an `idle` worker, the `nextStatus === "done"` branch (milestone `runMilestoneAutoCommit`) is **unreachable** on this path, and the next sweep repeats the same thing — run stuck `running`, no auto-commit. This is precisely the bounce you set out to kill, just relocated from the prose-regex into the new status precedence. It's the most common direct-worker completion path (the watchdog exists specifically for "state stuck at working but turn done"), so this isn't a corner case.

**Minimal fix:** at `sync.ts:633` pass `workerStatus: nextWorkerStatus` (= `"idle"` when quiesced). Then both completion decisions agree and `done` + auto-commit fire. Add a sync test for: live agent `state:"working"`, completed turn (stopReason set, last entry `message`, no pending input) → run becomes `done` and milestone commits.

## The better invariant

The root cause is **two independent completion authorities** that can disagree:

- `resolveSyncedRunState` / `directLiveAgentHasCompletedTurn` decide done-vs-running from *turn shape* (stopReason, last entry type, open work entries).
- `resolveDirectRunStatusFromWorkerOutput` re-decides done-vs-running from *raw `workerStatus`*.

When sync hands the raw `agent.state` to `update()`, the second authority silently overrides the first. Pick one source of truth:

- **Cheapest:** have callers pass the *post-reconciliation* status they've already computed (`nextWorkerStatus`), never the raw live state. The fix above does this for the one broken site.
- **Cleaner:** since `sync.ts:630`/`719` already know `nextRunState` is `awaiting_user`-or-`done`, let `update()` accept an explicit `resolvedStatus` and trust it rather than re-deriving — so the running/done call lives in exactly one place. The bare callers at `sync.ts:140`/`169` only ever compare `=== "awaiting_user"`, so the `workerStatus` you added there is inert today; they'd be clearer calling `directWorkerOutputHasPendingHumanInput(...)` directly, which also removes the temptation to rely on a running/done result the spread can't reliably produce (`worker.$inferSelect` has `.status`, not `.workerStatus` — the spread only works because you alias it inline).

## One precedence point worth a regression test (it's correct now — keep it correct)

`awaiting_user` must outrank `running`, because during an `AskUserQuestion` the ACP agent's `state` is typically still `working` while requestId N is pending — that's the session you diagnosed. Your ordering (pending-input check first) is right, and `directLiveAgentHasCompletedTurn` now also bails on `pendingElicitations` (sync.ts:90). Lock both with tests so a future refactor that reorders the checks, or drops the elicitation guard, can't regress to "working while a question is open."

Net: the design is right and nearly fully wired — fix `sync.ts:633` (`agent.state` → `nextWorkerStatus`), and consider collapsing the dual completion authority so the milestone commit can't be stranded again.

uuid: b19fb7ef-5e12-464a-b84f-dea825ed78f7
parent: fb7fe946-d8a5-44c4-a876-ff4150048abf

<!-- /codex-event -->

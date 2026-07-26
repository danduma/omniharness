---
provider: "claude"
codex_thread_id: "6f2fa106-5995-49c9-9853-de5a846a365b"
title: "Diagnose duplicate user message bug"
started_at: "2026-06-26T20:43:19.216Z"
updated_at: "2026-06-26T20:45:35.433Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Diagnose duplicate user message bug

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:43:19.216Z","phase":null} -->
## Claude state: queue-operation · 2026-06-26T20:43:19.216Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-06-26T20:43:19.216Z",
  "sessionId": "6f2fa106-5995-49c9-9853-de5a846a365b",
  "content": "Read-only second opinion on OmniHarness bug in /Users/masterman/NLP/omniharness. Session 279f067d7f7c shows duplicate user text: DB messages rows 14f539... and 1b879..., queued_conversation_messages row 1b879... failed with Respond elicitation failed: no_pending_elicitations. Worker stream has user_input seq 2282 id 14f539 from direct elicitation answer, then seq 2283 id 1b879 from queued worker drain/interrupt. Relevant files: src/server/conversations/send-message.ts answerDirectWorkerElicitation; src/server/conversations/queued-messages.ts drainQueuedWorkerMessages appends user_input/messages before answerPendingWorkerElicitation; src/server/conversations/queued-message-interrupt.ts interrupt delivery; src/server/conversations/sync.ts drains queues on live sync. Please identify likely root cause and minimal durable fix/test focus. Do not edit files."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:43:19.216Z","phase":null} -->
## Claude state: queue-operation · 2026-06-26T20:43:19.216Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-06-26T20:43:19.216Z",
  "sessionId": "6f2fa106-5995-49c9-9853-de5a846a365b"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-26T20:43:19.246Z","phase":null} -->
## User · 2026-06-26T20:43:19.246Z

Read-only second opinion on OmniHarness bug in /Users/masterman/NLP/omniharness. Session 279f067d7f7c shows duplicate user text: DB messages rows 14f539... and 1b879..., queued_conversation_messages row 1b879... failed with Respond elicitation failed: no_pending_elicitations. Worker stream has user_input seq 2282 id 14f539 from direct elicitation answer, then seq 2283 id 1b879 from queued worker drain/interrupt. Relevant files: src/server/conversations/send-message.ts answerDirectWorkerElicitation; src/server/conversations/queued-messages.ts drainQueuedWorkerMessages appends user_input/messages before answerPendingWorkerElicitation; src/server/conversations/queued-message-interrupt.ts interrupt delivery; src/server/conversations/sync.ts drains queues on live sync. Please identify likely root cause and minimal durable fix/test focus. Do not edit files.

uuid: 9b72bdc3-ca36-4b03-aeb8-471aebea13c9

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:43:19.246Z","phase":null} -->
## Claude attachment · 2026-06-26T20:43:19.246Z

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

uuid: 623fd473-4ec6-41d3-a925-a900d0d87b4c
parent: 9b72bdc3-ca36-4b03-aeb8-471aebea13c9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:43:19.246Z","phase":null} -->
## Claude attachment · 2026-06-26T20:43:19.246Z

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

uuid: fd9eb1a8-27e3-41b9-a04e-71118da2f10b
parent: 623fd473-4ec6-41d3-a925-a900d0d87b4c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:43:19.246Z","phase":null} -->
## Claude attachment · 2026-06-26T20:43:19.246Z

```text
{
  "type": "budget_usd",
  "used": 0,
  "total": 1,
  "remaining": 1
}

binary omitted from archive

uuid: 581bae83-3594-41b4-98c5-aa1950a38907
parent: fd9eb1a8-27e3-41b9-a04e-71118da2f10b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-26T20:43:25.457Z","phase":null} -->
## Claude thinking · 2026-06-26T20:43:25.457Z

The user wants a read-only investigation into a bug without making any edits, so I need to identify the root cause and suggest a minimal fix and testing approach. Let me start by examining the relevant files to understand what's happening.

uuid: b6e50215-f497-426d-9974-1dc16b5208db
parent: 581bae83-3594-41b4-98c5-aa1950a38907

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-26T20:43:25.470Z","phase":null} -->
## Claude · 2026-06-26T20:43:25.470Z

I'll investigate this read-only. Let me read the relevant files in parallel.

uuid: d788c9fa-2bc0-43f9-a2eb-9acb4ca36c61
parent: b6e50215-f497-426d-9974-1dc16b5208db

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-26T20:43:25.480Z","phase":null} -->
## Claude tool call: Read · 2026-06-26T20:43:25.480Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts"
}

uuid: ea685955-65b3-491c-a125-9cc1e0eeb227
parent: d788c9fa-2bc0-43f9-a2eb-9acb4ca36c61
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-26T20:43:25.486Z","phase":null} -->
## Claude tool call: Read · 2026-06-26T20:43:25.486Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/queued-messages.ts"
}

uuid: 529767c8-86f2-48f0-ad95-4a44754558f5
parent: ea685955-65b3-491c-a125-9cc1e0eeb227
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-26T20:43:25.768Z","phase":null} -->
## Claude tool call: Read · 2026-06-26T20:43:25.768Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/queued-message-interrupt.ts"
}

uuid: 0bc63dd4-14a4-4970-b614-0757f5e1a56d
parent: 529767c8-86f2-48f0-ad95-4a44754558f5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-26T20:43:25.778Z","phase":null} -->
## Claude tool result: toolu_017CPd77wv3VNdpTq9zZHHMs · 2026-06-26T20:43:25.778Z

```text
1	import { randomUUID } from "crypto";
2	import { asc, eq } from "drizzle-orm";
3	import { askAgent, cancelAgentTurn } from "@/server/bridge-client";
4	import { db } from "@/server/db";
5	import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
6	import { recordExecutionEvent } from "@/server/events/execution-event-store";
7	import { emitNamedEvent } from "@/server/events/named-events";
8	import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
9	import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
10	import { appendAttachmentContext, normalizeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
11	import { getAppDataPath } from "@/server/app-root";
12	import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
13	import { persistRunFailure } from "@/server/runs/failures";
14	import { serializeMessageRecord } from "./message-records";
15	import { serializeQueuedConversationMessage } from "./queued-message-records";
16	import {
17	  createQueuedConversationMessage,
18	  errorMessage,
19	  getLatestRunWorker,
20	  isAgentBusyError,
21	  isAgentNotFoundError,
22	  isCancelledWorkerStatus,
23	  isEmptyQueuedWorkerOutputError,
24	  persistDeliveredWorkerResponse,
25	} from "./queued-messages";
26	import {
27	  advanceWorkerTurnGeneration,
28	  isWorkerTurnGenerationCurrent,
29	  runWorkerTurn,
30	  trackConversationBackgroundTask,
31	} from "./worker-turn-gate";
32	import { buildDirectWorkerPrompt } from "./direct-worker-prompt";
33	
34	type RunRecord = typeof runs.$inferSelect;
35	type WorkerRecord = typeof workers.$inferSelect;
36	type QueuedRecord = typeof queuedConversationMessages.$inferSelect;
37	
38	export type InterruptSource = "escape" | "drawer" | "api";
39	
40	export interface InterruptResult {
41	  ok: true;
42	  message?: ReturnType<typeof serializeMessageRecord>;
43	  queuedMessage: ReturnType<typeof serializeQueuedConversationMessage>;
44	  interruption: {
45	    status: "delivering" | "deferred";
46	    workerId: string;
47	    cancelDurationMs: number;
48	  };
49	}
50	
51	function refusal(status: number, message: string) {
52	  return Object.assign(new Error(message), { status });
53	}
54	
55	async function queuedRowStatus(messageId: string) {
56	  const record = await db
57	    .select({ status: queuedConversationMessages.status })
58	    .from(queuedConversationMessages)
59	    .where(eq(queuedConversationMessages.id, messageId))
60	    .get();
61	  return record?.status ?? null;
62	}
63	
64	function timestampMs(value: Date | string | number | null | undefined) {
65	  if (value instanceof Date) {
66	    return value.getTime();
67	  }
68	  const parsed = new Date(value ?? 0).getTime();
69	  return Number.isFinite(parsed) ? parsed : 0;
70	}
71	
72	async function loadRun(runId: string): Promise<RunRecord> {
73	  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
74	  if (!run) {
75	    throw refusal(404, "Conversation not found");
76	  }
77	  return run;
78	}
79	
80	async function loadQueuedRecord(runId: string, messageId: string): Promise<QueuedRecord> {
81	  const record = await db
82	    .select()
83	    .from(queuedConversationMessages)
84	    .where(eq(queuedConversationMessages.id, messageId))
85	    .get();
86	  if (!record || record.runId !== runId) {
87	    throw refusal(404, "Queued message not found");
88	  }
89	  if (record.status === "delivered") {
90	    throw refusal(409, "Queued message was already delivered");
91	  }
92	  if (record.status === "cancelled") {
93	    throw refusal(409, "Queued message was cancelled");
94	  }
95	  return record;
96	}
97	
98	async function selectOldestPendingRecord(runId: string): Promise<QueuedRecord> {
99	  const records = await db
100	    .select()
101	    .from(queuedConversationMessages)
102	    .where(eq(queuedConversationMessages.runId, runId))
103	    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
104	  const pending = records.find((record) => record.status === "pending");
105	  if (!pending) {
106	    emitNamedEvent({
107	      kind: "queue.interrupt_refused",
108	      runId,
109	      workerId: null,
110	      queuedMessageId: null,
111	      reason: "no_user_intent",
112	      source: "escape",
113	    });
114	    throw refusal(409, "No queued message to interrupt");
115	  }
116	  return pending;
117	}
118	
119	async function resolveInterruptWorker(run: RunRecord, record: QueuedRecord): Promise<WorkerRecord | null> {
120	  const targetWorker = record.targetWorkerId
121	    ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
122	    : null;
123	  if (targetWorker && targetWorker.runId === run.id && !isCancelledWorkerStatus(targetWorker.status)) {
124	    return targetWorker;
125	  }
126	  const latest = await getLatestRunWorker(run.id, record.targetWorkerId);
127	  if (latest && latest.runId === run.id && !isCancelledWorkerStatus(latest.status)) {
128	    return latest;
129	  }
130	  return null;
131	}
132	
133	/**
134	 * Core control-plane flow shared by every interrupt entry point:
135	 * cancel the active turn, advance the worker turn fence into a delivery-safe
136	 * state, then deliver exactly one queued user message through the unified
137	 * worker stream. Emits named + execution events for every decision.
138	 */
139	async function interruptAndDeliver(args: {
140	  run: RunRecord;
141	  record: QueuedRecord;
142	  source: InterruptSource;
143	}): Promise<InterruptResult> {
144	  const { run, record, source } = args;
145	  const runId = run.id;
146	  const requestedAt = Date.now();
147	
148	  emitNamedEvent({
149	    kind: "queue.interrupt_requested",
150	    runId,
151	    workerId: record.targetWorkerId ?? null,
152	    queuedMessageId: record.id,
153	    source,
154	  });
155	  await recordExecutionEvent({
156	    runId,
157	    workerId: record.targetWorkerId ?? null,
158	    eventType: "queued_message_interrupt_requested",
159	    details: {
160	      summary: "User requested an interrupt-and-send for a queued message.",
161	      queuedMessageId: record.id,
162	      source,
163	    },
164	  });
165	
166	  const worker = await resolveInterruptWorker(run, record);
167	  if (!worker) {
168	    emitNamedEvent({
169	      kind: "queue.interrupt_refused",
170	      runId,
171	      workerId: record.targetWorkerId ?? null,
172	      queuedMessageId: record.id,
173	      reason: "worker_missing",
174	      source,
175	    });
176	    emitNamedEvent({
177	      kind: "error.surfaced",
178	      code: "queue.interrupt.refused",
179	      message: "No active worker is available to interrupt.",
180	      surface: "toast",
181	      runId,
182	    });
183	    throw refusal(409, "No active worker is available to interrupt");
184	  }
185	
186	  // Cancel the current worker turn (and any pending permissions).
187	  const cancelStartedAt = Date.now();
188	  try {
189	    await cancelAgentTurn(worker.id);
190	  } catch (error) {
191	    emitNamedEvent({
192	      kind: "queue.interrupt_delivery_failed",
193	      runId,
194	      workerId: worker.id,
195	      queuedMessageId: record.id,
196	      reason: "cancel_failed",
197	      deferred: false,
198	      totalInterruptLatencyMs: Date.now() - requestedAt,
199	      source,
200	    });
201	    emitNamedEvent({
202	      kind: "error.surfaced",
203	      code: "queue.interrupt.cancel_failed",
204	      message: `Could not interrupt the active turn: ${errorMessage(error)}`,
205	      surface: "toast",
206	      runId,
207	      workerId: worker.id,
208	    });
209	    await recordExecutionEvent({
210	      runId,
211	      workerId: worker.id,
212	      eventType: "queued_message_interrupt_failed",
213	      details: {
214	        summary: `Failed to cancel the active turn for ${worker.id}.`,
215	        queuedMessageId: record.id,
216	        error: errorMessage(error),
217	        source,
218	      },
219	    });
220	    // Keep the queued row pending so user intent is not lost.
221	    notifyEventStreamSubscribers();
222	    throw refusal(502, `Could not interrupt the active turn: ${errorMessage(error)}`);
223	  }
224	  const cancelDurationMs = Date.now() - cancelStartedAt;
225	
226	  // Advance the fence and reset persisted worker state into a delivery-safe
227	  // shape in one mutation so immediate delivery cannot observe stale `working`.
228	  const cancelledAt = new Date();
229	  const generation = await advanceWorkerTurnGeneration(worker.id, {
230	    status: "idle",
231	    clearCurrentText: true,
232	    updatedAt: cancelledAt,
233	  });
234	
235	  emitNamedEvent({
236	    kind: "queue.interrupt_cancelled_turn",
237	    runId,
238	    workerId: worker.id,
239	    queuedMessageId: record.id,
240	    cancelDurationMs,
241	    source,
242	  });
243	  await recordExecutionEvent({
244	    runId,
245	    workerId: worker.id,
246	    eventType: "queued_message_turn_cancelled",
247	    details: {
248	      summary: `Interrupted the active turn for ${worker.id}.`,
249	      queuedMessageId: record.id,
250	      cancelDurationMs,
251	      source,
252	    },
253	  });
254	
255	  // Mark the row delivering and move the run back into an active state.
256	  const startedAt = new Date();
257	  await db.update(queuedConversationMessages).set({
258	    action: "steer",
259	    targetWorkerId: worker.id,
260	    status: "delivering",
261	    lastError: null,
262	    updatedAt: startedAt,
263	  }).where(eq(queuedConversationMessages.id, record.id));
264	  await db.update(runs).set({
265	    status: run.mode === "planning" ? "working" : "running",
266	    failedAt: null,
267	    lastError: null,
268	    updatedAt: startedAt,
269	  }).where(eq(runs.id, runId));
270	
271	  emitNamedEvent({
272	    kind: "queue.interrupt_delivery_started",
273	    runId,
274	    workerId: worker.id,
275	    queuedMessageId: record.id,
276	    totalInterruptLatencyMs: Date.now() - requestedAt,
277	    source,
278	  });
279	  notifyEventStreamSubscribers();
280	
281	  const normalizedAttachments = normalizeChatAttachments(
282	    record.attachmentsJson ? JSON.parse(record.attachmentsJson) : [],
283	  );
284	  const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
285	    resolvePath: (storagePath) => getAppDataPath(storagePath),
286	  });
287	
288	  const userMessage = {
289	    id: record.id,
290	    runId,
291	    role: "user" as const,
292	    kind: "checkpoint" as const,
293	    content: record.content,
294	    attachmentsJson: record.attachmentsJson,
295	    createdAt: startedAt,
296	  };
297	
298	  trackConversationBackgroundTask(
299	    deliverInterruptedQueuedMessage({
300	      run,
301	      worker,
302	      record,
303	      userMessage,
304	      workerContent,
305	      attachments: normalizedAttachments,
306	      generation,
307	      source,
308	      requestedAt,
309	    }).catch((error) => {
310	      console.error("Queued message interrupt delivery failed:", error);
311	    }),
312	  );
313	
314	  return {
315	    ok: true,
316	    message: serializeMessageRecord(userMessage),
317	    queuedMessage: serializeQueuedConversationMessage({
318	      ...record,
319	      action: "steer",
320	      targetWorkerId: worker.id,
321	      status: "delivering",
322	      lastError: null,
323	      updatedAt: startedAt,
324	      deliveredAt: null,
325	    }),
326	    interruption: {
327	      status: "delivering",
328	      workerId: worker.id,
329	      cancelDurationMs,
330	    },
331	  };
332	}
333	
334	async function deliverInterruptedQueuedMessage(args: {
335	  run: RunRecord;
336	  worker: WorkerRecord;
337	  record: QueuedRecord;
338	  userMessage: {
339	    id: string;
340	    runId: string;
341	    role: "user";
342	    kind: "checkpoint";
343	    content: string;
344	    attachmentsJson: string | null;
345	    createdAt: Date;
346	  };
347	  workerContent: string;
348	  attachments: ChatAttachment[];
349	  generation: number;
350	  source: InterruptSource;
351	  requestedAt: number;
352	}) {
353	  const { run, worker, record, userMessage, workerContent, attachments, generation, source, requestedAt } = args;
354	  const runId = run.id;
355	
356	  // A stale terminal write must never overwrite a newer interrupt delivery or a
357	  // row the user cancelled mid-flight. Every terminal mutation re-checks both.
358	  const isStillCurrent = async () => {
359	    if (await queuedRowStatus(record.id) !== "delivering") {
360	      return false;
361	    }
362	    return isWorkerTurnGenerationCurrent(worker.id, generation);
363	  };
364	
365	  try {
366	    await runWorkerTurn(worker.id, async () => {
367	      if (!(await isStillCurrent())) {
368	        notifyEventStreamSubscribers();
369	        return;
370	      }
371	
372	      await db.update(workers).set({
373	        status: "working",
374	        updatedAt: new Date(),
375	      }).where(eq(workers.id, worker.id));
376	
377	      const deliveredAt = new Date();
378	      await appendUserInputOnDelivery({
379	        id: userMessage.id,
380	        runId,
381	        workerId: worker.id,
382	        text: record.content,
383	        deliveredAt,
384	        attachments: attachments.map((attachment) => ({
385	          id: attachment.id,
386	          filename: attachment.name,
387	          mimeType: attachment.mimeType,
388	          sizeBytes: attachment.size,
389	        })),
390	      });
391	      await db.insert(messages).values(userMessage);
392	      notifyEventStreamSubscribers();
393	
394	      if (!(await isStillCurrent())) {
395	        notifyEventStreamSubscribers();
396	        return;
397	      }
398	
399	      const workerPrompt = run.mode === "direct" || run.mode === "commit"
400	        ? buildDirectWorkerPrompt(workerContent)
401	        : workerContent;
402	      const response = await askAgent(worker.id, workerPrompt);
403	      const finishedAt = new Date();
404	
405	      // Before any terminal persistence, confirm a newer interrupt has not
406	      // superseded this delivery and the row was not cancelled.
407	      if (!(await isStillCurrent())) {
408	        notifyEventStreamSubscribers();
409	        return;
410	      }
411	
412	      await persistDeliveredWorkerResponse({
413	        run: { id: runId, mode: run.mode },
414	        workerId: worker.id,
415	        response,
416	        deliveredAt: finishedAt,
417	        userInputEntryId: userMessage.id,
418	      });
419	
420	      if (!(await isStillCurrent())) {
421	        notifyEventStreamSubscribers();
422	        return;
423	      }
424	
425	      await db.update(queuedConversationMessages).set({
426	        status: "delivered",
427	        lastError: null,
428	        updatedAt: finishedAt,
429	        deliveredAt: finishedAt,
430	      }).where(eq(queuedConversationMessages.id, record.id));
431	      await recordExecutionEvent({
432	        runId,
433	        workerId: worker.id,
434	        eventType: "queued_message_interrupt_delivered",
435	        details: {
436	          summary: `Delivered interrupted queued message to ${worker.id}.`,
437	          queuedMessageId: record.id,
438	          source,
439	        },
440	      });
441	      emitNamedEvent({
442	        kind: "queue.interrupt_delivery_finished",
443	        runId,
444	        workerId: worker.id,
445	        queuedMessageId: record.id,
446	        totalInterruptLatencyMs: Date.now() - requestedAt,
447	        source,
448	      });
449	      notifyEventStreamSubscribers();
450	    });
451	  } catch (error) {
452	    await handleInterruptDeliveryError({ run, worker, record, userMessage, error, generation, source, requestedAt });
453	  }
454	}
455	
456	async function handleInterruptDeliveryError(args: {
457	  run: RunRecord;
458	  worker: WorkerRecord;
459	  record: QueuedRecord;
460	  userMessage: { id: string; createdAt: Date };
461	  error: unknown;
462	  generation: number;
463	  source: InterruptSource;
464	  requestedAt: number;
465	}) {
466	  const { run, worker, record, userMessage, error, generation, source, requestedAt } = args;
467	  const runId = run.id;
468	  const failedAt = new Date();
469	
470	  // A late failure from an interrupted (older) turn or a row the user cancelled
471	  // must not flip queue state.
472	  if (await queuedRowStatus(record.id) !== "delivering") {
473	    notifyEventStreamSubscribers();
474	    return;
475	  }
476	  if (!(await isWorkerTurnGenerationCurrent(worker.id, generation))) {
477	    const currentRecord = await db
478	      .select({ updatedAt: queuedConversationMessages.updatedAt })
479	      .from(queuedConversationMessages)
480	      .where(eq(queuedConversationMessages.id, record.id))
481	      .get();
482	    if (timestampMs(currentRecord?.updatedAt) > timestampMs(userMessage.createdAt)) {
483	      notifyEventStreamSubscribers();
484	      return;
485	    }
486	  }
487	
488	  const busy = isAgentBusyError(error);
489	  await db.update(queuedConversationMessages).set({
490	    status: busy ? "pending" : "failed",
491	    lastError: errorMessage(error),
492	    updatedAt: failedAt,
493	  }).where(eq(queuedConversationMessages.id, record.id));
494	
495	  if (isEmptyQueuedWorkerOutputError(error)) {
496	    await db.update(workers).set({
497	      status: "error",
498	      outputLog: error.message,
499	      updatedAt: failedAt,
500	    }).where(eq(workers.id, worker.id));
501	    if (run.mode === "direct" || run.mode === "commit") {
502	      await persistRunFailure(runId, error, {
503	        surface: { code: "worker.idle.empty_output", workerId: worker.id },
504	      });
505	    }
506	  }
507	
508	  if (busy) {
509	    await recordExecutionEvent({
510	      runId,
511	      workerId: worker.id,
512	      eventType: "queued_message_interrupt_deferred",
513	      details: {
514	        summary: `Worker ${worker.id} was still busy after cancel; queued message kept pending.`,
515	        queuedMessageId: record.id,
516	        error: errorMessage(error),
517	        source,
518	      },
519	    });
520	  } else {
521	    await recordExecutionEvent({
522	      runId,
523	      workerId: worker.id,
524	      eventType: "queued_message_interrupt_failed",
525	      details: {
526	        summary: `Interrupt delivery failed for ${worker.id}.`,
527	        queuedMessageId: record.id,
528	        error: errorMessage(error),
529	        source,
530	      },
531	    });
532	    emitNamedEvent({
533	      kind: "error.surfaced",
534	      code: "queue.interrupt.delivery_failed",
535	      message: `Interrupt delivery failed: ${errorMessage(error)}`,
536	      surface: "toast",
537	      runId,
538	      workerId: worker.id,
539	    });
540	  }
541	
542	  emitNamedEvent({
543	    kind: "queue.interrupt_delivery_failed",
544	    runId,
545	    workerId: worker.id,
546	    queuedMessageId: record.id,
547	    reason: busy ? "busy_after_cancel" : "delivery_failed",
548	    deferred: busy,
549	    totalInterruptLatencyMs: Date.now() - requestedAt,
550	    source,
551	  });
552	
553	  if (isAgentNotFoundError(error)) {
554	    await recordExecutionEvent({
555	      runId,
556	      workerId: worker.id,
557	      eventType: "queued_message_recovery_blocked",
558	      details: {
559	        summary: `Queued message ${record.id} is blocked because ${worker.id} is missing.`,
560	        queuedMessageId: record.id,
561	        error: errorMessage(error),
562	        source,
563	      },
564	    });
565	    await reconcileRunRecovery({
566	      runId,
567	      liveAgents: [],
568	      source: "queued-message-interrupt",
569	    });
570	  }
571	
572	  // A busy delivery already removed nothing; non-recoverable failures keep the
573	  // appended worker-stream input for audit. Drop the duplicate checkpoint
574	  // message row only when we deferred so a later retry re-appends cleanly.
575	  if (busy) {
576	    await db.delete(messages).where(eq(messages.id, userMessage.id));
577	  }
578	
579	  notifyEventStreamSubscribers();
580	}
581	
582	// ---------------------------------------------------------------------------
583	// Entry points
584	// ---------------------------------------------------------------------------
585	
586	export async function interruptAndSendQueuedConversationMessageNow(params: {
587	  runId: string;
588	  messageId: string;
589	  source?: InterruptSource;
590	}): Promise<InterruptResult> {
591	  const run = await loadRun(params.runId);
592	  const record = await loadQueuedRecord(params.runId, params.messageId);
593	  return interruptAndDeliver({ run, record, source: params.source ?? "drawer" });
594	}
595	
596	export async function interruptAndSendNextQueuedConversationMessage(params: {
597	  runId: string;
598	  source?: InterruptSource;
599	}): Promise<InterruptResult> {
600	  const run = await loadRun(params.runId);
601	  const record = await selectOldestPendingRecord(params.runId);
602	  return interruptAndDeliver({ run, record, source: params.source ?? "escape" });
603	}
604	
605	export async function interruptWithDraftMessage(params: {
606	  runId: string;
607	  content: string;
608	  attachments?: ChatAttachment[];
609	  targetWorkerId?: string | null;
610	  source?: InterruptSource;
611	}): Promise<InterruptResult> {
612	  const run = await loadRun(params.runId);
613	  const trimmed = params.content.trim();
614	  const normalizedAttachments = normalizeChatAttachments(params.attachments ?? []);
615	  if (!trimmed && normalizedAttachments.length === 0) {
616	    emitNamedEvent({
617	      kind: "queue.interrupt_refused",
618	      runId: params.runId,
619	      workerId: params.targetWorkerId ?? null,
620	      queuedMessageId: null,
621	      reason: "no_user_intent",
622	      source: params.source ?? "escape",
623	    });
624	    throw refusal(400, "Message content or attachment is required");
625	  }
626	
627	  // Persist the draft as exactly one queued row, then deliver that same id.
628	  const created = await createQueuedConversationMessage({
629	    runId: params.runId,
630	    targetWorkerId: params.targetWorkerId ?? null,
631	    action: "steer",
632	    content: params.content,
633	    attachments: normalizedAttachments,
634	  });
635	  const record = await loadQueuedRecord(params.runId, created.id);
636	  return interruptAndDeliver({ run, record, source: params.source ?? "escape" });
637	}
638	

uuid: 22647711-d70a-4c83-b6be-5712aef10862
parent: 0bc63dd4-14a4-4970-b614-0757f5e1a56d
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-26T20:43:25.889Z","phase":null} -->
## Claude tool result: toolu_01Tzn2cUYCVrK1LHFaP6rfvJ · 2026-06-26T20:43:25.889Z

```text
1	import { randomUUID } from "crypto";
2	import { and, asc, eq } from "drizzle-orm";
3	import { askAgent, cancelAgent, getAgent, respondElicitation, spawnAgent } from "@/server/bridge-client";
4	import { db } from "@/server/db";
5	import { clarifications, messages, runs, workers } from "@/server/db/schema";
6	import { recordExecutionEvent } from "@/server/events/execution-event-store";
7	import { answerClarification } from "@/server/clarifications/store";
8	import { resumeRunAfterClarification } from "@/server/clarifications/loop";
9	import { startSupervisorRun } from "@/server/supervisor/start";
10	import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
11	import { persistWorkerSnapshot } from "@/server/workers/snapshots";
12	import { readWorkerOutputEntries } from "@/server/workers/output-store";
13	import { appendWorkerSessionMetadata, readWorkerSessionMetadata } from "@/server/workers/session-metadata";
14	import { buildTranscriptReplayPrompt, canRecreateRejectedSavedSession, isRejectedSavedSessionErrorMessage, materializeProviderSessionFromWorkerStream } from "@/server/workers/session-recovery";
15	import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
16	import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
17	import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
18	import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
19	import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
20	import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
21	import { getAppDataPath } from "@/server/app-root";
22	import { normalizeWorkerType, SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "@/server/supervisor/worker-types";
23	import { createQueuedConversationMessage, type BusyMessageAction } from "./queued-messages";
24	import { serializeMessageRecord } from "./message-records";
25	import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
26	import { runConversationMutation, runWorkerTurn, trackConversationBackgroundTask } from "./worker-turn-gate";
27	import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
28	import { isManualStopCommand } from "@/app/home/busy-message-behavior";
29	import { emitNamedEvent } from "@/server/events/named-events";
30	import { cancelSupervisorWake } from "@/server/supervisor/wake";
31	import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
32	import { stopRunObserver } from "@/server/supervisor/observer";
33	import { buildDirectWorkerPrompt } from "./direct-worker-prompt";
34	
35	type RunRecord = typeof runs.$inferSelect;
36	type WorkerRecord = typeof workers.$inferSelect;
37	type DirectWorkerSnapshot = Awaited<ReturnType<typeof getAgent>>;
38	type ElicitationSchema = NonNullable<DirectWorkerSnapshot["pendingElicitations"]>[number]["requestedSchema"];
39	type ElicitationContent = Record<string, string | number | boolean | string[]>;
40	
41	function isDirectRunMode(mode: string | null | undefined) {
42	  return mode === "direct" || mode === "commit";
43	}
44	
45	// An Omni run is stored as mode "implementation" for its whole life; its
46	// `phase` distinguishes the interactive planning stage (planner worker, no
47	// supervisor) from the supervised implementation stage. Route follow-up
48	// messages by phase, not raw mode, so a reply during planning reaches the
49	// planner instead of being treated as a supervisor steer.
50	function isPlanningRun(run: { mode?: string | null; phase?: string | null }) {
51	  return run.mode === "planning" || (run.mode === "implementation" && run.phase === "planning");
52	}
53	
54	function isSupervisedRun(run: { mode?: string | null; phase?: string | null }) {
55	  return run.mode === "implementation" && run.phase !== "planning";
56	}
57	
58	function isAgentBusyError(error: unknown) {
59	  return /\bagent is busy\b/i.test(formatErrorMessage(error));
60	}
61	
62	function isAgentNotFoundError(error: unknown) {
63	  return /\b(agent not found|not_found|session not found|invalid session identifier|failed to load resumed session data from file|404)\b/i.test(formatErrorMessage(error));
64	}
65	
66	function isAgentAlreadyExistsError(error: unknown, workerId: string) {
67	  const message = formatErrorMessage(error).toLowerCase();
68	  return message.includes("agent already exists") && message.includes(workerId.toLowerCase());
69	}
70	
71	function normalizeWorkerStatus(status: string | null | undefined) {
72	  return status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
73	}
74	
75	function isWorkerCancelled(worker: WorkerRecord | null | undefined) {
76	  const status = normalizeWorkerStatus(worker?.status);
77	  return status === "cancelled" || status === "canceled";
78	}
79	
80	function isStoppableRunStatus(status: string | null | undefined) {
81	  return ["running", "working", "stuck", "needs_recovery"].includes(normalizeWorkerStatus(status));
82	}
83	
84	function isStoppableWorkerStatus(status: string | null | undefined) {
85	  return ["starting", "working", "idle", "stuck"].includes(normalizeWorkerStatus(status));
86	}
87	
88	function workerCreatedAtMs(worker: WorkerRecord) {
89	  const createdAt = worker.createdAt;
90	  const value = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
91	  return Number.isFinite(value) ? value : 0;
92	}
93	
94	function compareWorkersForFollowUp(a: WorkerRecord, b: WorkerRecord) {
95	  const workerNumberDiff = (b.workerNumber ?? 0) - (a.workerNumber ?? 0);
96	  if (workerNumberDiff !== 0) {
97	    return workerNumberDiff;
98	  }
99	
100	  const createdAtDiff = workerCreatedAtMs(b) - workerCreatedAtMs(a);
101	  if (createdAtDiff !== 0) {
102	    return createdAtDiff;
103	  }
104	
105	  return b.id.localeCompare(a.id);
106	}
107	
108	async function selectConversationWorker(runId: string) {
109	  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
110	  const sortedWorkers = [...runWorkers].sort(compareWorkersForFollowUp);
111	  return sortedWorkers.find((worker) => !isWorkerCancelled(worker)) ?? sortedWorkers[0] ?? null;
112	}
113	
114	function elicitationAnswerContent(text: string, requestedSchema: ElicitationSchema | null | undefined): ElicitationContent {
115	  const properties = requestedSchema?.properties ?? {};
116	  const propertyNames = Object.keys(properties);
117	  if (propertyNames.includes("customAnswer")) {
118	    return { customAnswer: text };
119	  }
120	
121	  const nonCustomFields = propertyNames.filter((name) => name !== "customAnswer");
122	  if (nonCustomFields.length === 1 && nonCustomFields[0]) {
123	    return { [nonCustomFields[0]]: text };
124	  }
125	
126	  return { response: text };
127	}
128	
129	async function answerDirectWorkerElicitation(args: {
130	  run: RunRecord;
131	  worker: WorkerRecord;
132	  userText: string;
133	  workerText: string;
134	  attachments: ChatAttachment[];
135	  attachmentsJson: string | null;
136	}) {
137	  const snapshot = await Promise.resolve(getAgent(args.worker.id)).catch(() => null);
138	  const elicitation = snapshot?.pendingElicitations?.[0] ?? null;
139	  if (!elicitation) {
140	    return null;
141	  }
142	
143	  const createdAt = new Date();
144	  const userMessage = {
145	    id: randomUUID(),
146	    runId: args.run.id,
147	    role: "user",
148	    kind: "checkpoint",
149	    content: args.userText,
150	    attachmentsJson: args.attachmentsJson,
151	    createdAt,
152	  };
153	
154	  await appendUserInputOnDelivery({
155	    id: userMessage.id,
156	    runId: args.run.id,
157	    workerId: args.worker.id,
158	    text: args.userText,
159	    deliveredAt: createdAt,
160	    attachments: args.attachments.map((attachment) => ({
161	      id: attachment.id,
162	      filename: attachment.name,
163	      mimeType: attachment.mimeType,
164	      sizeBytes: attachment.size,
165	    })),
166	  });
167	  await db.insert(messages).values(userMessage);
168	  await respondElicitation(args.worker.id, {
169	    action: "accept",
170	    content: elicitationAnswerContent(args.workerText || args.userText, elicitation.requestedSchema),
171	  });
172	  await db.update(workers).set({
173	    status: "working",
174	    updatedAt: createdAt,
175	  }).where(eq(workers.id, args.worker.id));
176	  await db.update(runs).set({
177	    status: "running",
178	    failedAt: null,
179	    lastError: null,
180	    updatedAt: createdAt,
181	  }).where(eq(runs.id, args.run.id));
182	  emitNamedEvent({
183	    kind: "worker.status",
184	    runId: args.run.id,
185	    workerId: args.worker.id,
186	    prev: args.worker.status,
187	    next: "working",
188	  });
189	  await recordExecutionEvent({
190	    runId: args.run.id,
191	    workerId: args.worker.id,
192	    planItemId: null,
193	    eventType: "direct_worker_elicitation_answered",
194	    details: {
195	      summary: `Answered pending worker question for ${args.worker.id}.`,
196	      requestId: elicitation.requestId,
197	    },
198	    createdAt,
199	  });
200	  notifyEventStreamSubscribers();
201	  return userMessage;
202	}
203	
204	/**
205	 * Reconcile the DB user-message list against the worker output stream.
206	 *
207	 * Historically this asserted the invariant and threw a 409 if any DB row
208	 * was missing from the stream. That surfaced as "Previous message is
209	 * still being persisted..." in the UI whenever the send-message flow
210	 * crashed between the DB insert and the stream write — and the only way
211	 * out was to hand-edit the DB.
212	 *
213	 * New contract: if a row is missing, silently backfill the stream entry
214	 * from the DB row. The stream is append-only and the user_input entry is
215	 * keyed by the message id, so the write is idempotent. We never block
216	 * the caller on this — at worst we log the failure and continue.
217	 */
218	export async function reconcileWorkerUserMessagesInStream(runId: string, workerId: string) {
219	  const [storedUserMessages, entries] = await Promise.all([
220	    db
221	      .select()
222	      .from(messages)
223	      .where(and(eq(messages.runId, runId), eq(messages.role, "user")))
224	      .orderBy(asc(messages.createdAt), asc(messages.id)),
225	    readWorkerOutputEntries(runId, workerId),
226	  ]);
227	  const streamUserInputIds = new Set(
228	    entries
229	      .filter((entry) => (entry as { type?: string }).type === "user_input")
230	      .map((entry) => entry.id),
231	  );
232	  for (const message of storedUserMessages) {
233	    if (streamUserInputIds.has(message.id)) continue;
234	    try {
235	      await appendUserInputOnDelivery({
236	        id: message.id,
237	        runId,
238	        workerId,
239	        text: message.content ?? "",
240	        deliveredAt: message.createdAt instanceof Date
241	          ? message.createdAt
242	          : new Date(message.createdAt as unknown as string | number),
243	      });
244	    } catch (error) {
245	      process.stderr.write(
246	        `[send-message] failed to backfill user_input for message ${message.id} on worker ${workerId}: ${error instanceof Error ? error.message : String(error)}\n`,
247	      );
248	    }
249	  }
250	}
251	
252	export async function resumeMissingDirectWorker(run: RunRecord, worker: WorkerRecord) {
253	  let sessionId = worker.bridgeSessionId?.trim();
254	  let sessionMode = worker.bridgeSessionMode?.trim();
255	  if (!sessionId) {
256	    const metadata = await readWorkerSessionMetadata(worker.runId, worker.id);
257	    if (metadata) {
258	      sessionId = metadata.sessionId;
259	      sessionMode = metadata.sessionMode ?? sessionMode;
260	      await db.update(workers).set({
261	        bridgeSessionId: metadata.sessionId,
262	        bridgeSessionMode: metadata.sessionMode ?? worker.bridgeSessionMode,
263	        updatedAt: new Date(),
264	      }).where(eq(workers.id, worker.id));
265	      emitNamedEvent({
266	        kind: "worker.session_metadata_repaired",
267	        runId: worker.runId,
268	        workerId: worker.id,
269	      });
270	    }
271	  }
272	  if (!sessionId) {
273	    const message = `Direct worker ${worker.id} is missing persisted ACP session metadata.`;
274	    emitNamedEvent({
275	      kind: "error.surfaced",
276	      code: "worker.resume.failed",
277	      message,
278	      surface: "banner",
279	      runId: run.id,
280	      workerId: worker.id,
281	      cause: null,
282	    });
283	    throw Object.assign(new Error(message), { status: 500 });
284	  }
285	
286	  const yoloModeEnabled = await readWorkerYoloModeEnabled();
287	  const workerMode = resolveWorkerLaunchMode(sessionMode, yoloModeEnabled);
288	  const { env: envParams } = await readRuntimeEnvFromSettings();
289	  const spawnParams = {
290	    type: worker.type,
291	    cwd: worker.cwd,
292	    name: worker.id,
293	    ...(workerMode ? { mode: workerMode } : {}),
294	    env: envParams,
295	    ...(run.preferredWorkerModel ? { model: run.preferredWorkerModel } : {}),
296	    ...(run.preferredWorkerEffort ? { effort: run.preferredWorkerEffort } : {}),
297	  };
298	  let resumedWorker;
299	  let recreatedFromRejectedEmptySession = false;
300	  let transcriptReplayRequired = false;
301	  try {
302	    resumedWorker = await spawnAgent({
303	      ...spawnParams,
304	      resumeSessionId: sessionId,
305	    });
306	  } catch (error) {
307	    if (isAgentAlreadyExistsError(error, worker.id)) {
308	      resumedWorker = await getAgent(worker.id);
309	    } else if (
310	      isRejectedSavedSessionErrorMessage(formatErrorMessage(error))
311	      && await canRecreateRejectedSavedSession(run.id, worker.id)
312	    ) {
313	      await recordExecutionEvent({
314	        runId: run.id,
315	        workerId: worker.id,
316	        planItemId: null,
317	        eventType: "worker_session_missing",
318	        details: {
319	          summary: `Saved bridge session for ${worker.id} is not recoverable, and the worker stream has no provider transcript.`,
320	          sessionId,
321	          reason: formatErrorMessage(error),
322	        },
323	      });
324	      await db.update(workers).set({
325	        status: "starting",
326	        bridgeSessionId: null,
327	        bridgeSessionMode: null,
328	        updatedAt: new Date(),
329	      }).where(eq(workers.id, worker.id));
330	      resumedWorker = await spawnAgent(spawnParams);
331	      recreatedFromRejectedEmptySession = true;
332	    } else if (isRejectedSavedSessionErrorMessage(formatErrorMessage(error))) {
333	      const materialized = await materializeProviderSessionFromWorkerStream({
334	        runId: run.id,
335	        workerId: worker.id,
336	        type: worker.type,
337	        sessionId,
338	        cwd: worker.cwd,
339	        errorMessage: formatErrorMessage(error),
340	        env: envParams,
341	      });
342	      if (materialized) {
343	        await recordExecutionEvent({
344	          runId: run.id,
345	          workerId: worker.id,
346	          planItemId: null,
347	          eventType: "worker_session_materialized",
348	          details: {
349	            summary: `Materialized ${materialized.provider} session ${sessionId} from the saved OmniHarness transcript.`,
350	            provider: materialized.provider,
351	            sessionId,
352	            filePath: materialized.filePath,
353	            messageCount: materialized.messageCount,
354	          },
355	        });
356	        try {
357	          resumedWorker = await spawnAgent({
358	            ...spawnParams,
359	            resumeSessionId: sessionId,
360	          });
361	        } catch (materializedResumeError) {
362	          await recordExecutionEvent({
363	            runId: run.id,
364	            workerId: worker.id,
365	            planItemId: null,
366	            eventType: "worker_session_materialized_resume_failed",
367	            details: {
368	              summary: `Materialized ${materialized.provider} session ${sessionId}, but ACP resume still failed.`,
369	              provider: materialized.provider,
370	              sessionId,
371	              filePath: materialized.filePath,
372	              reason: formatErrorMessage(materializedResumeError),
373	            },
374	          });
375	        }
376	      }
377	      if (!resumedWorker) {
378	        await recordExecutionEvent({
379	          runId: run.id,
380	          workerId: worker.id,
381	          planItemId: null,
382	          eventType: "worker_session_missing",
383	          details: {
384	            summary: `Saved bridge session for ${worker.id} is not recoverable; continuing from the saved OmniHarness transcript.`,
385	            sessionId,
386	            reason: formatErrorMessage(error),
387	            transcriptReplay: true,
388	          },
389	        });
390	        await db.update(workers).set({
391	          status: "starting",
392	          bridgeSessionId: null,
393	          bridgeSessionMode: null,
394	          updatedAt: new Date(),
395	        }).where(eq(workers.id, worker.id));
396	        resumedWorker = await spawnAgent(spawnParams);
397	        transcriptReplayRequired = true;
398	      }
399	    } else {
400	      emitNamedEvent({
401	        kind: "error.surfaced",
402	        code: "worker.resume.failed",
403	        message: formatErrorMessage(error),
404	        surface: "banner",
405	        runId: run.id,
406	        workerId: worker.id,
407	        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
408	      });
409	      throw error;
410	    }
411	  }
412	
413	  await recordExecutionEvent({
414	    runId: run.id,
415	    workerId: worker.id,
416	    planItemId: null,
417	    eventType: transcriptReplayRequired
418	      ? "worker_session_recreated_from_transcript"
419	      : recreatedFromRejectedEmptySession ? "worker_session_recreated" : "worker_session_resumed",
420	    details: {
421	      summary: transcriptReplayRequired
422	        ? `Started a fresh runtime worker for ${worker.id} and continued from the saved OmniHarness transcript.`
423	        : recreatedFromRejectedEmptySession
424	        ? `Started a fresh runtime worker for ${worker.id} after its empty saved session was rejected.`
425	        : `Resumed ${worker.id} from saved session`,
426	      rejectedSessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? sessionId : null,
427	      sessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? resumedWorker.sessionId ?? null : sessionId,
428	      transcriptReplay: transcriptReplayRequired,
429	    },
430	  });
431	  emitNamedEvent({
432	    kind: recreatedFromRejectedEmptySession || transcriptReplayRequired ? "worker.recreated" : "worker.reattached",
433	    runId: run.id,
434	    workerId: worker.id,
435	  });
436	
437	  await db.update(workers).set({
438	    status: resumedWorker.state,
439	    bridgeSessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
440	    bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
441	    updatedAt: new Date(),
442	  }).where(eq(workers.id, worker.id));
443	  await appendWorkerSessionMetadata({
444	    runId: run.id,
445	    workerId: worker.id,
446	    sessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
447	    sessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
448	    source: "direct-follow-up",
449	  });
450	
451	  await persistWorkerSnapshot(worker.id, resumedWorker);
452	  notifyEventStreamSubscribers();
453	  return { ...resumedWorker, transcriptReplayRequired };
454	}
455	
456	async function askDirectWorkerWithResume(run: RunRecord, worker: WorkerRecord, content: string) {
457	  const workerPrompt = isDirectRunMode(run.mode) ? buildDirectWorkerPrompt(content) : content;
458	  try {
459	    return await askAgent(worker.id, workerPrompt);
460	  } catch (error) {
461	    if (!isAgentNotFoundError(error)) {
462	      throw error;
463	    }
464	
465	    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
466	    if (isWorkerCancelled(currentWorker)) {
467	      throw error;
468	    }
469	
470	    const resumedWorker = await resumeMissingDirectWorker(run, currentWorker ?? worker);
471	    if (!resumedWorker) {
472	      throw error;
473	    }
474	
475	    // resumeMissingDirectWorker just wrote the resumed runtime agent's
476	    // state ("idle" or "starting") into the DB. The askAgent call on the
477	    // next line drives the runtime to "working", but no other code path
478	    // touches the workers row until askAgent resolves — which for a long
479	    // Claude turn is many minutes. Without re-arming the DB row here the
480	    // frontend sees the worker as idle for the entire turn and never
481	    // shows the "Thinking…" indicator.
482	    await db.update(workers).set({
483	      status: "working",
484	      updatedAt: new Date(),
485	    }).where(eq(workers.id, worker.id));
486	    await db.update(runs).set({
487	      status: "running",
488	      failedAt: null,
489	      lastError: null,
490	      updatedAt: new Date(),
491	    }).where(eq(runs.id, run.id));
492	    notifyEventStreamSubscribers();
493	
494	    const replayPrompt = resumedWorker.transcriptReplayRequired
495	      ? await buildTranscriptReplayPrompt({
496	        runId: run.id,
497	        workerId: worker.id,
498	        nextUserPrompt: workerPrompt,
499	      })
500	      : null;
501	    return askAgent(worker.id, replayPrompt ?? workerPrompt);
502	  }
503	}
504	
505	async function continueWorkerConversation({
506	  run,
507	  worker,
508	  content,
509	  userInputText,
510	  userInputId,
511	  attachments,
512	  appendUserInputBeforeAsk = false,
513	  allowCancelledWorkerResume = false,
514	  onUserInputAppended,
515	}: {
516	  run: RunRecord;
517	  worker: WorkerRecord;
518	  content: string;
519	  userInputText: string;
520	  userInputId?: string;
521	  attachments: ChatAttachment[];
522	  appendUserInputBeforeAsk?: boolean;
523	  allowCancelledWorkerResume?: boolean;
524	  onUserInputAppended?: () => void;
525	}) {
526	  try {
527	    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
528	    if (isWorkerCancelled(currentWorker) && !allowCancelledWorkerResume) {
529	      onUserInputAppended?.();
530	      return;
531	    }
532	
533	    await db.update(workers).set({
534	      status: "working",
535	      updatedAt: new Date(),
536	    }).where(eq(workers.id, worker.id));
537	    notifyEventStreamSubscribers();
538	
539	    let userInputAppended = false;
540	    const appendDeliveredUserInput = async (deliveredAt: Date) => {
541	      await appendUserInputOnDelivery({
542	        id: userInputId,
543	        runId: run.id,
544	        workerId: worker.id,
545	        text: userInputText,
546	        deliveredAt,
547	        attachments: attachments.map((attachment) => ({
548	          id: attachment.id,
549	          filename: attachment.name,
550	          mimeType: attachment.mimeType,
551	          sizeBytes: attachment.size,
552	        })),
553	      });
554	      userInputAppended = true;
555	      onUserInputAppended?.();
556	    };
557	
558	    if (appendUserInputBeforeAsk) {
559	      await appendDeliveredUserInput(new Date());
560	      notifyEventStreamSubscribers();
561	    }
562	
563	    const response = await askDirectWorkerWithResume(run, worker, content);
564	    if (!userInputAppended) {
565	      // Append user_input on delivery — `askDirectWorkerWithResume` has
566	      // resolved successfully, so the prompt definitely reached the
567	      // worker. Direct fire-and-forget follow-ups opt into pre-ask
568	      // appending above because the HTTP response returns immediately
569	      // while the bridge turn is still in flight.
570	      await appendDeliveredUserInput(new Date());
571	    }
572	    const workerAfterResponse = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
573	    if (isWorkerCancelled(workerAfterResponse)) {
574	      notifyEventStreamSubscribers();
575	      return;
576	    }
577	
578	    const snapshot = await Promise.resolve(getAgent(worker.id)).catch(() => null);
579	    if (snapshot) {
580	      await persistWorkerSnapshot(worker.id, snapshot);
581	    }
582	    await appendAskResponseFallbackEntry({
583	      runId: run.id,
584	      workerId: worker.id,
585	      responseText: response.response,
586	      snapshot,
587	    });
588	
589	    const workerAfterSnapshot = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
590	    if (isWorkerCancelled(workerAfterSnapshot)) {
591	      notifyEventStreamSubscribers();
592	      return;
593	    }
594	
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
635	      return;
636	    }
637	
638	    if (isAgentBusyError(error)) {
639	      const now = new Date();
640	      await db.update(workers).set({
641	        status: "working",
642	        updatedAt: now,
643	      }).where(eq(workers.id, worker.id));
644	      await db.update(runs).set({
645	        status: isPlanningRun(run) ? "working" : "running",
646	        failedAt: null,
647	        lastError: null,
648	        updatedAt: now,
649	      }).where(eq(runs.id, run.id));
650	      notifyEventStreamSubscribers();
651	      throw Object.assign(error instanceof Error ? error : new Error(formatErrorMessage(error)), { status: 409 });
652	    }
653	
654	    await db.update(workers).set({
655	      status: "error",
656	      updatedAt: new Date(),
657	    }).where(eq(workers.id, worker.id));
658	    await persistRunFailure(run.id, error, {
659	      surface: { code: "conversation.continue.failed", workerId: worker.id },
660	    });
661	    throw error;
662	  }
663	}
664	
665	type SendConversationMessageArgs = {
666	  runId: string;
667	  content: string;
668	  attachments?: ChatAttachment[];
669	  busyAction?: BusyMessageAction | null;
670	  preferredWorkerType?: string | null;
671	  preferredWorkerModel?: string | null;
672	  preferredWorkerEffort?: string | null;
673	  allowedWorkerTypes?: string[] | string | null;
674	};
675	
676	function parseExplicitWorkerType(value: string | null | undefined) {
677	  if (!value?.trim()) {
678	    return null;
679	  }
680	  const normalized = normalizeWorkerType(value.replace(/\s+/g, "-"));
681	  return SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
682	    ? normalized as SupportedWorkerType
683	    : null;
684	}
685	
686	function parseWorkerSwitchFromText(content: string) {
687	  const match = content.match(/\b(?:switch|change|set)\s+(?:the\s+)?(?:cli\s+)?(?:worker|workers|agent|agents|worker\s+agent|worker\s+agents)\s+(?:to|as)\s+(codex|claude(?:[-_\s]+code)?|gemini|open[-_\s]*code|opencode)\b/i);
688	  if (!match?.[1]) {
689	    return null;
690	  }
691	  return parseExplicitWorkerType(match[1]);
692	}
693	
694	async function applyWorkerPreferenceForMessage(args: {
695	  run: RunRecord;
696	  content: string;
697	  preferredWorkerType?: string | null;
698	  preferredWorkerModel?: string | null;
699	  preferredWorkerEffort?: string | null;
700	  allowedWorkerTypes?: string[] | string | null;
701	}) {
702	  const explicitWorkerType = parseExplicitWorkerType(args.preferredWorkerType);
703	  const textWorkerType = parseWorkerSwitchFromText(args.content);
704	  const nextWorkerType = explicitWorkerType ?? textWorkerType;
705	  if (!nextWorkerType) {
706	    return args.run;
707	  }
708	
709	  const nextAllowedWorkerTypes = [nextWorkerType];
710	  const nextPreferredWorkerModel = explicitWorkerType
711	    ? args.preferredWorkerModel?.trim() || null
712	    : null;
713	  const nextPreferredWorkerEffort = args.preferredWorkerEffort?.trim() || args.run.preferredWorkerEffort || null;
714	  const now = new Date();
715	
716	  await db.update(runs).set({
717	    preferredWorkerType: nextWorkerType,
718	    preferredWorkerModel: nextPreferredWorkerModel,
719	    preferredWorkerEffort: nextPreferredWorkerEffort,
720	    allowedWorkerTypes: JSON.stringify(nextAllowedWorkerTypes),
721	    updatedAt: now,
722	  }).where(eq(runs.id, args.run.id));
723	  await recordExecutionEvent({
724	    runId: args.run.id,
725	    workerId: null,
726	    planItemId: null,
727	    eventType: "worker_selection_changed",
728	    details: {
729	      summary: `Changed preferred worker selection to ${nextWorkerType}.`,
730	      preferredWorkerType: nextWorkerType,
731	      preferredWorkerModel: nextPreferredWorkerModel,
732	      preferredWorkerEffort: nextPreferredWorkerEffort,
733	      allowedWorkerTypes: nextAllowedWorkerTypes,
734	      source: explicitWorkerType ? "composer_selection" : "message_text",
735	    },
736	    createdAt: now,
737	  });
738	
739	  return {
740	    ...args.run,
741	    preferredWorkerType: nextWorkerType,
742	    preferredWorkerModel: nextPreferredWorkerModel,
743	    preferredWorkerEffort: nextPreferredWorkerEffort,
744	    allowedWorkerTypes: JSON.stringify(nextAllowedWorkerTypes),
745	    updatedAt: now,
746	  };
747	}
748	
749	async function stopConversationFromManualStopCommand(run: RunRecord) {
750	  if (!isStoppableRunStatus(run.status)) {
751	    return {
752	      ok: true as const,
753	      stopped: false as const,
754	      ignored: true as const,
755	      runId: run.id,
756	      workerId: null,
757	      runCancelled: false,
758	      reason: "not_stoppable" as const,
759	    };
760	  }
761	
762	  if (isSupervisedRun(run)) {
763	    cancelSupervisorWake(run.id);
764	    stopRunObserver(run.id);
765	    await clearSupervisorWakeLease(run.id);
766	    const runWorkers = await db.select().from(workers).where(eq(workers.runId, run.id));
767	    const activeWorkers = runWorkers.filter((worker) => isStoppableWorkerStatus(worker.status));
768	    for (const worker of activeWorkers) {
769	      void cancelAgent(worker.id).catch(() => undefined);
770	      await db.update(workers).set({
771	        status: "cancelled",
772	        updatedAt: new Date(),
773	      }).where(eq(workers.id, worker.id));
774	      emitNamedEvent({
775	        kind: "worker.status",
776	        runId: run.id,
777	        workerId: worker.id,
778	        prev: worker.status,
779	        next: "cancelled",
780	      });
781	      emitNamedEvent({
782	        kind: "worker.terminal",
783	        runId: run.id,
784	        workerId: worker.id,
785	        status: "cancelled",
786	      });
787	    }
788	
789	    const now = new Date();
790	    await db.update(runs).set({
791	      status: "cancelled",
792	      updatedAt: now,
793	    }).where(eq(runs.id, run.id));
794	    await recordExecutionEvent({
795	      runId: run.id,
796	      workerId: null,
797	      planItemId: null,
798	      eventType: "supervisor_stopped",
799	      details: {
800	        summary: "Stopped supervisor from exact stop command.",
801	        reason: "User sent an exact stop command.",
802	        userInitiated: true,
803	        cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
804	        source: "manual_stop_message",
805	      },
806	      createdAt: now,
807	    });
808	    notifyEventStreamSubscribers();
809	    return {
810	      ok: true as const,
811	      stopped: true as const,
812	      runId: run.id,
813	      workerId: null,
814	      runCancelled: true,
815	    };
816	  }
817	
818	  const worker = await selectConversationWorker(run.id);
819	  if (!worker || !isStoppableWorkerStatus(worker.status)) {
820	    return {
821	      ok: true as const,
822	      stopped: false as const,
823	      ignored: true as const,
824	      runId: run.id,
825	      workerId: worker?.id ?? null,
826	      runCancelled: false,
827	      reason: "not_stoppable" as const,
828	    };
829	  }
830	
831	  void cancelAgent(worker.id).catch(() => undefined);
832	  const now = new Date();
833	  await db.update(workers).set({
834	    status: "cancelled",
835	    updatedAt: now,
836	  }).where(eq(workers.id, worker.id));
837	  emitNamedEvent({
838	    kind: "worker.status",
839	    runId: run.id,
840	    workerId: worker.id,
841	    prev: worker.status,
842	    next: "cancelled",
843	  });
844	  emitNamedEvent({
845	    kind: "worker.terminal",
846	    runId: run.id,
847	    workerId: worker.id,
848	    status: "cancelled",
849	  });
850	
851	  const remainingWorkers = await db.select().from(workers).where(eq(workers.runId, run.id));
852	  const hasActiveWorker = remainingWorkers.some((candidate) => isStoppableWorkerStatus(candidate.status));
853	  if (!hasActiveWorker) {
854	    await db.update(runs).set({
855	      status: "cancelled",
856	      updatedAt: now,
857	    }).where(eq(runs.id, run.id));
858	  }
859	
860	  await recordExecutionEvent({
861	    runId: run.id,
862	    workerId: worker.id,
863	    planItemId: null,
864	    eventType: "worker_cancelled",
865	    details: {
866	      summary: `Stopped ${worker.id}`,
867	      reason: "User sent an exact stop command.",
868	      runCancelled: !hasActiveWorker,
869	      source: "manual_stop_message",
870	    },
871	    createdAt: now,
872	  });
873	  notifyEventStreamSubscribers();
874	  return {
875	    ok: true as const,
876	    stopped: true as const,
877	    runId: run.id,
878	    workerId: worker.id,
879	    runCancelled: !hasActiveWorker,
880	  };
881	}
882	
883	export async function sendConversationMessage(args: SendConversationMessageArgs) {
884	  return runConversationMutation(args.runId, () => sendConversationMessageUnlocked(args));
885	}
886	
887	async function sendConversationMessageUnlocked({
888	  runId,
889	  content,
890	  attachments = [],
891	  busyAction = null,
892	  preferredWorkerType = null,
893	  preferredWorkerModel = null,
894	  preferredWorkerEffort = null,
895	  allowedWorkerTypes = null,
896	}: SendConversationMessageArgs) {
897	  const trimmedContent = content.trim();
898	  const normalizedAttachments = normalizeChatAttachments(attachments);
899	  const attachmentsJson = serializeChatAttachments(normalizedAttachments);
900	  const workerContent = appendAttachmentContext(trimmedContent, normalizedAttachments, {
901	    resolvePath: (storagePath) => getAppDataPath(storagePath),
902	  });
903	  if (!trimmedContent && normalizedAttachments.length === 0) {
904	    throw Object.assign(new Error("Message content or attachment is required"), { status: 400 });
905	  }
906	
907	  let run = await db.select().from(runs).where(eq(runs.id, runId)).get();
908	  if (!run) {
909	    throw Object.assign(new Error("Conversation not found"), { status: 404 });
910	  }
911	  if (normalizedAttachments.length === 0 && isManualStopCommand(trimmedContent)) {
912	    const stopped = await stopConversationFromManualStopCommand(run);
913	    return stopped;
914	  }
915	  run = await applyWorkerPreferenceForMessage({
916	    run,
917	    content: trimmedContent,
918	    preferredWorkerType,
919	    preferredWorkerModel,
920	    preferredWorkerEffort,
921	    allowedWorkerTypes,
922	  });
923	
924	  if (isPlanningRun(run) && (run.status === "reviewing_plan" || run.status === "revising_plan")) {
925	    throw Object.assign(new Error("Plan review is in progress. Please wait for the review to complete before sending further messages."), { status: 409 });
926	  }
927	
928	  if (isSupervisedRun(run) && (busyAction === "queue" || busyAction === "steer")) {
929	    const queuedMessage = await createQueuedConversationMessage({
930	      runId,
931	      action: "steer",
932	      content: trimmedContent,
933	      attachments: normalizedAttachments,
934	    });
935	    startSupervisorRun(runId);
936	    return { ok: true, queuedMessage };
937	  }
938	
939	  if (busyAction === "queue") {
940	    const worker = await selectConversationWorker(runId);
941	    if (!worker) {
942	      throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
943	    }
944	    if (isDirectRunMode(run.mode) || isPlanningRun(run)) {
945	      await reconcileWorkerUserMessagesInStream(runId, worker.id);
946	    }
947	
948	    const queuedMessage = await createQueuedConversationMessage({
949	      runId,
950	      targetWorkerId: worker.id,
951	      action: "queue",
952	      content: trimmedContent,
953	      attachments: normalizedAttachments,
954	    });
955	    return { ok: true, queuedMessage };
956	  }
957	
958	  if (isSupervisedRun(run)) {
959	    const pendingClarification = await db
960	      .select()
961	      .from(clarifications)
962	      .where(and(eq(clarifications.runId, runId), eq(clarifications.status, "pending")))
963	      .orderBy(asc(clarifications.createdAt), asc(clarifications.id))
964	      .get();
965	    const createdAt = new Date();
966	    const message = {
967	      id: randomUUID(),
968	      runId,
969	      role: "user",
970	      kind: pendingClarification ? "clarification_answer" : "checkpoint",
971	      content: trimmedContent,
972	      attachmentsJson,
973	      createdAt,
974	    };
975	
976	    await db.insert(messages).values(message);
977	
978	    if (pendingClarification) {
979	      await answerClarification(pendingClarification.id, trimmedContent);
980	      const resumeResult = await resumeRunAfterClarification(runId);
981	      notifyEventStreamSubscribers();
982	      return {
983	        ok: true,
984	        message: serializeMessageRecord({ ...message, attachmentsJson }),
985	        ...resumeResult,
986	      };
987	    }
988	
989	    await db.update(runs).set({
990	      status: "running",
991	      failedAt: null,
992	      lastError: null,
993	      updatedAt: new Date(),
994	    }).where(eq(runs.id, runId));
995	    startSupervisorRun(runId);
996	    notifyEventStreamSubscribers();
997	    return {
998	      ok: true,
999	      message: serializeMessageRecord({ ...message, attachmentsJson }),
1000	    };
1001	  }
1002	
1003	  const worker = await selectConversationWorker(runId);
1004	  if (!worker) {
1005	    throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
1006	  }
1007	  if (isDirectRunMode(run.mode) || isPlanningRun(run)) {
1008	    await reconcileWorkerUserMessagesInStream(runId, worker.id);
1009	  }
1010	
1011	  if (isDirectRunMode(run.mode) && run.status === "awaiting_user") {
1012	    const elicitationAnswer = await answerDirectWorkerElicitation({
1013	      run,
1014	      worker,
1015	      userText: trimmedContent,
1016	      workerText: workerContent,
1017	      attachments: normalizedAttachments,
1018	      attachmentsJson,
1019	    });
1020	    if (elicitationAnswer) {
1021	      return {
1022	        ok: true,
1023	        message: serializeMessageRecord({ ...elicitationAnswer, attachmentsJson }),
1024	      };
1025	    }
1026	  }
1027	
1028	  if (busyAction === "steer" && ["starting", "working", "stuck"].includes(worker.status.trim().toLowerCase().split(":")[0] ?? "")) {
1029	    const queuedMessage = await createQueuedConversationMessage({
1030	      runId,
1031	      targetWorkerId: worker.id,
1032	      action: "steer",
1033	      content: trimmedContent,
1034	      attachments: normalizedAttachments,
1035	    });
1036	    return { ok: true, queuedMessage };
1037	  }
1038	
1039	  const userMessageCreatedAt = new Date();
1040	  const userMessage = {
1041	    id: randomUUID(),
1042	    runId,
1043	    role: "user",
1044	    kind: "checkpoint",
1045	    content: trimmedContent,
1046	    attachmentsJson,
1047	    createdAt: userMessageCreatedAt,
1048	  };
1049	
1050	  // Stream-first: append the user_input entry BEFORE the DB insert so that
1051	  // a crash between the two writes leaves at most a harmless orphan stream
1052	  // entry rather than a DB row the worker can never see. The stream entry
1053	  // is keyed by message id so the write is idempotent — if a retry lands on
1054	  // a row that already exists in the stream, appendUserInputOnDelivery
1055	  // dedups instead of double-appending.
1056	  if (isDirectRunMode(run.mode)) {
1057	    await appendUserInputOnDelivery({
1058	      id: userMessage.id,
1059	      runId: run.id,
1060	      workerId: worker.id,
1061	      text: trimmedContent,
1062	      deliveredAt: userMessageCreatedAt,
1063	      attachments: normalizedAttachments.map((attachment) => ({
1064	        id: attachment.id,
1065	        filename: attachment.name,
1066	        mimeType: attachment.mimeType,
1067	        sizeBytes: attachment.size,
1068	      })),
1069	    });
1070	  }
1071	
1072	  await db.insert(messages).values(userMessage);
1073	  await db.update(runs).set({
1074	    status: isPlanningRun(run) ? "working" : "running",
1075	    failedAt: null,
1076	    lastError: null,
1077	    updatedAt: userMessageCreatedAt,
1078	  }).where(eq(runs.id, runId));
1079	  notifyEventStreamSubscribers();
1080	
1081	  if (isDirectRunMode(run.mode)) {
1082	    notifyEventStreamSubscribers();
1083	    const allowCancelledWorkerResume = isWorkerCancelled(worker);
1084	
1085	    if (busyAction === "steer") {
1086	      try {
1087	        await runWorkerTurn(worker.id, () => continueWorkerConversation({
1088	          run,
1089	          worker,
1090	          content: workerContent,
1091	          userInputText: trimmedContent,
1092	          userInputId: userMessage.id,
1093	          attachments: normalizedAttachments,
1094	          // Already appended above.
1095	          appendUserInputBeforeAsk: false,
1096	          allowCancelledWorkerResume,
1097	        }));
1098	      } catch (error) {
1099	        if (isAgentBusyError(error)) {
1100	          await db.delete(messages).where(eq(messages.id, userMessage.id));
1101	          const queuedMessage = await createQueuedConversationMessage({
1102	            runId,
1103	            targetWorkerId: worker.id,
1104	            action: "steer",
1105	            content: trimmedContent,
1106	            attachments: normalizedAttachments,
1107	          });
1108	          return {
1109	            ok: true,
1110	            message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
1111	            queuedMessage,
1112	          };
1113	        }
1114	
1115	        throw error;
1116	      }
1117	
1118	      return {
1119	        ok: true,
1120	        message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
1121	      };
1122	    }
1123	
1124	    // Direct follow-up follows the same "append-immediately" path. The
1125	    // turn runs in the background.
1126	    const turn = trackConversationBackgroundTask(runWorkerTurn(worker.id, () => continueWorkerConversation({
1127	      run,
1128	      worker,
1129	      content: workerContent,
1130	      userInputText: trimmedContent,
1131	      userInputId: userMessage.id,
1132	      attachments: normalizedAttachments,
1133	      // Already appended above.
1134	      appendUserInputBeforeAsk: false,
1135	      allowCancelledWorkerResume,
1136	    })));
1137	    turn.catch((error) => {
1138	      if (isAgentBusyError(error)) {
1139	        return;
1140	      }
1141	
1142	      console.error("Direct conversation follow-up failed:", error);
1143	    });
1144	
1145	    return {
1146	      ok: true,
1147	      message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
1148	    };
1149	  }
1150	
1151	  try {
1152	    await runWorkerTurn(worker.id, () => continueWorkerConversation({
1153	      run,
1154	      worker,
1155	      content: workerContent,
1156	      userInputText: trimmedContent,
1157	      userInputId: userMessage.id,
1158	      attachments: normalizedAttachments,
1159	    }));
1160	  } catch (error) {
1161	    if (busyAction === "steer" && isAgentBusyError(error)) {
1162	      await db.delete(messages).where(eq(messages.id, userMessage.id));
1163	      const queuedMessage = await createQueuedConversationMessage({
1164	        runId,
1165	        targetWorkerId: worker.id,
1166	        action: "steer",
1167	        content: trimmedContent,
1168	        attachments: normalizedAttachments,
1169	      });
1170	      return {
1171	        ok: true,
1172	        message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
1173	        queuedMessage,
1174	      };
1175	    }
1176	
1177	    throw error;
1178	  }
1179	
1180	  return {
1181	    ok: true,
1182	    message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
1183	  };
1184	}
1185	

uuid: dc0d4baf-817a-46f5-8a50-4ce3dc8fe0f5
parent: ea685955-65b3-491c-a125-9cc1e0eeb227
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-26T20:43:25.912Z","phase":null} -->
## Claude tool result: toolu_01Sk5NezgcvuRYyEh5hTzaQ6 · 2026-06-26T20:43:25.912Z

```text
1	import { randomUUID } from "crypto";
2	import { and, asc, desc, eq } from "drizzle-orm";
3	import { askAgent, getAgent, respondElicitation } from "@/server/bridge-client";
4	import { db } from "@/server/db";
5	import { messages, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
6	import { recordExecutionEvent } from "@/server/events/execution-event-store";
7	import { emitNamedEvent } from "@/server/events/named-events";
8	import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
9	import { startSupervisorRun } from "@/server/supervisor/start";
10	import { recordSupervisorIntervention } from "@/server/supervisor/interventions";
11	import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
12	import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
13	import { getAppDataPath } from "@/server/app-root";
14	import { serializeMessageRecord } from "./message-records";
15	import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
16	import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
17	import { readWorkerOutputEntries } from "@/server/workers/output-store";
18	import { persistWorkerSnapshot } from "@/server/workers/snapshots";
19	import { runWorkerTurn } from "./worker-turn-gate";
20	import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
21	import { persistRunFailure } from "@/server/runs/failures";
22	import { buildDirectWorkerPrompt } from "./direct-worker-prompt";
23	import {
24	  serializeQueuedConversationMessage,
25	  type BusyMessageAction,
26	  type QueuedConversationMessageStatus,
27	} from "./queued-message-records";
28	export type { BusyMessageAction, QueuedConversationMessageStatus } from "./queued-message-records";
29	
30	type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;
31	export type WorkerAskResponse = Awaited<ReturnType<typeof askAgent>>;
32	type WorkerSnapshot = Awaited<ReturnType<typeof getAgent>>;
33	export type WorkerResponseRun = Pick<typeof runs.$inferSelect, "id" | "mode">;
34	type PendingElicitation = NonNullable<WorkerSnapshot["pendingElicitations"]>[number];
35	type ElicitationSchema = PendingElicitation["requestedSchema"];
36	type ElicitationContent = Record<string, string | number | boolean | string[]>;
37	
38	export class EmptyQueuedWorkerOutputError extends Error {
39	  constructor(
40	    readonly runId: string,
41	    readonly workerId: string,
42	    readonly responseState: string,
43	    readonly stopReason?: string | null,
44	  ) {
45	    const suffix = stopReason?.trim()
46	      ? `Stop reason: ${stopReason.trim()}.`
47	      : `Final state: ${responseState || "unknown"}.`;
48	    super(`Agent stopped without producing output. ${suffix}`);
49	    this.name = "EmptyQueuedWorkerOutputError";
50	  }
51	}
52	
53	function workerPromptForRun(run: WorkerResponseRun, content: string) {
54	  return run.mode === "direct" || run.mode === "commit"
55	    ? buildDirectWorkerPrompt(content)
56	    : content;
57	}
58	
59	const lastQueuedMessageCreatedAtByRun = new Map<string, number>();
60	
61	export function parseBusyMessageAction(value: unknown): BusyMessageAction | null {
62	  return value === "queue" || value === "steer" ? value : null;
63	}
64	
65	export function isAgentBusyError(error: unknown) {
66	  const message = error instanceof Error ? error.message : String(error);
67	  return /\bagent is busy\b/i.test(message);
68	}
69	
70	export function errorMessage(error: unknown) {
71	  return error instanceof Error ? error.message : String(error);
72	}
73	
74	function timestampMs(value: Date | string | number | null | undefined) {
75	  if (value instanceof Date) {
76	    return value.getTime();
77	  }
78	  const parsed = new Date(value ?? 0).getTime();
79	  return Number.isFinite(parsed) ? parsed : 0;
80	}
81	
82	async function nextQueuedMessageCreatedAt(runId: string) {
83	  const latest = await db
84	    .select({ createdAt: queuedConversationMessages.createdAt })
85	    .from(queuedConversationMessages)
86	    .where(eq(queuedConversationMessages.runId, runId))
87	    .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
88	    .get();
89	  const previousMs = Math.max(
90	    timestampMs(latest?.createdAt),
91	    lastQueuedMessageCreatedAtByRun.get(runId) ?? 0,
92	  );
93	  // Drizzle's SQLite timestamp mode stores integer seconds in this schema,
94	  // so use a one-second logical tick to preserve FIFO order through DB reads
95	  // that sort only by createdAt.
96	  const nextMs = Math.max(Date.now(), previousMs + 1_000);
97	  lastQueuedMessageCreatedAtByRun.set(runId, nextMs);
98	  return new Date(nextMs);
99	}
100	
101	async function queuedMessageStatus(messageId: string) {
102	  const record = await db
103	    .select({ status: queuedConversationMessages.status })
104	    .from(queuedConversationMessages)
105	    .where(eq(queuedConversationMessages.id, messageId))
106	    .get();
107	  return record?.status ?? null;
108	}
109	
110	export function isAgentNotFoundError(error: unknown) {
111	  return /\bagent not found\b/i.test(errorMessage(error));
112	}
113	
114	export function isEmptyQueuedWorkerOutputError(error: unknown): error is EmptyQueuedWorkerOutputError {
115	  return error instanceof EmptyQueuedWorkerOutputError;
116	}
117	
118	function workerStreamHasOutputAfterInput(
119	  entries: Awaited<ReturnType<typeof readWorkerOutputEntries>>,
120	  userInputEntryId: string,
121	) {
122	  const inputEntry = entries.find((entry) => entry.id === userInputEntryId);
123	  if (!inputEntry) {
124	    return false;
125	  }
126	
127	  return entries.some((entry) => (
128	    entry.seq > inputEntry.seq
129	    && entry.type !== "user_input"
130	    && entry.text.trim().length > 0
131	  ));
132	}
133	
134	async function assertQueuedDeliveryProducedOutput({
135	  runId,
136	  workerId,
137	  userInputEntryId,
138	  response,
139	  snapshot,
140	}: {
141	  runId: string;
142	  workerId: string;
143	  userInputEntryId: string;
144	  response: WorkerAskResponse;
145	  snapshot: WorkerSnapshot | null;
146	}) {
147	  if (response.response.trim()) {
148	    return;
149	  }
150	
151	  const entries = await readWorkerOutputEntries(runId, workerId);
152	  if (workerStreamHasOutputAfterInput(entries, userInputEntryId)) {
153	    return;
154	  }
155	
156	  throw new EmptyQueuedWorkerOutputError(
157	    runId,
158	    workerId,
159	    response.state,
160	    snapshot?.stopReason,
161	  );
162	}
163	
164	export async function getLatestRunWorker(runId: string, excludedWorkerId?: string | null) {
165	  const records = await db
166	    .select()
167	    .from(workers)
168	    .where(eq(workers.runId, runId))
169	    .orderBy(desc(workers.createdAt), desc(workers.id));
170	
171	  return records.find((worker) => worker.id !== excludedWorkerId) ?? null;
172	}
173	
174	export function isCancelledWorkerStatus(status: string | null | undefined) {
175	  const normalized = status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
176	  return normalized === "cancelled" || normalized === "canceled";
177	}
178	
179	function isActiveWorkerStatus(status: string | null | undefined) {
180	  const normalized = status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
181	  return normalized === "starting" || normalized === "working" || normalized === "stuck";
182	}
183	
184	function hasVisibleWorkerProgress(worker: typeof workers.$inferSelect) {
185	  return Boolean(
186	    worker.currentText.trim()
187	      || worker.lastText.trim()
188	      || worker.outputLog.trim(),
189	  );
190	}
191	
192	export function isWorkerClearlyBusy(worker: typeof workers.$inferSelect) {
193	  return isActiveWorkerStatus(worker.status) && hasVisibleWorkerProgress(worker);
194	}
195	
196	function formatWorkerLabel(worker: typeof workers.$inferSelect) {
197	  if (typeof worker.workerNumber === "number" && Number.isFinite(worker.workerNumber)) {
198	    return `worker ${worker.workerNumber}`;
199	  }
200	
201	  const match = worker.id.match(/-worker-(\d+)$/);
202	  return match ? `worker ${match[1]}` : "the active worker";
203	}
204	
205	function asRecord(value: unknown): Record<string, unknown> | null {
206	  return typeof value === "object" && value !== null && !Array.isArray(value)
207	    ? value as Record<string, unknown>
208	    : null;
209	}
210	
211	function asString(value: unknown): string | null {
212	  return typeof value === "string" ? value : null;
213	}
214	
215	function asRequestedSchema(value: unknown): ElicitationSchema | null {
216	  const schema = asRecord(value);
217	  if (!schema) {
218	    return null;
219	  }
220	  const properties = asRecord(schema.properties) ?? {};
221	  const required = Array.isArray(schema.required)
222	    ? schema.required.filter((item): item is string => typeof item === "string")
223	    : undefined;
224	  const type = asString(schema.type);
225	  return {
226	    properties,
227	    ...(type ? { type } : {}),
228	    ...(required ? { required } : {}),
229	  };
230	}
231	
232	function isOpenElicitationEntry(entry: NonNullable<WorkerSnapshot["outputEntries"]>[number]) {
233	  if (entry.type !== "elicitation") {
234	    return false;
235	  }
236	  const status = (entry.status ?? "pending").trim().toLowerCase();
237	  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected", "skipped"].includes(status);
238	}
239	
240	function pendingElicitationFromEntry(entry: NonNullable<WorkerSnapshot["outputEntries"]>[number]): PendingElicitation | null {
241	  if (!isOpenElicitationEntry(entry)) {
242	    return null;
243	  }
244	  const raw = asRecord(entry.raw);
245	  const requestId = raw?.requestId;
246	  if (!raw || typeof requestId !== "number" || !Number.isFinite(requestId)) {
247	    return null;
248	  }
249	  return {
250	    requestId,
251	    requestedAt: entry.timestamp,
252	    sessionId: asString(raw.sessionId),
253	    toolCallId: asString(raw.toolCallId ?? entry.toolCallId),
254	    message: asString(raw.message),
255	    requestedSchema: asRequestedSchema(raw.requestedSchema),
256	  };
257	}
258	
259	function selectPendingWorkerElicitation(snapshot: WorkerSnapshot | null): PendingElicitation | null {
260	  const pending = snapshot?.pendingElicitations?.[0] ?? null;
261	  if (pending) {
262	    return pending;
263	  }
264	  const entries = snapshot?.outputEntries ?? [];
265	  for (const entry of entries) {
266	    const elicitation = pendingElicitationFromEntry(entry);
267	    if (elicitation) {
268	      return elicitation;
269	    }
270	  }
271	  return null;
272	}
273	
274	function elicitationAnswerContent(text: string, requestedSchema: ElicitationSchema | null | undefined): ElicitationContent {
275	  const properties = requestedSchema?.properties ?? {};
276	  const propertyNames = Object.keys(properties);
277	  if (propertyNames.includes("customAnswer")) {
278	    return { customAnswer: text };
279	  }
280	
281	  const nonCustomFields = propertyNames.filter((name) => name !== "customAnswer");
282	  if (nonCustomFields.length === 1 && nonCustomFields[0]) {
283	    return { [nonCustomFields[0]]: text };
284	  }
285	
286	  return { response: text };
287	}
288	
289	async function answerPendingWorkerElicitation(args: {
290	  run: typeof runs.$inferSelect;
291	  worker: typeof workers.$inferSelect;
292	  snapshot: WorkerSnapshot | null;
293	  content: string;
294	  deliveredAt: Date;
295	}) {
296	  const elicitation = selectPendingWorkerElicitation(args.snapshot);
297	  if (!elicitation) {
298	    return false;
299	  }
300	
301	  await respondElicitation(args.worker.id, {
302	    action: "accept",
303	    content: elicitationAnswerContent(args.content, elicitation.requestedSchema),
304	  });
305	  await db.update(workers).set({
306	    status: "working",
307	    updatedAt: args.deliveredAt,
308	  }).where(eq(workers.id, args.worker.id));
309	  await db.update(runs).set({
310	    status: "running",
311	    failedAt: null,
312	    lastError: null,
313	    updatedAt: args.deliveredAt,
314	  }).where(eq(runs.id, args.run.id));
315	  emitNamedEvent({
316	    kind: "worker.status",
317	    runId: args.run.id,
318	    workerId: args.worker.id,
319	    prev: args.worker.status,
320	    next: "working",
321	  });
322	  return true;
323	}
324	
325	export async function persistDeliveredWorkerResponse({
326	  run,
327	  workerId,
328	  response,
329	  deliveredAt,
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
380	  details: Record<string, unknown>,
381	  workerId?: string | null,
382	) {
383	  await recordExecutionEvent({
384	    runId,
385	    workerId: workerId ?? null,
386	    eventType,
387	    details,
388	  });
389	}
390	
391	export async function listPendingQueuedConversationMessages(runId: string) {
392	  const records = await db
393	    .select()
394	    .from(queuedConversationMessages)
395	    .where(eq(queuedConversationMessages.runId, runId))
396	    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
397	
398	  return records
399	    .filter((record) => record.status === "pending" || record.status === "delivering")
400	    .map(serializeQueuedConversationMessage);
401	}
402	
403	export async function createQueuedConversationMessage({
404	  runId,
405	  targetWorkerId = null,
406	  action,
407	  content,
408	  attachments = [],
409	}: {
410	  runId: string;
411	  targetWorkerId?: string | null;
412	  action: BusyMessageAction;
413	  content: string;
414	  attachments?: ChatAttachment[];
415	}) {
416	  const trimmedContent = content.trim();
417	  const normalizedAttachments = normalizeChatAttachments(attachments);
418	  if (!trimmedContent && normalizedAttachments.length === 0) {
419	    throw Object.assign(new Error("Message content or attachment is required"), { status: 400 });
420	  }
421	
422	  const now = await nextQueuedMessageCreatedAt(runId);
423	  const record = {
424	    id: randomUUID(),
425	    runId,
426	    targetWorkerId,
427	    action,
428	    content: trimmedContent,
429	    attachmentsJson: serializeChatAttachments(normalizedAttachments),
430	    status: "pending",
431	    lastError: null,
432	    createdAt: now,
433	    updatedAt: now,
434	    deliveredAt: null,
435	  };
436	
437	  await db.insert(queuedConversationMessages).values(record);
438	  await insertQueueExecutionEvent(runId, "queued_message_created", {
439	    summary: action === "steer" ? "Steering message was deferred into the queue." : "Message queued for the next safe turn.",
440	    queuedMessageId: record.id,
441	    action,
442	  }, targetWorkerId);
443	  notifyEventStreamSubscribers();
444	  return serializeQueuedConversationMessage(record);
445	}
446	
447	export async function cancelQueuedConversationMessage({
448	  runId,
449	  messageId,
450	}: {
451	  runId: string;
452	  messageId: string;
453	}) {
454	  const record = await db
455	    .select()
456	    .from(queuedConversationMessages)
457	    .where(eq(queuedConversationMessages.id, messageId))
458	    .get();
459	
460	  if (!record || record.runId !== runId) {
461	    throw Object.assign(new Error("Queued message not found"), { status: 404 });
462	  }
463	
464	  if (record.status === "delivered") {
465	    throw Object.assign(new Error("Queued message was already delivered and cannot be cancelled"), { status: 409 });
466	  }
467	
468	  if (record.status === "cancelled") {
469	    return serializeQueuedConversationMessage(record);
470	  }
471	
472	  const now = new Date();
473	  await db.update(queuedConversationMessages).set({
474	    status: "cancelled",
475	    updatedAt: now,
476	  }).where(eq(queuedConversationMessages.id, messageId));
477	  await insertQueueExecutionEvent(runId, "queued_message_cancelled", {
478	    summary: "Cancelled queued message.",
479	    queuedMessageId: messageId,
480	  }, record.targetWorkerId);
481	  notifyEventStreamSubscribers();
482	
483	  return serializeQueuedConversationMessage({
484	    ...record,
485	    status: "cancelled",
486	    updatedAt: now,
487	  });
488	}
489	
490	async function deliverQueuedWorkerSteering(args: {
491	  run: typeof runs.$inferSelect;
492	  worker: typeof workers.$inferSelect;
493	  messageId: string;
494	  userMessageId?: string | null;
495	  content: string;
496	  userText: string;
497	  attachments: ChatAttachment[];
498	}) {
499	  await runWorkerTurn(args.worker.id, async () => {
500	    let userInputAppended = false;
501	    const appendQueuedUserInput = async (deliveredAt: Date) => {
502	      await appendUserInputOnDelivery({
503	        id: args.userMessageId ?? args.messageId,
504	        runId: args.run.id,
505	        workerId: args.worker.id,
506	        text: args.userText,
507	        deliveredAt,
508	        attachments: args.attachments.map((attachment) => ({
509	          id: attachment.id,
510	          filename: attachment.name,
511	          mimeType: attachment.mimeType,
512	          sizeBytes: attachment.size,
513	        })),
514	      });
515	      userInputAppended = true;
516	    };
517	
518	    if (await queuedMessageStatus(args.messageId) !== "delivering") {
519	      notifyEventStreamSubscribers();
520	      return;
521	    }
522	
523	    await appendQueuedUserInput(new Date());
524	    notifyEventStreamSubscribers();
525	
526	    if (await queuedMessageStatus(args.messageId) !== "delivering") {
527	      notifyEventStreamSubscribers();
528	      return;
529	    }
530	
531	    const snapshotBeforeAsk = await Promise.resolve(getAgent(args.worker.id)).catch(() => null);
532	    const deliveredAt = new Date();
533	    if (await queuedMessageStatus(args.messageId) !== "delivering") {
534	      notifyEventStreamSubscribers();
535	      return;
536	    }
537	    if (!userInputAppended) {
538	      // Kept as a defensive fallback for future call paths that might
539	      // choose not to pre-anchor the prompt before bridge output streams.
540	      await appendQueuedUserInput(deliveredAt);
541	    }
542	    if (await answerPendingWorkerElicitation({
543	      run: args.run,
544	      worker: args.worker,
545	      snapshot: snapshotBeforeAsk,
546	      content: args.userText,
547	      deliveredAt,
548	    })) {
549	      await db.update(queuedConversationMessages).set({
550	        status: "delivered",
551	        lastError: null,
552	        updatedAt: deliveredAt,
553	        deliveredAt,
554	      }).where(eq(queuedConversationMessages.id, args.messageId));
555	      await insertQueueExecutionEvent(args.run.id, "queued_message_delivered", {
556	        summary: `Delivered queued answer to ${args.worker.id}'s pending question.`,
557	        queuedMessageId: args.messageId,
558	        action: "steer",
559	        delivery: "elicitation",
560	      }, args.worker.id);
561	      notifyEventStreamSubscribers();
562	      return;
563	    }
564	
565	    const response = await askAgent(args.worker.id, workerPromptForRun(args.run, args.content));
566	    await persistDeliveredWorkerResponse({
567	      run: args.run,
568	      workerId: args.worker.id,
569	      response,
570	      deliveredAt,
571	      userInputEntryId: args.userMessageId ?? args.messageId,
572	    });
573	    // Worker response now lives in the unified worker stream; the
574	    // legacy role:"worker" messages row is no longer written.
575	    await db.update(queuedConversationMessages).set({
576	      status: "delivered",
577	      lastError: null,
578	      updatedAt: deliveredAt,
579	      deliveredAt,
580	    }).where(eq(queuedConversationMessages.id, args.messageId));
581	    await insertQueueExecutionEvent(args.run.id, "queued_message_delivered", {
582	      summary: `Delivered immediate queued steering to ${args.worker.id}.`,
583	      queuedMessageId: args.messageId,
584	      action: "steer",
585	    }, args.worker.id);
586	    notifyEventStreamSubscribers();
587	  });
588	}
589	
590	async function continueQueuedWorkerSteering(args: {
591	  run: typeof runs.$inferSelect;
592	  worker: typeof workers.$inferSelect;
593	  messageId: string;
594	  userMessageId?: string | null;
595	  content: string;
596	  userText: string;
597	  attachments: ChatAttachment[];
598	}) {
599	  try {
600	    await deliverQueuedWorkerSteering(args);
601	    return;
602	  } catch (error) {
603	    if (isAgentNotFoundError(error)) {
604	      const fallbackWorker = await getLatestRunWorker(args.run.id, args.worker.id);
605	      if (fallbackWorker) {
606	        try {
607	          await db.update(queuedConversationMessages).set({
608	            targetWorkerId: fallbackWorker.id,
609	            updatedAt: new Date(),
610	          }).where(eq(queuedConversationMessages.id, args.messageId));
611	          await deliverQueuedWorkerSteering({
612	            ...args,
613	            worker: fallbackWorker,
614	          });
615	          return;
616	        } catch (fallbackError) {
617	          error = fallbackError;
618	        }
619	      }
620	    }
621	
622	    const failedAt = new Date();
623	    if (await queuedMessageStatus(args.messageId) !== "delivering") {
624	      notifyEventStreamSubscribers();
625	      return;
626	    }
627	    await db.update(queuedConversationMessages).set({
628	      status: isAgentBusyError(error) ? "pending" : "failed",
629	      lastError: errorMessage(error),
630	      updatedAt: failedAt,
631	    }).where(eq(queuedConversationMessages.id, args.messageId));
632	    if (isEmptyQueuedWorkerOutputError(error)) {
633	      await db.update(workers).set({
634	        status: "error",
635	        outputLog: error.message,
636	        updatedAt: failedAt,
637	      }).where(eq(workers.id, args.worker.id));
638	      if (args.run.mode === "direct" || args.run.mode === "commit") {
639	        await persistRunFailure(args.run.id, error, {
640	          surface: { code: "worker.idle.empty_output", workerId: args.worker.id },
641	        });
642	      }
643	    }
644	    if (isAgentBusyError(error) && args.userMessageId) {
645	      await db.delete(messages).where(eq(messages.id, args.userMessageId));
646	    }
647	    await insertQueueExecutionEvent(args.run.id, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
648	      summary: isAgentBusyError(error)
649	        ? `Worker ${args.worker.id} is still busy; queued message will be retried.`
650	        : `Immediate queued steering failed for ${args.worker.id}.`,
651	      queuedMessageId: args.messageId,
652	      action: "steer",
653	      error: errorMessage(error),
654	    }, args.worker.id);
655	    if (isAgentNotFoundError(error)) {
656	      await insertQueueExecutionEvent(args.run.id, "queued_message_recovery_blocked", {
657	        summary: `Queued message ${args.messageId} is blocked because ${args.worker.id} is missing.`,
658	        queuedMessageId: args.messageId,
659	        action: "steer",
660	        error: errorMessage(error),
661	      }, args.worker.id);
662	      await reconcileRunRecovery({
663	        runId: args.run.id,
664	        liveAgents: [],
665	        source: "queued-message-delivery",
666	      });
667	    }
668	    notifyEventStreamSubscribers();
669	  }
670	}
671	
672	export async function sendQueuedConversationMessageNow({
673	  runId,
674	  messageId,
675	}: {
676	  runId: string;
677	  messageId: string;
678	}) {
679	  const record = await db
680	    .select()
681	    .from(queuedConversationMessages)
682	    .where(eq(queuedConversationMessages.id, messageId))
683	    .get();
684	
685	  if (!record || record.runId !== runId || record.status !== "pending") {
686	    throw Object.assign(new Error("Queued message not found"), { status: 404 });
687	  }
688	
689	  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
690	  if (!run) {
691	    throw Object.assign(new Error("Conversation not found"), { status: 404 });
692	  }
693	
694	  const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
695	  const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
696	    resolvePath: (storagePath) => getAppDataPath(storagePath),
697	  });
698	  const startedAt = new Date();
699	
700	  await db.update(queuedConversationMessages).set({
701	    action: "steer",
702	    status: "delivering",
703	    lastError: null,
704	    updatedAt: startedAt,
705	  }).where(eq(queuedConversationMessages.id, messageId));
706	
707	  if (run.mode === "implementation") {
708	    await db.update(runs).set({
709	      status: "running",
710	      failedAt: null,
711	      lastError: null,
712	      updatedAt: startedAt,
713	    }).where(eq(runs.id, runId));
714	    await db.update(queuedConversationMessages).set({
715	      action: "steer",
716	      status: "pending",
717	      lastError: null,
718	      updatedAt: startedAt,
719	      deliveredAt: null,
720	    }).where(eq(queuedConversationMessages.id, messageId));
721	    await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
722	      summary: "Accepted queued message for implementation worker steering.",
723	      queuedMessageId: messageId,
724	      action: "steer",
725	    });
726	    startSupervisorRun(runId);
727	    notifyEventStreamSubscribers();
728	
729	    return {
730	      ok: true,
731	      queuedMessage: serializeQueuedConversationMessage({
732	        ...record,
733	        action: "steer",
734	        status: "pending",
735	        lastError: null,
736	        updatedAt: startedAt,
737	        deliveredAt: null,
738	      }),
739	    };
740	  }
741	
742	  const targetWorker = record.targetWorkerId
743	    ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
744	    : null;
745	  const worker = targetWorker && targetWorker.runId === runId
746	    ? targetWorker
747	    : await getLatestRunWorker(runId, record.targetWorkerId);
748	  if (!worker || worker.runId !== runId) {
749	    await db.update(queuedConversationMessages).set({
750	      status: "pending",
751	      updatedAt: new Date(),
752	    }).where(eq(queuedConversationMessages.id, messageId));
753	    throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
754	  }
755	
756	  if (isWorkerClearlyBusy(worker)) {
757	    const error = `Ask failed: Agent is busy: ${worker.id}`;
758	    await db.update(queuedConversationMessages).set({
759	      action: "steer",
760	      targetWorkerId: worker.id,
761	      status: "pending",
762	      lastError: error,
763	      updatedAt: new Date(),
764	    }).where(eq(queuedConversationMessages.id, messageId));
765	    await insertQueueExecutionEvent(runId, "queued_message_deferred", {
766	      summary: `Worker ${worker.id} is still busy; queued message will be retried.`,
767	      queuedMessageId: messageId,
768	      action: "steer",
769	      error,
770	    }, worker.id);
771	    notifyEventStreamSubscribers();
772	
773	    return {
774	      ok: true,
775	      queuedMessage: serializeQueuedConversationMessage({
776	        ...record,
777	        targetWorkerId: worker.id,
778	        action: "steer",
779	        status: "pending",
780	        lastError: error,
781	        updatedAt: startedAt,
782	        deliveredAt: null,
783	      }),
784	    };
785	  }
786	
787	  const userMessage = {
788	    id: messageId,
789	    runId,
790	    role: "user",
791	    kind: "checkpoint",
792	    content: record.content,
793	    attachmentsJson: record.attachmentsJson,
794	    createdAt: startedAt,
795	  };
796	
797	  await db.insert(messages).values(userMessage);
798	  await db.update(runs).set({
799	    status: run.mode === "planning" ? "working" : "running",
800	    failedAt: null,
801	    lastError: null,
802	    updatedAt: startedAt,
803	  }).where(eq(runs.id, runId));
804	  await db.update(workers).set({
805	    status: "working",
806	    updatedAt: startedAt,
807	  }).where(eq(workers.id, worker.id));
808	
809	  await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
810	    summary: `Accepted queued message for immediate steering to ${worker.id}.`,
811	    queuedMessageId: messageId,
812	    action: "steer",
813	  }, worker.id);
814	  notifyEventStreamSubscribers();
815	
816	  continueQueuedWorkerSteering({
817	    run,
818	    worker,
819	    messageId,
820	    userMessageId: userMessage.id,
821	    content: workerContent,
822	    userText: record.content,
823	    attachments: normalizedAttachments,
824	  }).catch((error) => {
825	    console.error("Queued message immediate steering failed:", error);
826	  });
827	
828	  return {
829	    ok: true,
830	    message: serializeMessageRecord(userMessage),
831	    queuedMessage: serializeQueuedConversationMessage({
832	      ...record,
833	      targetWorkerId: worker.id,
834	      action: "steer",
835	      status: "delivering",
836	      lastError: null,
837	      updatedAt: startedAt,
838	      deliveredAt: null,
839	    }),
840	  };
841	}
842	
843	async function pendingQueueRecords(runId: string, workerId?: string | null) {
844	  const records = await db
845	    .select()
846	    .from(queuedConversationMessages)
847	    .where(eq(queuedConversationMessages.runId, runId))
848	    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
849	
850	  return records.filter((record) => {
851	    if (record.status !== "pending") {
852	      return false;
853	    }
854	
855	    if (workerId === undefined) {
856	      return record.targetWorkerId === null;
857	    }
858	
859	    return record.targetWorkerId === workerId;
860	  });
861	}
862	
863	export async function drainQueuedImplementationMessages(runId: string) {
864	  const records = await pendingQueueRecords(runId);
865	  let deliveredCount = 0;
866	
867	  for (const record of records) {
868	    const now = new Date();
869	    await db.update(queuedConversationMessages).set({
870	      status: "delivering",
871	      updatedAt: now,
872	    }).where(eq(queuedConversationMessages.id, record.id));
873	
874	    if (record.action === "steer") {
875	      const targetWorker = record.targetWorkerId
876	        ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
877	        : null;
878	      const worker = targetWorker && targetWorker.runId === runId && !isCancelledWorkerStatus(targetWorker.status)
879	        ? targetWorker
880	        : await getLatestRunWorker(runId, record.targetWorkerId);
881	
882	      if (!worker || worker.runId !== runId || isCancelledWorkerStatus(worker.status)) {
883	        await db.update(queuedConversationMessages).set({
884	          status: "pending",
885	          lastError: "Conversation worker not found",
886	          updatedAt: new Date(),
887	        }).where(eq(queuedConversationMessages.id, record.id));
888	        await insertQueueExecutionEvent(runId, "queued_message_deferred", {
889	          summary: "No active implementation worker is available; queued steering will be retried.",
890	          queuedMessageId: record.id,
891	          action: "steer",
892	          error: "Conversation worker not found",
893	        });
894	        continue;
895	      }
896	
897	      const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
898	      const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
899	        resolvePath: (storagePath) => getAppDataPath(storagePath),
900	      });
901	      let interventionId: string | null = null;
902	
903	      try {
904	        await runWorkerTurn(worker.id, async () => {
905	          await db.update(workers).set({
906	            status: "working",
907	            updatedAt: now,
908	          }).where(eq(workers.id, worker.id));
909	          const intervention = await recordSupervisorIntervention({
910	            runId,
911	            workerId: worker.id,
912	            prompt: workerContent,
913	            summary: `Sent user steering to ${worker.id}`,
914	            interventionType: "continue",
915	          });
916	          interventionId = intervention.id;
917	          const response = await askAgent(worker.id, workerContent);
918	          const deliveredAt = new Date();
919	          const userMessage = {
920	            id: randomUUID(),
921	            runId,
922	            role: "user" as const,
923	            kind: "checkpoint" as const,
924	            content: record.content,
925	            attachmentsJson: record.attachmentsJson,
926	            createdAt: record.createdAt,
927	          };
928	          await appendUserInputOnDelivery({
929	            id: userMessage.id,
930	            runId,
931	            workerId: worker.id,
932	            text: record.content,
933	            deliveredAt,
934	            attachments: normalizedAttachments.map((attachment) => ({
935	              id: attachment.id,
936	              filename: attachment.name,
937	              mimeType: attachment.mimeType,
938	              sizeBytes: attachment.size,
939	            })),
940	          });
941	          await db.insert(messages).values(userMessage);
942	          await db.insert(messages).values({
943	            id: randomUUID(),
944	            runId,
945	            role: "supervisor",
946	            kind: "update",
947	            content: `Got it. I sent that to ${formatWorkerLabel(worker)} and will keep watching the run.`,
948	            attachmentsJson: null,
949	            createdAt: deliveredAt,
950	          });
951	          await persistDeliveredWorkerResponse({
952	            run: { id: runId, mode: "implementation" },
953	            workerId: worker.id,
954	            response,
955	            deliveredAt,
956	            userInputEntryId: userMessage.id,
957	          });
958	          // Worker response now lives in the unified worker stream.
959	          await db.update(queuedConversationMessages).set({
960	            targetWorkerId: worker.id,
961	            status: "delivered",
962	            updatedAt: deliveredAt,
963	            deliveredAt,
964	            lastError: null,
965	          }).where(eq(queuedConversationMessages.id, record.id));
966	          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
967	            summary: `Delivered queued steering to ${worker.id}.`,
968	            queuedMessageId: record.id,
969	            action: "steer",
970	          }, worker.id);
971	        });
972	        deliveredCount += 1;
973	      } catch (error) {
974	        const failedAt = new Date();
975	        await db.update(queuedConversationMessages).set({
976	          targetWorkerId: worker.id,
977	          status: isAgentBusyError(error) ? "pending" : "failed",
978	          lastError: errorMessage(error),
979	          updatedAt: failedAt,
980	        }).where(eq(queuedConversationMessages.id, record.id));
981	        if (isAgentBusyError(error) && interventionId) {
982	          await db.update(supervisorInterventions).set({
983	            summary: `Deferred user steering to ${worker.id}; worker is busy.`,
984	          }).where(eq(supervisorInterventions.id, interventionId));
985	        }
986	        await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
987	          summary: isAgentBusyError(error)
988	            ? `Worker ${worker.id} is still busy; queued steering will be retried.`
989	            : `Queued steering delivery failed for ${worker.id}.`,
990	          queuedMessageId: record.id,
991	          action: "steer",
992	          error: errorMessage(error),
993	        }, worker.id);
994	      }
995	      continue;
996	    }
997	
998	    await db.insert(messages).values({
999	      id: randomUUID(),
1000	      runId,
1001	      role: "user" as const,
1002	      kind: "checkpoint" as const,
1003	      content: record.content,
1004	      attachmentsJson: record.attachmentsJson,
1005	      createdAt: record.createdAt,
1006	    });
1007	
1008	    await db.update(queuedConversationMessages).set({
1009	      status: "delivered",
1010	      updatedAt: now,
1011	      deliveredAt: now,
1012	      lastError: null,
1013	    }).where(eq(queuedConversationMessages.id, record.id));
1014	    await insertQueueExecutionEvent(runId, "queued_message_delivered", {
1015	      summary: "Delivered queued message into the supervisor conversation.",
1016	      queuedMessageId: record.id,
1017	    });
1018	    deliveredCount += 1;
1019	  }
1020	
1021	  if (deliveredCount > 0) {
1022	    notifyEventStreamSubscribers();
1023	  }
1024	
1025	  return deliveredCount;
1026	}
1027	
1028	export async function drainQueuedWorkerMessages({
1029	  runId,
1030	  workerId,
1031	  snapshot,
1032	}: {
1033	  runId: string;
1034	  workerId: string;
1035	  snapshot?: WorkerSnapshot | null;
1036	}) {
1037	  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
1038	  if (!worker || worker.runId !== runId) {
1039	    return 0;
1040	  }
1041	
1042	  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
1043	  if (!run) {
1044	    return 0;
1045	  }
1046	
1047	  const records = await pendingQueueRecords(runId, workerId);
1048	  let deliveredCount = 0;
1049	
1050	  for (const record of records) {
1051	    const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
1052	    const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
1053	      resolvePath: (storagePath) => getAppDataPath(storagePath),
1054	    });
1055	    const startedAt = new Date();
1056	
1057	    const userMessage = {
1058	      id: randomUUID(),
1059	      runId,
1060	      role: "user" as const,
1061	      kind: "checkpoint" as const,
1062	      content: record.content,
1063	      attachmentsJson: record.attachmentsJson,
1064	      createdAt: startedAt,
1065	    };
1066	    const claimed = await db.update(queuedConversationMessages).set({
1067	      status: "delivering",
1068	      updatedAt: startedAt,
1069	      lastError: null,
1070	    }).where(and(
1071	      eq(queuedConversationMessages.id, record.id),
1072	      eq(queuedConversationMessages.status, "pending"),
1073	    )).returning({ id: queuedConversationMessages.id });
1074	    if (claimed.length === 0) {
1075	      continue;
1076	    }
1077	    await db.update(runs).set({
1078	      status: run.mode === "planning" ? "working" : "running",
1079	      failedAt: null,
1080	      lastError: null,
1081	      updatedAt: startedAt,
1082	    }).where(eq(runs.id, runId));
1083	
1084	    try {
1085	      await runWorkerTurn(workerId, async () => {
1086	        await db.update(workers).set({
1087	          status: "working",
1088	          updatedAt: startedAt,
1089	        }).where(eq(workers.id, workerId));
1090	        const snapshotBeforeAsk = snapshot ?? await Promise.resolve(getAgent(workerId)).catch(() => null);
1091	        const deliveredAt = new Date();
1092	        await appendUserInputOnDelivery({
1093	          id: userMessage.id,
1094	          runId,
1095	          workerId,
1096	          text: record.content,
1097	          deliveredAt,
1098	          attachments: normalizedAttachments.map((attachment) => ({
1099	            id: attachment.id,
1100	            filename: attachment.name,
1101	            mimeType: attachment.mimeType,
1102	            sizeBytes: attachment.size,
1103	          })),
1104	        });
1105	        await db.insert(messages).values(userMessage);
1106	        if (await answerPendingWorkerElicitation({
1107	          run,
1108	          worker,
1109	          snapshot: snapshotBeforeAsk,
1110	          content: record.content,
1111	          deliveredAt,
1112	        })) {
1113	          await db.update(queuedConversationMessages).set({
1114	            status: "delivered",
1115	            lastError: null,
1116	            updatedAt: deliveredAt,
1117	            deliveredAt,
1118	          }).where(eq(queuedConversationMessages.id, record.id));
1119	          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
1120	            summary: `Delivered queued answer to ${workerId}'s pending question.`,
1121	            queuedMessageId: record.id,
1122	            delivery: "elicitation",
1123	          }, workerId);
1124	          return;
1125	        }
1126	
1127	        const response = await askAgent(workerId, workerPromptForRun(run, workerContent));
1128	        await persistDeliveredWorkerResponse({
1129	          run,
1130	          workerId,
1131	          response,
1132	          deliveredAt,
1133	          userInputEntryId: userMessage.id,
1134	        });
1135	        // Worker response now lives in the unified worker stream.
1136	        await db.update(queuedConversationMessages).set({
1137	          status: "delivered",
1138	          lastError: null,
1139	          updatedAt: deliveredAt,
1140	          deliveredAt,
1141	        }).where(eq(queuedConversationMessages.id, record.id));
1142	        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
1143	          summary: `Delivered queued message to ${workerId}.`,
1144	          queuedMessageId: record.id,
1145	        }, workerId);
1146	      });
1147	      deliveredCount += 1;
1148	    } catch (error) {
1149	      const failedAt = new Date();
1150	      await db.update(queuedConversationMessages).set({
1151	        status: isAgentBusyError(error) ? "pending" : "failed",
1152	        lastError: errorMessage(error),
1153	        updatedAt: failedAt,
1154	      }).where(eq(queuedConversationMessages.id, record.id));
1155	      await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
1156	        summary: isAgentBusyError(error)
1157	          ? `Worker ${workerId} is still busy; queued message will be retried.`
1158	          : `Queued message delivery failed for ${workerId}.`,
1159	        queuedMessageId: record.id,
1160	        error: errorMessage(error),
1161	      }, workerId);
1162	
1163	      if (isAgentNotFoundError(error)) {
1164	        await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
1165	          summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
1166	          queuedMessageId: record.id,
1167	          error: errorMessage(error),
1168	        }, workerId);
1169	        await reconcileRunRecovery({
1170	          runId,
1171	          liveAgents: [],
1172	          source: "queued-message-drain",
1173	        });
1174	      }
1175	
1176	      if (isAgentBusyError(error)) {
1177	        await db.delete(messages).where(eq(messages.id, userMessage.id));
1178	      } else {
1179	        break;
1180	      }
1181	    }
1182	  }
1183	
1184	  if (deliveredCount > 0 || records.length > 0) {
1185	    notifyEventStreamSubscribers();
1186	  }
1187	
1188	  return deliveredCount;
1189	}
1190	

uuid: eb60e0a1-740e-407b-9db9-3c3172314eda
parent: 529767c8-86f2-48f0-ad95-4a44754558f5
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-26T20:43:26.042Z","phase":null} -->
## Claude tool call: Read · 2026-06-26T20:43:26.042Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/sync.ts"
}

uuid: c3b78e61-3305-4d97-8ffe-8bf579cc4c86
parent: eb60e0a1-740e-407b-9db9-3c3172314eda
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-26T20:43:26.340Z","phase":null} -->
## Claude tool result: toolu_01SHJaxSb8cRfdeYXKAtKsYy · 2026-06-26T20:43:26.340Z

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
140	  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...agent, workerStatus: agent.state }) === "awaiting_user") {
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
169	  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput({ ...worker, workerStatus: worker.status }) === "awaiting_user") {
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
440	type SyncConversationSessionsOptions = {
441	  selectedRunId?: string | null;
442	  refreshPlanningArtifacts?: boolean;
443	};
444	
445	export async function syncConversationSessions(rawAgents: unknown[], options: SyncConversationSessionsOptions = {}) {
446	  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
447	  const selectedRunId = options.selectedRunId?.trim() || null;
448	  const refreshPlanningArtifacts = options.refreshPlanningArtifacts !== false;
449	  const allRuns = selectedRunId
450	    ? await db.select().from(runs).where(eq(runs.id, selectedRunId))
451	    : await db.select().from(runs);
452	  const allWorkers = selectedRunId
453	    ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
454	    : await db.select().from(workers);
455	
456	  for (const run of allRuns) {
457	    const staleBusyFailure = isAgentBusyRunFailure(run);
458	    const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
459	    const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);
460	    if (run.mode === "implementation") {
461	      const implementationWorkers = allWorkers.filter((candidate) => candidate.runId === run.id);
462	      let syncedActiveLiveWorker = false;
463	
464	      for (const implementationWorker of implementationWorkers) {
465	        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
466	        const cancelledWorkerHasMatchingLiveSession = Boolean(
467	          implementationAgent
468	          && implementationWorker.bridgeSessionId
469	          && implementationWorker.bridgeSessionMode
470	          && implementationAgent.sessionId === implementationWorker.bridgeSessionId
471	          && implementationAgent.sessionMode === implementationWorker.bridgeSessionMode,
472	        );
473	        if (isCancelledWorkerStatus(implementationWorker.status)
474	          && !cancelledWorkerHasMatchingLiveSession) {
475	          continue;
476	        }
477	        if (!implementationAgent || !isCleanLiveAgent(implementationAgent) || !isActiveLiveAgent(implementationAgent)) {
478	          continue;
479	        }
480	
481	        await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
482	        await db.update(workers).set({
483	          status: implementationAgent.state,
484	          cwd: implementationAgent.cwd || implementationWorker.cwd,
485	          currentText: implementationAgent.currentText,
486	          lastText: implementationAgent.lastText,
487	          bridgeSessionId: implementationAgent.sessionId ?? implementationWorker.bridgeSessionId,
488	          bridgeSessionMode: implementationAgent.sessionMode ?? implementationWorker.bridgeSessionMode,
489	          updatedAt: new Date(),
490	        }).where(eq(workers.id, implementationWorker.id));
491	        syncedActiveLiveWorker = true;
492	      }
493	
494	      if (syncedActiveLiveWorker) {
495	        if (run.status !== "running" || run.failedAt || run.lastError) {
496	          await db.update(runs).set({
497	            status: "running",
498	            failedAt: null,
499	            lastError: null,
500	            updatedAt: new Date(),
501	          }).where(eq(runs.id, run.id));
502	          await clearMatchingRunFailureMessage(run);
503	          startSupervisorRun(run.id);
504	        }
505	        continue;
506	      }
507	
508	      if (!staleImplementationTransientFailure) {
509	        continue;
510	      }
511	
512	      const implementationWorker = implementationWorkers[0];
513	      const implementationAgent = implementationWorker
514	        ? agents.find((candidate) => candidate.name === implementationWorker.id)
515	        : null;
516	      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
517	        if (staleImplementationConnectionFailure) {
518	          const resumableWorker = implementationWorkers.find((worker) => worker.bridgeSessionId?.trim());
519	          if (resumableWorker) {
520	            await db.update(runs).set({
521	              status: "running",
522	              failedAt: null,
523	              lastError: null,
524	              updatedAt: new Date(),
525	            }).where(eq(runs.id, run.id));
526	            await clearMatchingRunFailureMessage(run);
527	            startSupervisorRun(run.id);
528	          }
529	        }
530	        continue;
531	      }
532	
533	      await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
534	      await db.update(workers).set({
535	        status: implementationAgent.state,
536	        cwd: implementationAgent.cwd || implementationWorker.cwd,
537	        currentText: implementationAgent.currentText,
538	        lastText: implementationAgent.lastText,
539	        updatedAt: new Date(),
540	      }).where(eq(workers.id, implementationWorker.id));
541	      await db.update(runs).set({
542	        status: "running",
543	        failedAt: null,
544	        lastError: null,
545	        updatedAt: new Date(),
546	      }).where(eq(runs.id, run.id));
547	      await clearMatchingRunFailureMessage(run);
548	      startSupervisorRun(run.id);
549	      continue;
550	    }
551	
552	    const worker = selectConversationWorker(run.id, allWorkers);
553	    if (!worker) {
554	      continue;
555	    }
556	
557	    if (await clearStaleDirectCurrentText(run, worker)) {
558	      continue;
559	    }
560	
561	    const agent = agents.find((candidate) => candidate.name === worker.id);
562	    const selectedTerminalDirectRunStillStreaming = Boolean(
563	      options.selectedRunId === run.id
564	      && isDirectRunMode(run.mode)
565	      && agent
566	      && isActiveLiveAgent(agent),
567	    );
568	    if (isTerminalRunStatus(run.status) && !staleBusyFailure && !selectedTerminalDirectRunStillStreaming) {
569	      continue;
570	    }
571	
572	    if (!agent) {
573	      continue;
574	    }
575	
576	    if (
577	      isDirectRunMode(run.mode)
578	      && worker.status.trim().toLowerCase().split(":")[0]?.trim() === "idle"
579	      && isIdleLiveAgentWithoutOutput(agent)
580	    ) {
581	      await db.update(workers).set({
582	        status: "error",
583	        cwd: agent.cwd || worker.cwd,
584	        currentText: agent.currentText,
585	        lastText: agent.lastText,
586	        outputLog: EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
587	        updatedAt: new Date(),
588	      }).where(eq(workers.id, worker.id));
589	      await persistRunFailure(run.id, new Error(EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
590	        surface: { code: "worker.idle.empty_output", workerId: worker.id },
591	      });
592	      continue;
593	    }
594	
595	    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
596	    const nextRunState = resolveSyncedRunState(run, agent);
597	    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
598	    const nextWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
599	    await db.update(workers).set({
600	      status: nextWorkerStatus,
601	      cwd: agent.cwd || worker.cwd,
602	      currentText: quiescedDirectWorker ? "" : agent.currentText,
603	      lastText: agent.lastText,
604	      updatedAt: new Date(),
605	    }).where(eq(workers.id, worker.id));
606	    if (worker.status !== nextWorkerStatus) {
607	      emitNamedEvent({
608	        kind: "worker.status",
609	        runId: run.id,
610	        workerId: worker.id,
611	        prev: worker.status,
612	        next: nextWorkerStatus,
613	      });
614	    }
615	
616	    if (run.mode === "planning") {
617	      if (refreshPlanningArtifacts) {
618	        const result = await refreshPlanningArtifactsForRun({
619	          run,
620	          worker,
621	          snapshot: agent,
622	          status: nextRunState === "running" ? "working" : undefined,
623	        });
624	        if (staleBusyFailure && result.status !== "failed") {
625	          await clearMatchingRunFailureMessage(run);
626	        }
627	      }
628	      await drainQueuedWorkerMessagesWithObservation({
629	        runId: run.id,
630	        workerId: worker.id,
631	        workerStatus: agent.state,
632	        source: "live_planning_sync",
633	      });
634	      continue;
635	    }
636	
637	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
638	      await updateDirectRunStatusFromWorkerOutput({
639	        runId: run.id,
640	        workerId: worker.id,
641	        workerStatus: nextWorkerStatus,
642	        renderedOutput: agent.renderedOutput,
643	        currentText: agent.currentText,
644	        lastText: agent.lastText,
645	        outputEntries: agent.outputEntries,
646	        pendingPermissions: agent.pendingPermissions,
647	        pendingElicitations: agent.pendingElicitations,
648	      });
649	    } else {
650	      await db.update(runs).set({
651	        status: nextRunState,
652	        lastError: nextRunState === "failed" ? agent.lastError || run.lastError : null,
653	        failedAt: nextRunState === "failed" ? run.failedAt : null,
654	        updatedAt: new Date(),
655	      }).where(eq(runs.id, run.id));
656	    }
657	    if (staleBusyFailure && nextRunState !== "failed") {
658	      await clearMatchingRunFailureMessage(run);
659	    }
660	    await drainQueuedWorkerMessagesWithObservation({
661	      runId: run.id,
662	      workerId: worker.id,
663	      workerStatus: nextWorkerStatus,
664	      source: "live_worker_sync",
665	      snapshot: agent,
666	    });
667	  }
668	
669	  for (const run of allRuns) {
670	    const staleBusyFailure = isAgentBusyRunFailure(run);
671	    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
672	      continue;
673	    }
674	
675	    const worker = selectConversationWorker(run.id, allWorkers);
676	    if (!worker || agents.some((agent) => agent.name === worker.id)) {
677	      continue;
678	    }
679	
680	    if (
681	      options.selectedRunId === run.id
682	      && isRecoverableMissingDirectWorkerStatus(worker.status)
683	    ) {
684	      const recoveryResult = await reconcileRunRecovery({
685	        runId: run.id,
686	        liveAgents: agents,
687	        source: "conversation-sync",
688	      });
689	      if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
690	        continue;
691	      }
692	    }
693	
694	    if (await isEmptyIdlePersistedWorker(worker)) {
695	      await db.update(workers).set({
696	        status: "error",
697	        outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
698	        updatedAt: new Date(),
699	      }).where(eq(workers.id, worker.id));
700	      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
701	        surface: { code: "worker.idle.missing_output", workerId: worker.id },
702	      });
703	      continue;
704	    }
705	
706	    const nextRunState = await resolvePersistedRunState(run, worker);
707	    if (run.mode === "planning") {
708	      if (refreshPlanningArtifacts) {
709	        await refreshPlanningArtifactsForRun({
710	          run,
711	          worker,
712	          status: nextRunState === "running" ? "working" : undefined,
713	        });
714	      }
715	      continue;
716	    }
717	
718	    if (nextRunState === run.status) {
719	      await drainQueuedWorkerMessagesWithObservation({
720	        runId: run.id,
721	        workerId: worker.id,
722	        workerStatus: worker.status,
723	        source: "persisted_state_unchanged",
724	      });
725	      continue;
726	    }
727	
728	    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
729	      await updateDirectRunStatusFromWorkerOutput({
730	        runId: run.id,
731	        workerId: worker.id,
732	        workerStatus: worker.status,
733	        outputLog: worker.outputLog,
734	        currentText: worker.currentText,
735	        lastText: worker.lastText,
736	        outputEntriesJson: worker.outputEntriesJson,
737	      });
738	      await drainQueuedWorkerMessagesWithObservation({
739	        runId: run.id,
740	        workerId: worker.id,
741	        workerStatus: worker.status,
742	        source: "persisted_direct_completion",
743	      });
744	    } else {
745	      await db.update(runs).set({
746	        status: nextRunState,
747	        updatedAt: new Date(),
748	      }).where(eq(runs.id, run.id));
749	    }
750	  }
751	}
752	

uuid: 30b461b5-a6fb-43f6-9560-15322d7d80dd
parent: c3b78e61-3305-4d97-8ffe-8bf579cc4c86
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:43:26.360Z","phase":null} -->
## Claude attachment · 2026-06-26T20:43:26.360Z

```text
{
  "type": "budget_usd",
  "used": 0.23587875000000003,
  "total": 1,
  "remaining": 0.76412125
}

binary omitted from archive

uuid: 35cd6cdd-b005-41f0-8d7c-e70aea5942ba
parent: 30b461b5-a6fb-43f6-9560-15322d7d80dd
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-26T20:44:24.323Z","phase":null} -->
## Claude thinking · 2026-06-26T20:44:24.323Z

I'm looking at a bug in session 279f067d7f7c where duplicate user text created two database message rows, with one failing due to a missing elicitation. The worker stream shows two user inputs with different sequence numbers—one from a direct elicitation answer and another from a queued worker drain—and I'm tracing through the sequence of events to understand how this state occurred.

The direct elicitation path creates a user message, appends it to the stream, inserts the database row, and consumes the pending elicitation by calling `respondElicitation`. Meanwhile, the queued drain path is also running and decides to drain because it sees a pending elicitation in the snapshot. Both paths try to answer the same elicitation, but only the first succeeds—the second one leaves behind a duplicate user input and message row, then fails with "no_pending_elicitations". This is a race condition where the snapshot captured by the sync showed a pending elicitation, but by the time the drain executes, that elicitation has already been consumed.

The real problem is that the drain path commits its database writes (the user input and message rows) before calling `answerPendingWorkerElicitation`, so even when the elicitation response fails, the duplicate rows are already persisted. The direct answer path runs under `runConversationMutation` (a per-run lock), while the drain runs under `runWorkerTurn` (a per-worker lock), so they're not properly serialized against each other. The sequence numbers confirm the direct answer (2282) came before the drain (2283), so the direct path won. The real issue is that the drain uses a stale snapshot from the sync's listAgents call, so it doesn't see that the worker is now in "working" status. Even if the elicitation response hadn't failed, we'd end up with two answers to the same elicitation — one from the direct path and one from the drain. The fundamental problem is that these two paths are protected by different locks (per-run vs per-worker), allowing them to interleave, and the drain commits the user message to the database before attempting the elicitation response, leaving an orphaned duplicate if the response fails. Now I'm trying to understand why there's both a queued message and a direct answer happening simultaneously. The core issue is that the drain path uses a stale snapshot captured at sync time rather than fetching a fresh one after acquiring the lock, so even if we serialize both paths through `runWorkerTurn`, the drain would still try to answer an already-consumed elicitation. A proper fix would have the drain capture a fresh snapshot inside the turn lock—if the elicitation is gone, it falls back to asking normally with the queued content as a follow-up turn, which is the intended behavior. But there's still the problem of duplicate user text being persisted regardless. So the issue is that a queued message (1b879) gets created while the worker is busy, then when the user sends a direct answer (14f539) to resolve the pending elicitation, the queue drains concurrently and tries to deliver the queued message to an elicitation that's already been consumed — it fails but leaves behind a persisted user message row anyway. That's the duplicate: both 14f539 and 1b879 appear as user inputs in the conversation even though 1b879's delivery failed. The core bug is that a failed queued delivery shouldn't leave orphaned user message rows in the conversation.

Now I need to verify the lock separation in worker-turn-gate and check how appendUserInputOnDelivery handles deduplication, since those are the key mechanisms that should prevent this.

uuid: bc2c2a59-af9b-4a6a-a5de-02eef0a3a6cb
parent: 35cd6cdd-b005-41f0-8d7c-e70aea5942ba

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-26T20:44:24.324Z","phase":null} -->
## Claude · 2026-06-26T20:44:24.324Z

Let me verify the locking model and the stream-writer idempotency, which are central to the race.

uuid: 0ff3ccff-fccc-401c-b373-99f72f1a2548
parent: bc2c2a59-af9b-4a6a-a5de-02eef0a3a6cb

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-26T20:44:24.346Z","phase":null} -->
## Claude tool call: Read · 2026-06-26T20:44:24.346Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/conversations/worker-turn-gate.ts"
}

uuid: fff3bf5d-f408-4c0f-911c-06802e993656
parent: 0ff3ccff-fccc-401c-b373-99f72f1a2548
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-26T20:44:24.351Z","phase":null} -->
## Claude tool call: Read · 2026-06-26T20:44:24.351Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/workers/stream-writer.ts"
}

uuid: d1284320-a31f-46b3-828d-26d668292fc9
parent: fff3bf5d-f408-4c0f-911c-06802e993656
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-26T20:44:24.359Z","phase":null} -->
## Claude tool result: toolu_01D4ihkRwVqVS7HKef2JrJd4 · 2026-06-26T20:44:24.359Z

```text
1	import { eq, sql } from "drizzle-orm";
2	import { db } from "@/server/db";
3	import { workers } from "@/server/db/schema";
4	
5	const workerTurnChains = new Map<string, Promise<void>>();
6	const conversationMutationChains = new Map<string, Promise<void>>();
7	const backgroundTasks = new Set<Promise<void>>();
8	
9	function runOnChain<T>(
10	  chains: Map<string, Promise<void>>,
11	  key: string,
12	  task: () => Promise<T>,
13	): Promise<T> {
14	  const previous = chains.get(key) ?? Promise.resolve();
15	  const next = previous.then(() => task());
16	  const tracked = next.then(() => undefined, () => undefined);
17	  chains.set(key, tracked);
18	  return next.finally(() => {
19	    if (chains.get(key) === tracked) {
20	      chains.delete(key);
21	    }
22	  });
23	}
24	
25	export function runWorkerTurn<T>(workerId: string, task: () => Promise<T>): Promise<T> {
26	  return runOnChain(workerTurnChains, workerId, task);
27	}
28	
29	/**
30	 * Read the worker's current turn fence value. Returns 0 when the worker
31	 * row is missing (treated as the default generation).
32	 */
33	export async function readWorkerTurnGeneration(workerId: string): Promise<number> {
34	  const record = await db
35	    .select({ turnGeneration: workers.turnGeneration })
36	    .from(workers)
37	    .where(eq(workers.id, workerId))
38	    .get();
39	  return record?.turnGeneration ?? 0;
40	}
41	
42	/**
43	 * Atomically advance the worker turn fence and (optionally) reset persisted
44	 * worker state into a delivery-safe shape in the SAME mutation, so an
45	 * immediate queued delivery cannot observe stale `working` state after a
46	 * successful cancel. Returns the new generation value.
47	 *
48	 * Callers capture the returned generation for the new delivery; any older
49	 * in-flight completion that captured a smaller value must refuse to persist
50	 * terminal updates (see `isWorkerTurnGenerationCurrent`).
51	 */
52	export async function advanceWorkerTurnGeneration(
53	  workerId: string,
54	  reset?: { status?: string; clearCurrentText?: boolean; updatedAt?: Date },
55	): Promise<number> {
56	  await db.update(workers).set({
57	    turnGeneration: sql`${workers.turnGeneration} + 1`,
58	    ...(reset?.status !== undefined ? { status: reset.status } : {}),
59	    ...(reset?.clearCurrentText ? { currentText: "" } : {}),
60	    ...(reset?.updatedAt ? { updatedAt: reset.updatedAt } : {}),
61	  }).where(eq(workers.id, workerId));
62	  return readWorkerTurnGeneration(workerId);
63	}
64	
65	/**
66	 * True when `capturedGeneration` still matches the worker's persisted fence,
67	 * i.e. no newer interrupt delivery has superseded the captured turn. A missing
68	 * worker row reports `false` so stale callers stop persisting.
69	 */
70	export async function isWorkerTurnGenerationCurrent(
71	  workerId: string,
72	  capturedGeneration: number,
73	): Promise<boolean> {
74	  const record = await db
75	    .select({ turnGeneration: workers.turnGeneration })
76	    .from(workers)
77	    .where(eq(workers.id, workerId))
78	    .get();
79	  if (!record) {
80	    return false;
81	  }
82	  return record.turnGeneration === capturedGeneration;
83	}
84	
85	export function runConversationMutation<T>(runId: string, task: () => Promise<T>): Promise<T> {
86	  return runOnChain(conversationMutationChains, runId, task);
87	}
88	
89	export function trackConversationBackgroundTask<T>(task: Promise<T>): Promise<T> {
90	  const tracked = task.then(() => undefined, () => undefined);
91	  backgroundTasks.add(tracked);
92	  void tracked.finally(() => {
93	    backgroundTasks.delete(tracked);
94	  });
95	  return task;
96	}
97	
98	export async function waitForConversationBackgroundTasksForTests(timeoutMs = 1_000): Promise<void> {
99	  const deadline = Date.now() + timeoutMs;
100	  while (backgroundTasks.size > 0) {
101	    const remaining = deadline - Date.now();
102	    if (remaining <= 0) {
103	      throw new Error(`Timed out waiting for ${backgroundTasks.size} conversation background task(s)`);
104	    }
105	    await Promise.race([
106	      Promise.all(Array.from(backgroundTasks)),
107	      new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 25))),
108	    ]);
109	  }
110	}
111	
112	export function __resetWorkerTurnChainsForTests() {
113	  workerTurnChains.clear();
114	  conversationMutationChains.clear();
115	  backgroundTasks.clear();
116	}
117	

uuid: fda3d221-0d6c-4bde-aa65-27deeee06afa
parent: fff3bf5d-f408-4c0f-911c-06802e993656
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-26T20:44:24.360Z","phase":null} -->
## Claude tool result: toolu_01G8VjDckcyGJcCoRMFwf18u · 2026-06-26T20:44:24.360Z

```text
1	/**
2	 * Thin helpers around `appendWorkerEntry` for the unified worker
3	 * conversation stream. Each helper:
4	 *
5	 *   1. Builds a `WorkerEntry` of the appropriate type with a generated
6	 *      uuid (server-produced entries don't have a stable upstream id).
7	 *   2. Appends via `appendWorkerEntry` (which assigns the seq and holds
8	 *      the per-worker chain).
9	 *   3. After fsync, emits a `worker.entry_appended` named event carrying
10	 *      only `{ workerId, seq }`. The full entry is fetched via the
11	 *      entries endpoint — the SSE frame is a wake-up hint, not a content
12	 *      carrier.
13	 *
14	 * Append-on-delivery semantics: ordinary follow-up callers MUST invoke
15	 * these only after `askAgent` (or the equivalent delivery primitive)
16	 * has resolved successfully. Initial direct/planning prompts are the
17	 * exception: the conversation has already accepted the message, and the
18	 * prompt must anchor the worker stream before bridge progress snapshots
19	 * can append output while the first ask is still in flight.
20	 */
21	import { randomUUID } from "node:crypto";
22	import { emitNamedEvent } from "@/server/events/named-events";
23	import { appendWorkerEntryWithResult } from "@/server/workers/output-store";
24	import type {
25	  WorkerEntry,
26	  WorkerEntryAttachment,
27	  WorkerEntryAuthorRole,
28	  WorkerEntryChannel,
29	} from "@/server/workers/entries-types";
30	
31	export type AppendUserInputArgs = {
32	  runId: string;
33	  workerId: string;
34	  text: string;
35	  deliveredAt: Date;
36	  authorRole?: WorkerEntryAuthorRole;
37	  attachments?: WorkerEntryAttachment[];
38	  /** Optional stable id (e.g. from a messages row) so dedup across recovery works. */
39	  id?: string;
40	};
41	
42	export type AppendSupervisorInputArgs = {
43	  runId: string;
44	  workerId: string;
45	  text: string;
46	  deliveredAt: Date;
47	  id?: string;
48	};
49	
50	export type AppendLifecycleArgs = {
51	  runId: string;
52	  workerId: string;
53	  text: string;
54	  raw?: unknown;
55	  timestamp?: Date;
56	};
57	
58	export type AppendSystemNoteArgs = {
59	  runId: string;
60	  workerId: string;
61	  text: string;
62	  raw?: unknown;
63	};
64	
65	export type AppendSessionInputArgs = AppendUserInputArgs & {
66	  channel?: WorkerEntryChannel;
67	};
68	
69	export type AppendProcessOutputArgs = {
70	  runId: string;
71	  workerId: string;
72	  text: string;
73	  channel: Extract<WorkerEntryChannel, "stdout" | "stderr">;
74	  timestamp?: Date;
75	};
76	
77	export type AppendAssistantMessageArgs = {
78	  runId: string;
79	  workerId: string;
80	  text: string;
81	  timestamp?: Date;
82	  raw?: unknown;
83	};
84	
85	export type AppendSessionLifecycleArgs = AppendLifecycleArgs & {
86	  channel?: WorkerEntryChannel;
87	};
88	
89	function persistAndAnnounce(args: {
90	  runId: string;
91	  workerId: string;
92	  entry: Omit<WorkerEntry, "seq">;
93	}): Promise<WorkerEntry | null> {
94	  return appendWorkerEntryWithResult(args.runId, args.workerId, args.entry).then((result) => {
95	    const persisted = result.entry;
96	    if (!result.appended || typeof persisted.seq !== "number" || persisted.seq <= 0) {
97	      return persisted;
98	    }
99	    emitNamedEvent({
100	      kind: "worker.entry_appended",
101	      runId: args.runId,
102	      workerId: args.workerId,
103	      seq: persisted.seq,
104	    });
105	    return persisted;
106	  });
107	}
108	
109	export async function appendUserInputOnDelivery(args: AppendUserInputArgs): Promise<WorkerEntry | null> {
110	  return persistAndAnnounce({
111	    runId: args.runId,
112	    workerId: args.workerId,
113	    entry: {
114	      id: args.id ?? randomUUID(),
115	      type: "user_input",
116	      text: args.text,
117	      timestamp: args.deliveredAt.toISOString(),
118	      authorRole: args.authorRole ?? "user",
119	      channel: "stdin",
120	      attachments: args.attachments,
121	    },
122	  });
123	}
124	
125	export async function appendSessionInputEntry(args: AppendSessionInputArgs): Promise<WorkerEntry | null> {
126	  return persistAndAnnounce({
127	    runId: args.runId,
128	    workerId: args.workerId,
129	    entry: {
130	      id: args.id ?? randomUUID(),
131	      type: "user_input",
132	      text: args.text,
133	      timestamp: args.deliveredAt.toISOString(),
134	      authorRole: args.authorRole ?? "user",
135	      channel: args.channel ?? "stdin",
136	      attachments: args.attachments,
137	    },
138	  });
139	}
140	
141	export async function appendProcessOutputEntry(args: AppendProcessOutputArgs): Promise<void> {
142	  await persistAndAnnounce({
143	    runId: args.runId,
144	    workerId: args.workerId,
145	    entry: {
146	      id: randomUUID(),
147	      type: "message",
148	      text: args.text,
149	      timestamp: (args.timestamp ?? new Date()).toISOString(),
150	      authorRole: "system",
151	      channel: args.channel,
152	      raw: { source: "process", channel: args.channel },
153	    },
154	  });
155	}
156	
157	export async function appendAssistantMessageEntry(args: AppendAssistantMessageArgs): Promise<void> {
158	  const text = args.text.trim();
159	  if (!text) {
160	    return;
161	  }
162	  await persistAndAnnounce({
163	    runId: args.runId,
164	    workerId: args.workerId,
165	    entry: {
166	      id: randomUUID(),
167	      type: "message",
168	      text,
169	      timestamp: (args.timestamp ?? new Date()).toISOString(),
170	      authorRole: "assistant",
171	      channel: "agent",
172	      raw: args.raw,
173	    },
174	  });
175	}
176	
177	export async function appendSupervisorInputOnDelivery(args: AppendSupervisorInputArgs): Promise<void> {
178	  await persistAndAnnounce({
179	    runId: args.runId,
180	    workerId: args.workerId,
181	    entry: {
182	      id: args.id ?? randomUUID(),
183	      type: "supervisor_input",
184	      text: args.text,
185	      timestamp: args.deliveredAt.toISOString(),
186	      authorRole: "supervisor",
187	    },
188	  });
189	}
190	
191	export async function appendLifecycleEntry(args: AppendLifecycleArgs): Promise<void> {
192	  await persistAndAnnounce({
193	    runId: args.runId,
194	    workerId: args.workerId,
195	    entry: {
196	      id: randomUUID(),
197	      type: "lifecycle",
198	      text: args.text,
199	      timestamp: (args.timestamp ?? new Date()).toISOString(),
200	      authorRole: "system",
201	      channel: "system",
202	      raw: args.raw,
203	    },
204	  });
205	}
206	
207	export async function appendSessionLifecycleEntry(args: AppendSessionLifecycleArgs): Promise<void> {
208	  await persistAndAnnounce({
209	    runId: args.runId,
210	    workerId: args.workerId,
211	    entry: {
212	      id: randomUUID(),
213	      type: "lifecycle",
214	      text: args.text,
215	      timestamp: (args.timestamp ?? new Date()).toISOString(),
216	      authorRole: "system",
217	      channel: args.channel ?? "system",
218	      raw: args.raw,
219	    },
220	  });
221	}
222	
223	export async function appendSystemNote(args: AppendSystemNoteArgs): Promise<void> {
224	  await persistAndAnnounce({
225	    runId: args.runId,
226	    workerId: args.workerId,
227	    entry: {
228	      id: randomUUID(),
229	      type: "system_note",
230	      text: args.text,
231	      timestamp: new Date().toISOString(),
232	      authorRole: "system",
233	      channel: "system",
234	      raw: args.raw,
235	    },
236	  });
237	}
238	

uuid: c5547e3b-8a70-482a-a577-b4af07e7b6c2
parent: d1284320-a31f-46b3-828d-26d668292fc9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-26T20:44:24.395Z","phase":null} -->
## Claude attachment · 2026-06-26T20:44:24.395Z

```text
{
  "type": "budget_usd",
  "used": 0.7586550000000001,
  "total": 1,
  "remaining": 0.24134499999999992
}

binary omitted from archive

uuid: 6b000c9f-5412-490c-b771-97fac114b36d
parent: c5547e3b-8a70-482a-a577-b4af07e7b6c2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-26T20:45:14.585Z","phase":null} -->
## Claude thinking · 2026-06-26T20:45:14.585Z

I'm confirming the root cause involves two separate lock chains: `answerDirectWorkerElicitation` executes within `runConversationMutation` without acquiring the worker turn lock, while `drainQueuedWorkerMessages` acquires `runWorkerTurn` for each message delivery, creating a deadlock between these different synchronization paths.

The sequence shows the direct answer consumed the elicitation first, but the drain's stale snapshot still sees it as pending, so it attempts to respond and fails. The critical issue is that the drain persists the user input and message rows before calling `answerPendingWorkerElicitation`, so when the response fails, those duplicate rows remain orphaned in the database—the error handler only deletes them in specific cases like agent busy errors, not for the elicitation failure.

The minimal fix would be to have the direct answer path acquire the same per-worker turn lock that the drain uses, serializing them. But that alone doesn't solve the stale snapshot problem—the drain would still see a pending elicitation in its stale view. So we'd also need the drain to re-validate against a fresh snapshot captured inside the lock and handle the "no_pending_elicitations" error gracefully. If properly serialized and fresh-snapshotted, after the direct answer consumes the elicitation and marks the worker as busy, the drain would then see the worker is busy and defer the queued message appropriately.

The real issue is that the stale snapshot bypasses this: it tries to answer an already-consumed elicitation, which fails hard rather than deferring. The most surgical fix combines serializing the direct answer under the worker turn lock with ensuring the messages row persists only after successful delivery—so a failed delivery never leaves an orphan duplicate message in the table. I should also make `respondElicitation` idempotent so it treats a missing pending elicitation as a benign success rather than an error, since that's the exact race condition we're trying to handle gracefully.

For testing, I need to cover the concurrent race directly — spinning up a worker with a pending elicitation and queued message, then firing `answerDirectWorkerElicitation` and `drainQueuedWorkerMessages` at the same time to verify we end up with exactly one user message and no orphaned duplicates. I also want a unit test ensuring the drain doesn't persist a duplicate messages row when it encounters a stale snapshot of an elicitation that's already been answered, and another test confirming that failed queued deliveries clean up their messages row properly. The test file mentioned in the prompt isn't relevant here, so I'll skip that. Now I need to verify whether the sync drain is actually passing a stale snapshot to the drain function.

Looking at the sync code, it's calling `drainQueuedWorkerMessagesWithObservation` with the agent snapshot, which then passes it down to `drainQueuedWorkerMessages`, and the drain uses that snapshot if provided. So yes, stale snapshots are definitely being used. The drain becomes drainable when either there's a pending elicitation or the worker status is in a drainable state, and with a stale snapshot showing a pending elicitation, it will attempt the drain. Both the direct answer and the sync drain can run concurrently since they're separate code paths — the drain launches from the background sync while the direct answer comes through an HTTP request.

The interrupt path in queued-message-interrupt.ts uses generation fencing and staleness checks to prevent stale writes, but `answerDirectWorkerElicitation` and `runWorkerTurn` don't participate in that turn generation fence at all. So the direct elicitation path is the unfenced outlier — it bypasses both the worker turn lock and the generation fence that every other delivery mechanism respects. That's the core gap.

uuid: 8057fe57-ef44-4194-b024-ef68cda1b9bd
parent: 6b000c9f-5412-490c-b771-97fac114b36d

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-26T20:45:35.433Z","phase":null} -->
## Claude · 2026-06-26T20:45:35.433Z

I have what I need. Here's my read-only assessment.

## Root cause

The pending-elicitation answer is written by **two independently-locked code paths that don't exclude each other**, and the queue path commits its user-message rows *before* it discovers the elicitation is already gone.

**The two writers, on different locks:**

- **Direct answer** — `answerDirectWorkerElicitation` (`send-message.ts:129`) runs inside `sendConversationMessageUnlocked`, which is wrapped only in `runConversationMutation(runId)` (`worker-turn-gate.ts:85`, keyed by **runId**). It does *not* take `runWorkerTurn(worker.id)` and does *not* touch the turn-generation fence.
- **Queue drain** — `drainQueuedWorkerMessages` (`queued-messages.ts:1028`) runs inside `runWorkerTurn(workerId)` (keyed by **workerId**).

`conversationMutationChains` and `workerTurnChains` are separate maps, so these two run **concurrently** on the same worker.

**The race that produced your trace (seq 2282 then 2283):**

1. Worker is `awaiting_user` with one live elicitation `E`; queued message `1b879` is pending.
2. A live sync (`sync.ts:660`) sees a snapshot where `E` is still pending, calls `drainQueuedWorkerMessagesWithObservation({…, snapshot: agent})`. `hasPendingElicitationSignal` ⇒ drainable. The stale `agent` snapshot is threaded all the way down to the drain.
3. The direct send wins the foot-race: `answerDirectWorkerElicitation` appends `user_input` 14f539 (seq 2282), inserts messages `14f539`, calls `respondElicitation(accept)` → **consumes `E`**, sets worker `working`.
4. The drain (inside `runWorkerTurn`) proceeds. At `queued-messages.ts:1090` it takes `snapshotBeforeAsk = snapshot ?? getAgent(...)` — and `snapshot` is the **stale sync snapshot still showing `E`**. It then appends `user_input` 1b879 (seq 2283) and inserts messages `1b879` (`:1092`–`:1105`) **before** calling `answerPendingWorkerElicitation` (`:1106`).
5. `respondElicitation` now rejects: `no_pending_elicitations`. The catch (`:1148`) marks `1b879` `failed` — but only deletes the messages row on a *busy* error (`:1176`). So the duplicate `1b879` user message (DB row + stream entry seq 2283) **persists even though its delivery failed**.

So both defects compound: (a) two unsynchronized writers both treat the same `awaiting_user` moment as deliverable, and (b) the drain anchors its user rows before validating the elicitation against a *stale* snapshot, leaving an orphan on failure.

Worth noting: the interrupt path (`queued-message-interrupt.ts`) is careful here — it uses `advanceWorkerTurnGeneration` + `isStillCurrent()` fencing on every terminal write. The **direct elicitation-answer fast path is the outlier that bypasses both the worker-turn lock and the generation fence** every other delivery respects.

## Minimal durable fix focus

1. **Single writer per worker for elicitation answers.** Route `answerDirectWorkerElicitation` through `runWorkerTurn(worker.id)` (and ideally capture/check the turn generation), so the direct answer and the drain/interrupt are mutually exclusive on that worker. This closes the concurrent-interleave window.

2. **Validate liveness inside the lock, from a fresh snapshot.** In `drainQueuedWorkerMessages`, don't trust the passed-in sync `snapshot` for the `respondElicitation` decision — re-read `getAgent` *after* acquiring the turn. If no live elicitation remains, fall through to a normal `askAgent` (which will correctly hit "agent is busy" and **defer**, keeping `1b879` pending) instead of calling `respondElicitation` against a consumed request.

3. **Make `respondElicitation` race-tolerant.** Treat `no_pending_elicitations` as a benign "already answered" no-op rather than a hard failure — that's the expected outcome of this race, not an error.

4. **Persist user rows only on successful delivery.** A queued elicitation delivery should append the `user_input` entry + insert the `messages` row only after the answer/ask is accepted, or roll both back on *any* non-busy failure (not just busy at `:1176`). A failed/redundant delivery must never leave an orphan duplicate user message.

(1)+(2) prevent the race; (3)+(4) make it self-healing if it ever recurs.

## Test focus

- **Concurrency regression:** worker `awaiting_user`, one live elicitation, one pending queued message → run `answerDirectWorkerElicitation` and `drainQueuedWorkerMessages` back-to-back (drain handed a *stale* snapshot showing the elicitation). Assert exactly one delivered user turn, the queued row ends `delivered`-or-`pending` (deferred), **never `failed: no_pending_elicitations`**, and there is no orphan `messages`/`user_input` duplicate.
- **Stale-snapshot unit test:** `drainQueuedWorkerMessages` given a snapshot claiming a pending elicitation that no longer exists live does not call a failing `respondElicitation`, does not persist a duplicate `messages` row, and defers cleanly.
- **Idempotency:** `respondElicitation` returning/raising `no_pending_elicitations` is handled as a no-op, with cleanup of any pre-written user rows.

I did not edit any files.

uuid: 9fd9dadc-683b-48c1-a20b-30558f3938e2
parent: 8057fe57-ef44-4194-b024-ef68cda1b9bd

<!-- /codex-event -->

---
provider: "claude"
codex_thread_id: "7c42adca-447a-4808-92c5-c5b48aea2950"
title: "Debug claude worker availability detection"
started_at: "2026-06-28T21:31:59.317Z"
updated_at: "2026-06-28T21:33:51.479Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Debug claude worker availability detection

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-28T21:31:59.317Z","phase":null} -->
## Claude state: queue-operation · 2026-06-28T21:31:59.317Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-06-28T21:31:59.317Z",
  "sessionId": "7c42adca-447a-4808-92c5-c5b48aea2950",
  "content": "In /Users/masterman/NLP/omniharness, investigate why supervisor worker availability says claude worker binary is not installed even though direct Claude control sessions work. Read-only. Focus on src/server/supervisor/worker-availability.ts and src/server/agent-runtime/manager.ts. What root cause and fix do you recommend?"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-28T21:31:59.317Z","phase":null} -->
## Claude state: queue-operation · 2026-06-28T21:31:59.317Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-06-28T21:31:59.317Z",
  "sessionId": "7c42adca-447a-4808-92c5-c5b48aea2950"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-28T21:31:59.364Z","phase":null} -->
## User · 2026-06-28T21:31:59.364Z

In /Users/masterman/NLP/omniharness, investigate why supervisor worker availability says claude worker binary is not installed even though direct Claude control sessions work. Read-only. Focus on src/server/supervisor/worker-availability.ts and src/server/agent-runtime/manager.ts. What root cause and fix do you recommend?

uuid: 3cfbd316-c3cd-461c-b2b8-47b27de2f4fa

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-28T21:31:59.364Z","phase":null} -->
## Claude attachment · 2026-06-28T21:31:59.364Z

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

uuid: 4c3a8ecc-5331-47f4-b684-beec6d89658e
parent: 3cfbd316-c3cd-461c-b2b8-47b27de2f4fa
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-28T21:31:59.364Z","phase":null} -->
## Claude attachment · 2026-06-28T21:31:59.364Z

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

uuid: 66886b07-b27c-4f6e-a1af-d9422da8044f
parent: 4c3a8ecc-5331-47f4-b684-beec6d89658e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-28T21:32:04.800Z","phase":null} -->
## Claude thinking · 2026-06-28T21:32:04.800Z

I need to read through the two files mentioned to trace the root cause of this issue. Let me start by examining them directly, though I notice there's a potential skill trigger related to Claude/Anthropic in CLAUDE.md that might be relevant, but the actual problem seems to be about worker binary availability rather than the Claude API itself.

uuid: 2ff8ffa2-adef-4d8c-aec2-d96faa5f07c7
parent: 66886b07-b27c-4f6e-a1af-d9422da8044f

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-28T21:32:04.931Z","phase":null} -->
## Claude · 2026-06-28T21:32:04.931Z

I'll investigate the two files and trace how worker availability is determined versus how direct Claude control sessions launch.

uuid: 40687998-156a-4b2a-9990-a4fa5551f90b
parent: 2ff8ffa2-adef-4d8c-aec2-d96faa5f07c7

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:05.884Z","phase":null} -->
## Claude tool call: Read · 2026-06-28T21:32:05.884Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/supervisor/worker-availability.ts"
}

uuid: 109feb02-2d51-4bb6-8b07-2f41a7961c31
parent: 40687998-156a-4b2a-9990-a4fa5551f90b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:05.889Z","phase":null} -->
## Claude tool result: toolu_01AztNHBjvqxVfXYcSr75sQ8 · 2026-06-28T21:32:05.889Z

```text
1	import { execFileSync } from "child_process";
2	import { existsSync } from "fs";
3	import { homedir } from "os";
4	import { dirname, join } from "path";
5	import { withManagedPath } from "@/server/agent-runtime/tool-env";
6	import { isCredentialProfileConfigured } from "@/server/agent-runtime/external-credentials";
7	import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType, normalizeWorkerType } from "./worker-types";
8	
9	type EnvLike = Record<string, string | undefined>;
10	export type WorkerCommandRunner = typeof execFileSync;
11	export type WorkerCommandResolver = (command: string, env: EnvLike) => string | null;
12	
13	const WORKER_BINARY_COMMANDS: Record<SupportedWorkerType, string> = {
14	  codex: "codex-acp",
15	  claude: "claude-agent-acp",
16	  gemini: "gemini",
17	  opencode: "opencode",
18	};
19	
20	export type WorkerAuthenticationStatus = "authenticated" | "not_authenticated" | "unknown" | "not_applicable";
21	export type WorkerAuthenticationMethod = "api_key" | "session_file" | "status_command" | "credential_profile" | "missing" | "unknown" | "not_applicable";
22	export type WorkerAuthenticationInfo = {
23	  status: WorkerAuthenticationStatus;
24	  method: WorkerAuthenticationMethod;
25	  message: string;
26	  setupCommand: string | null;
27	};
28	export type WorkerTokenQuotaStatus = "reported" | "usage_only" | "unavailable" | "unknown";
29	export type WorkerTokenQuotaInfo = {
30	  status: WorkerTokenQuotaStatus;
31	  source: string;
32	  message: string;
33	  remainingTokens: number | null;
34	  monthlyLimitTokens: number | null;
35	  usedTokens: number | null;
36	  resetAt: string | null;
37	};
38	
39	type WorkerAuthenticationDetectionOptions = {
40	  env?: EnvLike;
41	  homeDir?: string;
42	  fileExists?: (filePath: string) => boolean;
43	  commandRunner?: WorkerCommandRunner;
44	  platform?: NodeJS.Platform;
45	};
46	
47	function claudeKeychainCredentialsExist(env: EnvLike) {
48	  // Always use the real execFileSync here: the keychain lookup is a fast
49	  // native OS call, not a CLI agent probe, so it is safe even when a caller
50	  // (such as the frontend catalog route) injects a runner that refuses to
51	  // execute slower CLI probes.
52	  try {
53	    execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials"], {
54	      encoding: "utf8",
55	      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
56	      timeout: 1_500,
57	      maxBuffer: 64 * 1024,
58	      stdio: ["ignore", "pipe", "pipe"],
59	    });
60	    return true;
61	  } catch {
62	    return false;
63	  }
64	}
65	
66	type WorkerDetectionOptions = {
67	  env?: EnvLike;
68	  commandResolver?: WorkerCommandResolver;
69	};
70	
71	function resolveCommandPath(command: string, env: EnvLike = process.env, commandResolver?: WorkerCommandResolver) {
72	  if (commandResolver) {
73	    return commandResolver(command, env);
74	  }
75	
76	  try {
77	    return String(execFileSync("which", [command], {
78	      encoding: "utf8",
79	      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
80	      timeout: 1_500,
81	      maxBuffer: 64 * 1024,
82	    })).trim() || null;
83	  } catch {
84	    return null;
85	  }
86	}
87	
88	function workerBinaryAvailable(type: SupportedWorkerType, env: EnvLike = process.env, commandResolver?: WorkerCommandResolver) {
89	  return resolveCommandPath(WORKER_BINARY_COMMANDS[type], env, commandResolver) !== null;
90	}
91	
92	function workerHasApiKey(type: SupportedWorkerType) {
93	  switch (type) {
94	    case "codex":
95	      // Codex can use credentials established via `codex --login`, so
96	      // OmniHarness should not require a duplicate OPENAI_API_KEY.
97	      return true;
98	    case "claude":
99	      // Claude Code may already be authenticated locally, so avoid
100	      // blocking worker startup on duplicated env vars.
101	      return true;
102	    case "gemini":
103	      // Gemini CLI may already be authenticated locally, so avoid
104	      // blocking worker startup on duplicated env vars.
105	      return true;
106	    case "opencode":
107	      return true;
108	  }
109	}
110	
111	function hasEnvValue(env: EnvLike, keys: string[]) {
112	  return keys.some((key) => Boolean(env[key]?.trim()));
113	}
114	
115	function anyFileExists(paths: string[], fileExists: (filePath: string) => boolean) {
116	  return paths.some((filePath) => {
117	    try {
118	      return fileExists(filePath);
119	    } catch {
120	      return false;
121	    }
122	  });
123	}
124	
125	function runAuthStatusCommand(commandRunner: WorkerCommandRunner, command: string, args: string[], env: EnvLike) {
126	  try {
127	    return String(commandRunner(command, args, {
128	      encoding: "utf8",
129	      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
130	      timeout: 1_500,
131	      maxBuffer: 64 * 1024,
132	      stdio: ["ignore", "pipe", "pipe"],
133	    })).trim();
134	  } catch {
135	    return null;
136	  }
137	}
138	
139	function parseTokenCount(value: string | undefined) {
140	  if (!value) {
141	    return null;
142	  }
143	
144	  const normalized = value.replace(/,/g, "").trim();
145	  const parsed = Number(normalized);
146	  return Number.isFinite(parsed) ? parsed : null;
147	}
148	
149	function firstNumberAfter(pattern: RegExp, output: string) {
150	  const match = output.match(pattern);
151	  return parseTokenCount(match?.[1]);
152	}
153	
154	function sumNamedTokenRows(output: string) {
155	  const rowNames = ["Input", "Output", "Cache Read", "Cache Write"];
156	  let total = 0;
157	  let found = false;
158	
159	  for (const name of rowNames) {
160	    const escapedName = name.replace(/\s+/g, "\\s+");
161	    const value = firstNumberAfter(new RegExp(`^\\s*${escapedName}\\s+([\\d,]+)\\s*$`, "im"), output);
162	    if (value !== null) {
163	      total += value;
164	      found = true;
165	    }
166	  }
167	
168	  return found ? total : null;
169	}
170	
171	export function parseWorkerTokenQuotaOutput(output: string | null | undefined, source: string): WorkerTokenQuotaInfo {
172	  const text = output?.replace(/\u001b\[[0-9;]*m/g, "").trim() ?? "";
173	  const remainingTokens =
174	    firstNumberAfter(/\b(?:remaining|left|available)\b[^\d]{0,60}([\d,]+)\s*(?:tokens?)?/i, text)
175	    ?? firstNumberAfter(/([\d,]+)\s*(?:tokens?)?\s*(?:remaining|left|available)\b/i, text);
176	  const monthlyLimitTokens =
177	    firstNumberAfter(/\b(?:of|out of|limit|monthly limit)\b[^\d]{0,40}([\d,]+)\s*(?:tokens?)?/i, text)
178	    ?? firstNumberAfter(/\bmonthly\b[^\n\d]{0,80}([\d,]+)\s*(?:tokens?)?\s*(?:limit|quota)/i, text);
179	  const resetMatch = text.match(/\b(?:reset|resets|renews)\b[^\n]{0,40}\b(\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?)\b/i);
180	  const usedTokens =
181	    firstNumberAfter(/\b(?:used|usage|consumed)\b[^\d]{0,60}([\d,]+)\s*(?:tokens?)?/i, text)
182	    ?? sumNamedTokenRows(text);
183	
184	  if (remainingTokens !== null) {
185	    return {
186	      status: "reported",
187	      source,
188	      message: "Monthly token quota reported by CLI.",
189	      remainingTokens,
190	      monthlyLimitTokens,
191	      usedTokens,
192	      resetAt: resetMatch?.[1] ?? null,
193	    };
194	  }
195	
196	  if (usedTokens !== null) {
197	    return {
198	      status: "usage_only",
199	      source,
200	      message: "CLI reports token usage, but not remaining monthly quota.",
201	      remainingTokens: null,
202	      monthlyLimitTokens,
203	      usedTokens,
204	      resetAt: resetMatch?.[1] ?? null,
205	    };
206	  }
207	
208	  return {
209	    status: "unknown",
210	    source,
211	    message: text ? "CLI output did not include monthly token quota." : "Monthly token quota is not reported by this CLI.",
212	    remainingTokens: null,
213	    monthlyLimitTokens: null,
214	    usedTokens: null,
215	    resetAt: null,
216	  };
217	}
218	
219	function runQuotaCommand(commandRunner: WorkerCommandRunner, command: string, args: string[], env: EnvLike) {
220	  try {
221	    return String(commandRunner(command, args, {
222	      encoding: "utf8",
223	      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
224	      timeout: 2_500,
225	      maxBuffer: 256 * 1024,
226	      stdio: ["ignore", "pipe", "pipe"],
227	    }));
228	  } catch {
229	    return null;
230	  }
231	}
232	
233	export function getWorkerTokenQuotaInfo(type: string, options: { commandRunner?: WorkerCommandRunner; env?: EnvLike } = {}): WorkerTokenQuotaInfo {
234	  const normalized = normalizeWorkerType(type);
235	  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
236	    ? normalized as SupportedWorkerType
237	    : null;
238	  const commandRunner = options.commandRunner ?? execFileSync;
239	  const env = options.env ?? process.env;
240	
241	  if (!supportedType) {
242	    return {
243	      status: "unavailable",
244	      source: "unsupported worker",
245	      message: `Unsupported worker type "${type}".`,
246	      remainingTokens: null,
247	      monthlyLimitTokens: null,
248	      usedTokens: null,
249	      resetAt: null,
250	    };
251	  }
252	
253	  if (supportedType === "opencode") {
254	    return parseWorkerTokenQuotaOutput(
255	      runQuotaCommand(commandRunner, "opencode", ["stats", "--days", "31"], env),
256	      "opencode stats --days 31",
257	    );
258	  }
259	
260	  if (supportedType === "claude") {
261	    return parseWorkerTokenQuotaOutput(
262	      runQuotaCommand(commandRunner, "claude", ["auth", "status"], env),
263	      "claude auth status",
264	    );
265	  }
266	
267	  if (supportedType === "codex") {
268	    return parseWorkerTokenQuotaOutput(
269	      runQuotaCommand(commandRunner, "codex", ["login", "status"], env),
270	      "codex login status",
271	    );
272	  }
273	
274	  return {
275	    status: "unknown",
276	    source: `${supportedType} CLI`,
277	    message: "Monthly token quota is not reported by this CLI.",
278	    remainingTokens: null,
279	    monthlyLimitTokens: null,
280	    usedTokens: null,
281	    resetAt: null,
282	  };
283	}
284	
285	function parseClaudeAuthStatus(output: string | null) {
286	  if (!output) {
287	    return false;
288	  }
289	  try {
290	    const parsed = JSON.parse(output) as { loggedIn?: unknown };
291	    return parsed.loggedIn === true;
292	  } catch {
293	    return /\blogged\s*in\b/i.test(output) && !/\bnot\s+logged\s*in\b/i.test(output);
294	  }
295	}
296	
297	export function getWorkerAuthenticationInfo(type: string, options: WorkerAuthenticationDetectionOptions = {}): WorkerAuthenticationInfo {
298	  const normalized = normalizeWorkerType(type);
299	  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
300	    ? normalized as SupportedWorkerType
301	    : null;
302	  const env = options.env ?? process.env;
303	  const homeDir = options.homeDir ?? env.HOME ?? homedir();
304	  const fileExists = options.fileExists ?? existsSync;
305	  const commandRunner = options.commandRunner ?? execFileSync;
306	  const platform = options.platform ?? process.platform;
307	
308	  if (!supportedType) {
309	    return {
310	      status: "not_applicable",
311	      method: "not_applicable",
312	      message: `Unsupported worker type "${type}".`,
313	      setupCommand: null,
314	    };
315	  }
316	
317	  // A configured custom credential profile (provider script or named profile)
318	  // supplies this agent's credentials at spawn time, so the user does not need
319	  // to log in interactively. Treat it as authenticated regardless of CLI login
320	  // state — this is the authoritative, explicit configuration.
321	  if (isCredentialProfileConfigured({ type: supportedType, env, fileExists })) {
322	    return {
323	      status: "authenticated",
324	      method: "credential_profile",
325	      message: "Using the custom credentials configured for this agent.",
326	      setupCommand: null,
327	    };
328	  }
329	
330	  if (supportedType === "codex") {
331	    if (hasEnvValue(env, ["OPENAI_API_KEY"])) {
332	      return {
333	        status: "authenticated",
334	        method: "api_key",
335	        message: "Codex can use OPENAI_API_KEY from the OmniHarness runtime environment.",
336	        setupCommand: "codex login",
337	      };
338	    }
339	
340	    if (anyFileExists([join(homeDir, ".codex", "auth.json")], fileExists)) {
341	      return {
342	        status: "authenticated",
343	        method: "session_file",
344	        message: "Codex login state was detected.",
345	        setupCommand: "codex login",
346	      };
347	    }
348	
349	    const status = runAuthStatusCommand(commandRunner, "codex", ["login", "status"], env);
350	    if (status && /\blogged\s*in\b/i.test(status) && !/\bnot\s+logged\s*in\b/i.test(status)) {
351	      return {
352	        status: "authenticated",
353	        method: "status_command",
354	        message: "Codex reports an active login.",
355	        setupCommand: "codex login",
356	      };
357	    }
358	
359	    return {
360	      status: "not_authenticated",
361	      method: "missing",
362	      message: "Codex CLI is not logged in. Run `codex login`.",
363	      setupCommand: "codex login",
364	    };
365	  }
366	
367	  if (supportedType === "claude") {
368	    if (hasEnvValue(env, ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"])) {
369	      return {
370	        status: "authenticated",
371	        method: "api_key",
372	        message: "Claude can use Anthropic credentials from the OmniHarness runtime environment.",
373	        setupCommand: "claude auth login",
374	      };
375	    }
376	
377	    const status = runAuthStatusCommand(commandRunner, "claude", ["auth", "status"], env);
378	    if (parseClaudeAuthStatus(status)) {
379	      return {
380	        status: "authenticated",
381	        method: "status_command",
382	        message: "Claude Code reports an active login.",
383	        setupCommand: "claude auth login",
384	      };
385	    }
386	
387	    // `claude auth status` can report loggedIn:false even when valid credentials
388	    // exist on disk or in the macOS Keychain (Claude Code 2.x stores tokens
389	    // there but the status command does not always read them back).
390	    if (anyFileExists([join(homeDir, ".claude", ".credentials.json")], fileExists)) {
391	      return {
392	        status: "authenticated",
393	        method: "session_file",
394	        message: "Claude Code credentials file was detected.",
395	        setupCommand: "claude auth login",
396	      };
397	    }
398	
399	    if (platform === "darwin" && claudeKeychainCredentialsExist(env)) {
400	      return {
401	        status: "authenticated",
402	        method: "session_file",
403	        message: "Claude Code credentials were found in the macOS Keychain.",
404	        setupCommand: "claude auth login",
405	      };
406	    }
407	
408	    return {
409	      status: "not_authenticated",
410	      method: "missing",
411	      message: "Claude Code is not logged in. Run `claude auth login`.",
412	      setupCommand: "claude auth login",
413	    };
414	  }
415	
416	  if (supportedType === "gemini") {
417	    if (hasEnvValue(env, ["GEMINI_API_KEY", "GOOGLE_API_KEY"])) {
418	      return {
419	        status: "authenticated",
420	        method: "api_key",
421	        message: "Gemini can use API credentials from the OmniHarness runtime environment.",
422	        setupCommand: "gemini",
423	      };
424	    }
425	
426	    if (anyFileExists([
427	      join(homeDir, ".gemini", "oauth_creds.json"),
428	      join(homeDir, ".gemini", "google_account_id"),
429	      join(homeDir, ".gemini", "google_accounts.json"),
430	    ], fileExists)) {
431	      return {
432	        status: "authenticated",
433	        method: "session_file",
434	        message: "Gemini login state was detected.",
435	        setupCommand: "gemini",
436	      };
437	    }
438	
439	    return {
440	      status: "not_authenticated",
441	      method: "missing",
442	      message: "Gemini CLI is not logged in. Run `gemini` and complete sign-in.",
443	      setupCommand: "gemini",
444	    };
445	  }
446	
447	  if (supportedType === "opencode") {
448	    if (hasEnvValue(env, ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"])) {
449	      return {
450	        status: "authenticated",
451	        method: "api_key",
452	        message: "OpenCode can use provider credentials from the OmniHarness runtime environment.",
453	        setupCommand: "opencode providers login",
454	      };
455	    }
456	
457	    if (anyFileExists([
458	      join(homeDir, ".local", "share", "opencode", "auth.json"),
459	      join(homeDir, ".config", "opencode", "auth.json"),
460	    ], fileExists)) {
461	      return {
462	        status: "authenticated",
463	        method: "session_file",
464	        message: "OpenCode provider credentials were detected.",
465	        setupCommand: "opencode providers login",
466	      };
467	    }
468	
469	    return {
470	      status: "unknown",
471	      method: "unknown",
472	      message: "OpenCode authentication could not be verified automatically. Check providers with `opencode providers list`.",
473	      setupCommand: "opencode providers login",
474	    };
475	  }
476	
477	  return {
478	    status: "unknown",
479	    method: "unknown",
480	    message: "Authentication could not be verified automatically.",
481	    setupCommand: null,
482	  };
483	}
484	
485	type SpawnabilityOptions = WorkerDetectionOptions & {
486	  quotaBlocked?: ReadonlySet<SupportedWorkerType>;
487	};
488	
489	export function isSpawnableWorkerType(type: string, options: SpawnabilityOptions = {}) {
490	  const normalized = normalizeWorkerType(type);
491	  if (!SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)) {
492	    return {
493	      ok: false,
494	      type: normalized,
495	      reason: `Unsupported worker type "${type}". Supported types: ${SUPPORTED_WORKER_TYPES.join(", ")}.`,
496	    };
497	  }
498	
499	  const supportedType = normalized as SupportedWorkerType;
500	  const env = options.env ?? process.env;
501	
502	  if (!workerBinaryAvailable(supportedType, env, options.commandResolver)) {
503	    const reason =
504	      supportedType === "codex"
505	        ? "codex ACP adapter is not installed."
506	        : `${supportedType} worker binary is not installed.`;
507	    return {
508	      ok: false,
509	      type: supportedType,
510	      reason,
511	    };
512	  }
513	
514	  if (!workerHasApiKey(supportedType)) {
515	    return {
516	      ok: false,
517	      type: supportedType,
518	      reason: `${supportedType} worker is missing its API key.`,
519	    };
520	  }
521	
522	  if (options.quotaBlocked?.has(supportedType)) {
523	    return {
524	      ok: false,
525	      type: supportedType,
526	      reason: `${supportedType} worker is blocked by an active quota incident.`,
527	    };
528	  }
529	
530	  return {
531	    ok: true,
532	    type: supportedType,
533	  };
534	}
535	
536	export function getWorkerInstallationInfo(type: string, options: WorkerDetectionOptions = {}) {
537	  const normalized = normalizeWorkerType(type);
538	  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
539	    ? normalized as SupportedWorkerType
540	    : null;
541	  const command = supportedType ? WORKER_BINARY_COMMANDS[supportedType] : normalized;
542	  const path = resolveCommandPath(command, options.env ?? process.env, options.commandResolver);
543	
544	  return {
545	    command,
546	    path,
547	    dir: path ? dirname(path) : null,
548	  };
549	}
550	
551	export function selectSpawnableWorkerType(
552	  requestedType: string,
553	  env: EnvLike,
554	  allowedTypes: SupportedWorkerType[] = [...SUPPORTED_WORKER_TYPES],
555	  options: { quotaBlocked?: ReadonlySet<SupportedWorkerType> } = {},
556	) {
557	  const normalizedRequestedType = normalizeWorkerType(requestedType);
558	  const normalizedAllowedTypes = Array.from(new Set(
559	    allowedTypes.filter((type): type is SupportedWorkerType => SUPPORTED_WORKER_TYPES.includes(type)),
560	  ));
561	  const quotaBlocked = options.quotaBlocked;
562	
563	  if (!normalizedAllowedTypes.includes(normalizedRequestedType as SupportedWorkerType)) {
564	    const firstAllowed = normalizedAllowedTypes[0];
565	    if (!firstAllowed) {
566	      throw new Error("No allowed worker types are configured for this run.");
567	    }
568	    const availability = isSpawnableWorkerType(firstAllowed, { env, quotaBlocked });
569	    if (availability.ok) {
570	      return {
571	        type: availability.type,
572	        requestedType: normalizedRequestedType,
573	        fallbackReason: `requested worker "${normalizedRequestedType}" is not allowed for this run.`,
574	      };
575	    }
576	  }
577	
578	  const requested = isSpawnableWorkerType(normalizedRequestedType, { env, quotaBlocked });
579	  if (requested.ok && normalizedAllowedTypes.includes(requested.type)) {
580	    return {
581	      type: requested.type,
582	      requestedType: normalizedRequestedType,
583	      fallbackReason: null,
584	    };
585	  }
586	
587	  for (const candidate of normalizedAllowedTypes) {
588	    if (candidate === normalizedRequestedType || !normalizedAllowedTypes.includes(candidate)) {
589	      continue;
590	    }
591	    const availability = isSpawnableWorkerType(candidate, { env, quotaBlocked });
592	    if (availability.ok) {
593	      return {
594	        type: availability.type,
595	        requestedType: normalizedRequestedType,
596	        fallbackReason: requested.reason,
597	      };
598	    }
599	  }
600	
601	  throw new Error(
602	    `No spawnable worker is available. Requested "${requestedType}" failed because ${requested.reason} ` +
603	    `Checked allowed workers: ${normalizedAllowedTypes.join(", ")}.`,
604	  );
605	}
606	
607	/**
608	 * Async wrapper around selectSpawnableWorkerType that loads the current
609	 * quota-blocked type set from the database before selecting. Used by
610	 * failover and any "select a fresh worker" call site that wants to
611	 * automatically skip types whose quota has not yet reset.
612	 */
613	export async function selectSpawnableWorkerTypeAsync(
614	  requestedType: string,
615	  env: EnvLike,
616	  allowedTypes: SupportedWorkerType[] = [...SUPPORTED_WORKER_TYPES],
617	  options: { now?: Date } = {},
618	) {
619	  const { quotaBlockedTypes } = await import("@/server/quota/type-blocking");
620	  const blocked = await quotaBlockedTypes(allowedTypes, { now: options.now });
621	  const blockedSet = new Set<SupportedWorkerType>(blocked.keys());
622	  return selectSpawnableWorkerType(requestedType, env, allowedTypes, { quotaBlocked: blockedSet });
623	}
624	

uuid: de201631-3b64-4d52-a49e-6c09ca4ba62f
parent: 109feb02-2d51-4bb6-8b07-2f41a7961c31
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:06.135Z","phase":null} -->
## Claude tool call: Read · 2026-06-28T21:32:06.135Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/agent-runtime/manager.ts"
}

uuid: 5bf7ba89-b6f2-491e-91ba-2afbcd369279
parent: de201631-3b64-4d52-a49e-6c09ca4ba62f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:06.513Z","phase":null} -->
## Claude tool result: toolu_015ERs4s15gsSYhDkrjj5mHg · 2026-06-28T21:32:06.513Z

```text
<system-reminder>[Truncated: PARTIAL view — showing lines 1-1451 of 2321 total (33980 tokens, cap 25000). Call Read with offset=1452 limit=1451 for the next page, or Grep to find a specific section. Do NOT answer from this page alone if the answer may be further in the file.]</system-reminder>

1	import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "child_process";
2	import { constants, accessSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from "fs";
3	import { mkdir, readFile, writeFile } from "fs/promises";
4	import { request as httpRequest } from "http";
5	import { request as httpsRequest } from "https";
6	import { homedir } from "os";
7	import { basename, dirname, join } from "path";
8	import { Readable, Writable } from "stream";
9	import * as acp from "@agentclientprotocol/sdk";
10	import { sanitizeAcpStream } from "./acp-stream-sanitizer";
11	import { applyCodexBridgeEnv, buildCodexConfigArgs, shouldSetRequestedMode } from "./codex";
12	import { applyCredentialProfileEnv, resolveCredentialProfile } from "./external-credentials";
13	import { isRecoverableConnectionSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";
14	import { commandAvailable, createToolDiagnostics, refreshCachedLoginShellPath, withCodexStandardTooling, withManagedPath } from "./tool-env";
15	import {
16	  appendBoundedText,
17	  appendMessageChunk,
18	  appendOutputEntry,
19	  openAgentOutputArchive,
20	  renderOutputEntries,
21	  selectLiveOutputEntries,
22	  summarizeToolCallUpdate,
23	} from "./output-store";
24	import type {
25	  AgentRecord,
26	  AgentRuntimeConfig,
27	  AskResult,
28	  CancelTerminalProcessResult,
29	  DoctorResult,
30	  ElicitationCreateParams,
31	  ElicitationResponse,
32	  PendingElicitation,
33	  PendingPermission,
34	  StartAgentInput,
35	} from "./types";
36	import { RuntimeHttpError } from "./types";
37	import {
38	  computeEnvFingerprint,
39	  computeWorkerPoolKey,
40	  WorkerPool,
41	} from "./worker-pool";
42	import { MemoryTracer } from "./memory-trace";
43	import {
44	  resolveRuntimeResourceSettings,
45	  RUNTIME_RESOURCE_SETTING_KEYS,
46	} from "@/lib/runtime-resource-settings";
47	import {
48	  acquireWorkerSpawnResources,
49	  assessResourcePressure,
50	  readSystemResourceSnapshot,
51	  type ResourcePressureLevel,
52	  type SystemResourceSnapshotProvider,
53	} from "./resource-admission";
54	import { emitNamedEvent } from "@/server/events/named-events";
55	
56	const MAX_STDERR_LINES = 50;
57	const ENDPOINT_TIMEOUT_MS = 750;
58	const WORKER_CONNECTION_RESET_MAX_BACKOFF_MS = 15 * 60_000;
59	const MAX_TEXT_FIELD_CHARS = 100_000;
60	// Bumped from 30s to 90s. Gemini's `--experimental-acp` startup
61	// occasionally needs >30s on a cold first run (TLS cert install,
62	// model fetch, etc.). The previous default caused recovery attempts
63	// to abort with "Agent ACP initialize timed out after 30000ms" and
64	// surface as needs_user incidents — even though the SDK would have
65	// come up given a few more seconds.
66	const DEFAULT_AGENT_STARTUP_TIMEOUT_MS = 90_000;
67	const CLAUDE_THINKING_DISPLAY_ARGS = {
68	  "thinking-display": "summarized",
69	} as const;
70	
71	type EnvLike = Record<string, string | undefined>;
72	
73	type EndpointCheckResult = {
74	  reachable: boolean;
75	  statusCode: number | null;
76	  latencyMs: number | null;
77	  errorCode: string | null;
78	};
79	
80	const endpointCheckCache = new Map<string, { result: EndpointCheckResult | null; refreshing: boolean }>();
81	
82	function defaultCommandFor(type: string, model: string | null): { command: string; args: string[] } | null {
83	  switch (type) {
84	    case "gemini":
85	      return { command: "gemini", args: ["--experimental-acp", ...(model ? ["--model", model] : [])] };
86	    case "claude":
87	      return { command: "claude-agent-acp", args: [] };
88	    case "codex":
89	      return { command: "codex-acp", args: [] };
90	    case "opencode":
91	      return { command: "opencode", args: ["acp", ...(model ? ["--model", model] : [])] };
92	    default:
93	      return null;
94	  }
95	}
96	
97	function userHomeFromEnv(env: EnvLike) {
98	  return env.HOME?.trim() || homedir();
99	}
100	
101	function bridgeCredentialFileIfMissing(source: string, target: string) {
102	  if (!existsSync(source) || existsSync(target)) {
103	    return;
104	  }
105	  mkdirSync(dirname(target), { recursive: true });
106	  try {
107	    symlinkSync(source, target);
108	  } catch {
109	    copyFileSync(source, target);
110	  }
111	}
112	
113	function bridgeDirectoryIfMissing(source: string, target: string) {
114	  if (!existsSync(source) || existsSync(target)) {
115	    return;
116	  }
117	  if (!statSync(source).isDirectory()) {
118	    return;
119	  }
120	  mkdirSync(dirname(target), { recursive: true });
121	  try {
122	    symlinkSync(source, target, "dir");
123	  } catch {
124	    cpSync(source, target, { recursive: true });
125	  }
126	}
127	
128	function bridgeProjectScopedCliCredentials(type: string, env: EnvLike) {
129	  if (type === "gemini") {
130	    const scopedHome = env.GEMINI_CLI_HOME?.trim();
131	    if (!scopedHome) return;
132	    const globalHome = join(userHomeFromEnv(env), ".gemini");
133	    const scopedConfigDir = join(scopedHome, ".gemini");
134	    for (const fileName of [
135	      "google_accounts.json",
136	      "google_account_id",
137	      "mcp-oauth-tokens-v2.json",
138	      "settings.json",
139	    ]) {
140	      bridgeCredentialFileIfMissing(join(globalHome, fileName), join(scopedConfigDir, fileName));
141	    }
142	    return;
143	  }
144	
145	  if (type === "codex") {
146	    const scopedHome = env.CODEX_HOME?.trim();
147	    if (!scopedHome) return;
148	    const globalHome = join(userHomeFromEnv(env), ".codex");
149	    for (const fileName of ["auth.json", "config.toml"]) {
150	      bridgeCredentialFileIfMissing(join(globalHome, fileName), join(scopedHome, fileName));
151	    }
152	  }
153	
154	  if (type === "claude") {
155	    const scopedConfigDir = env.CLAUDE_CONFIG_DIR?.trim();
156	    if (!scopedConfigDir) return;
157	    const globalHome = join(userHomeFromEnv(env), ".claude");
158	    bridgeDirectoryIfMissing(join(globalHome, "skills"), join(scopedConfigDir, "skills"));
159	  }
160	}
161	
162	function applyClaudeKeychainOAuthToken(env: EnvLike) {
163	  // omniharness spawns claude with a project-scoped CLAUDE_CONFIG_DIR, so the
164	  // worker process does not see the user's global ~/.claude state and the
165	  // underlying `claude` binary reports "Authentication required" on every
166	  // session/prompt. The user's OAuth credentials live in the macOS Keychain
167	  // entry "Claude Code-credentials"; extract the access token and forward it
168	  // as CLAUDE_CODE_OAUTH_TOKEN (the env var Claude Code 2.x reads at startup)
169	  // so OAuth-only users can talk to claude through ACP without configuring an
170	  // explicit ANTHROPIC_API_KEY.
171	  if (process.platform !== "darwin") {
172	    return;
173	  }
174	  if (env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim() || env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
175	    return;
176	  }
177	  let raw: string;
178	  try {
179	    raw = String(execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], {
180	      encoding: "utf8",
181	      timeout: 1_500,
182	      maxBuffer: 64 * 1024,
183	      stdio: ["ignore", "pipe", "pipe"],
184	    })).trim();
185	  } catch {
186	    return;
187	  }
188	  if (!raw) {
189	    return;
190	  }
191	  let token: string | undefined;
192	  try {
193	    const parsed = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: string } };
194	    token = [REDACTED]
195	  } catch {
196	    return;
197	  }
198	  if (token) {
199	    env.CLAUDE_CODE_OAUTH_TOKEN = token;
200	  }
201	}
202	
203	function applyProjectScopedCliStorage(type: string, cwd: string, env: EnvLike) {
204	  const cliHome = join(cwd, ".omniharness", "cli-home");
205	  let shouldBridgeCredentials = false;
206	  if (type === "gemini" && !env.GEMINI_CLI_HOME?.trim()) {
207	    env.GEMINI_CLI_HOME = join(cliHome, "gemini");
208	    shouldBridgeCredentials = true;
209	  }
210	  if (type === "codex") {
211	    const codexHome = join(cliHome, "codex", "home");
212	    if (!env.CODEX_HOME?.trim()) {
213	      env.CODEX_HOME = codexHome;
214	      shouldBridgeCredentials = true;
215	    }
216	    if (!env.CODEX_SQLITE_HOME?.trim()) {
217	      env.CODEX_SQLITE_HOME = join(cliHome, "codex", "sqlite");
218	    }
219	  }
220	  if (type === "claude" && !env.CLAUDE_CONFIG_DIR?.trim()) {
221	    env.CLAUDE_CONFIG_DIR = join(cliHome, "claude");
222	    shouldBridgeCredentials = true;
223	  }
224	  if (type === "opencode") {
225	    const opencodeHome = join(cliHome, "opencode");
226	    if (!env.OPENCODE_CONFIG_DIR?.trim()) {
227	      env.OPENCODE_CONFIG_DIR = join(opencodeHome, "config");
228	    }
229	    if (!env.XDG_DATA_HOME?.trim()) {
230	      env.XDG_DATA_HOME = join(opencodeHome, "data");
231	    }
232	    if (!env.XDG_STATE_HOME?.trim()) {
233	      env.XDG_STATE_HOME = join(opencodeHome, "state");
234	    }
235	    if (!env.XDG_CACHE_HOME?.trim()) {
236	      env.XDG_CACHE_HOME = join(opencodeHome, "cache");
237	    }
238	  }
239	  if (shouldBridgeCredentials) {
240	    bridgeProjectScopedCliCredentials(type, env);
241	  }
242	}
243	
244	function buildSessionMeta(agentType: string | undefined, skillRoots: string[]) {
245	  const meta: Record<string, unknown> = {};
246	  if (skillRoots.length > 0) {
247	    meta["omniharness/skillRoots"] = skillRoots;
248	  }
249	  if (agentType === "claude") {
250	    meta.claudeCode = {
251	      options: {
252	        extraArgs: CLAUDE_THINKING_DISPLAY_ARGS,
253	        settings: {
254	          showThinkingSummaries: true,
255	        },
256	      },
257	    };
258	  }
259	  return Object.keys(meta).length > 0 ? meta : undefined;
260	}
261	
262	function nowIso() {
263	  return new Date().toISOString();
264	}
265	
266	function finiteNumber(value: unknown) {
267	  return typeof value === "number" && Number.isFinite(value) ? value : null;
268	}
269	
270	function readPositiveInteger(value: string | undefined, fallback: number) {
271	  const parsed = Number(value);
272	  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
273	}
274	
275	function startupTimeout(label: string, timeoutMs: number): Promise<never> {
276	  return new Promise((_, reject) => {
277	    const timeout = setTimeout(() => {
278	      reject(new RuntimeHttpError(400, `${label} timed out after ${timeoutMs}ms`));
279	    }, timeoutMs);
280	    timeout.unref?.();
281	  });
282	}
283	
284	function updateContextUsage(record: AgentRecord, patch: Partial<NonNullable<AgentRecord["contextUsage"]>>) {
285	  const existing: NonNullable<AgentRecord["contextUsage"]> = record.contextUsage ?? {
286	    inputTokens: null,
287	    outputTokens: null,
288	    totalTokens: null,
289	    maxTokens: null,
290	    fullnessPercent: null,
291	  };
292	  const inputTokens = finiteNumber(patch.inputTokens) ?? existing.inputTokens ?? null;
293	  const outputTokens = finiteNumber(patch.outputTokens) ?? existing.outputTokens ?? null;
294	  const totalTokens = finiteNumber(patch.totalTokens) ?? existing.totalTokens ?? null;
295	  const maxTokens = finiteNumber(patch.maxTokens) ?? existing.maxTokens ?? null;
296	  const explicitFullnessPercent = finiteNumber(patch.fullnessPercent);
297	  const fullnessPercent = explicitFullnessPercent ?? (
298	    totalTokens !== null && maxTokens !== null && maxTokens > 0
299	      ? Math.min(100, Math.max(0, (totalTokens / maxTokens) * 100))
300	      : existing.fullnessPercent ?? null
301	  );
302	
303	  record.contextUsage = {
304	    inputTokens,
305	    outputTokens,
306	    totalTokens,
307	    maxTokens,
308	    fullnessPercent,
309	  };
310	}
311	
312	function applyPromptUsage(record: AgentRecord, usage: unknown) {
313	  const payload = asRecord(usage);
314	  if (!payload) {
315	    return;
316	  }
317	
318	  updateContextUsage(record, {
319	    inputTokens: finiteNumber(payload.inputTokens),
320	    outputTokens: finiteNumber(payload.outputTokens),
321	    totalTokens: finiteNumber(payload.totalTokens),
322	  });
323	}
324	
325	function applySessionUsageUpdate(record: AgentRecord, update: Record<string, unknown>) {
326	  const used = finiteNumber(update.used);
327	  const size = finiteNumber(update.size);
328	  if (used === null || size === null || size <= 0) {
329	    return false;
330	  }
331	
332	  updateContextUsage(record, {
333	    totalTokens: used,
334	    maxTokens: size,
335	    fullnessPercent: Math.min(100, Math.max(0, (used / size) * 100)),
336	  });
337	  return true;
338	}
339	
340	function stripAgentControlText(text: string) {
341	  return text.replace(/^\[MODE_UPDATE\]\s*autoEdit/i, "");
342	}
343	
344	function expandHomePath(input: string, env: EnvLike = process.env) {
345	  if (input.startsWith("~/")) {
346	    return join(env.HOME || homedir(), input.slice(2));
347	  }
348	  return input;
349	}
350	
351	function asStringArray(value: unknown, field: string): string[] {
352	  if (value == null) {
353	    return [];
354	  }
355	  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
356	    throw new RuntimeHttpError(400, `${field} must be an array of non-empty strings.`);
357	  }
358	  return value.map((item) => item.trim());
359	}
360	
361	function asRecord(value: unknown): Record<string, unknown> | null {
362	  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
363	}
364	
365	function asNonEmptyString(value: unknown): string | null {
366	  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
367	}
368	
369	export function normalizeMcpServers(value: unknown, field: string): acp.McpServer[] {
370	  if (value == null) {
371	    return [];
372	  }
373	  if (!Array.isArray(value)) {
374	    throw new RuntimeHttpError(400, `${field} must be an array.`);
375	  }
376	
377	  return value.map((item, index) => {
378	    const record = asRecord(item);
379	    if (!record) {
380	      throw new RuntimeHttpError(400, `${field}[${index}] must be an object.`);
381	    }
382	    if (record.type !== "stdio" && record.type !== "http" && record.type !== "sse") {
383	      throw new RuntimeHttpError(400, `${field}[${index}].type must be stdio, http, or sse.`);
384	    }
385	    if (typeof record.name !== "string" || record.name.trim().length === 0) {
386	      throw new RuntimeHttpError(400, `${field}[${index}].name is required.`);
387	    }
388	
389	    if (record.type === "stdio") {
390	      if (typeof record.command !== "string" || record.command.trim().length === 0) {
391	        throw new RuntimeHttpError(400, `${field}[${index}].command is required for stdio MCP servers.`);
392	      }
393	      return {
394	        type: "stdio",
395	        name: record.name.trim(),
396	        command: record.command.trim(),
397	        args: asStringArray(record.args, `${field}[${index}].args`),
398	        env: normalizeNameValueList(record.env, `${field}[${index}].env`),
399	        ...(record._meta != null ? { _meta: record._meta as Record<string, unknown> } : {}),
400	      };
401	    }
402	
403	    if (typeof record.url !== "string" || record.url.trim().length === 0) {
404	      throw new RuntimeHttpError(400, `${field}[${index}].url is required for ${record.type} MCP servers.`);
405	    }
406	    return {
407	      type: record.type,
408	      name: record.name.trim(),
409	      url: record.url.trim(),
410	      headers: normalizeNameValueList(record.headers, `${field}[${index}].headers`),
411	      ...(record._meta != null ? { _meta: record._meta as Record<string, unknown> } : {}),
412	    } as acp.McpServer;
413	  });
414	}
415	
416	function normalizeNameValueList(value: unknown, field: string): Array<{ name: string; value: string; _meta?: Record<string, unknown> | null }> {
417	  if (value == null) {
418	    return [];
419	  }
420	  if (!Array.isArray(value)) {
421	    throw new RuntimeHttpError(400, `${field} must be an array.`);
422	  }
423	  return value.map((item, index) => {
424	    const record = asRecord(item);
425	    if (!record || typeof record.name !== "string" || typeof record.value !== "string") {
426	      throw new RuntimeHttpError(400, `${field}[${index}] must include string name and value.`);
427	    }
428	    return {
429	      name: record.name,
430	      value: record.value,
431	      ...(record._meta != null ? { _meta: record._meta as Record<string, unknown> } : {}),
432	    };
433	  });
434	}
435	
436	function executableExists(filePath: string) {
437	  try {
438	    accessSync(filePath, constants.X_OK);
439	    return true;
440	  } catch {
441	    return false;
442	  }
443	}
444	
445	function commandExists(command: string, env: EnvLike): boolean {
446	  const expanded = expandHomePath(command, env);
447	  return expanded.includes("/") ? executableExists(expanded) : commandAvailable(expanded, { env });
448	}
449	
450	function pushStderrLine(buffer: string[], line: string) {
451	  const normalized = line.trim();
452	  if (!normalized) {
453	    return;
454	  }
455	  buffer.push(normalized);
456	  if (buffer.length > MAX_STDERR_LINES) {
457	    buffer.splice(0, buffer.length - MAX_STDERR_LINES);
458	  }
459	}
460	
461	function selectTextFileRange(content: string, line?: number | null, limit?: number | null) {
462	  if (line == null && limit == null) {
463	    return content;
464	  }
465	
466	  const lines = content.match(/[^\n]*\n|[^\n]+/g) ?? [];
467	  const start = Math.max(0, (line ?? 1) - 1);
468	  const end = limit == null ? undefined : start + Math.max(0, limit);
469	  return lines.slice(start, end).join("");
470	}
471	
472	function sanitizePathPart(input: string) {
473	  const sanitized = input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
474	  return sanitized || "skill";
475	}
476	
477	function discoverSkillDirs(skillRoot: string, env: EnvLike): string[] {
478	  const expanded = expandHomePath(skillRoot, env);
479	  if (!existsSync(expanded)) {
480	    throw new RuntimeHttpError(400, `skill root not found: ${skillRoot}`);
481	  }
482	  if (!statSync(expanded).isDirectory()) {
483	    throw new RuntimeHttpError(400, `skill root is not a directory: ${skillRoot}`);
484	  }
485	  if (existsSync(join(expanded, "SKILL.md"))) {
486	    return [expanded];
487	  }
488	  return readdirSync(expanded, { withFileTypes: true })
489	    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
490	    .map((entry) => join(expanded, entry.name))
491	    .filter((candidate) => existsSync(join(candidate, "SKILL.md")));
492	}
493	
494	function materializeSkillRoots(cwd: string, workerName: string, skillRoots: string[], env: EnvLike): string[] {
495	  if (skillRoots.length === 0) {
496	    return [];
497	  }
498	
499	  const skillsDir = join(cwd, ".agents", "skills");
500	  mkdirSync(skillsDir, { recursive: true });
501	  const createdLinks: string[] = [];
502	  try {
503	    for (const skillRoot of skillRoots) {
504	      const skillDirs = discoverSkillDirs(skillRoot, env);
505	      if (skillDirs.length === 0) {
506	        throw new RuntimeHttpError(400, `skill root contains no skill directories: ${skillRoot}`);
507	      }
508	      for (const skillDir of skillDirs) {
509	        const linkBase = `omniharness-${sanitizePathPart(workerName)}-${sanitizePathPart(basename(skillDir))}`;
510	        let linkPath = join(skillsDir, linkBase);
511	        let suffix = 2;
512	        while (existsSync(linkPath)) {
513	          linkPath = join(skillsDir, `${linkBase}-${suffix}`);
514	          suffix += 1;
515	        }
516	        symlinkSync(skillDir, linkPath, "dir");
517	        createdLinks.push(linkPath);
518	      }
519	    }
520	    return createdLinks;
521	  } catch (error) {
522	    cleanupSkillLinks(createdLinks);
523	    throw error;
524	  }
525	}
526	
527	function cleanupSkillLinks(linkPaths: string[]) {
528	  for (const linkPath of linkPaths) {
529	    try {
530	      if (lstatSync(linkPath).isSymbolicLink()) {
531	        rmSync(linkPath, { force: true, recursive: true });
532	      }
533	    } catch {
534	      // Best-effort cleanup for worker-scoped temporary skill links.
535	    }
536	  }
537	}
538	
539	function describeUnknownError(error: unknown) {
540	  if (error instanceof Error) {
541	    return error.message;
542	  }
543	  if (typeof error === "string") {
544	    return error;
545	  }
546	  try {
547	    return JSON.stringify(error);
548	  } catch {
549	    return String(error);
550	  }
551	}
552	
553	let closedPipeConsoleSuppressionDepth = 0;
554	let originalConsoleError: typeof console.error | null = null;
555	
556	function collectErrorCodes(value: unknown, seen = new Set<unknown>()): string[] {
557	  if (typeof value !== "object" || value === null || seen.has(value)) {
558	    return [];
559	  }
560	  seen.add(value);
561	  const record = value as { code?: unknown; cause?: unknown };
562	  return [
563	    typeof record.code === "string" ? record.code : null,
564	    ...collectErrorCodes(record.cause, seen),
565	  ].filter((code): code is string => Boolean(code));
566	}
567	
568	function isClosedPipeAcpWriteConsoleError(args: unknown[]) {
569	  if (args[0] !== "ACP write error:") {
570	    return false;
571	  }
572	  const codes = new Set(collectErrorCodes(args[1]));
573	  return codes.has("EPIPE")
574	    || codes.has("ABORT_ERR")
575	    || codes.has("ERR_STREAM_PREMATURE_CLOSE")
576	    || codes.has("ERR_STREAM_DESTROYED");
577	}
578	
579	async function suppressClosedPipeAcpWriteConsoleError<T>(operation: () => Promise<T>): Promise<T> {
580	  if (!originalConsoleError) {
581	    originalConsoleError = console.error;
582	    console.error = (...args: unknown[]) => {
583	      if (closedPipeConsoleSuppressionDepth > 0 && isClosedPipeAcpWriteConsoleError(args)) {
584	        return;
585	      }
586	      originalConsoleError?.(...args);
587	    };
588	  }
589	
590	  closedPipeConsoleSuppressionDepth += 1;
591	  try {
592	    return await operation();
593	  } finally {
594	    await new Promise<void>((resolve) => setImmediate(resolve));
595	    closedPipeConsoleSuppressionDepth -= 1;
596	    if (closedPipeConsoleSuppressionDepth === 0 && originalConsoleError) {
597	      console.error = originalConsoleError;
598	      originalConsoleError = null;
599	    }
600	  }
601	}
602	
603	function childExitDetail(record: AgentRecord) {
604	  if (record.child.exitCode === null && record.child.signalCode === null) {
605	    return null;
606	  }
607	  return `exit code=${record.child.exitCode} signal=${record.child.signalCode}`;
608	}
609	
610	function assertAgentCanReceiveRequest(record: AgentRecord) {
611	  const exitDetail = childExitDetail(record);
612	  if (exitDetail || record.state === "stopped") {
613	    const detail = record.lastError || exitDetail;
614	    throw new RuntimeHttpError(
615	      409,
616	      `Agent is not running: ${record.name}${detail ? ` (${detail})` : ""}`,
617	    );
618	  }
619	}
620	
621	function isInitializeMethodNotFound(error: unknown) {
622	  if (typeof error !== "object" || error === null) {
623	    return false;
624	  }
625	  const record = error as { message?: unknown; data?: { method?: unknown } | null };
626	  const message = typeof record.message === "string" ? record.message : "";
627	  const method = typeof record.data?.method === "string" ? record.data.method : "";
628	  return /\bmethod not found\b/i.test(message) && (/\binitialize\b/i.test(message) || method === "initialize");
629	}
630	
631	function normalizeAgentStartupError(input: { type: string; command: string; error: unknown; stderrBuffer: string[] }) {
632	  if (input.error instanceof RuntimeHttpError) {
633	    return input.error;
634	  }
635	
636	  const details = {
637	    command: input.command,
638	    recentStderr: [...input.stderrBuffer],
639	    rawError: input.error,
640	  };
641	
642	  if (isInitializeMethodNotFound(input.error)) {
643	    const commandLabel = input.command.includes("/") ? input.command : `"${input.command}"`;
644	    const typeSpecificHint =
645	      input.type === "codex"
646	        ? "Install codex-acp or configure an ACP-compatible Codex command."
647	        : "Configure an ACP-compatible command for this worker.";
648	    return new RuntimeHttpError(
649	      400,
650	      `${commandLabel} rejected ACP initialize. This command speaks MCP, not ACP. ${typeSpecificHint}`,
651	      details,
652	    );
653	  }
654	
655	  return new RuntimeHttpError(
656	    400,
657	    `failed to start ${input.type} agent via ${input.command}: ${describeUnknownError(input.error)}`,
658	    details,
659	  );
660	}
661	
662	function getTypeBaseUrl(type: string, env: EnvLike) {
663	  if (type === "codex") return env.OPENAI_BASE_URL || "https://api.openai.com/v1";
664	  if (type === "claude") return env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
665	  if (type === "gemini") return env.GOOGLE_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
666	  return null;
667	}
668	
669	function getApiKeyValue(type: string, env: EnvLike) {
670	  if (type === "codex") return env.OPENAI_API_KEY?.trim() || null;
671	  if (type === "claude") return env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim() || null;
672	  if (type === "gemini") return env.GEMINI_API_KEY?.trim() || null;
673	  return null;
674	}
675	
676	function getApiKeyRequirement(type: string) {
677	  void type;
678	  return { required: false, message: null as string | null };
679	}
680	
681	function endpointCheck(urlString: string): Promise<EndpointCheckResult> {
682	  return new Promise((resolve) => {
683	    let timeout: NodeJS.Timeout | null = null;
684	    let settled = false;
685	    const finish = (result: EndpointCheckResult) => {
686	      if (settled) {
687	        return;
688	      }
689	      settled = true;
690	      if (timeout) {
691	        clearTimeout(timeout);
692	      }
693	      resolve(result);
694	    };
695	
696	    let url: URL;
697	    try {
698	      url = new URL(urlString);
699	    } catch {
700	      finish({ reachable: false, statusCode: null, latencyMs: null, errorCode: "EINVAL" });
701	      return;
702	    }
703	
704	    const start = Date.now();
705	    const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;
706	    const req = requestImpl(
707	      {
708	        method: "HEAD",
709	        hostname: url.hostname,
710	        port: url.port || undefined,
711	        path: `${url.pathname}${url.search}`,
712	      },
713	      (res) => {
714	        res.resume();
715	        res.once("end", () => {
716	          finish({
717	            reachable: res.statusCode !== null,
718	            statusCode: res.statusCode ?? null,
719	            latencyMs: Date.now() - start,
720	            errorCode: null,
721	          });
722	        });
723	      },
724	    );
725	
726	    timeout = setTimeout(() => {
727	      req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
728	      finish({ reachable: false, statusCode: null, latencyMs: Date.now() - start, errorCode: "ETIMEDOUT" });
729	    }, ENDPOINT_TIMEOUT_MS);
730	    timeout.unref?.();
731	    req.setTimeout(ENDPOINT_TIMEOUT_MS, () => {
732	      req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
733	    });
734	    req.once("error", (error: NodeJS.ErrnoException) => {
735	      finish({ reachable: false, statusCode: null, latencyMs: Date.now() - start, errorCode: error.code || "UNKNOWN" });
736	    });
737	    req.end();
738	  });
739	}
740	
741	function refreshEndpointCheck(urlString: string) {
742	  const cached = endpointCheckCache.get(urlString);
743	  if (cached?.refreshing) {
744	    return;
745	  }
746	
747	  endpointCheckCache.set(urlString, { result: cached?.result ?? null, refreshing: true });
748	  void endpointCheck(urlString)
749	    .then((result) => {
750	      endpointCheckCache.set(urlString, { result, refreshing: false });
751	    })
752	    .catch(() => {
753	      endpointCheckCache.set(urlString, {
754	        result: cached?.result ?? null,
755	        refreshing: false,
756	      });
757	    });
758	}
759	
760	function readCachedEndpointCheck(urlString: string): EndpointCheckResult | null {
761	  const cached = endpointCheckCache.get(urlString);
762	  refreshEndpointCheck(urlString);
763	  return cached?.result ?? null;
764	}
765	
766	class RuntimeClient implements acp.Client {
767	  constructor(
768	    private readonly getRecord: () => AgentRecord | undefined,
769	    private readonly publishChunk: (name: string, chunk: string) => void,
770	  ) {}
771	
772	  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
773	    const record = this.getRecord();
774	    if (!record) {
775	      return { outcome: { outcome: "cancelled" } };
776	    }
777	    const requestId = nextPermissionRequestId++;
778	    record.updatedAt = nowIso();
779	    record.state = "working";
780	    appendOutputEntry(record, {
781	      type: "permission",
782	      text: buildPermissionRequestText(params),
783	      status: "pending",
784	      raw: { ...params, requestId },
785	    });
786	    // Mode switches (e.g. exiting plan mode via "Ready to code?") change how the
787	    // agent operates and are always the user's call — never auto-approve them, even
788	    // in full-access/YOLO mode where every other permission is bypassed.
789	    if (isFullAccessPermissionMode(record.sessionMode) && !isModeSwitchPermission(params)) {
790	      const optionId = findAutoApprovePermissionOptionId(params);
791	      appendPermissionOutcomeEntry(record, requestId, params, "approve", optionId);
792	      record.updatedAt = nowIso();
793	      return optionId
794	        ? { outcome: { outcome: "selected", optionId } }
795	        : { outcome: { outcome: "cancelled" } };
796	    }
797	    return new Promise((resolve) => {
798	      record.pendingPermissions.push({
799	        requestId,
800	        params,
801	        requestedAt: nowIso(),
802	        resolve,
803	      });
804	    });
805	  }
806	
807	  // The pinned SDK doesn't route `elicitation/create`, so it arrives through the
808	  // generic ext-method escape hatch. This is how the claude-agent-acp adapter
809	  // presents the built-in AskUserQuestion tool once we advertise
810	  // `elicitation.form` — see startup `clientCapabilities`.
811	  async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
812	    if (method === ELICITATION_CREATE_METHOD) {
813	      return this.createElicitation(params as ElicitationCreateParams);
814	    }
815	    throw acp.RequestError.methodNotFound(method);
816	  }
817	
818	  private async createElicitation(params: ElicitationCreateParams): Promise<ElicitationResponse> {
819	    const record = this.getRecord();
820	    if (!record) {
821	      return { action: "cancel" };
822	    }
823	    // URL-mode elicitations need a browser surface we don't advertise; only form
824	    // mode (AskUserQuestion) is supported. Decline anything else so the turn
825	    // proceeds instead of hanging.
826	    if (params.mode && params.mode !== "form") {
827	      return { action: "decline" };
828	    }
829	    const requestId = nextElicitationRequestId++;
830	    record.updatedAt = nowIso();
831	    record.state = "working";
832	    appendOutputEntry(record, {
833	      type: "elicitation",
834	      text: buildElicitationRequestText(params),
835	      status: "pending",
836	      raw: { ...params, requestId },
837	    });
838	    return new Promise((resolve) => {
839	      record.pendingElicitations.push({
840	        requestId,
841	        params,
842	        requestedAt: nowIso(),
843	        resolve,
844	      });
845	    });
846	  }
847	
848	  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
849	    const content = await readFile(params.path, "utf8");
850	    return {
851	      content: selectTextFileRange(content, params.line, params.limit),
852	    };
853	  }
854	
855	  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
856	    await mkdir(dirname(params.path), { recursive: true });
857	    await writeFile(params.path, params.content, "utf8");
858	    return {};
859	  }
860	
861	  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
862	    const record = this.getRecord();
863	    if (!record) {
864	      return;
865	    }
866	    const update = asRecord(params.update);
867	    if (!update) {
868	      return;
869	    }
870	    record.updatedAt = nowIso();
871	
872	    if (update.sessionUpdate === "usage_update") {
873	      applySessionUsageUpdate(record, update);
874	      return;
875	    }
876	
877	    if (update.sessionUpdate === "agent_message_chunk") {
878	      const content = asRecord(update.content);
879	      const text = content?.type === "text" && typeof content.text === "string" ? stripAgentControlText(content.text) : "";
880	      if (text) {
881	        record.currentText = appendBoundedText(record.currentText, text, MAX_TEXT_FIELD_CHARS);
882	        record.lastText = record.currentText;
883	        appendMessageChunk(record, text, "message");
884	        this.publishChunk(record.name, text);
885	      }
886	      return;
887	    }
888	
889	    if (update.sessionUpdate === "agent_thought_chunk") {
890	      const content = asRecord(update.content);
891	      const text = content?.type === "text" && typeof content.text === "string" ? content.text : "";
892	      const isCwdThought = text.startsWith("[current working directory");
893	      if (text && !isCwdThought) {
894	        appendMessageChunk(record, text, "thought");
895	      }
896	      return;
897	    }
898	
899	    if (update.sessionUpdate === "tool_call") {
900	      record.state = "working";
901	      appendOutputEntry(record, {
902	        type: "tool_call",
903	        text: typeof update.title === "string" && update.title.trim().length > 0
904	          ? update.title
905	          : typeof update.kind === "string"
906	            ? update.kind
907	            : "Tool call started",
908	        toolCallId: typeof update.toolCallId === "string" ? update.toolCallId : undefined,
909	        toolKind: typeof update.kind === "string" ? update.kind : undefined,
910	        status: typeof update.status === "string" ? update.status : undefined,
911	        raw: update,
912	      });
913	      return;
914	    }
915	
916	    if (update.sessionUpdate === "tool_call_update") {
917	      appendOutputEntry(record, {
918	        type: "tool_call_update",
919	        text: summarizeToolCallUpdate(update),
920	        toolCallId: typeof update.toolCallId === "string" ? update.toolCallId : undefined,
921	        status: typeof update.status === "string" ? update.status : undefined,
922	        raw: update,
923	      });
924	    }
925	  }
926	}
927	
928	let nextPermissionRequestId = 1;
929	
930	// JSON-RPC method the claude-agent-acp adapter calls to present a form
931	// elicitation (the built-in AskUserQuestion tool). Not modeled by the pinned
932	// SDK, so we match on the raw method string.
933	const ELICITATION_CREATE_METHOD = "elicitation/create";
934	let nextElicitationRequestId = 1;
935	
936	function buildElicitationRequestText(params: ElicitationCreateParams) {
937	  const message = asNonEmptyString(params.message);
938	  const fieldNames = params.requestedSchema?.properties
939	    ? Object.keys(params.requestedSchema.properties)
940	    : [];
941	  const fieldsSuffix = fieldNames.length > 0 ? ` (${fieldNames.length} field${fieldNames.length === 1 ? "" : "s"})` : "";
942	  return message ? `Question for user: ${message}${fieldsSuffix}` : `Question for user${fieldsSuffix}`;
943	}
944	
945	function appendElicitationOutcomeEntry(record: AgentRecord, requestId: number, response: ElicitationResponse) {
946	  const status = response.action === "accept" ? "answered" : response.action === "decline" ? "skipped" : "cancelled";
947	  const summary = response.action === "accept"
948	    ? Object.entries(response.content)
949	        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("/") : String(value)}`)
950	        .join(", ")
951	    : "";
952	  appendOutputEntry(record, {
953	    type: "elicitation",
954	    text: summary
955	      ? `Question ${status} for request ${requestId}: ${summary}`
956	      : `Question ${status} for request ${requestId}`,
957	    status,
958	    raw: { requestId, action: response.action, ...(response.action === "accept" ? { content: response.content } : {}) },
959	  });
960	}
961	
962	function describePermissionToolCall(params: acp.RequestPermissionRequest) {
963	  const toolCall = asRecord(params.toolCall);
964	  if (!toolCall) {
965	    return null;
966	  }
967	  const title = asNonEmptyString(toolCall.title);
968	  const kind = asNonEmptyString(toolCall.kind);
969	  if (title && kind) {
970	    return `${kind}: ${title}`;
971	  }
972	  return title ?? kind;
973	}
974	
975	function buildPermissionRequestText(params: acp.RequestPermissionRequest) {
976	  const target = describePermissionToolCall(params);
977	  const optionsText = params.options.length > 0
978	    ? `: ${params.options.map((option) => `${option.kind} ${option.name}`).join(", ")}`
979	    : "";
980	  return target
981	    ? `Permission requested for ${target}${optionsText}`
982	    : `Permission requested${optionsText}`;
983	}
984	
985	function isFullAccessPermissionMode(mode: string | null) {
986	  return mode === "full-access" || mode === "danger-full-access";
987	}
988	
989	// A `switch_mode` permission asks to change the agent's operating mode (the
990	// plan-mode → code-mode "Ready to code?" handoff). This is a deliberate user
991	// gate and must never be auto-approved, regardless of session permission mode.
992	function isModeSwitchPermission(params: acp.RequestPermissionRequest) {
993	  const toolCall = asRecord(params.toolCall);
994	  return asNonEmptyString(toolCall?.kind) === "switch_mode";
995	}
996	
997	function findPermissionOptionId(params: acp.RequestPermissionRequest, mode: "approve" | "deny", explicitOptionId?: string) {
998	  if (explicitOptionId && params.options.some((option) => option.optionId === explicitOptionId)) {
999	    return explicitOptionId;
1000	  }
1001	  const preferred = mode === "approve"
1002	    ? params.options.find((option) => option.kind === "allow_always" || option.optionId === "allow_always" || option.optionId === "proceed_always")
1003	      ?? params.options.find((option) => option.kind.startsWith("allow"))
1004	    : params.options.find((option) => option.kind.startsWith("reject"));
1005	  return preferred?.optionId ?? params.options[0]?.optionId ?? null;
1006	}
1007	
1008	function findAutoApprovePermissionOptionId(params: acp.RequestPermissionRequest) {
1009	  const preferred =
1010	    params.options.find((option) => option.kind === "allow_always" || option.optionId === "allow_always" || option.optionId === "proceed_always")
1011	    ?? params.options.find((option) => option.kind.startsWith("allow"));
1012	  return preferred?.optionId ?? null;
1013	}
1014	
1015	function appendPermissionOutcomeEntry(
1016	  record: AgentRecord,
1017	  requestId: number,
1018	  params: acp.RequestPermissionRequest,
1019	  decision: "approve" | "deny" | "cancel",
1020	  optionId: string | null,
1021	) {
1022	  if (decision === "cancel") {
1023	    appendOutputEntry(record, {
1024	      type: "permission",
1025	      text: `Permission cancelled for request ${requestId}`,
1026	      status: "cancelled",
1027	      raw: { requestId, decision },
1028	    });
1029	    return;
1030	  }
1031	
1032	  const option = optionId
1033	    ? params.options.find((candidate) => candidate.optionId === optionId)
1034	    : null;
1035	  const status = optionId
1036	    ? decision === "approve" ? "approved" : "denied"
1037	    : "cancelled";
1038	  const optionLabel = option
1039	    ? `${option.kind} ${option.name}`.trim()
1040	    : optionId;
1041	  appendOutputEntry(record, {
1042	    type: "permission",
1043	    text: optionLabel
1044	      ? `Permission ${status} for request ${requestId}: ${optionLabel}`
1045	      : `Permission ${status} for request ${requestId}`,
1046	    status,
1047	    raw: {
1048	      requestId,
1049	      decision,
1050	      optionId: optionId ?? null,
1051	      option: option ?? null,
1052	      toolCall: params.toolCall,
1053	    },
1054	  });
1055	}
1056	
1057	export class AgentRuntimeManager {
1058	  readonly agents = new Map<string, AgentRecord>();
1059	  private readonly chunkSubscribers = new Map<string, Set<(chunk: string) => void>>();
1060	  private readonly workerPool = new WorkerPool();
1061	  private readonly memoryTracer: MemoryTracer;
1062	  private readonly pendingAgentReaps = new Map<string, NodeJS.Timeout>();
1063	  private reapSweepTimer: NodeJS.Timeout | null = null;
1064	  private resourcePressureTimer: NodeJS.Timeout | null = null;
1065	  private resourcePressureCheckInFlight = false;
1066	  private lastResourcePressureLevel: ResourcePressureLevel = "normal";
1067	  private readonly runtimeStartedAt = Date.now();
1068	  private lastAgentUseAt = this.runtimeStartedAt;
1069	  private runtimeSettingsEnv: EnvLike = {};
1070	  private readonly poolMemberMaxAgeMs: number;
1071	  private readonly agentIdleTimeoutMs: number;
1072	  private readonly agentExitGraceMs: number;
1073	
1074	  constructor(
1075	    private readonly options: {
1076	      config?: AgentRuntimeConfig;
1077	      env?: EnvLike;
1078	      resourceSnapshotProvider?: SystemResourceSnapshotProvider;
1079	    } = {},
1080	  ) {
1081	    const baseEnv = this.options.env || process.env;
1082	    const sizeRaw = baseEnv.OMNIHARNESS_WORKER_POOL_SIZE ?? baseEnv.OMNIHARNESS_GEMINI_POOL_SIZE;
1083	    const parsed = sizeRaw ? Number.parseInt(sizeRaw, 10) : NaN;
1084	    if (Number.isFinite(parsed) && parsed >= 0) {
1085	      this.workerPool.setMaxPerKey(parsed);
1086	    } else {
1087	      this.workerPool.setMaxPerKey(1);
1088	    }
1089	    this.workerPool.setMaxTotal(
1090	      readPositiveInteger(baseEnv.OMNIHARNESS_WORKER_POOL_MAX_TOTAL, 4),
1091	    );
1092	    this.poolMemberMaxAgeMs = readPositiveInteger(
1093	      baseEnv.OMNIHARNESS_WORKER_POOL_MAX_AGE_MS,
1094	      30 * 60_000,
1095	    );
1096	    this.agentIdleTimeoutMs = readPositiveInteger(
1097	      baseEnv.OMNIHARNESS_AGENT_IDLE_TIMEOUT_MS,
1098	      30 * 60_000,
1099	    );
1100	    this.agentExitGraceMs = readPositiveInteger(
1101	      baseEnv.OMNIHARNESS_AGENT_EXIT_GRACE_MS,
1102	      60_000,
1103	    );
1104	    const sweepIntervalMs = readPositiveInteger(
1105	      baseEnv.OMNIHARNESS_RUNTIME_SWEEP_INTERVAL_MS,
1106	      60_000,
1107	    );
1108	    this.reapSweepTimer = setInterval(() => this.runReapSweep(), sweepIntervalMs);
1109	    this.reapSweepTimer.unref?.();
1110	    if (baseEnv.OMNIHARNESS_RESOURCE_PRESSURE !== "0") {
1111	      const pressureIntervalMs = readPositiveInteger(
1112	        baseEnv.OMNIHARNESS_RESOURCE_PRESSURE_INTERVAL_MS,
1113	        30_000,
1114	      );
1115	      this.resourcePressureTimer = setInterval(() => {
1116	        void this.runResourcePressureCheck();
1117	      }, pressureIntervalMs);
1118	      this.resourcePressureTimer.unref?.();
1119	    }
1120	    this.memoryTracer = new MemoryTracer({
1121	      env: baseEnv as Record<string, string | undefined>,
1122	      getCounts: () => ({
1123	        agents: this.agents.size,
1124	        poolMembers: this.workerPool.countAll(),
1125	      }),
1126	    });
1127	  }
1128	
1129	  applyRuntimeSettings(env: EnvLike, options: { emit?: boolean } = {}): { ok: true; keys: string[] } {
1130	    const settingKeys = Object.values(RUNTIME_RESOURCE_SETTING_KEYS);
1131	    const nextEnv = { ...this.runtimeSettingsEnv };
1132	    const changed: string[] = [];
1133	
1134	    for (const key of settingKeys) {
1135	      const value = env[key];
1136	      if (typeof value !== "string") continue;
1137	      if (nextEnv[key] === value) continue;
1138	      nextEnv[key] = value;
1139	      changed.push(key);
1140	    }
1141	
1142	    if (changed.length > 0) {
1143	      this.runtimeSettingsEnv = nextEnv;
1144	      if (options.emit !== false) {
1145	        emitNamedEvent({ kind: "runtime.settings_updated", keys: changed });
1146	      }
1147	    }
1148	
1149	    return { ok: true, keys: changed };
1150	  }
1151	
1152	  private getRuntimeEnv(overrides: EnvLike = {}): EnvLike {
1153	    return {
1154	      ...(this.options.env || process.env),
1155	      ...this.runtimeSettingsEnv,
1156	      ...overrides,
1157	    };
1158	  }
1159	
1160	  private async runResourcePressureCheck(): Promise<void> {
1161	    if (this.resourcePressureCheckInFlight) return;
1162	    this.resourcePressureCheckInFlight = true;
1163	    try {
1164	      const baseEnv = this.getRuntimeEnv();
1165	      const snapshot = this.options.resourceSnapshotProvider
1166	        ? await this.options.resourceSnapshotProvider()
1167	        : await readSystemResourceSnapshot(process.cwd());
1168	      const assessment = assessResourcePressure(snapshot, baseEnv);
1169	      if (assessment.level === "normal") {
1170	        this.lastResourcePressureLevel = "normal";
1171	        return;
1172	      }
1173	
1174	      const poolMembersBefore = this.workerPool.countAll();
1175	      const evictedPoolMembers = assessment.level === "critical"
1176	        ? this.workerPool.evictAll()
1177	        : 0;
1178	      const shouldSurface =
1179	        assessment.level !== this.lastResourcePressureLevel || evictedPoolMembers > 0;
1180	      this.lastResourcePressureLevel = assessment.level;
1181	      if (!shouldSurface) return;
1182	
1183	      emitNamedEvent({
1184	        kind: "runtime.resource_pressure",
1185	        level: assessment.level,
1186	        memoryFreePercent: snapshot.memoryFreePercent ?? null,
1187	        diskFreeMb: snapshot.diskFreeMb ?? null,
1188	        activeAgents: this.agents.size,
1189	        poolMembers: poolMembersBefore,
1190	        evictedPoolMembers,
1191	        reasons: assessment.reasons,
1192	      });
1193	      emitNamedEvent({
1194	        kind: "error.surfaced",
1195	        code: "runtime.resource_pressure",
1196	        message: assessment.level === "critical"
1197	          ? `System resources are critically low. OmniHarness evicted ${evictedPoolMembers} prewarmed worker${evictedPoolMembers === 1 ? "" : "s"} and will refuse new workers until resources recover.`
1198	          : "System resources are low. OmniHarness will refuse new workers until resources recover.",
1199	        surface: "toast",
1200	      });
1201	    } catch (error) {
1202	      process.stderr.write(`[resource-pressure] check failed: ${describeUnknownError(error)}\n`);
1203	    } finally {
1204	      this.resourcePressureCheckInFlight = false;
1205	    }
1206	  }
1207	
1208	  private runReapSweep(): void {
1209	    try {
1210	      this.workerPool.sweepExpired(this.poolMemberMaxAgeMs);
1211	    } catch (error) {
1212	      process.stderr.write(`[runtime-sweep] pool sweep failed: ${describeUnknownError(error)}\n`);
1213	    }
1214	    const now = Date.now();
1215	    for (const [name, record] of this.agents) {
1216	      if (record.state !== "idle") continue;
1217	      const updatedAt = Date.parse(record.updatedAt);
1218	      if (!Number.isFinite(updatedAt)) continue;
1219	      if (now - updatedAt < this.agentIdleTimeoutMs) continue;
1220	      void this.stopAgent(name).catch((error) => {
1221	        process.stderr.write(
1222	          `[runtime-sweep] failed to reap idle agent ${name}: ${describeUnknownError(error)}\n`,
1223	        );
1224	      });
1225	    }
1226	    this.runIdleCleanupSweep(now);
1227	  }
1228	
1229	  private runIdleCleanupSweep(now: number): void {
1230	    const settings = resolveRuntimeResourceSettings(this.getRuntimeEnv());
1231	    if (!settings.idleCleanupEnabled) return;
1232	
1233	    const activeAgents = Array.from(this.agents.values())
1234	      .filter((record) => record.state !== "stopped" && record.state !== "error")
1235	      .length;
1236	    if (activeAgents > 0) return;
1237	
1238	    const poolMembers = this.workerPool.countAll();
1239	    if (poolMembers === 0) return;
1240	
1241	    const quietSince = Math.max(this.runtimeStartedAt, this.lastAgentUseAt);
1242	    const idleMs = now - quietSince;
1243	    if (idleMs < settings.idleCleanupAfterMs) return;
1244	
1245	    const evictedPoolMembers = this.workerPool.evictAll();
1246	    if (evictedPoolMembers === 0) return;
1247	
1248	    this.lastAgentUseAt = now;
1249	    emitNamedEvent({
1250	      kind: "runtime.idle_cleanup",
1251	      idleMs,
1252	      activeAgents,
1253	      evictedPoolMembers,
1254	    });
1255	  }
1256	
1257	  private scheduleAgentRecordReap(name: string): void {
1258	    const existing = this.pendingAgentReaps.get(name);
1259	    if (existing) clearTimeout(existing);
1260	    const timer = setTimeout(() => {
1261	      this.pendingAgentReaps.delete(name);
1262	      const record = this.agents.get(name);
1263	      if (!record) return;
1264	      // Only reap if the record is still in a terminal state. If the agent was
1265	      // restarted under the same name in the grace window, leave it alone.
1266	      if (record.state !== "stopped" && record.state !== "error") return;
1267	      this.agents.delete(name);
1268	    }, this.agentExitGraceMs);
1269	    timer.unref?.();
1270	    this.pendingAgentReaps.set(name, timer);
1271	  }
1272	
1273	  toStatus(record: AgentRecord) {
1274	    const outputEntries = selectLiveOutputEntries(record);
1275	    return {
1276	      name: record.name,
1277	      type: record.type,
1278	      cwd: record.cwd,
1279	      state: record.state,
1280	      sessionId: record.sessionId,
1281	      protocolVersion: record.protocolVersion,
1282	      requestedModel: record.requestedModel,
1283	      effectiveModel: record.effectiveModel,
1284	      requestedEffort: record.requestedEffort,
1285	      effectiveEffort: record.effectiveEffort,
1286	      credentialProfile: record.credentialProfile,
1287	      sessionMode: record.sessionMode,
1288	      contextUsage: record.contextUsage,
1289	      lastError: record.lastError,
1290	      recentStderr: [...record.stderrBuffer],
1291	      stderrBuffer: [...record.stderrBuffer],
1292	      lastText: record.lastText,
1293	      currentText: record.currentText,
1294	      renderedOutput: renderOutputEntries(outputEntries),
1295	      outputEntries,
1296	      outputArchive: record.outputArchive.stats(outputEntries.length),
1297	      stopReason: record.stopReason,
1298	      pendingPermissions: record.pendingPermissions.map((item) => ({
1299	        requestId: item.requestId,
1300	        requestedAt: item.requestedAt,
1301	        sessionId: item.params.sessionId,
1302	        toolCall: (() => {
1303	          const toolCall = asRecord(item.params.toolCall);
1304	          return toolCall
1305	            ? {
1306	                toolCallId: asNonEmptyString(toolCall.toolCallId),
1307	                kind: asNonEmptyString(toolCall.kind),
1308	                title: asNonEmptyString(toolCall.title),
1309	                status: asNonEmptyString(toolCall.status),
1310	              }
1311	            : null;
1312	        })(),
1313	        options: item.params.options.map((option) => ({
1314	          optionId: option.optionId,
1315	          kind: option.kind,
1316	          name: option.name,
1317	        })),
1318	      })),
1319	      pendingElicitations: record.pendingElicitations.map((item) => ({
1320	        requestId: item.requestId,
1321	        requestedAt: item.requestedAt,
1322	        sessionId: item.params.sessionId ?? null,
1323	        toolCallId: item.params.toolCallId ?? null,
1324	        message: item.params.message ?? null,
1325	        requestedSchema: item.params.requestedSchema ?? null,
1326	      })),
1327	      createdAt: record.createdAt,
1328	      updatedAt: record.updatedAt,
1329	    };
1330	  }
1331	
1332	  listAgents() {
1333	    return Array.from(this.agents.values()).map((agent) => this.toStatus(agent));
1334	  }
1335	
1336	  getAgent(name: string) {
1337	    const record = this.agents.get(name);
1338	    return record ? this.toStatus(record) : null;
1339	  }
1340	
1341	  async readAgentOutput(name: string, options?: { cursor?: number; limit?: number }) {
1342	    const record = this.agents.get(name);
1343	    if (!record) {
1344	      throw new RuntimeHttpError(404, `Agent not found: ${name}`);
1345	    }
1346	    return record.outputArchive.readPage(options);
1347	  }
1348	
1349	  private async runAgentRequest<T>(record: AgentRecord, request: () => Promise<T>): Promise<T> {
1350	    assertAgentCanReceiveRequest(record);
1351	    return await new Promise<T>((resolve, reject) => {
1352	      const rejectForExit = (code: number | null, signal: NodeJS.Signals | null) => {
1353	        const message = `Agent is not running: ${record.name} (exit code=${code} signal=${signal})`;
1354	        record.state = "stopped";
1355	        record.lastError = record.lastError ?? `exit code=${code} signal=${signal}`;
1356	        record.updatedAt = nowIso();
1357	        reject(new RuntimeHttpError(409, message));
1358	      };
1359	      const rejectForError = (error: Error) => {
1360	        const message = `Agent process error: ${error.message}`;
1361	        record.state = "error";
1362	        record.lastError = message;
1363	        record.updatedAt = nowIso();
1364	        reject(new RuntimeHttpError(500, message));
1365	      };
1366	      const cleanup = () => {
1367	        record.child.off("exit", rejectForExit);
1368	        record.child.off("error", rejectForError);
1369	      };
1370	
1371	      record.child.once("exit", rejectForExit);
1372	      record.child.once("error", rejectForError);
1373	      suppressClosedPipeAcpWriteConsoleError(request).then(resolve, reject).finally(cleanup);
1374	    });
1375	  }
1376	
1377	  async startAgent(input: StartAgentInput) {
1378	    this.applyRuntimeSettings(input.env ?? {}, { emit: false });
1379	    this.lastAgentUseAt = Date.now();
1380	    const type = input.type?.trim() || "opencode";
1381	    const name = input.name?.trim();
1382	    if (!name) {
1383	      throw new RuntimeHttpError(400, "Agent name is required");
1384	    }
1385	
1386	    const cwd = input.cwd || process.cwd();
1387	    const existing = this.agents.get(name);
1388	    if (existing) {
1389	      if (
1390	        input.resumeSessionId
1391	        && existing.sessionId === input.resumeSessionId
1392	        && existing.type === type
1393	        && existing.cwd === cwd
1394	      ) {
1395	        return this.toStatus(existing);
1396	      }
1397	      throw new RuntimeHttpError(400, `Agent already exists: ${name}`);
1398	    }
1399	
1400	    const requestedModel = input.model?.trim() || null;
1401	    const requestedEffort = input.effort?.trim().toLowerCase() || null;
1402	    const resumeSessionId = input.resumeSessionId?.trim() || null;
1403	    const configuredAgent = this.options.config?.agents?.[type];
1404	    const baseEnv = this.getRuntimeEnv();
1405	    const skillRoots = [
1406	      ...asStringArray(configuredAgent?.skillRoots, `agents.${type}.skillRoots`),
1407	      ...asStringArray(input.skillRoots, "skillRoots"),
1408	    ];
1409	    const mcpServers = [
1410	      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
1411	      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
1412	    ];
1413	
1414	    let defaultArgs: string[] = [];
1415	    if (type === "opencode") {
1416	      defaultArgs = ["acp"];
1417	      if (requestedModel) {
1418	        defaultArgs.push("--model", requestedModel);
1419	      }
1420	    } else if (type === "codex") {
1421	      defaultArgs = buildCodexConfigArgs({
1422	        model: requestedModel,
1423	        effort: requestedEffort,
1424	      });
1425	    }
1426	    const configuredArgs = configuredAgent?.args && configuredAgent.args.length > 0 ? configuredAgent.args : undefined;
1427	    const requestedArgs = input.args && input.args.length > 0 ? input.args : undefined;
1428	    const finalEnv = withManagedPath({
1429	      ...baseEnv,
1430	      ...(configuredAgent?.env || {}),
1431	      ...(input.env || {}),
1432	    }, cwd);
1433	    applyProjectScopedCliStorage(type, cwd, finalEnv);
1434	    const credentialProfile = await resolveCredentialProfile({
1435	      type,
1436	      cwd,
1437	      env: finalEnv,
1438	      requestedProfile: input.credentialProfile,
1439	      configuredProfile: configuredAgent?.credentialProfile,
1440	    });
1441	    applyCredentialProfileEnv(finalEnv, credentialProfile);
1442	
1443	    if (type === "codex") {
1444	      Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
1445	      Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
1446	    }
1447	    if (type === "claude") {
1448	      applyClaudeKeychainOAuthToken(finalEnv);
1449	    }
1450	
1451	    const requestedMode = input.mode || configuredAgent?.mode;

uuid: 4c5fa608-11a2-458b-9e34-715cc509490f
parent: 5bf7ba89-b6f2-491e-91ba-2afbcd369279
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-28T21:32:21.352Z","phase":null} -->
## Claude thinking · 2026-06-28T21:32:21.352Z

I'm comparing how the worker availability check and the direct Claude control session differ in their approach to resolving the Claude command path, with the worker check using a cached login shell path mode while the direct session appears to take a different route. I need to dig into `tool-env.ts` to understand how `withManagedPath` handles PATH resolution differently depending on whether `loginShellPathMode` is set to "cached" versus the default, and how that affects whether the binary is found during availability checks versus actual execution.

uuid: b7d4da64-aa1c-413e-b4ec-26a65e82dce1
parent: 4c5fa608-11a2-458b-9e34-715cc509490f

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-28T21:32:21.354Z","phase":null} -->
## Claude · 2026-06-28T21:32:21.354Z

Both reference the same binary (`claude-agent-acp`). The interesting divergence is in how PATH is resolved. Let me examine `tool-env.ts` and how direct-control sessions resolve/spawn the binary.

uuid: 4100ac36-2220-494f-8321-74090a88c67b
parent: b7d4da64-aa1c-413e-b4ec-26a65e82dce1

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:22.185Z","phase":null} -->
## Claude tool call: Read · 2026-06-28T21:32:22.185Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/agent-runtime/tool-env.ts"
}

uuid: 69de4b60-242c-406b-8fc4-86ebe364e66e
parent: 4100ac36-2220-494f-8321-74090a88c67b
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:22.194Z","phase":null} -->
## Claude tool result: toolu_01Pb6uByogDgHrMd9AV1v3q4 · 2026-06-28T21:32:22.194Z

```text
1	import { execFile, execFileSync } from "node:child_process";
2	import {
3	  closeSync,
4	  constants,
5	  accessSync,
6	  existsSync,
7	  mkdtempSync,
8	  openSync,
9	  readSync,
10	  symlinkSync,
11	  writeFileSync,
12	} from "node:fs";
13	import { delimiter, dirname, isAbsolute, join, parse } from "node:path";
14	import { arch, homedir, platform, tmpdir } from "node:os";
15	
16	export type EnvLike = Record<string, string | undefined>;
17	
18	export type ToolDiagnostic = {
19	  name: string;
20	  available: boolean;
21	  path: string | null;
22	  required: boolean;
23	};
24	
25	export type StructuredToolDiagnostic = {
26	  name: string;
27	  available: boolean;
28	  provider: string;
29	  required: boolean;
30	};
31	
32	export type ToolDiagnostics = {
33	  ok: boolean;
34	  path: string;
35	  structured: StructuredToolDiagnostic[];
36	  required: ToolDiagnostic[];
37	  optional: ToolDiagnostic[];
38	};
39	
40	function executableExists(filePath: string): boolean {
41	  try {
42	    accessSync(filePath, constants.X_OK);
43	    return true;
44	  } catch {
45	    return false;
46	  }
47	}
48	
49	type BuildManagedPathInput = {
50	  cwd?: string;
51	  env?: EnvLike;
52	  loginShellPathProvider?: (env: EnvLike) => string | null | undefined;
53	  loginShellPathMode?: "blocking" | "cached";
54	};
55	
56	type CommandLookupInput = {
57	  env?: EnvLike;
58	  cwd?: string;
59	};
60	
61	const CODEX_ARGV0_TOOL_NAMES = platform() === "linux"
62	  ? ["apply_patch", "applypatch", "codex-linux-sandbox"]
63	  : ["apply_patch", "applypatch"];
64	const DEFAULT_REQUIRED_TOOLS = [
65	  "apply_patch",
66	  "applypatch",
67	  ...(platform() === "linux" ? ["codex-linux-sandbox"] : []),
68	  "rg",
69	  "git",
70	  "node",
71	  "bash",
72	  "sh",
73	  "ls",
74	];
75	const DEFAULT_OPTIONAL_TOOLS = [
76	  "pnpm",
77	  "npm",
78	  "python3",
79	  "python",
80	  "zsh",
81	  "sed",
82	  "awk",
83	  "grep",
84	  "find",
85	  "xargs",
86	  "mkdir",
87	  "rm",
88	  "cp",
89	  "mv",
90	  "jq",
91	  "gh",
92	  "cargo",
93	  "uv",
94	  "fd",
95	  "make",
96	];
97	const DEFAULT_STRUCTURED_TOOLS = [
98	  "codex-core/exec_command",
99	  "codex-core/write_stdin",
100	  "codex-core/update_plan",
101	  "codex-core/apply_patch",
102	  "codex-core/web_search",
103	  "codex-core/view_image",
104	  "codex-core/list_mcp_resources",
105	  "codex-core/list_mcp_resource_templates",
106	  "codex-core/read_mcp_resource",
107	  "fs/read_text_file",
108	  "fs/write_text_file",
109	  "acp_fs/read_text_file",
110	  "acp_fs/write_text_file",
111	  "acp_fs/edit_text_file",
112	  "acp_fs/multi_edit_text_file",
113	];
114	const codexArgv0ShimDirs = new Map<string, string>();
115	const codexManagedConfigPaths = new Map<string, string>();
116	const loginShellPathCache = new Map<string, { path: string | null; refreshing: boolean }>();
117	
118	const CODEX_STANDARD_TOOL_CONFIG = `[features]
119	apply_patch_freeform = true
120	unified_exec = true
121	web_search_request = true
122	view_image_tool = true
123	shell_tool = true
124	parallel = true
125	remote_models = true
126	`;
127	
128	function splitPath(value: string | undefined): string[] {
129	  return (value || "")
130	    .split(delimiter)
131	    .map((entry) => entry.trim())
132	    .filter(Boolean);
133	}
134	
135	export function mergePathEntries(entries: Array<string | undefined | null>): string {
136	  const seen = new Set<string>();
137	  const merged: string[] = [];
138	
139	  for (const entry of entries) {
140	    if (!entry) {
141	      continue;
142	    }
143	    if (seen.has(entry)) {
144	      continue;
145	    }
146	    seen.add(entry);
147	    merged.push(entry);
148	  }
149	
150	  return merged.join(delimiter);
151	}
152	
153	function existingParentDirs(cwd: string | undefined, stopAt: string): string[] {
154	  if (!cwd || !isAbsolute(cwd)) {
155	    return [];
156	  }
157	
158	  const dirs: string[] = [];
159	  let current = cwd;
160	  const root = parse(cwd).root;
161	  const stop = stopAt || root;
162	
163	  while (current && current !== root) {
164	    dirs.push(current);
165	    if (current === stop) {
166	      break;
167	    }
168	    const next = dirname(current);
169	    if (next === current) {
170	      break;
171	    }
172	    current = next;
173	  }
174	
175	  return dirs;
176	}
177	
178	function projectBinDirs(cwd: string | undefined, home: string): string[] {
179	  return existingParentDirs(cwd, home)
180	    .map((dir) => join(dir, "node_modules", ".bin"));
181	}
182	
183	function envBinDirs(env: EnvLike, home: string): string[] {
184	  const dirs = [
185	    env.NVM_BIN,
186	    env.PNPM_HOME,
187	    env.BUN_INSTALL ? join(env.BUN_INSTALL, "bin") : undefined,
188	    env.CARGO_HOME ? join(env.CARGO_HOME, "bin") : undefined,
189	    env.PYENV_ROOT ? join(env.PYENV_ROOT, "shims") : undefined,
190	    join(home, ".cargo", "bin"),
191	    join(home, ".local", "bin"),
192	    join(home, ".bun", "bin"),
193	    join(home, ".deno", "bin"),
194	    join(home, ".npm-global", "bin"),
195	    join(home, ".yarn", "bin"),
196	    join(home, ".opencode", "bin"),
197	    join(home, ".pyenv", "shims"),
198	  ];
199	
200	  return dirs.filter((entry): entry is string => Boolean(entry));
201	}
202	
203	function systemBinDirs(): string[] {
204	  return [
205	    "/opt/homebrew/bin",
206	    "/opt/homebrew/sbin",
207	    "/usr/local/bin",
208	    "/usr/local/sbin",
209	    "/opt/local/bin",
210	    "/opt/local/sbin",
211	    "/usr/bin",
212	    "/bin",
213	    "/usr/sbin",
214	    "/sbin",
215	  ];
216	}
217	
218	function codexTargetTriple() {
219	  if (platform() === "darwin") {
220	    return arch() === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
221	  }
222	  if (platform() === "linux") {
223	    return arch() === "arm64" ? "aarch64-unknown-linux-musl" : "x86_64-unknown-linux-musl";
224	  }
225	  if (platform() === "win32") {
226	    return arch() === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
227	  }
228	  return null;
229	}
230	
231	function isProbablyNodeLauncher(filePath: string) {
232	  let fd: number | null = null;
233	  try {
234	    fd = openSync(filePath, "r");
235	    const buffer = Buffer.alloc(256);
236	    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
237	    return buffer.subarray(0, bytesRead).toString("utf8").includes("/usr/bin/env node");
238	  } catch {
239	    return false;
240	  } finally {
241	    if (fd !== null) {
242	      closeSync(fd);
243	    }
244	  }
245	}
246	
247	function nativeCodexCandidates(env: EnvLike): string[] {
248	  const triple = codexTargetTriple();
249	  const binaryName = platform() === "win32" ? "codex.exe" : "codex";
250	  const explicit = env.OMNIHARNESS_CODEX_NATIVE_BINARY || env.CODEX_NATIVE_BINARY;
251	  const candidates = [
252	    explicit,
253	    "/Applications/Codex.app/Contents/Resources/codex",
254	  ];
255	
256	  const codexCommand = resolveCommand("codex", { env });
257	  if (codexCommand) {
258	    candidates.push(codexCommand);
259	
260	    if (triple) {
261	      const commandDir = dirname(codexCommand);
262	      const nodePrefix = dirname(commandDir);
263	      const possiblePackageRoots = [join(nodePrefix, "lib", "node_modules", "@openai", "codex")];
264	      const normalizedCommand = codexCommand.replace(/\\/g, "/");
265	      const packageBinSegment = "/node_modules/@openai/codex/bin/";
266	      if (normalizedCommand.includes(packageBinSegment)) {
267	        possiblePackageRoots.push(dirname(dirname(codexCommand)));
268	      }
269	
270	      for (const packageRoot of possiblePackageRoots) {
271	        candidates.push(
272	          join(packageRoot, "node_modules", `@openai/codex-${platform() === "darwin" ? "darwin" : platform()}-${arch() === "arm64" ? "arm64" : "x64"}`, "vendor", triple, "codex", binaryName),
273	          join(packageRoot, "vendor", triple, "codex", binaryName),
274	        );
275	      }
276	    }
277	  }
278	
279	  return candidates.filter((candidate): candidate is string => Boolean(candidate));
280	}
281	
282	function resolveNativeCodexBinary(env: EnvLike): string | null {
283	  for (const candidate of nativeCodexCandidates(env)) {
284	    if (!executableExists(candidate)) {
285	      continue;
286	    }
287	    if (isProbablyNodeLauncher(candidate)) {
288	      continue;
289	    }
290	    return candidate;
291	  }
292	  return null;
293	}
294	
295	function createCodexArgv0ShimDir(env: EnvLike): string | null {
296	  const nativeCodexBinary = resolveNativeCodexBinary(env);
297	  if (!nativeCodexBinary) {
298	    return null;
299	  }
300	
301	  const existing = codexArgv0ShimDirs.get(nativeCodexBinary);
302	  if (existing && CODEX_ARGV0_TOOL_NAMES.every((tool) => executableExists(join(existing, tool)))) {
303	    return existing;
304	  }
305	
306	  try {
307	    const dir = mkdtempSync(join(tmpdir(), "omniharness-codex-tools-"));
308	    for (const tool of CODEX_ARGV0_TOOL_NAMES) {
309	      symlinkSync(nativeCodexBinary, join(dir, tool));
310	    }
311	    codexArgv0ShimDirs.set(nativeCodexBinary, dir);
312	    return dir;
313	  } catch {
314	    return null;
315	  }
316	}
317	
318	export function createCodexManagedToolConfigPath(env: EnvLike = process.env): string | null {
319	  if (env.OMNIHARNESS_DISABLE_CODEX_MANAGED_TOOL_CONFIG === "1") {
320	    return null;
321	  }
322	
323	  const cacheKey = env.CODEX_MANAGED_CONFIG_PATH || "omniharness-default";
324	  const existing = codexManagedConfigPaths.get(cacheKey);
325	  if (existing && existsSync(existing)) {
326	    return existing;
327	  }
328	
329	  try {
330	    const dir = mkdtempSync(join(tmpdir(), "omniharness-codex-config-"));
331	    const configPath = join(dir, "managed_config.toml");
332	    writeFileSync(configPath, CODEX_STANDARD_TOOL_CONFIG, "utf8");
333	    codexManagedConfigPaths.set(cacheKey, configPath);
334	    return configPath;
335	  } catch {
336	    return null;
337	  }
338	}
339	
340	function loginShellPathCacheKey(env: EnvLike, shell: string) {
341	  return [
342	    shell,
343	    env.HOME || homedir(),
344	    env.USER || "",
345	    env.LOGNAME || "",
346	  ].join("\0");
347	}
348	
349	function readLoginShellPathBlocking(shell: string, env: EnvLike): string | null {
350	  try {
351	    return execFileSync(shell, ["-l", "-c", "printf %s \"$PATH\""], {
352	      env: env as NodeJS.ProcessEnv,
353	      encoding: "utf8",
354	      stdio: ["ignore", "pipe", "ignore"],
355	    }).trim();
356	  } catch {
357	    return null;
358	  }
359	}
360	
361	function refreshLoginShellPath(cacheKey: string, shell: string, env: EnvLike) {
362	  const cached = loginShellPathCache.get(cacheKey);
363	  if (cached?.refreshing) {
364	    return;
365	  }
366	
367	  loginShellPathCache.set(cacheKey, { path: cached?.path ?? null, refreshing: true });
368	  const child = execFile(shell, ["-l", "-c", "printf %s \"$PATH\""], {
369	    env: env as NodeJS.ProcessEnv,
370	    encoding: "utf8",
371	  }, (error, stdout) => {
372	    loginShellPathCache.set(cacheKey, {
373	      path: error ? cached?.path ?? null : stdout.trim(),
374	      refreshing: false,
375	    });
376	  });
377	  child.unref?.();
378	}
379	
380	function getLoginShell(env: EnvLike): string | null {
381	  if (env.OMNIHARNESS_RUNTIME_DISABLE_LOGIN_PATH === "1") {
382	    return null;
383	  }
384	
385	  const shell = env.SHELL?.trim();
386	  if (!shell || !existsSync(shell)) {
387	    return null;
388	  }
389	
390	  return shell;
391	}
392	
393	export async function refreshCachedLoginShellPath(env: EnvLike): Promise<void> {
394	  const shell = getLoginShell(env);
395	  if (!shell) {
396	    return;
397	  }
398	
399	  const cacheKey = loginShellPathCacheKey(env, shell);
400	  const cached = loginShellPathCache.get(cacheKey);
401	  if (cached?.refreshing) {
402	    return;
403	  }
404	
405	  loginShellPathCache.set(cacheKey, { path: cached?.path ?? null, refreshing: true });
406	  const path = readLoginShellPathBlocking(shell, env);
407	  loginShellPathCache.set(cacheKey, { path, refreshing: false });
408	}
409	
410	function readLoginShellPath(env: EnvLike, mode: "blocking" | "cached"): string | null {
411	  const shell = getLoginShell(env);
412	  if (!shell) {
413	    return null;
414	  }
415	
416	  const cacheKey = loginShellPathCacheKey(env, shell);
417	  if (mode === "blocking") {
418	    const cached = loginShellPathCache.get(cacheKey);
419	    if (cached && !cached.refreshing) {
420	      return cached.path;
421	    }
422	    const path = readLoginShellPathBlocking(shell, env);
423	    loginShellPathCache.set(cacheKey, { path, refreshing: false });
424	    return path;
425	  }
426	
427	  const cached = loginShellPathCache.get(cacheKey);
428	  refreshLoginShellPath(cacheKey, shell, env);
429	  return cached?.path ?? null;
430	}
431	
432	export function buildManagedPath(input: BuildManagedPathInput = {}): string {
433	  const env = input.env || process.env;
434	  const home = env.HOME || homedir();
435	  const inherited = splitPath(env.PATH);
436	  const loginPath = input.loginShellPathProvider
437	    ? input.loginShellPathProvider(env)
438	    : readLoginShellPath(env, input.loginShellPathMode ?? "blocking");
439	
440	  return mergePathEntries([
441	    createCodexArgv0ShimDir(env),
442	    ...projectBinDirs(input.cwd, home),
443	    ...inherited,
444	    ...splitPath(loginPath || undefined),
445	    ...envBinDirs(env, home),
446	    ...systemBinDirs(),
447	  ]);
448	}
449	
450	export function withManagedPath<T extends EnvLike>(env: T, cwd?: string, options: { loginShellPathMode?: "blocking" | "cached" } = {}): T {
451	  return {
452	    ...env,
453	    PATH: buildManagedPath({ cwd, env, loginShellPathMode: options.loginShellPathMode }),
454	  };
455	}
456	
457	export function withCodexStandardTooling<T extends EnvLike>(env: T): T {
458	  const managedConfigPath = createCodexManagedToolConfigPath(env);
459	  return {
460	    ...env,
461	    ...(managedConfigPath ? { CODEX_MANAGED_CONFIG_PATH: managedConfigPath } : {}),
462	  };
463	}
464	
465	export function resolveCommand(command: string, input: CommandLookupInput = {}): string | null {
466	  const env = input.env || process.env;
467	  const expanded = command.startsWith("~/")
468	    ? join(env.HOME || homedir(), command.slice(2))
469	    : command;
470	
471	  if (expanded.includes("/")) {
472	    return executableExists(expanded) ? expanded : null;
473	  }
474	
475	  const pathEntries = splitPath(env.PATH);
476	  for (const dir of pathEntries) {
477	    const candidate = join(dir, expanded);
478	    if (executableExists(candidate)) {
479	      return candidate;
480	    }
481	  }
482	
483	  return null;
484	}
485	
486	export function commandAvailable(command: string, input: CommandLookupInput = {}): boolean {
487	  return Boolean(resolveCommand(command, input));
488	}
489	
490	export function createToolDiagnostics(input: {
491	  env?: EnvLike;
492	  cwd?: string;
493	  required?: string[];
494	  optional?: string[];
495	  structured?: string[];
496	  assumeManagedPath?: boolean;
497	} = {}): ToolDiagnostics {
498	  const managedEnv = input.assumeManagedPath
499	    ? input.env || process.env
500	    : withManagedPath(input.env || process.env, input.cwd);
501	  const required = input.required || DEFAULT_REQUIRED_TOOLS;
502	  const optional = input.optional || DEFAULT_OPTIONAL_TOOLS;
503	  const structured = input.structured || DEFAULT_STRUCTURED_TOOLS;
504	
505	  const toDiagnostic = (name: string, requiredTool: boolean): ToolDiagnostic => {
506	    const foundPath = resolveCommand(name, { env: managedEnv, cwd: input.cwd });
507	    return {
508	      name,
509	      available: Boolean(foundPath),
510	      path: foundPath,
511	      required: requiredTool,
512	    };
513	  };
514	
515	  const structuredDiagnostics = structured.map((name) => ({
516	    name,
517	    available: true,
518	    provider: name.startsWith("codex-core/")
519	      ? "Codex core managed config"
520	      : name.startsWith("fs/") ? "ACP client filesystem" : "codex-acp acp_fs",
521	    required: true,
522	  }));
523	  const requiredDiagnostics = required.map((name) => toDiagnostic(name, true));
524	  const optionalDiagnostics = optional.map((name) => toDiagnostic(name, false));
525	
526	  return {
527	    ok: structuredDiagnostics.every((item) => item.available) && requiredDiagnostics.every((item) => item.available),
528	    path: managedEnv.PATH || "",
529	    structured: structuredDiagnostics,
530	    required: requiredDiagnostics,
531	    optional: optionalDiagnostics,
532	  };
533	}
534	

uuid: a1cadc5a-1847-4cae-a70f-7772b38afd7c
parent: 69de4b60-242c-406b-8fc4-86ebe364e66e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:23.300Z","phase":null} -->
## Claude tool call: Bash · 2026-06-28T21:32:23.300Z

```json
{
  "command": "grep -rn \"isSpawnableWorkerType\\|workerBinaryAvailable\\|getWorkerInstallationInfo\\|worker binary is not installed\\|loginShellPathMode\" src/ | grep -v \"worker-availability.ts\" | head -50"
}

uuid: b6ac43e1-3020-4160-8d9d-164bc0e1f71f
parent: a1cadc5a-1847-4cae-a70f-7772b38afd7c
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:23.925Z","phase":null} -->
## Claude tool result: toolu_019J3wFfFs3dFbQFqQZKotW8 · 2026-06-28T21:32:23.925Z

```text
src/runtime/http/routes/agents-catalog.ts:7:import { getWorkerAuthenticationInfo, getWorkerInstallationInfo, getWorkerTokenQuotaInfo, isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
src/runtime/http/routes/agents-catalog.ts:38:  const managedEnv = withManagedPath(env, undefined, { loginShellPathMode: "cached" });
src/runtime/http/routes/agents-catalog.ts:175:        const installation = getWorkerInstallationInfo(type, detectionOptions);
src/runtime/http/routes/agents-catalog.ts:191:            const localAvailability = isSpawnableWorkerType(type, detectionOptions);
src/server/planning/review-agent-selection.ts:6:import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
src/server/planning/review-agent-selection.ts:27:    const spawnable = isSpawnableWorkerType(type);
src/server/agent-runtime/manager.ts:1860:    const env = withManagedPath(baseEnv, undefined, { loginShellPathMode: "cached" });
src/server/agent-runtime/tool-env.ts:53:  loginShellPathMode?: "blocking" | "cached";
src/server/agent-runtime/tool-env.ts:438:    : readLoginShellPath(env, input.loginShellPathMode ?? "blocking");
src/server/agent-runtime/tool-env.ts:450:export function withManagedPath<T extends EnvLike>(env: T, cwd?: string, options: { loginShellPathMode?: "blocking" | "cached" } = {}): T {
src/server/agent-runtime/tool-env.ts:453:    PATH: buildManagedPath({ cwd, env, loginShellPathMode: options.loginShellPathMode }),
src/server/supervisor/retry.ts:55:  /\bworker binary is not installed\b/i,

uuid: edbe5ecd-e42c-4a80-bb11-a67c08db0ee1
parent: b6ac43e1-3020-4160-8d9d-164bc0e1f71f
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-28T21:32:39.398Z","phase":null} -->
## Claude thinking · 2026-06-28T21:32:39.398Z

I'm examining how the catalog route constructs detection options and the command resolver, then tracing through the manager spawn logic to understand when command availability gets checked—specifically comparing the `which` command execution in `worker-availability.ts` against any pre-spawn validation.

The critical issue is emerging: the availability check uses `loginShellPathMode: "cached"`, which on first call returns null since the cache hasn't been populated yet by the async refresh. This means `which` only searches the inherited process PATH plus hard-coded directories, missing commands installed in login-shell-only locations like version managers. But the actual spawn uses `withManagedPath` without that option, defaulting to `"blocking"` mode, which synchronously runs the login shell to get the full PATH—so it can find `claude-agent-acp` where the availability check cannot.

uuid: 7b0a9b11-dd99-4a6f-8b84-815753c86e63
parent: edbe5ecd-e42c-4a80-bb11-a67c08db0ee1

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-28T21:32:40.016Z","phase":null} -->
## Claude · 2026-06-28T21:32:40.016Z

Now let me look at the catalog route (which surfaces availability to the UI) and the manager's line 1860 usage to confirm the PATH-mode divergence.

uuid: 91bcfc8d-a70a-472b-bcf9-41095090af10
parent: 7b0a9b11-dd99-4a6f-8b84-815753c86e63

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:41.574Z","phase":null} -->
## Claude tool call: Read · 2026-06-28T21:32:41.574Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/runtime/http/routes/agents-catalog.ts",
  "offset": 1,
  "limit": 210
}

uuid: 2c7f96a8-8d5c-47a4-a705-346ded9293b3
parent: 91bcfc8d-a70a-472b-bcf9-41095090af10
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:41.583Z","phase":null} -->
## Claude tool result: toolu_015kYdUoKiJoUoQSrvMgFACU · 2026-06-28T21:32:41.583Z

```text
1	import { eq } from "drizzle-orm";
2	import { BRIDGE_URL } from "@/server/bridge-client";
3	import { db } from "@/server/db";
4	import { settings } from "@/server/db/schema";
5	import { resolveCommand, withManagedPath } from "@/server/agent-runtime/tool-env";
6	import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
7	import { getWorkerAuthenticationInfo, getWorkerInstallationInfo, getWorkerTokenQuotaInfo, isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
8	import type { WorkerCommandResolver, WorkerCommandRunner } from "@/server/supervisor/worker-availability";
9	import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS } from "@/server/supervisor/worker-types";
10	import { buildAppError, errorResponse } from "@/server/api-errors";
11	import { requireApiSession } from "@/server/auth/guards";
12	import { WorkerModelCatalogManager, type WorkerModelCatalog } from "@/server/worker-models";
13	import type { OmniHttpHandler } from "@/runtime/http/registry";
14	import { toNextRequest } from "./next-request";
15	
16	interface RuntimeDoctorResult {
17	  type: string;
18	  status: "ok" | "warning" | "error";
19	  binary: boolean;
20	  apiKey: boolean | null;
21	  endpoint: boolean | null;
22	  message?: string;
23	}
24	
25	interface RuntimeDoctorSnapshot {
26	  results: RuntimeDoctorResult[];
27	  diagnostic: ReturnType<typeof buildAppError> | null;
28	}
29	
30	const WORKER_MODEL_CATALOG_CACHE_KEY = "__WORKER_MODEL_CATALOG_CACHE";
31	const RUNTIME_DOCTOR_TIMEOUT_MS = 2_000;
32	
33	const frontendCatalogCommandRunner: WorkerCommandRunner = () => {
34	  throw new Error("Frontend catalog requests skip blocking CLI probes.");
35	};
36	
37	const frontendCatalogCommandResolver: WorkerCommandResolver = (command, env) => {
38	  const managedEnv = withManagedPath(env, undefined, { loginShellPathMode: "cached" });
39	  return resolveCommand(command, { env: managedEnv });
40	};
41	
42	const workerModelCatalogManager = new WorkerModelCatalogManager({
43	  loadCachedCatalog: async () => {
44	    const cached = await db.select().from(settings).where(eq(settings.key, WORKER_MODEL_CATALOG_CACHE_KEY)).get();
45	    if (!cached?.value) {
46	      return null;
47	    }
48	
49	    const parsed = JSON.parse(cached.value) as unknown;
50	    if (parsed && typeof parsed === "object" && "catalog" in parsed) {
51	      return (parsed as { catalog?: Partial<WorkerModelCatalog> }).catalog ?? null;
52	    }
53	
54	    return parsed as Partial<WorkerModelCatalog>;
55	  },
56	  saveCachedCatalog: async (catalog) => {
57	    const cachedValue = JSON.stringify({ catalog, updatedAt: new Date().toISOString() });
58	    await db.insert(settings)
59	      .values({
60	        key: WORKER_MODEL_CATALOG_CACHE_KEY,
61	        value: cachedValue,
62	        updatedAt: new Date(),
63	      })
64	      .onConflictDoUpdate({
65	        target: settings.key,
66	        set: {
67	          value: cachedValue,
68	          updatedAt: new Date(),
69	        },
70	      });
71	  },
72	});
73	
74	async function fetchRuntimeDoctor(options: { refresh?: boolean } = {}) {
75	  const controller = new AbortController();
76	  let didTimeout = false;
77	  const doctorUrl = new URL(`${BRIDGE_URL}/doctor`);
78	  if (options.refresh) {
79	    doctorUrl.searchParams.set("refresh", "1");
80	  }
81	  const timeout = options.refresh ? null : setTimeout(() => {
82	    didTimeout = true;
83	    controller.abort();
84	  }, RUNTIME_DOCTOR_TIMEOUT_MS);
85	
86	  try {
87	    return await fetch(doctorUrl, { signal: controller.signal });
88	  } catch (error) {
89	    if (didTimeout) {
90	      throw new Error(`Agent runtime doctor request timed out after ${RUNTIME_DOCTOR_TIMEOUT_MS}ms.`);
91	    }
92	    throw error;
93	  } finally {
94	    if (timeout) {
95	      clearTimeout(timeout);
96	    }
97	  }
98	}
99	
100	async function readRuntimeDoctorSnapshot(options: { refresh?: boolean } = {}): Promise<RuntimeDoctorSnapshot> {
101	  try {
102	    const doctorResponse = await fetchRuntimeDoctor(options);
103	    if (!doctorResponse.ok) {
104	      return {
105	        results: [],
106	        diagnostic: buildAppError(`Agent runtime doctor request failed with status ${doctorResponse.status}`, {
107	          status: doctorResponse.status,
108	          source: "Agent runtime",
109	          action: "Load worker availability",
110	        }),
111	      };
112	    }
113	
114	    const payload = await doctorResponse.json() as { results?: RuntimeDoctorResult[] };
115	    return {
116	      results: payload.results ?? [],
117	      diagnostic: null,
118	    };
119	  } catch (error) {
120	    return {
121	      results: [],
122	      diagnostic: buildAppError(error, {
123	        source: "Agent runtime",
124	        action: "Load worker availability",
125	      }),
126	    };
127	  }
128	}
129	
130	export const handleAgentsCatalogRequest: OmniHttpHandler = async (request) => {
131	  try {
132	    const auth = await requireApiSession(toNextRequest(request), {
133	      source: "Agent runtime",
134	      action: "Load worker availability",
135	    });
136	    if (auth.response) {
137	      return auth.response;
138	    }
139	
140	    const requestUrl = new URL(request.url);
141	    const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
142	    const [allSettings, doctorSnapshot, workerModelResult] = await Promise.all([
143	      db.select().from(settings),
144	      readRuntimeDoctorSnapshot({ refresh: forceRefresh }),
145	      forceRefresh
146	        ? workerModelCatalogManager.refreshCatalog().then((catalog) => ({ catalog, refreshing: false }))
147	        : workerModelCatalogManager.getCatalogSnapshot({ refreshOnFirstLoad: true }),
148	    ]);
149	
150	    const byType = new Map(doctorSnapshot.results.map((result) => [result.type, result]));
151	    const { env: runtimeSettingsEnv, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
152	    const workerDetectionEnv = {
153	      ...process.env,
154	      ...runtimeSettingsEnv,
155	    };
156	
157	    return Response.json({
158	      diagnostics: [
159	        ...decryptionFailures.map((failure) => buildAppError(
160	          `Unable to decrypt runtime setting "${failure.key}".`,
161	          {
162	            source: "Settings",
163	            action: "Load worker availability",
164	          },
165	        )),
166	        ...(doctorSnapshot.diagnostic ? [doctorSnapshot.diagnostic] : []),
167	      ],
168	      workerModels: workerModelResult.catalog,
169	      workerModelsRefreshing: workerModelResult.refreshing,
170	      workers: SUPPORTED_WORKER_TYPES.map((type) => {
171	        const detectionOptions = {
172	          env: workerDetectionEnv,
173	          commandResolver: frontendCatalogCommandResolver,
174	        };
175	        const installation = getWorkerInstallationInfo(type, detectionOptions);
176	        const authentication = getWorkerAuthenticationInfo(type, {
177	          env: workerDetectionEnv,
178	          commandRunner: frontendCatalogCommandRunner,
179	        });
180	        return {
181	          type,
182	          label: WORKER_TYPE_LABELS[type],
183	          installation,
184	          authentication,
185	          tokenQuota: getWorkerTokenQuotaInfo(type, {
186	            env: workerDetectionEnv,
187	            commandRunner: frontendCatalogCommandRunner,
188	          }),
189	          availability: (() => {
190	            const doctorAvailability = byType.get(type);
191	            const localAvailability = isSpawnableWorkerType(type, detectionOptions);
192	
193	            if (localAvailability.ok) {
194	              if (authentication.status === "not_authenticated") {
195	                return {
196	                  type,
197	                  status: "warning" as const,
198	                  binary: true,
199	                  apiKey: false,
200	                  endpoint: doctorAvailability?.endpoint ?? null,
201	                  message: authentication.message,
202	                };
203	              }
204	
205	              return {
206	                type,
207	                status: "ok" as const,
208	                binary: true,
209	                apiKey: [REDACTED] === "authenticated" ? true : null,
210	                endpoint: doctorAvailability?.endpoint ?? null,

uuid: e0eccfce-5207-40d4-b9fc-53a0aec09393
parent: 2c7f96a8-8d5c-47a4-a705-346ded9293b3
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:42.244Z","phase":null} -->
## Claude tool call: Read · 2026-06-28T21:32:42.244Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/src/server/agent-runtime/manager.ts",
  "offset": 1840,
  "limit": 60
}

uuid: 2097ec4d-83b6-4d63-b202-8567ebf759f2
parent: e0eccfce-5207-40d4-b9fc-53a0aec09393
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:42.252Z","phase":null} -->
## Claude tool result: toolu_01MHdrWYgSmJxrhbW77nF38Z · 2026-06-28T21:32:42.252Z

```text
1840	    }
1841	    const pending = this.resolvePendingElicitation(record, response);
1842	    if (!pending) {
1843	      throw new RuntimeHttpError(409, "no_pending_elicitations");
1844	    }
1845	    return {
1846	      ok: true,
1847	      name: record.name,
1848	      action: response.action,
1849	      requestId: pending.requestId,
1850	      pendingElicitations: record.pendingElicitations.length,
1851	    };
1852	  }
1853	
1854	  async doctor(options: { refresh?: boolean } = {}) {
1855	    const types = ["codex", "claude", "gemini", "opencode"];
1856	    const baseEnv = this.options.env || process.env;
1857	    if (options.refresh) {
1858	      await refreshCachedLoginShellPath(baseEnv);
1859	    }
1860	    const env = withManagedPath(baseEnv, undefined, { loginShellPathMode: "cached" });
1861	    const tools = createToolDiagnostics({ env, assumeManagedPath: true });
1862	    const results = await Promise.all(types.map((type) => this.runDoctorForType(type, { env, tools })));
1863	    return { results };
1864	  }
1865	
1866	  async prewarmWorker(input: {
1867	    type: string;
1868	    cwd: string;
1869	    model?: string | null;
1870	    mode?: string | null;
1871	    env?: Record<string, string>;
1872	    mcpServers?: acp.McpServer[];
1873	  }): Promise<{ ok: true; key: string; size: number; warmed: boolean }> {
1874	    this.applyRuntimeSettings(input.env ?? {}, { emit: false });
1875	    const type = input.type;
1876	    const cwd = input.cwd || process.cwd();
1877	    const requestedModel = input.model?.trim() || null;
1878	    const configuredAgent = this.options.config?.agents?.[type];
1879	    const baseEnv = this.getRuntimeEnv();
1880	    const mcpServers = [
1881	      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
1882	      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
1883	    ];
1884	    const skillRoots: string[] = [];
1885	
1886	    const finalEnv = withManagedPath({
1887	      ...baseEnv,
1888	      ...(configuredAgent?.env || {}),
1889	      ...(input.env || {}),
1890	    }, cwd);
1891	    applyProjectScopedCliStorage(type, cwd, finalEnv);
1892	    const credentialProfile = await resolveCredentialProfile({
1893	      type,
1894	      cwd,
1895	      env: finalEnv,
1896	      requestedProfile: undefined,
1897	      configuredProfile: configuredAgent?.credentialProfile,
1898	    });
1899	    applyCredentialProfileEnv(finalEnv, credentialProfile);

uuid: 5759a196-d6e5-4fa3-bdbb-3aab7fe614a2
parent: 2097ec4d-83b6-4d63-b202-8567ebf759f2
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-28T21:32:53.687Z","phase":null} -->
## Claude thinking · 2026-06-28T21:32:53.687Z

I'm tracing through the worker availability flow to pinpoint where the binary resolution differs between the UI and direct spawn paths. The UI route uses a cached login shell path mode with an undefined working directory when resolving the command, while the direct spawn path appears to follow a different resolution strategy.

The key divergence is likely in how the working directory affects binary discovery—when the availability check runs with `cwd: undefined`, it misses binaries in `node_modules/.bin` that would be found during spawn with the actual project directory set. There's also a potential difference in how the login shell PATH is resolved: the cached mode might return null on a cold cache while the blocking mode synchronously fetches the full PATH from the shell environment. Let me verify where `claude-agent-acp` actually lives on the system to determine which mechanism is the real culprit.

uuid: 67d23e6f-f038-416c-839c-5785ea71b44a
parent: 5759a196-d6e5-4fa3-bdbb-3aab7fe614a2

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-28T21:32:53.690Z","phase":null} -->
## Claude · 2026-06-28T21:32:53.690Z

Let me verify where `claude-agent-acp` actually resolves, and check both PATH-resolution divergences empirically.

uuid: 17b114db-adc0-4a6a-8b0d-76f0cecaf1ed
parent: 67d23e6f-f038-416c-839c-5785ea71b44a

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-28T21:32:55.841Z","phase":null} -->
## Claude tool call: Bash · 2026-06-28T21:32:55.841Z

```json
{
  "command": "echo \"=== login-shell PATH lookup ===\"; zsh -l -c 'command -v claude-agent-acp' 2>/dev/null || echo \"NOT on login-shell PATH\"\necho \"=== current process PATH lookup (non-login) ===\"; env -i HOME=\"$HOME\" PATH=\"/usr/bin:/bin:/usr/sbin:/sbin\" sh -c 'command -v claude-agent-acp' 2>/dev/null || echo \"NOT on minimal PATH\"\necho \"=== project node_modules/.bin ===\"; ls -la node_modules/.bin/claude-agent-acp 2>/dev/null || echo \"NOT in project node_modules/.bin\"\necho \"=== SHELL env var ===\"; echo \"SHELL=$SHELL\"\necho \"=== realpath of which ===\"; which claude-agent-acp 2>/dev/null && realpath \"$(which claude-agent-acp)\" 2>/dev/null"
}

uuid: fb21a98d-bb2b-4191-a253-edf1a1ebdc93
parent: 17b114db-adc0-4a6a-8b0d-76f0cecaf1ed
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-28T21:32:55.897Z","phase":null} -->
## Claude tool result: toolu_01BvmGMqqMViei6WZ9GJXhKY · 2026-06-28T21:32:55.897Z

```text
=== login-shell PATH lookup ===
/Users/masterman/.nvm/versions/node/v22.22.3/bin/claude-agent-acp
=== current process PATH lookup (non-login) ===
NOT on minimal PATH
=== project node_modules/.bin ===
NOT in project node_modules/.bin
=== SHELL env var ===
SHELL=/bin/zsh
=== realpath of which ===
/Users/masterman/.nvm/versions/node/v22.22.3/bin/claude-agent-acp
/Users/masterman/.nvm/versions/node/v22.22.3/lib/node_modules/@agentclientprotocol/claude-agent-acp/dist/index.js

uuid: 8167081c-3996-4927-b1ce-5b3befebcb06
parent: fb21a98d-bb2b-4191-a253-edf1a1ebdc93
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-28T21:32:55.898Z","phase":null} -->
## Claude attachment · 2026-06-28T21:32:55.898Z

```text
{
  "type": "task_reminder",
  "content": [],
  "itemCount": 0
}

binary omitted from archive

uuid: e600e031-6ba5-4f9b-8e0c-0fce7085f2b2
parent: 8167081c-3996-4927-b1ce-5b3befebcb06
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-06-28T21:33:34.739Z","phase":null} -->
## Claude thinking · 2026-06-28T21:33:34.739Z

So `claude-agent-acp` is located in an nvm-managed directory, and the key issue is whether that nvm bin directory is actually included in `envBinDirs`. The configuration references `NVM_BIN`, but that environment variable only gets included if it's explicitly set — and in the server process, nvm might not have exported it to the environment even though it sets up the PATH in login shells.

The nvm directory isn't in the hard-coded system paths, so it only reaches the managed PATH through three routes: inherited `process.env.PATH`, the `NVM_BIN` env var, or the login shell PATH. Direct control spawn uses blocking mode to synchronously read the login shell PATH, which includes nvm — so it works. But worker availability checks use cached mode, which returns null on a cold cache and only queues an async refresh. That means the first availability check builds a PATH without the login shell PATH, and if nvm isn't in the inherited environment or `NVM_BIN` isn't set, the binary lookup fails. That's the root cause.

The secondary factor is the `cwd` difference — availability passes undefined while spawn passes the actual cwd, which would add project bin dirs — but since the nvm binary isn't in node_modules/.bin, that's not what's driving the symptom. The blocking versus cached login shell PATH resolution is what matters. The server's process.env.PATH evidently doesn't include the nvm bin dir (otherwise inherited PATH would cover it), and the cache is cold when the availability check runs, so the binary appears missing even though direct spawns succeed. The root cause is clear: availability checks use cached login-shell PATH resolution which returns null on cold start, so the binary appears uninstalled until the cache warms up, whereas direct spawns use blocking resolution and always find it. The fix options involve either switching availability probes to blocking mode (but that slows down the catalog route) or warming the cache beforehand, and I should note that this error string triggers supervisor retries, making it a recoverable failure pattern.

uuid: 26b87688-4c4c-48f5-99f2-597a5166a7c6
parent: e600e031-6ba5-4f9b-8e0c-0fce7085f2b2

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-28T21:33:51.479Z","phase":null} -->
## Claude · 2026-06-28T21:33:51.479Z

## Root cause

`claude-agent-acp` on this machine lives at:

```
/Users/masterman/.nvm/versions/node/v22.22.3/bin/claude-agent-acp
```

That nvm directory is **only reachable via the login‑shell PATH**. It is not in the hard‑coded `systemBinDirs` (homebrew/usr/local/…), not in `envBinDirs` unless `NVM_BIN` happens to be exported, not in the project's `node_modules/.bin`, and — critically — not in the server process's inherited `process.env.PATH` when the runtime is launched outside an nvm‑active login shell (launchd, an IDE, a process manager, etc.).

The two code paths resolve PATH differently, and that's the whole bug:

**Direct Claude control spawn** — `manager.startAgent` (manager.ts:1428):
```ts
const finalEnv = withManagedPath({ ...baseEnv, ... }, cwd);  // no options → loginShellPathMode: "blocking"
```
`withManagedPath` defaults to `loginShellPathMode: "blocking"`, so `buildManagedPath` → `readLoginShellPath(env, "blocking")` **synchronously runs `zsh -l -c 'printf %s "$PATH"'`**, gets the nvm bin dir, finds the binary, and the session launches. ✅

**Worker availability probe** — both the catalog route and the doctor use `"cached"`:
- `frontendCatalogCommandResolver` (agents-catalog.ts:38): `withManagedPath(env, undefined, { loginShellPathMode: "cached" })`
- `AgentRuntimeManager.doctor` (manager.ts:1860): same

In `"cached"` mode, `readLoginShellPath` (tool-env.ts:427‑429) returns `cached?.path ?? null` and merely kicks off an **async** refresh. On a cold cache the login‑shell PATH contributes **nothing**, so the managed PATH for the probe omits the nvm dir → `which`/`resolveCommand("claude-agent-acp")` returns null → `isSpawnableWorkerType` reports `"claude worker binary is not installed."`

So availability and spawn disagree purely because availability reads a cold/empty cached login‑shell PATH while the spawn does a blocking read. (The `cwd` difference — `undefined` for the probe vs the project dir for spawn — is a second divergence but irrelevant here, since the binary isn't in `node_modules/.bin`.)

Note this isn't cosmetic: `retry.ts:55` treats `/worker binary is not installed/` as a recoverable supervisor error, so a cold‑cache false negative can also drive needless failover/retry churn.

## Recommended fix

Close the gap between detection and spawn so the probe sees the same PATH the spawn will use, without making every catalog request pay a synchronous login‑shell probe.

**Preferred — seed the login‑shell PATH cache on a cold read.** In `readLoginShellPath` (tool-env.ts:426‑429), when `mode === "cached"` and there is no cache entry yet, do one blocking read to populate the cache, then fall back to async refresh on subsequent calls:

```ts
const cached = loginShellPathCache.get(cacheKey);
if (!cached) {
  const path = readLoginShellPathBlocking(shell, env);   // one-time cold seed
  loginShellPathCache.set(cacheKey, { path, refreshing: false });
  return path;
}
refreshLoginShellPath(cacheKey, shell, env);
return cached.path ?? null;
```

This makes the *first* availability check correct (it matches the blocking spawn path) while keeping every later check fast — and it fixes all `"cached"` callers at once.

**Alternative / complementary:**
- Warm the cache explicitly at runtime startup by awaiting `refreshCachedLoginShellPath(baseEnv)` once (the doctor already does this only on `?refresh=1`), so the first non‑refresh catalog load isn't cold.
- Make `isSpawnableWorkerType`'s "not installed" path do a blocking confirm before declaring the binary missing, so a cold cache can never produce a false negative that the actual spawn would contradict.

I'd go with the cold‑seed change to `readLoginShellPath` as the primary fix — it's the smallest change that makes availability authoritative and matches real spawn behavior. I did not modify anything (read‑only investigation as requested).

uuid: 03a323fb-1683-4ea7-8fe3-95db4ec05d79
parent: 26b87688-4c4c-48f5-99f2-597a5166a7c6

<!-- /codex-event -->

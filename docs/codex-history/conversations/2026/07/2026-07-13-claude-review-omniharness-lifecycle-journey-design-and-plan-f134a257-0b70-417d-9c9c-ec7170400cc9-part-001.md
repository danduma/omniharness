---
provider: "claude"
codex_thread_id: "f134a257-0b70-417d-9c9c-ec7170400cc9"
title: "Review OmniHarness lifecycle journey design and plan"
started_at: "2026-07-13T18:06:48.154Z"
updated_at: "2026-07-13T18:09:36.013Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review OmniHarness lifecycle journey design and plan

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:06:48.154Z","phase":null} -->
## Claude state: queue-operation · 2026-07-13T18:06:48.154Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-13T18:06:48.154Z",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9",
  "content": "You are my second-opinion planning reviewer. Review only these two files using the Read tool, and do not inspect or edit any other file:\n\n- /Users/masterman/NLP/omniharness/docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md\n- /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md\n\nUser goal: Safely test OmniHarness like a human with a real Claude Code worker routed through GPT-5.6 SOL at low effort. The test must use a disposable separate project, create and switch among multiple conversations, interrupt a busy worker with changed instructions, stop and resume another worker, verify output reaches the UI, exercise reload and reconnect, diagnose state mismatches, fix confirmed root causes, and clean only test-owned data.\n\nCritical constraints:\n- Never create a branch or worktree.\n- Never delete unrelated files, conversations, projects, or artifacts.\n- The real test must not modify the OmniHarness repository or important user files.\n- UI mutations must happen through the real browser; backend state is an after-action oracle only.\n- Use the existing canonical event/snapshot/control plane and unified worker JSONL.\n- Every discovered production bug needs a deterministic failing test before its fix.\n- The real-agent run must be opt-in, loopback-only, low effort, bounded, and secret-safe.\n- The implementation plan must be executable by another engineer without guessing.\n\nJudge whether the design and implementation plan are ready to use.\n\nLook for:\n- missing requirements or user instructions,\n- vague/open-ended tasks or unsafe cleanup behavior,\n- unnecessary scope or over-engineering,\n- state ownership, freshness, completeness, ordering, terminal-state, and race gaps,\n- observability or error-transparency gaps,\n- a live test that could pass without proving the human-visible journey,\n- sequencing problems, missing exact file responsibilities, or weak verification,\n- places where the plan silently relies on mocks, reloads, sleeps, fallbacks, or API mutations.\n\nReturn exactly:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:06:48.155Z","phase":null} -->
## Claude state: queue-operation · 2026-07-13T18:06:48.155Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-13T18:06:48.155Z",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-13T18:06:48.180Z","phase":null} -->
## User · 2026-07-13T18:06:48.180Z

You are my second-opinion planning reviewer. Review only these two files using the Read tool, and do not inspect or edit any other file:

- /Users/masterman/NLP/omniharness/docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md
- /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md

User goal: Safely test OmniHarness like a human with a real Claude Code worker routed through GPT-5.6 SOL at low effort. The test must use a disposable separate project, create and switch among multiple conversations, interrupt a busy worker with changed instructions, stop and resume another worker, verify output reaches the UI, exercise reload and reconnect, diagnose state mismatches, fix confirmed root causes, and clean only test-owned data.

Critical constraints:
- Never create a branch or worktree.
- Never delete unrelated files, conversations, projects, or artifacts.
- The real test must not modify the OmniHarness repository or important user files.
- UI mutations must happen through the real browser; backend state is an after-action oracle only.
- Use the existing canonical event/snapshot/control plane and unified worker JSONL.
- Every discovered production bug needs a deterministic failing test before its fix.
- The real-agent run must be opt-in, loopback-only, low effort, bounded, and secret-safe.
- The implementation plan must be executable by another engineer without guessing.

Judge whether the design and implementation plan are ready to use.

Look for:
- missing requirements or user instructions,
- vague/open-ended tasks or unsafe cleanup behavior,
- unnecessary scope or over-engineering,
- state ownership, freshness, completeness, ordering, terminal-state, and race gaps,
- observability or error-transparency gaps,
- a live test that could pass without proving the human-visible journey,
- sequencing problems, missing exact file responsibilities, or weak verification,
- places where the plan silently relies on mocks, reloads, sleeps, fallbacks, or API mutations.

Return exactly:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone

uuid: f7c08fe9-050f-4e7a-a6bf-8c3356f2080e

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:06:48.180Z","phase":null} -->
## Claude attachment · 2026-07-13T18:06:48.180Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-my-second-opinion-cheeky-treehouse.md",
  "planExists": false
}

binary omitted from archive

uuid: 8e167cfa-2405-44bf-949d-36ba3a502620
parent: f7c08fe9-050f-4e7a-a6bf-8c3356f2080e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-13T18:06:50.792Z","phase":null} -->
## Claude thinking · 2026-07-13T18:06:50.792Z



uuid: 29ecf403-38be-4621-824b-ebb6fedf6a9e
parent: 8e167cfa-2405-44bf-949d-36ba3a502620

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-13T18:06:51.522Z","phase":null} -->
## Claude tool call: Read · 2026-07-13T18:06:51.522Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md"
}

uuid: e7b60e59-4231-4368-bd56-760bbfec5702
parent: 29ecf403-38be-4621-824b-ebb6fedf6a9e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-13T18:06:51.539Z","phase":null} -->
## Claude tool result: toolu_01H6tHgj9nUk7ExjacKsfoXw · 2026-07-13T18:06:51.539Z

````text
1	# Claude GPT-5.6 Live Lifecycle Journey Design
2	
3	**Date:** 2026-07-13
4	
5	**Status:** Ready for implementation planning
6	
7	## Purpose
8	
9	Prove that a real user can run Claude Code through OmniHarness with the routed
10	`gpt-5.6-sol` model at low effort, keep several conversations straight, change
11	instructions while a worker is busy, stop and resume work, switch and reload
12	without losing state, and see every completed worker response in the UI.
13	
14	This is not a mock-model happy path. The current milestone uses the real local
15	OmniHarness app, the real CLIProxyAPI connection, the real Claude Code worker,
16	and a disposable project outside the OmniHarness repository. Deterministic
17	tests remain responsible for exact state-machine and race coverage; the live
18	journey proves that those pieces compose into a usable product.
19	
20	## Product outcome
21	
22	An OmniHarness developer can run one opt-in command or follow the same mission
23	in the in-app browser and obtain a trustworthy answer to all of these questions:
24	
25	1. Can the user add a disposable project from the UI?
26	2. Can the user select Claude Code, `GPT-5.6 SOL`, and Low effort?
27	3. Does a new conversation appear once, remain selected, and show honest work
28	   state while the worker is active?
29	4. Can the user switch among three sessions without transcript, selection,
30	   project, model, draft, or status state leaking between them?
31	5. Can a busy worker receive changed instructions immediately, with the queued
32	   row and transcript reflecting exactly one accepted message?
33	6. Does Stop end the real worker turn and clear all working indicators?
34	7. Can a follow-up resume the stopped conversation and make the new output
35	   visible without a hard reload?
36	8. Do reload and SSE reconnect restore the same conversations, transcripts,
37	   statuses, and selection?
38	9. When the UI disagrees with the backend, can the test identify the first
39	   boundary where the state diverged?
40	10. Can all test conversations, workers, artifacts, and temporary files be
41	    removed without touching user projects or unrelated conversations?
42	
43	## User and jobs
44	
45	The primary user is the human builder operating OmniHarness locally.
46	
47	The core job is to delegate work to a coding agent and trust that the UI still
48	represents the same live conversation after normal lifecycle operations.
49	
50	Supporting jobs in this milestone are:
51	
52	- configure the intended harness/model/effort before sending;
53	- understand whether each session is starting, working, queued, stopped,
54	  recoverable, awaiting input, completed, or failed;
55	- change direction without starting a second accidental turn;
56	- leave one conversation, work in another, and return without losing context;
57	- stop expensive or incorrect work and know that it really stopped;
58	- continue a stopped session without losing its transcript or worker identity;
59	- recover after refresh or event-stream interruption;
60	- inspect the event, database, and worker-stream evidence when the screen is
61	  wrong;
62	- clean up only the resources created by the journey.
63	
64	## Scope
65	
66	### Included
67	
68	- An opt-in Playwright configuration for the already-running local app.
69	- A safe live-journey runner with explicit real-token and local-target guards.
70	- A temporary, dependency-free app project created under the operating
71	  system's temporary directory, with a `.gitignore` and an ownership marker.
72	- Browser-only mutations for project addition, conversation creation, model and
73	  effort selection, session switching, interrupt, stop, follow-up/resume, and
74	  reload.
75	- Read-only control-plane oracles using canonical snapshots, named event logs,
76	  conversation/worker entry routes, and SQLite only for post-action comparison
77	  and failure diagnosis.
78	- Three real Claude Code conversations using `cliproxyapi:gpt-5.6-sol` at Low
79	  effort.
80	- Deterministic manager, route, lifecycle, and race tests for every state bug
81	  found by the live run, written before the fix.
82	- Focused fixes for confirmed root causes.
83	- Failure artifacts: trace, screenshot, visible-state checkpoint, redacted
84	  event transcript, and owned-resource manifest under ignored test output.
85	- Targeted cleanup of only the journey's run IDs and temporary project.
86	
87	### Not included in this milestone
88	
89	- Exercising Codex, Gemini, OpenCode, native Claude models, or other gateway
90	  models. The harness is designed so those can be added as later conformance
91	  profiles, but they are not part of this checklist.
92	- A permanent sample app inside the OmniHarness repository.
93	- Running the real-token journey in ordinary CI or as part of `pnpm test`.
94	- Bypassing authentication in the normal local app.
95	- Editing shell profiles, Claude settings, or global CLI configuration.
96	- Deleting unrelated conversations or calling the bulk conversation-deletion
97	  script.
98	- Treating screenshots, logs, HTTP 200 responses, or a passing mock test as
99	  proof that the user journey works.
100	
101	## Safety boundary
102	
103	The live runner refuses to start unless all of these conditions hold:
104	
105	- the target URL is loopback (`localhost`, `127.0.0.1`, or `::1`);
106	- the caller explicitly opts into a real-agent run;
107	- authentication is supplied at runtime or an already authenticated in-app
108	  browser is used;
109	- the gateway status is enabled, running, connected, and advertises or accepts
110	  `gpt-5.6-sol`;
111	- the chosen project path is under the operating system temporary directory;
112	- the project contains a journey ownership marker created by this run;
113	- the project path is not the OmniHarness repository and is not any registered
114	  user project;
115	- the journey manifest starts empty and records every run ID it creates.
116	
117	The worker prompt repeats the filesystem boundary and forbids package installs,
118	commits, branch operations, and edits outside the temporary project. Cleanup
119	uses the recorded run IDs and ownership marker; it never infers ownership from
120	a title prefix alone.
121	
122	Secrets are never written to traces, manifests, source files, or command-line
123	arguments. A live-test password is read from a runtime environment variable or
124	entered into the in-app browser for the local instance only.
125	
126	## Test project and missions
127	
128	The project is created under a path such as:
129	
130	```text
131	/tmp/omniharness-live-journey-<random>/
132	```
133	
134	It begins with only:
135	
136	```text
137	.gitignore
138	.omniharness-live-journey.json
139	```
140	
141	The project is deliberately dependency-free so the journey does not depend on
142	network package installation and can be removed as one owned directory.
143	
144	### Conversation A: build and interrupt
145	
146	The first prompt asks the worker to create a small browser app called Research
147	Relay using `index.html`, `styles.css`, `app.js`, and `README.md`. It must support
148	adding research notes, tags, filtering, localStorage persistence, and a visible
149	checklist. The worker must inspect and validate its files before completing.
150	
151	After the worker is visibly active and the first durable output or owned file
152	exists, the user changes direction through the busy composer:
153	
154	```text
155	Change direction: use a warm amber theme, add Export JSON, and continue from
156	the work already completed. Do not restart or duplicate files.
157	```
158	
159	The UI must show that the message is queued or being delivered, then the test
160	uses the visible interrupt/send-now action (or the documented Escape action)
161	to deliver it. The message must appear exactly once in the worker stream, and
162	the pending queue item must disappear once accepted into chat.
163	
164	### Conversation B: stop and resume
165	
166	The second prompt asks the worker to inspect the app, perform a careful
167	accessibility and usability audit, and write `AUDIT.md` with exactly five
168	prioritized findings. While this turn is visibly working, the user presses the
169	real Stop control.
170	
171	The UI must become non-working, the run and worker must reach a truthful stopped
172	state, and named terminal evidence must exist. The user then sends:
173	
174	```text
175	Resume this session. Finish AUDIT.md only, using the existing context and
176	files. Do not modify the app.
177	```
178	
179	The session may reattach or recreate according to production policy, but that
180	decision must be named. The new answer and `AUDIT.md` must appear without a
181	manual reload.
182	
183	### Conversation C: complete reference state
184	
185	The third prompt asks the worker to inspect the project and write `STATUS.md`
186	with a concise file inventory and validation summary, without modifying the
187	app. It is allowed to complete normally. This gives the switching test a known
188	terminal conversation while A or B has other lifecycle states.
189	
190	## Human-level journey
191	
192	All mutations are performed through visible controls:
193	
194	1. Unlock the local app if needed.
195	2. Add the temporary project with **Add project** and **Select Project Folder**.
196	3. Select **Direct control**, **Claude Code**, **GPT-5.6 SOL**, and **Low**.
197	4. Start Conversation A and capture its run ID from the selected URL or
198	   browser-visible conversation identity.
199	5. Confirm visible active state, switch away, and confirm A remains listed with
200	   the same status.
201	6. Create Conversation B, switch A -> B -> A -> B, and confirm neither
202	   conversation disappears, duplicates, or borrows the other's transcript.
203	7. Interrupt A with the changed instruction and verify queue-to-transcript
204	   movement.
205	8. Stop B, verify the working indicator and Stop control disappear, and then
206	   resume B with a follow-up.
207	9. Create and complete Conversation C.
208	10. Repeatedly switch A -> C -> B -> A while statuses change.
209	11. Reload the selected session, then simulate an SSE disconnect/reconnect in
210	    the headless profile and repeat the switch loop.
211	12. Verify final files and visible assistant answers.
212	13. Compare the visible state with the canonical server evidence.
213	14. Delete only A, B, and C through the production conversation delete flow,
214	    remove the project from OmniHarness if that action is available and safe,
215	    then remove the owned temporary directory.
216	
217	The in-app agentic run follows the same mission card and does not use backend
218	state to decide where to click. The deterministic Playwright run may use the
219	server evidence as assertions after each visible action, but never as a
220	shortcut for a mutation.
221	
222	## State authority and invariants
223	
224	| State | Owner | Token/order | Completeness and UI rule |
225	| --- | --- | --- | --- |
226	| Selected project/run | URL + `HomeUiStateManager` | project path + run ID + selection request ID | Late create/load results cannot steal a newer selection. |
227	| Conversation catalog | server snapshot, mirrored by `EventStreamStateManager` | snapshot event ID and deterministic `(updatedAt, id)` order | Cache is preview only; partial run snapshots cannot erase known or optimistic runs. |
228	| Run lifecycle | server `runs` row and named events | run ID + event ID | UI cannot invent working/done by diffing transcripts. |
229	| Worker lifecycle | server worker row/runtime decision | worker ID + event ID | `cancelled`, terminal run state, or terminal event defeats stale current text. |
230	| Worker transcript | unified append-only worker JSONL | worker ID + monotonic seq | Fallback rows may pre-render but cannot duplicate or replace authoritative entries. |
231	| Busy message queue | server queued-message rows, optimistically mirrored by `BusyMessageQueueManager` | message ID + status transition | Accepted/delivered items leave the drawer; cancelled/failed items cannot resurrect from late responses. |
232	| SSE connection | `LiveEventConnectionManager` over server event ring | `Last-Event-ID` | Reconnect replays the gap or requires a complete resync; an open socket alone is not authority. |
233	| Gateway readiness | server gateway singleton/snapshot | gateway revision | Cached model choices do not imply readiness; routed spawn must refuse rather than fall back. |
234	| Journey ownership | live-test manifest | journey ID | Cleanup touches only recorded runs and the marked temp directory. |
235	
236	For every async result, the implementation asks: what can arrive late, out of
237	order, partially, twice, or after the user selected a different session? Tests
238	must prove that such a result cannot mutate the newly selected context.
239	
240	## Status contract
241	
242	The UI must distinguish these user-relevant states:
243	
244	- **Starting/working:** a real turn is active; a visible pending assistant state
245	  and Stop control identify the concrete worker.
246	- **Queued:** a follow-up is accepted for later delivery and remains actionable.
247	- **Interrupting/delivering:** the queued item has left the ordinary queue and
248	  cannot appear twice.
249	- **Awaiting user:** the worker asked for input and no fake working spinner is
250	  shown.
251	- **Stopped/cancelled:** the worker is no longer doing work; stale worker text
252	  cannot keep the conversation active.
253	- **Recoverable:** the previous turn stopped or failed in a way that supports a
254	  visible resume action or follow-up.
255	- **Completed:** final output is durable and visible; no Stop control or
256	  trailing Thinking indicator remains.
257	- **Failed:** the real cause is visible and a stable `error.surfaced` event is
258	  inspectable.
259	
260	Sidebar, header, transcript, and control states must agree. Any disagreement is
261	a test failure even if one surface is eventually corrected by reload.
262	
263	## Observability contract
264	
265	The live journey records a redacted checkpoint after every important action:
266	
267	- timestamp and journey step;
268	- selected URL, project, and run ID;
269	- visible conversation titles and status indicators;
270	- visible transcript entry IDs or stable text hashes;
271	- canonical snapshot anchor ID;
272	- relevant named events since the prior anchor;
273	- run, worker, and queued-message state;
274	- latest worker-stream sequence for each owned worker.
275	
276	Expected production evidence includes the existing typed events such as
277	`worker.spawned`, `worker.status`, `worker.terminal`, `worker.reattached`,
278	`worker.recreated`, `worker.entry_appended`, queue interruption decisions,
279	recovery events, `conversation.deleted`, `stream.resync_required`, and
280	`error.surfaced` when applicable.
281	
282	If the event is absent, the server did not publish the decision and the failure
283	is not classified as a frontend-only bug. If the event and persisted state are
284	correct but the screen is wrong, the test captures the responsible client
285	manager snapshot and stale owner token before any fix is attempted.
286	
287	## Failure artifact and privacy rules
288	
289	On failure, the harness retains only ignored artifacts under `test-results/`:
290	
291	- Playwright trace and screenshot;
292	- a bounded DOM snapshot around the affected surface;
293	- a redacted event transcript for owned run IDs;
294	- the journey manifest and checkpoint report;
295	- bounded tails of owned worker JSONL files.
296	
297	The report excludes passwords, gateway tokens, OAuth URLs, credential files,
298	unrelated run titles/content, and full database dumps. Passing runs may retain a
299	short summary but not secrets or user conversation content.
300	
301	## Deterministic regression strategy
302	
303	The live journey is a finder and final proof, not the only regression test.
304	Each observed failure is reduced before production code changes:
305	
306	- stale selection, catalog disappearance, snapshot merge, and status classifier
307	  bugs become focused Manager tests;
308	- transcript duplication or missing output becomes worker-entry/transcript
309	  manager and unified-stream tests;
310	- interrupt, stop, resume, finalization, or reattach bugs become headless
311	  lifecycle HTTP/SSE scenarios with exact named-event transcripts;
312	- route contract failures become runtime route tests;
313	- only visible layout, affordance, focus, and cross-session composition remain
314	  in Playwright.
315	
316	Every fix follows red -> green -> full focused verification. A screenshot or a
317	single successful manual retry is never the regression test.
318	
319	## Pass criteria
320	
321	The current milestone passes only when all of the following are true in a
322	fresh real journey:
323	
324	- all three conversations are created through the UI with Claude Code,
325	  `GPT-5.6 SOL`, and Low effort;
326	- the gateway route is used and no native-model fallback occurs;
327	- each conversation appears once and remains stable through switching;
328	- active, queued, stopped, recoverable, and completed states are visibly honest;
329	- the interrupt instruction is delivered once and reflected in A's final app;
330	- Stop ends B's actual turn and clears active UI promptly;
331	- B resumes and its new worker output appears without reload;
332	- C completes and remains terminal through all switches;
333	- transcript content never crosses run boundaries;
334	- reload and SSE reconnect preserve selection, transcripts, and status;
335	- canonical snapshots, named events, SQLite rows, and worker streams agree with
336	  the final visible state;
337	- every bug found has a deterministic failing regression and a verified fix;
338	- focused tests, the lifecycle suite, typecheck, build, live Playwright run, and
339	  the in-app agentic mission all pass with fresh evidence;
340	- only journey-owned test data is removed at the end.
341	
342	## North star and later profiles
343	
344	The north star is a provider-agnostic conformance suite in which every supported
345	OmniHarness worker type and model route must pass the same lifecycle contract:
346	create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload,
347	and clean up.
348	
349	After this milestone is proven with Claude Code + `gpt-5.6-sol`, later profiles
350	can supply different harness/model selectors and safe missions while reusing
351	the same state and observability assertions. Those profiles are product
352	direction, not part of this implementation checklist.
353	

uuid: f0aadde2-bc20-425d-b2fb-3d81625e4fd9
parent: e7b60e59-4231-4368-bd56-760bbfec5702
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-13T18:06:52.305Z","phase":null} -->
## Claude tool call: Read · 2026-07-13T18:06:52.305Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md"
}

uuid: dbe34490-3fc4-4b33-86da-b087f0ff3303
parent: f0aadde2-bc20-425d-b2fb-3d81625e4fd9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-13T18:06:52.689Z","phase":null} -->
## Claude tool result: toolu_013ibT4jTCKn6gJVWECL11Ji · 2026-07-13T18:06:52.689Z

```text
1	# Claude GPT-5.6 Live Lifecycle Journey Implementation Plan
2	
3	> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. Mark a checkbox only after its stated evidence has been run and read.
4	
5	**Goal:** Add a safe, repeatable human-level test journey that proves Claude Code can use `GPT-5.6 SOL` at Low effort across interrupt, multi-session switching, stop, resume, reload, and reconnect, then fix every confirmed state or delivery bug with deterministic regression coverage.
6	
7	**Architecture:** Keep one production control plane and add an opt-in Playwright consumer of it. All mutations in the live journey use the real UI; canonical snapshots, named events, targeted route reads, SQLite, and unified worker JSONL act only as after-action oracles. The runner owns a marked temporary project and a manifest of exact run IDs so real-agent testing cannot touch the repository or unrelated conversations.
8	
9	**Tech Stack:** Next.js 15, React 19, TypeScript, global Manager classes, Playwright, Vitest, lifecycle HTTP/SSE harness, SQLite/Drizzle, unified worker JSONL, CLIProxyAPI, Claude Code ACP.
10	
11	**Design specification:** `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
12	
13	**North Star Product:** A provider-agnostic conformance suite that every OmniHarness CLI/model combination must pass for create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload, and cleanup.
14	
15	**Current Milestone:** Real Claude Code through `cliproxyapi:gpt-5.6-sol` at Low effort in one disposable project with three conversations and the full lifecycle journey.
16	
17	**Future Product Direction:** Add profile data for native Claude, Codex, Gemini, OpenCode, and later gateway models only after the current profile is reliable. This context is not part of the implementation checklist below.
18	
19	**Final Functionality Standard:** The milestone is complete only when the real browser journey passes twice from fresh state, every discovered defect has a red-green deterministic regression, server evidence agrees with the visible UI, and only journey-owned data is cleaned up.
20	
21	---
22	
23	## Execution rules
24	
25	- [ ] Work directly in the current checkout. Never create a branch or worktree.
26	- [ ] Preserve all unrelated dirty-worktree changes and do not reformat touched files broadly.
27	- [ ] Do not delete any existing source file, conversation, project, branch, or artifact.
28	- [ ] Use `apply_patch` for source and test edits.
29	- [ ] Reuse the already-running app at `http://localhost:3035` (or the configured local URL); do not start a competing dev server.
30	- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md`, `docs/architecture/worker-conversation-stream.md`, and `docs/architecture/direct-control-session-regressions.md` before changing server lifecycle behavior.
31	- [ ] Use the unified worker stream through `appendWorkerEntry`; do not add another transcript store.
32	- [ ] Emit typed named events for every new server decision and `error.surfaced` for every new user-relevant failure.
33	- [ ] Put any new visible copy in every `shared/locales/*.json` file and render it through `t()`; prefer no new product copy for the harness.
34	- [ ] Keep shared client state in the existing Manager classes. Every async mutation, snapshot, timer, and stream callback must prove current ownership before updating visible state.
35	- [ ] Write the failing deterministic test before each production fix and watch the expected failure.
36	- [ ] Use condition-based waits tied to visible or durable state. Do not make fixed sleeps the primary synchronization mechanism.
37	- [ ] Keep real-agent tests opt-in and out of normal `pnpm test`, default Playwright, and CI.
38	- [ ] Keep passwords, gateway tokens, OAuth data, session cookies, and unrelated conversation content out of test output and source control.
39	
40	## File map
41	
42	### New live-journey harness
43	
44	- `playwright.live.config.ts`: opt-in configuration for an already-running local app; one worker, no retries, long per-test deadline, and trace/screenshot retention on failure.
45	- `tests/e2e/live/types.ts`: journey manifest, checkpoint, owned run, gateway preflight, and redacted evidence contracts.
46	- `tests/e2e/live/safety.ts`: loopback validation, temp-root containment, ownership-marker checks, repository/project exclusion, explicit real-agent opt-in, and secret-free manifest helpers.
47	- `tests/e2e/live/auth.ts`: unlock the real local app from a runtime-only password without storing it in source or the durable report.
48	- `tests/e2e/live/omniharness-ui.ts`: stable browser operations for folder selection, harness/model/effort selection, conversation creation, switching, interrupt/send-now, stop, resume/follow-up, reload, and visible-state capture.
49	- `tests/e2e/live/control-plane-oracle.ts`: read-only canonical snapshot, event-log, worker-entry, and targeted run evidence for journey-owned IDs.
50	- `tests/e2e/live/project-fixture.ts`: create the marked dependency-free temporary project and remove it only after ownership and containment checks pass.
51	- `tests/e2e/live/checkpoint-reporter.ts`: write bounded, redacted ignored artifacts and a step-by-step UI/server comparison.
52	- `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`: the three-conversation live journey and final filesystem assertions.
53	- `scripts/cleanup-live-agent-journey.ts`: recover cleanup from an interrupted run using a manifest path, targeted run IDs, and the ownership marker; never bulk-delete conversations.
54	- `tests/e2e/live/safety.test.ts`: deterministic tests for all guard and cleanup-refusal cases.
55	- `tests/e2e/live/checkpoint-reporter.test.ts`: deterministic redaction and mismatch-report tests.
56	
57	### Existing configuration and scripts
58	
59	- `.gitignore`: confirm existing `/test-results/` and `/playwright-report/` coverage is sufficient; add only a focused live-auth or manifest path if a new artifact falls outside those roots.
60	- `package.json`: add `test:e2e:live:claude` and `test:e2e:live:cleanup`; do not change the default `test:e2e` command.
61	- `playwright.config.ts`: leave the mock/default suite behavior unchanged unless a shared type-only extraction is required.
62	
63	### Deterministic regression targets used only when the live journey exposes a failure
64	
65	- `tests/app/event-stream-state-manager.test.ts` / `src/app/home/EventStreamStateManager.ts`: catalog completeness, stale snapshot, optimistic-run retirement, and deterministic ordering.
66	- `tests/app/run-selection-effects.test.ts` / `src/app/home/useRunSelectionEffects.ts`: late selection/load ownership and URL/session restoration.
67	- `tests/app/home-view-model.test.ts` / `src/app/home/useHomeViewModel.ts`: selected-run composition and cross-session projection.
68	- `tests/app/home/sidebar-activity.test.ts` / `src/app/home/sidebar-activity.ts`: honest per-session sidebar status.
69	- `tests/app/direct-control-activity.test.ts` / `src/app/home/direct-control-activity.ts`: active, cancelled, terminal, and stale-current-text classification.
70	- `tests/app/live-event-connection-manager.test.ts` / `src/app/home/LiveEventConnectionManager.ts`: replay, resync, owner fencing, and reconnect state.
71	- `tests/app/worker-entries-manager.test.ts` / `src/app/home/WorkerEntriesManager.ts`: seq ordering, revalidation after loaded-empty state, and selection isolation.
72	- `tests/app/conversation-transcript-manager.test.ts` / `src/app/home/ConversationTranscriptManager.ts`: fallback/stream dedupe and transcript ownership.
73	- `tests/app/busy-message-queue-manager.test.ts` / `src/app/home/BusyMessageQueueManager.ts`: interrupt acceptance, optimistic hiding, late-response rejection, and no resurrection. Create the focused test file if it does not already exist.
74	- `tests/ui/conversation-actions.test.ts`, `tests/ui/sidebar-layout.test.ts`, and `tests/ui/composer-shell.test.ts`: source-level or rendered affordance contracts when the visible control is wrong.
75	- `tests/conversations/direct-run-status.test.ts` / `src/server/conversations/direct-run-status.ts`: successful-turn terminal resolution.
76	- `tests/server/conversations/worker-turn-gate.test.ts`, `tests/server/conversations/reconcile-user-messages.test.ts`, and focused send/queue tests: exactly-once acceptance and finalization.
77	- `tests/lifecycle/scenarios/conversation-continuation.test.ts`: follow-up persistence across SSE gaps.
78	- `tests/lifecycle/scenarios/direct-mode-rerun.test.ts`: stopped direct-session continuation.
79	- `tests/lifecycle/scenarios/worker-reattach.test.ts`: explicit reattach/recreate decision evidence.
80	- `tests/lifecycle/scenarios/sse-resume.test.ts`: replay or resync after disconnect.
81	- Create `tests/lifecycle/scenarios/direct-control-interrupt-stop-resume.test.ts` only if the existing scenarios cannot express the exact combined production sequence without conflating responsibilities.
82	
83	### Architecture and durable lessons
84	
85	- `docs/architecture/lifecycle-observability-and-testing.md`: document only genuinely new event/state invariants introduced by a fix.
86	- `docs/architecture/direct-control-session-regressions.md`: add the exact reproduced sequence and rule for a new direct-control bug class.
87	- `docs/superpowers/learnings/YYYY-MM-DD-<root-cause>.md`: one concise learning for each meaningful client/server ownership, persistence, recovery, or control-plane root cause fixed.
88	
89	### Large-file constraint
90	
91	`src/components/Terminal.tsx` and `src/components/home/ConversationMain.tsx` already exceed 1200 lines. The plan does not add harness logic to either file. If a confirmed UI root cause requires touching one, first extract the smallest cohesive state/behavior unit into a focused module and cover it with a failing test; do not expand the oversized component further.
92	
93	## State and data invariants
94	
95	- [ ] The server snapshot is authoritative for the complete conversation catalog only when its anchor and scope declare completeness; cached/scoped data is preview.
96	- [ ] A partial run or worker update may refine known state but may not erase other conversations, optimistic creations, delivered input, read markers, or stream entries.
97	- [ ] Selection-changing async work is fenced by project path, run ID, and request/operation ID and rechecks ownership immediately before mutation or navigation.
98	- [ ] Conversation ordering uses a deterministic tie-breaker such as `(updatedAt, id)`, never timestamp alone.
99	- [ ] The URL, `HomeUiStateManager`, selected snapshot scope, transcript manager, and composer all refer to the same run before visible state changes.
100	- [ ] The unified worker JSONL is the final transcript authority, keyed by worker ID and monotonic seq.
101	- [ ] A loaded-empty stream at seq 0 is an observation, not permanent completeness; selecting it again revalidates.
102	- [ ] Queue states are monotonic from the user's perspective. An item accepted into chat leaves the drawer immediately and cannot be resurrected by a stale poll or mutation result.
103	- [ ] Active UI requires real current activity. Terminal/cancelled run or worker evidence defeats stale `currentText`, old bridge snapshots, and optimistic `running` rows.
104	- [ ] Stop targets a concrete active worker and emits `worker.status` plus `worker.terminal`; the UI clears active controls without waiting for reload.
105	- [ ] Resume/follow-up publishes `worker.reattached` or `worker.recreated` as appropriate, persists the new turn through the normal finalization path, and appends visible output to the same conversation stream.
106	- [ ] SSE frames have IDs. Reconnect supplies `Last-Event-ID`, fills the gap from the ring, or receives `stream.resync_required` and bootstraps a complete snapshot.
107	- [ ] Gateway readiness has a revision and remains server-owned. Selecting an encoded routed model never falls back to native Claude.
108	- [ ] The journey manifest is the sole cleanup authority. A title prefix, temp-looking path, or absent database row is insufficient authorization to delete anything.
109	
110	## Task 1: Establish the baseline and lock the live mission
111	
112	**Files:**
113	
114	- Verify `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
115	- Read the three architecture documents listed in the execution rules
116	- No production source edits
117	
118	- [ ] Record the current dirty-worktree paths and treat them as user-owned baseline.
119	- [ ] Confirm the running proxy and Next server ports, login shell, gateway status, Claude model catalog, and `GPT-5.6 SOL` option through the real UI.
120	- [ ] Confirm the live URL is local and the app can be authenticated without changing the configured password.
121	- [ ] Run the focused gateway suites and existing direct-session/lifecycle suites before adding the harness; record pre-existing failures separately.
122	- [ ] Write the exact three prompts from the design into the live spec as constants. Keep them dependency-free, low-effort, and bounded to the owned temp project.
123	- [ ] Define checkpoints for `created`, `working`, `switched-away`, `interrupt-queued`, `interrupt-accepted`, `stopped`, `resumed`, `completed`, `reloaded`, `reconnected`, and `cleaned`.
124	- [ ] Confirm the UI controls' accessible contracts from the running app: Add project, folder dialog, Direct control, CLI harness, Worker model, Worker effort, Send/Stop, queue interrupt, conversation selection, and delete.
125	- [ ] Do not begin a real worker turn during this task.
126	
127	**Verification:**
128	
129	- [ ] Save only non-secret baseline results in the implementation notes.
130	- [ ] Run `git diff --check` and confirm this task changed documentation/test constants only.
131	
132	**Checkpoint:** The mission, cost boundary, UI actions, and existing failures are known before harness code or real token use.
133	
134	## Task 2: Build and test the safety boundary
135	
136	**Files:**
137	
138	- Create `tests/e2e/live/types.ts`
139	- Create `tests/e2e/live/safety.ts`
140	- Create `tests/e2e/live/project-fixture.ts`
141	- Create `tests/e2e/live/safety.test.ts`
142	
143	- [ ] Write failing tests that reject non-loopback URLs, missing real-agent opt-in, missing password/session input, repository paths, registered user-project paths, non-temp paths, `..` escapes, symlink escapes, missing/mismatched ownership markers, non-empty manifests at creation, and cleanup IDs absent from the manifest.
144	- [ ] Write failing tests that allow `localhost`, `127.0.0.1`, and `::1`, then create a random temp directory with `.gitignore` and an ownership marker containing only journey ID, created-at, and path.
145	- [ ] Watch the safety suite fail for the expected missing implementation, not for test setup.
146	- [ ] Implement pure guards first, then the minimal filesystem fixture.
147	- [ ] Make cleanup verify realpath containment, marker journey ID, and manifest ownership immediately before each destructive action.
148	- [ ] Refuse cleanup when any proof is missing; leave a clear recovery report instead of guessing.
149	- [ ] Ensure manifest serialization cannot contain passwords, cookies, tokens, OAuth URLs, arbitrary environment data, or unrelated run content.
150	- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts` and confirm all cases pass.
151	
152	**Checkpoint:** No browser or worker can be started until the test proves it owns a harmless local project and exact cleanup scope.
153	
154	## Task 3: Add the opt-in live Playwright surface
155	
156	**Files:**
157	
158	- Create `playwright.live.config.ts`
159	- Create `tests/e2e/live/auth.ts`
160	- Modify `package.json`
161	- Inspect `.gitignore`
162	
163	- [ ] Add a configuration test or import assertion that verifies the live config has no `webServer`, uses one worker, zero retries, a generous finite timeout, `trace: retain-on-failure`, `screenshot: only-on-failure`, and a loopback base URL.
164	- [ ] Configure `testDir` narrowly to `tests/e2e/live` so ordinary E2E tests cannot accidentally run real agents.
165	- [ ] Require `OMNIHARNESS_LIVE_E2E=1` and read `OMNIHARNESS_LIVE_E2E_PASSWORD` only at runtime. Allow an already-authenticated in-app journey as the manual alternative.
166	- [ ] Implement UI login using the current password form; never place the password in Playwright output, trace annotations, or manifest.
167	- [ ] Add `pnpm test:e2e:live:claude` without changing `pnpm test:e2e`.
168	- [ ] Confirm all live artifacts remain under ignored `test-results/`/`playwright-report/`; do not add a tracked auth state file.
169	- [ ] Run a preflight-only Playwright test that logs in, reaches the workspace, and exits without creating a project or conversation.
170	
171	**Checkpoint:** A developer can attach headless Chromium to the real local app safely, but no real agent work starts yet.
172	
173	## Task 4: Implement UI-only actions and visible checkpoints
174	
175	**Files:**
176	
177	- Create `tests/e2e/live/omniharness-ui.ts`
178	- Create `tests/e2e/live/checkpoint-reporter.ts`
179	- Create `tests/e2e/live/checkpoint-reporter.test.ts`
180	
181	- [ ] Write failing reporter tests for secret redaction, bounded DOM/event/stream tails, stable text hashing, mismatch classification, and omission of unrelated runs.
182	- [ ] Implement one UI helper per user action. Use `data-testid` only when the existing accessible name or stable URL cannot uniquely identify the control; never rely on `.first()` or positional CSS.
183	- [ ] Every action must take a fresh or still-valid DOM observation, prove a unique target, perform one mutation, and wait for a visible state transition.
184	- [ ] Capture selected URL/run, visible session list, status labels, transcript hashes, Stop/Send state, queued drawer state, and visible error state after each checkpoint.
185	- [ ] Add assertions that the selected conversation title and transcript remain stable through A -> B -> A switching before any server oracle is read.
186	- [ ] Do not put API mutation shortcuts in this helper.
187	- [ ] Run reporter unit tests and a no-agent browser smoke that opens/closes the project picker and changes then restores harness/model/effort selections.
188	
189	**Checkpoint:** The test can behave like a human and describe what the human sees without backend knowledge.
190	
191	## Task 5: Add the read-only control-plane oracle
192	
193	**Files:**
194	
195	- Create `tests/e2e/live/control-plane-oracle.ts`
196	- Extend `tests/e2e/live/checkpoint-reporter.test.ts`
197	
198	- [ ] Write failing tests for parsing the canonical snapshot anchor, scoping events to owned run IDs, deterministic event ordering, worker-entry monotonic seq, queue status comparison, and redaction.
199	- [ ] Read `/api/events?snapshot=1&persisted=1`, the dev event-log endpoint, targeted worker entries/transcript routes, and only the run IDs recorded in the journey manifest.
200	- [ ] Keep SQLite inspection behind a diagnostic function used after a mismatch or at final audit; query only owned run IDs and the tables named in the architecture debugging checklist.
201	- [ ] Implement comparison rules for selected run, catalog membership, sidebar status, run/worker state, queue state, transcript seq/content hashes, and terminal/active consistency.
202	- [ ] Classify the first divergence as control-plane missing decision, persistence/finalization gap, stream delivery gap, client ownership/merge bug, or visible affordance bug.
203	- [ ] Never use the oracle to create, send, interrupt, stop, resume, switch, or delete.
204	- [ ] Run the focused oracle/reporter tests.
205	
206	**Checkpoint:** When the screen is wrong, the harness points to the first disagreeing boundary instead of guessing.
207	
208	## Task 6: Write the real three-conversation journey before fixing anything
209	
210	**Files:**
211	
212	- Create `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`
213	
214	- [ ] Write the full test with the three prompts and checkpoints from the design.
215	- [ ] Preflight gateway status and the exact catalog value `cliproxyapi:gpt-5.6-sol`; refuse rather than substitute another model.
216	- [ ] Add the marked temporary project through **Add project** and the real folder picker.
217	- [ ] Select Direct control, Claude Code, `GPT-5.6 SOL`, and Low before every new conversation; assert the compound selection remains correct after session switches.
218	- [ ] Start A, record its URL/run ID, and wait for visible active state plus durable `worker.spawned`/`worker.status` evidence.
219	- [ ] Create B while A remains active, switch A -> B -> A -> B, and assert both sidebar rows, URL selection, model/effort, and transcript ownership.
220	- [ ] Send A's change-of-direction message while busy, verify queued state, use the visible interrupt/send-now action, and assert exactly one accepted stream input and no remaining pending row.
221	- [ ] Stop B through the visible Stop control and assert active UI clears; then send the resume follow-up and assert visible post-resume output without reload.
222	- [ ] Create C, let it complete, and use it as the known-terminal reference while A and B change state.
223	- [ ] Repeat A -> C -> B -> A switches while capturing checkpoints. Fail on disappearance, duplication, wrong status, transcript bleed, stale Thinking, missing Stop, or lost output.
224	- [ ] Reload the selected run and assert the same URL, transcript, and terminal/active status after authority loads.
225	- [ ] Drop and restore browser network/SSE in the Playwright profile, then assert replay or resync and repeat the switch loop.
226	- [ ] Verify `index.html`, `styles.css`, `app.js`, `README.md`, `AUDIT.md`, and `STATUS.md` inside the owned project and assert the interrupt requirements are present.
227	- [ ] Let the first run expose failures. Do not patch production code inside this task.
228	
229	**Verification:**
230	
231	- [ ] Run only the live spec with a single explicit real-agent opt-in.
232	- [ ] Preserve the first failing trace/checkpoint and record exact reproduction steps.
233	- [ ] If the journey passes, still inspect the complete event transcript and state comparisons before moving on.
234	
235	**Checkpoint:** There is one real, repeatable account of what currently breaks, with visible and server evidence tied to owned IDs.
236	
237	## Task 7: Reduce each failure to a deterministic red test
238	
239	**Files:**
240	
241	- Use the regression targets in the file map; do not choose a production file before tracing the failing boundary.
242	
243	- [ ] For each observed failure, read the full error/trace, reproduce it at least twice, and identify the first state boundary that diverges.
244	- [ ] Compare the broken path with the nearest working path in the same codebase.
245	- [ ] State one root-cause hypothesis and the evidence that supports it.
246	- [ ] Add the smallest failing deterministic test at the owning layer and run it to see the expected failure.
247	- [ ] For stale selection/catalog bugs, defer request A, switch to B, resolve A, and assert A cannot mutate B or erase catalog rows.
248	- [ ] For status bugs, table-test active, runnable, awaiting-user, cancelled, terminal, stale, and recoverable inputs across sidebar and conversation projections.
249	- [ ] For missing/duplicate output, reproduce fallback/stream arrival orders and worker seq gaps without a browser.
250	- [ ] For interrupt/stop/resume bugs, add a lifecycle event transcript asserting input acceptance, queue transition, terminal event, reattach/recreate decision, finalization, and final run state.
251	- [ ] For reconnect bugs, bootstrap at an anchor, emit during the gap, reconnect with the last ID, and assert replay or explicit resync.
252	- [ ] Do not combine unrelated root causes in one test or one patch.
253	
254	**Checkpoint:** Every production change that follows has a test that demonstrated the actual bug first.
255	
256	## Task 8: Implement minimal root-cause fixes
257	
258	**Files:**
259	
260	- Modify only the owning modules identified by Task 7.
261	- Add locale keys in all locale files only if a visible error/action needs new copy.
262	- Add or update architecture/learning docs for meaningful root causes.
263	
264	- [ ] Implement one minimal fix per confirmed hypothesis.
265	- [ ] Keep server authority on the server and client projection in Managers; do not add component-local arrays, parallel caches, translated persisted strings, or transaction-carried UI state.
266	- [ ] Fence every late callback with the correct compound owner token.
267	- [ ] Preserve partial/complete snapshot semantics and deterministic ordering.
268	- [ ] Reuse the existing successful worker-turn finalization path for interrupt, queue drain, stop/recovery follow-up, and reattach output.
269	- [ ] Emit a typed named decision and surfaced error where the server previously returned silently or swallowed a user-relevant failure.
270	- [ ] If `Terminal.tsx` or `ConversationMain.tsx` must change, extract a focused helper/module before adding behavior because both files are already oversized.
271	- [ ] Run the red test until green, then run all directly related Manager/route/lifecycle suites.
272	- [ ] If a hypothesis fails, return to evidence gathering. After three failed fixes for the same symptom, stop and review the architecture with the user instead of stacking a fourth patch.
273	- [ ] Record a durable learning for every meaningful state ownership, stream, persistence, stop/resume, or recovery root cause.
274	
275	**Checkpoint:** Confirmed causes are fixed at their source, with no symptom-only polling, reload, timeout, or fallback workaround.
276	
277	## Task 9: Add crash-safe targeted cleanup
278	
279	**Files:**
280	
281	- Create `scripts/cleanup-live-agent-journey.ts`
282	- Modify `package.json`
283	- Extend `tests/e2e/live/safety.test.ts`
284	
285	- [ ] Write failing tests for targeted deletion of manifest-owned run IDs, idempotent already-gone responses, refusal on unknown IDs, refusal on marker mismatch, refusal outside temp, and preservation of the report when cleanup is incomplete.
286	- [ ] Prefer deleting A/B/C through the same production conversation delete flow exercised by the UI. Allow a targeted authenticated DELETE fallback for cleanup only and record that fallback.
287	- [ ] Wait for `conversation.deleted` or verify an idempotent absent result for each owned ID.
288	- [ ] Confirm related workers, messages, queued rows, execution events, recovery rows, and run-data files are removed by production cascade behavior; never hand-delete database rows.
289	- [ ] Remove the temp directory only after all owned workers are terminal, all manifest run deletions are confirmed, realpath/marker checks pass, and no process has the directory as its working directory.
290	- [ ] If project grouping is derived from conversations, confirm it disappears after targeted deletion; do not invent a second project registry cleanup.
291	- [ ] Keep the manifest/report when cleanup refuses so a developer can inspect and rerun the cleanup command safely.
292	- [ ] Run safety and cleanup tests without touching real conversations.
293	
294	**Checkpoint:** Normal completion and interrupted test runs can clean only what they prove they own.
295	
296	## Task 10: Run the final verification matrix
297	
298	**Deterministic checks:**
299	
300	- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts tests/e2e/live/checkpoint-reporter.test.ts`.
301	- [ ] Run every focused Manager, route, server, and lifecycle regression added or changed during Tasks 7-8.
302	- [ ] Run `pnpm test:lifecycle` and account for every scenario; do not summarize a partial pass as green.
303	- [ ] Run the focused Claude model gateway suite, including routing and real smoke coverage appropriate to the current installation.
304	- [ ] Run `pnpm typecheck`.
305	- [ ] Run `pnpm lint` on touched source/test files or the repository command if it supports clean targeted execution.
306	- [ ] Run `pnpm build`.
307	- [ ] Run `git diff --check`.
308	
309	**Real browser checks:**
310	
311	- [ ] Run `pnpm test:e2e:live:claude` from a fresh marked temp project and read the full result.
312	- [ ] Run the same mission through the in-app browser as a black-box user. Use only visible UI to choose actions; use the oracle afterward for comparison.
313	- [ ] Repeat the live journey once more from fresh state to catch one-run timing luck.
314	- [ ] Confirm both runs used Claude Code, encoded model `cliproxyapi:gpt-5.6-sol`, and Low effort in persisted worker selection.
315	- [ ] Confirm A's interrupted instruction appears once and the app contains the changed requirement.
316	- [ ] Confirm B's Stop ends the worker and its resume output appears without reload.
317	- [ ] Confirm C remains complete through switches, reload, and reconnect.
318	- [ ] Confirm no conversation disappears, duplicates, borrows content, or shows a stale working state at any checkpoint.
319	- [ ] Confirm no browser console errors or visible generic failures were ignored.
320	
321	**Cleanup and final audit:**
322	
323	- [ ] Delete only the journey-owned runs and verify their durable artifacts are gone.
324	- [ ] Remove only the marked temporary project after the cleanup safety checks pass.
325	- [ ] Confirm unrelated project/conversation counts and the pre-existing dirty-worktree baseline are unchanged.
326	- [ ] Inspect `git status --short` for secrets, auth state, test output, temporary projects, dependencies, caches, logs, or generated artifacts.
327	- [ ] Re-read every pass criterion in the design and attach fresh evidence or an explicit unresolved gap.
328	
329	**Checkpoint:** The user-visible lifecycle is proven end to end with a real worker, and the deterministic suite guards every root cause found along the way.
330	
331	## Agentic journey mission card
332	
333	**Running app:** `http://localhost:3035` or the explicitly configured loopback URL.
334	
335	**User role:** A builder using OmniHarness to manage several Claude Code sessions in one disposable project.
336	
337	**Mission:** Add the marked temporary project, run Conversations A/B/C with Claude Code + GPT-5.6 SOL + Low effort, change A's instructions while it works, stop and resume B, complete C, repeatedly switch among them, reload and reconnect, and decide whether every status and transcript is trustworthy.
338	
339	**Allowed interface:** In-app browser or Playwright browser UI, keyboard, pointer, accessibility tree, and visible page state.
340	
341	**Forbidden shortcuts during the mission:** No API mutations, source inspection, direct database changes, direct worker calls, filesystem edits by the test driver, or implementation knowledge used to choose the next UI action.
342	
343	**Expected visible proof:** Each session remains present exactly once; active and terminal controls are honest; A accepts the changed instruction exactly once; B visibly stops and later shows resumed output; C stays complete; switching, reload, and reconnect do not lose or mix state.
344	
345	**Failure conditions:** A session disappears or flickers out of the list, selection changes unexpectedly, status surfaces disagree, Stop leaves working UI behind, resume returns no visible output, queue state survives acceptance, transcript content crosses sessions, output requires reload, a generic error hides the cause, or cleanup cannot prove ownership.
346	
347	**Approval:** The user explicitly requested this real, potentially long-running agentic journey in the current conversation. The runner still requires its local opt-in guard on every invocation.
348	

uuid: 5e3aa7f9-b374-41ce-8a1d-a1a2eca7c886
parent: dbe34490-3fc4-4b33-86da-b087f0ff3303
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-13T18:07:49.774Z","phase":null} -->
## Claude thinking · 2026-07-13T18:07:49.774Z



uuid: d614a319-967a-46e5-a228-a889bd49a438
parent: 5e3aa7f9-b374-41ce-8a1d-a1a2eca7c886

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-13T18:08:02.301Z","phase":null} -->
## Claude · 2026-07-13T18:08:02.301Z

**Verdict: HARDEN** — the design and plan are unusually thorough and internally consistent (safety boundary, ownership manifest, oracle-vs-mutation separation, task sequencing, cleanup guards are all well specified), but a few concrete gaps should be closed before an engineer executes this without guessing.

## Highest-impact findings

**1. No explicit cost/time boundedness for real API turns beyond "Low effort" + Playwright's generic test timeout.**
The user's constraint says the real-agent run must be "bounded." The plan only bounds the *Playwright test* via a "generous finite timeout" (Task 3) and relies on condition-based waits. There is no per-worker-turn wall-clock cap, no turn/tool-call ceiling, and no rule for what happens if a real Claude Code worker loops (e.g., repeatedly re-validating files) and burns real GPT-5.6 tokens. Fix: add an explicit per-checkpoint wait ceiling (e.g., "fail step X after N seconds of no visible transition, not after the whole-test timeout") and a hard per-worker maximum active duration that triggers an automatic Stop + failure, so a stuck worker can't silently run up cost/time. This should be named in Task 2 or 3 alongside the other guards.

**2. Manifest write durability/timing isn't specified.**
Design says "the journey manifest starts empty and records every run ID it creates," and Task 9's cleanup recovers "using a manifest path," implying incremental writes — but neither document states the manifest entry must be written and flushed to disk *immediately* after a run ID is obtained, before any further UI action. If the manifest write is buffered or deferred, a crash right after conversation creation but before the next checkpoint would leave an untracked owned run that the crash-safe cleanup script (by design) cannot touch. Fix: add one line to Task 2 — "each run ID is appended and fsynced to the manifest synchronously, before the next mutation is attempted" — closing the exact race the whole ownership model depends on.

**3. Cleanup DELETE fallback lacks a stated authorization/route parity requirement.**
Task 9 allows "a targeted authenticated DELETE fallback for cleanup only" when the production UI delete flow can't run (e.g., browser already closed). It correctly requires cascade behavior and forbids hand-deleting rows, but doesn't say this fallback must go through the *same server route/service* the UI delete button calls (vs. some new raw endpoint), which is what actually guarantees the cascade guarantee it claims. Recommend making that explicit: "the fallback must invoke the same server-side delete handler used by the UI, not a new deletion path."

## Anything I'd deliberately leave alone

- The state-authority table, status contract, and observability contract are already comprehensive and correctly reject "screenshot or single manual retry as regression" — don't add more state rows or event types speculatively.
- The large conditional regression-target file list (Task file map lines 65–81) looks like scope creep at first glance, but it's explicitly gated ("used only when the live journey exposes a failure"), so it's not over-engineering — leave it as a reference menu.
- The SSE-drop-only-in-headless-profile asymmetry between the Playwright run and the in-app human run is intentional and reasonable (a human can't easily toggle network); no change needed there.
- Task ordering (safety → auth → UI actions → oracle → real journey → red tests → fixes → cleanup → final matrix) is correct and shouldn't be reshuffled.

uuid: 5e59f7bc-ee99-4a85-a4f7-a3fe16369ccf
parent: d614a319-967a-46e5-a228-a889bd49a438

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:08:40.921Z","phase":null} -->
## Claude state: queue-operation · 2026-07-13T18:08:40.921Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-13T18:08:40.921Z",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9",
  "content": "I hardened both reviewed files: explicit eight-minute per-turn, two-minute no-progress, and thirty-minute journey limits with visible Stop; synchronous run-ID manifest append plus file and parent-directory sync before the next mutation; and cleanup fallback constrained to the exact production delete route/handler used by the UI. Re-read only the same two files and return: 1. Verdict: READY or HARDEN 2. Remaining highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:08:40.922Z","phase":null} -->
## Claude state: queue-operation · 2026-07-13T18:08:40.922Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-13T18:08:40.922Z",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-13T18:08:40.954Z","phase":null} -->
## User · 2026-07-13T18:08:40.954Z

I hardened both reviewed files: explicit eight-minute per-turn, two-minute no-progress, and thirty-minute journey limits with visible Stop; synchronous run-ID manifest append plus file and parent-directory sync before the next mutation; and cleanup fallback constrained to the exact production delete route/handler used by the UI. Re-read only the same two files and return: 1. Verdict: READY or HARDEN 2. Remaining highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.

uuid: 6e1515e5-ed83-44e4-99f2-f6d9d611e165
parent: 5e59f7bc-ee99-4a85-a4f7-a3fe16369ccf

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-13T18:08:43.479Z","phase":null} -->
## Claude tool call: Read · 2026-07-13T18:08:43.479Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md"
}

uuid: a69f2be1-0dcc-4485-bf40-a627a01722f4
parent: 6e1515e5-ed83-44e4-99f2-f6d9d611e165
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-13T18:08:43.485Z","phase":null} -->
## Claude tool result: toolu_01GyqYLDoGzJBeYX6gDNYGs8 · 2026-07-13T18:08:43.485Z

````text
1	# Claude GPT-5.6 Live Lifecycle Journey Design
2	
3	**Date:** 2026-07-13
4	
5	**Status:** Ready for implementation planning
6	
7	## Purpose
8	
9	Prove that a real user can run Claude Code through OmniHarness with the routed
10	`gpt-5.6-sol` model at low effort, keep several conversations straight, change
11	instructions while a worker is busy, stop and resume work, switch and reload
12	without losing state, and see every completed worker response in the UI.
13	
14	This is not a mock-model happy path. The current milestone uses the real local
15	OmniHarness app, the real CLIProxyAPI connection, the real Claude Code worker,
16	and a disposable project outside the OmniHarness repository. Deterministic
17	tests remain responsible for exact state-machine and race coverage; the live
18	journey proves that those pieces compose into a usable product.
19	
20	## Product outcome
21	
22	An OmniHarness developer can run one opt-in command or follow the same mission
23	in the in-app browser and obtain a trustworthy answer to all of these questions:
24	
25	1. Can the user add a disposable project from the UI?
26	2. Can the user select Claude Code, `GPT-5.6 SOL`, and Low effort?
27	3. Does a new conversation appear once, remain selected, and show honest work
28	   state while the worker is active?
29	4. Can the user switch among three sessions without transcript, selection,
30	   project, model, draft, or status state leaking between them?
31	5. Can a busy worker receive changed instructions immediately, with the queued
32	   row and transcript reflecting exactly one accepted message?
33	6. Does Stop end the real worker turn and clear all working indicators?
34	7. Can a follow-up resume the stopped conversation and make the new output
35	   visible without a hard reload?
36	8. Do reload and SSE reconnect restore the same conversations, transcripts,
37	   statuses, and selection?
38	9. When the UI disagrees with the backend, can the test identify the first
39	   boundary where the state diverged?
40	10. Can all test conversations, workers, artifacts, and temporary files be
41	    removed without touching user projects or unrelated conversations?
42	
43	## User and jobs
44	
45	The primary user is the human builder operating OmniHarness locally.
46	
47	The core job is to delegate work to a coding agent and trust that the UI still
48	represents the same live conversation after normal lifecycle operations.
49	
50	Supporting jobs in this milestone are:
51	
52	- configure the intended harness/model/effort before sending;
53	- understand whether each session is starting, working, queued, stopped,
54	  recoverable, awaiting input, completed, or failed;
55	- change direction without starting a second accidental turn;
56	- leave one conversation, work in another, and return without losing context;
57	- stop expensive or incorrect work and know that it really stopped;
58	- continue a stopped session without losing its transcript or worker identity;
59	- recover after refresh or event-stream interruption;
60	- inspect the event, database, and worker-stream evidence when the screen is
61	  wrong;
62	- clean up only the resources created by the journey.
63	
64	## Scope
65	
66	### Included
67	
68	- An opt-in Playwright configuration for the already-running local app.
69	- A safe live-journey runner with explicit real-token and local-target guards.
70	- A temporary, dependency-free app project created under the operating
71	  system's temporary directory, with a `.gitignore` and an ownership marker.
72	- Browser-only mutations for project addition, conversation creation, model and
73	  effort selection, session switching, interrupt, stop, follow-up/resume, and
74	  reload.
75	- Read-only control-plane oracles using canonical snapshots, named event logs,
76	  conversation/worker entry routes, and SQLite only for post-action comparison
77	  and failure diagnosis.
78	- Three real Claude Code conversations using `cliproxyapi:gpt-5.6-sol` at Low
79	  effort.
80	- Deterministic manager, route, lifecycle, and race tests for every state bug
81	  found by the live run, written before the fix.
82	- Focused fixes for confirmed root causes.
83	- Failure artifacts: trace, screenshot, visible-state checkpoint, redacted
84	  event transcript, and owned-resource manifest under ignored test output.
85	- Targeted cleanup of only the journey's run IDs and temporary project.
86	
87	### Not included in this milestone
88	
89	- Exercising Codex, Gemini, OpenCode, native Claude models, or other gateway
90	  models. The harness is designed so those can be added as later conformance
91	  profiles, but they are not part of this checklist.
92	- A permanent sample app inside the OmniHarness repository.
93	- Running the real-token journey in ordinary CI or as part of `pnpm test`.
94	- Bypassing authentication in the normal local app.
95	- Editing shell profiles, Claude settings, or global CLI configuration.
96	- Deleting unrelated conversations or calling the bulk conversation-deletion
97	  script.
98	- Treating screenshots, logs, HTTP 200 responses, or a passing mock test as
99	  proof that the user journey works.
100	
101	## Safety boundary
102	
103	The live runner refuses to start unless all of these conditions hold:
104	
105	- the target URL is loopback (`localhost`, `127.0.0.1`, or `::1`);
106	- the caller explicitly opts into a real-agent run;
107	- authentication is supplied at runtime or an already authenticated in-app
108	  browser is used;
109	- the gateway status is enabled, running, connected, and advertises or accepts
110	  `gpt-5.6-sol`;
111	- the chosen project path is under the operating system temporary directory;
112	- the project contains a journey ownership marker created by this run;
113	- the project path is not the OmniHarness repository and is not any registered
114	  user project;
115	- the journey manifest starts empty and records every run ID it creates.
116	
117	Each new run ID is appended and flushed to the manifest immediately after the
118	UI exposes it and before the test performs another mutation. The manifest file
119	and its parent directory are synced so a process crash cannot leave a created
120	conversation outside the only authorized cleanup scope.
121	
122	Real-agent cost and time are bounded independently of Playwright's outer test
123	timeout. Each worker turn may be active for at most eight minutes; two minutes
124	without either a visible transition or new durable owned-run evidence is a
125	stalled-turn failure. On either limit, the harness uses the visible Stop control,
126	records the failure, and enters targeted cleanup. One complete journey may run
127	for at most thirty minutes, including recovery and cleanup. The prompts also
128	forbid package installation and limit work to the six named project files.
129	
130	The worker prompt repeats the filesystem boundary and forbids package installs,
131	commits, branch operations, and edits outside the temporary project. Cleanup
132	uses the recorded run IDs and ownership marker; it never infers ownership from
133	a title prefix alone.
134	
135	Secrets are never written to traces, manifests, source files, or command-line
136	arguments. A live-test password is read from a runtime environment variable or
137	entered into the in-app browser for the local instance only.
138	
139	## Test project and missions
140	
141	The project is created under a path such as:
142	
143	```text
144	/tmp/omniharness-live-journey-<random>/
145	```
146	
147	It begins with only:
148	
149	```text
150	.gitignore
151	.omniharness-live-journey.json
152	```
153	
154	The project is deliberately dependency-free so the journey does not depend on
155	network package installation and can be removed as one owned directory.
156	
157	### Conversation A: build and interrupt
158	
159	The first prompt asks the worker to create a small browser app called Research
160	Relay using `index.html`, `styles.css`, `app.js`, and `README.md`. It must support
161	adding research notes, tags, filtering, localStorage persistence, and a visible
162	checklist. The worker must inspect and validate its files before completing.
163	
164	After the worker is visibly active and the first durable output or owned file
165	exists, the user changes direction through the busy composer:
166	
167	```text
168	Change direction: use a warm amber theme, add Export JSON, and continue from
169	the work already completed. Do not restart or duplicate files.
170	```
171	
172	The UI must show that the message is queued or being delivered, then the test
173	uses the visible interrupt/send-now action (or the documented Escape action)
174	to deliver it. The message must appear exactly once in the worker stream, and
175	the pending queue item must disappear once accepted into chat.
176	
177	### Conversation B: stop and resume
178	
179	The second prompt asks the worker to inspect the app, perform a careful
180	accessibility and usability audit, and write `AUDIT.md` with exactly five
181	prioritized findings. While this turn is visibly working, the user presses the
182	real Stop control.
183	
184	The UI must become non-working, the run and worker must reach a truthful stopped
185	state, and named terminal evidence must exist. The user then sends:
186	
187	```text
188	Resume this session. Finish AUDIT.md only, using the existing context and
189	files. Do not modify the app.
190	```
191	
192	The session may reattach or recreate according to production policy, but that
193	decision must be named. The new answer and `AUDIT.md` must appear without a
194	manual reload.
195	
196	### Conversation C: complete reference state
197	
198	The third prompt asks the worker to inspect the project and write `STATUS.md`
199	with a concise file inventory and validation summary, without modifying the
200	app. It is allowed to complete normally. This gives the switching test a known
201	terminal conversation while A or B has other lifecycle states.
202	
203	## Human-level journey
204	
205	All mutations are performed through visible controls:
206	
207	1. Unlock the local app if needed.
208	2. Add the temporary project with **Add project** and **Select Project Folder**.
209	3. Select **Direct control**, **Claude Code**, **GPT-5.6 SOL**, and **Low**.
210	4. Start Conversation A and capture its run ID from the selected URL or
211	   browser-visible conversation identity.
212	5. Confirm visible active state, switch away, and confirm A remains listed with
213	   the same status.
214	6. Create Conversation B, switch A -> B -> A -> B, and confirm neither
215	   conversation disappears, duplicates, or borrows the other's transcript.
216	7. Interrupt A with the changed instruction and verify queue-to-transcript
217	   movement.
218	8. Stop B, verify the working indicator and Stop control disappear, and then
219	   resume B with a follow-up.
220	9. Create and complete Conversation C.
221	10. Repeatedly switch A -> C -> B -> A while statuses change.
222	11. Reload the selected session, then simulate an SSE disconnect/reconnect in
223	    the headless profile and repeat the switch loop.
224	12. Verify final files and visible assistant answers.
225	13. Compare the visible state with the canonical server evidence.
226	14. Delete only A, B, and C through the production conversation delete flow,
227	    remove the project from OmniHarness if that action is available and safe,
228	    then remove the owned temporary directory.
229	
230	The in-app agentic run follows the same mission card and does not use backend
231	state to decide where to click. The deterministic Playwright run may use the
232	server evidence as assertions after each visible action, but never as a
233	shortcut for a mutation.
234	
235	## State authority and invariants
236	
237	| State | Owner | Token/order | Completeness and UI rule |
238	| --- | --- | --- | --- |
239	| Selected project/run | URL + `HomeUiStateManager` | project path + run ID + selection request ID | Late create/load results cannot steal a newer selection. |
240	| Conversation catalog | server snapshot, mirrored by `EventStreamStateManager` | snapshot event ID and deterministic `(updatedAt, id)` order | Cache is preview only; partial run snapshots cannot erase known or optimistic runs. |
241	| Run lifecycle | server `runs` row and named events | run ID + event ID | UI cannot invent working/done by diffing transcripts. |
242	| Worker lifecycle | server worker row/runtime decision | worker ID + event ID | `cancelled`, terminal run state, or terminal event defeats stale current text. |
243	| Worker transcript | unified append-only worker JSONL | worker ID + monotonic seq | Fallback rows may pre-render but cannot duplicate or replace authoritative entries. |
244	| Busy message queue | server queued-message rows, optimistically mirrored by `BusyMessageQueueManager` | message ID + status transition | Accepted/delivered items leave the drawer; cancelled/failed items cannot resurrect from late responses. |
245	| SSE connection | `LiveEventConnectionManager` over server event ring | `Last-Event-ID` | Reconnect replays the gap or requires a complete resync; an open socket alone is not authority. |
246	| Gateway readiness | server gateway singleton/snapshot | gateway revision | Cached model choices do not imply readiness; routed spawn must refuse rather than fall back. |
247	| Journey ownership | live-test manifest | journey ID | Cleanup touches only recorded runs and the marked temp directory. |
248	
249	For every async result, the implementation asks: what can arrive late, out of
250	order, partially, twice, or after the user selected a different session? Tests
251	must prove that such a result cannot mutate the newly selected context.
252	
253	## Status contract
254	
255	The UI must distinguish these user-relevant states:
256	
257	- **Starting/working:** a real turn is active; a visible pending assistant state
258	  and Stop control identify the concrete worker.
259	- **Queued:** a follow-up is accepted for later delivery and remains actionable.
260	- **Interrupting/delivering:** the queued item has left the ordinary queue and
261	  cannot appear twice.
262	- **Awaiting user:** the worker asked for input and no fake working spinner is
263	  shown.
264	- **Stopped/cancelled:** the worker is no longer doing work; stale worker text
265	  cannot keep the conversation active.
266	- **Recoverable:** the previous turn stopped or failed in a way that supports a
267	  visible resume action or follow-up.
268	- **Completed:** final output is durable and visible; no Stop control or
269	  trailing Thinking indicator remains.
270	- **Failed:** the real cause is visible and a stable `error.surfaced` event is
271	  inspectable.
272	
273	Sidebar, header, transcript, and control states must agree. Any disagreement is
274	a test failure even if one surface is eventually corrected by reload.
275	
276	## Observability contract
277	
278	The live journey records a redacted checkpoint after every important action:
279	
280	- timestamp and journey step;
281	- selected URL, project, and run ID;
282	- visible conversation titles and status indicators;
283	- visible transcript entry IDs or stable text hashes;
284	- canonical snapshot anchor ID;
285	- relevant named events since the prior anchor;
286	- run, worker, and queued-message state;
287	- latest worker-stream sequence for each owned worker.
288	
289	Expected production evidence includes the existing typed events such as
290	`worker.spawned`, `worker.status`, `worker.terminal`, `worker.reattached`,
291	`worker.recreated`, `worker.entry_appended`, queue interruption decisions,
292	recovery events, `conversation.deleted`, `stream.resync_required`, and
293	`error.surfaced` when applicable.
294	
295	If the event is absent, the server did not publish the decision and the failure
296	is not classified as a frontend-only bug. If the event and persisted state are
297	correct but the screen is wrong, the test captures the responsible client
298	manager snapshot and stale owner token before any fix is attempted.
299	
300	## Failure artifact and privacy rules
301	
302	On failure, the harness retains only ignored artifacts under `test-results/`:
303	
304	- Playwright trace and screenshot;
305	- a bounded DOM snapshot around the affected surface;
306	- a redacted event transcript for owned run IDs;
307	- the journey manifest and checkpoint report;
308	- bounded tails of owned worker JSONL files.
309	
310	The report excludes passwords, gateway tokens, OAuth URLs, credential files,
311	unrelated run titles/content, and full database dumps. Passing runs may retain a
312	short summary but not secrets or user conversation content.
313	
314	## Deterministic regression strategy
315	
316	The live journey is a finder and final proof, not the only regression test.
317	Each observed failure is reduced before production code changes:
318	
319	- stale selection, catalog disappearance, snapshot merge, and status classifier
320	  bugs become focused Manager tests;
321	- transcript duplication or missing output becomes worker-entry/transcript
322	  manager and unified-stream tests;
323	- interrupt, stop, resume, finalization, or reattach bugs become headless
324	  lifecycle HTTP/SSE scenarios with exact named-event transcripts;
325	- route contract failures become runtime route tests;
326	- only visible layout, affordance, focus, and cross-session composition remain
327	  in Playwright.
328	
329	Every fix follows red -> green -> full focused verification. A screenshot or a
330	single successful manual retry is never the regression test.
331	
332	## Pass criteria
333	
334	The current milestone passes only when all of the following are true in a
335	fresh real journey:
336	
337	- all three conversations are created through the UI with Claude Code,
338	  `GPT-5.6 SOL`, and Low effort;
339	- the gateway route is used and no native-model fallback occurs;
340	- each conversation appears once and remains stable through switching;
341	- active, queued, stopped, recoverable, and completed states are visibly honest;
342	- the interrupt instruction is delivered once and reflected in A's final app;
343	- Stop ends B's actual turn and clears active UI promptly;
344	- B resumes and its new worker output appears without reload;
345	- C completes and remains terminal through all switches;
346	- transcript content never crosses run boundaries;
347	- reload and SSE reconnect preserve selection, transcripts, and status;
348	- canonical snapshots, named events, SQLite rows, and worker streams agree with
349	  the final visible state;
350	- every bug found has a deterministic failing regression and a verified fix;
351	- focused tests, the lifecycle suite, typecheck, build, live Playwright run, and
352	  the in-app agentic mission all pass with fresh evidence;
353	- only journey-owned test data is removed at the end.
354	
355	## North star and later profiles
356	
357	The north star is a provider-agnostic conformance suite in which every supported
358	OmniHarness worker type and model route must pass the same lifecycle contract:
359	create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload,
360	and clean up.
361	
362	After this milestone is proven with Claude Code + `gpt-5.6-sol`, later profiles
363	can supply different harness/model selectors and safe missions while reusing
364	the same state and observability assertions. Those profiles are product
365	direction, not part of this implementation checklist.
366	

uuid: f38b501d-590a-46fc-8396-cd9861e82dae
parent: a69f2be1-0dcc-4485-bf40-a627a01722f4
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-13T18:08:43.790Z","phase":null} -->
## Claude tool call: Read · 2026-07-13T18:08:43.790Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md"
}

uuid: 53ad76a8-4d6e-4bef-a41a-47d763b4096e
parent: f38b501d-590a-46fc-8396-cd9861e82dae
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-13T18:08:44.704Z","phase":null} -->
## Claude tool result: toolu_01XX2UhRNvJtuaSB2LUJnVMh · 2026-07-13T18:08:44.704Z

```text
1	# Claude GPT-5.6 Live Lifecycle Journey Implementation Plan
2	
3	> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. Mark a checkbox only after its stated evidence has been run and read.
4	
5	**Goal:** Add a safe, repeatable human-level test journey that proves Claude Code can use `GPT-5.6 SOL` at Low effort across interrupt, multi-session switching, stop, resume, reload, and reconnect, then fix every confirmed state or delivery bug with deterministic regression coverage.
6	
7	**Architecture:** Keep one production control plane and add an opt-in Playwright consumer of it. All mutations in the live journey use the real UI; canonical snapshots, named events, targeted route reads, SQLite, and unified worker JSONL act only as after-action oracles. The runner owns a marked temporary project and a manifest of exact run IDs so real-agent testing cannot touch the repository or unrelated conversations.
8	
9	**Tech Stack:** Next.js 15, React 19, TypeScript, global Manager classes, Playwright, Vitest, lifecycle HTTP/SSE harness, SQLite/Drizzle, unified worker JSONL, CLIProxyAPI, Claude Code ACP.
10	
11	**Design specification:** `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
12	
13	**North Star Product:** A provider-agnostic conformance suite that every OmniHarness CLI/model combination must pass for create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload, and cleanup.
14	
15	**Current Milestone:** Real Claude Code through `cliproxyapi:gpt-5.6-sol` at Low effort in one disposable project with three conversations and the full lifecycle journey.
16	
17	**Future Product Direction:** Add profile data for native Claude, Codex, Gemini, OpenCode, and later gateway models only after the current profile is reliable. This context is not part of the implementation checklist below.
18	
19	**Final Functionality Standard:** The milestone is complete only when the real browser journey passes twice from fresh state, every discovered defect has a red-green deterministic regression, server evidence agrees with the visible UI, and only journey-owned data is cleaned up.
20	
21	---
22	
23	## Execution rules
24	
25	- [ ] Work directly in the current checkout. Never create a branch or worktree.
26	- [ ] Preserve all unrelated dirty-worktree changes and do not reformat touched files broadly.
27	- [ ] Do not delete any existing source file, conversation, project, branch, or artifact.
28	- [ ] Use `apply_patch` for source and test edits.
29	- [ ] Reuse the already-running app at `http://localhost:3035` (or the configured local URL); do not start a competing dev server.
30	- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md`, `docs/architecture/worker-conversation-stream.md`, and `docs/architecture/direct-control-session-regressions.md` before changing server lifecycle behavior.
31	- [ ] Use the unified worker stream through `appendWorkerEntry`; do not add another transcript store.
32	- [ ] Emit typed named events for every new server decision and `error.surfaced` for every new user-relevant failure.
33	- [ ] Put any new visible copy in every `shared/locales/*.json` file and render it through `t()`; prefer no new product copy for the harness.
34	- [ ] Keep shared client state in the existing Manager classes. Every async mutation, snapshot, timer, and stream callback must prove current ownership before updating visible state.
35	- [ ] Write the failing deterministic test before each production fix and watch the expected failure.
36	- [ ] Use condition-based waits tied to visible or durable state. Do not make fixed sleeps the primary synchronization mechanism.
37	- [ ] Cap each real worker turn at eight active minutes, fail after two minutes with no visible transition or new durable owned-run evidence, and cap one full journey at thirty minutes. On a limit, use the visible Stop control before cleanup.
38	- [ ] Keep real-agent tests opt-in and out of normal `pnpm test`, default Playwright, and CI.
39	- [ ] Keep passwords, gateway tokens, OAuth data, session cookies, and unrelated conversation content out of test output and source control.
40	
41	## File map
42	
43	### New live-journey harness
44	
45	- `playwright.live.config.ts`: opt-in configuration for an already-running local app; one worker, no retries, long per-test deadline, and trace/screenshot retention on failure.
46	- `tests/e2e/live/types.ts`: journey manifest, checkpoint, owned run, gateway preflight, and redacted evidence contracts.
47	- `tests/e2e/live/safety.ts`: loopback validation, temp-root containment, ownership-marker checks, repository/project exclusion, explicit real-agent opt-in, and secret-free manifest helpers.
48	- `tests/e2e/live/auth.ts`: unlock the real local app from a runtime-only password without storing it in source or the durable report.
49	- `tests/e2e/live/omniharness-ui.ts`: stable browser operations for folder selection, harness/model/effort selection, conversation creation, switching, interrupt/send-now, stop, resume/follow-up, reload, and visible-state capture.
50	- `tests/e2e/live/control-plane-oracle.ts`: read-only canonical snapshot, event-log, worker-entry, and targeted run evidence for journey-owned IDs.
51	- `tests/e2e/live/project-fixture.ts`: create the marked dependency-free temporary project and remove it only after ownership and containment checks pass.
52	- `tests/e2e/live/checkpoint-reporter.ts`: write bounded, redacted ignored artifacts and a step-by-step UI/server comparison.
53	- `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`: the three-conversation live journey and final filesystem assertions.
54	- `scripts/cleanup-live-agent-journey.ts`: recover cleanup from an interrupted run using a manifest path, targeted run IDs, and the ownership marker; never bulk-delete conversations.
55	- `tests/e2e/live/safety.test.ts`: deterministic tests for all guard and cleanup-refusal cases.
56	- `tests/e2e/live/checkpoint-reporter.test.ts`: deterministic redaction and mismatch-report tests.
57	
58	### Existing configuration and scripts
59	
60	- `.gitignore`: confirm existing `/test-results/` and `/playwright-report/` coverage is sufficient; add only a focused live-auth or manifest path if a new artifact falls outside those roots.
61	- `package.json`: add `test:e2e:live:claude` and `test:e2e:live:cleanup`; do not change the default `test:e2e` command.
62	- `playwright.config.ts`: leave the mock/default suite behavior unchanged unless a shared type-only extraction is required.
63	
64	### Deterministic regression targets used only when the live journey exposes a failure
65	
66	- `tests/app/event-stream-state-manager.test.ts` / `src/app/home/EventStreamStateManager.ts`: catalog completeness, stale snapshot, optimistic-run retirement, and deterministic ordering.
67	- `tests/app/run-selection-effects.test.ts` / `src/app/home/useRunSelectionEffects.ts`: late selection/load ownership and URL/session restoration.
68	- `tests/app/home-view-model.test.ts` / `src/app/home/useHomeViewModel.ts`: selected-run composition and cross-session projection.
69	- `tests/app/home/sidebar-activity.test.ts` / `src/app/home/sidebar-activity.ts`: honest per-session sidebar status.
70	- `tests/app/direct-control-activity.test.ts` / `src/app/home/direct-control-activity.ts`: active, cancelled, terminal, and stale-current-text classification.
71	- `tests/app/live-event-connection-manager.test.ts` / `src/app/home/LiveEventConnectionManager.ts`: replay, resync, owner fencing, and reconnect state.
72	- `tests/app/worker-entries-manager.test.ts` / `src/app/home/WorkerEntriesManager.ts`: seq ordering, revalidation after loaded-empty state, and selection isolation.
73	- `tests/app/conversation-transcript-manager.test.ts` / `src/app/home/ConversationTranscriptManager.ts`: fallback/stream dedupe and transcript ownership.
74	- `tests/app/busy-message-queue-manager.test.ts` / `src/app/home/BusyMessageQueueManager.ts`: interrupt acceptance, optimistic hiding, late-response rejection, and no resurrection. Create the focused test file if it does not already exist.
75	- `tests/ui/conversation-actions.test.ts`, `tests/ui/sidebar-layout.test.ts`, and `tests/ui/composer-shell.test.ts`: source-level or rendered affordance contracts when the visible control is wrong.
76	- `tests/conversations/direct-run-status.test.ts` / `src/server/conversations/direct-run-status.ts`: successful-turn terminal resolution.
77	- `tests/server/conversations/worker-turn-gate.test.ts`, `tests/server/conversations/reconcile-user-messages.test.ts`, and focused send/queue tests: exactly-once acceptance and finalization.
78	- `tests/lifecycle/scenarios/conversation-continuation.test.ts`: follow-up persistence across SSE gaps.
79	- `tests/lifecycle/scenarios/direct-mode-rerun.test.ts`: stopped direct-session continuation.
80	- `tests/lifecycle/scenarios/worker-reattach.test.ts`: explicit reattach/recreate decision evidence.
81	- `tests/lifecycle/scenarios/sse-resume.test.ts`: replay or resync after disconnect.
82	- Create `tests/lifecycle/scenarios/direct-control-interrupt-stop-resume.test.ts` only if the existing scenarios cannot express the exact combined production sequence without conflating responsibilities.
83	
84	### Architecture and durable lessons
85	
86	- `docs/architecture/lifecycle-observability-and-testing.md`: document only genuinely new event/state invariants introduced by a fix.
87	- `docs/architecture/direct-control-session-regressions.md`: add the exact reproduced sequence and rule for a new direct-control bug class.
88	- `docs/superpowers/learnings/YYYY-MM-DD-<root-cause>.md`: one concise learning for each meaningful client/server ownership, persistence, recovery, or control-plane root cause fixed.
89	
90	### Large-file constraint
91	
92	`src/components/Terminal.tsx` and `src/components/home/ConversationMain.tsx` already exceed 1200 lines. The plan does not add harness logic to either file. If a confirmed UI root cause requires touching one, first extract the smallest cohesive state/behavior unit into a focused module and cover it with a failing test; do not expand the oversized component further.
93	
94	## State and data invariants
95	
96	- [ ] The server snapshot is authoritative for the complete conversation catalog only when its anchor and scope declare completeness; cached/scoped data is preview.
97	- [ ] A partial run or worker update may refine known state but may not erase other conversations, optimistic creations, delivered input, read markers, or stream entries.
98	- [ ] Selection-changing async work is fenced by project path, run ID, and request/operation ID and rechecks ownership immediately before mutation or navigation.
99	- [ ] Conversation ordering uses a deterministic tie-breaker such as `(updatedAt, id)`, never timestamp alone.
100	- [ ] The URL, `HomeUiStateManager`, selected snapshot scope, transcript manager, and composer all refer to the same run before visible state changes.
101	- [ ] The unified worker JSONL is the final transcript authority, keyed by worker ID and monotonic seq.
102	- [ ] A loaded-empty stream at seq 0 is an observation, not permanent completeness; selecting it again revalidates.
103	- [ ] Queue states are monotonic from the user's perspective. An item accepted into chat leaves the drawer immediately and cannot be resurrected by a stale poll or mutation result.
104	- [ ] Active UI requires real current activity. Terminal/cancelled run or worker evidence defeats stale `currentText`, old bridge snapshots, and optimistic `running` rows.
105	- [ ] Stop targets a concrete active worker and emits `worker.status` plus `worker.terminal`; the UI clears active controls without waiting for reload.
106	- [ ] Resume/follow-up publishes `worker.reattached` or `worker.recreated` as appropriate, persists the new turn through the normal finalization path, and appends visible output to the same conversation stream.
107	- [ ] SSE frames have IDs. Reconnect supplies `Last-Event-ID`, fills the gap from the ring, or receives `stream.resync_required` and bootstraps a complete snapshot.
108	- [ ] Gateway readiness has a revision and remains server-owned. Selecting an encoded routed model never falls back to native Claude.
109	- [ ] The journey manifest is the sole cleanup authority. A title prefix, temp-looking path, or absent database row is insufficient authorization to delete anything.
110	
111	## Task 1: Establish the baseline and lock the live mission
112	
113	**Files:**
114	
115	- Verify `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
116	- Read the three architecture documents listed in the execution rules
117	- No production source edits
118	
119	- [ ] Record the current dirty-worktree paths and treat them as user-owned baseline.
120	- [ ] Confirm the running proxy and Next server ports, login shell, gateway status, Claude model catalog, and `GPT-5.6 SOL` option through the real UI.
121	- [ ] Confirm the live URL is local and the app can be authenticated without changing the configured password.
122	- [ ] Run the focused gateway suites and existing direct-session/lifecycle suites before adding the harness; record pre-existing failures separately.
123	- [ ] Write the exact three prompts from the design into the live spec as constants. Keep them dependency-free, low-effort, and bounded to the owned temp project.
124	- [ ] Define checkpoints for `created`, `working`, `switched-away`, `interrupt-queued`, `interrupt-accepted`, `stopped`, `resumed`, `completed`, `reloaded`, `reconnected`, and `cleaned`.
125	- [ ] Confirm the UI controls' accessible contracts from the running app: Add project, folder dialog, Direct control, CLI harness, Worker model, Worker effort, Send/Stop, queue interrupt, conversation selection, and delete.
126	- [ ] Do not begin a real worker turn during this task.
127	
128	**Verification:**
129	
130	- [ ] Save only non-secret baseline results in the implementation notes.
131	- [ ] Run `git diff --check` and confirm this task changed documentation/test constants only.
132	
133	**Checkpoint:** The mission, cost boundary, UI actions, and existing failures are known before harness code or real token use.
134	
135	## Task 2: Build and test the safety boundary
136	
137	**Files:**
138	
139	- Create `tests/e2e/live/types.ts`
140	- Create `tests/e2e/live/safety.ts`
141	- Create `tests/e2e/live/project-fixture.ts`
142	- Create `tests/e2e/live/safety.test.ts`
143	
144	- [ ] Write failing tests that reject non-loopback URLs, missing real-agent opt-in, missing password/session input, repository paths, registered user-project paths, non-temp paths, `..` escapes, symlink escapes, missing/mismatched ownership markers, non-empty manifests at creation, and cleanup IDs absent from the manifest.
145	- [ ] Write failing tests that allow `localhost`, `127.0.0.1`, and `::1`, then create a random temp directory with `.gitignore` and an ownership marker containing only journey ID, created-at, and path.
146	- [ ] Watch the safety suite fail for the expected missing implementation, not for test setup.
147	- [ ] Implement pure guards first, then the minimal filesystem fixture.
148	- [ ] Make cleanup verify realpath containment, marker journey ID, and manifest ownership immediately before each destructive action.
149	- [ ] Append each run ID and flush the manifest file plus its parent directory synchronously as soon as the UI exposes the ID, before any later UI mutation. Add a crash-boundary test proving cleanup can recover a run created immediately before process exit.
150	- [ ] Refuse cleanup when any proof is missing; leave a clear recovery report instead of guessing.
151	- [ ] Ensure manifest serialization cannot contain passwords, cookies, tokens, OAuth URLs, arbitrary environment data, or unrelated run content.
152	- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts` and confirm all cases pass.
153	
154	**Checkpoint:** No browser or worker can be started until the test proves it owns a harmless local project and exact cleanup scope.
155	
156	## Task 3: Add the opt-in live Playwright surface
157	
158	**Files:**
159	
160	- Create `playwright.live.config.ts`
161	- Create `tests/e2e/live/auth.ts`
162	- Modify `package.json`
163	- Inspect `.gitignore`
164	
165	- [ ] Add a configuration test or import assertion that verifies the live config has no `webServer`, uses one worker, zero retries, a thirty-minute journey timeout, `trace: retain-on-failure`, `screenshot: only-on-failure`, and a loopback base URL.
166	- [ ] Implement an eight-minute active-turn deadline and a two-minute no-progress deadline that watch visible transitions plus new durable evidence. A deadline must visibly Stop the owned worker, record the failure, and proceed to targeted cleanup rather than merely timing out the Playwright process.
167	- [ ] Configure `testDir` narrowly to `tests/e2e/live` so ordinary E2E tests cannot accidentally run real agents.
168	- [ ] Require `OMNIHARNESS_LIVE_E2E=1` and read `OMNIHARNESS_LIVE_E2E_PASSWORD` only at runtime. Allow an already-authenticated in-app journey as the manual alternative.
169	- [ ] Implement UI login using the current password form; never place the password in Playwright output, trace annotations, or manifest.
170	- [ ] Add `pnpm test:e2e:live:claude` without changing `pnpm test:e2e`.
171	- [ ] Confirm all live artifacts remain under ignored `test-results/`/`playwright-report/`; do not add a tracked auth state file.
172	- [ ] Run a preflight-only Playwright test that logs in, reaches the workspace, and exits without creating a project or conversation.
173	
174	**Checkpoint:** A developer can attach headless Chromium to the real local app safely, but no real agent work starts yet.
175	
176	## Task 4: Implement UI-only actions and visible checkpoints
177	
178	**Files:**
179	
180	- Create `tests/e2e/live/omniharness-ui.ts`
181	- Create `tests/e2e/live/checkpoint-reporter.ts`
182	- Create `tests/e2e/live/checkpoint-reporter.test.ts`
183	
184	- [ ] Write failing reporter tests for secret redaction, bounded DOM/event/stream tails, stable text hashing, mismatch classification, and omission of unrelated runs.
185	- [ ] Implement one UI helper per user action. Use `data-testid` only when the existing accessible name or stable URL cannot uniquely identify the control; never rely on `.first()` or positional CSS.
186	- [ ] Every action must take a fresh or still-valid DOM observation, prove a unique target, perform one mutation, and wait for a visible state transition.
187	- [ ] Capture selected URL/run, visible session list, status labels, transcript hashes, Stop/Send state, queued drawer state, and visible error state after each checkpoint.
188	- [ ] Add assertions that the selected conversation title and transcript remain stable through A -> B -> A switching before any server oracle is read.
189	- [ ] Do not put API mutation shortcuts in this helper.
190	- [ ] Run reporter unit tests and a no-agent browser smoke that opens/closes the project picker and changes then restores harness/model/effort selections.
191	
192	**Checkpoint:** The test can behave like a human and describe what the human sees without backend knowledge.
193	
194	## Task 5: Add the read-only control-plane oracle
195	
196	**Files:**
197	
198	- Create `tests/e2e/live/control-plane-oracle.ts`
199	- Extend `tests/e2e/live/checkpoint-reporter.test.ts`
200	
201	- [ ] Write failing tests for parsing the canonical snapshot anchor, scoping events to owned run IDs, deterministic event ordering, worker-entry monotonic seq, queue status comparison, and redaction.
202	- [ ] Read `/api/events?snapshot=1&persisted=1`, the dev event-log endpoint, targeted worker entries/transcript routes, and only the run IDs recorded in the journey manifest.
203	- [ ] Keep SQLite inspection behind a diagnostic function used after a mismatch or at final audit; query only owned run IDs and the tables named in the architecture debugging checklist.
204	- [ ] Implement comparison rules for selected run, catalog membership, sidebar status, run/worker state, queue state, transcript seq/content hashes, and terminal/active consistency.
205	- [ ] Classify the first divergence as control-plane missing decision, persistence/finalization gap, stream delivery gap, client ownership/merge bug, or visible affordance bug.
206	- [ ] Never use the oracle to create, send, interrupt, stop, resume, switch, or delete.
207	- [ ] Run the focused oracle/reporter tests.
208	
209	**Checkpoint:** When the screen is wrong, the harness points to the first disagreeing boundary instead of guessing.
210	
211	## Task 6: Write the real three-conversation journey before fixing anything
212	
213	**Files:**
214	
215	- Create `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`
216	
217	- [ ] Write the full test with the three prompts and checkpoints from the design.
218	- [ ] Preflight gateway status and the exact catalog value `cliproxyapi:gpt-5.6-sol`; refuse rather than substitute another model.
219	- [ ] Add the marked temporary project through **Add project** and the real folder picker.
220	- [ ] Select Direct control, Claude Code, `GPT-5.6 SOL`, and Low before every new conversation; assert the compound selection remains correct after session switches.
221	- [ ] Start A, record its URL/run ID, and wait for visible active state plus durable `worker.spawned`/`worker.status` evidence.
222	- [ ] Create B while A remains active, switch A -> B -> A -> B, and assert both sidebar rows, URL selection, model/effort, and transcript ownership.
223	- [ ] Send A's change-of-direction message while busy, verify queued state, use the visible interrupt/send-now action, and assert exactly one accepted stream input and no remaining pending row.
224	- [ ] Stop B through the visible Stop control and assert active UI clears; then send the resume follow-up and assert visible post-resume output without reload.
225	- [ ] Create C, let it complete, and use it as the known-terminal reference while A and B change state.
226	- [ ] Repeat A -> C -> B -> A switches while capturing checkpoints. Fail on disappearance, duplication, wrong status, transcript bleed, stale Thinking, missing Stop, or lost output.
227	- [ ] Reload the selected run and assert the same URL, transcript, and terminal/active status after authority loads.
228	- [ ] Drop and restore browser network/SSE in the Playwright profile, then assert replay or resync and repeat the switch loop.
229	- [ ] Verify `index.html`, `styles.css`, `app.js`, `README.md`, `AUDIT.md`, and `STATUS.md` inside the owned project and assert the interrupt requirements are present.
230	- [ ] Let the first run expose failures. Do not patch production code inside this task.
231	
232	**Verification:**
233	
234	- [ ] Run only the live spec with a single explicit real-agent opt-in.
235	- [ ] Preserve the first failing trace/checkpoint and record exact reproduction steps.
236	- [ ] If the journey passes, still inspect the complete event transcript and state comparisons before moving on.
237	
238	**Checkpoint:** There is one real, repeatable account of what currently breaks, with visible and server evidence tied to owned IDs.
239	
240	## Task 7: Reduce each failure to a deterministic red test
241	
242	**Files:**
243	
244	- Use the regression targets in the file map; do not choose a production file before tracing the failing boundary.
245	
246	- [ ] For each observed failure, read the full error/trace, reproduce it at least twice, and identify the first state boundary that diverges.
247	- [ ] Compare the broken path with the nearest working path in the same codebase.
248	- [ ] State one root-cause hypothesis and the evidence that supports it.
249	- [ ] Add the smallest failing deterministic test at the owning layer and run it to see the expected failure.
250	- [ ] For stale selection/catalog bugs, defer request A, switch to B, resolve A, and assert A cannot mutate B or erase catalog rows.
251	- [ ] For status bugs, table-test active, runnable, awaiting-user, cancelled, terminal, stale, and recoverable inputs across sidebar and conversation projections.
252	- [ ] For missing/duplicate output, reproduce fallback/stream arrival orders and worker seq gaps without a browser.
253	- [ ] For interrupt/stop/resume bugs, add a lifecycle event transcript asserting input acceptance, queue transition, terminal event, reattach/recreate decision, finalization, and final run state.
254	- [ ] For reconnect bugs, bootstrap at an anchor, emit during the gap, reconnect with the last ID, and assert replay or explicit resync.
255	- [ ] Do not combine unrelated root causes in one test or one patch.
256	
257	**Checkpoint:** Every production change that follows has a test that demonstrated the actual bug first.
258	
259	## Task 8: Implement minimal root-cause fixes
260	
261	**Files:**
262	
263	- Modify only the owning modules identified by Task 7.
264	- Add locale keys in all locale files only if a visible error/action needs new copy.
265	- Add or update architecture/learning docs for meaningful root causes.
266	
267	- [ ] Implement one minimal fix per confirmed hypothesis.
268	- [ ] Keep server authority on the server and client projection in Managers; do not add component-local arrays, parallel caches, translated persisted strings, or transaction-carried UI state.
269	- [ ] Fence every late callback with the correct compound owner token.
270	- [ ] Preserve partial/complete snapshot semantics and deterministic ordering.
271	- [ ] Reuse the existing successful worker-turn finalization path for interrupt, queue drain, stop/recovery follow-up, and reattach output.
272	- [ ] Emit a typed named decision and surfaced error where the server previously returned silently or swallowed a user-relevant failure.
273	- [ ] If `Terminal.tsx` or `ConversationMain.tsx` must change, extract a focused helper/module before adding behavior because both files are already oversized.
274	- [ ] Run the red test until green, then run all directly related Manager/route/lifecycle suites.
275	- [ ] If a hypothesis fails, return to evidence gathering. After three failed fixes for the same symptom, stop and review the architecture with the user instead of stacking a fourth patch.
276	- [ ] Record a durable learning for every meaningful state ownership, stream, persistence, stop/resume, or recovery root cause.
277	
278	**Checkpoint:** Confirmed causes are fixed at their source, with no symptom-only polling, reload, timeout, or fallback workaround.
279	
280	## Task 9: Add crash-safe targeted cleanup
281	
282	**Files:**
283	
284	- Create `scripts/cleanup-live-agent-journey.ts`
285	- Modify `package.json`
286	- Extend `tests/e2e/live/safety.test.ts`
287	
288	- [ ] Write failing tests for targeted deletion of manifest-owned run IDs, idempotent already-gone responses, refusal on unknown IDs, refusal on marker mismatch, refusal outside temp, and preservation of the report when cleanup is incomplete.
289	- [ ] Prefer deleting A/B/C through the same production conversation delete flow exercised by the UI. Allow a targeted authenticated DELETE fallback for cleanup only, record that fallback, and require it to invoke the exact same server route/handler as the UI delete action rather than a new deletion path.
290	- [ ] Wait for `conversation.deleted` or verify an idempotent absent result for each owned ID.
291	- [ ] Confirm related workers, messages, queued rows, execution events, recovery rows, and run-data files are removed by production cascade behavior; never hand-delete database rows.
292	- [ ] Remove the temp directory only after all owned workers are terminal, all manifest run deletions are confirmed, realpath/marker checks pass, and no process has the directory as its working directory.
293	- [ ] If project grouping is derived from conversations, confirm it disappears after targeted deletion; do not invent a second project registry cleanup.
294	- [ ] Keep the manifest/report when cleanup refuses so a developer can inspect and rerun the cleanup command safely.
295	- [ ] Run safety and cleanup tests without touching real conversations.
296	
297	**Checkpoint:** Normal completion and interrupted test runs can clean only what they prove they own.
298	
299	## Task 10: Run the final verification matrix
300	
301	**Deterministic checks:**
302	
303	- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts tests/e2e/live/checkpoint-reporter.test.ts`.
304	- [ ] Run every focused Manager, route, server, and lifecycle regression added or changed during Tasks 7-8.
305	- [ ] Run `pnpm test:lifecycle` and account for every scenario; do not summarize a partial pass as green.
306	- [ ] Run the focused Claude model gateway suite, including routing and real smoke coverage appropriate to the current installation.
307	- [ ] Run `pnpm typecheck`.
308	- [ ] Run `pnpm lint` on touched source/test files or the repository command if it supports clean targeted execution.
309	- [ ] Run `pnpm build`.
310	- [ ] Run `git diff --check`.
311	
312	**Real browser checks:**
313	
314	- [ ] Run `pnpm test:e2e:live:claude` from a fresh marked temp project and read the full result.
315	- [ ] Run the same mission through the in-app browser as a black-box user. Use only visible UI to choose actions; use the oracle afterward for comparison.
316	- [ ] Repeat the live journey once more from fresh state to catch one-run timing luck.
317	- [ ] Confirm both runs used Claude Code, encoded model `cliproxyapi:gpt-5.6-sol`, and Low effort in persisted worker selection.
318	- [ ] Confirm A's interrupted instruction appears once and the app contains the changed requirement.
319	- [ ] Confirm B's Stop ends the worker and its resume output appears without reload.
320	- [ ] Confirm C remains complete through switches, reload, and reconnect.
321	- [ ] Confirm no conversation disappears, duplicates, borrows content, or shows a stale working state at any checkpoint.
322	- [ ] Confirm no browser console errors or visible generic failures were ignored.
323	
324	**Cleanup and final audit:**
325	
326	- [ ] Delete only the journey-owned runs and verify their durable artifacts are gone.
327	- [ ] Remove only the marked temporary project after the cleanup safety checks pass.
328	- [ ] Confirm unrelated project/conversation counts and the pre-existing dirty-worktree baseline are unchanged.
329	- [ ] Inspect `git status --short` for secrets, auth state, test output, temporary projects, dependencies, caches, logs, or generated artifacts.
330	- [ ] Re-read every pass criterion in the design and attach fresh evidence or an explicit unresolved gap.
331	
332	**Checkpoint:** The user-visible lifecycle is proven end to end with a real worker, and the deterministic suite guards every root cause found along the way.
333	
334	## Agentic journey mission card
335	
336	**Running app:** `http://localhost:3035` or the explicitly configured loopback URL.
337	
338	**User role:** A builder using OmniHarness to manage several Claude Code sessions in one disposable project.
339	
340	**Mission:** Add the marked temporary project, run Conversations A/B/C with Claude Code + GPT-5.6 SOL + Low effort, change A's instructions while it works, stop and resume B, complete C, repeatedly switch among them, reload and reconnect, and decide whether every status and transcript is trustworthy.
341	
342	**Allowed interface:** In-app browser or Playwright browser UI, keyboard, pointer, accessibility tree, and visible page state.
343	
344	**Forbidden shortcuts during the mission:** No API mutations, source inspection, direct database changes, direct worker calls, filesystem edits by the test driver, or implementation knowledge used to choose the next UI action.
345	
346	**Expected visible proof:** Each session remains present exactly once; active and terminal controls are honest; A accepts the changed instruction exactly once; B visibly stops and later shows resumed output; C stays complete; switching, reload, and reconnect do not lose or mix state.
347	
348	**Failure conditions:** A session disappears or flickers out of the list, selection changes unexpectedly, status surfaces disagree, Stop leaves working UI behind, resume returns no visible output, queue state survives acceptance, transcript content crosses sessions, output requires reload, a generic error hides the cause, or cleanup cannot prove ownership.
349	
350	**Approval:** The user explicitly requested this real, potentially long-running agentic journey in the current conversation. The runner still requires its local opt-in guard on every invocation.
351	

uuid: ff9ccd70-0605-4cb9-9fa6-dbbee7922139
parent: 53ad76a8-4d6e-4bef-a41a-47d763b4096e
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-13T18:08:58.956Z","phase":null} -->
## Claude · 2026-07-13T18:08:58.956Z

All three previously flagged gaps are now closed with concrete, testable language (design lines 117–128 and plan lines 37, 149, 165–166, 289).

**Verdict: READY**

## Remaining highest-impact findings

**1. Thirty-minute journey cap vs. 3×8-minute turn budget leaves no arithmetic slack for setup/switching/reconnect overhead.** Three turns alone can legitimately consume 24 minutes before any stalled-turn retries, UI switching, reload, or SSE-drop/reconnect work is counted. If a single turn runs close to 8 minutes, the 30-minute ceiling will trip mid-journey on pure overhead, not on a real bug, producing a spurious failure that looks like a defect. Fix: either bump the journey cap modestly (e.g., 40–45 min) or explicitly state in Task 3/6 that a journey-cap trip is logged as an "inconclusive/retry" outcome distinct from a "defect found" outcome, so Task 7 doesn't mistakenly chase a root cause for a budget artifact.

**2. No stated action when the stalled-turn (2-minute no-progress) Stop itself fails or hangs.** Design/plan correctly specify "use the visible Stop control" on a limit breach, but don't say what happens if Stop doesn't produce a terminal state within a bounded follow-up window (e.g., backend hang). Without a secondary bound, the harness could wait indefinitely on its own safety mechanism. Fix: add a short explicit fallback bound (e.g., "if Stop does not yield a terminal run/worker state within 60 seconds, abort the process and hand off to `cleanup-live-agent-journey.ts` rather than waiting further") to Task 3.

**3. Crash-boundary manifest test (Task 2) proves durability but not the corresponding UI-side ordering guarantee.** The task correctly requires sync-before-next-mutation at the file layer, but doesn't require a test/assertion that the UI helper (Task 4's `omniharness-ui.ts`) actually blocks its next action on that flush completing — i.e., the ordering guarantee could be violated by a caller that fires the manifest write and the next click concurrently. Fix: add one line to Task 4 — "the run-creation helper awaits manifest flush completion before returning control to the next mission step" — so the two tasks' guarantees are wired together explicitly rather than assumed.

## Leave alone

- The eight-minute/two-minute/thirty-minute numeric limits themselves — reasonable, concrete, and matched between design and plan.
- The manifest sync mechanism (flush file + parent directory before next mutation) — correct and sufficiently detailed for an engineer to implement without guessing.
- The cleanup-fallback constraint to the exact production route/handler — closes the earlier gap precisely; no further tightening needed.
- Everything else previously reviewed and unchanged (state authority table, oracle/mutation separation, task sequencing, failure-artifact/privacy rules) — still solid.

uuid: ecf4f79c-f6a3-42fb-bded-2cd7768fe783
parent: ff9ccd70-0605-4cb9-9fa6-dbbee7922139

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:09:31.009Z","phase":null} -->
## Claude state: queue-operation · 2026-07-13T18:09:31.009Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-13T18:09:31.009Z",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9",
  "content": "I applied the remaining useful findings: the whole-journey cap is now forty-five minutes; safety Stop has a sixty-second terminal-state bound and hands off to the exact production cleanup handler while retaining the project if termination cannot be proven; and the UI creation helper must await manifest file/directory sync before any next click, with an ordering test. Re-read only the same two files. Return a final Verdict: READY or HARDEN and list only any remaining blocker."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-13T18:09:31.009Z","phase":null} -->
## Claude state: queue-operation · 2026-07-13T18:09:31.009Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-13T18:09:31.009Z",
  "sessionId": "f134a257-0b70-417d-9c9c-ec7170400cc9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-13T18:09:31.036Z","phase":null} -->
## User · 2026-07-13T18:09:31.036Z

I applied the remaining useful findings: the whole-journey cap is now forty-five minutes; safety Stop has a sixty-second terminal-state bound and hands off to the exact production cleanup handler while retaining the project if termination cannot be proven; and the UI creation helper must await manifest file/directory sync before any next click, with an ordering test. Re-read only the same two files. Return a final Verdict: READY or HARDEN and list only any remaining blocker.

uuid: dfa30ed4-c34c-44ad-8962-73142ef09f91
parent: ecf4f79c-f6a3-42fb-bded-2cd7768fe783

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-13T18:09:33.801Z","phase":null} -->
## Claude tool call: Read · 2026-07-13T18:09:33.801Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md"
}

uuid: c48a9114-39c3-45f1-a6d3-16ab2b6a43df
parent: dfa30ed4-c34c-44ad-8962-73142ef09f91
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-13T18:09:33.806Z","phase":null} -->
## Claude tool result: toolu_01Wgd7weEBizzPiWQxWbtUdL · 2026-07-13T18:09:33.806Z

````text
1	# Claude GPT-5.6 Live Lifecycle Journey Design
2	
3	**Date:** 2026-07-13
4	
5	**Status:** Ready for implementation planning
6	
7	## Purpose
8	
9	Prove that a real user can run Claude Code through OmniHarness with the routed
10	`gpt-5.6-sol` model at low effort, keep several conversations straight, change
11	instructions while a worker is busy, stop and resume work, switch and reload
12	without losing state, and see every completed worker response in the UI.
13	
14	This is not a mock-model happy path. The current milestone uses the real local
15	OmniHarness app, the real CLIProxyAPI connection, the real Claude Code worker,
16	and a disposable project outside the OmniHarness repository. Deterministic
17	tests remain responsible for exact state-machine and race coverage; the live
18	journey proves that those pieces compose into a usable product.
19	
20	## Product outcome
21	
22	An OmniHarness developer can run one opt-in command or follow the same mission
23	in the in-app browser and obtain a trustworthy answer to all of these questions:
24	
25	1. Can the user add a disposable project from the UI?
26	2. Can the user select Claude Code, `GPT-5.6 SOL`, and Low effort?
27	3. Does a new conversation appear once, remain selected, and show honest work
28	   state while the worker is active?
29	4. Can the user switch among three sessions without transcript, selection,
30	   project, model, draft, or status state leaking between them?
31	5. Can a busy worker receive changed instructions immediately, with the queued
32	   row and transcript reflecting exactly one accepted message?
33	6. Does Stop end the real worker turn and clear all working indicators?
34	7. Can a follow-up resume the stopped conversation and make the new output
35	   visible without a hard reload?
36	8. Do reload and SSE reconnect restore the same conversations, transcripts,
37	   statuses, and selection?
38	9. When the UI disagrees with the backend, can the test identify the first
39	   boundary where the state diverged?
40	10. Can all test conversations, workers, artifacts, and temporary files be
41	    removed without touching user projects or unrelated conversations?
42	
43	## User and jobs
44	
45	The primary user is the human builder operating OmniHarness locally.
46	
47	The core job is to delegate work to a coding agent and trust that the UI still
48	represents the same live conversation after normal lifecycle operations.
49	
50	Supporting jobs in this milestone are:
51	
52	- configure the intended harness/model/effort before sending;
53	- understand whether each session is starting, working, queued, stopped,
54	  recoverable, awaiting input, completed, or failed;
55	- change direction without starting a second accidental turn;
56	- leave one conversation, work in another, and return without losing context;
57	- stop expensive or incorrect work and know that it really stopped;
58	- continue a stopped session without losing its transcript or worker identity;
59	- recover after refresh or event-stream interruption;
60	- inspect the event, database, and worker-stream evidence when the screen is
61	  wrong;
62	- clean up only the resources created by the journey.
63	
64	## Scope
65	
66	### Included
67	
68	- An opt-in Playwright configuration for the already-running local app.
69	- A safe live-journey runner with explicit real-token and local-target guards.
70	- A temporary, dependency-free app project created under the operating
71	  system's temporary directory, with a `.gitignore` and an ownership marker.
72	- Browser-only mutations for project addition, conversation creation, model and
73	  effort selection, session switching, interrupt, stop, follow-up/resume, and
74	  reload.
75	- Read-only control-plane oracles using canonical snapshots, named event logs,
76	  conversation/worker entry routes, and SQLite only for post-action comparison
77	  and failure diagnosis.
78	- Three real Claude Code conversations using `cliproxyapi:gpt-5.6-sol` at Low
79	  effort.
80	- Deterministic manager, route, lifecycle, and race tests for every state bug
81	  found by the live run, written before the fix.
82	- Focused fixes for confirmed root causes.
83	- Failure artifacts: trace, screenshot, visible-state checkpoint, redacted
84	  event transcript, and owned-resource manifest under ignored test output.
85	- Targeted cleanup of only the journey's run IDs and temporary project.
86	
87	### Not included in this milestone
88	
89	- Exercising Codex, Gemini, OpenCode, native Claude models, or other gateway
90	  models. The harness is designed so those can be added as later conformance
91	  profiles, but they are not part of this checklist.
92	- A permanent sample app inside the OmniHarness repository.
93	- Running the real-token journey in ordinary CI or as part of `pnpm test`.
94	- Bypassing authentication in the normal local app.
95	- Editing shell profiles, Claude settings, or global CLI configuration.
96	- Deleting unrelated conversations or calling the bulk conversation-deletion
97	  script.
98	- Treating screenshots, logs, HTTP 200 responses, or a passing mock test as
99	  proof that the user journey works.
100	
101	## Safety boundary
102	
103	The live runner refuses to start unless all of these conditions hold:
104	
105	- the target URL is loopback (`localhost`, `127.0.0.1`, or `::1`);
106	- the caller explicitly opts into a real-agent run;
107	- authentication is supplied at runtime or an already authenticated in-app
108	  browser is used;
109	- the gateway status is enabled, running, connected, and advertises or accepts
110	  `gpt-5.6-sol`;
111	- the chosen project path is under the operating system temporary directory;
112	- the project contains a journey ownership marker created by this run;
113	- the project path is not the OmniHarness repository and is not any registered
114	  user project;
115	- the journey manifest starts empty and records every run ID it creates.
116	
117	Each new run ID is appended and flushed to the manifest immediately after the
118	UI exposes it and before the test performs another mutation. The manifest file
119	and its parent directory are synced so a process crash cannot leave a created
120	conversation outside the only authorized cleanup scope.
121	
122	Real-agent cost and time are bounded independently of Playwright's outer test
123	timeout. Each worker turn may be active for at most eight minutes; two minutes
124	without either a visible transition or new durable owned-run evidence is a
125	stalled-turn failure. On either limit, the harness uses the visible Stop control,
126	records the failure, and enters targeted cleanup. If Stop does not produce a
127	terminal run and worker within sixty seconds, the browser phase ends and the
128	targeted cleanup command invokes the same production deletion handler for the
129	manifest-owned run; it never waits indefinitely or removes the temp directory
130	while the worker may still be active. One complete journey may run for at most
131	forty-five minutes, including recovery and cleanup. The prompts also
132	forbid package installation and limit work to the six named project files.
133	
134	The worker prompt repeats the filesystem boundary and forbids package installs,
135	commits, branch operations, and edits outside the temporary project. Cleanup
136	uses the recorded run IDs and ownership marker; it never infers ownership from
137	a title prefix alone.
138	
139	Secrets are never written to traces, manifests, source files, or command-line
140	arguments. A live-test password is read from a runtime environment variable or
141	entered into the in-app browser for the local instance only.
142	
143	## Test project and missions
144	
145	The project is created under a path such as:
146	
147	```text
148	/tmp/omniharness-live-journey-<random>/
149	```
150	
151	It begins with only:
152	
153	```text
154	.gitignore
155	.omniharness-live-journey.json
156	```
157	
158	The project is deliberately dependency-free so the journey does not depend on
159	network package installation and can be removed as one owned directory.
160	
161	### Conversation A: build and interrupt
162	
163	The first prompt asks the worker to create a small browser app called Research
164	Relay using `index.html`, `styles.css`, `app.js`, and `README.md`. It must support
165	adding research notes, tags, filtering, localStorage persistence, and a visible
166	checklist. The worker must inspect and validate its files before completing.
167	
168	After the worker is visibly active and the first durable output or owned file
169	exists, the user changes direction through the busy composer:
170	
171	```text
172	Change direction: use a warm amber theme, add Export JSON, and continue from
173	the work already completed. Do not restart or duplicate files.
174	```
175	
176	The UI must show that the message is queued or being delivered, then the test
177	uses the visible interrupt/send-now action (or the documented Escape action)
178	to deliver it. The message must appear exactly once in the worker stream, and
179	the pending queue item must disappear once accepted into chat.
180	
181	### Conversation B: stop and resume
182	
183	The second prompt asks the worker to inspect the app, perform a careful
184	accessibility and usability audit, and write `AUDIT.md` with exactly five
185	prioritized findings. While this turn is visibly working, the user presses the
186	real Stop control.
187	
188	The UI must become non-working, the run and worker must reach a truthful stopped
189	state, and named terminal evidence must exist. The user then sends:
190	
191	```text
192	Resume this session. Finish AUDIT.md only, using the existing context and
193	files. Do not modify the app.
194	```
195	
196	The session may reattach or recreate according to production policy, but that
197	decision must be named. The new answer and `AUDIT.md` must appear without a
198	manual reload.
199	
200	### Conversation C: complete reference state
201	
202	The third prompt asks the worker to inspect the project and write `STATUS.md`
203	with a concise file inventory and validation summary, without modifying the
204	app. It is allowed to complete normally. This gives the switching test a known
205	terminal conversation while A or B has other lifecycle states.
206	
207	## Human-level journey
208	
209	All mutations are performed through visible controls:
210	
211	1. Unlock the local app if needed.
212	2. Add the temporary project with **Add project** and **Select Project Folder**.
213	3. Select **Direct control**, **Claude Code**, **GPT-5.6 SOL**, and **Low**.
214	4. Start Conversation A and capture its run ID from the selected URL or
215	   browser-visible conversation identity.
216	5. Confirm visible active state, switch away, and confirm A remains listed with
217	   the same status.
218	6. Create Conversation B, switch A -> B -> A -> B, and confirm neither
219	   conversation disappears, duplicates, or borrows the other's transcript.
220	7. Interrupt A with the changed instruction and verify queue-to-transcript
221	   movement.
222	8. Stop B, verify the working indicator and Stop control disappear, and then
223	   resume B with a follow-up.
224	9. Create and complete Conversation C.
225	10. Repeatedly switch A -> C -> B -> A while statuses change.
226	11. Reload the selected session, then simulate an SSE disconnect/reconnect in
227	    the headless profile and repeat the switch loop.
228	12. Verify final files and visible assistant answers.
229	13. Compare the visible state with the canonical server evidence.
230	14. Delete only A, B, and C through the production conversation delete flow,
231	    remove the project from OmniHarness if that action is available and safe,
232	    then remove the owned temporary directory.
233	
234	The in-app agentic run follows the same mission card and does not use backend
235	state to decide where to click. The deterministic Playwright run may use the
236	server evidence as assertions after each visible action, but never as a
237	shortcut for a mutation.
238	
239	## State authority and invariants
240	
241	| State | Owner | Token/order | Completeness and UI rule |
242	| --- | --- | --- | --- |
243	| Selected project/run | URL + `HomeUiStateManager` | project path + run ID + selection request ID | Late create/load results cannot steal a newer selection. |
244	| Conversation catalog | server snapshot, mirrored by `EventStreamStateManager` | snapshot event ID and deterministic `(updatedAt, id)` order | Cache is preview only; partial run snapshots cannot erase known or optimistic runs. |
245	| Run lifecycle | server `runs` row and named events | run ID + event ID | UI cannot invent working/done by diffing transcripts. |
246	| Worker lifecycle | server worker row/runtime decision | worker ID + event ID | `cancelled`, terminal run state, or terminal event defeats stale current text. |
247	| Worker transcript | unified append-only worker JSONL | worker ID + monotonic seq | Fallback rows may pre-render but cannot duplicate or replace authoritative entries. |
248	| Busy message queue | server queued-message rows, optimistically mirrored by `BusyMessageQueueManager` | message ID + status transition | Accepted/delivered items leave the drawer; cancelled/failed items cannot resurrect from late responses. |
249	| SSE connection | `LiveEventConnectionManager` over server event ring | `Last-Event-ID` | Reconnect replays the gap or requires a complete resync; an open socket alone is not authority. |
250	| Gateway readiness | server gateway singleton/snapshot | gateway revision | Cached model choices do not imply readiness; routed spawn must refuse rather than fall back. |
251	| Journey ownership | live-test manifest | journey ID | Cleanup touches only recorded runs and the marked temp directory. |
252	
253	For every async result, the implementation asks: what can arrive late, out of
254	order, partially, twice, or after the user selected a different session? Tests
255	must prove that such a result cannot mutate the newly selected context.
256	
257	## Status contract
258	
259	The UI must distinguish these user-relevant states:
260	
261	- **Starting/working:** a real turn is active; a visible pending assistant state
262	  and Stop control identify the concrete worker.
263	- **Queued:** a follow-up is accepted for later delivery and remains actionable.
264	- **Interrupting/delivering:** the queued item has left the ordinary queue and
265	  cannot appear twice.
266	- **Awaiting user:** the worker asked for input and no fake working spinner is
267	  shown.
268	- **Stopped/cancelled:** the worker is no longer doing work; stale worker text
269	  cannot keep the conversation active.
270	- **Recoverable:** the previous turn stopped or failed in a way that supports a
271	  visible resume action or follow-up.
272	- **Completed:** final output is durable and visible; no Stop control or
273	  trailing Thinking indicator remains.
274	- **Failed:** the real cause is visible and a stable `error.surfaced` event is
275	  inspectable.
276	
277	Sidebar, header, transcript, and control states must agree. Any disagreement is
278	a test failure even if one surface is eventually corrected by reload.
279	
280	## Observability contract
281	
282	The live journey records a redacted checkpoint after every important action:
283	
284	- timestamp and journey step;
285	- selected URL, project, and run ID;
286	- visible conversation titles and status indicators;
287	- visible transcript entry IDs or stable text hashes;
288	- canonical snapshot anchor ID;
289	- relevant named events since the prior anchor;
290	- run, worker, and queued-message state;
291	- latest worker-stream sequence for each owned worker.
292	
293	Expected production evidence includes the existing typed events such as
294	`worker.spawned`, `worker.status`, `worker.terminal`, `worker.reattached`,
295	`worker.recreated`, `worker.entry_appended`, queue interruption decisions,
296	recovery events, `conversation.deleted`, `stream.resync_required`, and
297	`error.surfaced` when applicable.
298	
299	If the event is absent, the server did not publish the decision and the failure
300	is not classified as a frontend-only bug. If the event and persisted state are
301	correct but the screen is wrong, the test captures the responsible client
302	manager snapshot and stale owner token before any fix is attempted.
303	
304	## Failure artifact and privacy rules
305	
306	On failure, the harness retains only ignored artifacts under `test-results/`:
307	
308	- Playwright trace and screenshot;
309	- a bounded DOM snapshot around the affected surface;
310	- a redacted event transcript for owned run IDs;
311	- the journey manifest and checkpoint report;
312	- bounded tails of owned worker JSONL files.
313	
314	The report excludes passwords, gateway tokens, OAuth URLs, credential files,
315	unrelated run titles/content, and full database dumps. Passing runs may retain a
316	short summary but not secrets or user conversation content.
317	
318	## Deterministic regression strategy
319	
320	The live journey is a finder and final proof, not the only regression test.
321	Each observed failure is reduced before production code changes:
322	
323	- stale selection, catalog disappearance, snapshot merge, and status classifier
324	  bugs become focused Manager tests;
325	- transcript duplication or missing output becomes worker-entry/transcript
326	  manager and unified-stream tests;
327	- interrupt, stop, resume, finalization, or reattach bugs become headless
328	  lifecycle HTTP/SSE scenarios with exact named-event transcripts;
329	- route contract failures become runtime route tests;
330	- only visible layout, affordance, focus, and cross-session composition remain
331	  in Playwright.
332	
333	Every fix follows red -> green -> full focused verification. A screenshot or a
334	single successful manual retry is never the regression test.
335	
336	## Pass criteria
337	
338	The current milestone passes only when all of the following are true in a
339	fresh real journey:
340	
341	- all three conversations are created through the UI with Claude Code,
342	  `GPT-5.6 SOL`, and Low effort;
343	- the gateway route is used and no native-model fallback occurs;
344	- each conversation appears once and remains stable through switching;
345	- active, queued, stopped, recoverable, and completed states are visibly honest;
346	- the interrupt instruction is delivered once and reflected in A's final app;
347	- Stop ends B's actual turn and clears active UI promptly;
348	- B resumes and its new worker output appears without reload;
349	- C completes and remains terminal through all switches;
350	- transcript content never crosses run boundaries;
351	- reload and SSE reconnect preserve selection, transcripts, and status;
352	- canonical snapshots, named events, SQLite rows, and worker streams agree with
353	  the final visible state;
354	- every bug found has a deterministic failing regression and a verified fix;
355	- focused tests, the lifecycle suite, typecheck, build, live Playwright run, and
356	  the in-app agentic mission all pass with fresh evidence;
357	- only journey-owned test data is removed at the end.
358	
359	## North star and later profiles
360	
361	The north star is a provider-agnostic conformance suite in which every supported
362	OmniHarness worker type and model route must pass the same lifecycle contract:
363	create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload,
364	and clean up.
365	
366	After this milestone is proven with Claude Code + `gpt-5.6-sol`, later profiles
367	can supply different harness/model selectors and safe missions while reusing
368	the same state and observability assertions. Those profiles are product
369	direction, not part of this implementation checklist.
370	

uuid: c694b0d8-470c-4b76-a474-f9c67ed047cc
parent: c48a9114-39c3-45f1-a6d3-16ab2b6a43df
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-07-13T18:09:34.486Z","phase":null} -->
## Claude tool call: Read · 2026-07-13T18:09:34.486Z

```json
{
  "file_path": "/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-07-13-claude-gpt56-live-lifecycle-journey.md"
}

uuid: 64c13fab-6caa-4b4f-a7ef-27b19e5a0de9
parent: c694b0d8-470c-4b76-a474-f9c67ed047cc
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-07-13T18:09:34.736Z","phase":null} -->
## Claude tool result: toolu_01UZzDGVPEUQ6XEaNvdUhGzF · 2026-07-13T18:09:34.736Z

```text
1	# Claude GPT-5.6 Live Lifecycle Journey Implementation Plan
2	
3	> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. Mark a checkbox only after its stated evidence has been run and read.
4	
5	**Goal:** Add a safe, repeatable human-level test journey that proves Claude Code can use `GPT-5.6 SOL` at Low effort across interrupt, multi-session switching, stop, resume, reload, and reconnect, then fix every confirmed state or delivery bug with deterministic regression coverage.
6	
7	**Architecture:** Keep one production control plane and add an opt-in Playwright consumer of it. All mutations in the live journey use the real UI; canonical snapshots, named events, targeted route reads, SQLite, and unified worker JSONL act only as after-action oracles. The runner owns a marked temporary project and a manifest of exact run IDs so real-agent testing cannot touch the repository or unrelated conversations.
8	
9	**Tech Stack:** Next.js 15, React 19, TypeScript, global Manager classes, Playwright, Vitest, lifecycle HTTP/SSE harness, SQLite/Drizzle, unified worker JSONL, CLIProxyAPI, Claude Code ACP.
10	
11	**Design specification:** `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
12	
13	**North Star Product:** A provider-agnostic conformance suite that every OmniHarness CLI/model combination must pass for create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload, and cleanup.
14	
15	**Current Milestone:** Real Claude Code through `cliproxyapi:gpt-5.6-sol` at Low effort in one disposable project with three conversations and the full lifecycle journey.
16	
17	**Future Product Direction:** Add profile data for native Claude, Codex, Gemini, OpenCode, and later gateway models only after the current profile is reliable. This context is not part of the implementation checklist below.
18	
19	**Final Functionality Standard:** The milestone is complete only when the real browser journey passes twice from fresh state, every discovered defect has a red-green deterministic regression, server evidence agrees with the visible UI, and only journey-owned data is cleaned up.
20	
21	---
22	
23	## Execution rules
24	
25	- [ ] Work directly in the current checkout. Never create a branch or worktree.
26	- [ ] Preserve all unrelated dirty-worktree changes and do not reformat touched files broadly.
27	- [ ] Do not delete any existing source file, conversation, project, branch, or artifact.
28	- [ ] Use `apply_patch` for source and test edits.
29	- [ ] Reuse the already-running app at `http://localhost:3035` (or the configured local URL); do not start a competing dev server.
30	- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md`, `docs/architecture/worker-conversation-stream.md`, and `docs/architecture/direct-control-session-regressions.md` before changing server lifecycle behavior.
31	- [ ] Use the unified worker stream through `appendWorkerEntry`; do not add another transcript store.
32	- [ ] Emit typed named events for every new server decision and `error.surfaced` for every new user-relevant failure.
33	- [ ] Put any new visible copy in every `shared/locales/*.json` file and render it through `t()`; prefer no new product copy for the harness.
34	- [ ] Keep shared client state in the existing Manager classes. Every async mutation, snapshot, timer, and stream callback must prove current ownership before updating visible state.
35	- [ ] Write the failing deterministic test before each production fix and watch the expected failure.
36	- [ ] Use condition-based waits tied to visible or durable state. Do not make fixed sleeps the primary synchronization mechanism.
37	- [ ] Cap each real worker turn at eight active minutes, fail after two minutes with no visible transition or new durable owned-run evidence, and cap one full journey at forty-five minutes. On a limit, use the visible Stop control before cleanup.
38	- [ ] Keep real-agent tests opt-in and out of normal `pnpm test`, default Playwright, and CI.
39	- [ ] Keep passwords, gateway tokens, OAuth data, session cookies, and unrelated conversation content out of test output and source control.
40	
41	## File map
42	
43	### New live-journey harness
44	
45	- `playwright.live.config.ts`: opt-in configuration for an already-running local app; one worker, no retries, long per-test deadline, and trace/screenshot retention on failure.
46	- `tests/e2e/live/types.ts`: journey manifest, checkpoint, owned run, gateway preflight, and redacted evidence contracts.
47	- `tests/e2e/live/safety.ts`: loopback validation, temp-root containment, ownership-marker checks, repository/project exclusion, explicit real-agent opt-in, and secret-free manifest helpers.
48	- `tests/e2e/live/auth.ts`: unlock the real local app from a runtime-only password without storing it in source or the durable report.
49	- `tests/e2e/live/omniharness-ui.ts`: stable browser operations for folder selection, harness/model/effort selection, conversation creation, switching, interrupt/send-now, stop, resume/follow-up, reload, and visible-state capture.
50	- `tests/e2e/live/control-plane-oracle.ts`: read-only canonical snapshot, event-log, worker-entry, and targeted run evidence for journey-owned IDs.
51	- `tests/e2e/live/project-fixture.ts`: create the marked dependency-free temporary project and remove it only after ownership and containment checks pass.
52	- `tests/e2e/live/checkpoint-reporter.ts`: write bounded, redacted ignored artifacts and a step-by-step UI/server comparison.
53	- `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`: the three-conversation live journey and final filesystem assertions.
54	- `scripts/cleanup-live-agent-journey.ts`: recover cleanup from an interrupted run using a manifest path, targeted run IDs, and the ownership marker; never bulk-delete conversations.
55	- `tests/e2e/live/safety.test.ts`: deterministic tests for all guard and cleanup-refusal cases.
56	- `tests/e2e/live/checkpoint-reporter.test.ts`: deterministic redaction and mismatch-report tests.
57	
58	### Existing configuration and scripts
59	
60	- `.gitignore`: confirm existing `/test-results/` and `/playwright-report/` coverage is sufficient; add only a focused live-auth or manifest path if a new artifact falls outside those roots.
61	- `package.json`: add `test:e2e:live:claude` and `test:e2e:live:cleanup`; do not change the default `test:e2e` command.
62	- `playwright.config.ts`: leave the mock/default suite behavior unchanged unless a shared type-only extraction is required.
63	
64	### Deterministic regression targets used only when the live journey exposes a failure
65	
66	- `tests/app/event-stream-state-manager.test.ts` / `src/app/home/EventStreamStateManager.ts`: catalog completeness, stale snapshot, optimistic-run retirement, and deterministic ordering.
67	- `tests/app/run-selection-effects.test.ts` / `src/app/home/useRunSelectionEffects.ts`: late selection/load ownership and URL/session restoration.
68	- `tests/app/home-view-model.test.ts` / `src/app/home/useHomeViewModel.ts`: selected-run composition and cross-session projection.
69	- `tests/app/home/sidebar-activity.test.ts` / `src/app/home/sidebar-activity.ts`: honest per-session sidebar status.
70	- `tests/app/direct-control-activity.test.ts` / `src/app/home/direct-control-activity.ts`: active, cancelled, terminal, and stale-current-text classification.
71	- `tests/app/live-event-connection-manager.test.ts` / `src/app/home/LiveEventConnectionManager.ts`: replay, resync, owner fencing, and reconnect state.
72	- `tests/app/worker-entries-manager.test.ts` / `src/app/home/WorkerEntriesManager.ts`: seq ordering, revalidation after loaded-empty state, and selection isolation.
73	- `tests/app/conversation-transcript-manager.test.ts` / `src/app/home/ConversationTranscriptManager.ts`: fallback/stream dedupe and transcript ownership.
74	- `tests/app/busy-message-queue-manager.test.ts` / `src/app/home/BusyMessageQueueManager.ts`: interrupt acceptance, optimistic hiding, late-response rejection, and no resurrection. Create the focused test file if it does not already exist.
75	- `tests/ui/conversation-actions.test.ts`, `tests/ui/sidebar-layout.test.ts`, and `tests/ui/composer-shell.test.ts`: source-level or rendered affordance contracts when the visible control is wrong.
76	- `tests/conversations/direct-run-status.test.ts` / `src/server/conversations/direct-run-status.ts`: successful-turn terminal resolution.
77	- `tests/server/conversations/worker-turn-gate.test.ts`, `tests/server/conversations/reconcile-user-messages.test.ts`, and focused send/queue tests: exactly-once acceptance and finalization.
78	- `tests/lifecycle/scenarios/conversation-continuation.test.ts`: follow-up persistence across SSE gaps.
79	- `tests/lifecycle/scenarios/direct-mode-rerun.test.ts`: stopped direct-session continuation.
80	- `tests/lifecycle/scenarios/worker-reattach.test.ts`: explicit reattach/recreate decision evidence.
81	- `tests/lifecycle/scenarios/sse-resume.test.ts`: replay or resync after disconnect.
82	- Create `tests/lifecycle/scenarios/direct-control-interrupt-stop-resume.test.ts` only if the existing scenarios cannot express the exact combined production sequence without conflating responsibilities.
83	
84	### Architecture and durable lessons
85	
86	- `docs/architecture/lifecycle-observability-and-testing.md`: document only genuinely new event/state invariants introduced by a fix.
87	- `docs/architecture/direct-control-session-regressions.md`: add the exact reproduced sequence and rule for a new direct-control bug class.
88	- `docs/superpowers/learnings/YYYY-MM-DD-<root-cause>.md`: one concise learning for each meaningful client/server ownership, persistence, recovery, or control-plane root cause fixed.
89	
90	### Large-file constraint
91	
92	`src/components/Terminal.tsx` and `src/components/home/ConversationMain.tsx` already exceed 1200 lines. The plan does not add harness logic to either file. If a confirmed UI root cause requires touching one, first extract the smallest cohesive state/behavior unit into a focused module and cover it with a failing test; do not expand the oversized component further.
93	
94	## State and data invariants
95	
96	- [ ] The server snapshot is authoritative for the complete conversation catalog only when its anchor and scope declare completeness; cached/scoped data is preview.
97	- [ ] A partial run or worker update may refine known state but may not erase other conversations, optimistic creations, delivered input, read markers, or stream entries.
98	- [ ] Selection-changing async work is fenced by project path, run ID, and request/operation ID and rechecks ownership immediately before mutation or navigation.
99	- [ ] Conversation ordering uses a deterministic tie-breaker such as `(updatedAt, id)`, never timestamp alone.
100	- [ ] The URL, `HomeUiStateManager`, selected snapshot scope, transcript manager, and composer all refer to the same run before visible state changes.
101	- [ ] The unified worker JSONL is the final transcript authority, keyed by worker ID and monotonic seq.
102	- [ ] A loaded-empty stream at seq 0 is an observation, not permanent completeness; selecting it again revalidates.
103	- [ ] Queue states are monotonic from the user's perspective. An item accepted into chat leaves the drawer immediately and cannot be resurrected by a stale poll or mutation result.
104	- [ ] Active UI requires real current activity. Terminal/cancelled run or worker evidence defeats stale `currentText`, old bridge snapshots, and optimistic `running` rows.
105	- [ ] Stop targets a concrete active worker and emits `worker.status` plus `worker.terminal`; the UI clears active controls without waiting for reload.
106	- [ ] Resume/follow-up publishes `worker.reattached` or `worker.recreated` as appropriate, persists the new turn through the normal finalization path, and appends visible output to the same conversation stream.
107	- [ ] SSE frames have IDs. Reconnect supplies `Last-Event-ID`, fills the gap from the ring, or receives `stream.resync_required` and bootstraps a complete snapshot.
108	- [ ] Gateway readiness has a revision and remains server-owned. Selecting an encoded routed model never falls back to native Claude.
109	- [ ] The journey manifest is the sole cleanup authority. A title prefix, temp-looking path, or absent database row is insufficient authorization to delete anything.
110	
111	## Task 1: Establish the baseline and lock the live mission
112	
113	**Files:**
114	
115	- Verify `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
116	- Read the three architecture documents listed in the execution rules
117	- No production source edits
118	
119	- [ ] Record the current dirty-worktree paths and treat them as user-owned baseline.
120	- [ ] Confirm the running proxy and Next server ports, login shell, gateway status, Claude model catalog, and `GPT-5.6 SOL` option through the real UI.
121	- [ ] Confirm the live URL is local and the app can be authenticated without changing the configured password.
122	- [ ] Run the focused gateway suites and existing direct-session/lifecycle suites before adding the harness; record pre-existing failures separately.
123	- [ ] Write the exact three prompts from the design into the live spec as constants. Keep them dependency-free, low-effort, and bounded to the owned temp project.
124	- [ ] Define checkpoints for `created`, `working`, `switched-away`, `interrupt-queued`, `interrupt-accepted`, `stopped`, `resumed`, `completed`, `reloaded`, `reconnected`, and `cleaned`.
125	- [ ] Confirm the UI controls' accessible contracts from the running app: Add project, folder dialog, Direct control, CLI harness, Worker model, Worker effort, Send/Stop, queue interrupt, conversation selection, and delete.
126	- [ ] Do not begin a real worker turn during this task.
127	
128	**Verification:**
129	
130	- [ ] Save only non-secret baseline results in the implementation notes.
131	- [ ] Run `git diff --check` and confirm this task changed documentation/test constants only.
132	
133	**Checkpoint:** The mission, cost boundary, UI actions, and existing failures are known before harness code or real token use.
134	
135	## Task 2: Build and test the safety boundary
136	
137	**Files:**
138	
139	- Create `tests/e2e/live/types.ts`
140	- Create `tests/e2e/live/safety.ts`
141	- Create `tests/e2e/live/project-fixture.ts`
142	- Create `tests/e2e/live/safety.test.ts`
143	
144	- [ ] Write failing tests that reject non-loopback URLs, missing real-agent opt-in, missing password/session input, repository paths, registered user-project paths, non-temp paths, `..` escapes, symlink escapes, missing/mismatched ownership markers, non-empty manifests at creation, and cleanup IDs absent from the manifest.
145	- [ ] Write failing tests that allow `localhost`, `127.0.0.1`, and `::1`, then create a random temp directory with `.gitignore` and an ownership marker containing only journey ID, created-at, and path.
146	- [ ] Watch the safety suite fail for the expected missing implementation, not for test setup.
147	- [ ] Implement pure guards first, then the minimal filesystem fixture.
148	- [ ] Make cleanup verify realpath containment, marker journey ID, and manifest ownership immediately before each destructive action.
149	- [ ] Append each run ID and flush the manifest file plus its parent directory synchronously as soon as the UI exposes the ID, before any later UI mutation. Add a crash-boundary test proving cleanup can recover a run created immediately before process exit.
150	- [ ] Refuse cleanup when any proof is missing; leave a clear recovery report instead of guessing.
151	- [ ] Ensure manifest serialization cannot contain passwords, cookies, tokens, OAuth URLs, arbitrary environment data, or unrelated run content.
152	- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts` and confirm all cases pass.
153	
154	**Checkpoint:** No browser or worker can be started until the test proves it owns a harmless local project and exact cleanup scope.
155	
156	## Task 3: Add the opt-in live Playwright surface
157	
158	**Files:**
159	
160	- Create `playwright.live.config.ts`
161	- Create `tests/e2e/live/auth.ts`
162	- Modify `package.json`
163	- Inspect `.gitignore`
164	
165	- [ ] Add a configuration test or import assertion that verifies the live config has no `webServer`, uses one worker, zero retries, a forty-five-minute journey timeout, `trace: retain-on-failure`, `screenshot: only-on-failure`, and a loopback base URL.
166	- [ ] Implement an eight-minute active-turn deadline and a two-minute no-progress deadline that watch visible transitions plus new durable evidence. A deadline must visibly Stop the owned worker, record the failure, and proceed to targeted cleanup rather than merely timing out the Playwright process.
167	- [ ] Bound safety Stop itself: if the UI does not expose terminal run and worker state within sixty seconds, end the browser phase and hand the manifest to targeted cleanup, which invokes the same production delete handler. If that handler cannot prove termination, retain the manifest/report and do not remove the temp project.
168	- [ ] Configure `testDir` narrowly to `tests/e2e/live` so ordinary E2E tests cannot accidentally run real agents.
169	- [ ] Require `OMNIHARNESS_LIVE_E2E=1` and read `OMNIHARNESS_LIVE_E2E_PASSWORD` only at runtime. Allow an already-authenticated in-app journey as the manual alternative.
170	- [ ] Implement UI login using the current password form; never place the password in Playwright output, trace annotations, or manifest.
171	- [ ] Add `pnpm test:e2e:live:claude` without changing `pnpm test:e2e`.
172	- [ ] Confirm all live artifacts remain under ignored `test-results/`/`playwright-report/`; do not add a tracked auth state file.
173	- [ ] Run a preflight-only Playwright test that logs in, reaches the workspace, and exits without creating a project or conversation.
174	
175	**Checkpoint:** A developer can attach headless Chromium to the real local app safely, but no real agent work starts yet.
176	
177	## Task 4: Implement UI-only actions and visible checkpoints
178	
179	**Files:**
180	
181	- Create `tests/e2e/live/omniharness-ui.ts`
182	- Create `tests/e2e/live/checkpoint-reporter.ts`
183	- Create `tests/e2e/live/checkpoint-reporter.test.ts`
184	
185	- [ ] Write failing reporter tests for secret redaction, bounded DOM/event/stream tails, stable text hashing, mismatch classification, and omission of unrelated runs.
186	- [ ] Implement one UI helper per user action. Use `data-testid` only when the existing accessible name or stable URL cannot uniquely identify the control; never rely on `.first()` or positional CSS.
187	- [ ] Every action must take a fresh or still-valid DOM observation, prove a unique target, perform one mutation, and wait for a visible state transition.
188	- [ ] Capture selected URL/run, visible session list, status labels, transcript hashes, Stop/Send state, queued drawer state, and visible error state after each checkpoint.
189	- [ ] Make the conversation-creation helper await the synchronous manifest append/file-and-directory flush before returning control to the next mission step; add a test proving the next click cannot run concurrently with that flush.
190	- [ ] Add assertions that the selected conversation title and transcript remain stable through A -> B -> A switching before any server oracle is read.
191	- [ ] Do not put API mutation shortcuts in this helper.
192	- [ ] Run reporter unit tests and a no-agent browser smoke that opens/closes the project picker and changes then restores harness/model/effort selections.
193	
194	**Checkpoint:** The test can behave like a human and describe what the human sees without backend knowledge.
195	
196	## Task 5: Add the read-only control-plane oracle
197	
198	**Files:**
199	
200	- Create `tests/e2e/live/control-plane-oracle.ts`
201	- Extend `tests/e2e/live/checkpoint-reporter.test.ts`
202	
203	- [ ] Write failing tests for parsing the canonical snapshot anchor, scoping events to owned run IDs, deterministic event ordering, worker-entry monotonic seq, queue status comparison, and redaction.
204	- [ ] Read `/api/events?snapshot=1&persisted=1`, the dev event-log endpoint, targeted worker entries/transcript routes, and only the run IDs recorded in the journey manifest.
205	- [ ] Keep SQLite inspection behind a diagnostic function used after a mismatch or at final audit; query only owned run IDs and the tables named in the architecture debugging checklist.
206	- [ ] Implement comparison rules for selected run, catalog membership, sidebar status, run/worker state, queue state, transcript seq/content hashes, and terminal/active consistency.
207	- [ ] Classify the first divergence as control-plane missing decision, persistence/finalization gap, stream delivery gap, client ownership/merge bug, or visible affordance bug.
208	- [ ] Never use the oracle to create, send, interrupt, stop, resume, switch, or delete.
209	- [ ] Run the focused oracle/reporter tests.
210	
211	**Checkpoint:** When the screen is wrong, the harness points to the first disagreeing boundary instead of guessing.
212	
213	## Task 6: Write the real three-conversation journey before fixing anything
214	
215	**Files:**
216	
217	- Create `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`
218	
219	- [ ] Write the full test with the three prompts and checkpoints from the design.
220	- [ ] Preflight gateway status and the exact catalog value `cliproxyapi:gpt-5.6-sol`; refuse rather than substitute another model.
221	- [ ] Add the marked temporary project through **Add project** and the real folder picker.
222	- [ ] Select Direct control, Claude Code, `GPT-5.6 SOL`, and Low before every new conversation; assert the compound selection remains correct after session switches.
223	- [ ] Start A, record its URL/run ID, and wait for visible active state plus durable `worker.spawned`/`worker.status` evidence.
224	- [ ] Create B while A remains active, switch A -> B -> A -> B, and assert both sidebar rows, URL selection, model/effort, and transcript ownership.
225	- [ ] Send A's change-of-direction message while busy, verify queued state, use the visible interrupt/send-now action, and assert exactly one accepted stream input and no remaining pending row.
226	- [ ] Stop B through the visible Stop control and assert active UI clears; then send the resume follow-up and assert visible post-resume output without reload.
227	- [ ] Create C, let it complete, and use it as the known-terminal reference while A and B change state.
228	- [ ] Repeat A -> C -> B -> A switches while capturing checkpoints. Fail on disappearance, duplication, wrong status, transcript bleed, stale Thinking, missing Stop, or lost output.
229	- [ ] Reload the selected run and assert the same URL, transcript, and terminal/active status after authority loads.
230	- [ ] Drop and restore browser network/SSE in the Playwright profile, then assert replay or resync and repeat the switch loop.
231	- [ ] Verify `index.html`, `styles.css`, `app.js`, `README.md`, `AUDIT.md`, and `STATUS.md` inside the owned project and assert the interrupt requirements are present.
232	- [ ] Let the first run expose failures. Do not patch production code inside this task.
233	
234	**Verification:**
235	
236	- [ ] Run only the live spec with a single explicit real-agent opt-in.
237	- [ ] Preserve the first failing trace/checkpoint and record exact reproduction steps.
238	- [ ] If the journey passes, still inspect the complete event transcript and state comparisons before moving on.
239	
240	**Checkpoint:** There is one real, repeatable account of what currently breaks, with visible and server evidence tied to owned IDs.
241	
242	## Task 7: Reduce each failure to a deterministic red test
243	
244	**Files:**
245	
246	- Use the regression targets in the file map; do not choose a production file before tracing the failing boundary.
247	
248	- [ ] For each observed failure, read the full error/trace, reproduce it at least twice, and identify the first state boundary that diverges.
249	- [ ] Compare the broken path with the nearest working path in the same codebase.
250	- [ ] State one root-cause hypothesis and the evidence that supports it.
251	- [ ] Add the smallest failing deterministic test at the owning layer and run it to see the expected failure.
252	- [ ] For stale selection/catalog bugs, defer request A, switch to B, resolve A, and assert A cannot mutate B or erase catalog rows.
253	- [ ] For status bugs, table-test active, runnable, awaiting-user, cancelled, terminal, stale, and recoverable inputs across sidebar and conversation projections.
254	- [ ] For missing/duplicate output, reproduce fallback/stream arrival orders and worker seq gaps without a browser.
255	- [ ] For interrupt/stop/resume bugs, add a lifecycle event transcript asserting input acceptance, queue transition, terminal event, reattach/recreate decision, finalization, and final run state.
256	- [ ] For reconnect bugs, bootstrap at an anchor, emit during the gap, reconnect with the last ID, and assert replay or explicit resync.
257	- [ ] Do not combine unrelated root causes in one test or one patch.
258	
259	**Checkpoint:** Every production change that follows has a test that demonstrated the actual bug first.
260	
261	## Task 8: Implement minimal root-cause fixes
262	
263	**Files:**
264	
265	- Modify only the owning modules identified by Task 7.
266	- Add locale keys in all locale files only if a visible error/action needs new copy.
267	- Add or update architecture/learning docs for meaningful root causes.
268	
269	- [ ] Implement one minimal fix per confirmed hypothesis.
270	- [ ] Keep server authority on the server and client projection in Managers; do not add component-local arrays, parallel caches, translated persisted strings, or transaction-carried UI state.
271	- [ ] Fence every late callback with the correct compound owner token.
272	- [ ] Preserve partial/complete snapshot semantics and deterministic ordering.
273	- [ ] Reuse the existing successful worker-turn finalization path for interrupt, queue drain, stop/recovery follow-up, and reattach output.
274	- [ ] Emit a typed named decision and surfaced error where the server previously returned silently or swallowed a user-relevant failure.
275	- [ ] If `Terminal.tsx` or `ConversationMain.tsx` must change, extract a focused helper/module before adding behavior because both files are already oversized.
276	- [ ] Run the red test until green, then run all directly related Manager/route/lifecycle suites.
277	- [ ] If a hypothesis fails, return to evidence gathering. After three failed fixes for the same symptom, stop and review the architecture with the user instead of stacking a fourth patch.
278	- [ ] Record a durable learning for every meaningful state ownership, stream, persistence, stop/resume, or recovery root cause.
279	
280	**Checkpoint:** Confirmed causes are fixed at their source, with no symptom-only polling, reload, timeout, or fallback workaround.
281	
282	## Task 9: Add crash-safe targeted cleanup
283	
284	**Files:**
285	
286	- Create `scripts/cleanup-live-agent-journey.ts`
287	- Modify `package.json`
288	- Extend `tests/e2e/live/safety.test.ts`
289	
290	- [ ] Write failing tests for targeted deletion of manifest-owned run IDs, idempotent already-gone responses, refusal on unknown IDs, refusal on marker mismatch, refusal outside temp, and preservation of the report when cleanup is incomplete.
291	- [ ] Prefer deleting A/B/C through the same production conversation delete flow exercised by the UI. Allow a targeted authenticated DELETE fallback for cleanup only, record that fallback, and require it to invoke the exact same server route/handler as the UI delete action rather than a new deletion path.
292	- [ ] Wait for `conversation.deleted` or verify an idempotent absent result for each owned ID.
293	- [ ] Confirm related workers, messages, queued rows, execution events, recovery rows, and run-data files are removed by production cascade behavior; never hand-delete database rows.
294	- [ ] Remove the temp directory only after all owned workers are terminal, all manifest run deletions are confirmed, realpath/marker checks pass, and no process has the directory as its working directory.
295	- [ ] If project grouping is derived from conversations, confirm it disappears after targeted deletion; do not invent a second project registry cleanup.
296	- [ ] Keep the manifest/report when cleanup refuses so a developer can inspect and rerun the cleanup command safely.
297	- [ ] Run safety and cleanup tests without touching real conversations.
298	
299	**Checkpoint:** Normal completion and interrupted test runs can clean only what they prove they own.
300	
301	## Task 10: Run the final verification matrix
302	
303	**Deterministic checks:**
304	
305	- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts tests/e2e/live/checkpoint-reporter.test.ts`.
306	- [ ] Run every focused Manager, route, server, and lifecycle regression added or changed during Tasks 7-8.
307	- [ ] Run `pnpm test:lifecycle` and account for every scenario; do not summarize a partial pass as green.
308	- [ ] Run the focused Claude model gateway suite, including routing and real smoke coverage appropriate to the current installation.
309	- [ ] Run `pnpm typecheck`.
310	- [ ] Run `pnpm lint` on touched source/test files or the repository command if it supports clean targeted execution.
311	- [ ] Run `pnpm build`.
312	- [ ] Run `git diff --check`.
313	
314	**Real browser checks:**
315	
316	- [ ] Run `pnpm test:e2e:live:claude` from a fresh marked temp project and read the full result.
317	- [ ] Run the same mission through the in-app browser as a black-box user. Use only visible UI to choose actions; use the oracle afterward for comparison.
318	- [ ] Repeat the live journey once more from fresh state to catch one-run timing luck.
319	- [ ] Confirm both runs used Claude Code, encoded model `cliproxyapi:gpt-5.6-sol`, and Low effort in persisted worker selection.
320	- [ ] Confirm A's interrupted instruction appears once and the app contains the changed requirement.
321	- [ ] Confirm B's Stop ends the worker and its resume output appears without reload.
322	- [ ] Confirm C remains complete through switches, reload, and reconnect.
323	- [ ] Confirm no conversation disappears, duplicates, borrows content, or shows a stale working state at any checkpoint.
324	- [ ] Confirm no browser console errors or visible generic failures were ignored.
325	
326	**Cleanup and final audit:**
327	
328	- [ ] Delete only the journey-owned runs and verify their durable artifacts are gone.
329	- [ ] Remove only the marked temporary project after the cleanup safety checks pass.
330	- [ ] Confirm unrelated project/conversation counts and the pre-existing dirty-worktree baseline are unchanged.
331	- [ ] Inspect `git status --short` for secrets, auth state, test output, temporary projects, dependencies, caches, logs, or generated artifacts.
332	- [ ] Re-read every pass criterion in the design and attach fresh evidence or an explicit unresolved gap.
333	
334	**Checkpoint:** The user-visible lifecycle is proven end to end with a real worker, and the deterministic suite guards every root cause found along the way.
335	
336	## Agentic journey mission card
337	
338	**Running app:** `http://localhost:3035` or the explicitly configured loopback URL.
339	
340	**User role:** A builder using OmniHarness to manage several Claude Code sessions in one disposable project.
341	
342	**Mission:** Add the marked temporary project, run Conversations A/B/C with Claude Code + GPT-5.6 SOL + Low effort, change A's instructions while it works, stop and resume B, complete C, repeatedly switch among them, reload and reconnect, and decide whether every status and transcript is trustworthy.
343	
344	**Allowed interface:** In-app browser or Playwright browser UI, keyboard, pointer, accessibility tree, and visible page state.
345	
346	**Forbidden shortcuts during the mission:** No API mutations, source inspection, direct database changes, direct worker calls, filesystem edits by the test driver, or implementation knowledge used to choose the next UI action.
347	
348	**Expected visible proof:** Each session remains present exactly once; active and terminal controls are honest; A accepts the changed instruction exactly once; B visibly stops and later shows resumed output; C stays complete; switching, reload, and reconnect do not lose or mix state.
349	
350	**Failure conditions:** A session disappears or flickers out of the list, selection changes unexpectedly, status surfaces disagree, Stop leaves working UI behind, resume returns no visible output, queue state survives acceptance, transcript content crosses sessions, output requires reload, a generic error hides the cause, or cleanup cannot prove ownership.
351	
352	**Approval:** The user explicitly requested this real, potentially long-running agentic journey in the current conversation. The runner still requires its local opt-in guard on every invocation.
353	

uuid: a37e7a6a-624b-4021-964f-fdd861764e14
parent: 64c13fab-6caa-4b4f-a7ef-27b19e5a0de9
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-13T18:09:36.013Z","phase":null} -->
## Claude · 2026-07-13T18:09:36.013Z

**Verdict: READY**

No remaining blockers.

uuid: ee69637b-1766-4501-8a5d-e1b33cdb3245
parent: a37e7a6a-624b-4021-964f-fdd861764e14

<!-- /codex-event -->

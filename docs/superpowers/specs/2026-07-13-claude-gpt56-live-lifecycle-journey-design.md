# Claude GPT-5.6 Live Lifecycle Journey Design

**Date:** 2026-07-13

**Status:** Ready for implementation planning

## Purpose

Prove that a real user can run Claude Code through OmniHarness with the routed
`gpt-5.6-sol` model at low effort, keep several conversations straight, change
instructions while a worker is busy, stop and resume work, switch and reload
without losing state, and see every completed worker response in the UI.

This is not a mock-model happy path. The current milestone uses the real local
OmniHarness app, the real CLIProxyAPI connection, the real Claude Code worker,
and a disposable project outside the OmniHarness repository. Deterministic
tests remain responsible for exact state-machine and race coverage; the live
journey proves that those pieces compose into a usable product.

## Product outcome

An OmniHarness developer can run one opt-in command or follow the same mission
in the in-app browser and obtain a trustworthy answer to all of these questions:

1. Can the user add a disposable project from the UI?
2. Can the user select Claude Code, `GPT-5.6 SOL`, and Low effort?
3. Does a new conversation appear once, remain selected, and show honest work
   state while the worker is active?
4. Can the user switch among three sessions without transcript, selection,
   project, model, draft, or status state leaking between them?
5. Can a busy worker receive changed instructions immediately, with the queued
   row and transcript reflecting exactly one accepted message?
6. Does Stop end the real worker turn and clear all working indicators?
7. Can a follow-up resume the stopped conversation and make the new output
   visible without a hard reload?
8. Do reload and SSE reconnect restore the same conversations, transcripts,
   statuses, and selection?
9. When the UI disagrees with the backend, can the test identify the first
   boundary where the state diverged?
10. Can all test conversations, workers, artifacts, and temporary files be
    removed without touching user projects or unrelated conversations?

## User and jobs

The primary user is the human builder operating OmniHarness locally.

The core job is to delegate work to a coding agent and trust that the UI still
represents the same live conversation after normal lifecycle operations.

Supporting jobs in this milestone are:

- configure the intended harness/model/effort before sending;
- understand whether each session is starting, working, queued, stopped,
  recoverable, awaiting input, completed, or failed;
- change direction without starting a second accidental turn;
- leave one conversation, work in another, and return without losing context;
- stop expensive or incorrect work and know that it really stopped;
- continue a stopped session without losing its transcript or worker identity;
- recover after refresh or event-stream interruption;
- inspect the event, database, and worker-stream evidence when the screen is
  wrong;
- clean up only the resources created by the journey.

## Scope

### Included

- An opt-in Playwright configuration for the already-running local app.
- A safe live-journey runner with explicit real-token and local-target guards.
- A temporary, dependency-free app project created under the operating
  system's temporary directory, with a `.gitignore` and an ownership marker.
- Browser-only mutations for project addition, conversation creation, model and
  effort selection, session switching, interrupt, stop, follow-up/resume, and
  reload.
- Read-only control-plane oracles using canonical snapshots, named event logs,
  conversation/worker entry routes, and SQLite only for post-action comparison
  and failure diagnosis.
- Three real Claude Code conversations using `cliproxyapi:gpt-5.6-sol` at Low
  effort.
- Deterministic manager, route, lifecycle, and race tests for every state bug
  found by the live run, written before the fix.
- Focused fixes for confirmed root causes.
- Failure artifacts: trace, screenshot, visible-state checkpoint, redacted
  event transcript, and owned-resource manifest under ignored test output.
- Targeted cleanup of only the journey's run IDs and temporary project.

### Not included in this milestone

- Exercising Codex, Gemini, OpenCode, native Claude models, or other gateway
  models. The harness is designed so those can be added as later conformance
  profiles, but they are not part of this checklist.
- A permanent sample app inside the OmniHarness repository.
- Running the real-token journey in ordinary CI or as part of `pnpm test`.
- Bypassing authentication in the normal local app.
- Editing shell profiles, Claude settings, or global CLI configuration.
- Deleting unrelated conversations or calling the bulk conversation-deletion
  script.
- Treating screenshots, logs, HTTP 200 responses, or a passing mock test as
  proof that the user journey works.

## Safety boundary

The live runner refuses to start unless all of these conditions hold:

- the target URL is loopback (`localhost`, `127.0.0.1`, or `::1`);
- the caller explicitly opts into a real-agent run;
- authentication is supplied at runtime or an already authenticated in-app
  browser is used;
- the gateway status is enabled, running, connected, and advertises or accepts
  `gpt-5.6-sol`;
- the chosen project path is under the operating system temporary directory;
- the project contains a journey ownership marker created by this run;
- the project path is not the OmniHarness repository and is not any registered
  user project;
- the journey manifest starts empty and records every run ID it creates.

Each new run ID is appended and flushed to the manifest immediately after the
UI exposes it and before the test performs another mutation. The manifest file
and its parent directory are synced so a process crash cannot leave a created
conversation outside the only authorized cleanup scope.

Real-agent cost and time are bounded independently of Playwright's outer test
timeout. Each worker turn may be active for at most eight minutes; two minutes
without either a visible transition or new durable owned-run evidence is a
stalled-turn failure. On either limit, the harness uses the visible Stop control,
records the failure, and enters targeted cleanup. If Stop does not produce a
terminal run and worker within sixty seconds, the browser phase ends and the
targeted cleanup command invokes the same production deletion handler for the
manifest-owned run; it never waits indefinitely or removes the temp directory
while the worker may still be active. One complete journey may run for at most
forty-five minutes, including recovery and cleanup. The prompts also
forbid package installation and limit work to the six named project files.

The worker prompt repeats the filesystem boundary and forbids package installs,
commits, branch operations, and edits outside the temporary project. Cleanup
uses the recorded run IDs and ownership marker; it never infers ownership from
a title prefix alone.

Secrets are never written to traces, manifests, source files, or command-line
arguments. A live-test password is read from a runtime environment variable or
entered into the in-app browser for the local instance only.

## Test project and missions

The project is created under a path such as:

```text
/tmp/omniharness-live-journey-<random>/
```

It begins with only:

```text
.gitignore
.omniharness-live-journey.json
```

The project is deliberately dependency-free so the journey does not depend on
network package installation and can be removed as one owned directory.

### Conversation A: build and interrupt

The first prompt asks the worker to create a small browser app called Research
Relay using `index.html`, `styles.css`, `app.js`, and `README.md`. It must support
adding research notes, tags, filtering, localStorage persistence, and a visible
checklist. The worker must inspect and validate its files before completing.

After the worker is visibly active and the first durable output or owned file
exists, the user changes direction through the busy composer:

```text
Change direction: use a warm amber theme, add Export JSON, and continue from
the work already completed. Do not restart or duplicate files.
```

The UI must show that the message is queued or being delivered, then the test
uses the visible interrupt/send-now action (or the documented Escape action)
to deliver it. The message must appear exactly once in the worker stream, and
the pending queue item must disappear once accepted into chat.

### Conversation B: stop and resume

The second prompt asks the worker to inspect the app, perform a careful
accessibility and usability audit, and write `AUDIT.md` with exactly five
prioritized findings. While this turn is visibly working, the user presses the
real Stop control.

The UI must become non-working, the run and worker must reach a truthful stopped
state, and named terminal evidence must exist. The user then sends:

```text
Resume this session. Finish AUDIT.md only, using the existing context and
files. Do not modify the app.
```

The session may reattach or recreate according to production policy, but that
decision must be named. The new answer and `AUDIT.md` must appear without a
manual reload.

### Conversation C: complete reference state

The third prompt asks the worker to inspect the project and write `STATUS.md`
with a concise file inventory and validation summary, without modifying the
app. It is allowed to complete normally. This gives the switching test a known
terminal conversation while A or B has other lifecycle states.

## Human-level journey

All mutations are performed through visible controls:

1. Unlock the local app if needed.
2. Add the temporary project with **Add project** and **Select Project Folder**.
3. Select **Direct control**, **Claude Code**, **GPT-5.6 SOL**, and **Low**.
4. Start Conversation A and capture its run ID from the selected URL or
   browser-visible conversation identity.
5. Confirm visible active state, switch away, and confirm A remains listed with
   the same status.
6. Create Conversation B, switch A -> B -> A -> B, and confirm neither
   conversation disappears, duplicates, or borrows the other's transcript.
7. Interrupt A with the changed instruction and verify queue-to-transcript
   movement.
8. Stop B, verify the working indicator and Stop control disappear, and then
   resume B with a follow-up.
9. Create and complete Conversation C.
10. Repeatedly switch A -> C -> B -> A while statuses change.
11. Reload the selected session, then simulate an SSE disconnect/reconnect in
    the headless profile and repeat the switch loop.
12. Verify final files and visible assistant answers.
13. Compare the visible state with the canonical server evidence.
14. Delete only A, B, and C through the production conversation delete flow,
    remove the project from OmniHarness if that action is available and safe,
    then remove the owned temporary directory.

The in-app agentic run follows the same mission card and does not use backend
state to decide where to click. The deterministic Playwright run may use the
server evidence as assertions after each visible action, but never as a
shortcut for a mutation.

## State authority and invariants

| State | Owner | Token/order | Completeness and UI rule |
| --- | --- | --- | --- |
| Selected project/run | URL + `HomeUiStateManager` | project path + run ID + selection request ID | Late create/load results cannot steal a newer selection. |
| Conversation catalog | server snapshot, mirrored by `EventStreamStateManager` | snapshot event ID and deterministic `(updatedAt, id)` order | Cache is preview only; partial run snapshots cannot erase known or optimistic runs. |
| Run lifecycle | server `runs` row and named events | run ID + event ID | UI cannot invent working/done by diffing transcripts. |
| Worker lifecycle | server worker row/runtime decision | worker ID + event ID | `cancelled`, terminal run state, or terminal event defeats stale current text. |
| Worker transcript | unified append-only worker JSONL | worker ID + monotonic seq | Fallback rows may pre-render but cannot duplicate or replace authoritative entries. |
| Busy message queue | server queued-message rows, optimistically mirrored by `BusyMessageQueueManager` | message ID + status transition | Accepted/delivered items leave the drawer; cancelled/failed items cannot resurrect from late responses. |
| SSE connection | `LiveEventConnectionManager` over server event ring | `Last-Event-ID` | Reconnect replays the gap or requires a complete resync; an open socket alone is not authority. |
| Gateway readiness | server gateway singleton/snapshot | gateway revision | Cached model choices do not imply readiness; routed spawn must refuse rather than fall back. |
| Journey ownership | live-test manifest | journey ID | Cleanup touches only recorded runs and the marked temp directory. |

For every async result, the implementation asks: what can arrive late, out of
order, partially, twice, or after the user selected a different session? Tests
must prove that such a result cannot mutate the newly selected context.

## Status contract

The UI must distinguish these user-relevant states:

- **Starting/working:** a real turn is active; a visible pending assistant state
  and Stop control identify the concrete worker.
- **Queued:** a follow-up is accepted for later delivery and remains actionable.
- **Interrupting/delivering:** the queued item has left the ordinary queue and
  cannot appear twice.
- **Awaiting user:** the worker asked for input and no fake working spinner is
  shown.
- **Stopped/cancelled:** the worker is no longer doing work; stale worker text
  cannot keep the conversation active.
- **Recoverable:** the previous turn stopped or failed in a way that supports a
  visible resume action or follow-up.
- **Completed:** final output is durable and visible; no Stop control or
  trailing Thinking indicator remains.
- **Failed:** the real cause is visible and a stable `error.surfaced` event is
  inspectable.

Sidebar, header, transcript, and control states must agree. Any disagreement is
a test failure even if one surface is eventually corrected by reload.

## Observability contract

The live journey records a redacted checkpoint after every important action:

- timestamp and journey step;
- selected URL, project, and run ID;
- visible conversation titles and status indicators;
- visible transcript entry IDs or stable text hashes;
- canonical snapshot anchor ID;
- relevant named events since the prior anchor;
- run, worker, and queued-message state;
- latest worker-stream sequence for each owned worker.

Expected production evidence includes the existing typed events such as
`worker.spawned`, `worker.status`, `worker.terminal`, `worker.reattached`,
`worker.recreated`, `worker.entry_appended`, queue interruption decisions,
recovery events, `conversation.deleted`, `stream.resync_required`, and
`error.surfaced` when applicable.

If the event is absent, the server did not publish the decision and the failure
is not classified as a frontend-only bug. If the event and persisted state are
correct but the screen is wrong, the test captures the responsible client
manager snapshot and stale owner token before any fix is attempted.

## Failure artifact and privacy rules

On failure, the harness retains only ignored artifacts under `test-results/`:

- Playwright trace and screenshot;
- a bounded DOM snapshot around the affected surface;
- a redacted event transcript for owned run IDs;
- the journey manifest and checkpoint report;
- bounded tails of owned worker JSONL files.

The report excludes passwords, gateway tokens, OAuth URLs, credential files,
unrelated run titles/content, and full database dumps. Passing runs may retain a
short summary but not secrets or user conversation content.

## Deterministic regression strategy

The live journey is a finder and final proof, not the only regression test.
Each observed failure is reduced before production code changes:

- stale selection, catalog disappearance, snapshot merge, and status classifier
  bugs become focused Manager tests;
- transcript duplication or missing output becomes worker-entry/transcript
  manager and unified-stream tests;
- interrupt, stop, resume, finalization, or reattach bugs become headless
  lifecycle HTTP/SSE scenarios with exact named-event transcripts;
- route contract failures become runtime route tests;
- only visible layout, affordance, focus, and cross-session composition remain
  in Playwright.

Every fix follows red -> green -> full focused verification. A screenshot or a
single successful manual retry is never the regression test.

## Pass criteria

The current milestone passes only when all of the following are true in a
fresh real journey:

- all three conversations are created through the UI with Claude Code,
  `GPT-5.6 SOL`, and Low effort;
- the gateway route is used and no native-model fallback occurs;
- each conversation appears once and remains stable through switching;
- active, queued, stopped, recoverable, and completed states are visibly honest;
- the interrupt instruction is delivered once and reflected in A's final app;
- Stop ends B's actual turn and clears active UI promptly;
- B resumes and its new worker output appears without reload;
- C completes and remains terminal through all switches;
- transcript content never crosses run boundaries;
- reload and SSE reconnect preserve selection, transcripts, and status;
- canonical snapshots, named events, SQLite rows, and worker streams agree with
  the final visible state;
- every bug found has a deterministic failing regression and a verified fix;
- focused tests, the lifecycle suite, typecheck, build, live Playwright run, and
  the in-app agentic mission all pass with fresh evidence;
- only journey-owned test data is removed at the end.

## North star and later profiles

The north star is a provider-agnostic conformance suite in which every supported
OmniHarness worker type and model route must pass the same lifecycle contract:
create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload,
and clean up.

After this milestone is proven with Claude Code + `gpt-5.6-sol`, later profiles
can supply different harness/model selectors and safe missions while reusing
the same state and observability assertions. Those profiles are product
direction, not part of this implementation checklist.

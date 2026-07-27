# Complete Claude Code and ACP 0.25 Client Design

**Date:** 2026-07-11
**Status:** Approved for implementation

## Goal

Make OmniHarness a complete, truthful ACP client. Claude Code must never block on an interaction the conversation cannot display, and no ACP 0.25 request, notification, session update, capability, or content type may be silently dropped.

## Incident

Session `0abd06014635` emitted a valid Claude Code `AskUserQuestion` tool call followed by an ACP form elicitation containing selectable answers. The runtime persisted both records, but the main conversation renderer ignored `elicitation` entries. The only actionable form lived in the optional worker sidebar. The conversation therefore appeared stuck while the agent correctly waited for input.

The audit found a protocol-version mismatch behind this partial implementation: OmniHarness is compiled against `@agentclientprotocol/sdk@0.14.1`, while the installed Claude adapter uses ACP SDK `0.25.0`. Elicitation was manually routed through `extMethod`, and several newer session updates and capabilities were never modeled.

## Users and Jobs

The primary user is a human supervising coding agents from the main conversation.

- When an agent asks a question, the user answers at the exact point where execution paused.
- When an agent requests permission or a mode change, the user sees the operation, every offered decision, and its consequences.
- When an agent emits plans, tasks, terminal sessions, diffs, commands, media, resources, or session changes, the user can inspect the real state without opening a debugging panel.
- After reload, reconnect, server restart, or worker recovery, pending actions remain actionable exactly once.
- Operators and tests can inspect every protocol decision through named events and persisted streams.

## Product Principles

1. **The conversation is the primary control surface.** Worker sidebars may mirror actions, but they may not be the only place to continue a blocked turn.
2. **Advertised means operational.** OmniHarness advertises a capability only when its request handling, persistence, user/API surface, error behavior, and tests are complete.
3. **Unknown means visible failure.** Unknown standard ACP methods or session updates emit typed compatibility errors; they are never ignored.
4. **One persisted worker stream.** Protocol output and human-input state remain in the existing append-only worker JSONL. No parallel transcript store is introduced.
5. **Stable identity and exactly-once decisions.** Requests use stable session/request/tool-call identifiers. Replays and duplicate responses cannot answer a different or already-settled request.
6. **Protocol data is stored, UI copy is translated at render time.** No translated strings are persisted.

## Protocol Baseline

OmniHarness will compile against `@agentclientprotocol/sdk@0.25.0`, matching the Claude adapter. The dependency is pinned to an exact compatible version and covered by a schema contract test.

The compatibility gate reads the installed SDK schema and asserts that every standard ACP 0.25 method, notification, session-update discriminator, content type, and advertised capability is classified as one of:

- fully handled and advertised;
- fully handled but intentionally not advertised for a specific surface;
- explicitly rejected with a typed `error.surfaced` compatibility event.

The test fails when a future SDK adds an unclassified protocol member.

## Phase 1: Claude Code Complete Surface

### Inline human input

Add `elicitation` as a first-class `AgentActivityItem`. Pending form elicitations render inline in `Terminal` between the initiating tool call and later activity. The form supports ACP 0.25 property schemas:

- strings and free text;
- titled `enum`, `oneOf`, and multi-select options;
- booleans;
- integers and numbers with min/max constraints;
- required and optional fields;
- field titles and descriptions;
- custom-answer fields;
- accept, decline, and cancel outcomes.

Single-choice questions render as immediately scannable choices rather than a closed native select. Multi-select questions render as checkboxes. Free text uses the existing shadcn textarea/input controls. The pending form is expanded by default and remains visible after reload.

Permission requests become first-class inline actions as well. Every adapter-provided `PermissionOption` is rendered verbatim by stable `optionId`; OmniHarness does not collapse `allow_once`, `allow_always`, `reject_once`, or plan-mode choices into generic Yes/No controls. The action includes the tool title, kind, affected file/command where available, and any diff or plan content.

The sidebar reuses the same field parser, decision model, validation, and translated controls. It is a mirror, not a separate implementation.

### Ownership and state

- Server authority: pending permission and elicitation records on the live runtime plus pending entries reconstructed from the unified worker stream.
- Stable token: `workerId + requestId + toolCallId`.
- Ordering: worker stream `seq`.
- Terminal states: answered/approved/denied/declined/cancelled/failed.
- Draft owner: a dedicated global interaction manager keyed by the stable request token; only the small inline form subscribes to its draft slice.
- Mutation ownership: a response may settle only the exact still-pending request token. Late success/error callbacks cannot modify another run or request.
- Persistence: pending protocol records and terminal outcome records remain in the worker stream. Draft form values use request-token-keyed `sessionStorage`, survive reload/navigation in the same tab, and clear on settlement, cancellation, sign-out, or expiry. They are never sent to snapshots before submission.
- Settlement order: validate ownership, append the terminal outcome to the unified worker stream, update the runtime pending-request projection, then resolve the waiting ACP request. A crash before resolution replays the persisted terminal outcome and never presents the same request as unanswered.

### Claude output completeness

Handle and expose every feature claimed by the installed Claude adapter:

- text and image prompts;
- generic tool calls and results;
- permissions and `ExitPlanMode` decisions;
- `AskUserQuestion` and MCP form elicitation;
- edit/write diffs;
- TODO and Task plan updates;
- Bash interactive/background terminal output and cancellation;
- available slash commands;
- mode and configuration changes;
- session metadata and usage;
- client MCP servers;
- load, resume, fork, close, and delete session operations supported by the adapter.

The executable Claude coverage matrix names the adapter's concrete built-in projections: Agent/Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, TodoWrite, TaskCreate, TaskUpdate, TaskList, TaskGet, ExitPlanMode, AskUserQuestion, and generic/unknown tools. Adapter additions fail the compatibility test until classified.

## Phase 2: Full ACP 0.25 Client

### Agent-to-client requests

Implement every standard request in the ACP 0.25 `AgentRequest` union:

- `fs/read_text_file` and `fs/write_text_file` with workspace-bound path validation and named failure events;
- `session/request_permission`;
- `terminal/create`, `terminal/output`, `terminal/wait_for_exit`, `terminal/kill`, and `terminal/release` using a server-owned terminal manager with bounded output, cancellation, cleanup, and persisted tool metadata;
- `elicitation/create` for form and URL modes, including URL completion notifications;
- `mcp/connect`, `mcp/message`, and `mcp/disconnect` using connection-scoped ownership and cleanup;
- extension requests through an explicit registry. Unknown extensions return method-not-found and emit `acp.compatibility_unsupported`.

Connection initialization and capability exchange are explicitly tested before any session/provider/NES operation. JSON-RPC cancellation of pending agent/client requests is accepted throughout initialization, prompting, permissions, elicitations, terminals, MCP, and shutdown.

### Agent-to-client notifications

Handle all ACP 0.25 notifications:

- `session/update`;
- `elicitation/complete`;
- MCP messages;
- registered extension notifications.

`elicitation/complete` remains agent-to-client as defined by the installed ACP 0.25 schema: it informs OmniHarness that a URL-mode elicitation completed externally.

### Session updates

Persist or project every `SessionUpdate` variant:

- user, agent, and thought content chunks;
- tool calls and updates;
- plan, plan update, and plan removed;
- available commands;
- current mode;
- configuration options;
- session information;
- usage and cost.

Unknown discriminators emit a compatibility failure and mark the runtime snapshot degraded instead of disappearing.

### Content and tool-call content

Support every ACP content block and tool-call content variant: text, image, audio, embedded text/blob resources, resource links, diffs, terminals, and nested content. Binary payloads are bounded and represented by durable metadata or existing attachment storage, never expanded into unbounded SSE snapshots.

### Client capabilities

Implement and truthfully negotiate all ACP 0.25 `ClientCapabilities`:

- auth environment-variable and terminal flows;
- form and URL elicitation;
- filesystem read/write;
- next-edit document/context capabilities;
- structured plan updates;
- position encodings;
- terminal operations.

### Agent capabilities and client-originated methods

Expose all ACP 0.25 agent capabilities through typed runtime methods and appropriate product surfaces or scriptable APIs:

- authentication, provider listing/selection/disable/logout;
- session new/load/list/resume/fork/close/delete;
- modes and configuration options;
- prompt and cancel;
- next-edit start/suggest/close plus document/open/focus/change/save notifications;
- MCP-over-ACP messaging;
- extension registry.

Provider, session, and next-edit operations use Manager-owned client state, stable operation tokens, named events, and full backend error details.

## UI Surfaces

### Conversation timeline

Pending human input is placed inline and expanded. It uses the current restrained visual system, clear warning/attention semantics, keyboard-focus rings, and `aria-live` status updates. Settled interactions collapse to compact historical rows that state the outcome without exposing secret values.

### Composer

Available ACP slash commands feed a command menu owned by a dedicated manager. Commands remain scoped to the selected live session and cannot leak across navigation.

### Plans and tasks

ACP plans/tasks render in the conversation as structured progress, distinct from Omni supervisor planning artifacts. Updates merge by stable plan/task ID and sequence; removals are explicit.

### Terminal output

Bash tool rows embed bounded live terminal output and expose stop/cancel only while the corresponding process is active. Terminal resource cleanup is server-owned and observable.

### Provider, session, and next-edit surfaces

Provider/session operations reuse existing settings and conversation controls where they naturally belong. Next-edit suggestions integrate with project-file viewing rather than creating a fake editor. Scriptable HTTP endpoints remain available for capabilities without a permanently visible control.

## Observability

Add named events for:

- `acp.request_received`, `acp.request_completed`, `acp.request_failed`;
- `acp.compatibility_unsupported`;
- `worker.elicitation_requested`, `worker.elicitation_answered`, `worker.elicitation_declined`, `worker.elicitation_cancelled`;
- `worker.permission_requested` and terminal permission outcomes;
- terminal created/exited/killed/released;
- MCP connected/disconnected/failed;
- plan updated/removed;
- provider/session/NES operations and failures.

User-relevant failures also emit `error.surfaced` with stable codes and run/worker/session ownership.

## Error and Security Requirements

- Filesystem operations are restricted to the agent session workspace and explicitly attached additional directories.
- URL elicitation uses an allowlisted browser/open-URL flow and never auto-completes from an untrusted page.
- Terminal commands inherit the worker environment but never expose secret environment values in output metadata.
- Terminal services retain at most 1,000 recent lines in memory and append at most 50 KiB of output per tool/turn to the unified stream, with explicit truncation metadata.
- MCP connections are bounded per server-side ACP agent session, use connect/message/health timeouts, and close on agent-session cancellation, agent exit, or server shutdown. Browser/SSE disconnects do not own them.
- Provider authentication values are never persisted in worker output or frontend state.
- Unknown protocol input is preserved in diagnostic previews with size limits, while full secret-bearing payloads are not logged.

## Testing

### Deterministic tests

- Schema compatibility test for every ACP 0.25 union member.
- Runtime request/notification tests for every agent-to-client method.
- Session-update round-trip tests for every discriminator and content type.
- Worker-stream reconstruction tests for pending and settled interactions.
- React activity/model tests for elicitation, permissions, plans, commands, terminals, and media.
- Mutation ownership tests for navigation, replay, duplicate response, and stale callbacks.
- Locale parity tests.
- Hot-path tests proving pending forms and terminal updates do not trigger whole-app per-keystroke rendering or unbounded snapshots.

### Lifecycle scenarios

- Claude asks a multi-choice question; the main conversation displays it; the selected answer reaches Claude; Claude continues.
- Reload while a question or permission is pending; the same request reappears exactly once and remains actionable.
- Exit-plan-mode options preserve their exact IDs and selected mode.
- Disconnect/reconnect replays plan, terminal, permission, and elicitation events without duplication.
- Server restart cleans up or reattaches terminal and MCP resources with named decisions.
- Unknown future method/update produces an explicit compatibility failure.

### Product verification

Use the already-running application for browser verification. Verify desktop and narrow/mobile layouts, keyboard-only completion, focus retention, visible loading/error/settled states, and that typing in a pending answer does not repaint the conversation shell. Approval-gated agentic journey testing may be proposed separately; deterministic browser and lifecycle coverage is required regardless.

## Acceptance Criteria

1. The exact question from session `0abd06014635` renders inline with its four choices and custom-answer field when replayed as a fixture.
2. A user can answer every Claude Code permission and elicitation without opening the worker sidebar.
3. Every feature claimed by the installed Claude adapter is handled end to end.
4. Every ACP 0.25 standard method, notification, session update, content variant, and capability is classified by an executable compatibility test.
5. OmniHarness never advertises an incomplete capability.
6. Reload, reconnect, recovery, duplication, and stale-response tests pass.
7. All user-facing copy is translated through every locale resource.
8. Typecheck, lint, focused tests, lifecycle tests, build, and live product verification pass.

Acceptance criterion 3 is enforced against the explicit Claude tool/feature matrix above and the adapter's advertised session capabilities, not by prose inspection.

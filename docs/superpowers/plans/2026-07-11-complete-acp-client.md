# Complete Claude Code and ACP 0.25 Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OmniHarness a complete ACP 0.25 client, delivering the entire Claude Code product surface first and then every remaining standard and experimental ACP 0.25 capability.

**Architecture:** Upgrade the protocol SDK and replace the monolithic runtime client with capability-specific services behind a strict compatibility registry. Keep the unified worker JSONL as the only transcript authority, then project protocol records into focused Manager-owned React surfaces. Every advertised capability must be backed by real request handling, persistence or bounded resource ownership, named events, and deterministic tests.

**Tech Stack:** Next.js 15, React 19, TypeScript, `@agentclientprotocol/sdk@0.25.0`, SQLite/Drizzle, append-only worker streams, shadcn/ui primitives, Vitest, lifecycle HTTP/SSE scenarios.

**North Star Product:** OmniHarness is a trustworthy universal client for coding agents: any conforming ACP agent can expose its complete interactive and operational surface without silent capability loss.

**Current Milestone:** Complete Claude Code support, followed in the same implementation by the full ACP 0.25 protocol surface.

**Final Functionality Standard:** The exact incident fixture renders and answers inline; every ACP 0.25 union member is classified and exercised; no incomplete capability is advertised; reload, reconnect, recovery, and stale-response behavior are verified end to end.

---

## File Map

### New protocol modules

- `src/server/agent-runtime/acp/runtime-client.ts`: ACP client implementation and delegation only; replaces `RuntimeClient` inside the oversized manager.
- `src/server/agent-runtime/acp/capability-registry.ts`: single source of truth for supported methods, notifications, session updates, content variants, and advertised capabilities.
- `src/server/agent-runtime/acp/session-updates.ts`: normalize and persist every ACP session update.
- `src/server/agent-runtime/acp/content.ts`: bounded conversion of ACP text/image/audio/resource/diff/terminal content.
- `src/server/agent-runtime/acp/terminal-service.ts`: terminal request ownership, output bounds, wait/kill/release, cleanup.
- `src/server/agent-runtime/acp/mcp-service.ts`: MCP-over-ACP connection ownership, message routing, disconnect cleanup.
- `src/server/agent-runtime/acp/elicitation-service.ts`: form and URL elicitation lifecycle.
- `src/server/agent-runtime/acp/compatibility.ts`: explicit unsupported-method/update handling and diagnostic events.
- `src/server/agent-runtime/acp/types.ts`: runtime-owned protocol projections without manual stale SDK shims.
- `src/server/agent-runtime/routes/*.ts`: focused HTTP controllers for interactions, providers, sessions, NES, terminal, and MCP operations; `http.ts` remains a small dispatcher.
- `scripts/check-acp-compatibility.ts`: scriptable schema coverage check.

### New frontend/domain modules

- `src/lib/acp/elicitation-schema.ts`: parse every ACP 0.25 form property into a stable render model and validate typed responses.
- `src/lib/acp/protocol-activity.ts`: activity types and projection for elicitations, permissions, plans, commands, modes, terminals, and media.
- `src/app/home/AgentInteractionManager.ts`: global request-token-owned drafts, submission states, and narrow subscriptions.
- `src/app/home/AcpSessionManager.ts`: selected-session commands, modes, config, provider/session/NES operation ownership.
- `src/components/agent-interactions/InlineElicitation.tsx`: accessible inline form using shadcn Field/RadioGroup/Checkbox/Input/Textarea/Switch controls.
- `src/components/agent-interactions/InlinePermission.tsx`: exact ACP permission options, tool details, plan-mode choices, loading/error/settled states.
- `src/components/agent-interactions/InteractionHistoryRow.tsx`: compact settled outcome.
- `src/components/agent-interactions/AgentPlanActivity.tsx`: ACP plan/task projection and updates.
- `src/components/agent-interactions/AgentCommandMenu.tsx`: session-scoped slash commands.
- `src/components/agent-interactions/AgentTerminalActivity.tsx`: bounded live/background terminal output and cancellation.
- `src/components/agent-interactions/AgentMediaContent.tsx`: image/audio/resource/link content.
- `src/components/acp/AcpProviderControls.tsx`: provider list/select/disable/logout.
- `src/components/acp/AcpSessionControls.tsx`: list/load/resume/fork/close/delete.
- `src/components/acp/NextEditSuggestionPanel.tsx`: project-file-backed NES suggestions and actions.

### Existing files to modify carefully

- `package.json`, `pnpm-lock.yaml`: exact SDK upgrade and compatibility script.
- `src/server/agent-runtime/manager.ts`: delegate protocol work; keep agent/process orchestration. Do not add new protocol branches to this 2,400-line file.
- `src/server/agent-runtime/types.ts`: move stale elicitation shims to ACP 0.25 native types and extend persisted record projections.
- `src/server/agent-runtime/http.ts`: typed provider/session/NES and interaction endpoints.
- `src/server/bridge-client/index.ts`: typed bridge methods for the full protocol surface.
- `src/server/events/named-events.ts`: ACP decision and failure event unions.
- `src/server/workers/entries-types.ts`, `src/server/workers/output-store.ts`: protocol entry types and stable request identity in the unified stream.
- `src/lib/agent-output.ts`: delegate new protocol activity projection; do not grow this 1,300-line file.
- `src/components/Terminal.tsx`: delegate interaction/plan/terminal/media rendering; do not grow this 2,400-line file.
- `src/components/WorkerCard.tsx`: replace duplicated interaction forms with shared inline components.
- `src/components/home/ConversationMain.tsx`: pass selected worker identity and interaction mutations into Terminal.
- `src/app/home/HomeApp.tsx`, `src/app/home/useHomeMutations.ts`: provide token-owned mutations and ACP session operations.
- composer modules identified during implementation: integrate `AgentCommandMenu` without broad draft subscriptions.
- `shared/locales/*.json`: all new visible copy in every locale.
- `docs/architecture/lifecycle-observability-and-testing.md`: protocol compatibility and resource-lifecycle invariants.

### Tests to create or extend

- `tests/server/acp/schema-compatibility.test.ts`
- `tests/server/acp/runtime-client.test.ts`
- `tests/server/acp/session-updates.test.ts`
- `tests/server/acp/content-roundtrip.test.ts`
- `tests/server/acp/terminal-service.test.ts`
- `tests/server/acp/mcp-service.test.ts`
- `tests/server/acp/elicitation-service.test.ts`
- `tests/app/acp/elicitation-schema.test.ts`
- `tests/app/acp/protocol-activity.test.ts`
- `tests/app/acp/interaction-manager.test.ts`
- `tests/ui/inline-agent-interactions.test.tsx` or the repository's established source/render test equivalent.
- `tests/api/acp-routes.test.ts`
- `tests/lifecycle/scenarios/claude-inline-question.test.ts`
- `tests/lifecycle/scenarios/acp-interaction-reconnect.test.ts`
- `tests/lifecycle/scenarios/acp-resource-cleanup.test.ts`
- extend locale parity, terminal, conversation, worker-stream, and mutation ownership suites.

### Product verification

- Candidate approval-gated agentic journey: ask a real Claude worker to issue multi-select, free-text, permission, and plan-mode interactions and complete them from the conversation. The user has not explicitly approved agentic journey testing, so deterministic browser/lifecycle checks are required and the higher-cost journey remains approval-gated.
- Use the already-running app at `http://localhost:3035`.

### Repository hygiene

- Work directly in the current repository; do not create a branch or worktree.
- Preserve all unrelated dirty-worktree changes.
- `.gitignore` already exists; verify protocol fixtures contain no credentials, runtime logs, or user payloads before completion.

## Client/Server State Invariants

- Server owns pending request truth; worker stream is the durable replay source.
- Request token is `runId + workerId + sessionId + requestId + toolCallId` where fields exist.
- Stream `seq` orders request/outcome records; timestamp is display metadata only.
- Partial snapshots may add/refine pending interactions but cannot erase a stream-known request without a terminal outcome.
- Response callbacks recheck selected run and request token immediately before optimistic mutation and again on completion.
- Duplicate/replayed response is idempotent and cannot settle a newer request.
- Terminal and MCP resources are owned by the server-side ACP agent session, bounded, and cleaned on agent-session cancellation, agent exit, and shutdown. Browser/SSE disconnects do not own them.
- Unknown protocol members emit named compatibility failures and cannot mutate visible state silently.
- Draft fields subscribe narrowly; typing cannot repaint the conversation root or trigger persistence/SSE activity.
- Drafts persist only in request-token-keyed `sessionStorage` and clear on settlement/cancellation/expiry.
- Interaction settlement appends a terminal stream outcome before resolving the pending ACP request; replay reconciles an unresolved runtime promise from that durable outcome.

## Task 1: Upgrade the protocol and establish the compatibility gate

- [ ] Add failing tests that enumerate ACP 0.25 `AgentRequest`, `AgentNotification`, `SessionUpdate`, content, and capability unions and compare them with the capability registry.
- [ ] Extract the existing `RuntimeClient` and its current content/update handling behind behavior-preserving tests before changing SDK versions.
- [ ] Pin `@agentclientprotocol/sdk` to `0.25.0`, update the lockfile, and resolve API/type changes without behavior fallbacks.
- [ ] Implement `capability-registry.ts`, `compatibility.ts`, and `scripts/check-acp-compatibility.ts`.
- [ ] Cover initialize/capability exchange and JSON-RPC request cancellation explicitly.
- [ ] Advertise only the capabilities already operational at this checkpoint; every other registry member is explicitly handled-but-disabled until its task lands.
- [ ] Verify schema tests, existing runtime tests, typecheck, and the live Claude adapter startup.

## Task 2: Extract and complete session-update/content handling

- [ ] Add failing round-trip tests for every session update and every content/tool-call-content variant.
- [ ] Extract `RuntimeClient` from `manager.ts` and move update handling to `session-updates.ts` and `content.ts`.
- [ ] Persist user/agent/thought chunks, tool calls, plans/updates/removals, commands, modes, config, session info, usage/cost, media, resources, diffs, and terminal metadata through the unified stream or bounded runtime projection.
- [ ] Emit typed compatibility errors for unknown discriminators.
- [ ] Verify no session update is silently ignored and current direct conversations still render identically for existing entries.

## Task 3: Ship Claude inline questions and permissions

- [ ] Add the exact `0abd06014635` four-choice/custom-answer schema as a sanitized regression fixture and watch the main-conversation render test fail.
- [ ] Implement the complete ACP form parser/validator and Manager-owned request drafts.
- [ ] Implement the native ACP 0.25 form/URL elicitation service and crash-safe stream-before-resolve settlement; remove the stale manual type shim while retaining compatibility with the installed adapter.
- [ ] Add elicitation and actionable permission activity types to the terminal projection.
- [ ] Build shared inline interaction components using shadcn Field plus choice-card RadioGroup, Checkbox, Input, Textarea, and Switch patterns; reuse them in WorkerCard.
- [ ] Pass worker/request mutations into the main conversation Terminal.
- [ ] Preserve exact permission option IDs, including ExitPlanMode modes.
- [ ] Add pending/loading/error/settled, keyboard, narrow-layout, replay, duplicate, and stale-owner tests.
- [ ] Restore pending drafts from request-token-keyed `sessionStorage` without persisting submitted or expired values.
- [ ] Add all copy to every locale and run parity tests.

## Task 4: Complete Claude plans, commands, terminals, and media

- [ ] Add failing tests showing Claude TODO/Task plan updates, slash commands, terminal metadata, and media/resource content are currently absent.
- [ ] Render ACP plans/tasks with stable IDs and update/removal behavior.
- [ ] Feed available commands into a selected-session command menu without coupling composer drafts to broad snapshots.
- [ ] Advertise Claude terminal-output metadata support and render/cancel interactive and background Bash output.
- [ ] Bound terminal memory to 1,000 recent lines and persisted output to 50 KiB per tool/turn with visible truncation metadata.
- [ ] Render images, audio, resources, links, diffs, and generic unknown tool payloads safely and accessibly.
- [ ] Verify every feature claimed by the installed Claude adapter README end to end.

## Task 5: Implement all ACP agent-to-client services

- [ ] Add failing request tests for filesystem, terminal, remaining URL completion behavior, MCP-over-ACP, and extension registry methods.
- [ ] Implement workspace-bound filesystem services with additional-directory ownership.
- [ ] Implement terminal create/output/wait/kill/release with bounded output and cleanup.
- [ ] Implement MCP connect/message/disconnect ownership and cleanup.
- [ ] Add connect/message/health timeouts and reap hung MCP resources without coupling cleanup to browser/SSE state.
- [ ] Implement explicit extension registration and typed method-not-found failures.
- [ ] Enable each client capability only after its service tests pass.

## Task 6: Implement all ACP client-to-agent capabilities

- [ ] Add failing typed transport/API tests for auth, providers, sessions, modes/config, prompts/cancel, NES, MCP messages, and extensions.
- [ ] Implement provider list/select/disable/logout and auth method handling without persisting secrets.
- [ ] Implement session list/load/resume/fork/close/delete with ownership and navigation guards.
- [ ] Implement next-edit start/suggest/close and document open/focus/change/save notifications backed by project-file state.
- [ ] Implement MCP message and extension client calls.
- [ ] Add focused provider/session/NES product controls and scriptable endpoints through `src/server/agent-runtime/routes/*.ts`; avoid permanent UI chrome for operations that are naturally command/API driven.
- [ ] Verify late responses cannot steal navigation or mutate a different project/session.

## Task 7: Observability, lifecycle hardening, and final verification

- [ ] Add all named ACP request, decision, resource, interaction, provider/session/NES, compatibility, and failure events plus stable `error.surfaced` codes.
- [ ] Add lifecycle scenarios for inline Claude question, permission/plan-mode, reconnect/replay, server restart, terminal/MCP cleanup, and unknown future protocol input.
- [ ] Update architecture documentation and create the required learning note for the hidden-interaction incident.
- [ ] Run focused tests after each task, then full typecheck, lint, test suite, `pnpm test:lifecycle`, build, compatibility script, and `git diff --check`.
- [ ] Verify the real running app on desktop and narrow layouts: visible inline actions, keyboard completion, focus retention, settled history, terminal cancellation, command menu, and no per-keystroke whole-app rerender.
- [ ] Confirm no test conversations/artifacts remain and no secrets/generated runtime data are included.

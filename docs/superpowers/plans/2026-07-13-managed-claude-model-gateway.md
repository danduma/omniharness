# Managed Claude Model Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. Mark each checkbox only after its stated evidence passes.

**Goal:** Add a safe, managed CLIProxyAPI integration that lets users connect and run `gpt-5.6-sol` or other gateway models through Claude Code directly from OmniHarness, including settings UI and end-to-end verification.

**Architecture:** A Next-server singleton owns installation, process lifecycle, OAuth, discovery, and complete status snapshots on the existing SSE control plane. Although base environments are currently read at many callers, the common `spawnAgent()`/`prewarmWorker()` transport functions will invoke one routed-Claude preparation helper and every caller will be audited. SQLite remains configuration authority; the existing agents catalog and Claude model picker remain the selection surface.

**Tech stack:** Next.js 15, React 19, TypeScript, SQLite/Drizzle, runtime HTTP registry, shadcn/ui, Vitest, lifecycle HTTP/SSE tests, CLIProxyAPI's official release and management/data APIs.

**Design specification:** `docs/superpowers/specs/2026-07-13-managed-claude-model-gateway-design.md`

**User-visible result:** Settings can install/start or connect an existing gateway, complete provider sign-in, manage/discover models, and show those models under Claude Code. Selecting `GPT-5.6 SOL` routes every Claude lifecycle path with the requested effort, concurrency, subagent, and tool-search settings.

---

## Repository rules for execution

- [ ] Work directly in the current checkout; do not create a branch or worktree.
- [ ] Preserve every unrelated dirty-worktree change.
- [ ] Do not delete files, managed installs, auth data, or test data unrelated to this feature.
- [ ] Use `apply_patch` for source edits.
- [ ] Reuse an already-running app at `http://localhost:3035` or `http://localhost:3050` for browser verification.
- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md` before implementing server transitions.
- [ ] Keep worker conversation content in the existing unified worker stream; this feature adds no transcript persistence.

## File map

### New shared contracts

- `src/lib/claude-model-gateway.ts`: setting keys, encoded model identity, redacted status/action schemas, model validation, and pure merge helpers.
- `tests/lib/claude-model-gateway.test.ts`: route encoding, validation, schema, and merge tests.

### New server integration modules

- `src/server/integrations/claude-model-gateway/installer.ts`: system-binary detection, official release selection/download/checksum/extraction, ownership markers, and idempotency.
- `src/server/integrations/claude-model-gateway/managed-files.ts`: scoped paths, permissions, atomic metadata/config writes, and archive-path safety.
- `src/server/integrations/claude-model-gateway/client.ts`: bounded health, models, OAuth URL, and auth-status requests with redaction.
- `src/server/integrations/claude-model-gateway/settings.ts`: encrypted setting reads/writes, provisional configuration, and discovery cache.
- `src/server/integrations/claude-model-gateway/process-manager.ts`: gateway policy over shared process-ownership primitives; direct no-shell launch, readiness, adoption, log bounds, and shutdown.
- `src/server/process-ownership.ts`: portable PID metadata, liveness, start-time/command identity inspection, and injected adapters extracted from existing restart/bridge-lock behavior.
- `src/server/integrations/claude-model-gateway/worker-env.ts`: one pure/native-safe routed Claude environment builder.
- `src/server/integrations/claude-model-gateway/index.ts`: singleton state machine, operation deduplication, revisions, events, and startup orchestration.
- `tests/server/integrations/claude-model-gateway/*.test.ts`: focused unit/integration coverage.

### New API and frontend modules

- `src/runtime/http/routes/claude-model-gateway.ts`: authenticated GET status and same-origin POST actions.
- `src/app/api/integrations/claude-model-gateway/route.ts`: Next adapter.
- `src/app/home/ClaudeModelGatewayManager.ts`: global frontend status/draft/operation owner with stale-response rejection.
- `src/components/settings/ClaudeModelGatewaySettings.tsx`: managed/external setup, connection, status, and model UI.
- `tests/runtime/claude-model-gateway-route.test.ts`: API contract and error coverage.
- `tests/app/claude-model-gateway-manager.test.ts`: client ordering, SSE updates, and bootstrap behavior.
- `tests/ui/claude-model-gateway-settings.test.tsx`: accessible state rendering and settings semantics.

### New verification assets

- `tests/fixtures/claude-model-gateway/fixture-server.ts`: local Anthropic/management-compatible fixture used only by tests.
- `tests/lifecycle/scenarios/claude-model-gateway-routing.test.ts`: headless lifecycle route/restart/failure scenario.
- `scripts/smoke-claude-model-gateway.ts`: real official-release checksum/start/readiness/stop smoke command using temporary paths.

### Existing files to modify carefully

- `src/server/events/named-events.ts`: typed gateway decision events and stable surfaced error codes.
- `src/runtime/http/routes/events.ts` and `src/server/events/persisted-snapshot.ts`: include the same redacted gateway summary in canonical live and persisted bootstrap snapshots.
- `src/runtime/http/routes/index.ts`: register the portable route.
- `src/instrumentation.ts`: schedule enabled managed-service adoption/start after database readiness.
- `src/server/bridge-client/index.ts`: delegate routed Claude spawn and prewarm preparation; do not embed integration logic.
- `src/server/agent-runtime/types.ts`, `src/server/agent-runtime/http.ts`, `src/server/agent-runtime/manager.ts`: carry and enforce `credentialSource: "gateway"`, bypass normal Claude credential lookup, and apply the gateway overlay last for spawn and prewarm.
- `src/server/restart-control.ts`, `src/server/dev/bridge-lock.ts`: consume the extracted shared process-ownership helpers without changing their current behavior.
- `src/server/db/schema.ts`, `src/server/db/index.ts`: add worker-level effective launch model/effort columns and backward-compatible column initialization.
- every current runtime settings/spawn caller (`conversations/create.ts`, `conversations/send-message.ts`, `runs/recovery.ts`, `runs/recovery-reconciler.ts`, `quota/worker-resume.ts`, `supervisor/index.ts`, `supervisor/observer.ts`, `supervisor/worker-failover.ts`, `planning/review.ts`, and `runtime/http/routes/prewarm-worker.ts`): audit persisted selection and add a regression assertion; change only callers that currently discard worker-level selection.
- `src/server/worker-models.ts`: merge encoded custom/discovered entries into Claude without external probes.
- `src/runtime/http/routes/agents-catalog.ts`: supply the persisted gateway catalog cache to the existing catalog builder.
- `src/components/settings/AgentsSettingsPanel.tsx`: compose the focused gateway section and pass settings/secret state.
- `src/components/settings/SettingsDialog.tsx`: pass configured-secret metadata only if the current prop boundary requires it.
- settings draft/home composition modules identified by existing data flow: provide `ClaudeModelGatewayManager` and saved-secret metadata without adding gateway state to `useHomeMutations.ts`.
- `shared/locales/en.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, `zh-CN.json`: every visible string and accessibility label.
- `package.json`: add a smoke script only; no new runtime dependency is planned because macOS/Linux extraction uses the platform `tar` executable and Windows extraction uses existing `adm-zip`.
- `docs/architecture/lifecycle-observability-and-testing.md`: document gateway state/event invariants and the lifecycle scenario.

## State and persistence invariants

- [ ] The server singleton and SQLite settings are authoritative; React never invents service or OAuth state.
- [ ] Every status snapshot is complete and has a monotonically increasing `revision`.
- [ ] Every action has an operation ID; duplicate install/start requests share the in-flight operation.
- [ ] The frontend rejects responses older than its latest request and snapshots older than its latest server revision.
- [ ] Cached discovered models may render but never imply the service is ready.
- [ ] Custom/discovered selections are persisted as `cliproxyapi:<raw-id>`; only the worker boundary decodes them.
- [ ] Native Claude selections never receive proxy environment variables.
- [ ] Routed selections never fall back to a native Claude model.
- [ ] Tokens are encrypted in SQLite and absent from status, event, error, log, command-line, and snapshot output.
- [ ] Managed service ownership is proven before stop; external mode never signals a process.
- [ ] Stop disables autostart but does not delete binaries, config, logs, or provider auth.
- [ ] Spawn, resume, recovery, and prewarm use the same environment builder.
- [ ] Existing worker-pool environment fingerprinting keeps different endpoints/tokens/models in different pools.
- [ ] App boot uses only bounded local checks and does not wait on downloads, OAuth, or a remote external service.
- [ ] A routed Claude selection always crosses client/server boundaries as the complete compound tuple `{ type: "claude", accountId: null, encoded model, effort }`; any non-null Claude account is rejected before durable state is created.
- [ ] Each worker persists its effective encoded launch model, effort, and credential source at reservation time; worker-level values win during resume/recovery, with run-level values used only for legacy rows.
- [ ] Routed conversation creation performs a bounded readiness/compound-selection preflight before the first durable insert and repeats the deduplicated readiness check at transport time.
- [ ] `credentialSource: "gateway"` bypasses normal Claude account/profile/keychain resolution, and gateway variables are applied last inside the agent runtime before pool fingerprint/spawn.
- [ ] The action/status API and `/api/events?snapshot=1` expose the same redacted singleton snapshot; tests use named SSE events, never a parallel test endpoint.

## Task 1: Lock the shared contract and model identity

**Files:**

- Create `src/lib/claude-model-gateway.ts`
- Create `tests/lib/claude-model-gateway.test.ts`

- [ ] Write failing tests for encoding/decoding `cliproxyapi:gpt-5.6-sol`, native Claude pass-through, malformed prefixes, whitespace, control characters, oversized IDs, duplicate IDs, optional labels, and deterministic native/custom/discovered merging.
- [ ] Write failing tests proving public status parsing strips unknown secret-shaped fields and accepts every legal installation/service/OAuth state.
- [ ] Define constants for every setting key and the `cliproxyapi:` route prefix.
- [ ] Define shared types for mode, status snapshot, action request/response, model entries, operation state, and stable error codes.
- [ ] Implement pure encoding, decoding, validation, labeling, and catalog merge functions.
- [ ] Seed `gpt-5.6-sol` through the normal custom-model representation rather than a special worker branch.
- [ ] Run `pnpm vitest run tests/lib/claude-model-gateway.test.ts` and confirm green.
- [ ] Run `pnpm typecheck` and fix only errors caused by this task.

**Checkpoint:** A raw gateway ID has one unambiguous persisted identity, with no server, process, or UI work yet.

## Task 2: Build safe managed-file and installer primitives

**Files:**

- Create `src/server/integrations/claude-model-gateway/managed-files.ts`
- Create `src/server/integrations/claude-model-gateway/installer.ts`
- Create `tests/server/integrations/claude-model-gateway/managed-files.test.ts`
- Create `tests/server/integrations/claude-model-gateway/installer.test.ts`

- [ ] Start with failing tests for supported platform/architecture asset mapping: macOS/Linux/Windows and `x64`/`arm64`.
- [ ] Add failing tests for PATH detection of both supported binary names and deterministic version metadata.
- [ ] Add a local HTTP release fixture and watch checksum success, checksum mismatch, timeout, HTTP failure, size cap, and interrupted download tests fail.
- [ ] Add malicious archive fixtures for `../`, absolute paths, symlink escape, and unexpected executable layout; prove all are refused before extraction outside the staging directory.
- [ ] Add failing tests for platform extraction: invoke `tar -tzf`/`tar -xzf` without shell interpolation for macOS/Linux, use `adm-zip` for Windows, refuse when `tar` is unavailable, and never trust archive names before validating the listing.
- [ ] Add tests for mode `0700` directories, `0600` sensitive files, atomic current-version metadata, and refusal to overwrite a file without the OmniHarness marker.
- [ ] Implement version-scoped paths under `~/.omniharness/cliproxyapi`, with the home root injectable in tests.
- [ ] Implement system binary detection before network work.
- [ ] Implement official latest-release metadata retrieval, asset selection, bounded download, published SHA-256 verification, platform-specific safe extraction, executable permission, and atomic install metadata.
- [ ] Make retries idempotent: a verified installed version returns it; an incomplete version is never marked current.
- [ ] Return structured causes suitable for named events without including response bodies or tokens.
- [ ] Run `pnpm vitest run tests/server/integrations/claude-model-gateway/managed-files.test.ts tests/server/integrations/claude-model-gateway/installer.test.ts`.
- [ ] Run `git diff --check`.

**Checkpoint:** A real binary can be safely acquired, but nothing starts and no settings/UI are wired.

## Task 3: Implement settings, the gateway client, and process ownership

**Files:**

- Create `src/server/integrations/claude-model-gateway/settings.ts`
- Create `src/server/integrations/claude-model-gateway/client.ts`
- Create `src/server/integrations/claude-model-gateway/process-manager.ts`
- Create `src/server/process-ownership.ts`
- Modify `src/server/restart-control.ts`
- Modify `src/server/dev/bridge-lock.ts`
- Create `tests/server/integrations/claude-model-gateway/settings.test.ts`
- Create `tests/server/integrations/claude-model-gateway/client.test.ts`
- Create `tests/server/integrations/claude-model-gateway/process-manager.test.ts`
- Extend existing restart-control and bridge-lock tests

- [ ] Write failing settings tests for managed/external parsing, defaults, encrypted secret persistence, configured-secret replacement semantics, malformed custom JSON, internal catalog isolation, and provisional install state.
- [ ] Prove raw SQLite values for token keys are encrypted and public reads expose only `{ configured, updatedAt }`.
- [ ] Write a local fixture for readiness, `/v1/models`, Codex OAuth URL creation, and auth-file status. Add failing tests for auth headers, response parsing, deduplication, timeout, malformed responses, non-2xx causes, and redaction.
- [ ] Write failing process tests for generated loopback config, random distinct tokens, default port `8317`, readiness success/failure, concurrent start deduplication, unexpected exit, bounded stdout/stderr, and shutdown.
- [ ] Add PID ownership tests: exact executable/config arguments permit stop; reused PID, unknown executable, unknown config, or external mode refuse signaling.
- [ ] Add restart-adoption tests for an owned running process and stale process metadata.
- [ ] Extract portable PID metadata, liveness, start-time, and command-identity inspection from `restart-control.ts`/`dev/bridge-lock.ts` into `src/server/process-ownership.ts`; refactor both existing consumers to it and retain their tests. Provide injected macOS/Linux and Windows command inspectors. Do not introduce a third unrelated ownership abstraction.
- [ ] Implement setting reads/writes with transactions where available. Save generated tokens while disabled before installation; set enabled only after successful readiness.
- [ ] Implement a bounded gateway client that never logs auth-file contents, bearer values, or sensitive OAuth URLs.
- [ ] Generate the CLIProxyAPI config with loopback bind, managed auth directory, data token, and management token. Write it atomically with an ownership marker.
- [ ] Implement gateway process policy over those shared primitives. Launch with direct `spawn(executable, args, { shell: false })` and file-descriptor logging—do not use the restart controller's `sh`/PTY pipeline. Add readiness deadline, bounded/redacted log tails, start-time-aware ownership metadata, verified stop, and shutdown cleanup.
- [ ] Confirm external mode exposes probe/client operations but no process actions.
- [ ] Run the three focused test files and `pnpm typecheck`.

**Checkpoint:** Server primitives can persist, talk to, and safely own the service in isolation.

## Task 4: Add the authoritative service state machine and observability

**Files:**

- Create `src/server/integrations/claude-model-gateway/index.ts`
- Modify `src/server/events/named-events.ts`
- Modify `src/instrumentation.ts`
- Extend `docs/architecture/lifecycle-observability-and-testing.md`
- Create `tests/server/integrations/claude-model-gateway/service.test.ts`
- Extend the repository's named-event tests

- [ ] Read the lifecycle observability specification immediately before editing transitions.
- [ ] Write failing tests for all legal state transitions, illegal-action refusal, operation IDs, monotonic revisions, concurrent install/start deduplication, and stale probe suppression.
- [ ] Write exact event-sequence tests for install success/failure, start success/failure, stop, OAuth start/completion/failure, model refresh success/failure, and spawn refusal.
- [ ] Add gateway named-event variants. Extend `SurfacedErrorCode` only for install, OAuth, discovery, readiness, platform, and configuration domain failures; reuse `process.spawn.failed`, `process.stop.failed`, and `process.orphaned_after_restart` when those exact generic process failures occur.
- [ ] Implement a singleton service with complete redacted snapshots and explicit `install`, `start`, `stop`, `connect`, `refreshModels`, `inspect`, and `ensureReady` operations.
- [ ] Make OAuth completion polling server-owned, bounded, operation-ID fenced, and event-producing. The browser only opens the URL and observes canonical state.
- [ ] Ensure every decision emits a named event; every user-relevant failure also emits `error.surfaced` with a stable code and meaningful surface.
- [ ] Preserve complete error stacks/causes internally while sanitizing public snapshots and events.
- [ ] Hook `src/instrumentation.ts` by mirroring the existing one-line `ensureSupervisorRuntimeStarted().catch(...)` boot pattern after database readiness: schedule adoption/start only when managed and enabled, do not block app boot, and surface failure.
- [ ] Include the same redacted gateway summary in the live and persisted `/api/events?snapshot=1` builders. Publish transitions through the existing named-event ring with IDs; add no gateway-specific SSE endpoint or test flag.
- [ ] Add bounded shutdown handling and prove it does not stop an unowned or external process.
- [ ] Document ownership, revisions, transitions, boot, and named events in the architecture guide.
- [ ] Run focused service/event tests and `pnpm test:lifecycle` if the existing suite is still green enough to isolate new failures.

**Checkpoint:** One server authority owns all gateway decisions, restart behavior, and evidence.

## Task 5: Expose the portable API

**Files:**

- Create `src/runtime/http/routes/claude-model-gateway.ts`
- Create `src/app/api/integrations/claude-model-gateway/route.ts`
- Modify `src/runtime/http/routes/index.ts`
- Create `tests/runtime/claude-model-gateway-route.test.ts`

- [ ] Write failing GET tests for authentication, a complete redacted snapshot, configured-secret metadata, revision, model provenance, and no token leakage.
- [ ] Write failing POST tests for session auth, same-origin enforcement, JSON/content-type errors, all five actions, invalid mode/action/payload, operation conflicts, and exact status/error mappings.
- [ ] Write a test proving the route is registered for the portable runtime and the Next adapter delegates to the same handler.
- [ ] Implement GET `/api/integrations/claude-model-gateway` with a bounded inspect operation.
- [ ] Implement POST action validation and delegate directly to the singleton; do not duplicate state transitions in the route.
- [ ] Return an OAuth URL/state only from `connect`; never return tokens or auth-file records.
- [ ] Preserve structured errors through the established app-error shape rather than a blanket generic message.
- [ ] Add a parity test proving the operational GET snapshot equals the gateway subsection of the canonical event snapshot at the same revision.
- [ ] Run `pnpm vitest run tests/runtime/claude-model-gateway-route.test.ts` and existing auth/settings route tests.

**Checkpoint:** Web and alternate runtime surfaces have the same safe control plane.

## Task 6: Merge routed models into the catalog

**Files:**

- Modify `src/server/worker-models.ts`
- Modify `src/runtime/http/routes/agents-catalog.ts`
- Extend `tests/server/worker-models.test.ts` or the current catalog test file
- Extend the existing agents-catalog route tests

- [ ] Add failing tests proving native Claude entries remain unchanged and ordered, while custom and cached discovered entries are encoded and deduplicated.
- [ ] Add tests for a missing/stale cache, a selected-but-currently-undiscovered model, duplicate labels, malformed internal cache, and external outage.
- [ ] Prove a normal catalog GET makes no gateway network request.
- [ ] Treat HTTP gateway discovery as a new integration input to the catalog builder; do not force it through the existing CLI `RunCommand` discovery signature used by other worker types.
- [ ] Load validated custom/cache data once in the agents-catalog route and pass it into the pure catalog builder.
- [ ] Merge `gpt-5.6-sol` and arbitrary valid models under Claude Code with human labels and encoded values.
- [ ] Keep source/staleness in gateway status, not translated or persisted as display copy.
- [ ] Run focused catalog tests and inspect the returned Claude catalog JSON manually.

**Checkpoint:** Routed models appear in the existing picker without introducing a second model-selection system.

## Task 7: Route every Claude worker lifecycle through one environment builder

**Files:**

- Create `src/server/integrations/claude-model-gateway/worker-env.ts`
- Create `tests/server/integrations/claude-model-gateway/worker-env.test.ts`
- Modify `src/server/bridge-client/index.ts`
- Modify `src/server/agent-runtime/types.ts`
- Modify `src/server/agent-runtime/http.ts`
- Modify `src/server/agent-runtime/manager.ts` with small credential-ordering delegation hooks
- Modify `src/server/db/schema.ts`
- Modify `src/server/db/index.ts`
- Audit `src/server/conversations/create.ts`
- Audit `src/server/conversations/send-message.ts`
- Audit `src/server/runs/recovery.ts`
- Audit `src/server/runs/recovery-reconciler.ts`
- Audit `src/server/quota/worker-resume.ts`
- Audit `src/server/supervisor/index.ts`
- Audit `src/server/supervisor/observer.ts`
- Audit `src/server/supervisor/worker-failover.ts`
- Audit `src/server/planning/review.ts`
- Audit `src/runtime/http/routes/prewarm-worker.ts`
- Extend `tests/server/bridge-client.test.ts` or the repository's existing bridge tests
- Extend relevant recovery/resume/prewarm tests

- [ ] Write failing pure tests proving native Claude selections are untouched and encoded selections decode to the raw ID.
- [ ] Assert the seven required variables: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1`, `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY=3`, and `ENABLE_TOOL_SEARCH=false`.
- [ ] Add a Claude version parser/capability table and tests around the documented 2.1.129 gateway-discovery minimum. When supported, assert `ANTHROPIC_CUSTOM_MODEL_OPTION=<raw ID>` and `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`; keep these separate from the literal user-alias contract and omit them for unknown/older versions.
- [ ] Add failing bridge tests for normal spawn and prewarm. Then enumerate every current `readRuntimeEnvFromSettings()` plus `spawnAgent()`/`prewarmWorker()` caller listed above and add coverage that proves it reaches the common helper.
- [ ] Add refusal tests for disabled integration, missing token, unreachable service, unsupported mode, and ensure-ready timeout. Assert no bridge request was sent and no native fallback occurred.
- [ ] Add preflight tests proving an invalid gateway account tuple or unavailable gateway returns before any plan/run/worker/message/artifact insert. Keep the common transport check as a second race-safe guard and deduplicate concurrent readiness requests.
- [ ] Add tests proving the raw model is sent to the agent runtime while encoded selection remains in the persisted run/worker state.
- [ ] Add `effective_launch_model`, `effective_launch_effort`, and `launch_credential_source` to the worker schema/create-table/column-upgrade path. Persist them when each worker row is reserved, before any background spawn, and use them for quota resume, recovery reconciliation, observer resume, planning review, and failover; legacy nulls fall back to the run tuple.
- [ ] Add a regression test for quota recovery where the worker's routed model differs from the run's current preference; assert the worker-level route wins.
- [ ] Extend bridge/runtime request types with `credentialSource: "gateway"`. In both normal spawn and prewarm, reject it unless worker type is Claude, account is null, and the routed request is valid; skip `resolveAccountCredentials`/Claude keychain bridging and apply gateway variables after project storage so later credential code cannot overwrite them.
- [ ] Assert the agent-runtime pool fingerprint sees the final gateway overlay and differs by model, endpoint, and token.
- [ ] Add tests proving secrets never enter errors/events and that model/endpoint/token changes alter the existing pool environment fingerprint.
- [ ] Implement the pure builder, then add only small delegation hooks in `spawnAgent` and `prewarmWorker` before bridge HTTP calls.
- [ ] Ensure readiness calls are deduplicated during concurrent worker creation.
- [ ] Run focused bridge, recovery, resume, and worker-pool tests.

**Checkpoint:** `gpt-5.6-sol` now behaves like the requested alias for every lifecycle path, without global environment changes.

## Task 8: Add the frontend Manager and settings UI

**Files:**

- Create `src/app/home/ClaudeModelGatewayManager.ts`
- Create `src/components/settings/ClaudeModelGatewaySettings.tsx`
- Modify `src/components/settings/AgentsSettingsPanel.tsx`
- Modify `src/components/settings/SettingsDialog.tsx` only if needed for secret metadata
- Modify the existing settings composition modules that already own the settings draft
- Create `tests/app/claude-model-gateway-manager.test.ts`
- Create `tests/ui/claude-model-gateway-settings.test.tsx`
- Modify all `shared/locales/*.json`

- [ ] Record the shadcn block decision in implementation notes: `sidebar-13` is the closest shell, but the existing Settings dialog already provides it, so reuse current shadcn primitives and do not run an overwrite-prone block install.
- [ ] Write failing Manager tests for initial refresh, action state, operation IDs, server revision ordering, slow-response rejection, SSE subscription ownership, timeout, unmount/stop, retry, and network error preservation.
- [ ] Replace client-owned service/OAuth polling expectations with existing SSE subscription behavior plus GET bootstrap/manual refresh. Test replay/resync and prove an older GET cannot overwrite a newer SSE revision.
- [ ] Write failing render/interaction tests for managed not-installed, installing, stopped, running/disconnected, connecting, connected, error, and external states.
- [ ] Add tests separating immediate operational actions from Save/Cancel draft changes. Verify an empty saved secret field preserves the existing token and an explicit replacement is saved.
- [ ] Add OAuth tests: popup success, popup blocked with visible fallback link, `noopener,noreferrer`, server-reported completion/timeout over the existing live stream, and no OAuth URL persistence.
- [ ] Add compound-selection tests: choosing a gateway model submits `{ workerType: "claude", accountId: null, encoded model, effort }`, shows a derived non-editable **Gateway provider connection**, rejects/restores incompatible Claude accounts on model switches, and leaves no partial durable state on a forged non-null account request.
- [ ] Add custom model add/remove/validation tests, discovered model provenance/staleness, refresh state, keyboard navigation, live status announcements, and narrow width.
- [ ] Implement `ClaudeModelGatewayManager` as the sole frontend owner of status, revision, operation, live-event updates, and draft-local errors. Components subscribe narrowly through the existing Manager hooks.
- [ ] Implement the settings section with existing Button/Input/Select/Switch/Badge/ErrorNotice and accessible labels. Do not put gateway logic into `useHomeMutations.ts`.
- [ ] Wire draft fields through the existing settings draft Manager. After a successful immediate action, refresh server status and update any affected settings baseline so Cancel cannot visually resurrect stale state.
- [ ] Add every visible string to `en.json` and every other locale in the same change. Call `useI18nSnapshot()` in rendered components and `t()` at every user-visible boundary.
- [ ] Run Manager/UI tests, settings tests, and locale parity/source scans.

**Checkpoint:** The full setup and recovery journey is usable without a terminal and obeys existing settings semantics.

## Task 9: Add deterministic fixture, lifecycle, and restart coverage

**Files:**

- Create `tests/fixtures/claude-model-gateway/fixture-server.ts`
- Create `tests/lifecycle/scenarios/claude-model-gateway-routing.test.ts`
- Extend lifecycle helpers only if a generic local fixture hook is missing

- [ ] Build a test-only local service implementing readiness, `/v1/models`, OAuth URL/state, auth-file completion, and a minimal Anthropic-compatible request recorder. Keep fault controls entirely in test code.
- [ ] Add a test proving CLIProxyAPI provider credentials stay under its configured auth directory and are never read from, copied to, or confused with the existing supervisor `~/.codex/auth.json` flow.
- [ ] Write a lifecycle scenario that configures external mode, refreshes models, creates a Claude worker with `cliproxyapi:gpt-5.6-sol`, and verifies the raw model and exact route settings reached the fixture.
- [ ] Assert the expected named-event sequence and SSE IDs.
- [ ] Add a gateway outage step and prove the worker spawn is refused with `claude_gateway.not_ready`, no fallback, and no orphan worker/session row.
- [ ] Add app/runtime restart coverage: cached models remain visible, the configured route remains encoded, and a later successful readiness check permits resume through the same route.
- [ ] Assert the gateway summary appears in canonical snapshot bootstrap and all decisions arrive as ID-bearing named events with replay/resync behavior.
- [ ] If the managed process can be exercised deterministically in lifecycle tests, verify owned restart adoption; otherwise keep adoption in process integration tests and document the boundary.
- [ ] Run `pnpm test:lifecycle -- claude-model-gateway-routing` if supported, then the complete `pnpm test:lifecycle` suite.

**Checkpoint:** The control plane is proven through HTTP/SSE and persistence, not only by isolated mocks.

## Task 10: Add a real CLIProxyAPI smoke test

**Files:**

- Create `scripts/smoke-claude-model-gateway.ts`
- Modify `package.json`
- Add script tests if the repository has a script-test convention

- [ ] Implement a command that creates an isolated temporary home/config/auth directory and selects an unused loopback port.
- [ ] Use the production installer to query the official release, download the actual archive, and verify its published checksum.
- [ ] Start the real binary with generated temporary config, wait for readiness, query the models endpoint, and exercise management OAuth URL creation without printing the URL or secrets.
- [ ] Always verify owned-process identity before stop and clean only the script's own temporary directory in a `finally` path. Never touch the user's managed install or provider auth.
- [ ] Define three explicit outcomes: `passed`, `blocked_environment` (unsupported OS/arch, missing platform `tar`, or network unavailable before release metadata), and `failed_feature` (checksum, extraction, startup, readiness, API, or owned-stop failure after prerequisites pass). Print only the outcome and sanitized stage evidence.
- [ ] Add `pnpm smoke:claude-model-gateway` for a best-effort developer check and `pnpm smoke:claude-model-gateway -- --require-network` for a release gate where `blocked_environment` exits non-zero. Document that neither command completes interactive provider OAuth.
- [ ] Keep deterministic fixture/lifecycle tests required on every CI runner. Run the network-required smoke in a supported, network-enabled release job and on the development machine for this user-requested delivery; offline CI does not masquerade as feature success.
- [ ] Run the smoke command on the development machine and retain sanitized evidence: selected version/platform, checksum pass, readiness pass, endpoint pass, management-call pass, owned stop pass.

**Checkpoint:** The production installer/client/process code works against the actual upstream binary rather than only a look-alike fixture.

## Task 11: Verify the running product journey

**Precondition:** Reuse the already-running OmniHarness process. If provider OAuth requires user interaction, open the returned browser page and pause only for that unavoidable account consent.

- [ ] Open Settings > Agents and verify the gateway section at desktop and narrow viewport widths.
- [ ] Exercise managed install/start. Confirm the UI shows progress, completion, and actionable failure if a port or network problem is introduced outside production code.
- [ ] Choose **Connect gateway provider**, verify safe popup/fallback-link behavior, complete OAuth when credentials are available, and confirm the UI recognizes server-owned completion. Verify this connection remains visibly distinct from the supervisor's existing Codex CLI sign-in.
- [ ] Refresh models, add `gpt-5.6-sol` manually if discovery does not expose it, save, close settings, and confirm it appears under Claude Code in the existing picker.
- [ ] Start a direct Claude Code conversation with `GPT-5.6 SOL` and verify the worker/run records retain the encoded selection while runtime evidence shows the raw effective model.
- [ ] Inspect `GET /api/events/log?runId=<id>` and confirm service/routing decisions are present with no secret material.
- [ ] Resume or recover the test worker and verify it uses the same route; verify a native Claude worker remains unaffected.
- [ ] Stop the managed service and confirm a routed start fails visibly without fallback; restart and retry successfully.
- [ ] Reload the app and, where safe, restart the app process to verify settings/status/model persistence and managed adoption/autostart.
- [ ] Clean up all test conversations and their associated persisted artifacts using the repository's established cleanup path. Do not remove unrelated conversations or provider credentials.
- [ ] Capture sanitized screenshots or test notes for installed, connected, model selected, routed worker, and explicit outage states.

**Checkpoint:** A real user can complete the requested job from the UI.

## Task 12: Full regression and completion gate

- [ ] Review the diff for accidental edits to unrelated dirty files; isolate and preserve them.
- [ ] Search for secrets and forbidden hardcoded UI copy in changed files.
- [ ] Confirm no branch or worktree was created and no files/credentials were deleted.
- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test:lifecycle`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm smoke:claude-model-gateway -- --require-network` on the supported network-enabled development machine; record `blocked_environment` separately from any feature failure if prerequisites are genuinely unavailable.
- [ ] Run `git diff --check`.
- [ ] Re-run the focused worker routing and API tests after the full suite to make the final evidence easy to inspect.
- [ ] Use `verification-before-completion`: report exact commands, exit codes, any pre-existing failures, and the sanitized real-journey evidence before claiming completion.
- [ ] Use `requesting-code-review` for a final independent review of security, lifecycle observability, race handling, route coverage, UI semantics, and native Claude regression risk.
- [ ] If review finds a meaningful bug or architecture flaw, use `systematic-debugging`, add a regression test first, and record the durable lesson with `learning-from-bugs`.

## Required acceptance evidence

- [ ] Fresh managed installation succeeds from the UI on the development platform.
- [ ] Official archive checksum is verified before execution.
- [ ] Managed service binds only to loopback and stop proves ownership.
- [ ] OAuth can be initiated and completion can be observed without token exposure.
- [ ] `gpt-5.6-sol` and another arbitrary valid ID appear under Claude Code.
- [ ] Routed Claude spawn, prewarm, resume, and recovery use the exact requested environment.
- [ ] Native Claude behavior is unchanged.
- [ ] Gateway outage produces an explicit stable error and no fallback/orphan state.
- [ ] Reload/restart and stale-response behavior are covered.
- [ ] All user-visible text is translated in every locale.
- [ ] Named events and `error.surfaced` cover every server decision/failure.
- [ ] Focused, full, lifecycle, build, real-binary smoke, and running-app checks pass or any unrelated pre-existing failure is precisely documented.
- [ ] Verification-created conversations/artifacts are cleaned without touching unrelated data.

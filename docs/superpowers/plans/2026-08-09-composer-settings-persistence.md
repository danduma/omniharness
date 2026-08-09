# Composer Model and Effort Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `using-ultrapowers`, then use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a continued conversation offers the model and effort settings from the latest accepted user turn, while also remembering the selected effort independently for each model across sessions and browser reloads.

**Architecture:** Establish one shared canonical representation for model and effort values, separate browser-local per-model defaults from run-scoped authoritative settings, and make run settings revisioned and merged field-by-field. User edits are explicitly dirty and take precedence over clean server hydration; submitted settings are captured atomically with the message and become authoritative only after acknowledgement. Optimistic snapshots and SSE replay/resync use monotonic revisions so stale state cannot overwrite newer settings.

**Tech Stack:** TypeScript, React, existing Home UI Manager classes, SQLite schema/migrations, the existing conversation/run HTTP APIs, named lifecycle events, SSE replay/resync, Vitest, and the existing lifecycle scenario runner.

**North Star Product:** When a user starts or continues work with a particular model and effort, the composer remains faithful to that choice. Switching models recalls that model’s last explicitly selected effort, and switching runs does not leak one run’s settings into another.

**Current Milestone:** Fix model/effort continuity and per-model effort persistence without redesigning worker/account/conversation selection or introducing a second persistence stream.

**Future Product Direction:** Keep the settings protocol extensible for additional composer preferences, but do not broaden this change to new options or a general preferences framework.

**Final Functionality Standard:** A user can choose `Codex Luna Extra High`, submit a turn, return after the agent finishes, and see `Codex Luna Extra High` offered for the next input unless they changed it. If they switch to another model, that model recalls its own last selected effort. Reconnects, delayed snapshots, optimistic responses, retries, queued messages, and server restarts cannot silently downgrade or cross-contaminate model/effort settings.

---

## Scope and invariants

### Product behavior

1. The latest accepted user-turn settings are the settings offered by the next composer input for that run.
2. Model and effort are a pair, but each field has independent dirty ownership so a user-edited effort is not overwritten by a server model refresh, and vice versa.
3. A run’s settings do not change the global per-model effort default merely because that run was hydrated, replayed, reconnected, or selected.
4. The browser remembers effort by canonical model identity. It does not remember one model’s effort under another model or under a display-label spelling.
5. The submitted model/effort pair is captured at submit time. Later UI changes cannot mutate the message, queued item, retry, or steer operation that was already accepted.
6. Unsubmitted local edits remain local. They must not be written into server run settings until a message carrying those settings is accepted.
7. Existing worker selection and account selection semantics remain unchanged unless needed to preserve the settings invariants.

### Canonical values

Use stable protocol values internally and at persistence boundaries:

- Effort values: `low`, `medium`, `high`, `extra high`, and `max`.
- Display labels remain `Low`, `Medium`, `High`, `Extra High`, and `Max`.
- The parser accepts the currently observed aliases (`Extra High`, `extra_high`, `extra-high`, `xhigh`) and normalizes them to `extra high`.
- Missing effort is distinct from invalid effort. Missing means “preserve the current server value” when updating an existing run; invalid means reject the request with a typed user-visible error.
- Choose this compatibility policy: snapshots may preserve an opaque unknown server value and render it as an unsupported current value; unchanged submissions preserve it by omission; explicitly supplied values must be in the supported canonical set; local per-model preferences store only supported values. Unknown values must never silently downgrade to `high`.
- Model identity must use the existing canonical model id/catalog value, not a display label. Alias normalization belongs in a dependency-safe shared module, not in a frontend-only utility.

### State ownership

Maintain these separate concepts:

- **Authoritative run settings:** model, effort, settings revision, and the last accepted/submitted settings snapshot.
- **Composer draft:** a per-run map of settings currently shown and editable in the composer, with a separate new-conversation key. This preserves unsent edits when switching away from a run and back; it must not allow one run’s draft to initialize another run.
- **Dirty ownership:** independent `modelDirty` and `effortDirty` flags, field versions/provenance (`explicit_user`, `model_recall`, `server_hydration`, or `acknowledged`), and the submission identity/revision needed to reconcile acknowledgement after further edits.
- **Global per-model browser preference:** the last explicit effort chosen for a model, stored locally and loaded before a model-change commit.

The state manager remains the single source of truth. Components subscribe to it and invoke explicit manager methods; they must not introduce parallel React state arrays or ad hoc localStorage synchronization.

### Ordering rules

- Every authoritative run-settings update carries a monotonic `settingsRevision`. Define `0` as the backfilled value for existing runs and `1` as the initial-created-run revision; every accepted user turn, including one whose effective settings are unchanged or whose request omitted both fields, creates the next accepted-turn snapshot and increments the revision.
- A snapshot with a revision older than the manager’s applied revision is ignored.
- Reapplying the same revision and `submissionId` is idempotent. The same revision with conflicting authoritative contents is an invariant violation that emits the required diagnostic/error event and is not resolved by arrival order.
- Omitted fields in a partial update are no-ops; they cannot erase a known model or effort.
- Optimistic state is tagged with the submission identity/revision it represents. A stale HTTP response, replayed SSE frame, or old full snapshot cannot supersede a newer acknowledged state.
- A server snapshot may update a clean field. It must not update a dirty field until the matching submission is acknowledged or the user explicitly resets/abandons that draft.
- A successful acknowledgement clears only dirty flags whose submitted values still match the acknowledgement. If the user edited the field again meanwhile, the newer dirty value survives.
- Switching runs changes only the active draft key. An existing run draft retains its values, provenance, dirty flags, and field versions; a draft is initialized from authoritative state only when no draft exists. Dirty metadata is cleared only by matching acknowledgement, explicit reset/abandon, or deletion of that draft. The new-conversation draft follows the same isolation rule, and selection never writes another run’s settings into global per-model defaults.
- Each accepted request carries one stable `submissionId` and, for an existing run, `expectedSettingsRevision`, captured synchronously from that run’s authoritative baseline rather than an optimistic pending revision. New-conversation creation uses `expectedSettingsRevision: null` and starts at revision 1. New clients must send the field for existing runs; legacy omission is accepted only through a transaction-local read/CAS compatibility path and cannot silently overwrite a concurrently advanced row. Duplicate submission identities are idempotent and return the original accepted snapshot; they cannot increment settings twice. Concurrent accepted requests use an atomic compare-and-set/serialized transaction so each revision has one deterministic accepted turn. A stale expected revision returns a typed conflict containing the current authoritative pair/revision; the client rehydrates clean fields while preserving newer local edits.

### Server transaction rules

- Initial run creation persists model and effort with the run’s initial revision.
- An accepted user message atomically captures its model/effort pair and updates the run’s authoritative settings, whether or not the request also changes worker type. The accepted message record is the authoritative historical source for retries, queue delivery, interruption recovery, and audit; do not derive an old turn’s settings from the current run row.
- An omitted model or effort preserves the existing run value. It must not be interpreted as a default or as “clear.”
- Invalid supplied values fail validation before the message/queue mutation is committed and emit the required typed `error.surfaced` event.
- Worker selection changes must not erase model/effort fields.
- Retries, queued messages, interruptions, and continuation/steer paths must carry the immutable captured settings pair or intentionally omit fields under the preserve rule.
- Queue enqueue is the sole acceptance/revision increment for that logical turn. Later delivery and delivery retry read the immutable queue snapshot and do not increment the run revision or restore an older pair onto the run. Queue-to-message conversion copies the same `submissionId`, model, effort, and accepted revision. Cancellation does not roll back run settings because the turn was already accepted; document and test this product contract.

### Accepted-turn persistence contract

Use direct nullable columns on the existing accepted user-message and queued-message records rather than a second conversation-content stream:

- `messages.submission_id`, `messages.submitted_model`, `messages.submitted_effort`, and `messages.settings_revision`.
- `queued_conversation_messages.submission_id`, `queued_conversation_messages.submitted_model`, `queued_conversation_messages.submitted_effort`, and `queued_conversation_messages.settings_revision`.
- `runs.settings_revision` remains the latest authoritative baseline; the message/queue columns remain the immutable turn snapshot.

`submissionId` is the stable idempotency key across the HTTP retry, queued row, delivered message, acknowledgement, and any queue-to-message conversion. Add the narrowest unique/indexed lookup needed to find it across both accepted representations. Do not conflate it with a reminted database message id; if the existing `clientMessageId` is used as the wire value, preserve it as `submissionId` and prohibit fallback reminting for valid retries.

Snapshot nullability is intentional: `submitted_model = null` means automatic/provider-default model selection, and `submitted_effort = null` means intentionally unspecified/provider-default effort. These differ from an omitted request field (preserve the current run value) and from an opaque unknown stored server value. If launch resolution materializes concrete values, store those as an additional effective launch record without changing automatic-selection semantics; do not make this plan require a model-selection redesign.

For every acceptance path, the SQLite transaction or repository-supported atomic batch must validate supplied settings, resolve omitted fields from the current run, insert/update the accepted-turn snapshot, update the run’s model/effort/revision, and commit before publishing the settings event. Enumerate and test these paths individually:

1. Normal direct user message.
2. Supervised/checkpoint message.
3. Clarification answer.
4. Queued message.
5. Active-turn steer/interrupt.
6. Retry or edited-message submission.
7. Initial conversation creation (initial user message and run revision 1).

The current stream-first direct-message behavior may remain, but the plan must document its ordering: idempotent JSONL append occurs before the DB commit as required by the existing worker-stream contract; a failed DB transaction must not publish a settings event, and any orphaned stream entry must be harmless/reconciled by the existing idempotency path. Worker launch, SSE notification, and other external side effects occur only after the accepted DB commit, or have an explicit idempotent/compensating path where the existing flow requires earlier work.

The implementation must identify the exact transaction boundary for each branch, including planning-review rejection, missing-worker rejection, queue failure, stream failure, and any later validation failure. No run settings may commit for a turn whose message/queue acceptance rolled back.

Idempotency lookup occurs across both message and queue representations before validation/CAS. A duplicate returns the original `submissionId`, settings snapshot, accepted revision, and current disposition (`pending`, `delivered`, `cancelled`, `failed`, or equivalent) without inserting a row, incrementing a revision, publishing a second settings event, or issuing a false new notification.

### Observability rules

Every server decision added or changed by this plan emits a typed named event through `emitNamedEvent`. User-visible failures additionally emit `error.surfaced` with a stable code, surface, and relevant run/conversation/worker id. All SSE frames continue to include `id:` and use the existing Last-Event-ID replay, ring-buffer, snapshot, and `stream.resync_required` behavior. Do not add server fault injection.

## File-by-file implementation map

The implementer must inspect the current dirty worktree before editing. Preserve unrelated user changes, including the currently untracked `src/server/events/run-snapshot-fields.ts` if it exists. Do not create a branch or worktree, and do not delete any file.

### Shared protocol and preference storage

#### `src/shared/composer-preferences.ts` — create

- Define the canonical effort type/values, model-id normalization boundary, parser, display-value helpers, and typed settings pair/snapshot types that can be imported by both client and server.
- Make normalization dependency-safe: this module must not import browser APIs, React, or server-only modules.
- Distinguish `undefined` (omitted/preserve) from invalid input and from a supported value.
- Model supported effort values separately from an opaque snapshot value so API validation rejects explicitly supplied unknown values while hydration and omission can preserve an unknown value.
- Do not use a generic `|| "high"` fallback.
- Export stable serialization helpers for API payloads, database values, localStorage keys, and test fixtures.

#### `src/interface/home/ComposerPreferencesManager.ts` — create

- Implement the browser-local per-model effort preference manager as the only owner of localStorage reads/writes for this feature.
- Use a versioned canonical key such as `omni-composer-effort:v2:<canonical-model>`.
- Read in deterministic order: canonical v2 key, exact legacy worker/model key, known legacy model aliases, then the configured default.
- Do not delete legacy keys. A successful read-through may write the canonical v2 key, but migration must be idempotent.
- Treat malformed JSON, invalid values, unavailable storage, quota errors, and storage access exceptions as recoverable; return the stable default without breaking the composer.
- Expose explicit methods for “user selected effort” and “load effort for model.” Hydration/catalog reconciliation must not call the write method.
- Model recall must be distinguishable from explicit effort selection: loading a model’s remembered effort may update the draft, but it must not write localStorage or mark the per-model preference as newly selected.
- Add no separate React state cache; the manager owns the preference map and publishes changes through the existing manager subscription convention.

#### `src/interface/home/constants.ts`

- Replace duplicated effort literals with the shared canonical values while preserving the existing display ordering and labels.
- Retain the legacy key constants only as migration inputs, not as the new write target.
- Keep catalog/model option behavior unchanged outside the persistence fix.

#### `src/interface/home/types.ts` and `src/shared/home-types.ts`

- Extend existing run/composer/settings types with canonical model/effort values, `settingsRevision`, submission identity, and dirty-field metadata as appropriate.
- Keep transport types explicit about optional fields so omitted values cannot be confused with invalid or empty values.
- Avoid persisting translated UI copy or display labels in server/database state.

### Client state, hydration, and submit capture

#### `src/interface/home/HomeUiStateManager.ts`

- Add field-level dirty ownership and the last-applied run settings revision.
- Add explicit methods for user model selection, user effort selection, authoritative run hydration, optimistic submit capture, acknowledgement, failure rollback/reconciliation, and run-switch reset.
- Ensure user selection marks only the changed field dirty and calls `ComposerPreferencesManager` only for an explicit effort selection.
- Make model selection an atomic manager transition: mark model dirty, synchronously load the target model’s remembered/default effort, and give the recalled effort local draft ownership (`model_recall`) so delayed server hydration cannot overwrite it before submission. This recall must not write localStorage; only a direct effort selection uses the explicit-user write path.
- Ensure run hydration applies only newer authoritative values to clean fields.
- Ensure successful acknowledgement clears only matching submitted dirty fields and leaves later edits intact.
- Keep the per-run draft map keyed by run id (and a separate new-conversation key), including unsent settings and field provenance, so switching runs and switching back cannot leak or discard a local draft.
- Keep global default state separate from selected-run hydration.

#### `src/interface/home/utils.ts`

- Replace `resolveComposerEffortLabel`’s low/medium/high-only logic with the shared parser/normalizer so `extra high` and `max` survive hydration.
- Update optimistic created-run snapshots to include model, effort, and revision when available; do not let partial optimistic objects overwrite known fields.
- Tag optimistic snapshots with submission/message identity and the captured settings revision (or an explicit pending revision marker) so stale HTTP responses cannot supersede newer acknowledged state.
- Keep utility functions pure and free of localStorage side effects.

#### `src/interface/home/useRunSelectionEffects.ts`

- Remove or narrow the once-per-run hydration guard at `hydratedRunSelectionId`. A one-time guard cannot safely handle a newer snapshot, reconnect, revisit, submit acknowledgement, or resync.
- Route each incoming run snapshot through the manager’s revisioned, field-level merge method.
- Select or initialize the newly selected run’s keyed draft without clearing existing values, provenance, dirty flags, or field versions; clear them only through matching acknowledgement, explicit reset/abandon, or draft deletion. Do not change global per-model defaults during selection.
- Add coverage for revisiting a run, receiving a newer snapshot after selection, and receiving a stale snapshot after a newer one.

#### `src/interface/home/useHomeLifecycle.ts`

- Remove the effect-order race where model-change handling writes the selected effort under the new model before the load-for-model effect runs.
- Load the target model’s remembered effort before committing the model-change state, or use an explicit manager transition that atomically selects the model and resolves its remembered effort.
- Write global per-model effort only from the explicit user effort-selection path. Model changes, run hydration, catalog changes, and server events must not write it.
- Preserve stable fallback behavior when no preference exists for the target model.
- Keep unrelated lifecycle behavior unchanged.

#### `src/interface/home/useHomeMutations.ts`

- Capture an immutable `{model, effort, worker, account, submissionId, expectedSettingsRevision}` snapshot synchronously at the beginning of each submit/continue/steer/retry/queue mutation. Read the expected revision from that run’s authoritative baseline, not an optimistic pending revision; capture it before attachment upload or any other asynchronous work.
- Build the request and optimistic update from that captured object, never from mutable Home manager state after asynchronous work begins.
- Send `expectedSettingsRevision` for every existing-run request and `null` for initial creation. On a typed conflict, update the authoritative baseline from the response while preserving newer dirty fields; do not automatically resubmit the stale pair.
- Carry the pair through message creation, queued messages, interruptions, and retry paths.
- Reconcile HTTP acknowledgements and failures through manager methods so field-level dirty ownership is respected.
- Do not persist unsent edits server-side or accidentally update global defaults from a mutation response.

#### `src/interface/home/EventStreamStateManager.ts`, `src/interface/home/ComposerContainer.tsx`, `src/components/home/ConversationComposer.tsx`, and `src/interface/home/HomeApp.tsx`

- Route model/effort changes through explicit manager callbacks with source information (`user` versus `hydration`/`server`).
- Render canonical values through the existing i18n boundary and preserve all existing labels/aria text in locale files.
- Subscribe components to the manager snapshot so replays/resyncs and acknowledgement merges re-render correctly.
- Do not add component-local persistence or a second event-to-state reconciliation layer.

### Server persistence and accepted-message flow

#### `src/server/db/schema.ts` and `src/server/db/index.ts`

- Add the smallest schema/migration change needed for a monotonic run settings revision if the existing schema has no suitable revision.
- Update both the initial `CREATE TABLE` definition and the additive startup migration for `runs.settings_revision INTEGER NOT NULL DEFAULT 0`, with existing rows backfilled to `0` and no destructive downgrade.
- Add the accepted-turn snapshot columns listed above to the initial `messages` and `queued_conversation_messages` definitions and their additive migrations. Define nullability: legacy rows and intentional automatic/provider-default model or effort selections may be null; explicit accepted values carry canonical values and the accepted revision. Preserve existing alias strings in legacy rows until they are read/canonicalized; do not rewrite unrelated history in this task.
- Keep model and effort stored as stable protocol values, not translated labels.
- Make the revision update atomic with the accepted settings mutation. Document the migration/default for existing runs.
- Add migration tests for a fresh database, a pre-change database, repeated initialization, legacy alias values, and rollback of a failed accepted-turn transaction.
- Do not introduce a sibling conversation-content persistence mechanism.

#### `src/server/conversations/create.ts`

- Validate and canonicalize initial model/effort settings.
- Persist the initial run settings and revision before/with the message acceptance boundary used by the current create flow.
- Ensure the worker launch receives the same effective effort that is recorded on the run.
- Include model, effort, and revision in the created-run response/snapshot so the client does not need to infer them.
- Store the initial user message’s immutable submitted settings snapshot and idempotency identity along with the run revision 1 baseline.

#### `src/server/conversations/send-message.ts`

- Refactor `applyWorkerPreferenceForMessage` and adjacent logic so model/effort persistence is independent of whether a worker preference is supplied or resolved.
- Validate supplied fields, distinguish omitted fields, and update only supplied canonical values.
- Capture the submitted pair, `submissionId`, and `expectedSettingsRevision` before any asynchronous worker/catalog work can observe later UI changes.
- Apply validation, accepted-message snapshot insertion, run settings update, and revision increment atomically according to the exact transaction boundary documented above. Use a conditional revision update/serialization strategy and return the committed revision and accepted snapshot in the response.
- Look up `submissionId` across accepted message and queue representations before validation/CAS. Make duplicates idempotent, returning the original snapshot and current disposition without a second event/revision. Never use a new random id as a fallback for a retried accepted request when the original identity is available.
- Emit a typed `conversation.settings.updated` event only after the database commit, containing run id, accepted message/queue id, previous values, next values, revision, source (`initial`, `user_message`, `queued_message`, `retry`, or equivalent stable enum), and `changedFields` (which may be empty when an accepted turn preserves the same effective pair). If event publication fails, the committed state must still appear in the next authoritative snapshot.
- Emit a stable `error.surfaced` event for invalid settings or persistence conflicts; avoid silent catch/early-return paths.

#### `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, and `src/server/runs/recovery.ts`

- Audit every continuation, queue, interruption, retry, restart, and reattach path for model/effort propagation.
- Preserve the accepted run settings when a request omits fields.
- Carry immutable submitted settings in the queue/retry/message snapshot columns; never derive an old turn’s settings from the current run row or read mutable frontend state.
- Enqueue advances the run once; delivery/retry uses the queue’s captured pair and revision without advancing or overwriting the newer run baseline. Queue-to-message conversion preserves `submissionId`; cancellation retains the already-accepted run settings.
- Ensure recovery/recreation does not reset effort to `high` when the stored value is `extra high` or `max`.
- Emit named decision events for recreate/reattach/refuse/fail branches touched by the settings reconciliation.

### Snapshot, event, and replay ordering

#### `src/server/events/named-events.ts`

- Add typed payloads for settings-update and any newly visible rejection/conflict event.
- Add stable error codes for invalid/unsupported settings and settings revision conflicts where needed.
- Keep event subjects explicit (`runId`, `conversationId`, and relevant worker id when present).

#### `src/server/events/persisted-snapshot.ts`, `src/server/events/run-snapshot-fields.ts`, and `src/server/conversations/sync.ts`

- Include model, effort, and settings revision in full and partial run snapshots.
- Treat omitted fields as no-ops during snapshot construction/merge.
- Preserve the current content of `run-snapshot-fields.ts` if it is already an untracked user file; modify only the fields necessary for this plan.
- Ensure sync/reconnect snapshots represent the latest authoritative revision and do not reconstruct effort through a high-only label mapping.
- Include the accepted-turn snapshot identity where the client needs to reconcile acknowledgement; do not allow a full snapshot with a newer event id but older settings revision to overwrite the settings baseline.

#### `src/interface/home/EventStreamStateManager.ts`

- Merge settings-update events and run snapshots through one revision comparison path.
- Ignore stale replayed or out-of-order settings updates.
- Use the existing `Last-Event-ID`, ring-buffer replay, `stream.resync_required`, and `GET /api/events?snapshot=1` bootstrap contract. Do not add a parallel settings event stream.
- Ensure a newer acknowledged state cannot be overwritten by an older optimistic response or a replayed full snapshot.

### Tests

#### `tests/app/composer-preferences.test.ts` — create

Cover canonicalization, aliases, unknown/invalid values, versioned keys, legacy read-through precedence, idempotence, malformed JSON, unavailable storage, quota failures, and no legacy-key deletion.

#### `tests/app/home-lifecycle.test.ts`, `tests/app/home-ui-state-manager.test.ts`, `tests/app/home-utils.test.ts`, and `tests/app/run-selection-effects.test.ts`

Add focused tests for:

- `extra high` and `max` hydration.
- Switching from model A to model B loads B’s remembered effort before commit.
- Switching back restores A’s effort.
- Explicit effort changes write only the selected model’s preference.
- Run hydration/catalog updates/server events do not write global defaults.
- Dirty model and dirty effort fields merge independently with authoritative snapshots.
- Dirty run-A settings survive A → B → A switching and a newer server snapshot for A; dirty fields survive while clean fields update.
- A stale snapshot cannot overwrite a newer revision.
- Reapplying an equal revision with the same `submissionId` is idempotent; equal revision with conflicting contents surfaces an invariant violation rather than resolving by arrival order.
- Revisiting a run and reconnecting do not rely on a one-time hydration guard.
- Acknowledgement after a second user edit clears only the first submission’s matching field.
- Failed submissions preserve the correct draft and do not corrupt the per-model default.
- Fresh manager/window instance reloads per-model preferences from storage; unknown server effort values remain opaque in run state but are not written to local per-model preferences.
- Automatic worker/model and legacy-null-setting paths preserve intentional nulls without treating them as omitted or unknown.

#### `tests/api/conversations-route.test.ts`, `tests/api/conversation-messages-route.test.ts`, and `tests/server/conversations/create-steer.test.ts`

Add server/API coverage for:

- Initial run persistence of all supported effort values.
- Continuation with `extra high` and `max` preserving the selected pair.
- Omitted fields preserving existing values.
- Invalid values returning a typed failure and emitting `error.surfaced`.
- Model/effort persistence when worker type is omitted, unchanged, or changed.
- Atomic accepted-message capture and revision increment.
- `expectedSettingsRevision` captured before attachment upload; a baseline advance during upload conflicts without inserting a message/queue row or changing settings.
- Migration from a pre-change database, fresh initialization, repeated initialization, and non-destructive rollback behavior.
- Transaction rollback for every enumerated acceptance branch; prove no run settings update or settings event occurs when message/queue acceptance fails later.
- Duplicate `clientMessageId`/submission identity and repeated retry behavior; prove one logical accepted turn has one snapshot and one revision.
- Duplicate `submissionId` while pending, after delivery, after cancellation/failure, and after queue-to-message conversion returns the original disposition without a second event or revision.
- Concurrent submissions with stale expected revisions; prove deterministic conflict/winner behavior and no lost update.
- Retry/queue/interrupt/steer propagation and failure behavior.
- Queue a turn, change the current run settings, then deliver/retry the queued turn; verify delivery uses the queued turn’s captured pair.
- Queue cancellation retains the accepted run settings under the chosen contract.
- Response/snapshot inclusion of model, effort, and revision.

#### `tests/ui/composer-shell.test.ts`

Verify the visible composer offers the latest accepted settings after the agent turn, keeps `Extra High`/`Max` labels intact, and does not show another run’s settings after switching runs.

#### `tests/lifecycle/scenarios/composer-settings-persistence.test.ts` — create

Drive the real HTTP/SSE control plane to cover the end-to-end journey:

1. Start a run with model A / `extra high`.
2. Submit a user turn and wait for the agent turn to finish.
3. Read the next composer snapshot and verify model A / `extra high`.
4. Switch to model B, select a different effort, reload/reconnect, and verify B’s value.
5. Switch back to A and verify A’s value.
6. Reconnect and verify naturally occurring HTTP/SSE ordering converges on the newest revision; cover artificial delayed/out-of-order frame permutations in deterministic manager/event tests rather than injecting faults into the lifecycle server.
7. Reconnect with Last-Event-ID and force snapshot bootstrap/resync; verify settings survive.
8. Restart/reattach the run through the existing lifecycle mechanism and verify `extra high`/`max` survives recovery.

Add deterministic manager/event tests for every permutation of HTTP acknowledgement, settings SSE event, full snapshot, reconnect replay, and a newer local edit. Keep synthetic frame reordering in unit tests; the lifecycle scenario must use real reconnect/restart/resync behavior without server fault injection.

Follow repository guidance: use `pnpm test:lifecycle`, do not add server fault injection, and clean up any test conversations and persisted artifacts before finishing.

### Documentation and generated artifacts

#### `docs/architecture/lifecycle-observability-and-testing.md` and/or the relevant settings protocol documentation

- Update only if the new revisioned settings event/merge contract is not already documented.
- Document ownership, omission semantics, revision ordering, and recovery expectations.

#### `.gitignore` and repository test configuration

- Confirm generated lifecycle artifacts, localStorage fixtures, screenshots, logs, and temporary run data are covered by existing ignore rules.
- If a new generated artifact is required and is not already ignored, add the narrowest ignore entry. Do not ignore source, tests, or the plan.

## Implementation sequence (TDD)

Each step is a reviewable checkpoint. Before writing production code for a step, write or extend its focused failing tests, then implement the smallest change that makes those tests pass.

- [ ] **1. Baseline and contract inventory.** Inspect the current schema, API request/response types, event snapshot types, Home manager transitions, and dirty worktree. Confirm whether an existing revision can be reused. Record exact current migration, transaction, idempotency, and event conventions before editing.
- [ ] **2. Shared canonical protocol and persistence schema.** Add `src/shared/composer-preferences.ts`; finalize supported-versus-opaque effort types, nullability for automatic/provider-default selections, the stable `submissionId` uniqueness/lookup contract, and `expectedSettingsRevision` transport semantics; then add `settings_revision` and accepted-turn snapshot columns to initial schema plus additive migrations and write the canonical/migration tests first.
- [ ] **3. Server atomic acceptance.** Implement a shared accepted-turn transaction/idempotency helper, or an equally explicit branch-specific contract, before modifying individual paths. Test create, normal message, supervised/checkpoint, clarification, queue, steer/interrupt, retry, and edit paths with duplicate identity idempotency, compare-and-set/serialization, committed revision responses, post-commit named events, and queue delivery that never rewrites a newer run baseline.
- [ ] **4. Browser per-model preference manager.** Add `ComposerPreferencesManager` and tests for v2 keys, legacy precedence, read-before-write behavior, migration idempotence, explicit-user-only writes, and storage failures.
- [ ] **5. Client per-run field ownership.** Extend `HomeUiStateManager` and selection/lifecycle hooks with per-run drafts, model-recall provenance, independent dirty fields, revision-aware hydration, acknowledgement matching, and explicit user-only global preference writes.
- [ ] **6. Atomic client submission capture.** Update all mutation paths to capture immutable settings before async work, include them in optimistic snapshots, and reconcile success/failure without losing later edits.
- [ ] **7. Event and snapshot ordering.** Update named events, persisted/full/partial snapshots, sync, and event-stream state merge. Add stale/out-of-order/replay/resync tests and prove committed state remains recoverable if event publication fails.
- [ ] **8. UI wiring and i18n audit.** Route callbacks through managers, verify re-render subscriptions, preserve existing locale coverage, and ensure no new user-facing literals are hardcoded.
- [ ] **9. Full verification.** Run focused unit/API/UI tests, then the lifecycle scenario. Inspect event logs and persisted rows for the scenario. Clean up test data. Do not claim completion without recorded passing output.

## Agentic journey testing and approval gate

Before declaring the feature complete, run the lifecycle scenario described above against the already-running app/control plane. This is required because unit tests cannot prove that HTTP acceptance, persistence, SSE replay, reconnection, and the visible composer converge on the same settings.

If the environment cannot safely run the journey, stop at the approval gate and report the exact missing process/endpoint or fixture. Do not start a second server and do not add chaos code to production. After the journey passes, manually verify the visible next-input state for `Extra High` and `Max` in the running UI if the repository’s UI test tooling permits it.

## Verification commands

Run the narrowest commands first, then the broader suites. Use the repository’s package scripts as currently defined; adjust only for the exact test-file conventions discovered during implementation.

```bash
pnpm exec vitest run tests/app/composer-preferences.test.ts tests/app/home-lifecycle.test.ts tests/app/home-ui-state-manager.test.ts tests/app/home-utils.test.ts tests/app/run-selection-effects.test.ts
pnpm exec vitest run tests/api/conversations-route.test.ts tests/api/conversation-messages-route.test.ts tests/server/conversations/create-steer.test.ts tests/ui/composer-shell.test.ts
pnpm test:lifecycle -- tests/lifecycle/scenarios/composer-settings-persistence.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint src/shared/composer-preferences.ts src/interface/home/ComposerPreferencesManager.ts
git diff --check
```

Use existing server processes where available. If a command is not a valid repository script, use the closest existing script and document the exact command/output rather than inventing a new harness.

## Acceptance checklist

- [ ] Starting with model A / `Extra High`, completing a turn, and continuing offers model A / `Extra High`.
- [ ] `Max` survives start, continuation, reload, reconnect, resync, and recovery.
- [ ] Switching models recalls each model’s own last explicit effort.
- [ ] Model changes do not overwrite the target model’s remembered effort before it is loaded.
- [ ] Run selection and server hydration do not overwrite the global per-model default.
- [ ] Dirty model and effort fields reconcile independently.
- [ ] The submitted model/effort pair is immutable for the accepted message/queue/retry operation.
- [ ] Omitted values preserve authoritative settings; invalid values fail visibly and observably.
- [ ] Worker/account changes do not erase model/effort.
- [ ] Stale optimistic responses, stale full snapshots, out-of-order events, replay, resync, and restart cannot downgrade settings.
- [ ] All changed server decision branches emit named events and user-visible failures emit typed `error.surfaced` events.
- [ ] All new UI strings, if any, are present in every locale and rendered with `t()`.
- [ ] No parallel persistence stream, frontend cache, server fault-injection path, branch, worktree, or unrelated refactor was added.
- [ ] Focused tests, API/UI tests, TypeScript/lint checks, and the lifecycle journey pass.
- [ ] Test conversations and persisted artifacts are cleaned up.
- [ ] The plan’s implementation remains within the existing file responsibilities and does not create an oversized catch-all module.

## Files intentionally left alone

- Worker conversation JSONL persistence and `appendWorkerEntry`/`WorkerEntriesManager` rendering; this feature concerns run settings, not worker transcript content.
- Broad worker/account/conversation redesign.
- Unrelated event protocol changes.
- Deletion or destructive migration of legacy localStorage keys.
- New server fault-injection or chaos paths.
- Unrelated UI, styling, or copy refactors.

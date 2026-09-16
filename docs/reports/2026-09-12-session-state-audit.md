# Session state audit — 12 September 2026

The title and effort problems have concrete causes. Several parts of the app can replace the same value, but they do not consistently distinguish a user edit from a default, an old response from a new one, or the requested worker settings from the settings actually running.

This report covers 17 findings in session metadata, composer selections, live updates, settings, message delivery, shared subscriptions, and handoffs. It is the requested diagnosis before fixes. No application code was changed. This is a review of the current checkout, including existing uncommitted changes; it is not a claim that every state bug in the repository has been found.

Evidence labels below mean:

- Reproduced: a controlled check executed the relevant existing manager or function and demonstrated the behavior. These were in-memory checks, not changes to real conversations.
- Source-confirmed: the implementation contains the stated failure path; the complete browser or provider sequence has not been reproduced.
- Conditional risk: the code permits a failure under the stated conditions, but its occurrence in a real session has not been established.

P1 means fix first because the issue can overwrite intent, lose edits, misapply execution settings, or repeat work. P2 means fix next. There are 10 P1 findings and 7 P2 findings.

## Findings

### 1. P1 — Background title updates can overwrite a manual rename

Source-confirmed; directly relevant to the reported title problem. The rename endpoint saves only `runs.title`. The background title adopter writes that same column whenever a provider supplies a different acceptable title. There is no saved title owner or manual-rename flag. Its read and write are also separate, so a rename made between them can be overwritten.

The database confirms that `title` is the only title-related field. The repair routine also rewrites titles matching its leak heuristics without knowing whether a user deliberately chose them.

Fix: persist title ownership and a revision. Manual rename must atomically claim ownership. Every automatic writer, including repair and generation, must check that ownership in its SQL update. Emit a named event for manual renames as well as automatic changes. Existing titles cannot all be classified reliably after the fact; preserve ambiguous ones rather than guessing they are automatic.

Evidence: [rename endpoint](/Users/masterman/NLP/omniharness/src/runtime/http/routes/runs.ts:385), [automatic overwrite](/Users/masterman/NLP/omniharness/src/server/conversations/agent-session-title.ts:200), [repair](/Users/masterman/NLP/omniharness/src/server/conversations/agent-session-title.ts:254), [schema](/Users/masterman/NLP/omniharness/src/server/db/schema.ts:21).

### 2. P2 — Competing title sources have inconsistent precedence

Source-confirmed, with conditional triggers. Each worker snapshot can update the parent conversation title. There is no check that this worker owns the conversation title. A usable stream title wins immediately, so a later custom title in the provider's store is not consulted. Different workers or sources can therefore compete.

The prompt-echo filter recognizes exact matches and prefixes ending in an ellipsis. A shortened prompt without an ellipsis can pass. This is a possible route back to the beginning of a prompt; I have not identified which provider payload caused your particular flip. The database contains 20 conversations with multiple workers, but that count does not prove title contention occurred in those conversations.

Fix: define one title-owning worker and explicit source precedence. Preserve the distinction between a provider's custom title and generated title when reading it. Check known fallback formats without rejecting legitimate short summaries indiscriminately.

Evidence: [source selection](/Users/masterman/NLP/omniharness/src/server/workers/snapshots.ts:170), [prompt filter](/Users/masterman/NLP/omniharness/src/server/conversations/agent-session-title.ts:71), [provider title extraction](/Users/masterman/NLP/omniharness/src/server/conversations/agent-transcript-title.ts:85).

### 3. P1 — Session settings are not stored with each session's composer draft

Reproduced at the manager boundary; browser restoration path source-confirmed. Text and attachments are saved per session, but model, effort, worker, and account selections are global fields. Switching sessions preserves the message draft but loses unsent setting changes when the selection effect reloads the saved run preferences.

The controlled manager check selected Max in A, Low in B, then returned to A; the global effort was still Low. The React effect can subsequently restore A's persisted effort, but cannot restore an unsent choice because it was never saved with A's draft. When a run has no model or effort preference, hydration skips that field, allowing the previous session's value to carry across.

Fix: store the entire composer selection with the draft under the session ID, with a separate new-conversation draft. Switch the selected session and its composer state in one manager update. Track which fields the user has changed since the last server acknowledgment.

Evidence: [global selection fields](/Users/masterman/NLP/omniharness/src/interface/home/HomeUiStateManager.ts:90), [draft switching](/Users/masterman/NLP/omniharness/src/interface/home/HomeUiStateManager.ts:262), [conditional restoration](/Users/masterman/NLP/omniharness/src/interface/home/useRunSelectionEffects.ts:325).

### 4. P1 — Session hydration and effort defaults can overwrite each other

Source-confirmed. The session restoration effect marks a run hydrated after the first run record it sees. It does not require a fresh snapshot for that run. Later server changes for the same selected run are ignored by the `hydratedRunSelectionId` early return.

A separate effect reads effort from local storage whenever the worker/model pair changes. Its special protection for session preferences runs only once per selected session. A later model normalization can therefore replace session effort with a browser default. Local-storage keys identify worker/model pairs, not conversations.

Fix: make one manager decide when to hydrate, preserve user edits, and accept newer saved preferences. Use browser defaults only when initializing an unset selection. Distinguish automatic catalog refreshes from deliberate model changes.

Evidence: [one-time hydration](/Users/masterman/NLP/omniharness/src/interface/home/useRunSelectionEffects.ts:308), [effort restoration and persistence](/Users/masterman/NLP/omniharness/src/interface/home/useHomeLifecycle.ts:587), [storage key](/Users/masterman/NLP/omniharness/src/interface/home/constants.ts:203).

### 5. P1 — Model refresh and startup code silently replace chosen models

Startup conversion reproduced; catalog behavior source-confirmed. `resolveSavedComposerModel("claude-opus-5")` returns `gpt-5.6-sol`. This is an explicit model replacement on startup.

Separately, the model normalization effect selects the first available option whenever the selected model is absent. It does not distinguish a complete catalog from fallback options or a refresh still in progress. A temporarily missing model can become a permanent local selection change, which then triggers the effort-default behavior in finding 4.

Fix: remove the cross-provider saved-model substitution. Keep the selected model while discovery is incomplete. If a complete catalog establishes that the model is unavailable, surface that state and resolve it deliberately rather than silently choosing the first option.

Evidence: [startup substitution](/Users/masterman/NLP/omniharness/src/interface/home/utils.ts:1612), [catalog normalization](/Users/masterman/NLP/omniharness/src/interface/home/HomeApp.tsx:850), [fallback catalog](/Users/masterman/NLP/omniharness/src/interface/home/utils.ts:1626).

### 6. P1 — An old HTTP snapshot can overwrite newer live state

Reproduced. The event cursor rejects old SSE updates, but the polling path ignores whether advancing the cursor succeeded and applies the response anyway. A delayed poll with cursor 10 overwrote a live update with cursor 20 in the controlled check.

The state manager also treats server source as sufficient authority to replace run records. Its timestamp comparison is bypassed for server updates. The checksum shortcut protects a local rename only if the entire incoming snapshot is unchanged. Changing an unrelated account in the test made the stale title overwrite the local rename.

This can affect titles, status, preferences, and other snapshot fields. The existing generation guard correctly blocks responses after a connection is stopped; it does not solve ordering within an active connection.

Fix: track snapshot freshness separately from the transport's last received event. Reject or safely merge polls overtaken by newer updates; account for scoped frames and the server's pre-build snapshot anchor. Maintain pending edits per field until an explicit acknowledgment or failure. A checksum is an equality check, not an ordering rule.

Evidence: [poll response application](/Users/masterman/NLP/omniharness/src/interface/home/LiveEventConnectionManager.ts:465), [server merge bypass](/Users/masterman/NLP/omniharness/src/interface/home/EventStreamStateManager.ts:201), [checksum shortcut](/Users/masterman/NLP/omniharness/src/interface/home/EventStreamStateManager.ts:45).

### 7. P1 — Failed mutations restore the whole app to an old snapshot

Source-confirmed. Move, delete, and archive capture the complete event state and restore it on failure. If live updates or another successful mutation arrive in the meantime, the failed operation overwrites those changes too. This is a rollback of unrelated state, not just the failed action.

Rename and move completion also clear shared dialog state without checking whether the user has since opened another dialog. Delete/archive failure restores old rename fields with the same problem.

Fix: undo only the affected operation's fields or records, and only while that operation still owns the edit. Give dialogs operation IDs so an old completion cannot close or replace a newer editor.

Evidence: [rename and move](/Users/masterman/NLP/omniharness/src/interface/home/useHomeMutations.ts:213), [delete rollback](/Users/masterman/NLP/omniharness/src/interface/home/useHomeMutations.ts:299), [archive rollback](/Users/masterman/NLP/omniharness/src/interface/home/useHomeMutations.ts:357).

### 8. P1 — A settings refresh erases unsaved edits

Reproduced. Every settings query response calls `SettingsDraftManager.hydrate`, which replaces both baseline and draft and clears all dirty keys. A refresh while editing discards the edits. The settings query does not disable the normal focus-refetch behavior.

The controlled check changed a field, hydrated the old server value, and observed the old value with zero dirty fields.

Fix: refresh the saved baseline while preserving dirty fields. Treat explicit discard and initial hydration as separate operations. Query functions should return data; the manager should decide whether and how that response may update an open draft.

Evidence: [query side effects](/Users/masterman/NLP/omniharness/src/interface/home/useHomeQueries.ts:81), [destructive hydration](/Users/masterman/NLP/omniharness/src/interface/home/SettingsDraftManager.ts:35).

### 9. P1 — Settings save acknowledges values that were never sent

Reproduced using the existing manager calls in the save handler. Save captures a payload, waits for the network, then reads the current draft and marks that entire draft saved. Changes typed during the request can be marked saved even though the server never received them. The dialog then closes.

In the check, the submitted value was `submitted`; the acknowledged baseline became `typed while saving`, with no dirty fields. `markFieldsSaved` also overwrites a newer draft value when acknowledging an older save.

Fix: return the exact submitted fields and operation revision from the save request. Update the baseline from that acknowledgment, preserve later edits, and leave them dirty. Only close a dialog whose submitted draft still owns the completion.

Evidence: [save handler](/Users/masterman/NLP/omniharness/src/interface/home/useHomeMutations.ts:178), [acknowledgment methods](/Users/masterman/NLP/omniharness/src/interface/home/SettingsDraftManager.ts:77).

### 10. P2 — Overlapping preference saves can undo newer choices

Reproduced. Planning-review preference saves remember a previous value, then restore it unconditionally on failure. The check requested 2 rounds, then 3 rounds; the newer save succeeded, the older save failed, and the visible value reverted to 1.

The shared `isSaving` boolean also becomes false when one request finishes while another remains pending. Workflow settings mutations have similar unconditional rollback behavior.

Fix: order writes per setting or attach operation revisions to them. Old failures must not undo newer edits. Track pending operations accurately and surface save failure in the UI rather than only in the console.

Evidence: [planning preferences](/Users/masterman/NLP/omniharness/src/interface/home/PlanningReviewPreferencesManager.ts:53), [workflow settings mutations](/Users/masterman/NLP/omniharness/src/interface/home/useHomeMutations.ts:189).

### 11. P1 — Reported worker effort can disagree with the running provider

Source-confirmed; provider execution not reproduced. Effort-setting failure during startup is caught and written to stderr, after which startup continues. The requested effort remains recorded. If the provider accepts the setting but omits `configOptions` from its response, the code reads effective effort from the pre-change configuration.

Later configuration notifications are appended to output but do not update `record.effectiveEffort`. The explicit configuration API has the same gap. Model/mode status needs the same ownership review because those notifications also carry execution state.

Fix: separate requested, pending, effective, and rejected settings. Update effective values from provider configuration notifications and acknowledged changes. If the provider cannot confirm a value, keep it unknown and surface the mismatch. Do not report a requested value as proof that it is running.

Evidence: [startup effort handling](/Users/masterman/NLP/omniharness/src/server/agent-runtime/manager.ts:1863), [configuration API](/Users/masterman/NLP/omniharness/src/server/agent-runtime/manager.ts:2089), [notification handling](/Users/masterman/NLP/omniharness/src/server/agent-runtime/acp/runtime-client.ts:519).

### 12. P2 — Worker-setting comparisons mishandle unknown values and aliases

Source-confirmed, with database evidence. A model or effort change is recognized only when both the current and requested values are nonempty. An unknown current effort therefore does not trigger reconciliation with an explicit request. The database has 312 workers with a null launch effort whose run has an explicit effort preference; these are historical candidates, not 312 proven failed changes.

Comparison also lowercases without normalizing aliases. There are 37 runs and 39 workers storing `extra high`, alongside `xhigh` values. An equivalent choice can look like a change and unnecessarily recreate a worker. Clearing an explicit account to Auto similarly does not count as an account change.

Fix: use one canonical representation at persistence and comparison boundaries. Distinguish unknown from equal and an omitted setting from an explicit reset. Reconcile against observed provider state where available. Define whether Auto affects this worker immediately or its next allocation, and communicate that consistently.

Evidence: [comparison](/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts:184), [recovery selection](/Users/masterman/NLP/omniharness/src/server/workers/launch-selection.ts:33), [normalizer](/Users/masterman/NLP/omniharness/src/shared/reasoning-effort.ts:6).

### 13. P2 — Sending a message can change settings before the send is accepted

Source-confirmed. `sendConversationMessage` persists worker preferences before checking that a plan review permits the message or that a usable worker exists. A rejected send can therefore still change saved session preferences.

The preference helper also treats absent fields inconsistently: absent effort preserves the old value, while absent model/account can clear them when a worker type is supplied. Model/effort updates without a worker type are ignored. These differences matter for API clients and replayed requests.

Fix: validate send admissibility before committing preference changes. Define a typed patch contract for omitted, explicit, and reset values. Tie accepted message settings to the accepted operation rather than partially committing a request that later fails.

Evidence: [preference persistence](/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts:1189), [send ordering](/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts:1541).

### 14. P1 — Retrying an accepted message can create a second message

Source-confirmed; an existing test explicitly expects this behavior. When a supplied client message ID already exists, `resolveUserMessageId` generates a new ID. If the first send persisted but its response was lost, retrying that same request creates another user message instead of recovering the result of the first one. Depending on the delivery path, this can repeat agent work.

Fix: make message submission idempotent under the run and client message ID. Matching retries should return or resume the existing operation; reuse with different content or ownership should be rejected. Persist delivery progress so partial failures can recover safely.

Evidence: [ID replacement](/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts:1162), [test expecting replacement](/Users/masterman/NLP/omniharness/tests/server/conversations/client-message-id.test.ts:59).

### 15. P2 — Shared selectors can return data for the previous context

Source-confirmed. The client-side `useManagerSelector` cache keys only on the manager's state object. If a component changes its selector because its project, worker, or entry changed, the hook can return the previous selection while the manager state is unchanged. The server-side version already checks selector identity; the client version does not.

Affected callers include project workspace controls and worker-entry content. This can show information for the previous context until another manager update happens. Existing selector tests cover server rendering, not this client transition.

Fix: include selector identity in the client cache, and ensure changes to the manager or equality function cannot reuse an invalid selection. Add a client rerender test that changes only the selected context.

Evidence: [cache](/Users/masterman/NLP/omniharness/src/lib/use-manager-snapshot.ts:32), [project-dependent selector](/Users/masterman/NLP/omniharness/src/components/home/BranchWorkspaceButton.tsx:120), [entry-dependent selector](/Users/masterman/NLP/omniharness/src/interface/home/WorkerEntryContentUrlManager.ts:129).

### 16. P2 — Scoped snapshots cannot remove obsolete child records

Reproduced at the merge boundary. For a selected run that remains present, partial catalog merging unions old and incoming workers, plans, and sessions. A worker absent from the new selected-run frame survives in the client. The controlled check reproduced that retention.

The server sends the selected run's workers but marks only the overall catalog partial. The protocol does not clearly declare completeness for each child collection, so the client cannot safely infer which missing records were removed. A later complete catalog can correct this; that still leaves stale state between updates.

Fix: declare collection completeness per run or send explicit removals. Replace only the declared complete scope and retain unrelated runs. Do not solve this by treating every absent item as deleted.

Evidence: [merge](/Users/masterman/NLP/omniharness/src/interface/home/EventStreamStateManager.ts:154), [scoped server frame](/Users/masterman/NLP/omniharness/src/runtime/http/routes/events.ts:655).

### 17. P2 — Handoff loading can overwrite edits made after opening the dialog

Conditional risk. Opening the dialog starts `getActive`. The generation guard protects against another open or close, but changing the target/model/effort/account does not change that generation. If an existing handoff returns after an edit, it replaces those new selections. Controls are not disabled for this initial lookup.

Fix: capture an edit revision as well as the dialog generation. Apply initial loading results only to untouched fields, or finish loading before enabling edits. Preserve the existing protections around prepare and launch.

Evidence: [initial lookup and setters](/Users/masterman/NLP/omniharness/src/interface/home/HandoffManager.ts:48), [control availability](/Users/masterman/NLP/omniharness/src/components/home/CrossCliHandoffDialog.tsx:29).

## State-management changes I recommend

The app already has managers. The missing piece is consistent ownership and ordering across them. Replacing the state library would not fix these write paths.

1. One manager owns session selection and drafts. Include model, effort, account, and worker together with the message draft. Keep server preferences, user edits, and observed worker settings distinct.
2. Version mutable records and operations. Use revisions for titles and preferences, operation IDs for requests and dialogs, and explicit snapshot scope/freshness for live state. Wall-clock timestamps and checksums cannot substitute for all of these.
3. Keep server state plus a small pending-edit layer. A pending rename should override only its title field. A failed archive should restore only that operation's affected record. Remove whole-app rollback snapshots.
4. Use the existing worker stream for provider evidence. Reduce configuration events into effective runtime state without adding another transcript or persistence channel.
5. Centralize normalization and capability checks. Share effort identifiers and model/account reset semantics across the composer, send API, startup, recovery, and provider status. The UI currently cannot restore `none`, `minimal`, or `ultra`; those should be supported only where the actual provider catalog allows them, rather than silently inherited from another session.

## Optimizations worth doing after correctness

- Stop rereading all prompt text to reconsider an unchanged title. Every title candidate currently queries all user messages and worker prompts before checking whether the stored title already matches. Check ownership first, remember the processed candidate with its source revision, and bound any cache. The transcript-title cache currently has no eviction policy.
- Preserve object identity for unchanged records. `HomeApp` subscribes to the full event state, so changing one record replaces arrays that many derived views depend on. Normalize records by ID, retain unchanged objects, and subscribe each view to the fields it uses. Fix finding 15 before relying more heavily on selectors.
- Make related manager changes atomic. Selecting a session should publish one coherent selection, not several independent setters followed by effects that repair each other. Batch `SettingsDraftManager.patchFields`, which currently emits once per field.
- Avoid notifications for true no-ops. `StateManager.patch` always creates a new object. `EventStreamStateManager.updateLocal` creates a new object before its identity check, making that check ineffective. Compare the proposed change before notifying subscribers.
- Move housekeeping out of snapshot reads where practical. Snapshot construction currently invokes reconciliation and, in enriched reads, synchronization that can write metadata. Keep recovery observable and reliable, but let reads consume already-produced state where possible. This should be measured before and after; no performance improvement has been benchmarked in this audit.

## Verification and limits

The seven existing test files for event state, live connections, home UI state, settings drafts, lifecycle hooks, selection effects, and mutation ownership passed: 66 tests. The additional in-memory audit executed nine checks, covering stale polling, rename overwrite, scoped worker retention, settings refresh, incorrect save acknowledgment, global effort storage, overlapping preference saves, unsupported effort restoration, and the saved-model substitution. Passing existing tests therefore does not establish that these update sequences are safe.

The database was opened read-only. At inspection time it contained 490 unarchived runs, 37 runs with `extra high`, and 312 workers with missing launch effort despite an explicit run effort. Counts include historical data and do not measure current bug frequency. No live conversations were created, altered, or removed. The test suite used its isolated temporary roots; the custom checks used only in-memory state.

The controlled checks are in [the audit script](/tmp/omniharness-state-audit-2026-09-12.ts). Browser interaction timing and actual provider effort acceptance still need focused reproductions during the fixes. I did not perform an exhaustive lifecycle, security, or whole-repository audit. Existing unrelated workspace changes were left intact.

I would address manual title ownership, session selection ownership, stale snapshots, and narrow rollback first. Settings acknowledgments and message idempotency belong in that first correctness pass as well. Each fix should add the failing event sequence as a regression; lifecycle changes should use the existing HTTP/SSE harness, and frontend changes must pass `pnpm build:interface:web`.

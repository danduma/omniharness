# Conversation UI Regression Lessons

This document records a small but important cluster of conversation UI regressions found in May 2026. The bugs looked cosmetic at first: a repeated "Loading conversation" interruption, cramped mobile composer sizing, loose mobile textarea line spacing, and an icon-only mobile settings control. They were not just cosmetic. They exposed missing frontend invariants around streaming state, mobile verification, and collapsed controls.

The purpose of this document is to make those invariants explicit so future changes do not reintroduce the same class of failure.

Related: `docs/architecture/state-staleness-and-session-lifecycle-lessons.md`
documents the session-list, queue, unread-marker, direct-status, and worker
stream state bugs that can make conversations look duplicated, stuck, unread,
or missing.

## Incidents

### Delayed auto-resume changed the selected conversation

Symptom:

- A user started a new direct-control session in one project.
- The new session appeared correctly.
- A few seconds later, with no user interaction, the UI jumped to an older failed supervisor session in a different project.

Root cause:

- Auto-resume scheduled retries with `setTimeout` for the selected failed run.
- The timer was owned by the page, not by the current selection.
- If the user moved to another run or created a new session before the timer fired, the stale retry could still complete.
- `recoverRun.onSuccess` unconditionally called `setSelectedRunId(data.runId)`, so an old background recovery could steal focus from the user.

Fix pattern:

- Cancel scheduled auto-resume timers for runs that are no longer selected.
- Guard recovery success navigation:
  - `retry` and `edit` may select the returned run only if the recovered source run is still selected.
  - `fork` may select the returned run because it is an explicit user navigation action.
- Treat selected conversation as user-owned state. Background recovery may update data, but it must not change focus unless the initiating run is still current.

Guardrail:

- Any delayed callback, retry, poll, or background mutation that can call `setSelectedRunId` must prove it still owns the current selection.
- Prefer small testable helpers for selection ownership checks; hook timing bugs are otherwise easy to reintroduce.
- A failed or recovering run in another project must never automatically pull the user away from a newly created or manually selected conversation.

Relevant code:

- `src/app/home/auto-resume-selection.ts`
- `src/app/home/HomeApp.tsx`
- `src/app/home/useHomeMutations.ts`
- `tests/app/auto-resume-selection.test.ts`

### Finished direct session showed only the initial user message

Symptom:

- A finished direct-control session was selected from the sidebar.
- The conversation showed only the initial user message, with no agent output and no loading indicator.
- Selecting the same session again several seconds later made the full worker output appear.

Root cause:

- Worker content is loaded from the per-worker JSONL stream, not from the main `messages` table.
- While the stream was being fetched, fallback user messages already counted as Terminal activity.
- `Terminal.isLoading` only changed the empty-state rendering, so a transcript containing just fallback user messages looked complete instead of visibly loading the missing worker stream.
- Snapshot `workerEntrySeqs` hints were also ignored when they arrived before the terminal subscribed to that worker, creating a timing window where the first render had less information than a later reload.

Fix pattern:

- Derive a single deterministic conversation load state from explicit facts:
  - selected-run snapshot loaded,
  - worker stream required,
  - worker stream loaded through the latest known cursor,
  - full conversation loaded.
- Treat a direct worker stream in `idle` with no entries as an initial load until the first fetch resolves.
- Show a loading/pending assistant row when the unified worker stream is loading and no assistant-side entries have been rendered yet, even if fallback user messages are visible.
- Apply selected-run `workerEntrySeqs` hints even before the terminal subscribes, so missed SSE timing does not decide whether old worker output appears.

Guardrail:

- A direct session with a known worker and no loaded worker entries is not a complete transcript; it is a stream-load state.
- Never infer "fully loaded" from a component mount order, elapsed time, or the presence of fallback user messages.
- The UI must call the deterministic load-state helper and render from its booleans; ad hoc loading predicates are how timing bugs return.
- Loading affordances must be visible even when user-message fallback content exists.
- Cursor hints from selected-run snapshots should warm the worker stream manager instead of being dropped because a React component has not mounted yet.

Relevant code:

- `src/app/home/direct-worker-stream-loading.ts`
- `src/app/home/WorkerEntriesManager.ts`
- `src/components/Terminal.tsx`
- `tests/app/direct-worker-stream-loading.test.ts`
- `tests/app/worker-entries-manager.test.ts`
- `tests/ui/terminal-unified-stream-order.test.ts`

### Direct conversations flashed "Loading conversation" while running

Symptom:

- A direct-control session was running normally.
- Every worker-stream refresh could replace the transcript with the full "Loading conversation" state.
- The interruption made the session feel unstable even though the worker was still active.

Root cause:

- `ConversationMain` used `directWorkerStream.isLoaded` as part of the page-level loading gate.
- `WorkerEntriesManager.isLoaded(workerId)` intentionally becomes false while the manager is fetching newly announced worker entries after a `worker.entry_appended` wake-up.
- That is an incremental content refresh, not a conversation bootstrap. Treating it as page readiness caused the terminal to unmount and remount during normal streaming.

Fix pattern:

- Use the full "Loading conversation" gate only for selected conversation snapshot readiness.
- Keep the terminal mounted during worker-stream refreshes.
- If the worker stream is doing its first fetch and has no entries yet, pass that state down as `Terminal.isLoading`; do not replace the whole conversation surface.

Guardrail:

- Never use a leaf stream manager's transient `loading` state to gate the whole conversation page.
- Page readiness and content refresh readiness are separate states.
- Existing transcript content should remain visible during incremental fetches, reconnects, and SSE wake-ups unless the selected conversation itself has changed.

Relevant code:

- `src/components/home/ConversationMain.tsx`
- `src/app/home/WorkerEntriesManager.ts`
- `src/app/home/direct-worker-stream-loading.ts`
- `tests/app/direct-worker-stream-loading.test.ts`
- `tests/ui/conversation-actions.test.ts`

### Mobile composer line spacing was too loose

Symptom:

- The mobile composer textarea had too much vertical space between lines.
- A Tailwind `leading-*` utility alone did not reliably fix the computed mobile line-height.

Root cause:

- The app has text-size scaling utilities in `src/app/globals.css`.
- Those utilities can override broad Tailwind leading utilities in conversation-scoped areas.
- A source-level class check was not enough; the computed mobile CSS still had to be verified in the browser.

Fix pattern:

- Give the composer textarea a component-specific class, `omni-composer-input`.
- Set explicit line-height in CSS:
  - mobile: `20px`
  - desktop and wider: `24px`
- Verify the computed value at a mobile viewport, not only by reading source.

Guardrail:

- For mobile typography bugs, always verify computed style at a real mobile breakpoint.
- Do not assume a Tailwind utility won the cascade when app-wide scaling utilities are present.
- Component-specific sizing or line-height classes are acceptable when global text scaling would otherwise distort a compact control.

Relevant code:

- `src/components/home/ConversationComposer.tsx`
- `src/app/globals.css`
- `tests/ui/composer-shell.test.ts`

### Mobile composer was too short

Symptom:

- The mobile input box felt cramped.
- The requested fix was to add roughly two lines of space on mobile.

Root cause:

- The composer used the same minimum height shape across breakpoints.
- Desktop sizing was acceptable, but mobile needed more room because the keyboard, controls, and small viewport make a one-line-feeling composer harder to use.

Fix pattern:

- Increase the mobile-only minimum height:
  - no attachments: `112px` on mobile, preserving `72px` at `sm` and wider.
  - with attachments: `152px` on mobile, preserving `112px` at `sm` and wider.

Guardrail:

- Mobile composer ergonomics should not be inferred from desktop.
- Composer height should be breakpoint-specific when the mobile workflow is materially different.
- Preserve desktop dimensions unless the desktop workflow is also part of the requested change.

### Mobile settings button hid critical state

Symptom:

- On mobile, the composer collapsed harness, model, and effort controls into a single settings icon.
- The icon opened the right sheet, but it hid the currently selected harness and model.
- Users had to tap the control just to learn what runtime they were about to use.

Root cause:

- The collapsed mobile state optimized for space but removed status awareness.
- Runtime selection is not a secondary preference; it changes what will execute the next prompt.

Fix pattern:

- Keep the settings icon for recognizability.
- Render a compact visible summary beside it: `Harness · Model`.
- Use the same labels already used by the real controls:
  - locked direct worker label when direct mode locks the harness.
  - selected composer worker option label otherwise.
  - selected worker model option label, falling back to the raw model id.
- Cap width and truncate so the send button remains visible and on the same row.
- Put the full summary in `title`.
- Use translated fixed labels for ARIA; dynamic harness/model values are data, not locale strings.

Guardrail:

- Collapsed controls must preserve user-relevant selected values.
- Icon-only controls are acceptable for pure commands, but not for hidden state that affects execution.
- On mobile, the row must show the next-run critical path: attach, workspace when applicable, harness/model summary, send/stop.

Relevant code:

- `src/components/home/ConversationComposer.tsx`
- `tests/ui/composer-shell.test.ts`

## Cross-Cutting Rules

### Keep ongoing work visually stable

The conversation view should not visually reset during routine background work. Refreshing worker entries, replaying SSE events, fetching missing chunks, or reconnecting to a stream may show subtle loading affordances inside the relevant leaf component, but should not wipe out the transcript.

Bad:

- Replace the conversation body with a full loading state because a worker stream is fetching.
- Unmount the terminal because a per-worker cursor is not caught up.
- Hide existing entries while checking for newer entries.

Good:

- Keep existing entries mounted.
- Fetch from the current contiguous cursor.
- Show an empty/loading state only when there is no content yet and the first fetch is still in flight.

### Separate bootstrap, refresh, and recovery states

Use different UI behavior for:

- route/session bootstrap,
- selected conversation snapshot load,
- worker stream initial load,
- worker stream incremental refresh,
- reconnect/resync,
- terminal error/recovery.

If these states share one boolean, the UI will eventually flash, mask errors, or lose content.

### Verify mobile with computed browser values

Source checks are useful regression guards, but mobile layout bugs need browser verification. For composer work, verify at least:

- viewport is actually below the `sm` breakpoint,
- textarea computed `min-height`,
- textarea computed `line-height`,
- mobile-only controls are visible,
- desktop-only controls are hidden,
- summary/send controls do not overlap.

The local app's normal URL is `http://localhost:3035`. Use an already-running server when available.

### Add tests for invariants, not only snapshots

Useful tests from this incident:

- A helper test that says incremental worker stream refreshes must not block direct conversation rendering.
- A source-level UI test that prevents the direct conversation loading gate from depending on `directWorkerStream.isLoaded`.
- A composer shell test that pins mobile min-height, compact line-height class, hidden desktop selectors, visible mobile summary, and truncation-friendly button width.

Do not rely only on "the UI looked right once." These bugs came from state transitions and CSS cascade details; both need persistent regression coverage.

## Review Checklist For Future Conversation UI Changes

Before merging conversation, worker-stream, or composer UI work:

- Does this change distinguish selected conversation loading from worker stream refreshing?
- Will existing transcript content remain visible during SSE wake-ups and `afterSeq` fetches?
- Does any page-level loading gate depend on a leaf manager's transient `loading` state?
- If a control collapses on mobile, does it still show the selected values that affect the next user action?
- Are fixed user-facing labels translated through `t()`?
- Were mobile computed styles verified below `640px`, not just read from source?
- Do targeted tests pin the invariant that failed?

## Verification Commands

Use focused verification for this class of work:

```bash
pnpm vitest run tests/app/direct-worker-stream-loading.test.ts tests/ui/conversation-actions.test.ts tests/ui/composer-shell.test.ts
pnpm lint -- src/components/home/ConversationMain.tsx src/components/home/ConversationComposer.tsx tests/ui/conversation-actions.test.ts tests/ui/composer-shell.test.ts
```

For visual verification, use the running local app when available and check a mobile viewport such as `390x844`.

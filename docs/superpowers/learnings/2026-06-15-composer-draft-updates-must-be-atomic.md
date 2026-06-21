# Composer Draft Updates Must Be Atomic

**Date:** 2026-06-15
**Context:** OmniHarness home composer React state
**Symptom:** Typing in the conversation composer felt extremely slow.
**Root Cause:** A single textarea change wrote `command` and `commandCursor` through separate `HomeUiStateManager` updates. Because this manager is consumed through `useSyncExternalStore`, each write synchronously notified subscribers and could force selector work and composer renders twice per keystroke. The split writes also allowed a transient state where the new command was paired with the old cursor.
**Fix:** Added `HomeUiStateManager.setComposerDraft()` so related composer draft fields update in one manager transaction, then routed normal typing, mention insertion, and manual-stop clears through that atomic API.
**Verification:** `./node_modules/.bin/vitest run tests/ui/composer-shell.test.ts tests/app/home-ui-state-manager.test.ts`; `./node_modules/.bin/eslint src/app/home/HomeUiStateManager.ts src/app/home/ComposerContainer.tsx src/components/home/ConversationComposer.tsx src/app/home/useComposerController.ts tests/app/home-ui-state-manager.test.ts`; `./node_modules/.bin/tsc --noEmit`.
**Prevention:** For high-churn React input data stored in manager classes, batch logically related fields in one manager method. Do not call separate manager setters for text plus cursor or other per-keystroke companion state.
**Skill/Doc Updates:** No shared skill update needed; `building-react-apps` already warns that draft text and other high-churn state need narrow component subscriptions. This project note captures the external-store batching detail for OmniHarness.

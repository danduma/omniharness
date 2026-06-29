# Live Stream Renders Must Not Repaint The Composer

**Date:** 2026-06-26
**Context:** OmniHarness home UI, live event stream, conversation composer.
**Symptom:** Typing in the main composer became sluggish while a run was active, with visible delay before typed characters appeared.
**Root Cause:** Composer draft updates were isolated from the root app, but live event-stream snapshots still re-rendered `HomeApp`, recomputed expensive sidebar/view-model derivations, and cascaded into non-memoized composer components through fresh callback and array props.
**Fix:** Memoized sidebar project derivations in `useHomeViewModel`, added memo boundaries around `ComposerContainer` and `ConversationComposer`, stabilized composer mutation callbacks, and replaced fresh empty project-file arrays with a stable fallback.
**Verification:** `pnpm test tests/app/home-view-model.test.ts tests/ui/sidebar-layout.test.ts tests/ui/composer-shell.test.ts`, `pnpm lint`, and `pnpm build`.
**Prevention:** For high-frequency stream state, isolate input surfaces in both directions: keystrokes must not repaint the app shell, and app-shell stream renders must not repaint controlled inputs unless input-relevant props changed. Avoid fresh arrays/functions in props crossing memo boundaries.
**Skill/Doc Updates:** No general skill update needed; `building-react-apps` already requires narrow subscriptions and warns that draft text must not make broad surfaces repaint.

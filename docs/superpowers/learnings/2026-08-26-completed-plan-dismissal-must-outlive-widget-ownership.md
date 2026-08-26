# Completed Plan Dismissal Must Outlive Widget Ownership

**Date:** 2026-08-26
**Context:** OmniHarness ACP plan widget presentation lifecycle
**Symptom:** A completed checklist faded away, then reappeared and replayed the same fade when the user sent another prompt in that conversation.
**Root Cause:** The presentation manager stored the terminal `dismissed` phase only in its current-owner snapshot. When the finished worker temporarily stopped owning the widget, `setOwner()` reset that snapshot to `idle`; reacquiring the same owner made the unchanged completed plan look like a new completion.
**Fix:** Persist the dismissed plan identity by run and worker as soon as fading begins, retain it across transient owner and missing-plan states, clear it only for a real new incomplete plan update, and consult it synchronously during render to prevent a one-frame flash before effects run.
**Verification:** Added red-green manager regressions for owner reacquisition, ownership changes during the fade window, transient missing-plan state, and manager hydration; ran the focused plan-widget tests and `pnpm build:interface:web`.
**Prevention:** Keep terminal presentation decisions separate from ephemeral render ownership. Key them by the authoritative object identity and distinguish a temporarily absent payload from an explicit non-terminal update.
**Skill/Doc Updates:** No general skill update was needed; the existing client/server state-invariants guidance already requires explicit ownership, terminal states, loading shapes, and return-flow tests. This project note records how that rule applies to the ACP plan surface.

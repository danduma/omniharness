# Manager Server Snapshots Must Be Stable

**Date:** 2026-07-31
**Context:** OmniHarness React app shell, shared `StateManager` subscriptions, and the Next-to-Vite transition.
**Symptom:** Next development refreshes reported a hydration mismatch at the `HomeApp` root, followed during verification by React's warning that `getServerSnapshot` was not cached.
**Root Cause:** `useManagerSnapshot` and `useManagerSelector` used each manager's current browser-owned state as the server snapshot. A manager retained across a hot refresh could already contain localStorage-derived appearance values while the server HTML used defaults. Object selectors also created a new server snapshot on every read.
**Fix:** `StateManager` now retains its immutable initial snapshot. Shared manager hooks use that initial snapshot for SSR/hydration, and selector server results are cached by initial state and selector identity.
**Verification:** `pnpm vitest run tests/lib/use-manager-snapshot.test.tsx tests/lib/state-manager.test.ts tests/app/appearance-preferences-manager.test.ts`; all four project typechecks; clean live-browser load at `http://localhost:3035/` with the full app rendered and no new console warnings.
**Prevention:** Every `useSyncExternalStore` wrapper must provide a server snapshot that matches server-rendered HTML and is referentially stable. Browser persistence belongs in post-mount hydration, never in the server snapshot.
**Skill/Doc Updates:** Added the invariant to `docs/architecture/frontend-state-and-rendering.md`. No global skill change was needed because the project hook and regression test now enforce the rule at the shared boundary.

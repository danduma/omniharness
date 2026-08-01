# Native Conversation History Must Listen To The Real Scroll Owner

**Date:** 2026-07-31
**Context:** OmniHarness unified worker stream pagination in the native conversation view
**Symptom:** A resumed Claude conversation appeared to begin near its end even though its full imported history was present on disk. Reaching the top of the visible transcript did not reveal earlier prompts.
**Root Cause:** The client intentionally loaded only the newest 100 worker entries and depended on a top-of-scroll callback to fetch older pages. In native mode, the outer Radix viewport owns scrolling, but the history callback was attached to the inner `Terminal` content element, whose overflow is visible and whose `scrollTop` never changes.
**Fix:** The resolved scroll viewport now handles native history requests while preserving the existing terminal-mode behavior. Reaching its top calls the manager's bounded `loadOlder` path until no preceding page remains.
**Verification:** The regression test failed before the fix and passed after it. The full terminal suite passed 22 tests; worker paging, hot-path, and output-store suites passed 54 tests; targeted ESLint and the full TypeScript check exited successfully. Session `ab8169524067` was read from its canonical project-local stream and contains 347 records: 343 imported Claude records plus four OmniHarness runtime records, beginning at source sequence 1.
**Prevention:** For nested scroll areas, resolve and test the element that owns `scrollTop`, `scrollHeight`, and the scroll event. A correct server cursor and paging manager do not make history reachable unless the visible viewport dispatches the request.
**Skill/Doc Updates:** Updated `docs/architecture/worker-conversation-stream.md` with the native viewport ownership rule; no general skill change was needed because this is a project-specific Terminal/Radix composition detail.

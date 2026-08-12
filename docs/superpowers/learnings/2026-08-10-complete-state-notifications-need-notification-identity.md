# Complete-State Notifications Need Notification Identity

**Date:** 2026-08-10
**Context:** OmniHarness ACP plan projection and unified worker stream
**Symptom:** A valid complete-plan sequence `A → B → A` left the derived widget showing B. Reusing an earlier ACP session id after another session could likewise reuse the old boundary instead of recording a new authority transition.
**Root Cause:** Accepted plan and session-boundary entry ids were hashes of their payload/session content. The append-only writer correctly deduplicated repeated ids, but content identity is not notification identity: the final A was a new replacement notification even though its payload matched an older entry.
**Fix:** Assign a fresh notification-scoped id before each accepted plan or new session-boundary append. Keep exact-id replay deduplication testable through an injected id seam. Add a 1 KiB session-id ingress bound and preflight complete boundary/read representations so hostile identity data cannot poison durable replay.
**Verification:** The plan-stream suite was observed red for plan `A → B → A`, session `A → B → A`, oversized boundaries, and oversized callback session ids before the fix, then green afterward. The real ACP lifecycle also exercises recurrence through the production writer and reconstructs the stream across subprocess restart.
**Prevention:** For complete-state or replacement protocols, never derive durable event identity solely from content. Test both `A → B → A` payload recurrence and authority/session recurrence with the real deduplicating writer semantics.
**Skill/Doc Updates:** Added the notification-identity rule to `docs/architecture/lifecycle-observability-and-testing.md`. No global skill change was needed because this is a project storage/event-contract invariant rather than a general tool workflow rule.

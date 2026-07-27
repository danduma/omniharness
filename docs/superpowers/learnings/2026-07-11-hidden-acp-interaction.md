# Protocol Support Is Not Complete Until the User Can Act

**Date:** 2026-07-11
**Context:** OmniHarness ACP worker stream and direct-conversation UI
**Symptom:** Claude stopped at `AskUserQuestion`; the timeline showed a pending tool call, but the answer choices were absent, so the session looked stuck and repeated working/waiting transitions.
**Root Cause:** The server correctly received and persisted `elicitation/create`, but the main conversation projection ignored `elicitation` entries. A separate worker-card popup had a partial string-only form renderer, which did not support the incident's array/multi-select schema. Protocol receipt, persistence, projection, and actionable UI had been tested separately instead of as one user journey.
**Fix:** Upgraded to ACP 0.25, added native elicitation routing, parsed every ACP form field kind, rendered questions and exact permission options inline in the main conversation, reused that renderer in worker cards, and made response settlement durable before resolving the agent request.
**Verification:** The sanitized incident schema is covered by parser and static-render tests; the runtime HTTP test drives a fake ACP agent through the same four-choice multi-select plus custom-answer request and confirms the accepted typed response reaches the agent.
**Prevention:** Every advertised interactive capability must have a finite test matrix spanning wire request → durable worker entry → main-conversation rendering → user response → terminal outcome. A pending interaction without a visible action surface is a release blocker, not a cosmetic defect.
**Skill/Doc Updates:** The project lifecycle architecture document now defines this interaction invariant. No shared skill was changed because the rule is specific to OmniHarness's unified worker stream and ACP projection boundary.

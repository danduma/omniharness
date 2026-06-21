# Full-Access Elicitations Must Wait For The User

**Date:** 2026-06-14
**Context:** OmniHarness ACP agent runtime elicitations and worker question UI
**Symptom:** A worker reported that it asked the user for input and continued after "the user did not answer," but no prompt was ever shown to the user.
**Root Cause:** The runtime treated `full-access` session mode as permission to auto-decline `elicitation/create` requests. That manufactured a user non-answer before the frontend could render the pending question.
**Fix:** Full-access mode still auto-approves eligible permission requests, but no longer auto-declines form elicitations. Supported form elicitations stay pending until the user responds through the worker card, and the response is sent back to the runtime.
**Verification:** Added a regression test that switches an ACP session to `full-access`, triggers `AskUserQuestion`, and asserts the elicitation remains pending without sending an `action:"decline"` response. Verified with targeted runtime and home status tests.
**Prevention:** Do not infer user intent from permission mode. Permission decisions and user-input elicitations are separate state machines; only an explicit UI/API response may resolve a user-input elicitation.
**Skill/Doc Updates:** No global skill update needed; the project-specific control-plane rule is captured here and enforced by the regression test.

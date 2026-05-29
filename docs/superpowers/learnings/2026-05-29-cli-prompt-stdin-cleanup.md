# CLI Prompt Stdin Cleanup

**Date:** 2026-05-29
**Context:** OmniHarness `./omniharness` first-run auth setup.
**Symptom:** On a remote TTY, pressing Enter to generate a password printed the generated password, then the launcher appeared stuck and additional Enter presses did nothing.
**Root Cause:** The hidden password prompt called `stdin.resume()` and restored raw mode after Enter, but did not pause stdin again. The Node process could stay alive after the prompt resolved, so the shell launcher never advanced to build/start.
**Fix:** `scripts/setup-auth.mjs` now restores raw mode and pauses stdin on both Enter and Ctrl-C cleanup paths.
**Verification:** `node --check scripts/setup-auth.mjs`; `pnpm vitest run tests/scripts/setup-auth.test.ts` with a regression test that simulates a TTY prompt and asserts stdin is paused after accepting the generated password.
**Prevention:** Any CLI prompt helper that directly manipulates TTY state must restore all touched stream state, including raw mode, listeners, and stdin flow state. Add a TTY-shaped regression test for prompt lifecycle bugs.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific launcher lifecycle gotcha captured here.

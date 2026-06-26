# Git Porcelain Leading Spaces Are Data

**Date:** 2026-06-25
**Context:** OmniHarness milestone auto-commit.
**Symptom:** A completed direct run emitted `auto_commit_failed` because `git add` received `rc/app/(public)/(marketing)/page.tsx` even though the real file was `src/app/(public)/(marketing)/page.tsx`.
**Root Cause:** `runGit` trimmed stdout for every command. `git status --porcelain` uses fixed columns, and an unstaged tracked modification starts with a leading space: ` M src/...`. Trimming removed that first status column, so the parser's `line.slice(3)` dropped the first character of the path.
**Fix:** Preserve stdout for `git status --porcelain` while keeping trimmed stdout for single-value commands such as `rev-parse`.
**Verification:** Added regression coverage for modified tracked `src/app/(public)/(marketing)/page.tsx` files in both `autoCommitMilestone` and `runMilestoneAutoCommit`; verified with `pnpm vitest run tests/server/git/auto-commit.test.ts tests/server/git/run-auto-commit.test.ts`.
**Prevention:** Treat command output with structural columns as protocol data. Do not apply generic whitespace trimming before parsing; trim only fields whose command contract is a scalar value.
**Skill/Doc Updates:** No skill update needed; the lesson is project-specific to Git porcelain parsing and auto-commit staging.

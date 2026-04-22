# Agent Output Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current xterm-like text replay with a structured activity feed that renders CLI agent output like a live timeline, updates tool rows in place, and hides implementation-noisy text such as inline line numbers.

**Architecture:** Keep polling `/api/agents/[name]`, but stop rendering `displayText` as a monolithic string. Instead, normalize bridge `outputEntries` into a client-side activity model that groups tool lifecycles by `toolCallId`, renders thoughts/messages/tool calls as distinct UI blocks, and extracts formatted input/output panes from each tool event's raw payload.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, TanStack Query, Vitest

**North Star Product:** Worker output should feel like an inspectable execution timeline rather than a terminal dump, with durable identities for thoughts, commands, delegated tasks, reads, outputs, and permission waits.

**Current Milestone:** Deliver screenshot-aligned worker activity rendering for the existing worker cards, including stateful tool updates, styled thoughts, and cleaned output panes.

**Later Milestones / Deferred But Intentional:** Expand the activity model to cover richer event types from the bridge, collapsible sections, inline diffing for edits, and better live-scroll behavior when users inspect older output.

---

## File Map

- Modify `src/components/Terminal.tsx`
  Responsibility: replace xterm replay with a structured activity feed renderer while keeping the existing query/error surface.

- Add `src/lib/agent-output.ts`
  Responsibility: normalize bridge output entries into message/thought/tool/permission timeline items, group tool updates by `toolCallId`, and sanitize displayed text.

- Add `tests/lib/agent-output.test.ts`
  Responsibility: lock down grouping, status updates, line-number stripping, and fallback behavior.

- Modify `tests/ui/terminal-fit.test.ts`
  Responsibility: replace xterm-specific assertions with checks for the new activity renderer and error display.

## Tasks

- [ ] Define the normalized activity item model in `src/lib/agent-output.ts`.
  Verification: types cover message, thought, tool, permission, and fallback live-progress cases without relying on `displayText`.

- [ ] Implement tool lifecycle grouping keyed by `toolCallId`.
  Verification: a `tool_call` followed by multiple `tool_call_update` entries produces one rendered tool item whose status and output evolve in place.

- [ ] Implement text sanitation helpers.
  Verification: fenced code output loses markdown fences for display, and leading line numbers such as `1       foo` are removed from rendered code panes.

- [ ] Rebuild `src/components/Terminal.tsx` as a scrollable activity feed.
  Verification: thoughts render in muted italic text, tool calls render as timeline rows with status chips, and completed tool outputs render in distinct panes instead of appended log text.

- [ ] Preserve degraded-mode behavior for sparse snapshots.
  Verification: if `outputEntries` is empty, the component still surfaces `currentText` or `lastText` as a live activity item.

- [ ] Update tests.
  Verification: `pnpm test -- --run tests/lib/agent-output.test.ts tests/ui/terminal-fit.test.ts` passes.

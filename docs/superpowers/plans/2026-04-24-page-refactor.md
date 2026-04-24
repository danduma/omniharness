# Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/app/page.tsx` and any other oversized source files into modular files while preserving current UI behavior.

**Architecture:** Keep the Next app entrypoint as a thin page that renders a client-side home app component. Move domain types/constants/helpers into `src/app/home/*` modules, move UI sections into `src/components/home/*`, and keep controller state in `HomeApp` under the 1200-line limit by extracting the large composer/content/settings/header surfaces.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, existing shadcn-style UI primitives.

**North Star Product:** OmniHarness remains a compact operational control plane for conversations, plans, workers, and remote access.

**Current Milestone:** Pure refactor: no intentional behavior or route changes, no file-based routing additions, no branch/worktree use.

**Later Milestones / Deferred But Intentional:** Further hook extraction may be useful once the conversation controller stabilizes, but this slice only modularizes the oversized file.

---

## File Map

- Create `src/app/home/HomeApp.tsx`: main client component and orchestration state.
- Create `src/app/home/types.ts`: records and UI option types currently declared in `page.tsx`.
- Create `src/app/home/constants.ts`: worker/model/storage constants and provider options.
- Create `src/app/home/utils.ts`: parsing, formatting, summarizing, path, and error helpers.
- Create `src/components/home/ErrorNotice.tsx`: reusable app error notice.
- Create `src/components/home/ConversationSidebar.tsx`: project/conversation sidebar.
- Create `src/components/home/WorkersSidebar.tsx`: worker sidebar and worker card wrapper.
- Create `src/components/home/SettingsDialog.tsx`: settings dialog and LLM form.
- Create `src/components/home/ConversationComposer.tsx`: prompt composer, attachment chips, mention picker, worker/model controls.
- Create `src/components/home/HomeHeader.tsx`: top bar and mobile sheets.
- Create `src/components/home/ConversationMain.tsx`: selected conversation, empty state, messages, execution status, and active workers.
- Modify `src/app/page.tsx`: render `HomeApp`.
- Tests: run lint/type-oriented verification and existing relevant UI tests if available.

## Tasks

- [ ] Move shared types/constants/helpers out of `src/app/page.tsx` and update imports.
- [ ] Extract sidebar, worker sidebar, error notice, settings dialog, header, composer, and conversation main components.
- [ ] Replace inline JSX in `HomeApp` with the extracted components while keeping state and mutations behavior unchanged.
- [ ] Confirm no source file other than generated metadata exceeds 1200 lines.
- [ ] Run verification: `pnpm lint` and targeted Vitest suites for page/sidebar/composer-adjacent UI if they still apply.

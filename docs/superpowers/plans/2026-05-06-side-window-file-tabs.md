# Side Window File Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open project files in the existing right side window as closeable tabs next to a pinned, non-closeable `Conversation Workers` tab.

**Architecture:** Replace the workers-only right rail with a side-window shell whose tab model is owned by a global Manager class. Keep `WorkersSidebar` focused on worker content, add a file viewer panel for text files, and extend the existing filesystem API to read one safe project-relative file without introducing a new route.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, shadcn/ui primitives, lucide-react, Tailwind CSS, Vitest.

**North Star Product:** The side window becomes OmniHarness's inspect-and-supervise workspace: pinned live workers, readable files, future diffs/logs/artifacts, and contextual jump targets all living beside the conversation without taking over the main transcript.

**Current Milestone:** Ship read-only text file tabs opened from the composer file mention picker, with a pinned workers tab, safe file reads, loading/error/empty states, desktop resizing, and mobile sheet support.

**Later Milestones / Deferred But Intentional:** Clickable file references in message transcripts, syntax highlighting, search-within-file, diff tabs, artifact tabs, persisted open tabs across reloads, split panes, and write/edit affordances are deferred.

**Final Functionality Standard:** This milestone delivers real end-to-end file viewing: selecting an open action for a project file reads the actual file from disk through the authenticated API and displays its contents in a side-window tab. No fake file contents, placeholder panels, or canned data are acceptable. No branch or worktree will be created.

---

## User Stories

- As a builder supervising a run, I can keep the workers view available while opening a file beside it.
- As a builder composing with `@` file mentions, I can open a listed file in the side window without inserting it into the prompt.
- As a builder reading a file, I can switch between workers and open files, close file tabs, and reopen the same file without duplicate tabs.
- As a builder on a phone-sized viewport, I can use the same side-window content in the existing right sheet.
- As a builder handling failures, I see clear file load, missing file, binary file, permission, and traversal errors instead of a blank tab.

## PM Pass

- Primary user: the local human builder using OmniHarness to supervise agent work.
- Supporting jobs: inspect source context while conversing, compare worker activity against files, avoid losing the worker view, and recover visibly when a file cannot be loaded.
- State model: a single `sideWindowManager` owns tabs, active tab id, and file tab metadata. Server file content remains fetched data, not independent React component state.
- Persistence model: current milestone does not persist open file tabs. Sidebar width already persists in `localStorage`; keep that behavior. Later persistence can store tab metadata after the file viewer proves useful.
- Operational readiness: file reads must be read-only, scoped to the active project root, size-limited, and explicit about truncation.
- Error transparency: backend errors should surface through `requestJson` and panel-level notices with source/action context.
- Control-plane/scriptability: deterministic tests should verify path scoping and the manager/tab transitions without needing the browser.
- Agentic user journey candidate, approval-gated: start the app, open a project-scoped conversation, type `@`, open a file from the picker, switch back to workers, close the file tab, and confirm the workers tab remains.

## Product Completeness Pass

- Baseline v1 surfaces:
  - side-window tab strip with pinned `Conversation Workers` tab,
  - close buttons only on file tabs,
  - file panel header with relative path and project root context,
  - loading, loaded, truncated, unsupported/binary, missing, and generic error states,
  - desktop right-rail toggle and resize preserved,
  - mobile sheet content upgraded from workers-only to side-window tabs.
- Explicitly requested capability:
  - open files in the side window next to the existing workers view.
- Inferred v1 capability:
  - dedupe already-open file tabs and focus the existing tab.
  - keep `Conversation Workers` uncloseable.
  - make the side window available when there is an active project scope, even if there are no implementation workers yet.
- Deferred choices:
  - do not add editing, saving, syntax highlighting, or transcript-wide path linkification in this milestone.
  - do not persist open tabs until tab semantics are stable.

## File Map

- Create `src/app/home/SideWindowManager.ts`
  - Owns `SideWindowTab`, `SideWindowFileTab`, active tab id, `openFile`, `closeTab`, `selectTab`, and `resetFileTabs`.
- Create `src/components/home/SideWindow.tsx`
  - Renders the tab strip and switches between `WorkersSidebar` and file panels.
- Create `src/components/home/FileViewerPanel.tsx`
  - Fetches and renders one project-relative text file with line-aware read-only display and clear states.
- Modify `src/components/home/WorkersSidebar.tsx`
  - Remove its own top title/close header when embedded in `SideWindow`, or make that header optional so the side-window shell owns tabs and close affordances.
- Modify `src/components/home/ConversationComposer.tsx`
  - Add a distinct icon button per mention result for `Open in side window`, while keeping row click/Enter/Tab behavior as “insert mention”.
- Modify `src/app/home/HomeApp.tsx`
  - Wire `sideWindowManager`, pass `onOpenProjectFile`, render `SideWindow` on desktop, and use it in the mobile sheet.
- Modify `src/components/home/HomeHeader.tsx`
  - Rename/tune the toggle affordance from workers-only to side-window where appropriate, and pass side-window props to the mobile sheet.
- Modify `src/app/home/types.ts`
  - Add `ProjectFileContentResponse`.
- Modify `src/server/fs/files.ts`
  - Add safe path helpers and `readProjectTextFile(root, relativePath)` with containment, text/binary detection, and truncation.
- Modify `src/app/api/fs/files/route.ts`
  - Keep list behavior by default; when a `file` query param is present, return file content for that project-relative path.
- Update `tests/fs/files.test.ts`
  - Cover safe reads, traversal rejection, truncation, missing files, and binary rejection.
- Update `tests/ui/sidebar-layout.test.ts`
  - Cover side-window tab shell, pinned workers tab, closeable file tabs, mobile sheet reuse, and renamed toggle copy.
- Add or update `tests/app/side-window-manager.test.ts`
  - Cover manager transitions: open, dedupe, select, close active tab fallback, and reset file tabs.
- Update `tests/ui/composer-shell.test.ts`
  - Cover mention picker open-file button separately from mention insertion.
- `.gitignore`
  - No change expected. Existing generated/dependency folders are already ignored; do not add generated artifacts.

## Implementation Tasks

- [ ] Add manager tests first in `tests/app/side-window-manager.test.ts`.
  - Verify initial state contains exactly one pinned `workers` tab.
  - Verify `openFile({ root, relativePath })` creates a file tab and selects it.
  - Verify opening the same root/path again focuses the existing tab instead of duplicating it.
  - Verify `closeTab("workers")` is ignored.
  - Verify closing the active file tab falls back to the nearest remaining tab, then `workers`.

- [ ] Implement `src/app/home/SideWindowManager.ts`.
  - Export stable tab ids, for example `workers` and `file:${root}:${relativePath}`.
  - Store file tabs as `{ id, kind: "file", root, relativePath, title }`.
  - Keep all tab mutations in manager methods; components should call manager intent methods only.
  - Avoid `useEffect`-driven state updates for tab transitions.

- [ ] Add filesystem read tests in `tests/fs/files.test.ts`.
  - Use temporary directories and real files.
  - Assert nested relative reads work.
  - Assert `../outside.txt` and absolute outside paths fail.
  - Assert generated/ignored directories are not relevant to direct reads unless the final helper intentionally blocks them.
  - Assert binary-looking bytes fail with an explicit unsupported-file error.
  - Assert files above the size cap return `truncated: true` and bounded content.

- [ ] Implement safe file reading in `src/server/fs/files.ts`.
  - Add an `isPathInside(root, candidate)` helper that handles path separators safely, not plain `startsWith`.
  - Resolve `root` and `relativePath`, require the file to stay inside `root`, require a regular file, read only up to the configured text cap plus sentinel bytes, detect null bytes or replacement-heavy content, and return `{ root, path, content, size, truncated }`.
  - Keep `listProjectFiles` behavior intact.

- [ ] Extend `src/app/api/fs/files/route.ts`.
  - Preserve `GET /api/fs/files?root=...` list responses exactly for existing callers.
  - Add `GET /api/fs/files?root=...&file=src/app.tsx` content responses using `readProjectTextFile`.
  - Keep auth via `requireApiSession`.
  - Use `errorResponse` with source `Filesystem` and action `Read project file`.
  - Do not create a new route directory or new page route.

- [ ] Add `ProjectFileContentResponse` in `src/app/home/types.ts`.
  - Shape: `{ root: string; path: string; content: string; size: number; truncated: boolean }`.
  - Keep `ProjectFilesResponse` unchanged.

- [ ] Build `src/components/home/FileViewerPanel.tsx`.
  - Props: `root`, `relativePath`, optional `className`.
  - Fetch with TanStack Query key `["project-file", root, relativePath]`.
  - Render header metadata, loading skeleton, error notice, truncation notice, and a scrollable `<pre>` for content.
  - Use stable dimensions so loading/error/content states do not resize the side window.
  - Keep it read-only and avoid editor dependencies in this milestone.

- [ ] Build `src/components/home/SideWindow.tsx`.
  - Props should include existing worker data/callbacks plus `projectRoot`.
  - Subscribe to `sideWindowManager` with `useManagerSnapshot`.
  - Render a compact tab strip:
    - `Conversation Workers` first, no close button.
    - file tabs next, each with a file icon, truncated filename, and close icon button.
  - Render `WorkersSidebar` for the workers tab and `FileViewerPanel` for file tabs.
  - Accept `onCloseWindow` for closing the whole rail/sheet; this must not close the pinned workers tab.

- [ ] Adjust `src/components/home/WorkersSidebar.tsx`.
  - Let `SideWindow` own the outer title bar by adding a prop such as `showHeader?: boolean`.
  - Keep the active/finished segmented control and worker list unchanged.
  - Preserve single-worker full-height behavior and worker stop/history callbacks.

- [ ] Wire file opening in `src/app/home/HomeApp.tsx`.
  - Add `handleOpenProjectFile(relativePath)` that requires `currentProjectScope`, calls `sideWindowManager.openFile`, opens the right sidebar/mobile sheet, and focuses the file tab.
  - Pass `onOpenProjectFile` into `ConversationComposer`.
  - Replace desktop `WorkersSidebar` rendering with `SideWindow`.
  - Change right-rail availability from implementation-only to `Boolean(selectedRunId || draftProjectPath) && Boolean(currentProjectScope)` so file tabs can open for any project-scoped conversation state.
  - Keep existing auto-open behavior for implementation conversations with workers.
  - On selected run changes, call `sideWindowManager.resetFileTabs()` so stale project files do not linger across conversations in this milestone.

- [ ] Update `src/components/home/HomeHeader.tsx`.
  - Rename title/aria copy from `Toggle Conversation Workers` to `Toggle side window` or `Toggle workspace side window`.
  - Keep the `PanelRight` icon.
  - Render the mobile sheet with `SideWindow` instead of `WorkersSidebar`.
  - Ensure the sheet remains usable even for non-implementation conversations with a project scope.

- [ ] Update `src/components/home/ConversationComposer.tsx`.
  - Add prop `onOpenProjectFile?: (filePath: string) => void`.
  - In the mention picker, keep row click as `applyMention(filePath)`.
  - Add a right-aligned icon button with `aria-label={`Open ${filePath} in side window`}` that calls `onOpenProjectFile(filePath)` on mouse down/click without moving textarea focus unexpectedly.
  - Prevent event propagation so the open action does not also insert the mention.

- [ ] Update source-level UI tests.
  - `tests/ui/sidebar-layout.test.ts`: assert `SideWindow`, `sideWindowManager`, pinned workers tab copy, close buttons only for file tabs, desktop rail replacement, and mobile sheet replacement.
  - `tests/ui/composer-shell.test.ts`: assert the mention picker includes the open-file button and still calls `applyMention` for row selection.
  - Update old workers-only copy expectations to side-window copy where behavior changed.

- [ ] Run deterministic verification.
  - `pnpm test -- tests/app/side-window-manager.test.ts tests/fs/files.test.ts tests/ui/sidebar-layout.test.ts tests/ui/composer-shell.test.ts`
  - `pnpm lint`
  - `pnpm build`

- [ ] Optional approval-gated user journey verification.
  - After implementation, ask before running the browser journey.
  - Candidate mission: open the app, select a project-scoped conversation, type `@`, open a file in the side window, switch back to workers, close the file tab, and confirm the workers tab cannot be closed.

## Acceptance Criteria

- The side window has a pinned `Conversation Workers` tab that cannot be closed.
- Opening a file creates or focuses a file tab next to the workers tab.
- File tabs can be closed independently without closing the side window.
- The file viewer reads actual project files through an authenticated, path-scoped, read-only API.
- Traversal, missing file, binary file, and oversized file cases have visible, test-covered behavior.
- Desktop resizing and mobile sheet behavior continue to work.
- No branch, no worktree, no file-based page routing, no `require()`, and no component-owned tab arrays as source of truth.

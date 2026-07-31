# Runtime API migration inventory

This is the source of truth for moving interface networking behind
`RuntimeAPIs`. The adapter surface already owns the target methods below;
Task 12 moves each compatibility caller without changing its server-authority,
abort, optimistic-update, or replay behavior.

| Current caller | Current route or stream | Target `RuntimeAPIs` owner |
| --- | --- | --- |
| `src/ui/render-web.tsx` | `GET /api/runtime/bootstrap` | `bootstrap.load` |
| `src/app/home/useHomeQueries.ts` | auth session | `auth.session` |
| `src/app/home/useHomeMutations.ts` | login, logout, pair redeem | `auth.login`, `auth.logout`, `auth.redeemPair` |
| `src/components/PairDeviceDialog.tsx` | pair create and status | `auth.createPair`, `auth.getPair` |
| `src/app/home/useHomeMutations.ts` | run patch/delete/resume | `runs.update`, `runs.remove`, `runs.resume` |
| `src/app/home/useRunSelectionEffects.ts` | run cancel/update | `runs.update` |
| `src/app/home/useHomeMutations.ts` | conversation create and messages | `conversations.create`, `conversations.sendTo` |
| `src/app/home/useQueuedMessageMutations.ts` | queued message edit/delete/interrupt | `conversations.updateQueuedMessage`, `removeQueuedMessage`, `interruptQueuedMessage`, `interruptNextQueuedMessage` |
| `src/app/home/ConversationTranscriptManager.ts` | transcript pages | `conversations.transcript` |
| `src/app/home/WorkerEntriesManager.ts` | worker entry pages and gap fill | `workers.listEntries` |
| `src/app/home/useHomeMutations.ts` | worker history, elicitation, permission | `workers.get`, `workers.answerElicitation`, `workers.answerPermission` |
| `src/app/home/HomeApp.tsx` | worker prewarm | `workers.prewarm` |
| `src/components/FolderPickerDialog.tsx` | directory browse | `files.browse` |
| `src/components/FileAttachmentPickerDialog.tsx` | file list | `files.list` |
| `src/components/home/FileViewerPanel.tsx` | file content | `files.list` |
| `src/app/home/ComposerContainer.tsx` | mention file list | `files.list` |
| `src/app/home/useHomeQueries.ts` | project file list | `files.list` |
| `src/app/home/upload-attachments.ts` | multipart attachments | `files.upload` |
| `src/components/Terminal.tsx`, `UserInputMessage.tsx` | attachment bytes | `files.attachment` |
| `src/app/home/GitWorkspaceManager.ts` | git status and mutations | `git.execute` |
| `src/app/home/useHomeMutations.ts` | plan promote and review | `planning.promote`, `planning.review` |
| `src/app/home/PlanningReviewPreferencesManager.ts` | review defaults | `settings.save` |
| `src/app/home/useHomeQueries.ts` | settings | `settings.load` |
| `src/app/home/useConversationActions.ts` | recent-project settings | `settings.save` |
| `src/app/home/useHomeMutations.ts` | settings patches | `settings.save` |
| `src/app/home/HomeApp.tsx` | account list | `accounts.list` |
| `src/components/settings/AgentsSettingsPanel.tsx` | account CRUD/status | `accounts.create`, `accounts.update`, `accounts.remove`, `accounts.refreshStatus` |
| `src/app/home/ConversationNotificationManager.ts` | push configuration/subscription | `notifications.load`, `notifications.subscribe`, `notifications.unsubscribe` |
| `src/components/InteractiveTerminal.tsx` | terminal create/input/resize/delete/SSE | `terminals.create`, `terminals.input`, `terminals.resize`, `terminals.close`, `terminals.openStream` |
| `src/app/home/LiveEventConnectionManager.ts` | event snapshot/SSE/resume | `events.open` |
| event diagnostics consumers | event log | `events.fetchLog` |

The following compatibility calls need explicit domain additions during their
migration rather than being hidden behind a generic request escape hatch:

| Current caller | Route | Planned domain extension |
| --- | --- | --- |
| `src/components/settings/ModelProfileForm.tsx` | `/api/codex-auth/status` | `accounts.codexStatus` |
| `src/app/home/ExternalSessionsPicker.tsx` | `/api/external-sessions` | `conversations.listExternalSessions` |
| `src/app/home/ProjectMemoryPanelManager.ts` | `/api/projects/memory` | `settings.projectMemory.*` |
| `src/app/home/ClaudeModelGatewayManager.ts` | `/api/integrations/claude-model-gateway` | `settings.claudeGateway.*` |
| `src/app/home/useHomeQueries.ts` | `/api/agents/catalog` | `workers.catalog` |

No interface caller may add a new direct `fetch`, `EventSource`, absolute API
URL, Electron IPC request, or VS Code message. Add or extend a typed domain
method first, then inject the adapter into its Manager.

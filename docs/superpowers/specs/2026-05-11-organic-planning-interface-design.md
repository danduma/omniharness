# Organic Planning Interface Design

## Summary

Planning should feel like a normal conversation with a capable CLI agent, not like a batch job that happens in a terminal window with a detached status widget. The planner should ask questions when the request is underspecified, draft or revise artifacts in the main conversation flow, and mention generated files as inspectable conversation context rather than as a framed artifact card.

This revises the existing interactive planning handoff design with a stronger conversational rule: planning artifacts are contextual follow-ups to planner messages, not global chrome at the top of the session.

## Current Friction

- The CLI planner output feels visually separated from the main conversation.
- Planning artifacts appear as a separate visual widget above the transcript, so the flow reads backward: metadata first, conversation second.
- The planning agent can jump straight to a plan without asking clarifying questions, which makes the interaction feel less like real planning.
- Planning is visually closer to implementation/supervisor mode than direct conversation, even though it is a one-agent planning dialogue.

## North Star

OmniHarness should make the path from vague intent to executable plan feel organic:

1. The user says what they want.
2. The planner responds in the main conversation.
3. If the planner needs context, it asks a small number of targeted questions.
4. The user answers in the same composer.
5. The planner drafts or revises the spec and plan.
6. When a handoff exists, OmniHarness adds a plain supervisor-style note that mentions the spec and plan files.
7. The user can keep revising or explicitly start implementation from the selected plan.

## Product Principles

- Conversation first, artifacts second.
- Planning stays one-agent and conversational until promotion.
- A ready plan is a milestone, not the end of the conversation.
- Promotion is explicit and local to the handoff that made it possible.
- The planner should ask questions when intent, success criteria, constraints, or implementation boundaries are unclear.
- The UI should make the selected plan visible at the exact moment the user can start implementation.

## Recommended UX

### Planning Transcript

Planning conversations should render as normal user and planner messages in the main column.

The planner output should not be primarily framed as a terminal pane. Full raw terminal output can remain available as a secondary expansion for debugging, but the readable planner response should be the main surface.

### Inline Handoff Note

Move the planning artifact panel out of the top-of-session position and remove the card-like artifact chrome.

When a planner message produces or updates a valid handoff, render a plain supervisor-style note immediately after that planner message or after the latest planner output. It should read like OmniHarness saying "I found these files, do you want to keep revising or start implementation?" The file paths should be inspectable through the existing open-file route.

- selected spec path as an openable file mention,
- selected plan path as an openable file mention,
- first readiness gap if blocked,
- primary action: `Start implementation from selected plan`,
- secondary action: `Continue revising`.

It should not use nested cards, heavy borders, status chips, decorative headings, or detached panel language.

If a later planner message emits a newer handoff, the newest handoff note becomes the active one. Older handoff notes can remain visually de-emphasized or show `Superseded` in a later slice.

### Planning Header

Keep only a compact status strip near the conversation title or top of the scroll content:

- `Planning agent is working`
- `Waiting for your reply`
- `Ready to implement`
- `Promoted to implementation`
- `Planning failed`

This header should not contain artifact paths or promotion controls.

### Composer

The composer remains available whenever the planner is waiting on the user, including after the plan is ready.

Mode-aware placeholder copy:

- Planning: `Reply to planning agent...`
- Direct: `Send to CLI...`
- Implementation: `Ask supervisor...`
- No selected conversation: `Ask Omni anything. @ to refer to files`

### Planner Behavior

The planner prompt should instruct the CLI agent to ask targeted questions before writing final artifacts when any of these are unclear:

- intended user outcome,
- scope boundaries,
- success criteria,
- preferred technical approach,
- risky data or workflow migration,
- user-facing UX decisions,
- testing and verification expectations.

The planner may skip questions only when the request is already concrete enough to produce a safe spec and plan.

When it asks questions, it should ask a small set of high-leverage questions instead of producing a long questionnaire.

## UI Architecture

### Current Implementation Notes

- `src/components/home/ConversationMain.tsx` currently renders `PlanningArtifactsPanel` before the conversation timeline.
- `PlanningArtifactsPanel` is global to the run, not contextual to a planner turn.
- `src/lib/conversation-visuals.ts` currently classifies planning as `supervisor`, which reinforces the implementation-mode visual language.
- `ConversationComposer` currently uses one generic placeholder for all modes.
- Several planning UI strings are currently hardcoded and must be moved into `shared/locales/*.json` when implementation starts.

### Proposed Component Shape

- Add a focused `PlanningConversationMain` or planning branch inside `ConversationMain`.
- Render planning messages with chat-first primitives, reusing the direct-agent readable output path where practical.
- Add an inline `PlanningHandoffNote` component that receives the selected handoff metadata, open-file callback, and promotion callback.
- Keep `PlanningArtifactsPanel` only as a compatibility export if useful, but make the rendered UI conversational rather than panel-like.
- Add a small selector/manager field for the active handoff candidate if the current `planningArtifactsManager.selectedPlanPath` is not sufficient.

## State Model

Planning status remains interaction-oriented:

- `starting`
- `working`
- `awaiting_user`
- `ready`
- `promoting`
- `promoted`
- `failed`

`ready` must keep the composer enabled. It means "you can start implementation now", not "planning is finished."

## Data Flow

1. User sends a planning message.
2. Existing planning worker receives the message.
3. Worker response is persisted as the next planner turn.
4. Artifact refresh runs after the response.
5. If a handoff is detected, the UI associates the latest handoff with the latest planner turn that produced it.
6. Inline handoff note renders after that turn.
7. Promotion creates a separate implementation run with `parentRunId` pointing to the planning run.

If associating artifacts to exact message ids is too large for the first slice, v1 can render the active handoff note after the latest planner/worker message instead of at the top.

## i18n Requirements

Every new user-facing string must be added to:

- `shared/locales/en.json`
- `shared/locales/de.json`
- `shared/locales/es.json`
- `shared/locales/fr.json`
- `shared/locales/it.json`
- `shared/locales/ja.json`
- `shared/locales/ko.json`
- `shared/locales/pt.json`
- `shared/locales/zh-CN.json`

Components that render these strings must call `useI18nSnapshot()` and render with `t()`.

## Testing Strategy

### Source Tests

- Planning visual kind is not supervisor-style.
- Planning composer placeholder targets the planning agent.
- Planning ready state leaves the composer enabled.
- Planning handoff note renders after planning output, not before the transcript.
- Promotion action copy is `Start implementation from selected plan`.

### Backend/Prompt Tests

- Planner prompt includes explicit guidance to ask clarifying questions before final artifacts when the request is underspecified.
- Planning follow-up messages still use the existing planning worker.
- A ready handoff still allows later revisions.

### Browser Journey

With approval, run a browser journey that:

1. Starts a planning conversation from a vague request.
2. Confirms the planner asks a clarifying question.
3. Answers it.
4. Confirms the plan appears in the main conversation flow.
5. Confirms the handoff note appears after the planner output.
6. Sends a revision after readiness.
7. Promotes the selected plan into implementation.

## Acceptance Criteria

- Planning reads as a normal conversation, not a supervisor run.
- Planner-readable output is the main conversation content.
- Artifact file mentions and promotion controls appear after the relevant planner output.
- The top of the session contains status only, not the full artifact widget.
- The planner asks questions for underspecified work.
- The user can continue revising after a plan is ready.
- Starting implementation remains an explicit action.
- All new frontend strings are translated through locale resources.

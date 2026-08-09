# Mobile Composer Settings Chips Design

## Goal

Make the mobile composer’s active configuration legible without forcing users to decode an opaque Settings button. Show the branch/workspace plus one unlabeled model-settings summary chip above the composer, with the existing settings dialog available from that chip.

## Approved behavior

- On mobile, show all applicable chips together in the composer’s existing floating control area.
- The branch/workspace chip remains visible for a new conversation, in the same rail location as before.
- Replace the four visible CLI/model/effort/account chips with one model-settings chip containing their current values in order, without visible field labels.
- The model-settings chip may grow as wide as needed within the composer and opens the existing bottom settings dialog.
- The dialog retains the labeled CLI, model, effort, and account controls, including the locked direct-worker state and existing native-select callbacks.
- Account is shown even when the only available option is Auto account, so the active setting is always discoverable.
- The chip rail is anchored above the composer and wraps naturally. Its bottom edge stays attached to the composer, so additional rows grow upward instead of consuming input space below.
- The previous opaque mobile Settings button is replaced by the summary chip; the existing settings sheet is restored as its controlled destination.
- Desktop selectors and the desktop branch/workspace placement retain their existing behavior.

## Product pass

Primary user story: a mobile user can see which CLI, model, effort, account, and workspace will be used before sending a prompt, then open the existing settings dialog to change any selectable value.

Supporting stories:

- A returning user can compare the restored selection against the current conversation before sending another message.
- A direct-mode user can see the locked CLI even though it cannot be changed.
- Long model or account names remain usable in the wide summary chip and through the dialog’s existing accessible controls.
- A new-conversation user can still change the branch/workspace without losing access to the composer settings.

Expected states covered by this milestone: normal values, locked CLI, Auto account, gateway account, unavailable/no-project branch control, disabled controls while submitting, and wrapped narrow-screen layout.

## Ownership and persistence

`HomeUiStateManager` and the existing composer selection props remain the source of truth; `ComposerUiManager` owns only the mobile dialog-open transition; `BranchWorkspaceButton` and `gitWorkspaceManager` continue to own workspace selection. Existing local-storage persistence for composer selections remains unchanged. The chip rail is a pure render of the latest selected values and does not persist translated labels.

## Accessibility and localization

- Use existing translated labels in the settings dialog and the settings chip’s accessible name; visible summary values do not add field labels.
- Preserve the existing aria labels on native selects and workspace controls.
- Preserve keyboard access through native selects and visible focus rings.
- Keep each mobile control at the composer’s existing touch-target height and ensure the chip wrapper does not remove focus visibility.
- Keep the rail within the composer width; the single summary chip may grow to the available width and the dialog preserves full native-select values.
- Implement the rail with `bottom-full`, `max-w-full`, `min-w-0`, and bounded/truncated value classes so native selects cannot widen the viewport.
- Keep the positioned composer wrapper `relative`, reserve a small gap above the input shell, and constrain only non-focusable value containers so wrapped rows cannot escape or cover the input. Do not clip the focusable rail or its focus rings.
- Avoid hardcoded visible UI strings.

## Verification

- Add a static-render component regression test for the summary chip and state variants; test the exported pure descriptor wiring used by the dialog for callback behavior; and add focused source-level assertions for upward anchoring, wrapping, new-vs-existing branch visibility, dialog restoration, desktop/mobile visibility, and removal of the four visible rail labels.
- Run the focused composer test, the complete Vitest suite, TypeScript checks, and the interface build.
- A live mobile user-journey test may be useful for visual wrapping and computed layout, but it requires explicit user approval and will not be run automatically.

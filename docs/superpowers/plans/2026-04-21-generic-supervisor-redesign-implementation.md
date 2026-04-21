## Goal

Replace the current plan/checklist supervisor core with a generic worker-supervision loop that:

- supervises one main external coding agent by default
- observes worker output snapshots over time
- treats waiting as a first-class action
- uses strict JSON tool/result envelopes
- persists visible failures instead of crashing on malformed tool traffic

## Steps

1. Add generic supervisor state and protocol helpers.
2. Replace the plan-bound supervisor prompt/tools/loop with a worker-observation loop.
3. Rewire run creation and recovery so reruns restart the generic supervisor without checklist logic.
4. Update event payloads and UI data flow to stop depending on checklist execution state for active runs.
5. Add regression tests for malformed tool payloads, idle-worker supervision, and recovery behavior.

## Checkpoints

- Tool messages sent back to Gemini must always be JSON envelopes.
- The supervisor must be able to spawn one worker, observe it, decide to wait, and resume later.
- Recovery actions must still cancel active workers and restart from the chosen user message.
- Existing visible failure and retry UX must keep working.

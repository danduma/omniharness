# Quota Resume Must Clear Stale UI State

When a quota wait resumes successfully, the run and incident can be correct while
the frontend still shows the old quota message. Two stale signals caused that:

- `state.recoveryState` can outlive the selected run's transition to a terminal
  status in merged client state.
- The worker row can keep the quota error in `current_text` or `last_text`,
  poisoning previews and fallback terminal rendering after the real work has
  completed.

Guard recovery UI by the selected run status, and clear worker live-text metadata
when quota resume reconnects and prompts the worker successfully. The durable
worker stream remains the source of conversation content.

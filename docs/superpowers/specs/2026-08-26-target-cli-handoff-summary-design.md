# Target-CLI Handoff Summary Design

**Date:** 2026-08-26

## Goal

Prepare a new cross-CLI session with a compact, readable continuation brief. The exhausted source CLI is never contacted, and the real target session never receives the internal handoff packet as raw JSON.

## Flow

1. Validate the selected target CLI, model, effort, and account.
2. Stop and fence the source conversation, then gather durable conversation, worker-stream, workspace, artifact, and verification evidence.
3. Compile that evidence into the bounded internal packet.
4. Spawn a disposable instance of the selected target CLI in read-only mode with the selected model, effort, and account.
5. Ask that temporary CLI to transform the packet into a strict structured report: current task, established progress, remaining work, blockers, open questions, and relevant files.
6. Validate the report, stop the temporary CLI, merge the report into the durable packet, and expose the prepared handoff.
7. On launch, render the packet as bounded human-readable Markdown and use that brief as the real target session's initial message.

The raw packet is input only to the disposable summarizer and remains persisted as internal evidence. It is never the real session's visible prompt.

## Failure Rules

- A missing, malformed, timed-out, or otherwise failed target summary fails preparation. The system does not launch with raw JSON or silently fall back to a fake summary.
- Temporary-agent cleanup is mandatory. A cleanup failure also fails preparation.
- Failures emit `handoff.summary_failed`, `handoff.failed`, and the stable user-facing `handoff.summary_failed` error code.
- Successful generation emits `handoff.summary_started` followed by `handoff.summary_completed`.

## Trust and State

- The source CLI is assumed unavailable and is never prompted.
- The temporary summarizer runs read-only and is instructed not to inspect files or execute the task.
- Durable packet facts remain authoritative. Generated progress and next steps are advisory and are marked with `summarySource: "target_summarizer"`.
- The launch fence and workspace fingerprint checks remain unchanged.

## Presentation

The real target prompt contains a compact Markdown brief with the original request, current objective, summarized progress, remaining work, blockers, useful recent context, relevant files, verification results, and decisions. Internal hashes, provenance records, packet JSON, and nonce boundaries are omitted.

## Verification

- Unit coverage proves the disposable agent uses the target CLI/model/effort/account, runs read-only, and is stopped after success or malformed output.
- Coordinator coverage proves summarization occurs after evidence gathering and before packet persistence, and that failure prevents launch.
- Renderer coverage rejects JSON, hashes, provenance, and internal boundary tags while enforcing a bounded prompt.
- Lifecycle coverage proves `handoff.summary_completed` reaches the event stream and the new target receives exactly one compact Markdown seed.

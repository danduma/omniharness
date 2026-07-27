# Model effort must be confirmed by the agent protocol

## Context

OmniHarness persisted `gpt-5.6-sol` and `low` as the requested Claude Code launch selection. The UI correctly redisplayed those values.

## Symptom

The live Claude session still reported its Effort config as Default even though the conversation and settings UI showed Low.

## Root cause

Launch metadata described the request but did not apply the ACP session configuration option. Treating persisted intent as effective runtime state hid that mismatch.

## Fix

After the Claude ACP session starts, the runtime calls `session/set_config_option` for the `effort` option and stores the returned configuration as the effective value. Runtime status distinguishes requested from effective model and effort.

## Verification and prevention

A protocol-level regression records the actual config call, and the live browser journey checks `requestedEffort` and `effectiveEffort` on every active worker. Runtime-dependent settings are complete only when the downstream agent confirms them.

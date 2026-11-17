import { describe, expect, it, vi } from "vitest";
import { encodeClaudeGatewayModel } from "@/lib/claude-model-gateway";
import {
  preflightBinding,
  preflightStageBindings,
  type BindingPreflightContext,
} from "@/server/orchestration/model-catalog";
import type { WorkerModelCatalog } from "@/server/worker-models";
import type { ModelBinding, WorkerModelBinding } from "@/shared/orchestration-policy";

const catalog: WorkerModelCatalog = {
  codex: [
    { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { value: "gpt-6-sol", label: "Sol" },
    { value: "gpt-6.1-sol", label: "Sol" },
  ],
  claude: [
    { value: "claude-opus-5-5", label: "Opus 5.5" },
    { value: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  ],
  gemini: [{ value: "gemini-3", label: "Gemini 3" }],
  opencode: [{ value: "anthropic/claude-sonnet-5-5", label: "Sonnet 5.5" }],
};

function context(overrides: Partial<BindingPreflightContext> = {}): BindingPreflightContext {
  return {
    catalog,
    availability: () => ({ installed: true, credentials: true }),
    isQuotaBlocked: vi.fn().mockResolvedValue(false),
    validateAccount: vi.fn().mockResolvedValue(undefined),
    decisionKeyConfigured: true,
    ...overrides,
  };
}

function worker(workerType: WorkerModelBinding["workerType"], model: string, extra: Partial<WorkerModelBinding> = {}): WorkerModelBinding {
  return {
    kind: "worker",
    workerType,
    model,
    effort: "high",
    credentialSource: null,
    accountId: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    maxCostUsd: null,
    ...extra,
  };
}

describe("binding preflight", () => {
  it("accepts canonical Claude and Codex bindings", async () => {
    await expect(preflightBinding(worker("claude", "claude-opus-5-5"), context())).resolves.toMatchObject({ status: "ready", canonicalModel: "claude-opus-5-5", diagnostics: [] });
    await expect(preflightBinding(worker("codex", "gpt-5.6-terra"), context())).resolves.toMatchObject({ status: "ready", canonicalModel: "gpt-5.6-terra" });
  });

  it("reports an unavailable binary", async () => {
    const result = await preflightBinding(worker("codex", "gpt-5.6-terra"), context({ availability: () => ({ installed: false, credentials: false }) }));
    expect(result).toMatchObject({ status: "unavailable", diagnostics: ["binary_missing"] });
  });

  it("reports missing credentials and an invalid explicit account", async () => {
    const missing = await preflightBinding(worker("claude", "claude-opus-5-5"), context({ availability: () => ({ installed: true, credentials: false }) }));
    expect(missing).toMatchObject({ status: "credential_missing", diagnostics: ["credentials_missing"] });
    const account = await preflightBinding(
      worker("claude", "claude-opus-5-5", { accountId: "acct-1" }),
      context({ validateAccount: vi.fn().mockRejectedValue(new Error("disabled")) }),
    );
    expect(account).toMatchObject({ status: "credential_missing", diagnostics: ["account_invalid"] });
  });

  it("reports a quota block", async () => {
    const result = await preflightBinding(worker("codex", "gpt-5.6-terra"), context({ isQuotaBlocked: vi.fn().mockResolvedValue(true) }));
    expect(result.status).toBe("quota_blocked");
  });

  it("accepts a Claude gateway model and refuses one for another CLI", async () => {
    const model = encodeClaudeGatewayModel("vendor/frontier-model");
    const ok = await preflightBinding(worker("claude", model), context({ availability: () => ({ installed: true, credentials: false }) }));
    expect(ok).toMatchObject({ status: "ready", canonicalModel: model, diagnostics: ["gateway_model"] });
    const refused = await preflightBinding(worker("codex", model), context());
    expect(refused).toMatchObject({ status: "identity_mismatch", diagnostics: ["gateway_not_supported"] });
  });

  it("accepts an exact unambiguous alias", async () => {
    const result = await preflightBinding(worker("codex", "GPT-5.6 Terra"), context());
    expect(result).toMatchObject({ status: "ready", canonicalModel: "gpt-5.6-terra", diagnostics: ["alias_resolved"] });
  });

  it("refuses ambiguous and cross-family aliases", async () => {
    await expect(preflightBinding(worker("codex", "Sol"), context())).resolves.toMatchObject({ status: "identity_mismatch", diagnostics: ["model_ambiguous"] });
    await expect(preflightBinding(worker("codex", "claude-opus-5-5"), context())).resolves.toMatchObject({ status: "identity_mismatch", diagnostics: ["model_cross_family"] });
    // "Sonnet 5.5" names a Claude model and an OpenCode model: ambiguous across families.
    await expect(preflightBinding(worker("claude", "Sonnet 5.5"), context())).resolves.toMatchObject({ status: "identity_mismatch", diagnostics: ["model_ambiguous"] });
  });

  it("reports an unknown model as unavailable", async () => {
    await expect(preflightBinding(worker("codex", "gpt-9-imaginary"), context())).resolves.toMatchObject({ status: "unavailable", diagnostics: ["model_unknown"] });
  });

  it("checks the decision-layer key for triage bindings", async () => {
    const binding: ModelBinding = { kind: "decision", model: "typesafe-ai/jev", maxInputTokens: null, maxOutputTokens: null, maxCostUsd: null };
    await expect(preflightBinding(binding, context())).resolves.toMatchObject({ status: "ready" });
    await expect(preflightBinding(binding, context({ decisionKeyConfigured: false }))).resolves.toMatchObject({ status: "credential_missing", diagnostics: ["decision_key_missing"] });
  });

  it("has no side effects beyond the injected probes", async () => {
    const ctx = context();
    await preflightBinding(worker("claude", "claude-opus-5-5", { accountId: "acct-1" }), ctx);
    expect(ctx.validateAccount).toHaveBeenCalledWith("claude", "acct-1");
  });

  it("tries fallbacks in order but never past an identity mismatch", async () => {
    const quota = vi.fn(async (type: string) => type === "codex");
    const fallback = await preflightStageBindings({
      primary: worker("codex", "gpt-5.6-terra"),
      fallbacks: [worker("claude", "claude-opus-5-5")],
      allowFallbacks: true,
    }, context({ isQuotaBlocked: quota }));
    expect(fallback.usedFallback).toBe(true);
    expect(fallback.selected?.canonicalModel).toBe("claude-opus-5-5");

    const pinned = await preflightStageBindings({
      primary: worker("codex", "gpt-5.6-terra"),
      fallbacks: [worker("claude", "claude-opus-5-5")],
      allowFallbacks: false,
    }, context({ isQuotaBlocked: quota }));
    expect(pinned.selected).toBeNull();

    const mismatch = await preflightStageBindings({
      primary: worker("codex", "claude-opus-5-5"),
      fallbacks: [worker("claude", "claude-opus-5-5")],
      allowFallbacks: true,
    }, context());
    expect(mismatch.selected).toBeNull();
    expect(mismatch.attempts).toHaveLength(1);
  });
});

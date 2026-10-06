import { describe, expect, it } from "vitest";
import {
  applyProviderConfigOptions,
  beginProviderConfigChange,
  markProviderConfigUnconfirmed,
  rejectProviderConfigChange,
} from "@/server/agent-runtime/config-state";
import type { AgentRecord } from "@/server/agent-runtime/types";

function record(): AgentRecord {
  return {
    requestedModel: null, pendingModel: null, effectiveModel: null, rejectedModel: null, modelStatus: "unset", modelConfigRevision: 0,
    requestedEffort: null, pendingEffort: null, effectiveEffort: null, rejectedEffort: null, effortStatus: "unset", effortConfigRevision: 0,
  } as AgentRecord;
}

describe("provider configuration state", () => {
  it("keeps a requested effort pending until provider configuration proves it effective", () => {
    const agent = record();
    beginProviderConfigChange(agent, "reasoning_effort", "extra high");
    expect(agent).toMatchObject({ requestedEffort: "xhigh", pendingEffort: "xhigh", effectiveEffort: null, effortStatus: "pending" });

    applyProviderConfigOptions(agent, [{ id: "reasoning_effort", currentValue: "xhigh" }]);
    expect(agent).toMatchObject({ pendingEffort: null, effectiveEffort: "xhigh", rejectedEffort: null, effortStatus: "effective" });
  });

  it("marks omitted acknowledgements unknown instead of retaining the pre-change value", () => {
    const agent = record();
    agent.effectiveEffort = "low";
    beginProviderConfigChange(agent, "effort", "high");
    markProviderConfigUnconfirmed(agent, "effort");

    expect(agent).toMatchObject({ requestedEffort: "high", pendingEffort: null, effectiveEffort: null, effortStatus: "unknown" });
  });

  it("records rejected requested values separately from the last observed value", () => {
    const agent = record();
    agent.effectiveEffort = "low";
    beginProviderConfigChange(agent, "effort", "max");
    rejectProviderConfigChange(agent, "effort");

    expect(agent).toMatchObject({ effectiveEffort: "low", rejectedEffort: "max", pendingEffort: null, effortStatus: "rejected" });
  });

  it("treats equivalent provider-qualified model ids as the same model", () => {
    const agent = record();
    beginProviderConfigChange(agent, "model", "gpt-5.6-sol");
    applyProviderConfigOptions(agent, [{ id: "model", currentValue: "openai/gpt-5.6-sol" }]);

    expect(agent).toMatchObject({
      requestedModel: "gpt-5.6-sol",
      pendingModel: null,
      effectiveModel: "openai/gpt-5.6-sol",
      rejectedModel: null,
      modelStatus: "effective",
    });
  });

  it("ignores an older configuration response after a newer request starts", () => {
    const agent = record();
    const older = beginProviderConfigChange(agent, "effort", "low");
    const newer = beginProviderConfigChange(agent, "effort", "high");

    applyProviderConfigOptions(agent, [{ id: "effort", currentValue: "low" }], older);
    expect(agent).toMatchObject({ pendingEffort: "high", requestedEffort: "high", effectiveEffort: null, effortStatus: "pending" });

    applyProviderConfigOptions(agent, [{ id: "effort", currentValue: "high" }], newer);
    expect(agent).toMatchObject({ pendingEffort: null, effectiveEffort: "high", rejectedEffort: null, effortStatus: "effective" });
  });

  it("does not let one setting response overwrite a concurrently acknowledged setting", () => {
    const agent = record();
    const modelOperation = beginProviderConfigChange(agent, "model", "gpt-5.6-sol");
    const effortOperation = beginProviderConfigChange(agent, "effort", "high");
    applyProviderConfigOptions(agent, [{ id: "effort", currentValue: "high" }], effortOperation);

    applyProviderConfigOptions(agent, [
      { id: "model", currentValue: "gpt-5.6-sol" },
      { id: "effort", currentValue: "low" },
    ], modelOperation);

    expect(agent).toMatchObject({
      effectiveModel: "gpt-5.6-sol",
      modelStatus: "effective",
      effectiveEffort: "high",
      effortStatus: "effective",
    });
  });
});

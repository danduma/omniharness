import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationPolicySettings } from "@/components/settings/OrchestrationPolicySettings";
import { OrchestrationManager } from "@/interface/orchestration/OrchestrationManager";
import { i18nManager } from "@/lib/i18n";
import { RuntimeApiProvider } from "@/runtime-api/provider";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";

const apis = { orchestration: { getPolicy: async () => ({}), savePolicy: async () => ({}), preflight: async () => ({}) } } as unknown as RuntimeAPIs;

let orchestrationManager: OrchestrationManager;

/** SSR renders a manager's initial state, so each render snapshots the live one into a fresh manager. */
function render() {
  const rendered = new OrchestrationManager(orchestrationManager.getSnapshot());
  return renderToStaticMarkup(
    <RuntimeApiProvider apis={apis}>
      <OrchestrationPolicySettings manager={rendered} />
    </RuntimeApiProvider>,
  );
}

beforeEach(() => {
  const policy = createDefaultOrchestrationPolicy();
  orchestrationManager = new OrchestrationManager({
    policyStatus: "ready",
    savedPolicy: policy,
    defaultPolicy: policy,
    draft: JSON.parse(JSON.stringify(policy)),
  });
});

afterEach(async () => {
  await i18nManager.setLocaleAsync("en");
});

describe("OrchestrationPolicySettings", () => {
  it("compares the four profiles with their real bindings and caps", () => {
    const html = render();
    for (const label of ["Economy", "Balanced", "Thorough", "Custom"]) expect(html).toContain(`>${label}<`);
    expect(html).toContain("Claude Code · claude-opus-5-5 · high");
    expect(html).toContain("Codex · gpt-5.6-terra · high");
    expect(html).toContain("Decision layer · typesafe-ai/jev");
    expect(html).toMatch(/Workflow cap: [^<]+ tokens/);
    expect(html).toContain("unknown usage can never exceed a cap");
  });

  it("makes only the custom profile editable", () => {
    const html = render();
    expect(html.match(/aria-label="Model for /g)?.length).toBe(5);
  });

  it("shows validation issues and disables save", () => {
    orchestrationManager.updateCustomBinding("code_review", { workerType: "codex" });
    const html = render();
    expect(html).toContain("The code reviewer must use a different agent than the implementer.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save policy<\/button>/);
  });

  it("shows preflight results per stage", () => {
    orchestrationManager.update((current) => ({
      ...current,
      preflightByProfile: {
        balanced: {
          status: "ready",
          report: {
            runId: "",
            profile: "balanced",
            ready: false,
            stages: [
              { stage: "plan", status: "ready", selected: null, attempts: [] },
              { stage: "implement", status: "identity_mismatch", selected: null, attempts: [] },
            ],
          },
        },
      },
    }));
    const html = render();
    expect(html).toContain("Model mismatch");
    expect(html).toContain("Some stage bindings are unavailable.");
  });

  it("never renders credentials", () => {
    expect(render()).not.toMatch(/api[_-]?key|sk-[a-z]/i);
  });

  it("re-renders in the selected language", async () => {
    await i18nManager.setLocaleAsync("ja");
    const html = render();
    expect(html).toContain("スペシャリスト・オーケストレーション");
    expect(html).toContain("バランス");
  });
});

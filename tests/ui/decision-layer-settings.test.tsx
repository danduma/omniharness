import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionLayerSettings } from "@/components/settings/DecisionLayerSettings";

function render(settings: Record<string, string>, configured: boolean) {
  return renderToStaticMarkup(
    <DecisionLayerSettings
      settings={settings}
      setSetting={() => undefined}
      status={{ gatewayKeyConfigured: configured, gatewayKeySource: configured ? "env" : "none" }}
    />,
  );
}

describe("DecisionLayerSettings", () => {
  it("never offers a field for the API key and explains where it comes from", () => {
    const html = render({}, false);
    expect(html).not.toContain("AI_GATEWAY_API_KEY\"");
    expect(html).not.toMatch(/type="password"/);
    expect(html).toContain("No AI Gateway key on the server. Set AI_GATEWAY_API_KEY in the server environment and restart.");
    expect(render({}, true)).toContain("AI Gateway key found in the server environment (AI_GATEWAY_API_KEY).");
  });

  it("is off by default and disables dependent controls until enabled", () => {
    const off = render({}, true);
    expect(off).toMatch(/id="decision-layer-enabled"[^>]*aria-checked="false"|aria-checked="false"[^>]*id="decision-layer-enabled"/);
    expect(off).toMatch(/<input[^>]*id="decision-layer-model"[^>]*disabled=""/);

    const on = render({ DECISION_LAYER_ENABLED: "true" }, true);
    expect(on).not.toMatch(/<input[^>]*id="decision-layer-model"[^>]*disabled=""/);
    expect(on).toMatch(/placeholder="typesafe-ai\/jev"/);
  });

  it("states that decisions are recorded only and offers per-point toggles", () => {
    const html = render({ DECISION_LAYER_ENABLED: "true", DECISION_POINTS: JSON.stringify(["worker_activity"]) }, true);
    expect(html).toContain("Enabled points only record their decisions next to the current behavior.");
    expect(html).not.toContain('id="decision-layer-shadow"');
    expect(html).toMatch(/id="decision-point-supervisor_wake"[^>]*aria-checked="false"|aria-checked="false"[^>]*id="decision-point-supervisor_wake"/);
    expect(html).toMatch(/id="decision-point-worker_activity"[^>]*aria-checked="true"|aria-checked="true"[^>]*id="decision-point-worker_activity"/);
  });

  it("offers acting only for enabled points and states each point's limits", () => {
    const html = render({ DECISION_LAYER_ENABLED: "true", DECISION_POINTS: JSON.stringify(["supervisor_wake"]), DECISION_ACTING_POINTS: JSON.stringify(["supervisor_wake"]) }, true);
    expect(html).toMatch(/<button[^>]*id="decision-acting-supervisor_wake"[^>]*aria-checked="true"|aria-checked="true"[^>]*id="decision-acting-supervisor_wake"/);
    expect(html).toMatch(/<button[^>]*id="decision-acting-worker_activity"[^>]*disabled=""|disabled=""[^>]*id="decision-acting-worker_activity"/);
    expect(html).toContain("May postpone a wake-up by 2 minutes");
    expect(html).toContain("Display only.");
  });

  it("enables text tasks only once a fast text model is set", () => {
    const without = render({ DECISION_LAYER_ENABLED: "true" }, true);
    expect(without).toContain("Fast text tasks");
    expect(without).toMatch(/<button[^>]*id="decision-text-task-conversation_title"[^>]*disabled=""|disabled=""[^>]*id="decision-text-task-conversation_title"/);

    const withModel = render({ DECISION_LAYER_ENABLED: "true", DECISION_TEXT_MODEL: "provider/small-model", DECISION_TEXT_TASKS: JSON.stringify(["conversation_title"]) }, true);
    expect(withModel).toMatch(/<button[^>]*id="decision-text-task-conversation_title"[^>]*aria-checked="true"|aria-checked="true"[^>]*id="decision-text-task-conversation_title"/);
    expect(withModel).not.toMatch(/<button[^>]*id="decision-text-task-conversation_title"[^>]*disabled=""/);
  });
});

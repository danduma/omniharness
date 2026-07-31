import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  RunnerConnectionStatusPanel,
  RunnerSwitcherButton,
} from "@/interface/runners/RunnerSwitcher";

describe("runner switcher UI", () => {
  it("renders an accessible active runner control with bounded activity", () => {
    const html = renderToStaticMarkup(
      <RunnerSwitcherButton
        runnerName="Studio"
        status="online"
        activity={{ needsInput: 2, running: 4 }}
        expanded={false}
      />,
    );

    expect(html).toContain('id="runner-switcher"');
    expect(html).toContain('aria-label="Switch runner. Studio is Online."');
    expect(html).toContain("2");
    expect(html).toContain("4");
  });

  it("shows runner controls in the remote-only Electron shell", () => {
    expect(renderToStaticMarkup(
      <RunnerSwitcherButton
        runnerName="Local"
        status="online"
        activity={{ needsInput: 0, running: 0 }}
        expanded={false}
        surface="electron"
      />,
    )).toContain('id="runner-switcher"');
  });

  it("renders specific recovery actions for reauth, TLS, identity, incompatibility, and deferred states", () => {
    for (const [status, expected] of [
      ["needs-reauth", "Authorize again"],
      ["tls-untrusted", "Review certificate"],
      ["identity-mismatch", "Review identity"],
      ["incompatible", "Update required"],
      ["deferred", "Runner is waiting"],
    ] as const) {
      const html = renderToStaticMarkup(
        <RunnerConnectionStatusPanel
          runnerName="Studio"
          status={status}
          onAction={() => {}}
        />,
      );
      expect(html).toContain(expected);
    }
  });
});

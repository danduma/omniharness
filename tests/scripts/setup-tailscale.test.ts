import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(process.cwd(), "scripts/setup-tailscale.mjs");
const tempRoots: string[] = [];

function createFixture(options: {
  backendState?: string;
  dnsName?: string;
  serveFails?: boolean;
  serveStatusFails?: boolean;
  serveStatus?: unknown;
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-tailscale-"));
  tempRoots.push(root);
  const binDir = path.join(root, "bin");
  const logPath = path.join(root, "tailscale.log");
  const tailscalePath = path.join(binDir, "tailscale");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(tailscalePath, `#!/bin/sh
echo "$@" >> "$OMNI_TEST_TAILSCALE_LOG"
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' "$OMNI_TEST_TAILSCALE_STATUS"
  exit 0
fi
if [ "$1" = "serve" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  if [ "$OMNI_TEST_TAILSCALE_SERVE_STATUS_FAILS" = "1" ]; then
    echo "cannot inspect Serve configuration" >&2
    exit 1
  fi
  printf '%s\n' "$OMNI_TEST_TAILSCALE_SERVE_STATUS"
  exit 0
fi
if [ "$OMNI_TEST_TAILSCALE_SERVE_FAILS" = "1" ]; then
  echo "Serve permission denied; configure an operator or administrator" >&2
  exit 1
fi
exit 0
`);
  fs.chmodSync(tailscalePath, 0o755);
  return {
    root,
    logPath,
    tailscalePath,
    env: {
      ...process.env,
      OMNIHARNESS_TAILSCALE_BIN: tailscalePath,
      OMNI_TEST_TAILSCALE_LOG: logPath,
      OMNI_TEST_TAILSCALE_STATUS: JSON.stringify({
        BackendState: options.backendState ?? "Running",
        Self: { DNSName: options.dnsName ?? "studio.example-tailnet.ts.net." },
      }),
      OMNI_TEST_TAILSCALE_SERVE_FAILS: options.serveFails ? "1" : "0",
      OMNI_TEST_TAILSCALE_SERVE_STATUS_FAILS: options.serveStatusFails ? "1" : "0",
      OMNI_TEST_TAILSCALE_SERVE_STATUS: JSON.stringify(options.serveStatus ?? {}),
    },
  };
}

function run(
  fixture: ReturnType<typeof createFixture>,
  args: string[] = [],
  env: NodeJS.ProcessEnv = fixture.env,
) {
  return spawnSync(process.execPath, [scriptPath, "--root", fixture.root, ...args], {
    encoding: "utf8",
    env,
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("Tailscale private access setup", () => {
  it("accepts option forwarding through the documented pnpm command", () => {
    const fixture = createFixture();
    const result = spawnSync(
      "pnpm",
      ["setup:tailscale", "--", "--root", fixture.root, "--dry-run"],
      {
      cwd: process.cwd(),
      encoding: "utf8",
      env: fixture.env,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Would run: tailscale serve --bg http://127.0.0.1:3050");
  });

  it("fails with an install link before changing anything when Tailscale is missing", () => {
    const fixture = createFixture();
    const result = run(fixture, [], {
      ...fixture.env,
      OMNIHARNESS_TAILSCALE_BIN: path.join(fixture.root, "missing-tailscale"),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("https://tailscale.com/download/mac");
    expect(fs.existsSync(path.join(fixture.root, ".env"))).toBe(false);
  });

  it("fails without invoking Serve when the Mac is not connected to a tailnet", () => {
    const fixture = createFixture({ backendState: "Stopped" });
    const result = run(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("tailscale up");
    expect(fs.readFileSync(fixture.logPath, "utf8")).toBe("status --json\n");
    expect(fs.existsSync(path.join(fixture.root, ".env"))).toBe(false);
  });

  it("shows the exact private Serve change in dry-run mode without mutating state", () => {
    const fixture = createFixture();
    const result = run(fixture, ["--dry-run"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("https://studio.example-tailnet.ts.net");
    expect(result.stdout).toContain("tailscale serve --bg http://127.0.0.1:3050");
    expect(fs.readFileSync(fixture.logPath, "utf8")).toBe("status --json\nserve status --json\n");
    expect(fs.existsSync(path.join(fixture.root, ".env"))).toBe(false);
  });

  it("treats null Serve status as an empty fresh-machine configuration", () => {
    const fixture = createFixture({ serveStatus: null });
    const result = run(fixture, ["--dry-run"]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("tailscale serve --bg http://127.0.0.1:3050");
  });

  it("fails closed when existing Serve configuration cannot be inspected", () => {
    const fixture = createFixture({ serveStatusFails: true });
    const result = run(fixture, ["--force"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Could not inspect existing Tailscale Serve configuration");
    expect(fs.readFileSync(fixture.logPath, "utf8")).not.toContain("serve --bg");
  });

  it("refuses unrelated Serve configuration even when its target shares a port prefix", () => {
    const fixture = createFixture({
      serveStatus: {
        Web: {
          "studio.example-tailnet.ts.net:443": {
            Handlers: { "/": { Proxy: "http://127.0.0.1:30500" } },
          },
        },
      },
    });
    const result = run(fixture, ["--force"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("will not replace it");
    expect(fs.readFileSync(fixture.logPath, "utf8")).not.toContain("serve --bg");
  });

  it("configures private Serve and atomically writes owned OmniHarness settings", () => {
    const fixture = createFixture();
    fs.writeFileSync(path.join(fixture.root, ".env"), "EXISTING_SETTING=kept\n");
    const result = run(fixture);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(fixture.logPath, "utf8")).toContain(
      "serve --bg http://127.0.0.1:3050",
    );
    expect(fs.readFileSync(path.join(fixture.root, ".env"), "utf8")).toBe(
      "EXISTING_SETTING=kept\n\n"
      + "# omniharness-tailscale-managed:start\n"
      + "OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\n"
      + "OMNIHARNESS_RUNNER_HOST=127.0.0.1\n"
      + "# omniharness-tailscale-managed:end\n",
    );
  });

  it("refuses to replace an existing public or LAN deployment without --force", () => {
    const fixture = createFixture();
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\nOMNIHARNESS_RUNNER_HOST=0.0.0.0\n",
    );
    const result = run(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--force");
    expect(fs.readFileSync(envPath, "utf8")).toContain("https://public.example.com");
    expect(fs.readFileSync(fixture.logPath, "utf8")).not.toContain("serve --bg");
  });

  it("preserves overridden values as comments when --force is explicit", () => {
    const fixture = createFixture();
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\nOMNIHARNESS_RUNNER_HOST=0.0.0.0\n",
    );
    const result = run(fixture, ["--force"]);

    expect(result.status).toBe(0);
    const envText = fs.readFileSync(envPath, "utf8");
    expect(envText).toContain("# omniharness-tailscale-previous: OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com");
    expect(envText).toContain("# omniharness-tailscale-previous: OMNIHARNESS_RUNNER_HOST=0.0.0.0");
    expect(envText).toContain("OMNIHARNESS_RUNNER_HOST=127.0.0.1");
  });

  it("leaves .env unchanged when Tailscale refuses Serve configuration", () => {
    const fixture = createFixture({ serveFails: true });
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(envPath, "EXISTING_SETTING=kept\n");
    const result = run(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Serve permission denied");
    expect(result.stderr).toContain("administrator");
    expect(fs.readFileSync(envPath, "utf8")).toBe("EXISTING_SETTING=kept\n");
    expect(fs.readdirSync(fixture.root).filter((name) => name.includes("tailscale.tmp"))).toEqual([]);
  });

  it("removes only managed settings and disables the owned HTTPS listener on reset", () => {
    const fixture = createFixture({
      serveStatus: {
        Web: {
          "studio.example-tailnet.ts.net:443": {
            Handlers: { "/": { Proxy: "http://127.0.0.1:3050" } },
          },
        },
      },
    });
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "EXISTING_SETTING=kept\n\n"
      + "# omniharness-tailscale-managed:start\n"
      + "OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\n"
      + "OMNIHARNESS_RUNNER_HOST=127.0.0.1\n"
      + "# omniharness-tailscale-managed:end\n",
    );
    const result = run(fixture, ["--reset"]);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(fixture.logPath, "utf8")).toContain("serve --https=443 off");
    expect(fs.readFileSync(envPath, "utf8")).toBe("EXISTING_SETTING=kept\n");
  });

  it("does not disable Serve on reset unless OmniHarness owns the configuration", () => {
    const fixture = createFixture({
      serveStatus: {
        Web: {
          "studio.example-tailnet.ts.net:443": {
            Handlers: { "/other": { Proxy: "http://127.0.0.1:4000" } },
          },
        },
      },
    });
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "# omniharness-tailscale-managed:start\n"
      + "OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\n"
      + "OMNIHARNESS_RUNNER_HOST=127.0.0.1\n"
      + "# omniharness-tailscale-managed:end\n",
    );

    const result = run(fixture, ["--reset"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("will not replace it");
    expect(fs.readFileSync(fixture.logPath, "utf8")).not.toContain("serve --https=443 off");
    expect(fs.readFileSync(envPath, "utf8")).toContain("omniharness-tailscale-managed:start");
  });

  it("does not touch Serve when reset is requested without a managed env block", () => {
    const fixture = createFixture();
    const result = run(fixture, ["--reset"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No managed OmniHarness Tailscale setup");
    expect(fs.existsSync(fixture.logPath)).toBe(false);
  });
});

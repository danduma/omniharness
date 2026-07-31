import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRemoteRunnerToken } from "@/server/cli/credentials";

describe("remote runner CLI credentials", () => {
  it("reads OMNI_TOKEN, a protected token file, or stdin without argv", async () => {
    await expect(resolveRemoteRunnerToken({
      env: { OMNI_TOKEN: "env-token" },
      tokenFile: null,
      tokenStdin: false,
      legacyToken: null,
    })).resolves.toEqual({ token: "env-token", warning: null });

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-cli-token-"));
    const tokenFile = path.join(root, "token");
    fs.writeFileSync(tokenFile, "file-token\n", { mode: 0o600 });
    await expect(resolveRemoteRunnerToken({
      env: {},
      tokenFile,
      tokenStdin: false,
      legacyToken: null,
    })).resolves.toEqual({ token: "file-token", warning: null });

    await expect(resolveRemoteRunnerToken({
      env: {},
      tokenFile: null,
      tokenStdin: true,
      legacyToken: null,
      readStdin: async () => "stdin-token\n",
    })).resolves.toEqual({ token: "stdin-token", warning: null });
  });

  it("warns when the legacy argv token is used without echoing it", async () => {
    const result = await resolveRemoteRunnerToken({
      env: {},
      tokenFile: null,
      tokenStdin: false,
      legacyToken: "do-not-print",
    });
    expect(result.token).toBe("do-not-print");
    expect(result.warning).toContain("process list");
    expect(result.warning).not.toContain("do-not-print");
  });
});

import type { OmniCliOptions } from "@/server/cli/options";

function normalizeRunnerUrl(value: string) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Remote servers require HTTPS; loopback HTTP is allowed for local development.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: string } | string;
  } | null;
  if (typeof body?.error === "string") {
    return body.error;
  }
  return body?.error?.message || `Server request failed with HTTP ${response.status}.`;
}

export async function createRemoteConversation(input: {
  runnerUrl: string;
  token: string;
  options: OmniCliOptions;
  fetchImpl?: typeof fetch;
}) {
  const runner = normalizeRunnerUrl(input.runnerUrl);
  const response = await (input.fetchImpl ?? fetch)(
    new URL("/api/conversations", runner),
    {
      method: "POST",
      redirect: "manual",
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessionType: "omni",
        mode: input.options.mode,
        command: input.options.command,
        projectPath: input.options.projectPath,
        preferredWorkerType: input.options.preferredWorkerType,
        preferredWorkerModel: input.options.preferredWorkerModel,
        preferredWorkerEffort: input.options.preferredWorkerEffort,
        allowedWorkerTypes: input.options.allowedWorkerTypes,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return await response.json() as {
    ok: true;
    runId: string;
    planId: string | null;
    mode?: string;
  };
}

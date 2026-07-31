import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertLoopbackUrl,
  assertManifestOwnsRun,
  assertOwnedTempProject,
  assertProjectMarkerMatches,
  readLiveJourneyManifest,
} from "../tests/e2e/live/safety";
import { resolveLiveJourneyProjectRoot } from "../tests/e2e/live/project-fixture";

export interface LiveJourneyCleanupTransport {
  deleteRun(runId: string): Promise<number>;
  listRunIds(): Promise<string[]>;
  removeProject(projectPath: string): Promise<void>;
}

export interface LiveJourneyCleanupResult {
  deletedRunIds: string[];
  alreadyAbsentRunIds: string[];
  projectPath: string;
}

export async function cleanupLiveAgentJourney(args: {
  manifestPath: string;
  repoRoot: string;
  tempRoot?: string;
  transport: LiveJourneyCleanupTransport;
}): Promise<LiveJourneyCleanupResult> {
  const manifest = readLiveJourneyManifest(path.resolve(args.manifestPath));
  const tempRoot = args.tempRoot ?? resolveLiveJourneyProjectRoot(args.repoRoot);
  assertOwnedTempProject({
    projectPath: manifest.projectPath,
    repoRoot: args.repoRoot,
    tempRoot,
  });
  assertProjectMarkerMatches(manifest.projectPath, manifest);

  const deletedRunIds: string[] = [];
  const alreadyAbsentRunIds: string[] = [];
  for (const run of manifest.runs) {
    assertManifestOwnsRun(manifest, run.id);
    const status = await args.transport.deleteRun(run.id);
    if (status === 404) {
      alreadyAbsentRunIds.push(run.id);
    } else if (status >= 200 && status < 300) {
      deletedRunIds.push(run.id);
    } else {
      throw new Error(`Cleanup delete for owned run ${run.id} returned status ${status}.`);
    }
  }

  const remaining = new Set(await args.transport.listRunIds());
  const ownedStillPresent = manifest.runs.filter((run) => remaining.has(run.id));
  if (ownedStillPresent.length > 0) {
    throw new Error(`Owned runs are still present after cleanup: ${ownedStillPresent.map((run) => run.id).join(", ")}`);
  }

  await args.transport.removeProject(manifest.projectPath);
  assertProjectMarkerMatches(manifest.projectPath, manifest);
  fs.rmSync(manifest.projectPath, { recursive: true, force: true });
  return { deletedRunIds, alreadyAbsentRunIds, projectPath: manifest.projectPath };
}

function cookieFromLoginResponse(response: Response): string {
  const headersWithCookies = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headersWithCookies.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const sessionCookie = values
    .map((value) => value.match(/(?:^|;\s*)(omni_session=[^;]+)/)?.[1] ?? null)
    .find((value): value is string => Boolean(value));
  if (!sessionCookie) throw new Error("Cleanup login did not return a session cookie.");
  return sessionCookie;
}

async function createAuthenticatedTransport(args: {
  baseURL: string;
  password: string;
}): Promise<LiveJourneyCleanupTransport> {
  const login = await fetch(`${args.baseURL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: args.baseURL,
    },
    body: JSON.stringify({ password: args.password, label: "Live journey cleanup" }),
  });
  if (!login.ok) throw new Error(`Cleanup login failed with status ${login.status}.`);
  const cookie = cookieFromLoginResponse(login);
  const authenticatedFetch = (pathname: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Cookie", cookie);
    if (init.method && init.method !== "GET") headers.set("Origin", args.baseURL);
    return fetch(`${args.baseURL}${pathname}`, { ...init, headers });
  };

  return {
    deleteRun: async (runId) => (
      await authenticatedFetch(`/api/runs/${encodeURIComponent(runId)}`, { method: "DELETE" })
    ).status,
    listRunIds: async () => {
      const response = await authenticatedFetch("/api/events?snapshot=1&persisted=1");
      if (!response.ok) throw new Error(`Cleanup snapshot failed with status ${response.status}.`);
      const payload = await response.json() as { runs?: Array<{ id?: unknown }> };
      return (payload.runs ?? []).flatMap((run) => typeof run.id === "string" ? [run.id] : []);
    },
    removeProject: async (projectPath) => {
      const response = await authenticatedFetch("/api/settings");
      if (!response.ok) throw new Error(`Cleanup settings read failed with status ${response.status}.`);
      const payload = await response.json() as { values?: Record<string, unknown> };
      const rawProjects = payload.values?.PROJECTS;
      let projects: string[] = [];
      if (typeof rawProjects === "string" && rawProjects.trim()) {
        const parsed = JSON.parse(rawProjects) as unknown;
        if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
          throw new Error("Cleanup refused an invalid PROJECTS setting.");
        }
        projects = parsed;
      }
      if (!projects.includes(projectPath)) return;
      const save = await authenticatedFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ PROJECTS: JSON.stringify(projects.filter((entry) => entry !== projectPath)) }),
      });
      if (!save.ok) throw new Error(`Cleanup settings update failed with status ${save.status}.`);
    },
  };
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2]?.trim();
  if (!manifestPath) {
    throw new Error("Usage: pnpm test:e2e:live:cleanup -- <manifest-path>");
  }
  if (process.env.OMNIHARNESS_LIVE_E2E !== "1") {
    throw new Error("Set OMNIHARNESS_LIVE_E2E=1 to authorize targeted live cleanup.");
  }
  const password = process.env.OMNIHARNESS_LIVE_E2E_PASSWORD?.trim();
  if (!password) throw new Error("Set OMNIHARNESS_LIVE_E2E_PASSWORD for targeted live cleanup.");
  const baseURL = assertLoopbackUrl(
    process.env.OMNIHARNESS_LIVE_E2E_BASE_URL?.trim() || "http://127.0.0.1:3050",
  ).origin;
  const transport = await createAuthenticatedTransport({ baseURL, password });
  const result = await cleanupLiveAgentJourney({
    manifestPath,
    repoRoot: process.cwd(),
    transport,
  });
  process.stdout.write(`Cleaned ${result.deletedRunIds.length + result.alreadyAbsentRunIds.length} owned runs and ${result.projectPath}.\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

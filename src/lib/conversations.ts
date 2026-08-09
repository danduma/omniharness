import { t } from "@/lib/i18n";
import { normalizeExplicitProjectPaths, normalizeProjectPath, resolveStaleProjectFallback, resolveStoredProjectRoot } from "@/lib/project-paths";

type PlanRecord = { id: string; path: string };
type RunRecord = {
  id: string;
  planId: string;
  mode?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  lastActivityAt?: string | null;
  projectPath?: string | null;
  title?: string | null;
  preferredWorkerType?: string | null;
};

export type ConversationGroup = {
  path: string;
  name: string;
  runs: Array<{
    id: string;
    title: string;
    path: string;
    mode?: string | null;
    status: string;
    createdAt: string;
    updatedAt?: string | null;
    lastActivityAt?: string | null;
    preferredWorkerType?: string | null;
  }>;
};

function timestampMs(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Order sessions by conversation activity, newest first.
 *
 * `lastActivityAt` is written server-side on the last user message and the last
 * finished agent turn (see the `runs_activity_*` triggers in
 * `src/server/db/index.ts`). Sorting here rather than relying on the snapshot's
 * `ORDER BY` matters because `EventStreamStateManager` merges runs by id and
 * appends unseen ones to the end — an optimistically created run would
 * otherwise sink to the bottom of its project until the next full snapshot.
 */
function compareConversationRunsDesc(
  a: { lastActivityAt?: string | null; createdAt: string; id: string },
  b: { lastActivityAt?: string | null; createdAt: string; id: string },
) {
  const activityDiff =
    Math.max(timestampMs(b.lastActivityAt), timestampMs(b.createdAt))
    - Math.max(timestampMs(a.lastActivityAt), timestampMs(a.createdAt));
  if (activityDiff !== 0) return activityDiff;
  const createdDiff = timestampMs(b.createdAt) - timestampMs(a.createdAt);
  if (createdDiff !== 0) return createdDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function findMatchingProject(planPath: string, explicitProjects: string[]) {
  return (
    explicitProjects.find((projectPath) => {
      const folderName = projectPath.split("/").pop() || projectPath;
      return planPath.startsWith(projectPath) || planPath.includes(folderName);
    }) ?? null
  );
}

export function buildConversationGroups(args: {
  explicitProjects: string[];
  plans: PlanRecord[];
  runs: RunRecord[];
}) {
  const staleFallbackProject = resolveStaleProjectFallback(
    args.explicitProjects,
    args.runs.map((run) => run.projectPath),
  );
  const mappedRuns = args.runs
    .map((run) => {
      const plan = args.plans.find((candidate) => candidate.id === run.planId);
      const planPath = plan?.path ?? run.projectPath ?? run.id;

      const projectPath = resolveStoredProjectRoot(run.projectPath, args.explicitProjects, { staleFallbackProject })
        ?? (plan ? findMatchingProject(plan.path, args.explicitProjects) : null);
      return {
        id: run.id,
        groupPath: projectPath ? normalizeProjectPath(projectPath) : "other",
        title: run.title || "New conversation",
        path: planPath,
        mode: run.mode,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt ?? null,
        lastActivityAt: run.lastActivityAt ?? null,
        preferredWorkerType: run.preferredWorkerType,
      };
    })
    .filter((run): run is NonNullable<typeof run> => Boolean(run))
    .sort(compareConversationRunsDesc);

  const groups = new Map<string, ConversationGroup>();

  for (const normalizedPath of normalizeExplicitProjectPaths(args.explicitProjects)) {
    groups.set(normalizedPath, {
      path: normalizedPath,
      name: normalizedPath.split("/").pop() || normalizedPath,
      runs: [],
    });
  }

  for (const run of mappedRuns) {
    if (groups.has(run.groupPath)) {
      continue;
    }

    if (run.groupPath === "other") {
      groups.set(run.groupPath, {
        path: run.groupPath,
        name: t("conversation.sidebar.otherSessions"),
        runs: [],
      });
      continue;
    }

    groups.set(run.groupPath, {
      path: run.groupPath,
      name: run.groupPath.split("/").pop() || run.groupPath,
      runs: [],
    });
  }

  const explicitGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    runs: mappedRuns
      .filter((run) => run.groupPath === group.path)
      .map((run) => ({
        id: run.id,
        title: run.title,
        path: run.path,
        mode: run.mode,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        lastActivityAt: run.lastActivityAt,
        preferredWorkerType: run.preferredWorkerType,
      })),
  }));

  const otherRuns = mappedRuns
    .filter((run) => run.groupPath === "other")
    .map((run) => ({
      id: run.id,
      title: run.title,
      path: run.path,
      mode: run.mode,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      lastActivityAt: run.lastActivityAt,
      preferredWorkerType: run.preferredWorkerType,
    }));

  if (otherRuns.length > 0 && !groups.has("other")) {
    explicitGroups.push({
      path: "other",
      name: t("conversation.sidebar.otherSessions"),
      runs: otherRuns,
    });
  }

  return explicitGroups;
}

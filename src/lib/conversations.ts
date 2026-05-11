import { t } from "@/lib/i18n";
import { normalizeExplicitProjectPaths, normalizeProjectPath, resolveStaleProjectFallback, resolveStoredProjectRoot } from "@/lib/project-paths";

type PlanRecord = { id: string; path: string };
type RunRecord = {
  id: string;
  planId: string;
  mode?: string | null;
  status: string;
  createdAt: string;
  projectPath?: string | null;
  title?: string | null;
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
  }>;
};

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
      if (!plan) {
        return null;
      }

      const projectPath = resolveStoredProjectRoot(run.projectPath, args.explicitProjects, { staleFallbackProject })
        ?? findMatchingProject(plan.path, args.explicitProjects);
      return {
        id: run.id,
        groupPath: projectPath ? normalizeProjectPath(projectPath) : "other",
        title: run.title || "New conversation",
        path: plan.path,
        mode: run.mode,
        status: run.status,
        createdAt: run.createdAt,
      };
    })
    .filter((run): run is NonNullable<typeof run> => Boolean(run));

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

type PlanRecord = { id: string; path: string };
type RunRecord = {
  id: string;
  planId: string;
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
    status: string;
    createdAt: string;
  }>;
};

function normalizeProjectPath(projectPath: string) {
  return projectPath.replace(/\/+$/, "") || "/";
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
  const mappedRuns = args.runs
    .map((run) => {
      const plan = args.plans.find((candidate) => candidate.id === run.planId);
      if (!plan) {
        return null;
      }

      const projectPath = run.projectPath || findMatchingProject(plan.path, args.explicitProjects);
      return {
        id: run.id,
        groupPath: projectPath ? normalizeProjectPath(projectPath) : "other",
        title: run.title || "New conversation",
        path: plan.path,
        status: run.status,
        createdAt: run.createdAt,
      };
    })
    .filter((run): run is NonNullable<typeof run> => Boolean(run));

  const groups = new Map<string, ConversationGroup>();

  for (const projectPath of args.explicitProjects) {
    const normalizedPath = normalizeProjectPath(projectPath);
    groups.set(normalizedPath, {
      path: normalizedPath,
      name: normalizedPath.split("/").pop() || normalizedPath,
      runs: [],
    });
  }

  for (const run of mappedRuns) {
    if (run.groupPath === "other" || groups.has(run.groupPath)) {
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
      status: run.status,
      createdAt: run.createdAt,
    }));

  if (otherRuns.length > 0) {
    explicitGroups.push({
      path: "other",
      name: "Other Conversations",
      runs: otherRuns,
    });
  }

  return explicitGroups;
}

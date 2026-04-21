type PlanRecord = { id: string; path: string };
type RunRecord = { id: string; planId: string; projectPath?: string | null };

export function resolveProjectScope(args: {
  draftProjectPath: string | null;
  selectedRunId: string | null;
  plans: PlanRecord[];
  runs: RunRecord[];
  explicitProjects: string[];
}) {
  if (args.draftProjectPath) {
    return args.draftProjectPath;
  }

  if (!args.selectedRunId) {
    return null;
  }

  const run = args.runs.find((candidate) => candidate.id === args.selectedRunId);
  if (run?.projectPath) {
    return run.projectPath;
  }

  const plan = run ? args.plans.find((candidate) => candidate.id === run.planId) : null;
  if (!plan) {
    return null;
  }

  return (
    args.explicitProjects.find((projectPath) => {
      const folderName = projectPath.split("/").pop() || projectPath;
      return plan.path.startsWith(projectPath) || plan.path.includes(folderName);
    }) ?? null
  );
}

import { normalizeExplicitProjectPaths, resolveStaleProjectFallback, resolveStoredProjectRoot } from "@/lib/project-paths";

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
    const explicitProjects = normalizeExplicitProjectPaths(args.explicitProjects);
    return explicitProjects.length === 1 ? explicitProjects[0] : null;
  }

  const run = args.runs.find((candidate) => candidate.id === args.selectedRunId);
  const staleFallbackProject = resolveStaleProjectFallback(
    args.explicitProjects,
    args.runs.map((candidate) => candidate.projectPath),
  );
  const projectRoot = resolveStoredProjectRoot(run?.projectPath, args.explicitProjects, { staleFallbackProject });
  if (projectRoot) {
    return projectRoot;
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

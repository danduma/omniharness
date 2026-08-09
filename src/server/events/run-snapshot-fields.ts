import type { runs } from "@/server/db/schema";

type RunRecord = typeof runs.$inferSelect;

/**
 * Trim run rows before they go on the wire.
 *
 * `db.select().from(runs)` pulls every column, including large JSON blobs the
 * client never reads. Measured on a real database: 130 non-archived runs
 * carried 142 KB of `gitBaselineJson` alone, and that rode along in *every*
 * snapshot frame for *every* connected client. Nothing in `src/components` or
 * `src/interface` reads it — the field exists only as a declaration in
 * `shared/home-types.ts`.
 *
 * Rules encoded here:
 * - `gitBaselineJson` / `plannerReadinessVerdictJson`: no frontend consumer at
 *   all, dropped outright.
 * - `plannerArtifactsJson`: read only for the selected run
 *   (`ConversationMain.tsx` → `PlanningArtifactsPanel`), so only the selected
 *   run pays for it.
 * - `gitWorkspaceJson`: read per run by `RunWorkspaceBadge`, kept for all.
 *
 * If a new surface needs one of the dropped fields, fetch it from a run-scoped
 * endpoint rather than re-broadening the broadcast payload — see Rule 2 in
 * `docs/architecture/hot-path-responsiveness-and-resource-leaks.md`.
 */
export function stripUnusedRunSnapshotFields<T extends RunRecord>(
  run: T,
  options: { selectedRunId?: string | null } = {},
) {
  const {
    gitBaselineJson: _gitBaselineJson,
    plannerReadinessVerdictJson: _plannerReadinessVerdictJson,
    plannerArtifactsJson,
    ...rest
  } = run;

  return {
    ...rest,
    plannerArtifactsJson: run.id === options.selectedRunId ? plannerArtifactsJson : null,
  };
}

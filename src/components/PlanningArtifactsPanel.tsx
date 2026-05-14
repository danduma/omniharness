"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { planningArtifactsManager } from "@/components/component-state-managers";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { PlanningReviewControls } from "./PlanningReviewControls";
import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";

type Candidate = {
  path: string;
  kind: "spec" | "plan" | "unknown";
  source?: string;
  confidence?: number;
  exists?: boolean;
  readiness?: {
    ready?: boolean;
    gaps?: string[];
  } | null;
};

type ArtifactsPayload = {
  specPath?: string | null;
  planPath?: string | null;
  candidates?: Candidate[];
};

function normalizeArtifacts(value: string | null | undefined): ArtifactsPayload {
  if (!value?.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as ArtifactsPayload;
  } catch {
    return {};
  }
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function resolveProjectFileReference(pathValue: string | null, projectRoot?: string | null): ProjectFileReference | null {
  const normalizedRoot = normalizePath(projectRoot ?? "");
  const normalizedPath = normalizePath(pathValue ?? "");
  if (!normalizedRoot || !normalizedPath) {
    return null;
  }

  if (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)) {
    const relativePath = normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, "");
    return relativePath ? { root: normalizedRoot, relativePath } : null;
  }

  if (!normalizedPath.startsWith("/")) {
    return { root: normalizedRoot, relativePath: normalizedPath };
  }

  return null;
}

function displayProjectPath(pathValue: string | null, projectRoot?: string | null) {
  if (!pathValue) {
    return t("planning.artifacts.notDetected");
  }

  const reference = resolveProjectFileReference(pathValue, projectRoot);
  return reference ? reference.relativePath : pathValue;
}

function PlanningArtifactFileLink({
  label,
  pathValue,
  projectRoot,
  onOpenProjectFile,
}: {
  label: string;
  pathValue: string | null;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const reference = resolveProjectFileReference(pathValue, projectRoot);
  const displayPath = displayProjectPath(pathValue, projectRoot);
  const content = (
    <>
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all font-mono text-[12px] text-foreground">{displayPath}</span>
    </>
  );

  if (!reference || !onOpenProjectFile) {
    return (
      <span className="inline-flex min-w-0 max-w-full items-baseline gap-2">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex min-w-0 max-w-full items-baseline gap-2 text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
      onClick={() => onOpenProjectFile(reference)}
      title={t("planning.artifacts.openFileTitle", { path: displayPath })}
      aria-label={t("planning.artifacts.openFile", { label })}
    >
      {content}
    </button>
  );
}

export function PlanningArtifactsPanel({
  specPath,
  planPath,
  plannerArtifactsJson,
  onPromote,
  isPromoting,
  projectRoot,
  onOpenProjectFile,
  runId,
  isReviewing,
  latestReviewRun,
  latestReviewRound,
  reviewFindings,
  onStartReview,
}: {
  specPath?: string | null;
  planPath?: string | null;
  plannerArtifactsJson?: string | null;
  onPromote: (planPath: string | null) => void;
  isPromoting?: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
  runId?: string;
  isReviewing?: boolean;
  latestReviewRun?: PlanningReviewRunRecord | null;
  latestReviewRound?: PlanningReviewRoundRecord | null;
  reviewFindings?: PlanningReviewFindingRecord[];
  onStartReview?: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
}) {
  useI18nSnapshot();
  const artifacts = useMemo(() => normalizeArtifacts(plannerArtifactsJson), [plannerArtifactsJson]);
  const allCandidates = artifacts.candidates ?? [];
  const allPlanCandidates = (artifacts.candidates ?? []).filter((candidate) => candidate.kind === "plan");
  const handoffPlanCandidates = allPlanCandidates.filter((candidate) => candidate.source === "handoff");
  const planCandidates = handoffPlanCandidates.length > 0 ? handoffPlanCandidates : allPlanCandidates;
  const { selectedPlanPath: managerSelectedPlanPath } = useManagerSnapshot(planningArtifactsManager);
  const hasArtifactSignal = Boolean(specPath || planPath || artifacts.specPath || artifacts.planPath || allCandidates.length > 0);
  const candidatePaths = new Set(planCandidates.map((candidate) => candidate.path));
  const currentManagerSelectedPlanPath = managerSelectedPlanPath && candidatePaths.has(managerSelectedPlanPath)
    ? managerSelectedPlanPath
    : null;
  const selectedPlanPath = currentManagerSelectedPlanPath || planPath || artifacts.planPath || planCandidates[0]?.path || null;

  const selectedCandidate = planCandidates.find((candidate) => candidate.path === selectedPlanPath) ?? null;
  const ready = Boolean(selectedCandidate?.readiness?.ready || (!selectedCandidate && selectedPlanPath));
  const resolvedSpecPath = specPath || artifacts.specPath || null;
  const readinessGap = selectedCandidate?.readiness?.gaps?.[0] ?? null;
  const otherPlanCandidates = planCandidates.filter((candidate) => candidate.path !== selectedPlanPath);

  if (!hasArtifactSignal) {
    return null;
  }

  return (
    <div className="space-y-3 px-1 text-sm leading-relaxed text-foreground" role="note" aria-label={t("planning.artifacts.ariaLabel")}>
      <div className="space-y-2">
        <p>
          {ready
            ? t("planning.artifacts.readyPrompt")
            : readinessGap
              ? t("planning.artifacts.needsReviewPrompt", { gap: readinessGap })
              : t("planning.artifacts.detectedPrompt")}
        </p>
        <div className="space-y-1.5">
          <PlanningArtifactFileLink
            label={t("planning.artifacts.spec")}
            pathValue={resolvedSpecPath}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
          <PlanningArtifactFileLink
            label={t("planning.artifacts.plan")}
            pathValue={selectedPlanPath}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        </div>
        {otherPlanCandidates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{t("planning.artifacts.otherPlans")}</span>
            {otherPlanCandidates.map((candidate) => (
              <button
                key={candidate.path}
                type="button"
                onClick={() => planningArtifactsManager.setSelectedPlanPath(candidate.path)}
                className="max-w-full truncate font-mono text-[11px] text-foreground/85 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              >
                {displayProjectPath(candidate.path, projectRoot)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => document.querySelector<HTMLTextAreaElement>("[data-composer-input='true']")?.focus()}
        >
          {t("planning.artifacts.continueRevising")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedPlanPath || !ready || isPromoting}
          onClick={() => onPromote(selectedPlanPath)}
        >
          {t("planning.artifacts.startImplementation")}
        </Button>
      </div>

      {ready && runId && onStartReview && (
        <PlanningReviewControls
          isReviewing={Boolean(isReviewing)}
          latestReviewRun={latestReviewRun}
          latestReviewRound={latestReviewRound}
          findings={reviewFindings}
          onStartReview={onStartReview}
        />
      )}
    </div>
  );
}

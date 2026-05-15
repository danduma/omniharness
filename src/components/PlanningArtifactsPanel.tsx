// Wired up PlanningReviewControls
"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planningArtifactsManager } from "@/components/component-state-managers";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { PlanningReviewControls } from "./PlanningReviewControls";
import { planningReviewPreferencesManager } from "@/app/home/PlanningReviewPreferencesManager";
import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";

type ReadinessConcern = {
  kind?: string;
  itemIndex?: number | null;
  detail?: string;
};

type ReadinessVerdict = {
  verdict?: "ready" | "needs_review" | "needs_rewrite";
  headline?: string;
  topConcern?: string | null;
  concerns?: ReadinessConcern[];
  rationale?: string;
  confidence?: number;
};

type ReadinessRecord = {
  status?: "analyzing" | "ready" | "fallback";
  verdict?: ReadinessVerdict | null;
  fallbackHeadline?: string | null;
  error?: string | null;
};

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
  readinessRecord?: ReadinessRecord | null;
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
    return "";
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
      <span className="flex min-w-0 max-w-full items-baseline gap-2">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="flex min-w-0 max-w-full items-baseline gap-2 text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
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
  const { isExpanded: isReviewPanelExpanded } = useManagerSnapshot(planningReviewPreferencesManager);
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
  const record = selectedCandidate?.readinessRecord ?? null;
  const recordStatus = record?.status ?? null;
  const verdict = record?.verdict?.verdict ?? null;
  const headlineText = record?.verdict?.headline?.trim() || record?.fallbackHeadline?.trim() || null;
  const concerns = record?.verdict?.concerns ?? [];
  const rationale = record?.verdict?.rationale?.trim() || null;

  const legacyReady = !selectedCandidate?.readiness || selectedCandidate.readiness.ready !== false;
  const isAnalyzing = recordStatus === "analyzing";
  const canStartByVerdict = verdict
    ? verdict !== "needs_rewrite"
    : legacyReady;
  const needsConfirmation = verdict === "needs_review";
  const canStart = Boolean(selectedPlanPath) && !isAnalyzing && !isPromoting && canStartByVerdict;

  const displayHeadline = isAnalyzing
    ? t("planning.artifacts.analyzingPrompt")
    : headlineText || t("planning.artifacts.fallbackPrompt");

  const resolvedSpecPath = specPath || artifacts.specPath || null;
  const otherPlanCandidates = planCandidates.filter((candidate) => candidate.path !== selectedPlanPath);

  if (!hasArtifactSignal) {
    return null;
  }

  const handleStartImplementation = () => {
    if (needsConfirmation) {
      const ok = typeof window !== "undefined"
        ? window.confirm(t("planning.artifacts.needsReviewConfirm"))
        : true;
      if (!ok) return;
    }
    planningReviewPreferencesManager.setExpanded(false);
    onPromote(selectedPlanPath);
  };

  return (
    <div className="space-y-3 px-1 text-sm leading-relaxed text-foreground" role="note" aria-label={t("planning.artifacts.ariaLabel")}>
      <div className="space-y-2">
        <p className="flex items-start gap-2">
          {isAnalyzing ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
          <span>{displayHeadline}</span>
        </p>
        {!isAnalyzing && concerns.length > 0 ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              {t("planning.artifacts.concernsSummary", { count: String(concerns.length) })}
            </summary>
            <ul className="mt-1 space-y-1 pl-4">
              {concerns.map((concern, index) => (
                <li key={index} className="list-disc">
                  {concern.detail || concern.kind || ""}
                </li>
              ))}
            </ul>
            {rationale ? (
              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-snug">{rationale}</p>
            ) : null}
          </details>
        ) : null}
        <div className="space-y-1.5">
          {resolvedSpecPath ? (
            <PlanningArtifactFileLink
              label={t("planning.artifacts.spec")}
              pathValue={resolvedSpecPath}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
            />
          ) : null}
          {selectedPlanPath ? (
            <PlanningArtifactFileLink
              label={t("planning.artifacts.plan")}
              pathValue={selectedPlanPath}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
            />
          ) : null}
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
          variant="outline"
          onClick={() => {
            planningReviewPreferencesManager.setExpanded(false);
            document.querySelector<HTMLTextAreaElement>("[data-composer-input='true']")?.focus();
          }}
        >
          {t("planning.artifacts.continueRevising")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={verdict && verdict !== "ready" ? "default" : "outline"}
          aria-expanded={isReviewPanelExpanded}
          onClick={() => planningReviewPreferencesManager.setExpanded(!isReviewPanelExpanded)}
        >
          {t("planning.artifacts.improvePlan")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canStart}
          onClick={handleStartImplementation}
        >
          {t("planning.artifacts.startImplementation")}
        </Button>
      </div>

      {runId && onStartReview && isReviewPanelExpanded && (
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

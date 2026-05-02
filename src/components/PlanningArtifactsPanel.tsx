"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { planningArtifactsManager } from "@/components/component-state-managers";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

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

export function PlanningArtifactsPanel({
  specPath,
  planPath,
  plannerArtifactsJson,
  onPromote,
  isPromoting,
}: {
  specPath?: string | null;
  planPath?: string | null;
  plannerArtifactsJson?: string | null;
  onPromote: (planPath: string | null) => void;
  isPromoting?: boolean;
}) {
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

  if (!hasArtifactSignal) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Planning artifacts</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            OmniHarness detects spec and plan files from the planning CLI handoff, then verifies the selected plan before implementation.
          </p>
        </div>
        <div className={cn(
          "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
          ready ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}>
          {ready ? "Ready" : "Needs review"}
        </div>
      </div>

      <div className="mt-4 space-y-3 text-xs">
        <div className="rounded-xl border border-border/60 bg-background/80 p-3">
          <div className="font-semibold">Spec</div>
          <div className="mt-1 break-all text-muted-foreground">{specPath || artifacts.specPath || "Not detected yet"}</div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/80 p-3">
          <div className="font-semibold">Plan</div>
          <div className="mt-2 space-y-2">
            {planCandidates.length > 0 ? planCandidates.map((candidate) => {
              const candidateReady = Boolean(candidate.readiness?.ready);
              return (
                <button
                  key={candidate.path}
                  type="button"
                  onClick={() => planningArtifactsManager.setSelectedPlanPath(candidate.path)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    selectedPlanPath === candidate.path
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-background hover:border-primary/30",
                  )}
                >
                  <div className="break-all font-mono text-[11px]">{candidate.path}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{candidate.source || "detected"}</span>
                    <span>{candidate.exists ? "exists" : "missing"}</span>
                    <span>{candidateReady ? "ready" : "not ready"}</span>
                  </div>
                  {candidate.readiness?.gaps?.length ? (
                    <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                      {candidate.readiness.gaps[0]}
                    </div>
                  ) : null}
                </button>
              );
            }) : (
              <div className="text-muted-foreground">No candidate plan detected yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!selectedPlanPath || !ready || isPromoting}
          onClick={() => onPromote(selectedPlanPath)}
        >
          Start implementation
        </Button>
        <div className="text-[11px] text-muted-foreground">
          {selectedCandidate?.readiness?.gaps?.length
            ? selectedCandidate.readiness.gaps[0]
            : selectedPlanPath
              ? "The selected plan will be promoted into a fresh supervisor-managed implementation run."
              : "Select a verified plan file to promote this planning session."}
        </div>
      </div>
    </div>
  );
}

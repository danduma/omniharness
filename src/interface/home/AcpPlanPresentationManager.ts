import { StateManager } from "@/lib/state-manager";
import { getBrowserLocalStorage, safeSetBrowserStorageItem } from "@/lib/browser-storage";

export type AcpPlanPresentationState = {
  ownerKey: string | null;
  expanded: boolean;
  completionPlanKey: string | null;
  completionPhase: "idle" | "celebrating" | "fading" | "dismissed";
};

export const COMPLETION_CELEBRATION_MS = 850;
export const COMPLETION_FADE_MS = 350;
export const ACP_PLAN_PRESENTATION_STORAGE_KEY = "omni.acp-plan-presentation:v1";
export const ACP_PLAN_DISMISSAL_STORAGE_KEY = "omni.acp-plan-dismissals:v1";

const MAX_PERSISTED_SESSION_PREFERENCES = 64;

type PresentationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function parseExpandedPreferences(value: string | null) {
  if (!value) return new Map<string, boolean>();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Map<string, boolean>();
    }
    return new Map(
      Object.entries(parsed)
        .filter(([key, expanded]) => key.length > 0 && typeof expanded === "boolean")
        .slice(-MAX_PERSISTED_SESSION_PREFERENCES)
        .map(([key, expanded]) => [key, expanded as boolean]),
    );
  } catch {
    return new Map<string, boolean>();
  }
}

function parseDismissedPlans(value: string | null) {
  if (!value) return new Map<string, string>();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Map<string, string>();
    }
    return new Map(
      Object.entries(parsed)
        .filter(([key, planKey]) => key.length > 0 && typeof planKey === "string" && planKey.length > 0)
        .slice(-MAX_PERSISTED_SESSION_PREFERENCES)
        .map(([key, planKey]) => [key, planKey as string]),
    );
  } catch {
    return new Map<string, string>();
  }
}

function ownerKey(runId: string, workerId: string) {
  return `${runId}/${workerId}`;
}

export class AcpPlanPresentationManager extends StateManager<AcpPlanPresentationState> {
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly storage: PresentationStorage | null;
  private readonly expandedByOwnerKey: Map<string, boolean>;
  private readonly dismissedPlanKeyByOwnerKey: Map<string, string>;

  constructor(options: { storage?: PresentationStorage | null } = {}) {
    super({
      ownerKey: null,
      expanded: false,
      completionPlanKey: null,
      completionPhase: "idle",
    });
    this.storage = options.storage === undefined ? getBrowserLocalStorage() : options.storage;
    this.expandedByOwnerKey = parseExpandedPreferences(this.storage?.getItem(ACP_PLAN_PRESENTATION_STORAGE_KEY) ?? null);
    this.dismissedPlanKeyByOwnerKey = parseDismissedPlans(this.storage?.getItem(ACP_PLAN_DISMISSAL_STORAGE_KEY) ?? null);
  }

  private clearCompletionTimer() {
    if (this.completionTimer === null) return;
    clearTimeout(this.completionTimer);
    this.completionTimer = null;
  }

  private expandedPreference(owner: string | null) {
    return owner ? this.expandedByOwnerKey.get(owner) ?? false : false;
  }

  private persistExpandedPreferences() {
    if (!this.storage) return;
    const entries = Array.from(this.expandedByOwnerKey.entries()).slice(-MAX_PERSISTED_SESSION_PREFERENCES);
    this.expandedByOwnerKey.clear();
    for (const [key, expanded] of entries) {
      this.expandedByOwnerKey.set(key, expanded);
    }
    safeSetBrowserStorageItem(this.storage, ACP_PLAN_PRESENTATION_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  private persistDismissedPlans() {
    if (!this.storage) return;
    const entries = Array.from(this.dismissedPlanKeyByOwnerKey.entries()).slice(-MAX_PERSISTED_SESSION_PREFERENCES);
    this.dismissedPlanKeyByOwnerKey.clear();
    for (const [key, planKey] of entries) {
      this.dismissedPlanKeyByOwnerKey.set(key, planKey);
    }
    safeSetBrowserStorageItem(this.storage, ACP_PLAN_DISMISSAL_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  private rememberDismissedPlan(owner: string, planKey: string) {
    this.dismissedPlanKeyByOwnerKey.delete(owner);
    this.dismissedPlanKeyByOwnerKey.set(owner, planKey);
    this.persistDismissedPlans();
  }

  isCompletionDismissed(runId: string, workerId: string, planKey: string) {
    return this.dismissedPlanKeyByOwnerKey.get(ownerKey(runId, workerId)) === planKey;
  }

  getCompletionPhase(runId: string, workerId: string, planKey: string) {
    if (this.isCompletionDismissed(runId, workerId, planKey)) return "dismissed" as const;
    const current = this.getSnapshot();
    return current.ownerKey === ownerKey(runId, workerId) && current.completionPlanKey === planKey
      ? current.completionPhase
      : "idle";
  }

  setOwner(runId: string | null, workerId: string | null) {
    const nextOwnerKey = runId && workerId ? ownerKey(runId, workerId) : null;
    if (this.getSnapshot().ownerKey === nextOwnerKey) return;
    this.clearCompletionTimer();
    this.update({
      ownerKey: nextOwnerKey,
      expanded: this.expandedPreference(nextOwnerKey),
      completionPlanKey: null,
      completionPhase: "idle",
    });
  }

  toggle(runId: string, workerId: string) {
    const requestedOwnerKey = ownerKey(runId, workerId);
    const current = this.getSnapshot();
    if (current.ownerKey !== requestedOwnerKey) return;
    const expanded = !current.expanded;
    this.expandedByOwnerKey.set(requestedOwnerKey, expanded);
    this.persistExpandedPreferences();
    this.update({ ...current, expanded });
  }

  syncCompletion(runId: string, workerId: string, planKey: string, isComplete: boolean) {
    const requestedOwnerKey = ownerKey(runId, workerId);
    const current = this.getSnapshot();
    if (current.ownerKey !== requestedOwnerKey) return;

    if (!isComplete) {
      this.clearCompletionTimer();
      if (planKey && this.dismissedPlanKeyByOwnerKey.delete(requestedOwnerKey)) {
        this.persistDismissedPlans();
      }
      if (current.completionPhase === "idle" && current.completionPlanKey === null) return;
      this.patch({
        completionPlanKey: null,
        completionPhase: "idle",
        expanded: this.expandedPreference(requestedOwnerKey),
      });
      return;
    }

    if (this.isCompletionDismissed(runId, workerId, planKey)) {
      this.clearCompletionTimer();
      this.patch({
        completionPlanKey: planKey,
        completionPhase: "dismissed",
        expanded: this.expandedPreference(requestedOwnerKey),
      });
      return;
    }

    if (current.completionPlanKey === planKey && current.completionPhase !== "idle") return;

    this.clearCompletionTimer();
    this.patch({
      completionPlanKey: planKey,
      completionPhase: "celebrating",
      expanded: true,
    });
    this.completionTimer = setTimeout(() => {
      const celebrating = this.getSnapshot();
      if (
        celebrating.ownerKey !== requestedOwnerKey
        || celebrating.completionPlanKey !== planKey
        || celebrating.completionPhase !== "celebrating"
      ) return;

      this.rememberDismissedPlan(requestedOwnerKey, planKey);
      this.patch({ completionPhase: "fading" });
      this.completionTimer = setTimeout(() => {
        const fading = this.getSnapshot();
        if (
          fading.ownerKey !== requestedOwnerKey
          || fading.completionPlanKey !== planKey
          || fading.completionPhase !== "fading"
        ) return;
        this.patch({ completionPhase: "dismissed" });
        this.completionTimer = null;
      }, COMPLETION_FADE_MS);
    }, COMPLETION_CELEBRATION_MS);
  }
}

export const acpPlanPresentationManager = new AcpPlanPresentationManager();

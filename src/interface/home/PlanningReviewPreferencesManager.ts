// Implemented Planning Review Preferences Manager
import { StateManager } from "@/lib/state-manager";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { runtimeErrorMessage } from "@/runtime-api/request";
import {
  PLANNING_REVIEW_AGENT_SELECTION_SETTING,
  PLANNING_REVIEW_ROUNDS_SETTING,
  normalizePlanningReviewAgentSelection,
  normalizePlanningReviewRounds,
  type PlanningReviewAgentSelection,
} from "@/shared/planning-review";

export type PlanningReviewPreferencesState = {
  agentSelection: PlanningReviewAgentSelection;
  rounds: number;
  isExpanded: boolean;
  isSaving: boolean;
  isStarting: boolean;
  saveError: string | null;
};

const initialState: PlanningReviewPreferencesState = {
  agentSelection: "auto",
  rounds: 1,
  isExpanded: false,
  isSaving: false,
  isStarting: false,
  saveError: null,
};

export class PlanningReviewPreferencesManager extends StateManager<PlanningReviewPreferencesState> {
  private saveSettings: RuntimeAPIs["settings"]["save"] | null = null;
  private revisions = { agentSelection: 0, rounds: 0 };
  private pendingSaves = 0;
  private pendingByKey = new Map<string, number>();

  constructor() {
    super(initialState);
  }

  hydrate(settings: Record<string, string>) {
    const agentSelection = normalizePlanningReviewAgentSelection(settings[PLANNING_REVIEW_AGENT_SELECTION_SETTING]);
    const rounds = normalizePlanningReviewRounds(settings[PLANNING_REVIEW_ROUNDS_SETTING]);
    this.patch((current) => ({
      agentSelection: this.pendingByKey.has(PLANNING_REVIEW_AGENT_SELECTION_SETTING) ? current.agentSelection : agentSelection,
      rounds: this.pendingByKey.has(PLANNING_REVIEW_ROUNDS_SETTING) ? current.rounds : rounds,
      isSaving: this.pendingSaves > 0,
    }));
  }

  configure(saveSettings: RuntimeAPIs["settings"]["save"]) {
    this.saveSettings = saveSettings;
  }

  setExpanded(isExpanded: boolean) {
    this.setKey("isExpanded", isExpanded);
  }

  setStarting(isStarting: boolean) {
    this.setKey("isStarting", isStarting);
  }

  async setAgentSelection(value: PlanningReviewAgentSelection) {
    const previous = this.getSnapshot().agentSelection;
    const revision = ++this.revisions.agentSelection;
    this.patch({ agentSelection: value, saveError: null });
    try {
      await this.saveSetting(PLANNING_REVIEW_AGENT_SELECTION_SETTING, value);
    } catch (error) {
      console.error("Failed to save agent selection:", error);
      if (this.revisions.agentSelection === revision) {
        this.patch({ agentSelection: previous, saveError: runtimeErrorMessage(error) });
      }
    }
  }

  async setRounds(value: number) {
    const previous = this.getSnapshot().rounds;
    const normalized = normalizePlanningReviewRounds(value);
    const revision = ++this.revisions.rounds;
    this.patch({ rounds: normalized, saveError: null });
    try {
      await this.saveSetting(PLANNING_REVIEW_ROUNDS_SETTING, String(normalized));
    } catch (error) {
      console.error("Failed to save rounds:", error);
      if (this.revisions.rounds === revision) {
        this.patch({ rounds: previous, saveError: runtimeErrorMessage(error) });
      }
    }
  }

  private async saveSetting(key: string, value: string) {
    this.pendingSaves += 1;
    this.pendingByKey.set(key, (this.pendingByKey.get(key) ?? 0) + 1);
    this.setKey("isSaving", true);
    try {
      if (!this.saveSettings) {
        throw new Error("Planning review preferences are not connected to runtime settings.");
      }
      await this.saveSettings({ [key]: value });
    } finally {
      this.pendingSaves = Math.max(0, this.pendingSaves - 1);
      const pendingForKey = Math.max(0, (this.pendingByKey.get(key) ?? 1) - 1);
      if (pendingForKey === 0) this.pendingByKey.delete(key);
      else this.pendingByKey.set(key, pendingForKey);
      this.setKey("isSaving", this.pendingSaves > 0);
    }
  }
}

export const planningReviewPreferencesManager = new PlanningReviewPreferencesManager();

export const planningReviewPreferencesSetters = {
  setAgentSelection: (value: PlanningReviewAgentSelection) => planningReviewPreferencesManager.setAgentSelection(value),
  setRounds: (value: number) => planningReviewPreferencesManager.setRounds(value),
};

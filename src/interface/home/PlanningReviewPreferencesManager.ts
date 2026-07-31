// Implemented Planning Review Preferences Manager
import { StateManager } from "@/lib/state-manager";
import type { RuntimeAPIs } from "@/runtime-api/types";
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
};

const initialState: PlanningReviewPreferencesState = {
  agentSelection: "auto",
  rounds: 1,
  isExpanded: false,
  isSaving: false,
  isStarting: false,
};

export class PlanningReviewPreferencesManager extends StateManager<PlanningReviewPreferencesState> {
  private saveSettings: RuntimeAPIs["settings"]["save"] | null = null;

  constructor() {
    super(initialState);
  }

  hydrate(settings: Record<string, string>) {
    const agentSelection = normalizePlanningReviewAgentSelection(settings[PLANNING_REVIEW_AGENT_SELECTION_SETTING]);
    const rounds = normalizePlanningReviewRounds(settings[PLANNING_REVIEW_ROUNDS_SETTING]);
    this.patch({ agentSelection, rounds, isSaving: false });
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
    this.setKey("agentSelection", value);
    try {
      await this.saveSetting(PLANNING_REVIEW_AGENT_SELECTION_SETTING, value);
    } catch (error) {
      console.error("Failed to save agent selection:", error);
      this.setKey("agentSelection", previous);
    }
  }

  async setRounds(value: number) {
    const previous = this.getSnapshot().rounds;
    const normalized = normalizePlanningReviewRounds(value);
    this.setKey("rounds", normalized);
    try {
      await this.saveSetting(PLANNING_REVIEW_ROUNDS_SETTING, String(normalized));
    } catch (error) {
      console.error("Failed to save rounds:", error);
      this.setKey("rounds", previous);
    }
  }

  private async saveSetting(key: string, value: string) {
    this.setKey("isSaving", true);
    try {
      if (!this.saveSettings) {
        throw new Error("Planning review preferences are not connected to runtime settings.");
      }
      await this.saveSettings({ [key]: value });
    } finally {
      this.setKey("isSaving", false);
    }
  }
}

export const planningReviewPreferencesManager = new PlanningReviewPreferencesManager();

export const planningReviewPreferencesSetters = {
  setAgentSelection: (value: PlanningReviewAgentSelection) => planningReviewPreferencesManager.setAgentSelection(value),
  setRounds: (value: number) => planningReviewPreferencesManager.setRounds(value),
};

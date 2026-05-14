// Implemented Planning Review Preferences Manager
import { StateManager } from "@/lib/state-manager";
import { requestJson } from "@/lib/app-errors";
import { t } from "@/lib/i18n";
import {
  PLANNING_REVIEW_AGENT_SELECTION_SETTING,
  PLANNING_REVIEW_ROUNDS_SETTING,
  normalizePlanningReviewAgentSelection,
  normalizePlanningReviewRounds,
  type PlanningReviewAgentSelection,
} from "@/server/planning/review-preferences";

export type PlanningReviewPreferencesState = {
  agentSelection: PlanningReviewAgentSelection;
  rounds: number;
  isExpanded: boolean;
  isSaving: boolean;
};

const initialState: PlanningReviewPreferencesState = {
  agentSelection: "auto",
  rounds: 1,
  isExpanded: false,
  isSaving: false,
};

export class PlanningReviewPreferencesManager extends StateManager<PlanningReviewPreferencesState> {
  constructor() {
    super(initialState);
  }

  hydrate(settings: Record<string, string>) {
    const agentSelection = normalizePlanningReviewAgentSelection(settings[PLANNING_REVIEW_AGENT_SELECTION_SETTING]);
    const rounds = normalizePlanningReviewRounds(settings[PLANNING_REVIEW_ROUNDS_SETTING]);
    this.patch({ agentSelection, rounds, isSaving: false });
  }

  setExpanded(isExpanded: boolean) {
    this.setKey("isExpanded", isExpanded);
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
      await requestJson("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }, {
        source: "Settings",
        action: t("planning.review.savePreferenceAction"),
      });
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

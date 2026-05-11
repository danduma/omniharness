export type PlanningTerminalActivityLike = {
  kind: string;
  text?: string;
};

export function isPlannerHandoffText(text: string) {
  return /<omniharness-plan-handoff\b[\s\S]*?<\/omniharness-plan-handoff>/i.test(text.trim());
}

export function shouldShowPlanningTerminalActivity(activity: PlanningTerminalActivityLike) {
  return activity.kind !== "message" || !isPlannerHandoffText(activity.text ?? "");
}

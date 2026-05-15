"use client";

import { conversationNotificationManager } from "@/app/home/ConversationNotificationManager";
import { Button } from "@/components/ui/button";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export function NotificationsSettingsPanel() {
  const state = useManagerSnapshot(conversationNotificationManager);
  useI18nSnapshot();

  const unsupported = state.permission === "unsupported";
  const blocked = state.permission === "denied";
  const enabled = state.enabled;

  let label = t("notifications.button.enable");
  if (unsupported) {
    label = t("notifications.button.unavailable");
  } else if (blocked) {
    label = t("notifications.button.blocked");
  } else if (enabled) {
    label = t("notifications.button.disable");
  }

  const handleClick = () => {
    if (enabled) {
      conversationNotificationManager.disable();
      return;
    }
    void conversationNotificationManager.requestEnable();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{t("settings.notifications.title")}</div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("settings.notifications.description")}
        </p>
      </div>
      <Button
        type="button"
        variant={enabled ? "outline" : "default"}
        size="sm"
        onClick={handleClick}
        disabled={unsupported || blocked}
      >
        {label}
      </Button>
      {state.lastError ? (
        <p className="text-xs text-destructive">{state.lastError}</p>
      ) : null}
    </div>
  );
}

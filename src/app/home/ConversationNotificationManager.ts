import { StateManager } from "@/lib/state-manager";
import { t } from "@/lib/i18n";
import { registerServiceWorker } from "@/lib/pwa";
import type { AgentSnapshot, EventStreamState, RunRecord } from "./types";

export const CONVERSATION_NOTIFICATIONS_STORAGE_KEY = "omni-notifications-enabled";

export type ConversationNotificationPermission = NotificationPermission | "unsupported";
export type ConversationNotificationState = {
  enabled: boolean;
  permission: ConversationNotificationPermission;
  lastError: string | null;
};

export type ConversationNotificationRequest = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type ConversationNotifier = {
  notify: (request: ConversationNotificationRequest) => Promise<void>;
};

type ConversationNotificationPermissionProvider = {
  isSupported: () => boolean;
  getPermission: () => ConversationNotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
};

type ConversationNotificationManagerOptions = {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  notifier?: ConversationNotifier;
  permissionProvider?: ConversationNotificationPermissionProvider;
  visibilityProvider?: () => DocumentVisibilityState;
  pushClient?: ConversationPushClient;
  subscriptionApi?: ConversationSubscriptionApi;
};

type ConversationPushClient = {
  isSupported: () => boolean;
  subscribe: (publicKey: string) => Promise<BrowserPushSubscription>;
  unsubscribe: () => Promise<string | null>;
};

type ConversationSubscriptionApi = {
  loadConfig: () => Promise<{ supported: boolean; publicKey: string | null }>;
  saveSubscription: (subscription: BrowserPushSubscription) => Promise<void>;
  removeSubscription: (endpoint: string) => Promise<void>;
};

type ObservedRunState = {
  status: string;
  inputNeeded: boolean;
  completed: boolean;
  permissionKeys: Set<string>;
};

const initialNotificationState: ConversationNotificationState = {
  enabled: false,
  permission: "unsupported",
  lastError: null,
};

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function createBrowserPermissionProvider(): ConversationNotificationPermissionProvider {
  return {
    isSupported: () => typeof window !== "undefined" && "Notification" in window,
    getPermission: () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }

      return window.Notification.permission;
    },
    requestPermission: async () => {
      return window.Notification.requestPermission();
    },
  };
}

function createBrowserNotifier(): ConversationNotifier {
  return {
    notify: async (request) => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return;
      }

      const options: NotificationOptions = {
        body: request.body,
        tag: request.tag,
        data: { url: request.url },
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      };

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (registration) {
          await registration.showNotification(request.title, options);
          return;
        }
      }

      new window.Notification(request.title, options);
    },
  };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function normalizePushSubscription(subscription: PushSubscription): BrowserPushSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error(t("notifications.error.invalidSubscription"));
  }

  return {
    endpoint: json.endpoint,
    keys: { p256dh, auth },
  };
}

function createBrowserPushClient(): ConversationPushClient {
  return {
    isSupported: () => (
      typeof window !== "undefined"
      && typeof navigator !== "undefined"
      && "serviceWorker" in navigator
      && "PushManager" in window
      && (window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ),
    subscribe: async (publicKey) => {
      await registerServiceWorker({ allowDevelopment: true });
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        throw new Error(t("notifications.error.serviceWorkerUnavailable"));
      }

      const readyRegistration = await navigator.serviceWorker.ready;
      const existingSubscription = await readyRegistration.pushManager.getSubscription();
      if (existingSubscription) {
        return normalizePushSubscription(existingSubscription);
      }

      const subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      return normalizePushSubscription(subscription);
    },
    unsubscribe: async () => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        return null;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        return null;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      return endpoint;
    },
  };
}

function createBrowserSubscriptionApi(): ConversationSubscriptionApi {
  return {
    loadConfig: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json() as Promise<{ supported: boolean; publicKey: string | null }>;
    },
    saveSubscription: async (subscription) => {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
    removeSubscription: async (endpoint) => {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
  };
}

function getBrowserVisibility(): DocumentVisibilityState {
  if (typeof document === "undefined") {
    return "visible";
  }

  return document.visibilityState;
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

function isCompletedRun(run: RunRecord, completedRunIds: Set<string>) {
  const status = normalizeStatus(run.status);
  return status === "done" || status === "completed" || completedRunIds.has(run.id);
}

function titleForRun(run: RunRecord) {
  return run.title?.trim() || t("notifications.push.fallbackConversationTitle");
}

function runUrl(runId: string) {
  return `/session/${encodeURIComponent(runId)}`;
}

function agentBelongsToRun(agent: AgentSnapshot, run: RunRecord, workerRunIds: Map<string, string>) {
  const mappedRunId = workerRunIds.get(agent.name);
  return mappedRunId === run.id || agent.name.startsWith(`${run.id}-`);
}

function buildPermissionKeys(run: RunRecord, state: EventStreamState) {
  const workerRunIds = new Map((state.workers ?? []).map((worker) => [worker.id, worker.runId]));
  const keys = new Set<string>();

  for (const agent of state.agents ?? []) {
    if (!agentBelongsToRun(agent, run, workerRunIds)) {
      continue;
    }

    for (const permission of agent.pendingPermissions ?? []) {
      keys.add(`${agent.name}-${permission.requestId}`);
    }
  }

  return keys;
}

function hasPendingClarification(run: RunRecord, state: EventStreamState) {
  return (state.clarifications ?? []).some((clarification) => (
    clarification.runId === run.id && normalizeStatus(clarification.status) === "pending"
  ));
}

function hasNewPermission(previous: ObservedRunState | undefined, permissionKeys: Set<string>) {
  if (!previous) {
    return null;
  }

  for (const key of permissionKeys) {
    if (!previous.permissionKeys.has(key)) {
      return key;
    }
  }

  return null;
}

function buildObservedRunState(run: RunRecord, state: EventStreamState, completedRunIds: Set<string>): ObservedRunState {
  return {
    status: normalizeStatus(run.status),
    inputNeeded: normalizeStatus(run.status) === "awaiting_user" || hasPendingClarification(run, state),
    completed: isCompletedRun(run, completedRunIds),
    permissionKeys: buildPermissionKeys(run, state),
  };
}

export class ConversationNotificationManager extends StateManager<ConversationNotificationState> {
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  private readonly notifier: ConversationNotifier;
  private readonly permissionProvider: ConversationNotificationPermissionProvider;
  private readonly visibilityProvider: () => DocumentVisibilityState;
  private readonly pushClient: ConversationPushClient;
  private readonly subscriptionApi: ConversationSubscriptionApi;
  private readonly observedRuns = new Map<string, ObservedRunState>();
  private hasObservedSnapshot = false;

  constructor(options: ConversationNotificationManagerOptions = {}) {
    super(initialNotificationState);
    this.storage = options.storage ?? getBrowserStorage();
    this.notifier = options.notifier ?? createBrowserNotifier();
    this.permissionProvider = options.permissionProvider ?? createBrowserPermissionProvider();
    this.visibilityProvider = options.visibilityProvider ?? getBrowserVisibility;
    this.pushClient = options.pushClient ?? createBrowserPushClient();
    this.subscriptionApi = options.subscriptionApi ?? createBrowserSubscriptionApi();
  }

  hydrateFromBrowser() {
    const permission = this.permissionProvider.getPermission();
    const enabledPreference = this.storage?.getItem(CONVERSATION_NOTIFICATIONS_STORAGE_KEY) === "true";
    this.patch({
      enabled: enabledPreference && permission === "granted",
      permission,
      lastError: null,
    });
  }

  async requestEnable() {
    if (!this.permissionProvider.isSupported()) {
      this.patch({
        enabled: false,
        permission: "unsupported",
        lastError: t("notifications.error.unsupported"),
      });
      return;
    }

    const currentPermission = this.permissionProvider.getPermission();
    const permission = currentPermission === "granted"
      ? "granted"
      : await this.permissionProvider.requestPermission();

    if (permission !== "granted") {
      this.storage?.removeItem(CONVERSATION_NOTIFICATIONS_STORAGE_KEY);
      this.patch({
        enabled: false,
        permission,
        lastError: permission === "denied"
          ? t("notifications.error.blocked")
          : t("notifications.error.notEnabled"),
      });
      return;
    }

    if (this.pushClient.isSupported()) {
      try {
        const config = await this.subscriptionApi.loadConfig();
        if (config.supported && config.publicKey) {
          const subscription = await this.pushClient.subscribe(config.publicKey);
          await this.subscriptionApi.saveSubscription(subscription);
        }
      } catch (error) {
        this.patch({
          enabled: false,
          permission,
          lastError: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }

    this.storage?.setItem(CONVERSATION_NOTIFICATIONS_STORAGE_KEY, "true");
    this.patch({
      enabled: true,
      permission: "granted",
      lastError: null,
    });
  }

  disable() {
    this.storage?.setItem(CONVERSATION_NOTIFICATIONS_STORAGE_KEY, "false");
    if (this.pushClient.isSupported()) {
      void this.pushClient.unsubscribe().then((endpoint) => {
        if (endpoint) {
          return this.subscriptionApi.removeSubscription(endpoint);
        }
        return undefined;
      }).catch((error: unknown) => {
        this.patch({
          lastError: error instanceof Error ? error.message : String(error),
        });
      });
    }
    this.patch({
      enabled: false,
      permission: this.permissionProvider.getPermission(),
      lastError: null,
    });
  }

  handleEventStreamState(state: EventStreamState) {
    const completedRunIds = new Set((state.executionEvents ?? [])
      .filter((event) => event.eventType === "run_completed")
      .map((event) => event.runId));
    const nextObservedRuns = new Map<string, ObservedRunState>();
    const notifications: ConversationNotificationRequest[] = [];

    for (const run of state.runs ?? []) {
      const previous = this.observedRuns.get(run.id);
      const observed = buildObservedRunState(run, state, completedRunIds);
      nextObservedRuns.set(run.id, observed);

      if (!this.hasObservedSnapshot || !previous) {
        continue;
      }

      const newPermissionKey = hasNewPermission(previous, observed.permissionKeys);
      if (newPermissionKey) {
        notifications.push({
          title: "OmniHarness needs input",
          body: t("notifications.push.permissionBody", { title: titleForRun(run) }),
          tag: `omniharness-${run.id}-permission-${newPermissionKey}`,
          url: runUrl(run.id),
        });
        continue;
      }

      if (!previous.inputNeeded && observed.inputNeeded) {
        notifications.push({
          title: t("notifications.push.needsInput"),
          body: t("notifications.push.needsInputBody", { title: titleForRun(run) }),
          tag: `omniharness-${run.id}-input`,
          url: runUrl(run.id),
        });
        continue;
      }

      if (!previous.completed && observed.completed) {
        notifications.push({
          title: t("notifications.push.conversationComplete"),
          body: t("notifications.push.conversationCompleteBody", { title: titleForRun(run) }),
          tag: `omniharness-${run.id}-complete`,
          url: runUrl(run.id),
        });
      }
    }

    this.observedRuns.clear();
    for (const [runId, observed] of nextObservedRuns) {
      this.observedRuns.set(runId, observed);
    }
    this.hasObservedSnapshot = true;

    if (!this.canNotifyNow()) {
      return;
    }

    for (const notification of notifications) {
      void this.notifier.notify(notification).catch((error: unknown) => {
        this.patch({
          lastError: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private canNotifyNow() {
    const snapshot = this.getSnapshot();
    return (
      snapshot.enabled
      && snapshot.permission === "granted"
      && this.visibilityProvider() !== "visible"
    );
  }
}

export const conversationNotificationManager = new ConversationNotificationManager();

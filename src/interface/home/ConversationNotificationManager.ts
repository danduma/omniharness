import { WorkerEntriesManager } from "./WorkerEntriesManager";
import { StateManager } from "@/lib/state-manager";
import { safeSetBrowserStorageItem } from "@/lib/browser-storage";
import { t } from "@/lib/i18n";
import { conversationNotificationContent, notificationEventDetail, notificationPreview, type ConversationNotificationKind } from "@/lib/conversation-notification-content";
import { registerServiceWorker } from "@/lib/pwa";
import type { AgentSnapshot, EventStreamState, RunRecord } from "./types";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { runtimeErrorMessage } from "@/runtime-api/request";

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
  focusProvider?: () => boolean;
  pushClient?: ConversationPushClient;
  subscriptionApi?: ConversationSubscriptionApi;
  listEntries?: RuntimeAPIs["workers"]["listEntries"];
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

export function createRuntimeSubscriptionApi(
  notifications: RuntimeAPIs["notifications"],
): ConversationSubscriptionApi {
  return {
    loadConfig: () => notifications.load() as Promise<{ supported: boolean; publicKey: string | null }>,
    saveSubscription: async (subscription) => {
      await notifications.subscribe({ subscription });
    },
    removeSubscription: async (endpoint) => {
      await notifications.unsubscribe({ endpoint });
    },
  };
}

function getBrowserVisibility(): DocumentVisibilityState {
  if (typeof document === "undefined") {
    return "visible";
  }

  return document.visibilityState;
}

function getBrowserFocus(): boolean {
  if (typeof document === "undefined" || typeof document.hasFocus !== "function") {
    return true;
  }

  return document.hasFocus();
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

function isCompletedRun(run: RunRecord, index: RunNotificationIndex) {
  const status = normalizeStatus(run.status);
  return (status === "done" || status === "completed") && !index.busyRunIds.has(run.id);
}

function titleForRun(run: RunRecord) {
  return run.title?.trim() || t("notifications.push.fallbackConversationTitle");
}

function runUrl(runId: string, runnerProfileId?: string) {
  const path = `/session/${encodeURIComponent(runId)}`;
  return runnerProfileId
    ? `${path}?runner=${encodeURIComponent(runnerProfileId)}`
    : path;
}

function agentBelongsToRun(agent: AgentSnapshot, run: RunRecord, workerRunIds: Map<string, string>) {
  const mappedRunId = workerRunIds.get(agent.name);
  return mappedRunId === run.id || agent.name.startsWith(`${run.id}-`);
}

// Built once per stream state. Deriving these per run made every live frame
// cost runs × (workers + agents), which on a long conversation history kept the
// main thread busy enough to delay keystrokes and drop touch gestures.
interface RunNotificationIndex {
  busyRunIds: Set<string>;
  agentsByRun: Map<string, AgentSnapshot[]>;
  detailsByRun: Map<string, string>;
  questionsByRun: Map<string, string>;
  workerRunIds: Map<string, string>;
  agentsWithPendingPermissions: AgentSnapshot[];
  pendingClarificationRunIds: Set<string>;
}

function buildRunNotificationIndex(state: EventStreamState): RunNotificationIndex {
  const workerRunIds = new Map((state.workers ?? []).map((worker) => [worker.id, worker.runId]));
  const busyRunIds = new Set((state.queuedMessages ?? [])
    .filter((message) => message.status === "pending" || message.status === "delivering").map((message) => message.runId));
  const active = new Set(["starting", "working", "running", "stuck", "recovering"]);
  for (const worker of state.workers ?? []) {
    if (active.has(normalizeStatus(worker.status))) busyRunIds.add(worker.runId);
  }
  const agentsByRun = new Map<string, AgentSnapshot[]>();
  for (const agent of state.agents ?? []) {
    const runId = workerRunIds.get(agent.name) ?? agent.name.match(/^(.*)-worker-\d+$/)?.[1];
    if (!runId) continue;
    const agents = agentsByRun.get(runId) ?? [];
    agents.push(agent);
    agentsByRun.set(runId, agents);
    if (active.has(normalizeStatus(agent.state))) busyRunIds.add(runId);
  }
  const detailsByRun = new Map<string, string>();
  const latestEventTimes = new Map<string, number>();
  for (const event of state.executionEvents ?? []) {
    if (event.eventType !== "run_completed") continue;
    const time = Date.parse(event.createdAt);
    if (time < (latestEventTimes.get(event.runId) ?? -Infinity)) continue;
    latestEventTimes.set(event.runId, time);
    detailsByRun.set(event.runId, notificationEventDetail(event.details));
  }
  const questionsByRun = new Map((state.clarifications ?? [])
    .filter((question) => normalizeStatus(question.status) === "pending")
    .map((question) => [question.runId, question.question]));
  return {
    busyRunIds, agentsByRun, detailsByRun, questionsByRun,
    workerRunIds,
    agentsWithPendingPermissions: (state.agents ?? []).filter((agent) => (agent.pendingPermissions?.length ?? 0) > 0),
    pendingClarificationRunIds: new Set((state.clarifications ?? [])
      .filter((clarification) => normalizeStatus(clarification.status) === "pending")
      .map((clarification) => clarification.runId)),
  };
}

function buildPermissionKeys(run: RunRecord, index: RunNotificationIndex) {
  const keys = new Set<string>();

  for (const agent of index.agentsWithPendingPermissions) {
    if (!agentBelongsToRun(agent, run, index.workerRunIds)) {
      continue;
    }

    for (const permission of agent.pendingPermissions ?? []) {
      keys.add(`${agent.name}-${permission.requestId}`);
    }
  }

  return keys;
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

function buildObservedRunState(run: RunRecord, index: RunNotificationIndex): ObservedRunState {
  return {
    status: normalizeStatus(run.status),
    inputNeeded: normalizeStatus(run.status) === "awaiting_user" || index.pendingClarificationRunIds.has(run.id),
    completed: isCompletedRun(run, index),
    permissionKeys: buildPermissionKeys(run, index),
  };
}

export class ConversationNotificationManager extends StateManager<ConversationNotificationState> {
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  private readonly notifier: ConversationNotifier;
  private readonly permissionProvider: ConversationNotificationPermissionProvider;
  private readonly visibilityProvider: () => DocumentVisibilityState;
  private readonly focusProvider: () => boolean;
  private readonly pushClient: ConversationPushClient;
  private subscriptionApi: ConversationSubscriptionApi | null;
  private listEntries: RuntimeAPIs["workers"]["listEntries"] | undefined;
  private readonly observedRuns = new Map<string, ObservedRunState>();
  private readonly observedScopes = new Set<string>();

  constructor(options: ConversationNotificationManagerOptions = {}) {
    super(initialNotificationState);
    this.storage = options.storage ?? getBrowserStorage();
    this.notifier = options.notifier ?? createBrowserNotifier();
    this.permissionProvider = options.permissionProvider ?? createBrowserPermissionProvider();
    this.visibilityProvider = options.visibilityProvider ?? getBrowserVisibility;
    this.focusProvider = options.focusProvider ?? getBrowserFocus;
    this.pushClient = options.pushClient ?? createBrowserPushClient();
    this.subscriptionApi = options.subscriptionApi ?? null;
    this.listEntries = options.listEntries;
  }

  configure(notifications: RuntimeAPIs["notifications"], listEntries?: RuntimeAPIs["workers"]["listEntries"]) {
    this.listEntries = listEntries;
    this.subscriptionApi = createRuntimeSubscriptionApi(notifications);
  }

  private getSubscriptionApi() {
    if (!this.subscriptionApi) {
      throw new Error("Notifications are not connected to the runtime.");
    }
    return this.subscriptionApi;
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
        const subscriptionApi = this.getSubscriptionApi();
        const config = await subscriptionApi.loadConfig();
        if (config.supported && config.publicKey) {
          const subscription = await this.pushClient.subscribe(config.publicKey);
          await subscriptionApi.saveSubscription(subscription);
        }
      } catch (error) {
        this.patch({
          enabled: false,
          permission,
          lastError: runtimeErrorMessage(error),
        });
        return;
      }
    }

    safeSetBrowserStorageItem(this.storage, CONVERSATION_NOTIFICATIONS_STORAGE_KEY, "true");
    this.patch({
      enabled: true,
      permission: "granted",
      lastError: null,
    });
  }

  disable() {
    safeSetBrowserStorageItem(this.storage, CONVERSATION_NOTIFICATIONS_STORAGE_KEY, "false");
    if (this.pushClient.isSupported()) {
      void this.pushClient.unsubscribe().then((endpoint) => {
        if (endpoint) {
          return this.getSubscriptionApi().removeSubscription(endpoint);
        }
        return undefined;
      }).catch((error: unknown) => {
        this.patch({
          lastError: runtimeErrorMessage(error),
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
    this.handleScopedEventStreamState({
      scope: "default",
      runnerName: null,
      runnerProfileId: null,
      listEntries: this.listEntries,
    }, state);
  }

  handleRunnerEventStreamState(
    runner: {
      profileId: string;
      runnerInstanceId: string | null;
      runnerName: string;
      listEntries?: RuntimeAPIs["workers"]["listEntries"];
    },
    state: EventStreamState,
  ) {
    this.handleScopedEventStreamState({
      scope: runner.runnerInstanceId ?? runner.profileId,
      runnerName: runner.runnerName,
      runnerProfileId: runner.profileId,
      listEntries: runner.listEntries,
    }, state);
  }

  private handleScopedEventStreamState(
    runner: {
      scope: string;
      runnerName: string | null;
      runnerProfileId: string | null;
      listEntries?: RuntimeAPIs["workers"]["listEntries"];
    },
    state: EventStreamState,
  ) {
    const index = buildRunNotificationIndex(state);
    const nextObservedRuns = new Map<string, ObservedRunState>();
    const notifications: Array<{ request: ConversationNotificationRequest; workerId?: string; scopedRunId: string; observed: ObservedRunState }> = [];

    for (const run of state.runs ?? []) {
      const tagScope = runner.runnerProfileId ? `${runner.scope}-` : "";
      const scopedRunId = `${runner.scope}:${run.id}`;
      const previous = this.observedRuns.get(scopedRunId);
      const observed = buildObservedRunState(run, index);
      nextObservedRuns.set(scopedRunId, observed);

      if (!this.observedScopes.has(runner.scope) || !previous) {
        continue;
      }

      const agents = index.agentsByRun.get(run.id) ?? [];
      const newPermissionKey = hasNewPermission(previous, observed.permissionKeys);
      let kind: ConversationNotificationKind | null = null;
      let detail = "";
      let tag = "";
      if (newPermissionKey) {
        kind = "permission";
        for (const agent of agents) {
          const permission = agent.pendingPermissions?.find((item) => `${agent.name}-${item.requestId}` === newPermissionKey);
          if (permission) detail = permission.toolCall?.title ?? "";
        }
        tag = `permission-${newPermissionKey}`;
      } else if (!previous.inputNeeded && observed.inputNeeded) {
        kind = "input";
        detail = index.questionsByRun.get(run.id) ?? "";
        tag = "input";
      } else if (previous.status !== "failed" && observed.status === "failed") {
        kind = "failed";
        detail = run.lastError ?? "";
        tag = "failed";
      } else if (!previous.completed && observed.completed && !observed.inputNeeded && observed.permissionKeys.size === 0) {
        kind = run.mode === "direct" || run.mode === "commit" ? "response" : "complete";
        detail = kind === "complete" ? index.detailsByRun.get(run.id) ?? "" : "";
        tag = "complete";
      }
      if (!kind) continue;
      if (!detail && kind !== "permission" && kind !== "failed") {
        // The latest assistant message of the settled turn is its result.
        // ACP does not expose commentary/final channels, so only read after
        // the latest input and only once the lifecycle says the turn settled.
        const messages = agents.flatMap((agent) => {
          const entries = agent.outputEntries ?? [];
          const input = entries.findLastIndex((entry) => entry.type === "user_input" || entry.type === "user_message_chunk" || entry.type === "supervisor_input");
          return entries.slice(input + 1).filter((entry) => entry.type === "message" && entry.status !== "archived" && entry.text.trim());
        });
        messages.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        detail = notificationPreview(messages.at(-1)?.text);
      }
      notifications.push({
        scopedRunId, observed,
        workerId: !detail && (kind === "response" || kind === "input")
          ? [...(state.workers ?? [])].filter((worker) => worker.runId === run.id).sort((a, b) => (a.workerNumber ?? 0) - (b.workerNumber ?? 0)).at(-1)?.id
          : undefined,
        request: {
          ...conversationNotificationContent({ kind, title: titleForRun(run), detail, runner: runner.runnerName }, t),
          tag: `omniharness-${tagScope}${run.id}-${tag}`,
          url: runUrl(run.id, runner.runnerProfileId ?? undefined),
        },
      });
    }

    for (const key of [...this.observedRuns.keys()]) {
      if (key.startsWith(`${runner.scope}:`)) {
        this.observedRuns.delete(key);
      }
    }
    for (const [scopedRunId, observed] of nextObservedRuns) {
      this.observedRuns.set(scopedRunId, observed);
    }
    this.observedScopes.add(runner.scope);

    if (!this.canNotifyNow()) {
      return;
    }

    for (const notification of notifications) {
      void this.deliverNotification(notification, runner.listEntries).catch((error: unknown) => {
        this.patch({ lastError: runtimeErrorMessage(error) });
      });
    }
  }

  private async deliverNotification(
    notification: { request: ConversationNotificationRequest; workerId?: string; scopedRunId: string; observed: ObservedRunState },
    listEntries?: RuntimeAPIs["workers"]["listEntries"],
  ) {
    const request = { ...notification.request };
    if (notification.workerId && listEntries) {
      // Read the canonical stream through its existing manager. Snapshot frames
      // intentionally omit conversation content; never add a second projection.
      const reader = new WorkerEntriesManager({ listEntries, storage: null });
      await reader.ensureLoaded(notification.workerId);
      const stream = reader.getState(notification.workerId);
      if (stream.lastError) this.patch({ lastError: stream.lastError });
      const input = stream.entries.findLastIndex((entry) => ["user_input", "user_message_chunk", "supervisor_input"].includes(entry.type));
      const message = stream.entries.slice(input + 1).findLast((entry) => entry.type === "message" && entry.status !== "archived" && entry.text.trim());
      request.body = notificationPreview(message?.text) || request.body;
      reader.reset();
    }
    // A reply or runner refresh may arrive while the preview is loading.
    const current = this.observedRuns.get(notification.scopedRunId);
    if (!current || current.status !== notification.observed.status
      || current.inputNeeded !== notification.observed.inputNeeded
      || current.completed !== notification.observed.completed || !this.canNotifyNow()) return;
    await this.notifier.notify(request);
  }

  private canNotifyNow() {
    const snapshot = this.getSnapshot();
    if (!snapshot.enabled || snapshot.permission !== "granted") {
      return false;
    }

    if (this.visibilityProvider() !== "visible") {
      return true;
    }

    return !this.focusProvider();
  }
}

export const conversationNotificationManager = new ConversationNotificationManager();

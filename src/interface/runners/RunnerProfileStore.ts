import { StateManager } from "@/lib/state-manager";
import type { RunnerCredentialStore } from "./RunnerCredentialStore";
import {
  RUNNER_PROFILE_SCHEMA_VERSION,
  RUNNER_REGISTRY_SCHEMA_VERSION,
  emptyRunnerScopedState,
  type RunnerIdentityLearningResult,
  type RunnerProfile,
  type RunnerProfileStoreSnapshot,
  type RunnerScopedState,
} from "./RunnerProfile";

const PROFILE_STORAGE_KEY = "omniharness.runnerProfiles";
export const SAME_ORIGIN_PROFILE_ID = "same-origin";

type ProfileStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ProfileDocument = Omit<RunnerProfileStoreSnapshot, "hydrated" | "recoveryNoticeCode">;

function defaultStorage(): ProfileStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function createUuid() {
  return globalThis.crypto.randomUUID();
}

function canonicalBaseUrl(value: string) {
  const url = new URL(value);
  if (url.username || url.password) {
    throw new TypeError("Server URLs cannot contain credentials.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Server URLs must use HTTP or HTTPS.");
  }
  return url.origin;
}

function sameOriginProfile(origin: string, now: string): RunnerProfile {
  return {
    id: SAME_ORIGIN_PROFILE_ID,
    runnerInstanceId: null,
    label: new URL(origin).host,
    baseUrl: origin,
    savedPassword: null,
    authTransport: "cookie",
    credentialRef: null,
    schemaVersion: RUNNER_PROFILE_SCHEMA_VERSION,
    createdAt: now,
    lastConnectedAt: null,
    isSameOrigin: true,
  };
}

function mergeScopedState(
  left: RunnerScopedState | undefined,
  right: RunnerScopedState | undefined,
  options: { clearCursors?: boolean } = {},
): RunnerScopedState {
  return {
    preferences: { ...(left?.preferences ?? {}), ...(right?.preferences ?? {}) },
    drafts: { ...(left?.drafts ?? {}), ...(right?.drafts ?? {}) },
    cursors: options.clearCursors
      ? {}
      : { ...(left?.cursors ?? {}), ...(right?.cursors ?? {}) },
  };
}

function normalizeScopedState(value: unknown): RunnerScopedState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyRunnerScopedState();
  }
  const record = value as Partial<RunnerScopedState>;
  return {
    preferences: record.preferences && typeof record.preferences === "object" && !Array.isArray(record.preferences)
      ? record.preferences as Record<string, unknown>
      : {},
    drafts: record.drafts && typeof record.drafts === "object" && !Array.isArray(record.drafts)
      ? Object.fromEntries(Object.entries(record.drafts).filter(([, item]) => typeof item === "string")) as Record<string, string>
      : {},
    cursors: record.cursors && typeof record.cursors === "object" && !Array.isArray(record.cursors)
      ? Object.fromEntries(Object.entries(record.cursors).filter(([, item]) => typeof item === "string")) as Record<string, string>
      : {},
  };
}

function normalizeProfile(value: unknown, origin: string, now: string): RunnerProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string"
    || !candidate.id
    || typeof candidate.label !== "string"
  ) {
    return null;
  }
  const rawUrl = typeof candidate.baseUrl === "string"
    ? candidate.baseUrl
    : typeof candidate.url === "string"
      ? candidate.url
      : null;
  if (!rawUrl) {
    return null;
  }
  try {
    const isSameOrigin = candidate.id === SAME_ORIGIN_PROFILE_ID;
    return {
      id: candidate.id,
      runnerInstanceId: typeof candidate.runnerInstanceId === "string"
        ? candidate.runnerInstanceId
        : null,
      label: candidate.label.trim() || new URL(rawUrl).host,
      baseUrl: isSameOrigin ? origin : canonicalBaseUrl(rawUrl),
      savedPassword: typeof candidate.savedPassword === "string"
        ? candidate.savedPassword
        : null,
      authTransport: candidate.authTransport === "cookie" ? "cookie" : "bearer",
      credentialRef: typeof candidate.credentialRef === "string"
        ? candidate.credentialRef
        : null,
      schemaVersion: RUNNER_PROFILE_SCHEMA_VERSION,
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : now,
      lastConnectedAt: typeof candidate.lastConnectedAt === "string"
        ? candidate.lastConnectedAt
        : null,
      isSameOrigin,
    };
  } catch {
    return null;
  }
}

function parseDocument(raw: string | null, origin: string, now: string) {
  if (!raw) {
    return {
      document: {
        schemaVersion: RUNNER_REGISTRY_SCHEMA_VERSION,
        activeRunnerId: SAME_ORIGIN_PROFILE_ID,
        profiles: [sameOriginProfile(origin, now)],
        scopedState: {},
      } satisfies ProfileDocument,
      recovered: false,
    };
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  const profiles = rawProfiles
    .map((profile) => normalizeProfile(profile, origin, now))
    .filter((profile): profile is RunnerProfile => Boolean(profile));
  const sameOrigin = profiles.find((profile) => profile.id === SAME_ORIGIN_PROFILE_ID);
  const normalizedProfiles = [
    sameOrigin ?? sameOriginProfile(origin, now),
    ...profiles.filter((profile) => profile.id !== SAME_ORIGIN_PROFILE_ID),
  ];
  const legacyActive = typeof parsed.selectedProfileId === "string"
    ? parsed.selectedProfileId
    : null;
  const requestedActive = typeof parsed.activeRunnerId === "string"
    ? parsed.activeRunnerId
    : legacyActive;
  const activeRunnerId = normalizedProfiles.some((profile) => profile.id === requestedActive)
    ? requestedActive!
    : SAME_ORIGIN_PROFILE_ID;
  const rawScoped = parsed.scopedState && typeof parsed.scopedState === "object" && !Array.isArray(parsed.scopedState)
    ? parsed.scopedState as Record<string, unknown>
    : {};
  return {
    document: {
      schemaVersion: RUNNER_REGISTRY_SCHEMA_VERSION,
      activeRunnerId,
      profiles: normalizedProfiles,
      scopedState: Object.fromEntries(
        Object.entries(rawScoped).map(([key, value]) => [key, normalizeScopedState(value)]),
      ),
    } satisfies ProfileDocument,
    recovered: false,
  };
}

function initialSnapshot(origin: string, now: string): RunnerProfileStoreSnapshot {
  return {
    schemaVersion: RUNNER_REGISTRY_SCHEMA_VERSION,
    hydrated: false,
    activeRunnerId: SAME_ORIGIN_PROFILE_ID,
    profiles: [sameOriginProfile(origin, now)],
    scopedState: {},
    recoveryNoticeCode: null,
  };
}

export class RunnerProfileStore extends StateManager<RunnerProfileStoreSnapshot> {
  private readonly storage: ProfileStorage | null;
  private readonly credentialStore: RunnerCredentialStore;
  private readonly locationOrigin: string;
  private readonly randomUUID: () => string;
  private readonly now: () => string;

  constructor(options: {
    storage?: ProfileStorage | null;
    credentialStore: RunnerCredentialStore;
    locationOrigin?: string;
    randomUUID?: () => string;
    now?: () => string;
  }) {
    const origin = canonicalBaseUrl(
      options.locationOrigin
      ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost"),
    );
    const now = options.now ?? (() => new Date().toISOString());
    super(initialSnapshot(origin, now()));
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.credentialStore = options.credentialStore;
    this.locationOrigin = origin;
    this.randomUUID = options.randomUUID ?? createUuid;
    this.now = now;
  }

  async hydrate() {
    try {
      const { document } = parseDocument(
        this.storage?.getItem(PROFILE_STORAGE_KEY) ?? null,
        this.locationOrigin,
        this.now(),
      );
      this.storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(document));
      this.update({
        ...document,
        hydrated: true,
        recoveryNoticeCode: this.credentialStore.getRecoveryNoticeCode(),
      });
    } catch {
      const fallback = initialSnapshot(this.locationOrigin, this.now());
      const document = this.toDocument({ ...fallback, hydrated: true });
      try {
        this.storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(document));
      } catch {
        // Recovery still succeeds in memory when persistence is unavailable.
      }
      this.update({
        ...fallback,
        hydrated: true,
        recoveryNoticeCode: "runner.profiles.corruptReset",
      });
    }
  }

  private toDocument(snapshot: RunnerProfileStoreSnapshot): ProfileDocument {
    return {
      schemaVersion: RUNNER_REGISTRY_SCHEMA_VERSION,
      activeRunnerId: snapshot.activeRunnerId,
      profiles: snapshot.profiles,
      scopedState: snapshot.scopedState,
    };
  }

  private persist(next: RunnerProfileStoreSnapshot) {
    this.storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.toDocument(next)));
    this.update(next);
  }

  getProfile(profileId: string) {
    return this.getSnapshot().profiles.find((profile) => profile.id === profileId) ?? null;
  }

  scopeKey(profileId: string) {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error("Server profile not found.");
    }
    return profile.runnerInstanceId ?? profile.id;
  }

  getScopedState(profileId: string) {
    return this.getSnapshot().scopedState[this.scopeKey(profileId)]
      ?? emptyRunnerScopedState();
  }

  async updateScopedState(profileId: string, patch: Partial<RunnerScopedState>) {
    const current = this.getSnapshot();
    const key = this.scopeKey(profileId);
    const previous = current.scopedState[key] ?? emptyRunnerScopedState();
    const nextScoped = mergeScopedState(previous, {
      preferences: patch.preferences ?? {},
      drafts: patch.drafts ?? {},
      cursors: patch.cursors ?? {},
    });
    this.persist({
      ...current,
      scopedState: { ...current.scopedState, [key]: nextScoped },
    });
  }

  async addProfile(input: { label: string; baseUrl: string; password?: string }) {
    const current = this.getSnapshot();
    const profile: RunnerProfile = {
      id: this.randomUUID(),
      runnerInstanceId: null,
      label: input.label.trim() || new URL(input.baseUrl).host,
      baseUrl: canonicalBaseUrl(input.baseUrl),
      savedPassword: input.password || null,
      authTransport: "bearer",
      credentialRef: null,
      schemaVersion: RUNNER_PROFILE_SCHEMA_VERSION,
      createdAt: this.now(),
      lastConnectedAt: null,
      isSameOrigin: false,
    };
    this.persist({ ...current, profiles: [...current.profiles, profile] });
    return profile;
  }

  async attachCredential(profileId: string, credentialRef: string) {
    const current = this.getSnapshot();
    if (!this.getProfile(profileId)) {
      throw new Error("Server profile not found.");
    }
    this.persist({
      ...current,
      profiles: current.profiles.map((profile) => (
        profile.id === profileId ? { ...profile, credentialRef } : profile
      )),
    });
  }

  async setActiveRunner(profileId: string) {
    const current = this.getSnapshot();
    if (!current.profiles.some((profile) => profile.id === profileId)) {
      throw new Error("Server profile not found.");
    }
    this.persist({ ...current, activeRunnerId: profileId });
  }

  async editProfile(
    profileId: string,
    patch: { label?: string; baseUrl?: string; password?: string },
  ) {
    const current = this.getSnapshot();
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error("Server profile not found.");
    }
    const nextBaseUrl = patch.baseUrl === undefined
      ? profile.baseUrl
      : canonicalBaseUrl(patch.baseUrl);
    const urlChanged = nextBaseUrl !== profile.baseUrl;
    const nextProfile: RunnerProfile = {
      ...profile,
      label: patch.label === undefined
        ? profile.label
        : patch.label.trim() || new URL(nextBaseUrl).host,
      baseUrl: nextBaseUrl,
      savedPassword: patch.password === undefined
        ? profile.savedPassword
        : patch.password || null,
      credentialRef: urlChanged ? null : profile.credentialRef,
    };
    this.persist({
      ...current,
      profiles: current.profiles.map((item) => item.id === profileId ? nextProfile : item),
    });
    if (urlChanged && profile.credentialRef) {
      await this.credentialStore.clear(profile.credentialRef);
    }
    return nextProfile;
  }

  async forgetProfile(profileId: string) {
    const current = this.getSnapshot();
    const profile = this.getProfile(profileId);
    if (!profile || profile.isSameOrigin) {
      return false;
    }
    const scope = profile.runnerInstanceId ?? profile.id;
    const scopedState = { ...current.scopedState };
    delete scopedState[scope];
    this.persist({
      ...current,
      activeRunnerId: current.activeRunnerId === profileId
        ? SAME_ORIGIN_PROFILE_ID
        : current.activeRunnerId,
      profiles: current.profiles.filter((item) => item.id !== profileId),
      scopedState,
    });
    if (profile.credentialRef) {
      await this.credentialStore.clear(profile.credentialRef);
    }
    await this.credentialStore.clearForProfile(profileId);
    return true;
  }

  async learnIdentity(
    profileId: string,
    runnerInstanceId: string,
    options: {
      confirmIdentityChange?: boolean;
      validSameOriginSession?: boolean;
    } = {},
  ): Promise<RunnerIdentityLearningResult> {
    const current = this.getSnapshot();
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error("Server profile not found.");
    }
    const observed = runnerInstanceId.trim();
    if (!observed) {
      throw new TypeError("Server identity is required.");
    }
    if (
      profile.runnerInstanceId
      && profile.runnerInstanceId !== observed
      && !options.confirmIdentityChange
      && !(profile.isSameOrigin && options.validSameOriginSession)
    ) {
      return {
        status: "identity_mismatch",
        profileId,
        expectedRunnerInstanceId: profile.runnerInstanceId,
        observedRunnerInstanceId: observed,
      };
    }

    const duplicate = current.profiles.find((item) => (
      item.id !== profileId && item.runnerInstanceId === observed
    ));
    if (duplicate) {
      const canonical = profile.isSameOrigin ? profile : duplicate;
      const removed = canonical.id === profile.id ? duplicate : profile;
      const canonicalScope = canonical.runnerInstanceId ?? canonical.id;
      const removedScope = removed.runnerInstanceId ?? removed.id;
      const scopedState = { ...current.scopedState };
      scopedState[observed] = mergeScopedState(
        scopedState[canonicalScope],
        scopedState[removedScope],
      );
      if (canonicalScope !== observed) delete scopedState[canonicalScope];
      if (removedScope !== observed) delete scopedState[removedScope];
      this.persist({
        ...current,
        activeRunnerId: current.activeRunnerId === removed.id
          ? canonical.id
          : current.activeRunnerId,
        profiles: current.profiles
          .filter((item) => item.id !== removed.id)
          .map((item) => item.id === canonical.id
            ? { ...item, runnerInstanceId: observed }
            : item),
        scopedState,
      });
      if (removed.credentialRef) {
        await this.credentialStore.clear(removed.credentialRef);
      }
      await this.credentialStore.clearForProfile(removed.id);
      return { status: "merged", profileId: canonical.id };
    }

    const oldScope = profile.runnerInstanceId ?? profile.id;
    const identityChanged = Boolean(
      profile.runnerInstanceId && profile.runnerInstanceId !== observed,
    );
    let credentialRef = profile.credentialRef;
    if (identityChanged && credentialRef) {
      await this.credentialStore.clear(credentialRef);
      credentialRef = null;
    } else if (!profile.runnerInstanceId && credentialRef) {
      await this.credentialStore.rebind(credentialRef, {
        origin: profile.baseUrl,
        runnerInstanceId: observed,
      });
    }
    const scopedState = { ...current.scopedState };
    scopedState[observed] = mergeScopedState(
      scopedState[observed],
      scopedState[oldScope],
      { clearCursors: identityChanged },
    );
    if (oldScope !== observed) {
      delete scopedState[oldScope];
    }
    this.persist({
      ...current,
      profiles: current.profiles.map((item) => item.id === profileId
        ? { ...item, runnerInstanceId: observed, credentialRef }
        : item),
      scopedState,
    });
    return { status: "accepted", profileId };
  }
}

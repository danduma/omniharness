import { randomUUID } from "node:crypto";

export type VSCodeRunnerProfile = {
  id: string;
  label: string;
  baseUrl: string;
  credentialRef: string | null;
  runnerInstanceId: string | null;
  requiresReauth: boolean;
};

type ProfileDocument = {
  schemaVersion: 1;
  activeProfileId: string;
  profiles: VSCodeRunnerProfile[];
};

export type VSCodeMementoLike = {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
};

export type VSCodeSecretStorageLike = {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
};

const PROFILE_KEY = "omniHarness.runnerProfiles.v1";
const LEGACY_SECRET_KEY = "omniHarness.legacySessionCookie";

function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (
    url.origin !== value
    || (url.protocol !== "http:" && url.protocol !== "https:")
    || url.username
    || url.password
  ) {
    throw new TypeError("Runner URL must be an exact HTTP origin.");
  }
  return url.origin;
}

export class VSCodeRunnerProfileStore {
  constructor(
    private readonly state: VSCodeMementoLike,
    private readonly secrets: VSCodeSecretStorageLike,
  ) {}

  private document(defaultUrl = "http://127.0.0.1:3050"): ProfileDocument {
    return this.state.get<ProfileDocument>(PROFILE_KEY) ?? {
      schemaVersion: 1,
      activeProfileId: "default",
      profiles: [{
        id: "default",
        label: "Local runner",
        baseUrl: canonicalOrigin(defaultUrl),
        credentialRef: null,
        runnerInstanceId: null,
        requiresReauth: true,
      }],
    };
  }

  async initialize(input: {
    defaultUrl: string;
    legacyPlainCredential: string;
    clearLegacyPlainCredential(): Thenable<void>;
  }) {
    let document = this.document(canonicalOrigin(input.defaultUrl));
    if (!this.state.get<ProfileDocument>(PROFILE_KEY)) {
      await this.state.update(PROFILE_KEY, document);
    }
    const legacy = input.legacyPlainCredential.trim();
    if (legacy) {
      await this.secrets.store(LEGACY_SECRET_KEY, legacy);
      await input.clearLegacyPlainCredential();
      document = {
        ...document,
        profiles: document.profiles.map((profile, index) => index === 0
          ? {
              ...profile,
              credentialRef: LEGACY_SECRET_KEY,
              requiresReauth: true,
            }
          : profile),
      };
      await this.state.update(PROFILE_KEY, document);
    }
    return document;
  }

  list() {
    return this.document();
  }

  async resolve(profileId: string | null) {
    const document = this.document();
    const id = profileId ?? document.activeProfileId;
    const profile = document.profiles.find((item) => item.id === id) ?? null;
    if (!profile) return null;
    return {
      serverUrl: profile.baseUrl,
      bearerToken: profile.credentialRef && !profile.requiresReauth
        ? await this.secrets.get(profile.credentialRef) ?? null
        : null,
    };
  }

  async login(input: {
    profileId?: string | null;
    label: string;
    baseUrl: string;
    password: string;
    fetchImpl?: typeof fetch;
  }) {
    const baseUrl = canonicalOrigin(input.baseUrl);
    const profileId = input.profileId?.trim() || randomUUID();
    const response = await (input.fetchImpl ?? fetch)(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        password: input.password,
        tokenTransport: "bearer",
        clientLabel: "OmniHarness VS Code",
      }),
      redirect: "manual",
    });
    const body = await response.json() as {
      token?: unknown;
      error?: { message?: unknown };
    };
    if (!response.ok || typeof body.token !== "string") {
      throw new Error(
        typeof body.error?.message === "string"
          ? body.error.message
          : `Runner login failed with HTTP ${response.status}.`,
      );
    }
    const credentialRef = `omniHarness.runnerToken.${profileId}`;
    await this.secrets.store(credentialRef, body.token);
    const current = this.document(baseUrl);
    const profile: VSCodeRunnerProfile = {
      id: profileId,
      label: input.label.trim() || new URL(baseUrl).host,
      baseUrl,
      credentialRef,
      runnerInstanceId: null,
      requiresReauth: false,
    };
    const document: ProfileDocument = {
      schemaVersion: 1,
      activeProfileId: profileId,
      profiles: [
        ...current.profiles.filter((item) => item.id !== profileId),
        profile,
      ],
    };
    await this.state.update(PROFILE_KEY, document);
    return profile;
  }

  async learnIdentity(input: {
    profileId: string;
    runnerInstanceId: string;
    confirmChange: boolean;
  }) {
    const current = this.document();
    const profile = current.profiles.find((item) => item.id === input.profileId);
    if (!profile) {
      throw new Error("Runner profile was not found.");
    }
    if (
      profile.runnerInstanceId
      && profile.runnerInstanceId !== input.runnerInstanceId
      && !input.confirmChange
    ) {
      throw new Error("Runner identity confirmation is required.");
    }
    const next = {
      ...current,
      profiles: current.profiles.map((item) => item.id === input.profileId
        ? { ...item, runnerInstanceId: input.runnerInstanceId }
        : item),
    };
    await this.state.update(PROFILE_KEY, next);
    return next;
  }

  async forget(profileId: string) {
    const current = this.document();
    const profile = current.profiles.find((item) => item.id === profileId);
    if (profile?.credentialRef) await this.secrets.delete(profile.credentialRef);
    const profiles = current.profiles.filter((item) => item.id !== profileId);
    await this.state.update(PROFILE_KEY, {
      ...current,
      activeProfileId: current.activeProfileId === profileId
        ? profiles[0]?.id ?? ""
        : current.activeProfileId,
      profiles,
    });
  }
}

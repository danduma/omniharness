import { StateManager } from "@/lib/state-manager";

type AuthorizationStatus =
  | "idle"
  | "opening"
  | "waiting"
  | "exchanging"
  | "authorized"
  | "popup-blocked"
  | "denied"
  | "timed-out"
  | "failed";

type BrowserAuthorizationSnapshot = {
  status: AuthorizationStatus;
  state: string | null;
  error: string | null;
};

type MessageEventLike = {
  origin: string;
  source: unknown;
  data: unknown;
};

export interface BrowserAuthorizationWindowAdapter {
  origin: string;
  open(url: string, target: string, features: string): unknown | null;
  addMessageListener(listener: (event: MessageEventLike) => void): () => void;
  setTimer(callback: () => void, timeoutMs: number): unknown;
  clearTimer(timer: unknown): void;
}

function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function createChallenge(verifier: string) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  let binary = "";
  for (const value of new Uint8Array(digest)) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export class BrowserAuthorizationManager extends StateManager<BrowserAuthorizationSnapshot> {
  private cancelListener: (() => void) | null = null;
  private timer: unknown = null;
  private rejectPending: ((error: Error) => void) | null = null;

  constructor(private readonly windowAdapter: BrowserAuthorizationWindowAdapter) {
    super({ status: "idle", state: null, error: null });
  }

  async authorize<T>(args: {
    runnerUrl: string;
    exchange(input: {
      code: string;
      verifier: string;
      state: string;
      origin: string;
    }): Promise<T>;
  }): Promise<T> {
    this.cleanup();
    const runnerOrigin = new URL(args.runnerUrl).origin;
    const verifier = randomBase64Url();
    const state = randomBase64Url();
    this.update(() => ({ status: "opening", state, error: null }));
    const challenge = await createChallenge(verifier);
    const authorizeUrl = new URL("/authorize-interface", runnerOrigin);
    authorizeUrl.searchParams.set("origin", this.windowAdapter.origin);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("challenge", challenge);
    authorizeUrl.searchParams.set("method", "S256");
    const popup = this.windowAdapter.open(
      authorizeUrl.toString(),
      "omniharness-authorize",
      "popup,width=480,height=720",
    );
    if (!popup) {
      this.update(() => ({
        status: "popup-blocked",
        state,
        error: "Authorization popup was blocked.",
      }));
      throw new Error("Authorization popup was blocked.");
    }

    this.update(() => ({ status: "waiting", state, error: null }));
    return new Promise<T>((resolve, reject) => {
      this.rejectPending = reject;
      this.cancelListener = this.windowAdapter.addMessageListener((event) => {
        const data = event.data as {
          type?: unknown;
          code?: unknown;
          state?: unknown;
          denied?: unknown;
        } | null;
        if (
          event.source !== popup
          || event.origin !== runnerOrigin
          || !data
          || data.type !== "omni.authorization"
          || data.state !== state
        ) {
          return;
        }
        if (data.denied === true) {
          this.markDenied();
          return;
        }
        if (typeof data.code !== "string") {
          return;
        }
        this.update(() => ({ status: "exchanging", state, error: null }));
        void args.exchange({
          code: data.code,
          verifier,
          state,
          origin: this.windowAdapter.origin,
        }).then((result) => {
          this.cleanup();
          this.update(() => ({ status: "authorized", state, error: null }));
          resolve(result);
        }, (error: unknown) => {
          this.cleanup();
          const normalized = error instanceof Error ? error : new Error(String(error));
          this.update(() => ({ status: "failed", state, error: normalized.message }));
          reject(normalized);
        });
      });
      this.timer = this.windowAdapter.setTimer(() => {
        this.markTimedOut();
      }, 60_000);
    });
  }

  markDenied() {
    const reject = this.rejectPending;
    this.cleanup();
    this.update((current) => ({
      status: "denied",
      state: current.state,
      error: "Authorization was denied.",
    }));
    reject?.(new Error("Authorization was denied."));
  }

  markTimedOut() {
    const reject = this.rejectPending;
    this.cleanup();
    this.update((current) => ({
      status: "timed-out",
      state: current.state,
      error: "Authorization timed out.",
    }));
    reject?.(new Error("Authorization timed out."));
  }

  buildPlatformReturnLink(input: { code: string; state: string }) {
    const params = new URLSearchParams(input);
    return `omniharness://authorize?${params.toString()}`;
  }

  private cleanup() {
    this.cancelListener?.();
    this.cancelListener = null;
    if (this.timer !== null) {
      this.windowAdapter.clearTimer(this.timer);
      this.timer = null;
    }
    this.rejectPending = null;
  }
}

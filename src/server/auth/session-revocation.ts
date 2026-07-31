export type AuthSessionRevocation = {
  sessionIds: ReadonlySet<string> | null;
  reason: "revoked" | "revoked_all" | "lru_evicted" | "password_rotated";
};

type Listener = (revocation: AuthSessionRevocation) => void;

const listeners = new Set<Listener>();

export function subscribeAuthSessionRevocations(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceAuthSessionRevocation(input: {
  sessionIds: Iterable<string> | null;
  reason: AuthSessionRevocation["reason"];
}) {
  const revocation: AuthSessionRevocation = {
    sessionIds: input.sessionIds === null ? null : new Set(input.sessionIds),
    reason: input.reason,
  };
  for (const listener of listeners) {
    listener(revocation);
  }
}

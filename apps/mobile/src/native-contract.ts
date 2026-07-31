export const MOBILE_STREAM_LIMITS = {
  maxQueuedFrames: 256,
  maxQueuedBytes: 1024 * 1024,
} as const;

export type MobileRuntimeTarget = {
  profileId: string;
  baseUrl: string;
  credentialRef: string | null;
  runnerInstanceId: string | null;
};

export function validateMobileRuntimeTarget(
  value: MobileRuntimeTarget,
): MobileRuntimeTarget {
  if (!value.profileId.trim()) {
    throw new TypeError("Mobile runner profile id is required.");
  }
  const url = new URL(value.baseUrl);
  if (
    (url.protocol !== "https:" && url.protocol !== "http:")
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw new TypeError("Mobile runner URL must be an HTTP(S) origin.");
  }
  return {
    ...value,
    profileId: value.profileId.trim(),
    baseUrl: url.origin,
  };
}

export function validateMobileRuntimePath(path: string) {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new TypeError("Mobile runner request path is invalid.");
  }
  return path;
}

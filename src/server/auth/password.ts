import crypto from "crypto";
import { hash, hashSync, verify } from "@node-rs/argon2";
import { getConfiguredAuthPassword, getConfiguredAuthPasswordHash } from "@/server/auth/config";

const ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashAuthPassword(password: string) {
  return hashSync(password, ARGON_OPTIONS);
}

export async function verifyConfiguredAuthPassword(password: string) {
  const configuredHash = getConfiguredAuthPasswordHash();
  if (configuredHash) {
    return verify(configuredHash, password, ARGON_OPTIONS);
  }

  const configuredPassword = getConfiguredAuthPassword();
  if (!configuredPassword) {
    return false;
  }

  const left = Buffer.from(configuredPassword, "utf8");
  const right = Buffer.from(password, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export async function hashPasswordForTests(password: string) {
  return hash(password, ARGON_OPTIONS);
}

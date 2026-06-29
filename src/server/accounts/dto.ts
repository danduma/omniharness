import type { accounts } from "@/server/db/schema";

type AccountRow = typeof accounts.$inferSelect;

export type AccountDto = {
  id: string;
  cliType: string | null;
  provider: string;
  type: string;
  label: string | null;
  authMode: string;
  enabled: boolean;
  priority: number;
  capacity: number | null;
  resetSchedule: string | null;
  status: string | null;
  statusCheckedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string | null;
};

function parseMetadata(metadataJson: string | null): Record<string, unknown> | null {
  if (!metadataJson) return null;
  try {
    const value = JSON.parse(metadataJson) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function toAccountDto(account: AccountRow): AccountDto {
  return {
    id: account.id,
    cliType: account.cliType ?? null,
    provider: account.provider,
    type: account.type,
    label: account.label ?? null,
    authMode: account.authMode,
    enabled: account.enabled,
    priority: account.priority,
    capacity: account.capacity ?? null,
    resetSchedule: account.resetSchedule ?? null,
    status: account.status ?? null,
    statusCheckedAt: account.statusCheckedAt?.toISOString() ?? null,
    metadata: parseMetadata(account.metadataJson ?? null),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt?.toISOString() ?? null,
  };
}

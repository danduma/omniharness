import type { accounts } from "@/server/db/schema";

type AccountRow = typeof accounts.$inferSelect;

export type AccountDto = {
  id: string;
  provider: string;
  type: string;
  capacity: number | null;
  resetSchedule: string | null;
  createdAt: string;
};

export function toAccountDto(account: AccountRow): AccountDto {
  return {
    id: account.id,
    provider: account.provider,
    type: account.type,
    capacity: account.capacity ?? null,
    resetSchedule: account.resetSchedule ?? null,
    createdAt: account.createdAt.toISOString(),
  };
}

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { db } from '../db';
import { accounts, creditEvents } from '../db/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

export interface AccountConfig {
  id: string;
  provider: string;
  type: string;
  auth_ref: string;
  capacity?: number;
  reset_schedule?: string;
}

export class CreditManager {
  private configPath: string;

  constructor() {
    this.configPath = path.resolve(process.cwd(), 'config', 'accounts.yml');
  }

  loadConfig(): AccountConfig[] {
    if (!fs.existsSync(this.configPath)) return [];
    const content = fs.readFileSync(this.configPath, 'utf8');
    const parsed = yaml.load(content) as { accounts: AccountConfig[] };
    return parsed.accounts || [];
  }

  async syncAccounts() {
    const configAccounts = this.loadConfig();
    for (const acc of configAccounts) {
      const existing = await db.select().from(accounts).where(eq(accounts.id, acc.id)).get();
      if (!existing) {
        await db.insert(accounts).values({
          id: acc.id,
          provider: acc.provider,
          type: acc.type,
          authRef: acc.auth_ref,
          capacity: acc.capacity,
          resetSchedule: acc.reset_schedule,
          createdAt: new Date(),
        });
      }
    }
  }

  async recordEvent(accountId: string, workerId: string, eventType: string, details?: string) {
    await db.insert(creditEvents).values({
      id: randomUUID(),
      accountId,
      workerId,
      eventType,
      details,
      createdAt: new Date(),
    });
  }

  async checkCredits(accountId: string): Promise<string> {
    const acc = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!acc) return `Account ${accountId} not found.`;
    if (typeof acc.capacity === 'number' && acc.capacity <= 0) {
      return `Account ${accountId} (${acc.provider}) is exhausted.`;
    }
    if (typeof acc.capacity === 'number') {
      return `Account ${accountId} (${acc.provider}) has ${acc.capacity} credits remaining.`;
    }
    return `Account ${accountId} (${acc.provider}) has sufficient credits.`;
  }

  async applyStrategy(workerId: string, strategy: string): Promise<string> {
    const configAccounts = this.loadConfig();
    const subscriptions = configAccounts.filter(acc => acc.type === 'subscription');
    const apiAccounts = configAccounts.filter(acc => acc.type === 'api');

    let target: AccountConfig | undefined;

    if (strategy === 'swap_account') {
      target = subscriptions.find(acc => acc.capacity === undefined || acc.capacity > 0) ?? subscriptions[0];
    } else if (strategy === 'fallback_api') {
      target = apiAccounts[0];
    } else if (strategy === 'wait_for_reset') {
      target = subscriptions.find(acc => Boolean(acc.reset_schedule)) ?? subscriptions[0];
    } else if (strategy === 'cross_provider') {
      target = apiAccounts[0] ?? configAccounts[0];
    }

    if (!target) {
      return `Worker ${workerId} could not switch via strategy ${strategy}: no candidate account found.`;
    }

    await this.syncAccounts();
    await this.recordEvent(target.id, workerId, 'switched', `Strategy ${strategy} selected ${target.id}`);
    return `Worker ${workerId} switched to ${target.id} via strategy ${strategy}.`;
  }
}

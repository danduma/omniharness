import { db } from "@/server/db";
import {
  accountSecrets,
  accountUsageSnapshots,
  accounts,
  creditEvents,
  runs,
  settings,
  workerCredentialAllocations,
  workerTokenUsage,
} from "@/server/db/schema";
import { requireApiSession } from "@/server/auth/guards";
import { toAccountDto } from "@/server/accounts/dto";
import {
  deletedAccountSettingKey,
  runAccountInventoryMigration,
} from "@/server/accounts/migration";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { errorResponse } from "@/server/api-errors";
import { emitNamedEvent } from "@/server/events/named-events";

const ACCOUNT_TYPES = new Set(["subscription", "api", "external"]);
const AUTH_MODES = new Set([
  "legacy_ref",
  "api_key",
  "credential_command",
  "credential_profile",
  "isolated_cli_home",
  "local_session",
]);
const ACCOUNT_STATUSES = new Set(["available", "quota_exhausted", "login_required", "disabled", "unknown"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function optionalInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function optionalMetadata(value: unknown) {
  if (value === null) return null;
  if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return undefined;
}

function pathAccountId(request: Request, params: Record<string, string> | undefined, suffix = "") {
  if (params?.id) return params.id;
  const pathname = new URL(request.url).pathname;
  const prefix = "/api/accounts/";
  if (!pathname.startsWith(prefix)) return "";
  const remainder = pathname.slice(prefix.length);
  const encodedId = suffix && remainder.endsWith(suffix)
    ? remainder.slice(0, -suffix.length)
    : remainder;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}

function jsonValidationError(message: string) {
  return Response.json({ error: { code: "account.invalid", message } }, { status: 400 });
}

function accountDeletionSetting(accountId: string, deleted: boolean, now: Date) {
  const key = deletedAccountSettingKey(accountId);
  if (!deleted) {
    return db.delete(settings).where(eq(settings.key, key));
  }
  return db.insert(settings).values({
      key,
      value: accountId,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: settings.key,
      set: {
        value: accountId,
        updatedAt: now,
      },
    });
}

function emitAccountDeleteFailure(input: {
  accountId: string;
  workerType: string | null;
  reason: string;
  message: string;
  cause?: Error;
}) {
  emitNamedEvent({
    kind: "account.delete_failed",
    accountId: input.accountId,
    workerType: input.workerType,
    reason: input.reason,
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "account.delete.failed",
    message: input.message,
    surface: "toast",
    accountId: input.accountId,
    cause: input.cause ? { name: input.cause.name, message: input.cause.message } : null,
  });
}

async function getAccounts(request: Request) {
  const auth = await requireApiSession(request, {
    source: "Accounts",
    action: "Load accounts",
  });
  if (auth.response) {
    return auth.response;
  }

  await runAccountInventoryMigration();
  const rows = await db.select().from(accounts);
  return Response.json(rows.map(toAccountDto));
}

async function postAccount(request: Request) {
  const auth = await requireApiSession(request, {
    source: "Accounts",
    action: "Create account",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = asRecord(await request.json());
  const now = new Date();
  const id = cleanString(body.id) || `account-${randomUUID()}`;
  const provider = cleanString(body.provider);
  const type = cleanString(body.type);
  const authMode = cleanString(body.authMode);
  const authRef = cleanString(body.authRef);
  if (!provider) return jsonValidationError("provider is required.");
  if (!ACCOUNT_TYPES.has(type)) return jsonValidationError("type must be subscription, api, or external.");
  if (!AUTH_MODES.has(authMode)) return jsonValidationError("authMode is not supported.");
  if (!authRef) return jsonValidationError("authRef is required.");

  const clearDeletion = accountDeletionSetting(id, false, now);
  await db.batch([db.insert(accounts).values({
    id,
    cliType: optionalString(body.cliType) ?? null,
    provider,
    type,
    label: optionalString(body.label) ?? null,
    authMode,
    authRef,
    enabled: optionalBoolean(body.enabled) ?? true,
    priority: optionalInteger(body.priority) ?? 0,
    capacity: optionalInteger(body.capacity) ?? null,
    resetSchedule: optionalString(body.resetSchedule) ?? null,
    status: optionalString(body.status) ?? null,
    metadataJson: optionalMetadata(body.metadata) ?? null,
    createdAt: now,
    updatedAt: now,
  }), clearDeletion]);
  emitNamedEvent({
    kind: "account.created",
    accountId: id,
    workerType: optionalString(body.cliType) ?? null,
    provider,
    authMode,
  });

  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  return Response.json(toAccountDto(row!));
}

export const handleAccountsRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "GET") return getAccounts(request);
    if (request.method === "POST") return postAccount(request);
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, POST" },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Accounts",
      action: request.method === "POST" ? "Create account" : "Load accounts",
    });
  }
};

export const handleAccountDetailRequest: OmniHttpHandler = async (request, context) => {
  let failedAccountId: string | null = null;
  let failedWorkerType: string | null = null;
  try {
    const isDelete = request.method === "DELETE";
    if (isDelete) {
      failedAccountId = pathAccountId(request, context.params);
    }
    const auth = await requireApiSession(request, {
      source: "Accounts",
      action: isDelete ? "Delete account" : "Update account",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      if (isDelete && failedAccountId) {
        emitAccountDeleteFailure({
          accountId: failedAccountId,
          workerType: null,
          reason: auth.response.status === 403 ? "same_origin_refused" : "authentication_refused",
          message: `Could not delete account: request was refused with status ${auth.response.status}.`,
        });
      }
      return auth.response;
    }
    if (request.method !== "PATCH" && request.method !== "DELETE") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "PATCH, DELETE" },
      });
    }

    const id = failedAccountId ?? pathAccountId(request, context.params);
    const existing = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!existing) {
      if (isDelete) {
        emitAccountDeleteFailure({
          accountId: id,
          workerType: null,
          reason: "not_found",
          message: "Could not delete account: account not found.",
        });
      }
      return Response.json({ error: { code: "account.not_found", message: "Account not found." } }, { status: 404 });
    }
    failedAccountId = id;
    failedWorkerType = existing.cliType;

    if (isDelete) {
      const rememberDeletion = accountDeletionSetting(id, true, new Date());
      await db.batch([
        db.update(runs).set({ preferredWorkerAccountId: null }).where(eq(runs.preferredWorkerAccountId, id)),
        db.delete(creditEvents).where(eq(creditEvents.accountId, id)),
        db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.accountId, id)),
        db.delete(workerTokenUsage).where(eq(workerTokenUsage.accountId, id)),
        db.delete(accountUsageSnapshots).where(eq(accountUsageSnapshots.accountId, id)),
        db.delete(accountSecrets).where(eq(accountSecrets.accountId, id)),
        db.delete(accounts).where(eq(accounts.id, id)),
        rememberDeletion,
      ]);
      emitNamedEvent({
        kind: "account.deleted",
        accountId: id,
        workerType: existing.cliType,
      });
      return Response.json({ ok: true, accountId: id });
    }

    const body = asRecord(await request.json());
    const patch: Partial<typeof accounts.$inferInsert> = { updatedAt: new Date() };
    const changedKeys: string[] = [];
    const markChanged = (key: string) => {
      changedKeys.push(key);
    };
    const cliType = optionalString(body.cliType);
    if (cliType !== undefined) {
      patch.cliType = cliType;
      markChanged("cliType");
    }
    const provider = optionalString(body.provider);
    if (provider !== undefined && provider !== null) {
      patch.provider = provider;
      markChanged("provider");
    }
    const type = optionalString(body.type);
    if (type !== undefined && type !== null) {
      if (!ACCOUNT_TYPES.has(type)) return jsonValidationError("type must be subscription, api, or external.");
      patch.type = type;
      markChanged("type");
    }
    const label = optionalString(body.label);
    if (label !== undefined) {
      patch.label = label;
      markChanged("label");
    }
    const authMode = optionalString(body.authMode);
    if (authMode !== undefined && authMode !== null) {
      if (!AUTH_MODES.has(authMode)) return jsonValidationError("authMode is not supported.");
      patch.authMode = authMode;
      markChanged("authMode");
    }
    const authRef = optionalString(body.authRef);
    if (authRef !== undefined && authRef !== null) {
      patch.authRef = authRef;
      markChanged("authRef");
    }
    const enabled = optionalBoolean(body.enabled);
    if (enabled !== undefined) {
      patch.enabled = enabled;
      markChanged("enabled");
    }
    const priority = optionalInteger(body.priority);
    if (priority !== undefined) {
      patch.priority = priority;
      markChanged("priority");
    }
    const capacity = optionalInteger(body.capacity);
    if (capacity !== undefined) {
      patch.capacity = capacity;
      markChanged("capacity");
    }
    const resetSchedule = optionalString(body.resetSchedule);
    if (resetSchedule !== undefined) {
      patch.resetSchedule = resetSchedule;
      markChanged("resetSchedule");
    }
    const status = optionalString(body.status);
    if (status !== undefined) {
      if (status && !ACCOUNT_STATUSES.has(status)) return jsonValidationError("status is not supported.");
      patch.status = status;
      markChanged("status");
    }
    const metadataJson = optionalMetadata(body.metadata);
    if (metadataJson !== undefined) {
      patch.metadataJson = metadataJson;
      markChanged("metadataJson");
    }

    await db.update(accounts).set(patch).where(eq(accounts.id, id));
    emitNamedEvent({
      kind: "account.updated",
      accountId: id,
      workerType: patch.cliType ?? existing.cliType,
      changedKeys,
    });
    const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    return Response.json(toAccountDto(row!));
  } catch (error) {
    if (request.method === "DELETE" && failedAccountId) {
      const cause = error instanceof Error ? error : new Error(String(error));
      emitAccountDeleteFailure({
        accountId: failedAccountId,
        workerType: failedWorkerType,
        reason: cause.message,
        message: `Could not delete account: ${cause.message}`,
        cause,
      });
    }
    return errorResponse(error, {
      status: 500,
      source: "Accounts",
      action: request.method === "DELETE" ? "Delete account" : "Update account",
    });
  }
};

export const handleAccountStatusRequest: OmniHttpHandler = async (request, context) => {
  try {
    const auth = await requireApiSession(request, {
      source: "Accounts",
      action: "Refresh account status",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }
    const id = pathAccountId(request, context.params, "/status");
    const existing = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    if (!existing) {
      return Response.json({ error: { code: "account.not_found", message: "Account not found." } }, { status: 404 });
    }
    const body = asRecord(await request.json().catch(() => ({})));
    const requestedStatus = optionalString(body.status);
    if (requestedStatus && !ACCOUNT_STATUSES.has(requestedStatus)) {
      return jsonValidationError("status is not supported.");
    }
    const status = requestedStatus ?? existing.status ?? "unknown";
    const now = new Date();
    await db.update(accounts).set({
      status,
      statusCheckedAt: now,
      updatedAt: now,
    }).where(eq(accounts.id, id));
    emitNamedEvent({
      kind: "account.status_checked",
      accountId: id,
      workerType: existing.cliType,
      status,
    });
    const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
    return Response.json(toAccountDto(row!));
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Accounts",
      action: "Refresh account status",
    });
  }
};

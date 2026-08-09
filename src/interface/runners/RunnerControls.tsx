"use client";

import React, { useCallback } from "react";
import {
  Check,
  CircleDot,
  Edit3,
  KeyRound,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Server,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { isRuntimeTransportFailure } from "@/runtime-api/request";
import { createWebRuntimeAPIs } from "@/runtime-api/web";
import { BrowserAuthorizationManager } from "@/interface/auth/BrowserAuthorizationManager";
import {
  useOptionalRunnerRegistryContext,
  useRunnerConnections,
} from "./RunnerRegistryProvider";
import { runnerStatusMessageKey } from "./RunnerUiManager";
import {
  RunnerConnectionStatusPanel,
  RunnerSwitcherButton,
  runnerDialogTitleKey,
} from "./RunnerSwitcher";

function createAuthorizationManager() {
  return new BrowserAuthorizationManager({
    origin: window.location.origin,
    open: (url, target, features) => window.open(url, target, features),
    addMessageListener(listener) {
      const wrapped = (event: MessageEvent) => listener(event);
      window.addEventListener("message", wrapped);
      return () => window.removeEventListener("message", wrapped);
    },
    setTimer: (callback, timeoutMs) => window.setTimeout(callback, timeoutMs),
    clearTimer: (timer) => window.clearTimeout(timer as number),
  });
}

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return "runner.error.generic";
}

export function RunnerControls({
  placement = "header",
  controlId = "runner-switcher",
  renderDialogs = true,
}: {
  placement?: "header" | "sidebar";
  controlId?: string;
  renderDialogs?: boolean;
}) {
  useI18nSnapshot();
  const context = useOptionalRunnerRegistryContext();
  if (!context) return null;
  return (
    <ConnectedRunnerControls
      placement={placement}
      controlId={controlId}
      renderDialogs={renderDialogs}
    />
  );
}

function ConnectedRunnerControls({
  placement,
  controlId,
  renderDialogs,
}: {
  placement: "header" | "sidebar";
  controlId: string;
  renderDialogs: boolean;
}) {
  useI18nSnapshot();
  const context = useOptionalRunnerRegistryContext()!;
  const connections = useRunnerConnections();
  const ui = useManagerSnapshot(context.uiManager);
  const active = connections.find((connection) => connection.active)
    ?? connections[0]
    ?? null;
  const profiles = context.profileStore.getSnapshot().profiles;
  const activeProfile = active
    ? profiles.find((profile) => profile.id === active.profileId) ?? null
    : null;
  const surface = active
    ? context.registry.getConnection(active.profileId)?.getRuntimeAPIs()?.runtime.surface
    : "web";
  const nativeAuthorization = Boolean(context.credentialStore.authorizeNative);

  const authorizeProfile = useCallback(async (profileId: string, password = "") => {
    const profile = context.profileStore.getProfile(profileId);
    if (!profile) return;
    context.uiManager.setBusy(true);
    try {
      if (profile.isSameOrigin) {
        const connection = context.registry.getConnection(profileId);
        if (!connection) {
          throw { code: "runner.error.generic" };
        }
        await connection.authenticateWithPassword({
          password,
          label: t("runner.authorization.clientLabel"),
        });
        context.registry.switchActive(profileId);
        context.uiManager.close();
        return;
      }
      if (context.credentialStore.authorizeNative) {
        const handle = await context.credentialStore.authorizeNative({
          profileId,
          origin: profile.baseUrl,
          runnerInstanceId: profile.runnerInstanceId,
          password,
          clientLabel: t("runner.authorization.nativeClientLabel"),
        });
        if (profile.credentialRef) {
          await context.credentialStore.clear(profile.credentialRef);
        }
        await context.profileStore.attachCredential(profileId, handle);
        context.registry.switchActive(profileId);
        context.uiManager.close();
        return;
      }
      const authorization = createAuthorizationManager();
      const exchanged = await authorization.authorize<{
        token: string;
      }>({
        runnerUrl: profile.baseUrl,
        exchange: async (input) => {
          const runtime = createWebRuntimeAPIs({ baseUrl: profile.baseUrl });
          return runtime.auth.exchangeBrowserAuthorization({
            ...input,
            clientLabel: t("runner.authorization.clientLabel"),
          }) as Promise<{ token: string }>;
        },
      });
      if (profile.credentialRef) {
        await context.credentialStore.clear(profile.credentialRef);
      }
      const handle = await context.credentialStore.save({
        profileId,
        origin: profile.baseUrl,
        runnerInstanceId: profile.runnerInstanceId,
        token: exchanged.token,
      });
      await context.profileStore.attachCredential(profileId, handle);
      context.registry.switchActive(profileId);
      context.uiManager.close();
    } catch (error) {
      context.uiManager.setError(errorCode(error));
    }
  }, [context]);

  const submitProfile = useCallback(async () => {
    const draft = context.uiManager.getSnapshot();
    context.uiManager.setBusy(true);
    try {
      if (draft.dialog === "add") {
        const profile = await context.profileStore.addProfile({
          label: draft.label,
          baseUrl: draft.baseUrl,
          password: draft.password,
        });
        await authorizeProfile(profile.id, draft.password);
        return;
      }
      if (draft.dialog === "edit" && draft.profileId) {
        const previous = context.profileStore.getProfile(draft.profileId);
        const profile = await context.profileStore.editProfile(draft.profileId, {
          label: draft.label,
          baseUrl: draft.baseUrl,
          password: draft.password,
        });
        if (
          previous?.baseUrl !== profile.baseUrl
          || (draft.password && (profile.isSameOrigin || nativeAuthorization))
        ) {
          await authorizeProfile(profile.id, draft.password);
        } else {
          context.uiManager.close();
        }
      }
    } catch {
      context.uiManager.setError("runner.error.invalidUrl");
    }
  }, [authorizeProfile, context, nativeAuthorization]);

  const openSessions = useCallback(async (profileId: string, focusId: string) => {
    context.uiManager.openSessions(profileId, focusId);
    context.uiManager.setBusy(true);
    try {
      const runtime = context.registry.getConnection(profileId)?.getRuntimeAPIs();
      const response = await runtime?.auth.session() as {
        sessions?: Array<{
          id: string;
          label?: string | null;
          clientKind?: string | null;
          lastSeenAt?: string | null;
          expiresAt?: string | null;
        }>;
        currentSession?: { id?: string } | null;
      } | undefined;
      context.uiManager.setSessions((response?.sessions ?? []).map((session) => ({
        ...session,
        current: session.id === response?.currentSession?.id,
      })));
    } catch {
      context.uiManager.setError("runner.error.sessions");
    }
  }, [context]);

  const handleDialogAction = useCallback(async () => {
    const draft = context.uiManager.getSnapshot();
    if (!draft.profileId) return;
    const connection = context.registry.getConnection(draft.profileId);
    const runtime = connection?.getRuntimeAPIs();
    context.uiManager.setBusy(true);
    try {
      if (draft.dialog === "forget") {
        await context.profileStore.forgetProfile(draft.profileId);
      } else if (draft.dialog === "restart") {
        // The runner cannot restart itself, so this asks the restart-control
        // service to do it. That service kills the process serving this very
        // request, so losing the connection before the reply arrives is the
        // ordinary shape of success, not a failure — the registry reconnects on
        // its own. Only an answer the server actually sent means the restart was
        // refused, and that is the one worth surfacing.
        try {
          await runtime?.runner.restart();
        } catch (error) {
          if (!isRuntimeTransportFailure(error)) {
            throw error;
          }
        }
      } else if (draft.dialog === "rename") {
        await runtime?.runner.rename({ name: draft.label });
        await context.profileStore.editProfile(draft.profileId, {
          label: draft.label,
        });
      } else if (draft.dialog === "identity" && draft.observedIdentity) {
        await context.profileStore.learnIdentity(
          draft.profileId,
          draft.observedIdentity,
          { confirmIdentityChange: true },
        );
        await connection?.retry();
      } else if (draft.dialog === "tls") {
        const profile = context.profileStore.getProfile(draft.profileId);
        if (
          profile
          && draft.fingerprint
          && context.credentialStore.confirmTls
        ) {
          await context.credentialStore.confirmTls({
            profileId: draft.profileId,
            origin: profile.baseUrl,
            fingerprint: draft.fingerprint,
          });
        }
        await connection?.retry();
      }
      context.uiManager.close();
    } catch {
      context.uiManager.setError("runner.error.generic");
    }
  }, [context]);

  const revokeSession = useCallback(async (sessionId: string) => {
    const profileId = context.uiManager.getSnapshot().profileId;
    const runtime = profileId
      ? context.registry.getConnection(profileId)?.getRuntimeAPIs()
      : null;
    if (!runtime) return;
    context.uiManager.setBusy(true);
    try {
      await runtime.auth.revokeSession({ sessionId });
      context.uiManager.setSessions(
        context.uiManager.getSnapshot().sessions.filter(
          (session) => session.id !== sessionId,
        ),
      );
    } catch {
      context.uiManager.setError("runner.error.sessions");
    }
  }, [context]);

  if (!active || !activeProfile) return null;
  const menuFocusId = `runner-${active.profileId}-menu`;
  const statusAction = () => {
    if (active.status === "needs-reauth") {
      if (nativeAuthorization) {
        context.uiManager.openEdit(activeProfile, controlId);
      } else {
        void authorizeProfile(active.profileId);
      }
    } else if (active.status === "identity-mismatch") {
      context.uiManager.openIdentityMismatch(
        active.profileId,
        active.runnerInstanceId ?? "",
        active.observedRunnerInstanceId ?? "",
        controlId,
      );
    } else if (active.status === "tls-untrusted") {
      const details = active.lastError?.details as { fingerprint?: unknown } | null;
      context.uiManager.openTlsConfirmation(
        active.profileId,
        typeof details?.fingerprint === "string"
          ? details.fingerprint
          : t("common.unknown"),
        controlId,
      );
    } else {
      void context.registry.getConnection(active.profileId)?.retry();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={(
          <RunnerSwitcherButton
            runnerName={active.runnerName}
            status={active.status}
            expanded={false}
            surface={surface}
            id={controlId}
            className={placement === "sidebar"
              ? "w-full max-w-none text-[#333333] hover:bg-[#deddda] hover:text-[#1f1f1f] dark:text-zinc-200 dark:hover:bg-muted/70 dark:hover:text-zinc-100"
              : undefined}
          />
        )} />
        <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-1rem))]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("runner.switcher.label")}</DropdownMenuLabel>
            {connections.map((connection) => {
              return (
                <DropdownMenuItem
                  key={connection.profileId}
                  onClick={() => context.registry.switchActive(connection.profileId)}
                  className="min-h-11"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                    <Server className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{connection.runnerName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(runnerStatusMessageKey(connection.status))}
                    </span>
                  </span>
                  {connection.profileId === active.profileId
                    ? <Check className="h-4 w-4" />
                    : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => context.uiManager.openAdd(controlId)}>
            <Plus />
            {t("runner.action.add")}
          </DropdownMenuItem>
          <DropdownMenuItem
            id={menuFocusId}
            onClick={() => context.uiManager.openEdit(activeProfile, menuFocusId)}
          >
            <Edit3 />
            {t("runner.action.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openSessions(active.profileId, menuFocusId)}>
            <UserRoundCog />
            {t("runner.action.sessions")}
          </DropdownMenuItem>
          {activeProfile.isSameOrigin ? (
            <DropdownMenuItem
              onClick={() => context.uiManager.openRestart(active.profileId, menuFocusId)}
            >
              <RotateCcw />
              {t("runner.action.restart")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => context.uiManager.openRename(
              active.profileId,
              active.runnerName,
              menuFocusId,
            )}
          >
            <MoreHorizontal />
            {t("runner.action.rename")}
          </DropdownMenuItem>
          {!activeProfile.isSameOrigin ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => context.uiManager.openForget(active.profileId, menuFocusId)}
            >
              <Trash2 />
              {t("runner.action.forget")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {renderDialogs ? (
        <RunnerDialog
          ui={ui}
          onClose={() => context.uiManager.close()}
          onDraft={(patch) => context.uiManager.setDraft(patch)}
          onSubmit={() => void submitProfile()}
          onConfirm={() => void handleDialogAction()}
          onAuthorize={() => void authorizeProfile(active.profileId)}
          onRevoke={(sessionId) => void revokeSession(sessionId)}
          nativeAuthorization={nativeAuthorization}
        />
      ) : null}

      {active.status !== "online" ? (
        <div className={placement === "sidebar"
          ? "mt-1 overflow-hidden rounded-md border border-border/60 [&>section]:border-b-0"
          : "absolute inset-x-0 top-14 z-20"}
        >
          <RunnerConnectionStatusPanel
            runnerName={active.runnerName}
            status={active.status}
            onAction={
              activeProfile.isSameOrigin && active.status === "needs-reauth"
                ? undefined
                : statusAction
            }
          />
        </div>
      ) : null}
    </>
  );
}

function RunnerDialog({
  ui,
  onClose,
  onDraft,
  onSubmit,
  onConfirm,
  onAuthorize,
  onRevoke,
  nativeAuthorization,
}: {
  ui: ReturnType<RunnerUiManagerLike["getSnapshot"]>;
  onClose: () => void;
  onDraft: (patch: { label?: string; baseUrl?: string; password?: string }) => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onAuthorize: () => void;
  onRevoke: (sessionId: string) => void;
  nativeAuthorization: boolean;
}) {
  useI18nSnapshot();
  const open = ui.dialog !== "closed";
  const formDialog = ui.dialog === "add" || ui.dialog === "edit";
  const descriptionKey = `runner.${ui.dialog}.description`;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(runnerDialogTitleKey(ui.dialog))}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        {formDialog ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="runner-label">{t("runner.field.name")}</FieldLabel>
              <Input
                id="runner-label"
                value={ui.label}
                onChange={(event) => onDraft({ label: event.target.value })}
                placeholder={t("runner.field.namePlaceholder")}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="runner-url">{t("runner.field.url")}</FieldLabel>
              <Input
                id="runner-url"
                type="url"
                inputMode="url"
                value={ui.baseUrl}
                onChange={(event) => onDraft({ baseUrl: event.target.value })}
                placeholder={t("runner.field.urlPlaceholder")}
              />
              <FieldDescription>{t("runner.field.urlHelp")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="runner-password">
                {t("runner.field.password")}
              </FieldLabel>
              <Input
                id="runner-password"
                type="password"
                value={ui.password}
                onChange={(event) => onDraft({ password: event.target.value })}
                placeholder={t("runner.field.passwordPlaceholder")}
                autoComplete="current-password"
              />
              <FieldDescription>
                {t("runner.field.passwordHelp")}
              </FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}
        {ui.dialog === "sessions" ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {ui.sessions.length === 0 && !ui.busy ? (
              <p className="text-sm text-muted-foreground">{t("runner.sessions.empty")}</p>
            ) : ui.sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                <CircleDot className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {session.label || session.clientKind || t("runner.sessions.unnamed")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.current
                      ? t("runner.sessions.current")
                      : t("runner.sessions.expires", {
                        date: session.expiresAt
                          ? new Date(session.expiresAt).toLocaleString()
                          : t("common.unknown"),
                      })}
                  </p>
                </div>
                {!session.current ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRevoke(session.id)}
                    disabled={ui.busy}
                  >
                    {t("runner.sessions.revoke")}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {ui.dialog === "rename" ? (
          <Field>
            <FieldLabel htmlFor="runner-rename">{t("runner.field.name")}</FieldLabel>
            <Input
              id="runner-rename"
              value={ui.label}
              onChange={(event) => onDraft({ label: event.target.value })}
              autoFocus
            />
          </Field>
        ) : null}
        {ui.dialog === "tls" ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("runner.tls.fingerprint")}
            </p>
            <code className="mt-2 block break-all text-xs">{ui.fingerprint}</code>
          </div>
        ) : null}
        {ui.dialog === "identity" ? (
          <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p>{t("runner.identity.expected", { id: ui.expectedIdentity ?? "" })}</p>
            <p>{t("runner.identity.observed", { id: ui.observedIdentity ?? "" })}</p>
          </div>
        ) : null}
        {ui.errorCode ? (
          <p role="alert" className="text-sm text-destructive">
            {t(ui.errorCode)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          {formDialog ? (
            <Button
              onClick={onSubmit}
              disabled={
                ui.busy
                || !ui.baseUrl.trim()
                || (nativeAuthorization && ui.dialog === "add" && !ui.password)
              }
            >
              <KeyRound />
              {ui.busy ? t("runner.action.connecting") : t("runner.action.connect")}
            </Button>
          ) : ui.dialog === "sessions" ? null : (
            <Button
              variant={ui.dialog === "forget" || ui.dialog === "restart" ? "destructive" : "default"}
              onClick={ui.dialog === "closed" ? onAuthorize : onConfirm}
              disabled={ui.busy}
            >
              {ui.dialog === "tls" ? <ShieldCheck /> : null}
              {t(`runner.${ui.dialog}.confirm`)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RunnerUiManagerLike = {
  getSnapshot(): import("./RunnerUiManager").RunnerUiSnapshot;
};

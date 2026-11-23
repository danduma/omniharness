"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import { cn } from "@/lib/utils";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { isRuntimeTransportFailure } from "@/runtime-api/request";
import { createWebRuntimeAPIs } from "@/runtime-api/web";
import { BrowserAuthorizationManager } from "@/interface/auth/BrowserAuthorizationManager";
import {
  isInsecureServerFromSecurePage,
  isMixedContentBlocked,
  type RunnerProfile,
} from "./RunnerProfile";
import type { RunnerConnectionSnapshot } from "./RunnerConnection";
import {
  useOptionalRunnerRegistryContext,
  useRunnerConnections,
} from "./RunnerRegistryProvider";
import { runnerStatusMessageKey } from "./RunnerUiManager";
import {
  RunnerConnectionStatusPanel,
  RunnerSwitcherButton,
  runnerDialogTitleKey,
  runnerStatusTone,
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

// Statuses the restart route itself answers with while the runner is still
// alive and has stopped nothing. Its own refusals arrive under `runner.restart.*`
// (see `handleRunnerRestartRequest`); these three come from the auth guard in
// front of it, which rejects before the control service is ever called.
const RESTART_REFUSAL_CODES = new Set([
  "runtime.http_401",
  "runtime.http_403",
  "runtime.http_405",
]);

/**
 * Did the runner refuse to restart, as opposed to going ahead and dying?
 *
 * A restart cannot report its own success. The control service acknowledges
 * before it stops anything, so the process answering this request is gone
 * moments later, and every shape that takes on the wire — a dropped connection,
 * a bare 502/503 from whatever still holds the port, a redirect into the
 * booting server's shell — is what success looks like from the browser. Only a
 * reply the restart route stated itself means nothing happened, and that is the
 * only one worth putting in front of the user.
 */
export function isRestartRefusal(error: unknown) {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code !== "string") {
    return false;
  }
  return code.startsWith("runner.restart.") || RESTART_REFUSAL_CODES.has(code);
}

export function RunnerControls({
  placement = "header",
  controlId = "runner-switcher",
  renderDialogs = true,
  desktopServerStrip = false,
}: {
  placement?: "header" | "sidebar";
  controlId?: string;
  renderDialogs?: boolean;
  desktopServerStrip?: boolean;
}) {
  useI18nSnapshot();
  const context = useOptionalRunnerRegistryContext();
  if (!context) return null;
  return (
    <ConnectedRunnerControls
      placement={placement}
      controlId={controlId}
      renderDialogs={renderDialogs}
      desktopServerStrip={desktopServerStrip}
    />
  );
}

function ConnectedRunnerControls({
  placement,
  controlId,
  renderDialogs,
  desktopServerStrip,
}: {
  placement: "header" | "sidebar";
  controlId: string;
  renderDialogs: boolean;
  desktopServerStrip: boolean;
}) {
  useI18nSnapshot();
  const context = useOptionalRunnerRegistryContext()!;
  const connections = useRunnerConnections();
  const ui = useManagerSnapshot(context.uiManager);
  const active = connections.find((connection) => connection.active)
    ?? connections[0]
    ?? null;
  const activeProfileId = active?.profileId;
  const stripRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const selected = strip?.querySelector('[data-active-server="true"]');
    if (!strip || !selected) return;
    const edge = getComputedStyle(strip).direction === "rtl" ? "right" : "left";
    // HomeApp remounts on a server switch. Start the strip at the selected
    // server without reordering the buttons or scrolling the rest of the sidebar.
    strip.scrollLeft += selected.getBoundingClientRect()[edge] - strip.getBoundingClientRect()[edge];
  }, [activeProfileId, desktopServerStrip]);
  const scrollServerStrip = (direction: "start" | "end") => {
    const strip = stripRef.current;
    if (!strip) return;
    const forward = getComputedStyle(strip).direction === "rtl" ? -1 : 1;
    const pageWidth = Math.max(1, strip.clientWidth - 24);
    strip.scrollBy({ left: pageWidth * forward * (direction === "end" ? 1 : -1) });
    const offset = Math.abs(strip.scrollLeft);
    const remaining = direction === "start" ? offset : strip.scrollWidth - strip.clientWidth - offset;
    if (remaining <= 1 && strip.ownerDocument.activeElement?.matches(":focus-visible")) {
      strip.focus({ preventScroll: true });
    }
  };
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
    const pageOrigin = context.profileStore.getLocationOrigin();
    if (isMixedContentBlocked(pageOrigin, profile.baseUrl)) {
      context.uiManager.setError("runner.error.insecureServer");
      return;
    }
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
      // A request that never reached a reply against a plain-HTTP server is the
      // browser refusing to send it, not the server refusing to answer. Loopback
      // is exempt from mixed-content blocking in most browsers but not all, so
      // this stays a diagnosis of the failure rather than a rule applied ahead
      // of it.
      const blocked = isRuntimeTransportFailure(error)
        && isInsecureServerFromSecurePage(pageOrigin, profile.baseUrl);
      context.uiManager.setError(
        blocked ? "runner.error.insecureServer" : errorCode(error),
      );
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
    } catch (error) {
      // An unparseable address throws a bare `TypeError`, so a rejection with
      // no code of its own really is a malformed URL. A refusal the store
      // stated as a `runner.error.*` key keeps its own reason; anything else
      // is a transport or storage failure this dialog cannot name.
      const code = errorCode(error);
      context.uiManager.setError(
        code.startsWith("runner.error.") && code !== "runner.error.generic"
          ? code
          : "runner.error.invalidUrl",
      );
    }
  }, [authorizeProfile, context, nativeAuthorization]);

  const openSessions = useCallback(async (profileId: string, focusId: string) => {
    context.uiManager.openSessions(profileId, focusId);
    context.uiManager.setBusy(true);
    try {
      const runtime = context.registry.getConnection(profileId)?.getRuntimeAPIs();
      if (!runtime) {
        context.uiManager.setError("runner.error.sessions");
        return;
      }
      const response = await runtime.auth.session() as {
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
        if (!runtime) {
          context.uiManager.setError("runner.error.generic");
          return;
        }
        // The runner cannot restart itself, so this asks the restart-control
        // service to do it. That service kills the process serving this very
        // request, so anything short of a stated refusal means the restart is
        // under way — the registry reconnects on its own.
        try {
          await runtime.runner.restart();
        } catch (error) {
          if (isRestartRefusal(error)) {
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
    } catch (error) {
      // A refusal the restart route stated itself already says exactly what is
      // wrong — most often that no control service is running on the target
      // machine, which is the normal state of a server nobody has started one
      // for. That is worth showing instead of "the operation failed", and it
      // matters more now that the target can be a machine the reader is not
      // sitting at.
      const code = errorCode(error);
      context.uiManager.setError(
        code.startsWith("runner.restart.") ? code : "runner.error.generic",
      );
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
  const addServerId = `${controlId}-add`;
  const stripId = `${controlId}-strip`;
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

  const renderServerActions = (
    connection: RunnerConnectionSnapshot,
    profile: RunnerProfile,
    focusId: string,
    canManageServer: boolean,
  ) => (
    <>
      <DropdownMenuItem
        onClick={() => context.uiManager.openEdit(profile, focusId)}
        id={desktopServerStrip ? undefined : focusId}
      >
        <Edit3 />
        {t("runner.action.edit")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!canManageServer}
        onClick={() => void openSessions(connection.profileId, focusId)}
      >
        <UserRoundCog />
        {t("runner.action.sessions")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!canManageServer}
        onClick={() => context.uiManager.openRestart(
          connection.profileId,
          connection.runnerName,
          focusId,
        )}
      >
        <RotateCcw />
        {t("runner.action.restart")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => context.uiManager.openRename(
          connection.profileId,
          connection.runnerName,
          focusId,
        )}
      >
        <MoreHorizontal />
        {t("runner.action.rename")}
      </DropdownMenuItem>
      {!profile.isSameOrigin ? (
        <DropdownMenuItem
          variant="destructive"
          onClick={() => context.uiManager.openForget(connection.profileId, focusId)}
        >
          <Trash2 />
          {t("runner.action.forget")}
        </DropdownMenuItem>
      ) : null}
    </>
  );

  return (
    <>
      {desktopServerStrip ? (
        <ScrollArea.Root
          className="group/server-strip -mx-2 flex min-w-0 items-center"
          overflowEdgeThreshold={1}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="invisible h-7 w-5 text-muted-foreground group-data-[overflow-x-start]/server-strip:visible"
            aria-label={t("runner.switcher.scrollBack")}
            aria-controls={stripId}
            onClick={() => scrollServerStrip("start")}
          >
            <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <ScrollArea.Viewport
            id={stripId}
            ref={stripRef}
            role="group"
            aria-label={t("runner.switcher.label")}
            className="min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <ScrollArea.Content className="flex gap-0.5">
              {connections.map((connection) => {
                const profile = profiles.find((item) => item.id === connection.profileId);
                if (!profile) return null;
                const selected = connection.profileId === activeProfileId;
                const triggerId = `${controlId}-${connection.profileId}-actions`;
                const status = t(runnerStatusMessageKey(connection.status));
                return (
                  <div
                    key={connection.profileId}
                    data-active-server={selected}
                    className={cn(
                      "flex h-7 min-w-0 max-w-36 shrink-0 items-stretch rounded-md",
                      selected && "bg-primary/12",
                    )}
                  >
                    <Button
                      id={selected ? controlId : undefined}
                      type="button"
                      variant="ghost"
                      aria-label={t("runner.switcher.aria", { runner: connection.runnerName, status })}
                      aria-pressed={selected}
                      title={`${connection.runnerName} · ${status}`}
                      className="h-auto min-w-0 shrink justify-start gap-1.5 rounded-s-md rounded-e-none border-0 px-1.5 font-medium hover:bg-foreground/5 focus-visible:ring-inset dark:hover:bg-foreground/5"
                      onClick={() => {
                        if (!selected) context.registry.switchActive(connection.profileId);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-1.5 shrink-0 rounded-full", runnerStatusTone(connection.status))}
                      />
                      <span className="truncate">{connection.runnerName}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        id={triggerId}
                        aria-label={t("runner.switcher.actionsAria", { runner: connection.runnerName })}
                        className="flex w-6 shrink-0 items-center justify-center rounded-e-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-popup-open:bg-foreground/5 data-popup-open:text-foreground"
                      >
                        <ChevronDown className="size-3" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="min-w-52 p-1 [&_[data-slot=dropdown-menu-item]]:min-h-11 [&_[data-slot=dropdown-menu-item]]:gap-3 [&_[data-slot=dropdown-menu-item]]:px-3 [&_[data-slot=dropdown-menu-item]]:text-[0.9375rem]">
                        {renderServerActions(
                          connection,
                          profile,
                          triggerId,
                          Boolean(context.registry.getConnection(connection.profileId)?.getRuntimeAPIs()),
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              <Button
                id={addServerId}
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-inset"
                aria-label={t("runner.action.add")}
                title={t("runner.action.add")}
                onClick={() => context.uiManager.openAdd(addServerId)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="invisible h-7 w-5 text-muted-foreground group-data-[overflow-x-end]/server-strip:visible"
            aria-label={t("runner.switcher.scrollForward")}
            aria-controls={stripId}
            onClick={() => scrollServerStrip("end")}
          >
            <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </ScrollArea.Root>
      ) : (
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
          <DropdownMenuContent
            align="start"
            className={cn(
              "w-[min(22rem,calc(100vw-1rem))] p-2 lg:p-1",
              "max-lg:[&_[data-slot=dropdown-menu-item]]:min-h-12 max-lg:[&_[data-slot=dropdown-menu-item]]:gap-3",
              "max-lg:[&_[data-slot=dropdown-menu-item]]:px-3 max-lg:[&_[data-slot=dropdown-menu-item]]:text-base",
              "max-lg:[&_[data-slot=dropdown-menu-item]_svg]:size-5",
            )}
          >
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
            {renderServerActions(active, activeProfile, menuFocusId, true)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {renderDialogs ? (
        <RunnerDialog
          ui={ui}
          forgetTarget={desktopServerStrip && ui.dialog === "forget"
            ? connections.find((connection) => connection.profileId === ui.profileId)?.runnerName
            : undefined}
          onClose={() => context.uiManager.close()}
          onDraft={(patch) => context.uiManager.setDraft(patch)}
          onSubmit={() => void submitProfile()}
          onConfirm={() => void handleDialogAction()}
          onAuthorize={() => void authorizeProfile(ui.profileId ?? active.profileId)}
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
  forgetTarget,
  onClose,
  onDraft,
  onSubmit,
  onConfirm,
  onAuthorize,
  onRevoke,
  nativeAuthorization,
}: {
  ui: ReturnType<RunnerUiManagerLike["getSnapshot"]>;
  forgetTarget?: string;
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
      <DialogContent className={cn(
        "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md",
        "max-lg:[&_[data-slot=button]]:min-h-12 max-lg:[&_[data-slot=input]]:min-h-12",
        "max-lg:[&_[data-slot=dialog-close]]:size-12 max-lg:[&_[data-slot=dialog-close]]:top-0 max-lg:[&_[data-slot=dialog-close]]:right-0",
        "max-lg:[&_[data-slot=dialog-header]]:pr-8",
      )}>
        <DialogHeader>
          <DialogTitle>{t(runnerDialogTitleKey(ui.dialog))}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        {forgetTarget ? (
          <p className="break-words font-medium">{forgetTarget}</p>
        ) : null}
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
        {ui.dialog === "restart" ? (
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("runner.restart.target")}
            </p>
            <p className="mt-1 truncate text-sm font-medium">{ui.label}</p>
          </div>
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

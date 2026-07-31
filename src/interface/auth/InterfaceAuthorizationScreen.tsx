"use client";

import { useEffect } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { interfaceAuthorizationScreenManager } from "./InterfaceAuthorizationScreenManager";

type AuthorizationPageRequest = {
  origin: string;
  state: string;
  challenge: string;
  method: string;
};

function platformReturnLink(code: string, state: string) {
  const params = new URLSearchParams({ code, state });
  return `omniharness://authorize?${params.toString()}`;
}

export function InterfaceAuthorizationScreen({
  request,
}: {
  request: AuthorizationPageRequest;
}) {
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  const screen = useManagerSnapshot(interfaceAuthorizationScreenManager);
  const validRequest = (
    request.origin.length > 0
    && request.state.length >= 43
    && request.challenge.length >= 43
    && request.method === "S256"
  );

  useEffect(() => {
    void interfaceAuthorizationScreenManager.checkSession(
      () => runtimeApis.auth.session(),
    );
  }, [runtimeApis.auth]);

  const notifyOpener = (payload: Record<string, unknown>) => {
    if (window.opener) {
      window.opener.postMessage({
        type: "omni.authorization",
        state: request.state,
        ...payload,
      }, request.origin);
      window.close();
      return true;
    }
    return false;
  };

  const approve = async () => {
    const result = await interfaceAuthorizationScreenManager.approve(
      async (password) => runtimeApis.auth.approveBrowserAuthorization({
        approved: true,
        password: password || undefined,
        origin: request.origin,
        state: request.state,
        challenge: request.challenge,
        method: request.method,
      }) as Promise<{ code: string }>,
    );
    notifyOpener({ code: result.code });
  };

  const deny = async () => {
    try {
      await runtimeApis.auth.approveBrowserAuthorization({
        approved: false,
        origin: request.origin,
        state: request.state,
        challenge: request.challenge,
        method: request.method,
      });
    } catch {
      // The denial response is intentionally non-successful; the opener still
      // needs the explicit user decision.
    }
    interfaceAuthorizationScreenManager.markDenied();
    notifyOpener({ denied: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-[28px] border border-border/60 bg-card p-6 shadow-xl shadow-black/5">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {t("authorization.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {validRequest
            ? t("authorization.description", { origin: request.origin })
            : t("authorization.invalidRequest")}
        </p>

        {validRequest && screen.status === "approved" && screen.code ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-foreground">{t("authorization.approved")}</p>
            <a
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href={platformReturnLink(screen.code, request.state)}
            >
              {t("authorization.returnLink")}
            </a>
          </div>
        ) : validRequest ? (
          <div className="mt-6 space-y-4">
            {!screen.authenticated ? (
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  htmlFor="authorization-password"
                >
                  {t("authorization.passwordLabel")}
                </label>
                <Input
                  id="authorization-password"
                  type="password"
                  autoComplete="current-password"
                  value={screen.password}
                  onChange={(event) => (
                    interfaceAuthorizationScreenManager.setPassword(event.target.value)
                  )}
                  placeholder={t("authorization.passwordPlaceholder")}
                />
              </div>
            ) : null}
            {screen.status === "failed" ? (
              <p className="text-sm text-destructive">{t("authorization.error")}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => void deny()}
                disabled={screen.submitting}
              >
                {t("authorization.deny")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => void approve()}
                disabled={
                  screen.checkingSession
                  || screen.submitting
                  || (!screen.authenticated && !screen.password.trim())
                }
              >
                {screen.submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {screen.submitting
                  ? t("authorization.approving")
                  : t("authorization.approve")}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

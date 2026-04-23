"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginShellProps {
  error?: string | null;
  isSubmitting?: boolean;
  isRedeemingPair?: boolean;
  pairError?: string | null;
  onSubmit: (password: string) => Promise<void> | void;
}

export function LoginShell({
  error,
  isSubmitting = false,
  isRedeemingPair = false,
  pairError,
  onSubmit,
}: LoginShellProps) {
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(password);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,1))] px-4 py-8">
      <div className="w-full max-w-sm rounded-[28px] border border-border/60 bg-background/95 p-6 shadow-xl shadow-black/5 backdrop-blur">
        <div className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            {isRedeemingPair ? <Smartphone className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">OmniHarness</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isRedeemingPair
                ? "Connecting this phone to your running OmniHarness session."
                : "Enter the password for this OmniHarness instance to continue."}
            </p>
          </div>
        </div>

        {isRedeemingPair ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-foreground">
            <div className="flex items-center gap-3">
              <LoaderCircle className="h-4 w-4 animate-spin text-emerald-700" />
              <span>Redeeming pairing code...</span>
            </div>
            {pairError ? (
              <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {pairError}
              </div>
            ) : null}
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="omni-password">
                Password
              </label>
              <Input
                id="omni-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter instance password"
                className="h-11 rounded-xl"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting || password.trim().length === 0}>
              {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Unlock OmniHarness
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

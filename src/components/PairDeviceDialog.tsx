"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy, LoaderCircle, RefreshCcw, ShieldCheck, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "@/lib/app-errors";

type PairCreateResponse = {
  pairingId: string;
  pairUrl: string;
  expiresAt: string;
};

type PairStatusResponse = {
  pairing: {
    id: string;
    expiresAt: string;
    redeemedAt: string | null;
    expired: boolean;
    status: "pending" | "redeemed" | "expired" | "revoked";
  };
};

interface PairDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRunId?: string | null;
  availabilityError?: string | null;
}

export function PairDeviceDialog({
  open,
  onOpenChange,
  selectedRunId = null,
  availabilityError = null,
}: PairDeviceDialogProps) {
  const [pairing, setPairing] = useState<PairCreateResponse | null>(null);
  const [pairingStatus, setPairingStatus] = useState<PairStatusResponse["pairing"]["status"] | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const expiresInSeconds = useMemo(() => {
    if (!pairing?.expiresAt) {
      return null;
    }
    return Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - nowMs) / 1000));
  }, [nowMs, pairing?.expiresAt]);

  const createPairing = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCopyNotice(null);
    setPairingStatus(null);
    setNowMs(Date.now());

    try {
      const data = await requestJson<PairCreateResponse>("/api/auth/pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetRunId: selectedRunId,
        }),
      }, {
        source: "Auth",
        action: "Create pairing QR",
      });

      setPairing(data);
      setPairingStatus("pending");
      setQrDataUrl(await QRCode.toDataURL(data.pairUrl, {
        margin: 1,
        width: 320,
        color: {
          dark: "#18211d",
          light: "#fbfdf9",
        },
      }));
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : String(pairError));
      setPairing(null);
      setQrDataUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (availabilityError) {
      return;
    }

    if (!pairing && !isLoading) {
      void createPairing();
    }
  }, [availabilityError, createPairing, open, pairing, isLoading]);

  useEffect(() => {
    if (!open || !pairing?.expiresAt || pairingStatus !== "pending") {
      return;
    }

    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open, pairing?.expiresAt, pairingStatus]);

  useEffect(() => {
    if (!open || !pairing?.pairingId || pairingStatus !== "pending") {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const data = await requestJson<PairStatusResponse>(`/api/auth/pair?id=${encodeURIComponent(pairing.pairingId)}`, undefined, {
          source: "Auth",
          action: "Load pairing status",
        });

        setPairingStatus(data.pairing.status);
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : String(pollError));
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [open, pairing?.pairingId, pairingStatus]);

  useEffect(() => {
    if (!open) {
      setPairing(null);
      setPairingStatus(null);
      setQrDataUrl(null);
      setError(null);
      setCopyNotice(null);
    }
  }, [open]);

  async function handleCopy() {
    if (!pairing?.pairUrl) {
      return;
    }
    await navigator.clipboard.writeText(pairing.pairUrl);
    setCopyNotice("Link copied.");
  }

  const statusLabel = pairingStatus === "redeemed"
    ? "Phone connected"
    : pairingStatus === "expired"
      ? "Code expired"
      : pairingStatus === "revoked"
        ? "Code revoked"
        : "Waiting for scan";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 bg-muted/35 px-5 pb-4 pt-5">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-600/20 bg-emerald-600/10 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base font-semibold">Connect phone</DialogTitle>
              <DialogDescription className="leading-relaxed">
                Scan once to open OmniHarness on this device with a paired session.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid sm:grid-cols-[minmax(280px,320px)_1fr]">
          <div className="border-b border-border/60 bg-[oklch(0.985_0.006_155)] p-5 sm:border-b-0 sm:border-r">
            {availabilityError ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="max-w-xs rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {availabilityError}
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Creating pairing code...
                </div>
              </div>
            ) : qrDataUrl ? (
              <div className="space-y-3">
                <div className="flex justify-center rounded-lg border border-foreground/10 bg-[oklch(0.995_0.004_155)] p-3 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Pair device QR code" className="aspect-square w-full max-w-[280px]" />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                No pairing code available yet.
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5 p-5">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Secure pairing</div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {pairingStatus === "redeemed" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{statusLabel}</span>
                </div>
                {typeof expiresInSeconds === "number" ? (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{expiresInSeconds}s</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <div className="font-medium text-foreground">Scan window</div>
              <p>
                The QR code expires quickly and can only be redeemed once.
                {selectedRunId ? " Your phone will open the selected conversation after pairing." : ""}
              </p>
            </div>

            {pairing?.pairUrl ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fallback link</label>
                <Input readOnly value={pairing.pairUrl} className="h-9 truncate font-mono text-xs" />
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {copyNotice ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">
                {copyNotice}
              </div>
            ) : null}

            <div className="mt-auto flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => void createPairing()} disabled={Boolean(availabilityError)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh code
              </Button>
              <Button type="button" onClick={() => void handleCopy()} disabled={Boolean(availabilityError) || !pairing?.pairUrl}>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

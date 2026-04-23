"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Copy, LoaderCircle, RefreshCcw, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
}

export function PairDeviceDialog({
  open,
  onOpenChange,
  selectedRunId = null,
}: PairDeviceDialogProps) {
  const [pairing, setPairing] = useState<PairCreateResponse | null>(null);
  const [pairingStatus, setPairingStatus] = useState<PairStatusResponse["pairing"]["status"] | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState("My phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const expiresInSeconds = useMemo(() => {
    if (!pairing?.expiresAt) {
      return null;
    }
    return Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000));
  }, [pairing?.expiresAt, pairingStatus]);

  async function createPairing() {
    setIsLoading(true);
    setError(null);
    setCopyNotice(null);
    setPairingStatus(null);

    try {
      const data = await requestJson<PairCreateResponse>("/api/auth/pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetRunId: selectedRunId,
          deviceLabel,
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
          dark: "#111827",
          light: "#ffffff",
        },
      }));
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : String(pairError));
      setPairing(null);
      setQrDataUrl(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!pairing && !isLoading) {
      void createPairing();
    }
  }, [open, pairing, isLoading]);

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Phone</DialogTitle>
          <DialogDescription>
            Scan this one-time QR code from your phone to open OmniHarness with a durable paired session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="pair-device-label">
              Device label
            </label>
            <Input
              id="pair-device-label"
              value={deviceLabel}
              onChange={(event) => setDeviceLabel(event.target.value)}
              placeholder="My phone"
              disabled={Boolean(pairing) || isLoading}
            />
          </div>

          <div className="rounded-3xl border border-border/60 bg-muted/20 p-4">
            {isLoading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Creating pairing code...
                </div>
              </div>
            ) : qrDataUrl ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Pair device QR code" className="h-72 w-72 rounded-2xl bg-white p-3 shadow-sm" />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/80 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {pairingStatus === "redeemed" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{statusLabel}</span>
                  </div>
                  {typeof expiresInSeconds === "number" ? (
                    <span className="font-mono text-muted-foreground">{expiresInSeconds}s</span>
                  ) : null}
                </div>
                {selectedRunId ? (
                  <p className="text-xs text-muted-foreground">
                    The phone will open the currently selected conversation after pairing.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                No pairing code available yet.
              </div>
            )}
          </div>

          {pairing?.pairUrl ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fallback link</label>
              <Input readOnly value={pairing.pairUrl} className="font-mono text-xs" />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {copyNotice ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">
              {copyNotice}
            </div>
          ) : null}
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" variant="outline" onClick={() => void createPairing()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh code
          </Button>
          <Button type="button" onClick={() => void handleCopy()} disabled={!pairing?.pairUrl}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

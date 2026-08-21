import { ArrowRight, FileDiff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { handoffManager } from "@/interface/home/HandoffManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS, type SupportedWorkerType } from "@/shared/worker-types";

export function CrossCliHandoffDialog({ onCompleted }: { onCompleted(runId: string): void }) {
  useI18nSnapshot();
  const state = useManagerSnapshot(handoffManager);
  const packet = state.handoff?.packet;
  const sourceType = state.request?.sourceWorkerType;
  const busy = state.preparing || state.launching || state.revising;
  return (
    <Dialog open={Boolean(state.request)} onOpenChange={(open) => { if (!open) void handoffManager.cancel(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("handoff.dialog.title")}</DialogTitle>
          <DialogDescription>{t("handoff.dialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>{t("handoff.dialog.targetCli")}</Label>
              <Select
                value={state.targetWorkerType}
                onValueChange={(value) => handoffManager.setTargetWorkerType(value as SupportedWorkerType)}
                disabled={busy || Boolean(packet)}
                options={SUPPORTED_WORKER_TYPES.filter((type) => type !== sourceType).map((type) => ({ value: type, label: WORKER_TYPE_LABELS[type] }))}
                ariaLabel={t("handoff.dialog.targetCli")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="handoff-account">{t("handoff.dialog.account")}</Label>
              <Input id="handoff-account" value={state.accountId} onChange={(event) => handoffManager.setAccountId(event.target.value)} disabled={busy || Boolean(packet)} placeholder={t("handoff.dialog.optional")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="handoff-model">{t("handoff.dialog.model")}</Label>
              <Input id="handoff-model" value={state.model} onChange={(event) => handoffManager.setModel(event.target.value)} disabled={busy || Boolean(packet)} placeholder={t("handoff.dialog.optional")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="handoff-effort">{t("handoff.dialog.effort")}</Label>
              <Input id="handoff-effort" value={state.effort} onChange={(event) => handoffManager.setEffort(event.target.value)} disabled={busy || Boolean(packet)} placeholder={t("handoff.dialog.optional")} />
            </div>
          </div>
          {packet ? (
            <div className="rounded-lg border bg-muted/25 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-emerald-600" />{t("handoff.dialog.packetReady")}</div>
              <p className="mt-2 text-sm text-muted-foreground">{packet.task.currentObjective ?? packet.task.originalRequest ?? t("handoff.dialog.noObjective")}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><FileDiff className="h-3.5 w-3.5" />{t("handoff.dialog.files", { count: packet.workspace.modifiedFiles.length })}</span>
                <span>{t("handoff.dialog.remaining", { count: packet.state.remaining.length })}</span>
                <span>{t("handoff.dialog.verification", { count: packet.verification.length })}</span>
              </div>
              {packet.provenance.confidenceWarnings.length ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{packet.provenance.confidenceWarnings.join(" ")}</p> : null}
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1.5"><Label htmlFor="handoff-objective">{t("handoff.dialog.objective")}</Label><Textarea id="handoff-objective" value={state.editObjective} onChange={(event) => handoffManager.setEditObjective(event.target.value)} disabled={busy} /></div>
                <div className="grid gap-1.5"><Label htmlFor="handoff-remaining">{t("handoff.dialog.remainingEditor")}</Label><Textarea id="handoff-remaining" value={state.editRemaining} onChange={(event) => handoffManager.setEditRemaining(event.target.value)} disabled={busy} placeholder={t("handoff.dialog.onePerLine")} /></div>
                <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => void handoffManager.saveRevision()} disabled={busy}>{state.revising ? t("handoff.dialog.saving") : t("handoff.dialog.saveEdits")}</Button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3 text-xs leading-5 text-muted-foreground">{t("handoff.dialog.stopWarning")}</p>
          )}
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void handoffManager.cancel()} disabled={busy}>{t("common.cancel")}</Button>
          {packet ? (
            <Button onClick={() => void handoffManager.launch().then((runId) => { if (runId) onCompleted(runId); })} disabled={busy}>
              {state.launching ? t("handoff.dialog.launching") : t("handoff.dialog.launch")}<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : <Button onClick={() => void handoffManager.prepare()} disabled={busy}>{state.preparing ? t("handoff.dialog.preparing") : t("handoff.dialog.prepare")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

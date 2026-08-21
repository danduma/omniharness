"use client";

import { useEffect, useMemo } from "react";
import { StateManager } from "@/lib/state-manager";
import { useManagerSelector } from "@/lib/use-manager-snapshot";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { t } from "@/lib/i18n";

export type WorkerEntryContentReference = {
  workerId: string;
  entryId: string;
};

export type WorkerEntryContentState = {
  status: "idle" | "loading" | "loaded" | "error";
  url: string;
  error: string | null;
};

type WorkerEntryContentUrlManagerState = {
  contentByKey: Record<string, WorkerEntryContentState | undefined>;
};

type WorkerEntryContentUrlManagerOptions = {
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
};

const IDLE_CONTENT_STATE: WorkerEntryContentState = Object.freeze({
  status: "idle",
  url: "",
  error: null,
});

function contentKey(reference: WorkerEntryContentReference) {
  return `${reference.workerId}\u0000${reference.entryId}`;
}

export class WorkerEntryContentUrlManager extends StateManager<WorkerEntryContentUrlManagerState> {
  private readonly references = new Map<string, number>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly createObjectUrl: (blob: Blob) => string;
  private readonly revokeObjectUrl: (url: string) => void;

  constructor(options: WorkerEntryContentUrlManagerOptions = {}) {
    super({ contentByKey: {} });
    this.createObjectUrl = options.createObjectUrl ?? ((blob) => URL.createObjectURL(blob));
    this.revokeObjectUrl = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url));
  }

  getContentState(reference: WorkerEntryContentReference): WorkerEntryContentState {
    return this.getSnapshot().contentByKey[contentKey(reference)] ?? IDLE_CONTENT_STATE;
  }

  acquire(
    reference: WorkerEntryContentReference,
    load: (input: WorkerEntryContentReference) => Promise<Blob>,
  ) {
    const key = contentKey(reference);
    this.references.set(key, (this.references.get(key) ?? 0) + 1);
    const current = this.getSnapshot().contentByKey[key];
    if (current?.status === "loaded" || this.pending.has(key)) {
      return;
    }

    this.patch((state) => ({
      contentByKey: {
        ...state.contentByKey,
        [key]: { status: "loading", url: "", error: null },
      },
    }));
    const request = load(reference).then((blob) => {
      if (!this.references.has(key)) {
        return;
      }
      if (!blob.type.toLowerCase().startsWith("image/")) {
        throw new Error(t("terminal.generatedImages.invalidResponse"));
      }
      const url = this.createObjectUrl(blob);
      this.patch((state) => ({
        contentByKey: {
          ...state.contentByKey,
          [key]: { status: "loaded", url, error: null },
        },
      }));
    }).catch((error: unknown) => {
      if (!this.references.has(key)) {
        return;
      }
      this.patch((state) => ({
        contentByKey: {
          ...state.contentByKey,
          [key]: {
            status: "error",
            url: "",
            error: error instanceof Error ? error.message : String(error),
          },
        },
      }));
    }).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, request);
  }

  release(reference: WorkerEntryContentReference) {
    const key = contentKey(reference);
    const remaining = (this.references.get(key) ?? 1) - 1;
    if (remaining > 0) {
      this.references.set(key, remaining);
      return;
    }
    this.references.delete(key);
    const current = this.getSnapshot().contentByKey[key];
    if (current?.url) {
      this.revokeObjectUrl(current.url);
    }
    this.patch((state) => {
      const contentByKey = { ...state.contentByKey };
      delete contentByKey[key];
      return { contentByKey };
    });
  }
}

const workerEntryContentUrlManager = new WorkerEntryContentUrlManager();

export function useWorkerEntryContent(reference: WorkerEntryContentReference) {
  const runtimeApis = useRuntimeAPIs();
  const stableReference = useMemo(() => reference, [reference.workerId, reference.entryId]);
  const key = contentKey(stableReference);
  const state = useManagerSelector(
    workerEntryContentUrlManager,
    (snapshot) => snapshot.contentByKey[key] ?? IDLE_CONTENT_STATE,
  );

  useEffect(() => {
    workerEntryContentUrlManager.acquire(stableReference, runtimeApis.workers.content);
    return () => workerEntryContentUrlManager.release(stableReference);
  }, [runtimeApis.workers.content, stableReference]);

  return state;
}

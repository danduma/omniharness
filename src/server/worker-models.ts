import { execFile } from "child_process";
import { promisify } from "util";
import type { SupportedWorkerType } from "@/server/supervisor/worker-types";

const execFileAsync = promisify(execFile);

export type WorkerModelOption = {
  value: string;
  label: string;
};

export type WorkerModelCatalog = Record<SupportedWorkerType, WorkerModelOption[]>;

type RunCommand = (command: string, args: string[]) => Promise<string>;
type LoadCachedCatalog = () => Promise<Partial<WorkerModelCatalog> | null>;
type SaveCachedCatalog = (catalog: WorkerModelCatalog) => Promise<void>;

export type WorkerModelCatalogSnapshot = {
  catalog: WorkerModelCatalog;
  refreshing: boolean;
};

type WorkerModelCatalogManagerOptions = {
  runCommand?: RunCommand;
  loadCachedCatalog?: LoadCachedCatalog;
  saveCachedCatalog?: SaveCachedCatalog;
};

const HARDCODED_WORKER_MODELS: WorkerModelCatalog = {
  codex: [
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
  claude: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
  gemini: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  ],
  opencode: [
    { value: "openai/gpt-5.4", label: "GPT-5.4" },
    { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "openai/gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
};

async function defaultRunCommand(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    timeout: 5_000,
    maxBuffer: 8 * 1024 * 1024,
  });

  return result.stdout;
}

function labelFromModelId(id: string) {
  const bareId = id.includes("/") ? id.split("/").at(-1) ?? id : id;
  return bareId
    .split("-")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "gpt") return "GPT";
      if (lower === "cli") return "CLI";
      if (/^\d+(?:\.\d+)*$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function normalizeLabel(id: string, label?: string) {
  if (!label?.trim()) {
    return labelFromModelId(id);
  }

  return label.trim()
    .replace(/^gpt\b/i, "GPT")
    .replace(/\bcodex\b/i, "Codex")
    .replace(/\bcli\b/i, "CLI");
}

function mergeModelOptions(base: WorkerModelOption[], discovered: WorkerModelOption[]) {
  const seen = new Set<string>();
  const merged: WorkerModelOption[] = [];

  for (const model of [...base, ...discovered]) {
    const value = model.value.trim();
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    merged.push({
      value,
      label: normalizeLabel(value, model.label),
    });
  }

  return merged;
}

function buildHardcodedCatalog(): WorkerModelCatalog {
  return {
    codex: [...HARDCODED_WORKER_MODELS.codex],
    claude: [...HARDCODED_WORKER_MODELS.claude],
    gemini: [...HARDCODED_WORKER_MODELS.gemini],
    opencode: [...HARDCODED_WORKER_MODELS.opencode],
  };
}

function normalizeCachedCatalog(catalog: Partial<WorkerModelCatalog> | null | undefined): Partial<WorkerModelCatalog> | null {
  if (!catalog || typeof catalog !== "object") {
    return null;
  }

  const normalized: Partial<WorkerModelCatalog> = {};
  for (const type of Object.keys(HARDCODED_WORKER_MODELS) as SupportedWorkerType[]) {
    const models = catalog[type];
    if (!Array.isArray(models)) {
      continue;
    }

    const options = models.flatMap((model) => {
      if (!model || typeof model !== "object") {
        return [];
      }

      const value = typeof model.value === "string" ? model.value.trim() : "";
      if (!value) {
        return [];
      }

      const label = typeof model.label === "string" ? model.label : undefined;
      return [{
        value,
        label: normalizeLabel(value, label),
      }];
    });

    if (options.length > 0) {
      normalized[type] = mergeModelOptions([], options);
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function mergeCatalogWithCache(cachedCatalog: Partial<WorkerModelCatalog> | null | undefined): WorkerModelCatalog {
  const catalog = buildHardcodedCatalog();
  const normalizedCache = normalizeCachedCatalog(cachedCatalog);

  if (!normalizedCache) {
    return catalog;
  }

  for (const type of Object.keys(HARDCODED_WORKER_MODELS) as SupportedWorkerType[]) {
    catalog[type] = mergeModelOptions(catalog[type], normalizedCache[type] ?? []);
  }

  return catalog;
}

function parseCodexModels(output: string) {
  const parsed = JSON.parse(output) as {
    models?: Array<{
      slug?: unknown;
      display_name?: unknown;
      visibility?: unknown;
    }>;
  };

  return (parsed.models ?? [])
    .filter((model) => model.visibility !== "hidden")
    .map((model) => {
      const value = typeof model.slug === "string" ? model.slug.trim() : "";
      if (!value) {
        return null;
      }

      return {
        value,
        label: normalizeLabel(value, typeof model.display_name === "string" ? model.display_name : undefined),
      };
    })
    .filter((model): model is WorkerModelOption => model !== null);
}

function parseOpenCodeModels(output: string) {
  const modelIds = new Set<string>();
  const modelPattern = /\b[a-z][a-z0-9_-]*\/[a-z0-9][a-z0-9._:-]*(?:-[a-z0-9._:-]+)*\b/gi;

  for (const match of output.matchAll(modelPattern)) {
    modelIds.add(match[0]);
  }

  return [...modelIds].map((value) => ({
    value,
    label: labelFromModelId(value),
  }));
}

export class WorkerModelCatalogManager {
  private readonly runCommand: RunCommand;
  private readonly loadCachedCatalog?: LoadCachedCatalog;
  private readonly saveCachedCatalog?: SaveCachedCatalog;
  private cachedCatalog: Partial<WorkerModelCatalog> | null | undefined;
  private refreshPromise: Promise<WorkerModelCatalog> | null = null;
  private hasStartedRefresh = false;

  constructor(options: WorkerModelCatalogManagerOptions = {}) {
    this.runCommand = options.runCommand ?? defaultRunCommand;
    this.loadCachedCatalog = options.loadCachedCatalog;
    this.saveCachedCatalog = options.saveCachedCatalog;
  }

  async getCatalogSnapshot(options: { refreshOnFirstLoad?: boolean } = {}): Promise<WorkerModelCatalogSnapshot> {
    const cachedCatalog = await this.loadCacheOnce();

    if (options.refreshOnFirstLoad && !this.hasStartedRefresh) {
      void this.refreshCatalog().catch(() => undefined);
    }

    return {
      catalog: mergeCatalogWithCache(cachedCatalog),
      refreshing: this.refreshPromise !== null,
    };
  }

  async refreshCatalog(): Promise<WorkerModelCatalog> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.hasStartedRefresh = true;
    this.refreshPromise = this.buildFreshCatalog()
      .then(async (catalog) => {
        this.cachedCatalog = catalog;
        await this.saveCachedCatalog?.(catalog);
        return catalog;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private async loadCacheOnce() {
    if (this.cachedCatalog !== undefined) {
      return this.cachedCatalog;
    }

    try {
      this.cachedCatalog = normalizeCachedCatalog(await this.loadCachedCatalog?.() ?? null);
    } catch {
      this.cachedCatalog = null;
    }

    return this.cachedCatalog;
  }

  private async buildFreshCatalog() {
    const baseCatalog = mergeCatalogWithCache(await this.loadCacheOnce());
    const [codexResult, openCodeResult] = await Promise.allSettled([
      this.runCommand("codex", ["debug", "models"]).then(parseCodexModels),
      this.runCommand("opencode", ["models", "--refresh"]).then(parseOpenCodeModels),
    ]);

    if (codexResult.status === "fulfilled") {
      baseCatalog.codex = mergeModelOptions(HARDCODED_WORKER_MODELS.codex, codexResult.value);
    }

    if (openCodeResult.status === "fulfilled") {
      baseCatalog.opencode = mergeModelOptions(HARDCODED_WORKER_MODELS.opencode, openCodeResult.value);
    }

    return baseCatalog;
  }
}

export async function buildWorkerModelCatalog(options: { runCommand?: RunCommand } = {}): Promise<WorkerModelCatalog> {
  return new WorkerModelCatalogManager(options).refreshCatalog();
}

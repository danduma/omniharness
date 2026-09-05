import { execFile } from "child_process";
import { promisify } from "util";
import type { SupportedWorkerType } from "@/server/supervisor/worker-types";
import { mergeClaudeGatewayModels, type ClaudeGatewayModelInput } from "@/lib/claude-model-gateway";

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
    { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "claude-sonnet-5", label: "Sonnet 5" },
    { value: "claude-sonnet-4", label: "Sonnet 4" },
  ],
  claude: [
    { value: "claude-opus-5", label: "Opus 5" },
    { value: "claude-fable-5-1", label: "Fable 5.1" },
    { value: "claude-fable-5", label: "Fable 5" },
    { value: "claude-opus-4-8", label: "Opus 4.8" },
    { value: "claude-opus-4-7", label: "Opus 4.7" },
    { value: "claude-opus-4-6", label: "Opus 4.6" },
    { value: "claude-sonnet-5", label: "Sonnet 5" },
    { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
    { value: "claude-sonnet-4", label: "Sonnet 4" },
  ],
  gemini: [
    { value: "gemini-3", label: "Gemini 3" },
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  ],
  opencode: [
    { value: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { value: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { value: "openai/gpt-5.5", label: "GPT-5.5" },
    { value: "openai/gpt-5.4", label: "GPT-5.4" },
    { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "openai/gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "anthropic/claude-sonnet-5", label: "Sonnet 5" },
    { value: "anthropic/claude-sonnet-4", label: "Sonnet 4" },
  ],
};

const DEPRECATED_WORKER_MODELS: Partial<Record<SupportedWorkerType, Set<string>>> = {
  gemini: new Set(["gemini-3.5-flash"]),
};

async function defaultRunCommand(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    timeout: 5_000,
    maxBuffer: 8 * 1024 * 1024,
  });

  return result.stdout;
}

// "Claude Opus 5" reads as "Opus 5" in the picker: the vendor prefix is noise
// next to the worker name. Only dropped when a word follows, so an id like
// "claude-3" still labels as "Claude 3" rather than a bare "3".
function dropClaudePrefix(label: string) {
  return label.replace(/^claude\s+(?=[A-Za-z])/i, "");
}

// Model ids spell versions with the same hyphen that separates every other
// segment, so a plain split renders "claude-opus-4-8" as "Opus 4 8". Adjacent
// numeric segments are one version number: rejoin them with a dot. Bounded to
// three digits so a dated snapshot like "claude-haiku-4-5-20251001" reads as
// "Haiku 4.5 20251001" — the date is a separate fact, not a version component.
function isVersionSegment(part: string) {
  return /^\d{1,3}$/.test(part);
}

function titleCaseModelIdPart(part: string) {
  const lower = part.toLowerCase();
  if (lower === "gpt") return "GPT";
  if (lower === "cli") return "CLI";
  if (/^\d+(?:\.\d+)*$/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function labelFromModelId(id: string) {
  const bareId = id.includes("/") ? id.split("/").at(-1) ?? id : id;
  const parts = bareId.split("-");
  const label = parts.reduce((accumulated, part, index) => {
    if (index === 0) {
      return titleCaseModelIdPart(part);
    }
    const separator = isVersionSegment(part) && isVersionSegment(parts[index - 1]!) ? "." : " ";
    return `${accumulated}${separator}${titleCaseModelIdPart(part)}`;
  }, "");
  return dropClaudePrefix(label);
}

function normalizeLabel(id: string, label?: string) {
  const bareId = id.includes("/") ? id.split("/").at(-1) ?? id : id;
  const gpt56Labels: Record<string, string> = {
    "gpt-5.6-sol": "GPT-5.6 Sol",
    "gpt-5.6-terra": "GPT-5.6 Terra",
    "gpt-5.6-luna": "GPT-5.6 Luna",
  };
  if (gpt56Labels[bareId]) {
    return gpt56Labels[bareId];
  }

  if (!label?.trim()) {
    return labelFromModelId(id);
  }

  return dropClaudePrefix(label.trim())
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

export function getBuiltInWorkerModelOptions(workerType: SupportedWorkerType): WorkerModelOption[] {
  return [...buildHardcodedCatalog()[workerType]];
}

export function mergeClaudeGatewayModelsIntoCatalog(
  catalog: WorkerModelCatalog,
  input: { custom?: ClaudeGatewayModelInput[]; discovered?: ClaudeGatewayModelInput[] },
): WorkerModelCatalog {
  const gatewayModels = mergeClaudeGatewayModels(input).map((model) => ({
    value: model.value,
    label: model.label,
  }));
  return {
    ...catalog,
    codex: [...catalog.codex],
    claude: mergeModelOptions(catalog.claude, gatewayModels),
    gemini: [...catalog.gemini],
    opencode: [...catalog.opencode],
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
      if (!value || DEPRECATED_WORKER_MODELS[type]?.has(value)) {
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
      priority?: unknown;
    }>;
  };

  return (parsed.models ?? [])
    .filter((model) => model.visibility !== "hidden" && model.visibility !== "hide")
    .map((model) => {
      const value = typeof model.slug === "string" ? model.slug.trim() : "";
      if (!value) {
        return null;
      }

      return {
        value,
        label: normalizeLabel(value, typeof model.display_name === "string" ? model.display_name : undefined),
        priority: typeof model.priority === "number" ? model.priority : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((model): model is WorkerModelOption & { priority: number } => model !== null)
    .sort((left, right) => left.priority - right.priority);
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
      baseCatalog.codex = mergeModelOptions(codexResult.value, HARDCODED_WORKER_MODELS.codex);
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

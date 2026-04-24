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

export async function buildWorkerModelCatalog(options: { runCommand?: RunCommand } = {}): Promise<WorkerModelCatalog> {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const catalog: WorkerModelCatalog = {
    codex: [...HARDCODED_WORKER_MODELS.codex],
    claude: [...HARDCODED_WORKER_MODELS.claude],
    gemini: [...HARDCODED_WORKER_MODELS.gemini],
    opencode: [...HARDCODED_WORKER_MODELS.opencode],
  };

  const [codexResult, openCodeResult] = await Promise.allSettled([
    runCommand("codex", ["debug", "models"]).then(parseCodexModels),
    runCommand("opencode", ["models", "--refresh"]).then(parseOpenCodeModels),
  ]);

  if (codexResult.status === "fulfilled") {
    catalog.codex = mergeModelOptions(catalog.codex, codexResult.value);
  }

  if (openCodeResult.status === "fulfilled") {
    catalog.opencode = mergeModelOptions(catalog.opencode, openCodeResult.value);
  }

  return catalog;
}

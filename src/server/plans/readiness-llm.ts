import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { formatErrorMessage } from "@/server/runs/failures";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import {
  buildMastraModelConfig,
  getSupervisorModelConfig,
  validateSupervisorModelConfig,
} from "@/server/supervisor/model-config";
import type { PlanStructuralFacts } from "@/server/plans/readiness";

export type PlanVerdict = "ready" | "needs_review" | "needs_rewrite";

export interface PlanReadinessConcern {
  kind: "vague_item" | "missing_verify" | "sequencing" | "scope" | "spec_mismatch" | "unverifiable_ac" | "other";
  itemIndex: number | null;
  detail: string;
}

export interface PlanReadinessVerdict {
  verdict: PlanVerdict;
  confidence: number;
  headline: string;
  topConcern: string | null;
  concerns: PlanReadinessConcern[];
  rationale: string;
}

const concernSchema = z.object({
  kind: z.enum(["vague_item", "missing_verify", "sequencing", "scope", "spec_mismatch", "unverifiable_ac", "other"]),
  itemIndex: z.number().int().nullable(),
  detail: z.string(),
});

const verdictSchema = z.object({
  verdict: z.enum(["ready", "needs_review", "needs_rewrite"]),
  confidence: z.number().min(0).max(1),
  headline: z.string().min(1),
  topConcern: z.string().nullable(),
  concerns: z.array(concernSchema),
  rationale: z.string(),
});

const READINESS_SYSTEM_PROMPT = `You judge whether a software implementation plan is concrete enough to start coding from.

The plan was produced by a planning agent and is shown to a developer in a UI panel. Your verdict and headline will be displayed directly to that developer in place of a generic "Here are the plan files." message — so write the headline as one useful sentence about whether the plan is ready and why.

You will receive:
- The plan markdown (a checklist of items, possibly grouped into phases, possibly with details and Verify: lines).
- The spec markdown (the design doc the plan implements), or "none provided".
- Structural facts already extracted by a regex pass: item count, which items are missing details, missing Verify lines, have stub or vague titles, whether there is a global Acceptance Criteria section, etc. Trust these facts — do not re-derive them.

Focus on semantic issues regex cannot see:
- Sequencing: can step N actually be done before step N+1, or does it depend on something later?
- Verifiability: is each item observable from outside (file changes, UI behaviors, command output) or is it "feel-good" work?
- Spec alignment: does the plan cover what the spec asks for, and does it stop where the spec stops (no scope creep)?
- Acceptance criteria quality: are the criteria concrete and testable, not vague platitudes?
- Coherence: do items contradict each other or the spec?

Output JSON matching the provided schema. Be ruthless and concise.

Verdict meanings:
- "ready": developer can confidently start implementation. Minor wishes allowed in concerns; the plan does not block.
- "needs_review": plan is mostly there but has gaps a review pass would fix (often missing verifies, slightly vague items, weak acceptance criteria).
- "needs_rewrite": plan is too incomplete, too vague, or contradicts the spec; the developer should send it back for revision.

The headline must be a single sentence, no greeting, no "Hi", no "Here are". Examples:
- "Plan is ready — every item has a Verify line and the acceptance criteria match the spec."
- "Plan needs a review pass — items 3 and 5 cannot be verified by observation, and item 4 depends on item 6."
- "Plan needs a rewrite — three of four items are stubs and there are no acceptance criteria."

topConcern is the single biggest issue (null when verdict is "ready" with no concerns). concerns lists all distinct issues. rationale is a short paragraph that can be hidden behind a disclosure; do not repeat the headline verbatim.`;

interface AssessArgs {
  planMarkdown: string;
  specMarkdown: string | null;
  structure: PlanStructuralFacts;
  signal?: AbortSignal;
}

export type LLMReadinessOutcome =
  | { ok: true; verdict: PlanReadinessVerdict }
  | { ok: false; error: string };

function summarizeStructure(structure: PlanStructuralFacts) {
  return {
    itemCount: structure.itemCount,
    hasAcceptanceCriteria: structure.hasAcceptanceCriteria,
    hasGoalSection: structure.hasGoalSection,
    itemsMissingDetails: structure.itemsMissingDetails,
    itemsMissingVerify: structure.itemsMissingVerify,
    itemsWithEmptyVerify: structure.itemsWithEmptyVerify,
    itemsWithVagueTitle: structure.itemsWithVagueTitle,
    itemsWithStubTitle: structure.itemsWithStubTitle,
  };
}

function buildUserPrompt(args: AssessArgs) {
  return [
    "Structural facts (already extracted, trust these):",
    "```json",
    JSON.stringify(summarizeStructure(args.structure), null, 2),
    "```",
    "",
    "Plan markdown:",
    "```markdown",
    args.planMarkdown.trim(),
    "```",
    "",
    "Spec markdown:",
    args.specMarkdown
      ? "```markdown\n" + args.specMarkdown.trim() + "\n```"
      : "(none provided)",
    "",
    "Return JSON matching the schema. Write the headline as a single sentence that will be shown directly to the developer.",
  ].join("\n");
}

export async function assessPlanReadinessWithLLM(args: AssessArgs): Promise<LLMReadinessOutcome> {
  if (process.env.MOCK_LLM === "true") {
    return { ok: false, error: "MOCK_LLM enabled" };
  }

  const startedAt = Date.now();
  console.log("[plan-readiness] start", { itemCount: args.structure.itemCount });
  try {
    const allSettings = await db.select().from(settings);
    const { env: envParams, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
    const env = { ...process.env, ...envParams };
    const config = validateSupervisorModelConfig(
      getSupervisorModelConfig(env),
      decryptionFailures,
    );
    const model = buildMastraModelConfig(config);
    const agent = new Agent({
      id: "omniharness-plan-readiness-judge",
      name: "OmniHarness Plan Readiness Judge",
      instructions: READINESS_SYSTEM_PROMPT,
      model,
    });

    const completion = await agent.generate(buildUserPrompt(args), {
      structuredOutput: {
        schema: verdictSchema,
        model,
        jsonPromptInjection: true,
      },
    });

    const parsed = completion.object;
    if (!parsed) {
      console.log("[plan-readiness] outcome", { ok: false, error: "no structured output", ms: Date.now() - startedAt });
      return { ok: false, error: "LLM returned no structured output" };
    }

    const headline = parsed.headline.trim();
    if (!headline) {
      console.log("[plan-readiness] outcome", { ok: false, error: "empty headline", ms: Date.now() - startedAt });
      return { ok: false, error: "LLM returned empty headline" };
    }

    console.log("[plan-readiness] outcome", { ok: true, verdict: parsed.verdict, ms: Date.now() - startedAt });
    return {
      ok: true,
      verdict: {
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        headline,
        topConcern: parsed.topConcern?.trim() || null,
        concerns: parsed.concerns.map((concern) => ({
          kind: concern.kind,
          itemIndex: concern.itemIndex,
          detail: concern.detail.trim(),
        })),
        rationale: parsed.rationale.trim(),
      },
    };
  } catch (error) {
    console.log("[plan-readiness] outcome", { ok: false, error: formatErrorMessage(error), ms: Date.now() - startedAt });
    return { ok: false, error: formatErrorMessage(error) };
  }
}

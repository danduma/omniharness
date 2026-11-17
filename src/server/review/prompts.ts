import { z } from "zod";

export const CODE_REVIEW_SEVERITIES = ["blocker", "major", "minor", "nit"] as const;
export type CodeReviewSeverity = (typeof CODE_REVIEW_SEVERITIES)[number];

const MAX_TEXT = 2_000;

const findingSchema = z.object({
  severity: z.enum(CODE_REVIEW_SEVERITIES),
  file: z.string().max(500).optional().nullable(),
  line: z.number().int().positive().optional().nullable(),
  claim: z.string().min(1).max(MAX_TEXT),
  evidence: z.string().max(MAX_TEXT).optional().nullable(),
  suggestedFix: z.string().max(MAX_TEXT).optional().nullable(),
});

export const codeReviewVerdictSchema = z.object({
  verdict: z.enum(["approve", "request_changes", "blocked"]),
  findings: z.array(findingSchema).max(50).default([]),
  /** Status of findings from earlier rounds, by id. */
  previousFindings: z.array(z.object({
    id: z.string().min(1),
    status: z.enum(["resolved", "open", "withdrawn"]),
    note: z.string().max(MAX_TEXT).optional().nullable(),
  })).max(100).default([]),
  filesInspected: z.array(z.string().max(500)).max(200).default([]),
  testsRun: z.array(z.string().max(500)).max(50).default([]),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export type CodeReviewVerdict = z.infer<typeof codeReviewVerdictSchema>;
export type CodeReviewFindingInput = z.infer<typeof findingSchema>;

export type PreviousFinding = {
  id: string;
  severity: CodeReviewSeverity;
  file: string | null;
  line: number | null;
  claim: string;
  status: string;
  disputeReason: string | null;
};

/** Extract the last fenced json block (or the last balanced top-level object) from agent text. */
export function extractJsonBlock(text: string): string | null {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (fenced.length > 0) return fenced.at(-1)![1]!.trim();
  const end = text.lastIndexOf("}");
  if (end < 0) return null;
  let depth = 0;
  for (let index = end; index >= 0; index -= 1) {
    const char = text[index];
    if (char === "}") depth += 1;
    if (char === "{") {
      depth -= 1;
      if (depth === 0) return text.slice(index, end + 1);
    }
  }
  return null;
}

export function parseCodeReviewVerdict(text: string): { ok: true; verdict: CodeReviewVerdict } | { ok: false; error: string } {
  const block = extractJsonBlock(text);
  if (!block) return { ok: false, error: "The reviewer did not return a JSON verdict." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    return { ok: false, error: "The reviewer's verdict was not valid JSON." };
  }
  const result = codeReviewVerdictSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `The reviewer's verdict did not match the schema: ${result.error.issues[0]?.message ?? "invalid"}.` };
  }
  return { ok: true, verdict: result.data };
}

/**
 * Anti-rubber-stamp rule: a verdict must show what the reviewer actually
 * looked at. An approval with no inspected files, no tests run and no
 * file:line finding is not accepted as a review.
 */
export function verdictHasEvidence(verdict: CodeReviewVerdict) {
  return verdict.filesInspected.length > 0
    || verdict.testsRun.length > 0
    || verdict.findings.some((finding) => Boolean(finding.file) && typeof finding.line === "number");
}

function formatPreviousFindings(findings: ReadonlyArray<PreviousFinding>) {
  if (findings.length === 0) return "(none)";
  return findings.map((finding) => {
    const location = finding.file ? ` ${finding.file}${finding.line ? `:${finding.line}` : ""}` : "";
    const dispute = finding.disputeReason ? `\n   Implementer disputes this: ${finding.disputeReason}` : "";
    return `- id ${finding.id} [${finding.severity}]${location} (${finding.status}): ${finding.claim}${dispute}`;
  }).join("\n");
}

export function buildCodeReviewerPrompt(args: {
  round: number;
  maxRounds: number;
  task: string;
  implementerType: string;
  diff: string;
  stat: string;
  untracked: string[];
  truncated: boolean;
  implementerSummary: string;
  previousFindings: ReadonlyArray<PreviousFinding>;
}): string {
  return `You are an independent CODE REVIEWER for changes made by a different coding agent (${args.implementerType}).
Review round ${args.round} of at most ${args.maxRounds}.

CONSTRAINTS:
- Do NOT edit, create, or delete files. Do NOT commit, push, or change git state.
- You MAY read files and run read-only checks or the project's tests.
- Do not trust the implementer's summary; verify against the code.
- Report only real problems. Do not invent findings to look thorough, and do not approve without looking.

TASK THE CHANGE IS MEANT TO ACCOMPLISH:
${args.task || "(not recorded)"}

IMPLEMENTER'S OWN SUMMARY (unverified):
${args.implementerSummary || "(none)"}

FINDINGS FROM EARLIER ROUNDS (report each one's status by id):
${formatPreviousFindings(args.previousFindings)}

CHANGED FILES:
${args.stat || "(no tracked changes)"}
${args.untracked.length > 0 ? `\nNEW UNTRACKED FILES:\n${args.untracked.join("\n")}\n` : ""}
DIFF${args.truncated ? " (TRUNCATED: read the files directly for the rest)" : ""}:
\`\`\`diff
${args.diff}
\`\`\`

OUTPUT: finish with exactly one JSON block fenced with \`\`\`json:
{
  "verdict": "approve" | "request_changes" | "blocked",
  "findings": [{ "severity": "blocker" | "major" | "minor" | "nit", "file": "src/x.ts", "line": 42, "claim": "...", "evidence": "...", "suggestedFix": "..." }],
  "previousFindings": [{ "id": "<id from above>", "status": "resolved" | "open" | "withdrawn", "note": "..." }],
  "filesInspected": ["src/x.ts"],
  "testsRun": ["pnpm test path/to/test"],
  "confidence": 0.0
}
Rules:
- "approve" only if no blocker or major problem remains, including earlier findings.
- Every approval must list the files you inspected or the tests you ran.
- Give file and line for every finding you can locate.
- Keep a disputed finding "open" only if the implementer's reason is wrong; say why in "note".`;
}

export function buildEvidenceRequestPrompt(): string {
  return `Your verdict did not show what you checked. List the files you inspected and any tests you ran, and give file:line locations for findings.
Reply again with the same JSON verdict format, fenced with \`\`\`json.`;
}

export function buildImplementerFixPrompt(args: {
  round: number;
  reviewerType: string;
  findings: ReadonlyArray<PreviousFinding>;
}): string {
  return `An independent reviewer (${args.reviewerType}) reviewed your changes (round ${args.round}) and asked for changes:

${formatPreviousFindings(args.findings)}

Fix the findings you agree with. If you believe a finding is wrong, do not change the code for it; instead explain why.
When done, end your reply with a JSON block fenced with \`\`\`json listing any findings you dispute (use an empty list if none):
{ "disputes": [{ "id": "<finding id>", "reason": "why the finding is wrong" }] }`;
}

const disputesSchema = z.object({
  disputes: z.array(z.object({ id: z.string().min(1), reason: z.string().min(1).max(MAX_TEXT) })).max(100),
});

export function parseImplementerDisputes(text: string): Array<{ id: string; reason: string }> {
  const block = extractJsonBlock(text);
  if (!block) return [];
  try {
    const result = disputesSchema.safeParse(JSON.parse(block));
    return result.success ? result.data.disputes : [];
  } catch {
    return [];
  }
}

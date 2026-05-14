export type ReviewerFinding = {
  severity: "critical" | "major" | "minor" | "note";
  category: "scope" | "architecture" | "sequencing" | "testing" | "ux" | "risk" | "observability" | "i18n" | "other";
  title: string;
  details: string;
  recommendation: string;
  sourcePath?: string;
};

export function buildReviewerPrompt(args: {
  userIntent: string;
  specPath: string;
  specContent: string;
  planPath: string;
  planContent: string;
}): string {
  return `You are acting as a READ-ONLY planning reviewer. 

Your goal is to evaluate the proposed implementation plan and specification against the original user intent.

CONSTRAINTS:
- DO NOT edit any files.
- DO NOT run any implementation steps or commands (other than reading if needed).
- DO NOT commit any changes.
- DO NOT promote the plan to implementation.
- You must provide your findings in a structured JSON format.

USER INTENT:
${args.userIntent}

SPECIFICATION (${args.specPath}):
${args.specContent}

PLAN (${args.planPath}):
${args.planContent}

EVALUATION CRITERIA:
1. Scope: Does the plan cover all requirements? Is there scope creep?
2. Architecture: Is the proposed design sound and idiomatic for the project?
3. Sequencing: Is the task order logical? Are dependencies handled correctly?
4. Testing: Is there a clear verification strategy for each step?
5. UX/UI: Does it align with project design standards?
6. Risk: Are there potential security, performance, or stability risks?
7. Observability: Is there sufficient logging/instrumentation?
8. i18n: Are user-facing strings handled via locale resources?

OUTPUT FORMAT:
Provide your findings in a JSON block fenced with \`\`\`json.
If the plan is good and requires no changes, provide an empty array: [].

Example finding:
\`\`\`json
[
  {
    "severity": "major",
    "category": "testing",
    "title": "Missing verification for database migration",
    "details": "Step 3 adds a new column but does not include a command to verify the schema change.",
    "recommendation": "Add 'pnpm drizzle-kit check' or a custom script to verify the migration.",
    "sourcePath": "docs/plans/my-plan.md"
  }
]
\`\`\`

Analyze the plan and provide your findings now.`;
}

export function buildPlannerRevisionPrompt(args: {
  findings: ReviewerFinding[];
  roundNumber: number;
}): string {
  const findingsList = args.findings
    .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.category})
   Detail: ${f.details}
   Recommendation: ${f.recommendation}`)
    .join("\n\n");

  return `Reviewer findings (Round ${args.roundNumber}):

${findingsList}

Please revise the specification and implementation plan to address these findings.
- Edit the spec and plan files directly.
- Preserve all existing user constraints and project conventions.
- When finished, you MUST emit a READY planning handoff block (the same format you used originally) so the user can review the updated plan.

Address the findings and provide the updated artifacts now.`;
}

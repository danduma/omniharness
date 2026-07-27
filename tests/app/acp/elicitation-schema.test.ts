import { describe, expect, it } from "vitest";
import {
  buildElicitationContent,
  hasInvalidElicitationField,
  parseElicitationFields,
} from "@/lib/acp/elicitation-schema";

const INCIDENT_SCHEMA = {
  type: "object",
  properties: {
    question_0: {
      type: "array",
      title: "Niche access",
      items: {
        anyOf: [
          { const: "Agencies / freelancer world", title: "Agencies / freelancer world — You know agency owners." },
          { const: "Legal / professional services", title: "Legal / professional services — Lawyers or accountants." },
          { const: "Property / recruiting", title: "Property / recruiting — Contacts in either market." },
          { const: "No special access", title: "No special access — Pick on market logic." },
        ],
      },
    },
    customAnswer: {
      type: "string",
      title: "Other",
      description: "Type your own answer instead of choosing an option above (optional).",
    },
  },
};

describe("ACP elicitation schema", () => {
  it("parses the hidden Claude incident as multi-select plus custom answer", () => {
    const fields = parseElicitationFields(INCIDENT_SCHEMA);

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      name: "question_0",
      kind: "multi_select",
      label: "Niche access",
      required: false,
    });
    expect(fields[0]?.options.map((option) => option.value)).toEqual([
      "Agencies / freelancer world",
      "Legal / professional services",
      "Property / recruiting",
      "No special access",
    ]);
    expect(fields[1]).toMatchObject({
      name: "customAnswer",
      kind: "text",
      label: "Other",
    });
  });

  it("builds typed ACP response content", () => {
    const fields = parseElicitationFields(INCIDENT_SCHEMA);
    expect(buildElicitationContent(fields, {
      question_0: ["Agencies / freelancer world", "Property / recruiting"],
      customAnswer: "I know two founders",
    })).toEqual({
      question_0: ["Agencies / freelancer world", "Property / recruiting"],
      customAnswer: "I know two founders",
    });
  });

  it("validates numeric, text, and multi-select constraints", () => {
    const fields = parseElicitationFields({
      type: "object",
      properties: {
        count: { type: "integer", minimum: 1, maximum: 3 },
        code: { type: "string", pattern: "^[A-Z]+$", minLength: 2 },
        choices: { type: "array", minItems: 2, items: { enum: ["a", "b", "c"] } },
      },
    });
    expect(hasInvalidElicitationField(fields, { count: 0, code: "a", choices: ["a"] })).toBe(true);
    expect(hasInvalidElicitationField(fields, { count: 2, code: "OK", choices: ["a", "b"] })).toBe(false);
  });
});

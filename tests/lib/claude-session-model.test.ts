import { describe, expect, it } from "vitest";
import {
  isOneMillionContextModel,
  isOneMillionContextOption,
  resolveClaudeSessionModel,
} from "@/lib/claude-session-model";

// Mirrors what the Claude ACP adapter reports for a subscription-only account:
// Fable is offered exclusively as its 1M-context variant, and `opus` is a bare
// alias whose actual version only shows up in the description.
const SUBSCRIPTION_OPTIONS = [
  { value: "default", name: "Default (recommended)", description: "Sonnet 4.6 · Efficient for routine tasks" },
  { value: "claude-fable-5[1m]", name: "Fable", description: "Fable 5 · Most capable for your hardest tasks" },
  { value: "opus", name: "Opus", description: "Opus 4.8 · Best for everyday, complex tasks" },
  { value: "haiku", name: "Haiku", description: "Haiku 4.5 · Fastest for quick answers" },
];

// The exact list run 594224099b56 was offered at spawn. Note that `default`
// carries its 1M-ness only in the description — its value says nothing.
const RUN_594224_OPTIONS = [
  { value: "default", name: "Default (recommended)", description: "Opus 4.8 with 1M context · Best for everyday, complex tasks" },
  { value: "claude-fable-5[1m]", name: "Fable", description: "Fable 5 · Most capable for your hardest and longest-running tasks · Uses your limits ~2× faster than Opus" },
  { value: "sonnet", name: "Sonnet", description: "Sonnet 4.6 · Efficient for routine tasks" },
  { value: "haiku", name: "Haiku", description: "Haiku 4.5 · Fastest for quick answers" },
];

describe("claude session model pinning", () => {
  it("detects 1M-context variants by value", () => {
    expect(isOneMillionContextModel("claude-fable-5[1m]")).toBe(true);
    expect(isOneMillionContextModel("opus[1m]")).toBe(true);
    expect(isOneMillionContextModel("opus")).toBe(false);
  });

  it("detects a 1M option whose value hides it in the description", () => {
    // `default` is the adapter's own recommendation and the single most likely
    // thing to be picked as a "safe" fallback. A value-only test called it
    // standard-context.
    expect(isOneMillionContextOption(RUN_594224_OPTIONS[0]!)).toBe(true);
    expect(isOneMillionContextOption(RUN_594224_OPTIONS[2]!)).toBe(false);
  });

  describe("never substitutes across families", () => {
    it("runs the 1M-only Fable rather than dropping to Opus", () => {
      // Regression for run 594224099b56: requested Fable 5, ran Opus 4.8 for
      // 301 turns while the database recorded `claude-fable-5`. Fable was right
      // there on the list — only as `[1m]` — and `[1m]` Fable is still Fable.
      expect(resolveClaudeSessionModel({
        options: RUN_594224_OPTIONS,
        requested: "claude-fable-5",
        current: "default",
      })).toEqual({
        status: "pin",
        value: "claude-fable-5[1m]",
        reason: "one_million_only",
      });
    });

    it("refuses when the requested family is not offered at all", () => {
      expect(resolveClaudeSessionModel({
        options: [
          { value: "default", name: "Default", description: "Sonnet 4.6" },
          { value: "haiku", name: "Haiku", description: "Haiku 4.5" },
        ],
        requested: "claude-fable-5",
        current: "default",
      })).toEqual({
        status: "unavailable",
        reason: "family_unavailable",
        requested: "claude-fable-5",
        requestedFamily: "fable",
        requestedVersion: "5",
        available: ["default", "haiku"],
      });
    });

    it("never answers a Fable request with the adapter's default", () => {
      const outcome = resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: "claude-fable-5",
        current: "claude-fable-5[1m]",
      });
      // Previously this pinned `default` — i.e. Sonnet 4.6 — as a
      // "standard_context_fallback". Staying on 1M Fable is the correct answer.
      expect(outcome).toEqual({ status: "keep", value: "claude-fable-5[1m]", reason: "one_million_only" });
    });

    it("does not treat a Fable comparison to Opus as an Opus model", () => {
      expect(resolveClaudeSessionModel({
        options: RUN_594224_OPTIONS,
        requested: "claude-opus-5",
        current: "claude-fable-5[1m]",
      })).toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-opus-5",
        requestedFamily: "opus",
        requestedVersion: "5",
        available: ["default", "claude-fable-5[1m]", "sonnet", "haiku"],
      });
    });
  });

  describe("the requested version wins over context size", () => {
    it("recognizes an ACP family alias through its unambiguous version metadata", () => {
      expect(resolveClaudeSessionModel({
        options: [
          { value: "opus[1m]", name: "Opus (1M context)", description: "Opus 5 · Most capable" },
        ],
        requested: "claude-opus-5",
        current: "opus[1m]",
      })).toEqual({ status: "keep", value: "opus[1m]", reason: "one_million_only" });
    });

    it("refuses contradictory metadata for the same provider alias", () => {
      expect(resolveClaudeSessionModel({
        options: [
          { value: "opus[1m]", name: "Opus (1M context)", description: "Opus 5 · Most capable" },
          { value: "opus[1m]", name: "Opus (1M context)", description: "Opus 4.8 · Legacy" },
        ],
        requested: "claude-opus-5",
        current: "opus[1m]",
      })).toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-opus-5",
        requestedFamily: "opus",
        requestedVersion: "5",
        available: ["opus[1m]", "opus[1m]"],
      });
    });

    it("refuses contradictory identity fields inside one provider alias", () => {
      expect(resolveClaudeSessionModel({
        options: [
          { value: "opus[1m]", name: "Opus 5", description: "Opus 4.8 · Legacy" },
        ],
        requested: "claude-opus-5",
        current: "opus[1m]",
      })).toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-opus-5",
        requestedFamily: "opus",
        requestedVersion: "5",
        available: ["opus[1m]"],
      });
    });

    it("keeps an exact startup model even when the adapter omits it from the menu", () => {
      expect(resolveClaudeSessionModel({
        options: RUN_594224_OPTIONS,
        requested: "claude-opus-5",
        current: "claude-opus-5",
      })).toEqual({ status: "keep", value: "claude-opus-5", reason: "requested" });
    });

    it("runs the 1M-only Opus 5 rather than the standard-context Opus 4.8", () => {
      // The whole point. Filtering by context size first picks `opus` (4.8)
      // because it is the non-[1m] entry — delivering the wrong model to avoid
      // a detail the caller never asked about.
      expect(resolveClaudeSessionModel({
        options: [
          { value: "default", name: "Default", description: "Sonnet 4.6" },
          { value: "opus", name: "Opus", description: "Opus 4.8" },
          { value: "claude-opus-5[1m]", name: "Opus 5", description: "Opus 5" },
        ],
        requested: "claude-opus-5",
        current: "default",
      })).toEqual({ status: "pin", value: "claude-opus-5[1m]", reason: "one_million_only" });
    });

    it("prefers standard context only between listings of the same model", () => {
      expect(resolveClaudeSessionModel({
        options: [
          { value: "default", name: "Default", description: "Sonnet 4.6" },
          { value: "claude-opus-5[1m]", name: "Opus (1M)", description: "Opus 5" },
          { value: "claude-opus-5", name: "Opus", description: "Opus 5" },
        ],
        requested: "claude-opus-5",
        current: "default",
      })).toEqual({ status: "pin", value: "claude-opus-5", reason: "requested" });
    });

    it("refuses to substitute a different version", () => {
      expect(resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: "claude-opus-5",
        current: "default",
      })).toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-opus-5",
        requestedFamily: "opus",
        requestedVersion: "5",
        available: ["default", "claude-fable-5[1m]", "opus", "haiku"],
      });

      expect(resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: "claude-sonnet-5",
        current: "opus",
      })).toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-sonnet-5",
        requestedFamily: "sonnet",
        requestedVersion: "5",
        available: ["default", "claude-fable-5[1m]", "opus", "haiku"],
      });
    });

    it("pins the family alias when the requested version does match it", () => {
      expect(resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: "claude-opus-4-8",
        current: "default",
      })).toEqual({ status: "pin", value: "opus", reason: "requested" });
    });

    it("pins an unversioned family request without complaint", () => {
      expect(resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: "opus",
        current: "default",
      })).toEqual({ status: "pin", value: "opus", reason: "requested" });
    });

    it("refuses a family alias whose version cannot be verified", () => {
      expect(resolveClaudeSessionModel({
        options: [
          { value: "default", name: "Default", description: "Efficient for routine tasks" },
          { value: "opus", name: "Opus", description: "Best for complex tasks" },
        ],
        requested: "claude-opus-5",
        current: "default",
      })).toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-opus-5",
        requestedFamily: "opus",
        requestedVersion: "5",
        available: ["default", "opus"],
      });
    });

    it("honors an explicit 1M request", () => {
      expect(resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: "claude-fable-5[1m]",
        current: "default",
      })).toEqual({ status: "pin", value: "claude-fable-5[1m]", reason: "requested" });
    });
  });

  describe("with nothing requested", () => {
    it("moves a 1M session onto the same model at standard context", () => {
      // Same family, same version — nothing the caller can observe changes
      // except the usage-credit exposure.
      expect(resolveClaudeSessionModel({
        options: [
          { value: "default", name: "Default (recommended)", description: "Sonnet 4.6" },
          { value: "opus[1m]", name: "Opus (1M context)", description: "Opus 4.8" },
          { value: "opus", name: "Opus", description: "Opus 4.8" },
        ],
        requested: null,
        current: "opus[1m]",
      })).toEqual({ status: "pin", value: "opus", reason: "avoid_1m_default" });
    });

    it("leaves a 1M session alone rather than moving it to another model", () => {
      // Previously this pinned `default` — swapping an unrequested Opus session
      // onto Sonnet. With nothing requested there is nothing to justify
      // changing which model runs; a visible credit error beats a silent swap.
      expect(resolveClaudeSessionModel({
        options: [
          { value: "default", name: "Default (recommended)", description: "Sonnet 4.6" },
          { value: "opus[1m]", name: "Opus (1M context)", description: "Opus 4.8" },
        ],
        requested: null,
        current: "opus[1m]",
      })).toEqual({ status: "keep", value: "opus[1m]", reason: "one_million_only" });

      expect(resolveClaudeSessionModel({
        options: RUN_594224_OPTIONS,
        requested: null,
        current: "default",
      })).toEqual({ status: "keep", value: "default", reason: "one_million_only" });
    });

    it("leaves a healthy session alone", () => {
      expect(resolveClaudeSessionModel({
        options: SUBSCRIPTION_OPTIONS,
        requested: null,
        current: "opus",
      })).toEqual({ status: "keep", value: "opus", reason: "requested" });
    });
  });

  it("reports the resolved value on keep so the launch can record it", () => {
    // `keep` used to carry nothing, so callers fell back to the *requested*
    // model when writing the worker row — recording a model that never ran.
    expect(resolveClaudeSessionModel({
      options: SUBSCRIPTION_OPTIONS,
      requested: "opus",
      current: "opus",
    })).toEqual({ status: "keep", value: "opus", reason: "requested" });
  });

  it("fails closed without model choices when the reported model is absent", () => {
    expect(resolveClaudeSessionModel({ options: [], requested: "claude-opus-5", current: null }))
      .toEqual({
        status: "unavailable",
        reason: "version_unavailable",
        requested: "claude-opus-5",
        requestedFamily: "opus",
        requestedVersion: "5",
        available: [],
      });
  });

  it("fails closed without model choices when the reported model conflicts", () => {
    expect(resolveClaudeSessionModel({
      options: [],
      requested: "claude-opus-5",
      current: "claude-fable-5[1m]",
    })).toEqual({
      status: "unavailable",
      reason: "version_unavailable",
      requested: "claude-opus-5",
      requestedFamily: "opus",
      requestedVersion: "5",
      available: ["claude-fable-5[1m]"],
    });
  });

  it("accepts an exact reported model without model choices", () => {
    expect(resolveClaudeSessionModel({
      options: [],
      requested: "claude-opus-5",
      current: "claude-opus-5",
    })).toEqual({ status: "keep", value: "claude-opus-5", reason: "requested" });
  });
});

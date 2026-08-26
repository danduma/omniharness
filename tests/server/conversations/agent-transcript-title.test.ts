import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  __resetAgentTranscriptTitleCacheForTests,
  extractLatestAiTitle,
  readAgentSessionTitleFromTranscript,
} from "@/server/conversations/agent-transcript-title";

/**
 * Claude Code appends this record to its session transcript and rewrites it as
 * the conversation evolves — ~40 times in a long session — so the last one is
 * the current title.
 */
function aiTitleLine(title: string, sessionId = "session-1") {
  return JSON.stringify({ type: "ai-title", aiTitle: title, sessionId });
}

describe("extractLatestAiTitle", () => {
  it("reads the title Claude Code recorded", () => {
    expect(extractLatestAiTitle(aiTitleLine("Debug duplicate sent message race condition")))
      .toBe("Debug duplicate sent message race condition");
  });

  it("takes the last title, since the agent rewrites it as work proceeds", () => {
    const text = [
      aiTitleLine("First guess"),
      JSON.stringify({ type: "assistant", message: "working" }),
      aiTitleLine("Debug duplicate sent message race condition"),
    ].join("\n");

    expect(extractLatestAiTitle(text)).toBe("Debug duplicate sent message race condition");
  });

  it("survives a truncated first line from a tail read", () => {
    // The reader only pulls the end of a multi-megabyte file, so the first
    // line is almost always a fragment of an unrelated record.
    const text = [
      '{"type":"assistant","message":"...tru',
      aiTitleLine("Real title"),
    ].join("\n");

    expect(extractLatestAiTitle(text)).toBe("Real title");
  });

  it("ignores records that are not titles", () => {
    const text = [
      JSON.stringify({ type: "summary", summary: "not the title" }),
      JSON.stringify({ type: "user", message: "hello" }),
    ].join("\n");

    expect(extractLatestAiTitle(text)).toBeNull();
  });

  it("ignores blank titles", () => {
    expect(extractLatestAiTitle(aiTitleLine("   "))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractLatestAiTitle("")).toBeNull();
  });
});

describe("readAgentSessionTitleFromTranscript", () => {
  let configDir: string;

  beforeEach(() => {
    __resetAgentTranscriptTitleCacheForTests();
    configDir = mkdtempSync(join(tmpdir(), "omni-claude-config-"));
  });

  function writeTranscript(encodedProject: string, sessionId: string, lines: string[]) {
    const dir = join(configDir, "projects", encodedProject);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${sessionId}.jsonl`);
    writeFileSync(file, `${lines.join("\n")}\n`);
    return file;
  }

  it("finds the transcript from the worker's cwd", async () => {
    writeTranscript("-workspace-app", "session-a", [aiTitleLine("Title from cwd path", "session-a")]);

    const title = await readAgentSessionTitleFromTranscript({
      sessionId: "session-a",
      cwd: "/workspace/app",
      configDir,
    });

    expect(title).toBe("Title from cwd path");
  });

  it("falls back to scanning when the cwd does not encode to the project dir", async () => {
    // Claude Code's directory encoding is not something we should depend on:
    // the session id is a uuid, so finding the file by name is authoritative.
    writeTranscript("-some-other-encoding", "session-b", [aiTitleLine("Found by scan", "session-b")]);

    const title = await readAgentSessionTitleFromTranscript({
      sessionId: "session-b",
      cwd: "/completely/different",
      configDir,
    });

    expect(title).toBe("Found by scan");
  });

  it("reads only the tail of a large transcript", async () => {
    // Transcripts reach multiple megabytes and this runs on every snapshot
    // persist, so the whole file must never be read.
    const filler = Array.from({ length: 4000 }, (_, index) => (
      JSON.stringify({ type: "assistant", message: "x".repeat(200), index })
    ));
    writeTranscript("-workspace-big", "session-c", [
      aiTitleLine("Stale early title", "session-c"),
      ...filler,
      aiTitleLine("Current title", "session-c"),
    ]);

    const title = await readAgentSessionTitleFromTranscript({
      sessionId: "session-c",
      cwd: "/workspace/big",
      configDir,
    });

    expect(title).toBe("Current title");
  });

  it("returns null when the session has no transcript", async () => {
    expect(await readAgentSessionTitleFromTranscript({
      sessionId: "missing-session",
      cwd: "/workspace/app",
      configDir,
    })).toBeNull();
  });

  it("returns null when the transcript carries no title yet", async () => {
    writeTranscript("-workspace-app", "session-d", [
      JSON.stringify({ type: "assistant", message: "no title yet" }),
    ]);

    expect(await readAgentSessionTitleFromTranscript({
      sessionId: "session-d",
      cwd: "/workspace/app",
      configDir,
    })).toBeNull();
  });
});

/**
 * `/rename` writes this record. It is the only title anyone asked for
 * explicitly, so it outranks the one the CLI generates for itself.
 */
function customTitleLine(title: string, sessionId = "session-1") {
  return JSON.stringify({ type: "custom-title", customTitle: title, sessionId });
}

describe("custom titles", () => {
  let configDir: string;

  beforeEach(() => {
    __resetAgentTranscriptTitleCacheForTests();
    configDir = mkdtempSync(join(tmpdir(), "omni-claude-config-"));
  });

  function writeTranscript(sessionId: string, lines: string[]) {
    const dir = join(configDir, "projects", "-workspace-app");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${sessionId}.jsonl`), `${lines.join("\n")}\n`);
  }

  it("prefers the name the user typed at /rename", async () => {
    writeTranscript("session-e", [
      aiTitleLine("Generated title", "session-e"),
      customTitleLine("What the user called it", "session-e"),
    ]);

    expect(await readAgentSessionTitleFromTranscript({
      sessionId: "session-e",
      cwd: "/workspace/app",
      configDir,
    })).toBe("What the user called it");
  });

  it("keeps the rename even when the generator runs again afterwards", async () => {
    // Regenerating is not a retraction of a name the user chose.
    writeTranscript("session-f", [
      customTitleLine("What the user called it", "session-f"),
      aiTitleLine("Generated title", "session-f"),
    ]);

    expect(await readAgentSessionTitleFromTranscript({
      sessionId: "session-f",
      cwd: "/workspace/app",
      configDir,
    })).toBe("What the user called it");
  });

  it("searches every config dir the worker could have used", async () => {
    const otherConfigDir = mkdtempSync(join(tmpdir(), "omni-claude-config-alt-"));
    const dir = join(otherConfigDir, "projects", "-workspace-app");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "session-g.jsonl"), `${aiTitleLine("Found in the account home", "session-g")}\n`);

    expect(await readAgentSessionTitleFromTranscript({
      sessionId: "session-g",
      cwd: "/workspace/app",
      configDirs: [configDir, otherConfigDir],
    })).toBe("Found in the account home");
  });
});

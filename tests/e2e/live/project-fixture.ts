import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LIVE_JOURNEY_MARKER_FILE,
  writeLiveJourneyManifestDurably,
  writeLiveJourneyMarkerDurably,
} from "./safety";
import {
  LIVE_JOURNEY_SCHEMA_VERSION,
  type LiveJourneyManifest,
  type LiveJourneyMarker,
} from "./types";

export interface LiveJourneyProjectFixture {
  manifest: LiveJourneyManifest;
  manifestPath: string;
  projectPath: string;
}

export const LIVE_JOURNEY_PROJECT_ROOT_NAME = "omniharness-live-journeys";

export function resolveLiveJourneyProjectRoot(repoRoot: string): string {
  const resolvedRepoRoot = fs.realpathSync(repoRoot);
  const projectRoot = path.join(path.dirname(resolvedRepoRoot), LIVE_JOURNEY_PROJECT_ROOT_NAME);
  fs.mkdirSync(projectRoot, { recursive: true, mode: 0o700 });
  return fs.realpathSync(projectRoot);
}

export function createLiveJourneyProject(args: {
  journeyId: string;
  manifestRoot: string;
  tempRoot?: string;
}): LiveJourneyProjectFixture {
  const tempRoot = args.tempRoot ?? os.tmpdir();
  fs.mkdirSync(tempRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(args.manifestRoot, { recursive: true, mode: 0o700 });
  const manifestPath = path.join(args.manifestRoot, `${args.journeyId}.json`);
  if (fs.existsSync(manifestPath)) {
    throw new Error(`Live journey manifest already exists: ${manifestPath}`);
  }
  const projectPath = fs.realpathSync(fs.mkdtempSync(path.join(tempRoot, "omniharness-live-journey-")));
  const createdAt = new Date().toISOString();
  const manifest: LiveJourneyManifest = {
    schemaVersion: LIVE_JOURNEY_SCHEMA_VERSION,
    journeyId: args.journeyId,
    createdAt,
    projectPath,
    runs: [],
  };
  const marker: LiveJourneyMarker = {
    schemaVersion: LIVE_JOURNEY_SCHEMA_VERSION,
    journeyId: args.journeyId,
    createdAt,
    projectPath,
  };
  fs.writeFileSync(
    path.join(projectPath, ".gitignore"),
    "*\n!.gitignore\n!.omniharness-live-journey.json\n",
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  writeLiveJourneyMarkerDurably(path.join(projectPath, LIVE_JOURNEY_MARKER_FILE), marker);
  writeLiveJourneyManifestDurably(manifestPath, manifest);
  return { manifest, manifestPath, projectPath };
}

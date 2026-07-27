export const LIVE_JOURNEY_SCHEMA_VERSION = 1 as const;

export type LiveJourneyRunLabel = "A" | "B" | "C";

export interface LiveJourneyOwnedRun {
  id: string;
  label: LiveJourneyRunLabel;
  createdAt: string;
}

export interface LiveJourneyManifest {
  schemaVersion: typeof LIVE_JOURNEY_SCHEMA_VERSION;
  journeyId: string;
  createdAt: string;
  projectPath: string;
  runs: LiveJourneyOwnedRun[];
}

export interface LiveJourneyMarker {
  schemaVersion: typeof LIVE_JOURNEY_SCHEMA_VERSION;
  journeyId: string;
  createdAt: string;
  projectPath: string;
}


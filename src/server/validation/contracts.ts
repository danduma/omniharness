export type ValidationArtifact =
  | { type: "file"; path: string }
  | { type: "text"; path: string; contains: string }
  | { type: "command"; command: string; expectedExitCode?: number; stdoutContains?: string };

export interface ValidationRequest {
  cwd: string;
  title: string;
  expectedArtifacts: ValidationArtifact[];
}

export interface ValidationResult {
  ok: boolean;
  failures: string[];
  evidence: string[];
}

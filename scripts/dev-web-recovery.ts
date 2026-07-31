export type DevProcessExit = {
  label: string;
  code: number | null;
  signal: NodeJS.Signals | null;
};

export function describeUnexpectedDevExit(exit: DevProcessExit) {
  return `${exit.label} exited with ${
    exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? "unknown"}`
  }.`;
}

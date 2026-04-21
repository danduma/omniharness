import path from "path";

export function getAppRoot() {
  const configuredRoot = process.env.OMNIHARNESS_ROOT?.trim();
  return configuredRoot ? path.resolve(configuredRoot) : process.cwd();
}

export function getAppDataPath(...segments: string[]) {
  return path.join(getAppRoot(), ...segments);
}

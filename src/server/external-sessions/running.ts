import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function getRunningClaudePids(): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", "claude"], { timeout: 3000 });
    return stdout
      .split("\n")
      .map((line) => parseInt(line.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
  } catch {
    // pgrep exits non-zero when no matches found
    return [];
  }
}

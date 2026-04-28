const userAgent = process.env.npm_config_user_agent || "";
const args = new Set(process.argv.slice(2));
const expectedArch = "arm64";
const actualArch = process.env.OMNIHARNESS_TEST_PROCESS_ARCH || process.arch;

if (!userAgent.startsWith("pnpm/")) {
  console.error("This repository is pnpm-only. Please use pnpm.");
  process.exit(1);
}

if (actualArch !== expectedArch) {
  console.error(
    `This repository must run with an ${expectedArch} Node.js runtime. ` +
      `Current runtime architecture is ${actualArch}.`,
  );
  console.error("Switch to an arm64 Node.js install, then run `pnpm install` again.");
  process.exit(1);
}

if (args.has("--verify-native")) {
  try {
    await import("better-sqlite3");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to load better-sqlite3 with the current arm64 Node.js runtime.");
    console.error(message);
    console.error("Run `pnpm rebuild better-sqlite3` from an arm64 shell, then retry.");
    process.exit(1);
  }
}

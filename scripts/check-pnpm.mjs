const userAgent = process.env.npm_config_user_agent || "";
const args = new Set(process.argv.slice(2));

if (!userAgent.startsWith("pnpm/")) {
  console.error("This repository is pnpm-only. Please use pnpm.");
  process.exit(1);
}

if (args.has("--verify-native")) {
  try {
    await import("better-sqlite3");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load better-sqlite3 with the current ${process.arch} Node.js runtime.`);
    console.error(message);
    console.error("Run `pnpm rebuild better-sqlite3` with the same Node.js runtime, then retry.");
    process.exit(1);
  }
}

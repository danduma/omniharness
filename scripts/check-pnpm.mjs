const userAgent = process.env.npm_config_user_agent || "";
const args = new Set(process.argv.slice(2));
const expectedNodeMajor = Number(process.env.OMNIHARNESS_EXPECTED_NODE_MAJOR || "22");
const currentNodeMajor = Number(process.versions.node.split(".")[0]);

if (!userAgent.startsWith("pnpm/")) {
  console.error("This repository is pnpm-only. Please use pnpm.");
  process.exit(1);
}

if (currentNodeMajor !== expectedNodeMajor) {
  console.error(`OmniHarness must be installed and run with Node.js ${expectedNodeMajor}.x.`);
  console.error(`Current runtime: ${process.version} at ${process.execPath}`);
  console.error("This repo uses native better-sqlite3 bindings, so mixing Node major versions corrupts the local install.");
  console.error("Run `nvm use` from the repo root, then `pnpm rebuild better-sqlite3` if node_modules already exists.");
  process.exit(1);
}

if (args.has("--verify-native")) {
  try {
    await import("better-sqlite3");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load better-sqlite3 with Node ${process.version} (${process.arch}).`);
    console.error(message);
    console.error("Run `nvm use` from the repo root, then `pnpm rebuild better-sqlite3`, then retry.");
    process.exit(1);
  }
}

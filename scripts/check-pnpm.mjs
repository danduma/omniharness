const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("This repository is pnpm-only. Please use pnpm.");
  process.exit(1);
}

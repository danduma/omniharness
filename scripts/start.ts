import process from "process";

process.env.OMNIHARNESS_SERVER_MODE = "production";

void import("./dev").catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

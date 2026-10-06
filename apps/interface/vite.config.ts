import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { interfaceCspManifestPlugin } from "./vite-csp-manifest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig(({ command, mode }) => {
  // Vite honours an inherited NODE_ENV, so a build launched from a shell or
  // agent that exports NODE_ENV=development (or vitest's "test") silently ships
  // React's development runtime, which makes every keystroke several times
  // slower. The served interface is always a production bundle; development
  // goes through the dev server. This runs before Vite derives isProduction.
  if (command === "build") {
    process.env.NODE_ENV = "production";
  }
  const packaged = mode === "packaged";
  return {
    root: path.join(repositoryRoot, "apps/interface"),
    base: packaged ? "./" : "/",
    plugins: [react(), interfaceCspManifestPlugin()],
    define: {
      __OMNI_PWA_BUILD__: JSON.stringify(command === "build" && !packaged),
    },
    resolve: {
      alias: {
        "@": path.join(repositoryRoot, "src"),
      },
    },
    build: {
      outDir: process.env.OMNIHARNESS_INTERFACE_OUT_DIR
        ? path.resolve(process.env.OMNIHARNESS_INTERFACE_OUT_DIR)
        : path.join(
          repositoryRoot,
          packaged ? "dist/interface-packaged" : "dist/interface",
        ),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.join(repositoryRoot, "apps/interface/index.html"),
          "app-shell": path.join(repositoryRoot, "apps/interface/app-shell.html"),
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env.OMNIHARNESS_INTERFACE_PORT ?? "5173"),
      proxy: {
        "/api": {
          target: process.env.OMNIHARNESS_VITE_RUNNER_URL ?? "http://127.0.0.1:3050",
          changeOrigin: false,
        },
      },
    },
  };
});

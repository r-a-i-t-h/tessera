/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

const api = "http://127.0.0.1:4173";

/** Same-origin in the browser: cookie sessions work with no CORS. */
const apiProxy = {
  "/auth": api,
  "/api": api,
  "/health": api,
} as const;

export default defineConfig({
  // Subdirectory-relative: works when hosted under a path, not only domain root.
  base: "./",
  build: {
    target: "es2022",
    assetsDir: "assets",
  },
  server: {
    port: 4174,
    strictPort: true,
    open: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4174,
    strictPort: true,
    proxy: apiProxy,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

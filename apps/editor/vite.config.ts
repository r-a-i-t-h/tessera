/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

const api = "http://127.0.0.1:7356";

/** Same-origin in the browser: cookie sessions work with no CORS. */
const apiProxy = {
  "/auth": api,
  "/api": api,
  "/health": api,
} as const;

export default defineConfig({
  // Editor is served at the hostname root. Published sites use base "./" instead.
  base: "/",
  build: {
    target: "es2022",
    assetsDir: "assets",
  },
  server: {
    port: 7355,
    strictPort: true,
    open: true,
    proxy: apiProxy,
  },
  preview: {
    port: 7355,
    strictPort: true,
    proxy: apiProxy,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

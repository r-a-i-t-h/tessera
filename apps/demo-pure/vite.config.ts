/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Subdirectory-relative: works when hosted under a path, not only domain root.
  base: "./",
  build: {
    target: "es2022",
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    open: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

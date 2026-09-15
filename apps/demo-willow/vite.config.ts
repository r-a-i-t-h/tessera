/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: { target: "es2022", assetsDir: "assets" },
  server: {
    port: 5176,
  },
  preview: {
    port: 4176,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

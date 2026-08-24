/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: { target: "es2022", assetsDir: "assets" },
  server: { port: 5175 },
});

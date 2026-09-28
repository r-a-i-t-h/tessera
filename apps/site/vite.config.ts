import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(appRoot, "..", "..");

/**
 * The running site is `data/` (empty until a backup is restored).
 * `TESSERA_SITE` still points the host at `sites/<name>` when you are working on a demo shell.
 */
const instanceRoot = join(repoRoot, "data");
const requestedSite = process.env.TESSERA_SITE;
const instanceShell = join(instanceRoot, "shell", "index.html");
const emptyRoot = join(appRoot, "empty");
export const siteRoot = requestedSite
  ? join(repoRoot, "sites", requestedSite)
  : existsSync(instanceShell)
    ? instanceRoot
    : emptyRoot;
export const siteName = requestedSite ?? (siteRoot === instanceRoot ? "instance" : "empty");
export const shellRoot = join(siteRoot, "shell");
export const publishRoot = join(siteRoot, "publish");

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/** Serve `publish/` (media, data) without treating it as Vite's publicDir or outDir. */
function servePublish(dir: string): Plugin {
  return {
    name: "tessera-serve-publish",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
          const raw = req.url?.split("?")[0] ?? "";
          if (raw === "/" || raw === "" || raw.endsWith(".html")) {
            next();
            return;
          }
          let rel = decodeURIComponent(raw);
          if (rel.startsWith("/")) rel = rel.slice(1);
          if (!rel || rel.includes("\0") || rel.split("/").includes("..")) {
            next();
            return;
          }
          const file = join(dir, rel);
          const rootPrefix = dir.endsWith(sep) ? dir : dir + sep;
          if (!file.startsWith(rootPrefix) || !existsSync(file) || !statSync(file).isFile()) {
            next();
            return;
          }
          res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
          createReadStream(file).pipe(res);
        });
    },
  };
}

export default defineConfig({
  root: shellRoot,
  base: "./",
  publicDir: false,
  cacheDir: join(appRoot, "node_modules", ".vite", siteName),
  plugins: [servePublish(publishRoot)],
  build: {
    outDir: publishRoot,
    emptyOutDir: false,
    target: "es2022",
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  preview: {
    port: 4173,
  },
});

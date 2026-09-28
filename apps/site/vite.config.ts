import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(appRoot, "..", "..");

/**
 * The preview host always serves the instance directory (`data/`, or
 * `TESSERA_DATA`). `sites/` is reference material and is not this output.
 * `vite build` still accepts `TESSERA_SITE` so the reference shells can be compiled.
 */
const building = process.argv.includes("build");
const referenceSite = building ? process.env.TESSERA_SITE : undefined;
const fromEnv = process.env.TESSERA_DATA;
const requestedRoot = !fromEnv
  ? join(repoRoot, "data")
  : isAbsolute(fromEnv)
    ? fromEnv
    : join(repoRoot, fromEnv);
const sitesDir = resolve(repoRoot, "sites");
const requestedResolved = resolve(requestedRoot);
const instanceRoot =
  requestedResolved === sitesDir || requestedResolved.startsWith(sitesDir + sep)
    ? join(repoRoot, "data")
    : requestedRoot;
const emptyIndex = join(appRoot, "empty", "shell", "index.html");
export const siteRoot = referenceSite ? join(repoRoot, "sites", referenceSite) : instanceRoot;
export const siteName = referenceSite ?? "instance";
export const shellRoot = join(siteRoot, "shell");
export const publishRoot = join(siteRoot, "publish");

const launchedByVite = (process.argv[1] ?? "").includes(`${sep}vite${sep}`);
if (launchedByVite && !referenceSite) mkdirSync(shellRoot, { recursive: true });

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

const placeholderHtml = readFileSync(emptyIndex, "utf8");

/**
 * Serve the instance `publish/` tree (media, flattened snapshot) and, while
 * `shell/index.html` is missing, the empty-site placeholder. HTML from the
 * shell stays on Vite so the preview renders the instance, not `sites/`.
 */
function serveInstance(publishDir: string, shellIndex: string): Plugin {
  return {
    name: "tessera-serve-instance",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split("?")[0] ?? "";
        const wantsHtml = raw === "/" || raw === "" || raw === "/index.html" || raw.endsWith(".html");
        if (wantsHtml) {
          if (!existsSync(shellIndex)) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(placeholderHtml);
            return;
          }
          next();
          return;
        }
        let rel = decodeURIComponent(raw);
        if (rel.startsWith("/")) rel = rel.slice(1);
        if (!rel || rel.includes("\0") || rel.split("/").includes("..")) {
          next();
          return;
        }
        const file = join(publishDir, rel);
        const rootPrefix = publishDir.endsWith(sep) ? publishDir : publishDir + sep;
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
  plugins: [serveInstance(publishRoot, join(shellRoot, "index.html"))],
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

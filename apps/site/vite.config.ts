import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(appRoot, "..", "..");
const skinDir = join(repoRoot, "packages", "skin-w3", "css");
const emptyIndex = join(appRoot, "empty", "shell", "index.html");

const SITE_NAMES = ["willow"] as const;

/**
 * Dev serves one runtime (`src/main.ts`) and the selected site's static shell.
 * `TESSERA_SITE` selects `sites/<name>`. Otherwise the instance directory is
 * `TESSERA_DATA` or `data/`. A missing shell index is the empty placeholder.
 * `sites/` is not the instance unless `TESSERA_SITE` says so.
 */
const requestedSite = process.env.TESSERA_SITE;
if (requestedSite && !SITE_NAMES.includes(requestedSite as (typeof SITE_NAMES)[number])) {
  throw new Error(`Unknown site "${requestedSite}". Expected one of: ${SITE_NAMES.join(", ")}`);
}

function instanceRootFromEnv(): string {
  const fromEnv = process.env.TESSERA_DATA;
  const requestedRoot = !fromEnv
    ? join(repoRoot, "data")
    : isAbsolute(fromEnv)
      ? fromEnv
      : join(repoRoot, fromEnv);
  const sitesDir = resolve(repoRoot, "sites");
  const requestedResolved = resolve(requestedRoot);
  if (requestedResolved === sitesDir || requestedResolved.startsWith(sitesDir + sep)) {
    return join(repoRoot, "data");
  }
  return requestedRoot;
}

const instanceRoot = instanceRootFromEnv();
export const siteRoot = requestedSite ? join(repoRoot, "sites", requestedSite) : instanceRoot;
export const siteName = requestedSite ?? "instance";
export const shellRoot = join(siteRoot, "shell");
export const publishRoot = join(siteRoot, "publish");
/** Instance preview snapshot. Reference sites have no `preview/` and keep using `publish/`. */
export const previewRoot = requestedSite ? undefined : join(siteRoot, "preview");

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};

const placeholderHtml = readFileSync(emptyIndex, "utf8");

function fileInDir(dir: string, rel: string): string | null {
  const file = join(dir, rel);
  const rootPrefix = dir.endsWith(sep) ? dir : dir + sep;
  if (!file.startsWith(rootPrefix) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

function sendFile(res: { setHeader: (k: string, v: string) => void }, file: string): void {
  res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res as unknown as NodeJS.WritableStream);
}

/** Point the shell's stable script at the Vite module for this dev server. */
export function devShellHtml(html: string): string {
  return html.replace(
    /<script\s+type="module"\s+src="\.\/tessera\.js"\s*><\/script>/,
    `<script type="module" src="/@vite/client"></script>\n    <script type="module" src="/src/main.ts"></script>`,
  );
}

/**
 * Serve the site's static shell, the preview snapshot, and `publish/` files.
 * `/data/*` comes from `preview/` when that directory is set, so the SPA
 * preview does not read the copyable dist. The Vite root is this app, so
 * `/src/main.ts` is the shared runtime rather than a file in the site.
 */
function serveSite(
  shellDir: string,
  publishDir: string,
  shellIndex: string,
  previewDir?: string,
): Plugin {
  return {
    name: "tessera-serve-site",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split("?")[0] ?? "";
        const wantsHtml = raw === "/" || raw === "" || raw === "/index.html";
        if (wantsHtml) {
          if (!existsSync(shellIndex)) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(placeholderHtml);
            return;
          }
          const html = devShellHtml(readFileSync(shellIndex, "utf8"));
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
          return;
        }
        let rel = decodeURIComponent(raw);
        if (rel.startsWith("/")) rel = rel.slice(1);
        if (!rel || rel.includes("\0") || rel.split("/").includes("..")) {
          next();
          return;
        }
        const fromShell = fileInDir(shellDir, rel);
        if (fromShell) {
          sendFile(res, fromShell);
          return;
        }
        if (rel.startsWith("skin/")) {
          const fromSkin = fileInDir(skinDir, rel.slice("skin/".length));
          if (fromSkin) {
            sendFile(res, fromSkin);
            return;
          }
        }
        if (previewDir && rel.startsWith("data/")) {
          const fromPreview = fileInDir(previewDir, rel);
          if (fromPreview) {
            sendFile(res, fromPreview);
            return;
          }
        }
        if (rel.startsWith("media/") && !rel.slice("media/".length).includes("/")) {
          const fromFiles = fileInDir(join(siteRoot, "files"), rel.slice("media/".length));
          if (fromFiles) {
            sendFile(res, fromFiles);
            return;
          }
        }
        const fromPublish = fileInDir(publishDir, rel);
        if (fromPublish) {
          sendFile(res, fromPublish);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: appRoot,
  base: "./",
  publicDir: false,
  cacheDir: join(appRoot, "node_modules", ".vite"),
  plugins: [serveSite(shellRoot, publishRoot, join(shellRoot, "index.html"), previewRoot)],
  build: {
    outDir: join(appRoot, "dist"),
    emptyOutDir: true,
    target: "es2022",
    assetsDir: ".",
    modulePreload: false,
    rollupOptions: {
      input: {
        tessera: join(appRoot, "index.html"),
        "tessera-pages": join(appRoot, "src/pages.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunk-[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  preview: {
    port: 4173,
  },
});

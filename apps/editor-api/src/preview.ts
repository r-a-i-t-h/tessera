import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import type { Context, Hono } from "hono";
import { requireEditor } from "./access/editor.js";
import { isResponse } from "./http.js";
import { skinOverrideFile } from "./site/skin-override.js";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const NO_CACHE = { "Cache-Control": "no-cache" };

/**
 * Same words as `apps/site/empty/shell/index.html`. Inlined so a release
 * bundle does not need that file on disk.
 */
const EMPTY_SHELL_HTML = `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tessera</title>
  </head>
  <body>
    <p>This site folder is empty. In the editor, start an empty site or restore an archive, then reload.</p>
  </body>
</html>
`;

const MISSING_RUNTIME_HTML = `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <title>Preview</title>
  </head>
  <body>
    <p>The site runtime is missing. Build it with <code>npm run build -w @r-a-i-t-h/tessera-site</code>, then reload this page.</p>
  </body>
</html>
`;

const SIGN_IN_HTML = `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <title>Sign in</title>
  </head>
  <body>
    <p>Sign in to view the preview.</p>
    <p><a href="/">Open the editor</a></p>
  </body>
</html>
`;

export type PreviewRoots = {
  /** Instance directory: `shell/`, `preview/`, `files/`, and `publish/`. */
  siteRoot: string;
  /** Built `tessera.js` and its chunks. */
  bundleDir: string;
  /** Skin CSS, served at `skin/`. */
  skinDir: string;
};

/**
 * Serve the working snapshot as one folder at `/preview/`.
 *
 * The shell HTML is returned unchanged. Relative `./tessera.js`, `./data/`,
 * `./skin/`, and `./media/` resolve under that prefix the same way they would
 * in any directory on a static host. `/data/*` is only `preview/data`.
 */
export function mountPreview(app: Hono, roots: PreviewRoots): void {
  app.get("/preview", (c) => servePreview(c, roots));
  app.get("/preview/*", (c) => servePreview(c, roots));
}

async function servePreview(c: Context, roots: PreviewRoots): Promise<Response> {
  const pathname = new URL(c.req.url).pathname;
  const user = requireEditor(c);
  if (isResponse(user)) {
    if (isPreviewDocument(pathname)) {
      return c.html(SIGN_IN_HTML, 401, NO_CACHE);
    }
    return user;
  }
  if (pathname === "/preview") return c.redirect("/preview/", 302);

  const rel = previewRelative(pathname);
  if (rel === null) return c.body(null, 404, NO_CACHE);
  if (rel === "" || rel === "index.html") return serveShell(c, roots);

  const file = resolvePreviewFile(rel, roots);
  if (!file) return c.body(null, 404, NO_CACHE);
  const type = MIME[extname(file)] ?? "application/octet-stream";
  return c.body(await readFile(file), 200, { "Content-Type": type, ...NO_CACHE });
}

function isPreviewDocument(pathname: string): boolean {
  return pathname === "/preview" || pathname === "/preview/" || pathname === "/preview/index.html";
}

/** Path under `/preview/`, or null when it tries to leave that folder. */
function previewRelative(pathname: string): string | null {
  if (pathname === "/preview/") return "";
  if (!pathname.startsWith("/preview/")) return null;
  let rel = pathname.slice("/preview/".length);
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return null;
  }
  if (!rel || rel.includes("\0") || rel.split("/").includes("..")) return null;
  return rel;
}

async function serveShell(c: Context, roots: PreviewRoots): Promise<Response> {
  const indexPath = join(roots.siteRoot, "shell", "index.html");
  if (!isFile(indexPath)) return c.html(EMPTY_SHELL_HTML, 200, NO_CACHE);
  if (!isFile(join(roots.bundleDir, "tessera.js"))) {
    return c.html(MISSING_RUNTIME_HTML, 200, NO_CACHE);
  }
  return c.body(await readFile(indexPath), 200, {
    "Content-Type": "text/html; charset=utf-8",
    ...NO_CACHE,
  });
}

/**
 * One browser folder, several roots. `data/` never falls through to `publish/`.
 * Root `*.js` is the built runtime, not a file copied into the shell.
 */
function resolvePreviewFile(rel: string, roots: PreviewRoots): string | null {
  if (!rel.includes("/") && rel.endsWith(".js")) {
    return fileInDir(roots.bundleDir, rel);
  }
  if (rel.startsWith("skin/")) {
    const name = rel.slice("skin/".length);
    const override = skinOverrideFile(join(roots.siteRoot, "shell"), name);
    if (override) return override;
    return fileInDir(roots.skinDir, name);
  }
  if (rel.startsWith("data/")) {
    return fileInDir(join(roots.siteRoot, "preview"), rel);
  }
  if (rel.startsWith("media/") && !rel.slice("media/".length).includes("/")) {
    return fileInDir(join(roots.siteRoot, "files"), rel.slice("media/".length));
  }
  return (
    fileInDir(join(roots.siteRoot, "shell"), rel) ??
    fileInDir(join(roots.siteRoot, "publish"), rel)
  );
}

function fileInDir(dir: string, rel: string): string | null {
  if (!rel || rel.includes("\0") || rel.split("/").includes("..")) return null;
  const root = resolve(dir);
  const target = resolve(root, rel);
  const fromRoot = relative(root, target);
  if (!fromRoot || fromRoot.startsWith("..") || fromRoot.split(sep).includes("..")) return null;
  return isFile(target) ? target : null;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

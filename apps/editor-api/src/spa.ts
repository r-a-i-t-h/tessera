import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import type { Context, Hono } from "hono";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const STATIC_EXT = /\.(css|html|ico|js|json|map|png|svg|woff2)$/i;

/**
 * Serve a built Vite SPA from `spaDir` after JSON routes. Missing hashed
 * assets 404; other GET paths fall back to index.html.
 */
export function mountSpa(app: Hono, spaDir: string): boolean {
  const indexPath = join(spaDir, "index.html");
  if (!existsSync(indexPath)) return false;

  app.get("*", async (c) => {
    const base = c.get("assetBase");
    const rawPath = new URL(c.req.url).pathname;
    if (base && rawPath === base) {
      return c.redirect(`${base}/`, 302);
    }

    const pathname = spaPath(c, base);
    const filePath = safeFile(spaDir, pathname);
    if (filePath && isFile(filePath)) {
      const type = MIME[extname(filePath)] ?? "application/octet-stream";
      return c.body(await readFile(filePath), 200, { "Content-Type": type });
    }
    if (STATIC_EXT.test(pathname)) return c.notFound();

    return c.html(await readFile(indexPath, "utf8"));
  });

  return true;
}

export function spaPath(c: Context, assetBase: string): string {
  let path = new URL(c.req.url).pathname;
  if (assetBase && (path === assetBase || path.startsWith(`${assetBase}/`))) {
    path = path.slice(assetBase.length) || "/";
  }
  return path || "/";
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function safeFile(root: string, pathname: string): string | null {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let decoded: string;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return null;
  }
  const target = resolve(root, decoded);
  const rel = relative(resolve(root), target);
  if (!rel || rel.startsWith("..") || rel.split(sep).includes("..")) return null;
  return target;
}

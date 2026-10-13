import { readdir, readFile, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  SITE_REVISION_FILE,
  hashSnapshotBody,
  siteBodyClass,
  snapshotFileName,
  stampShellBody,
  stampSitePointer,
  type SiteStyle,
} from "@r-a-i-t-h/tessera-model";
import { writeTextAtomic } from "../store/fs.js";

/**
 * Write the stable `site.json`, the content-hashed copy, and `rev.json`.
 * A `preview/data` target stamps `shell/index.html` only.
 * A `publish/data` target stamps `publish/index.html` only.
 * `extraIndexPaths` stamps further HTML files with the same pointer
 * (reference sites keep their shell in step with `publish/`).
 */
export async function writeSnapshotFiles(
  flattenOut: string,
  body: string,
  extraIndexPaths: string[] = [],
): Promise<{ hash: string; file: string }> {
  const hash = await hashSnapshotBody(body);
  const file = snapshotFileName(hash);
  const dir = dirname(flattenOut);
  await writeTextAtomic(flattenOut, body);
  await writeTextAtomic(join(dir, file), body);
  await writeTextAtomic(
    join(dir, SITE_REVISION_FILE),
    `${JSON.stringify({ hash, file }, null, 2)}\n`,
  );

  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    names = [];
  }
  for (const name of names) {
    if (name !== file && /^site\.[a-f0-9]+\.json$/.test(name)) {
      await unlink(join(dir, name)).catch(() => undefined);
    }
  }

  for (const indexPath of [...shellIndexPaths(flattenOut), ...extraIndexPaths]) {
    try {
      const html = await readFile(indexPath, "utf8");
      const pointed = stampSitePointer(html, `./data/${file}`);
      const chrome = shellBodyClass(body);
      const next = chrome ? stampShellBody(pointed, chrome) : pointed;
      if (next !== html) {
        await writeTextAtomic(indexPath, next.endsWith("\n") ? next : `${next}\n`);
      }
    } catch {
      // Shell source is required for dev; the built publish index may not exist yet.
    }
  }

  return { hash, file };
}

/** Body class from `site.style`, or undefined when the snapshot names no style. */
function shellBodyClass(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { site?: { style?: SiteStyle } };
    const style = parsed.site?.style;
    if (!style || typeof style !== "object" || Array.isArray(style)) return undefined;
    return siteBodyClass(style);
  } catch {
    return undefined;
  }
}

/**
 * `preview/data/site.json` stamps `shell/index.html`.
 * `publish/data/site.json` stamps `publish/index.html`.
 * Other layouts are left alone.
 */
export function shellIndexPaths(flattenOut: string): string[] {
  const dataDir = dirname(flattenOut);
  if (basename(dataDir) !== "data") return [];
  const parent = dirname(dataDir);
  const parentName = basename(parent);
  const siteRoot = dirname(parent);
  if (parentName === "preview") return [join(siteRoot, "shell", "index.html")];
  if (parentName === "publish") return [join(parent, "index.html")];
  return [];
}

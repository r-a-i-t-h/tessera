import { readdir, readFile, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  SITE_REVISION_FILE,
  hashSnapshotBody,
  snapshotFileName,
  stampSitePointer,
} from "@r-a-i-t-h/tessera-model";
import { writeTextAtomic } from "../store/fs.js";

/**
 * Write the stable `site.json`, the content-hashed copy, and `rev.json`.
 * When the output lives at `<site>/publish/data/site.json`, stamp the shell
 * and, when present, the built `publish/index.html`, so the first load fetches
 * the hashed file directly.
 */
export async function writeSnapshotFiles(
  flattenOut: string,
  body: string,
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

  for (const indexPath of shellIndexPaths(flattenOut)) {
    try {
      const html = await readFile(indexPath, "utf8");
      const next = stampSitePointer(html, `./data/${file}`);
      if (next !== html) {
        await writeTextAtomic(indexPath, next.endsWith("\n") ? next : `${next}\n`);
      }
    } catch {
      // Shell source is required for dev; the built publish index may not exist yet.
    }
  }

  return { hash, file };
}

/**
 * `<site>/publish/data/site.json` stamps `<site>/shell/index.html` and
 * `<site>/publish/index.html`. Other layouts are left alone.
 */
export function shellIndexPaths(flattenOut: string): string[] {
  const dataDir = dirname(flattenOut);
  if (basename(dataDir) !== "data") return [];
  const publishDir = dirname(dataDir);
  if (basename(publishDir) !== "publish") return [];
  const siteRoot = dirname(publishDir);
  return [join(siteRoot, "shell", "index.html"), join(publishDir, "index.html")];
}

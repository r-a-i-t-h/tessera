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
 * When the output lives at `public/data/site.json`, stamp the site's `index.html`
 * so the first load fetches the hashed file directly.
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

  const indexPath = indexHtmlBesidePublicData(flattenOut);
  if (indexPath) {
    try {
      const html = await readFile(indexPath, "utf8");
      const next = stampSitePointer(html, `./data/${file}`);
      if (next !== html) {
        await writeTextAtomic(indexPath, next.endsWith("\n") ? next : `${next}\n`);
      }
    } catch {
      // This flatten target has no site index.html beside public/data.
    }
  }

  return { hash, file };
}

/** `.../public/data/site.json` → `.../index.html`. Other layouts are left alone. */
export function indexHtmlBesidePublicData(flattenOut: string): string | null {
  const dataDir = dirname(flattenOut);
  if (basename(dataDir) !== "data") return null;
  const publicDir = dirname(dataDir);
  if (basename(publicDir) !== "public") return null;
  return join(dirname(publicDir), "index.html");
}

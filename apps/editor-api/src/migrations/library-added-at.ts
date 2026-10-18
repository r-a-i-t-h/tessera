import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

function isLibraryAsset(row: Record<string, unknown>): boolean {
  return row.kind === "image" || row.kind === "document";
}

const SYNTHETIC_BASE_MS = Date.parse("2020-01-01T00:00:00.000Z");

function normalizeExt(ext: string): string {
  const cleaned = ext.replace(/^\./, "").toLowerCase();
  return cleaned === "jpeg" ? "jpg" : cleaned;
}

async function readMediaOrder(mediaDir: string): Promise<string[]> {
  try {
    const parsed = parseYaml(await readFile(join(mediaDir, "_order.yaml"), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

async function blobMtime(filesDir: string, id: string, ext: string): Promise<string | undefined> {
  if (!ext) return undefined;
  try {
    const info = await stat(join(filesDir, `${id}.${ext}`));
    return info.mtime.toISOString();
  } catch {
    return undefined;
  }
}

function syntheticAddedAt(index: number): string {
  return new Date(SYNTHETIC_BASE_MS + index * 1000).toISOString();
}

export async function migrateLibraryAddedAt(dataDir: string): Promise<void> {
  const recordsDir = join(dataDir, "records");
  const filesDir = join(dataDir, "files");
  const mediaDir = join(recordsDir, "media");
  const order = await readMediaOrder(mediaDir);
  const orderRank = new Map(order.map((id, index) => [id, index]));

  let entries: string[] = [];
  try {
    entries = (await readdir(mediaDir)).filter((name) => name.endsWith(".yaml") && name !== "_order.yaml");
  } catch {
    entries = [];
  }

  const needsSynthetic: { id: string; path: string; row: Record<string, unknown> }[] = [];

  for (const name of entries) {
    const id = name.slice(0, -5);
    const path = join(mediaDir, name);
    const parsed = parseYaml(await readFile(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const row = parsed as Record<string, unknown>;
    if (!isLibraryAsset(row)) continue;
    if (typeof row.addedAt === "string" && row.addedAt.trim()) continue;

    const ext = typeof row.ext === "string" ? normalizeExt(row.ext) : "";
    let addedAt = await blobMtime(filesDir, id, ext);
    if (!addedAt) {
      const rank = orderRank.get(id);
      if (rank !== undefined) addedAt = syntheticAddedAt(rank);
      else {
        needsSynthetic.push({ id, path, row });
        continue;
      }
    }

    row.addedAt = addedAt;
    const body = stringifyYaml(row);
    await writeFile(path, body.endsWith("\n") ? body : `${body}\n`);
  }

  let nextIndex = order.length;
  for (const item of needsSynthetic.sort((a, b) => a.id.localeCompare(b.id))) {
    item.row.addedAt = syntheticAddedAt(nextIndex);
    nextIndex += 1;
    const body = stringifyYaml(item.row);
    await writeFile(item.path, body.endsWith("\n") ? body : `${body}\n`);
  }

  const metaPath = join(dataDir, "meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
  meta.schemaVersion = 4;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}

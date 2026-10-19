import { appendFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Append-only history envelope. The marker version is the framing, not the
 * authoring schema. Each entry records `schemaVersion` from `meta.json` at
 * save time so a later migration can tell which shape the raw YAML had.
 */
const MARKER = "# tessera-history 1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type HistoryEntry = {
  savedAt: string;
  schemaVersion: number;
  raw: string;
};

export type HistorySummary = {
  /** Zero-based index in append order. 0 is the oldest copy. */
  index: number;
  savedAt: string;
  schemaVersion: number;
  bytes: number;
};

/** Site retention knobs. Unset fields are off; both unset means no prune. */
export type HistoryRetention = {
  maxEntries?: number;
  maxAgeDays?: number;
};

export type PruneResult = {
  kept: number;
  dropped: number;
};

export function pageHistoryPath(recordsDir: string, id: string): string {
  return join(recordsDir, "history", "content", `${id}.history`);
}

/** Append the previous raw page file. Does not rewrite earlier entries. */
export async function appendPageHistory(
  file: string,
  raw: string,
  schemaVersion: number,
  savedAt = new Date().toISOString(),
): Promise<void> {
  if (savedAt.includes("\n") || savedAt.trim() === "") {
    throw new Error("History savedAt must be a single line.");
  }
  const version = Math.trunc(schemaVersion);
  const body = Buffer.from(raw, "utf8");
  const header = `${MARKER}\nsavedAt: ${savedAt}\nschemaVersion: ${version}\nbytes: ${body.length}\n---\n`;
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, Buffer.concat([Buffer.from(header, "utf8"), body]));
}

export async function listPageHistory(file: string): Promise<HistorySummary[]> {
  const buf = await readHistory(file);
  if (!buf || buf.length === 0) return [];
  const summaries: HistorySummary[] = [];
  let offset = 0;
  let index = 0;
  while (offset < buf.length) {
    const header = readHeader(buf, offset);
    const bodyEnd = header.bodyStart + header.bytes;
    if (bodyEnd > buf.length) throw new Error("Page history entry is truncated.");
    summaries.push({
      index,
      savedAt: header.savedAt,
      schemaVersion: header.schemaVersion,
      bytes: header.bytes,
    });
    offset = bodyEnd;
    index += 1;
  }
  return summaries;
}

export async function readPageHistoryEntry(
  file: string,
  index: number,
): Promise<HistoryEntry | undefined> {
  if (!Number.isInteger(index) || index < 0) return undefined;
  const buf = await readHistory(file);
  if (!buf || buf.length === 0) return undefined;
  let offset = 0;
  let i = 0;
  while (offset < buf.length) {
    const header = readHeader(buf, offset);
    const bodyEnd = header.bodyStart + header.bytes;
    if (bodyEnd > buf.length) throw new Error("Page history entry is truncated.");
    if (i === index) {
      return {
        savedAt: header.savedAt,
        schemaVersion: header.schemaVersion,
        raw: buf.subarray(header.bodyStart, bodyEnd).toString("utf8"),
      };
    }
    offset = bodyEnd;
    i += 1;
  }
  return undefined;
}

/**
 * Drop entries that fail either configured limit (too old, or outside the
 * newest N). When both limits are unset, leaves the file untouched.
 */
export async function prunePageHistory(
  file: string,
  retention: HistoryRetention,
  now = new Date(),
): Promise<PruneResult> {
  const maxEntries = positiveInt(retention.maxEntries);
  const maxAgeDays = positiveInt(retention.maxAgeDays);
  if (maxEntries === undefined && maxAgeDays === undefined) {
    return { kept: 0, dropped: 0 };
  }

  const entries = await readAllEntries(file);
  if (entries.length === 0) return { kept: 0, dropped: 0 };

  const cutoffMs =
    maxAgeDays !== undefined ? now.getTime() - maxAgeDays * MS_PER_DAY : undefined;
  const countStart =
    maxEntries !== undefined ? Math.max(0, entries.length - maxEntries) : 0;

  const kept = entries.filter((entry, index) => {
    if (cutoffMs !== undefined) {
      const t = Date.parse(entry.savedAt);
      if (!Number.isNaN(t) && t < cutoffMs) return false;
    }
    if (maxEntries !== undefined && index < countStart) return false;
    return true;
  });

  const dropped = entries.length - kept.length;
  if (dropped === 0) return { kept: kept.length, dropped: 0 };

  if (kept.length === 0) {
    await unlink(file).catch(() => undefined);
    return { kept: 0, dropped };
  }

  await writeFile(file, Buffer.concat(kept.map(encodeEntry)));
  return { kept: kept.length, dropped };
}

function positiveInt(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) return undefined;
  return value;
}

function encodeEntry(entry: HistoryEntry): Buffer {
  const body = Buffer.from(entry.raw, "utf8");
  const header = `${MARKER}\nsavedAt: ${entry.savedAt}\nschemaVersion: ${entry.schemaVersion}\nbytes: ${body.length}\n---\n`;
  return Buffer.concat([Buffer.from(header, "utf8"), body]);
}

async function readAllEntries(file: string): Promise<HistoryEntry[]> {
  const buf = await readHistory(file);
  if (!buf || buf.length === 0) return [];
  const entries: HistoryEntry[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const header = readHeader(buf, offset);
    const bodyEnd = header.bodyStart + header.bytes;
    if (bodyEnd > buf.length) throw new Error("Page history entry is truncated.");
    entries.push({
      savedAt: header.savedAt,
      schemaVersion: header.schemaVersion,
      raw: buf.subarray(header.bodyStart, bodyEnd).toString("utf8"),
    });
    offset = bodyEnd;
  }
  return entries;
}

async function readHistory(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

function readHeader(
  buf: Buffer,
  offset: number,
): { bodyStart: number; savedAt: string; schemaVersion: number; bytes: number } {
  const lines: string[] = [];
  let cursor = offset;
  for (let i = 0; i < 5; i++) {
    const nl = buf.indexOf(0x0a, cursor);
    if (nl < 0) throw new Error("Page history entry is truncated.");
    lines.push(buf.subarray(cursor, nl).toString("utf8"));
    cursor = nl + 1;
  }
  if (lines[0] !== MARKER) {
    throw new Error("Page history file is not a tessera-history 1 stream.");
  }
  const savedAt = field(lines[1], "savedAt");
  const schemaVersion = Number(field(lines[2], "schemaVersion"));
  const bytes = Number(field(lines[3], "bytes"));
  if (lines[4] !== "---") throw new Error("Page history entry header is incomplete.");
  if (!Number.isInteger(schemaVersion) || !Number.isInteger(bytes) || bytes < 0) {
    throw new Error("Page history entry header is incomplete.");
  }
  return { bodyStart: cursor, savedAt, schemaVersion, bytes };
}

function field(line: string | undefined, name: string): string {
  const prefix = `${name}: `;
  if (!line?.startsWith(prefix) || line.length === prefix.length) {
    throw new Error("Page history entry header is incomplete.");
  }
  return line.slice(prefix.length);
}

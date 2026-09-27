import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Append-only history envelope. The marker version is the framing, not the
 * authoring schema. Each entry records `schemaVersion` from `meta.json` at
 * save time so a later migration can tell which shape the raw YAML had.
 */
const MARKER = "# tessera-history 1";

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

export function pageHistoryPath(siteDir: string, id: string): string {
  return join(siteDir, "history", "content", `${id}.history`);
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

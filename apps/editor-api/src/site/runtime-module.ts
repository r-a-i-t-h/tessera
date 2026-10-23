import type { RuntimeModule } from "@r-a-i-t-h/tessera-model";
import { isRecordId } from "./kinds.js";

export const RUNTIME_MODULE_EXTS = new Set(["js", "mjs"]);

/** Max bytes for PUT body from the editor raw tab. */
export const RUNTIME_MODULE_RAW_MAX_BYTES = 1024 * 1024;

export type RuntimeModuleRecord = {
  id: string;
  ext: string;
  title?: string;
};

export function publicRuntimeModuleUrl(id: string, ext: string): string {
  const normalized = ext.replace(/^\./, "").toLowerCase();
  return `./runtime-modules/${id}.${normalized}`;
}

export function normalizeRuntimeModuleExt(filename: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  const ext = (match?.[1] ?? "").toLowerCase();
  return RUNTIME_MODULE_EXTS.has(ext) ? ext : undefined;
}

export function parseRuntimeModuleRecord(row: unknown): RuntimeModuleRecord | undefined {
  if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
  const id = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id.trim() : "";
  const extRaw = typeof (row as { ext?: unknown }).ext === "string" ? (row as { ext: string }).ext.trim() : "";
  const ext = extRaw.replace(/^\./, "").toLowerCase();
  if (!isRecordId(id) || !RUNTIME_MODULE_EXTS.has(ext)) return undefined;
  const title = typeof (row as { title?: unknown }).title === "string" ? (row as { title: string }).title.trim() : "";
  return { id, ext, ...(title ? { title } : {}) };
}

export function toRuntimeModule(record: RuntimeModuleRecord): RuntimeModule {
  return {
    id: record.id,
    url: publicRuntimeModuleUrl(record.id, record.ext),
    ...(record.title ? { title: record.title } : {}),
  };
}

export function projectRuntimeModules(rows: unknown[]): RuntimeModule[] {
  const out: RuntimeModule[] = [];
  for (const row of rows) {
    const record = parseRuntimeModuleRecord(row);
    if (record) out.push(toRuntimeModule(record));
  }
  return out;
}

export function flatRuntimeModuleName(url: string): string | null {
  const match = /^\.\/runtime-modules\/([^/]+)$/.exec(url);
  return match?.[1] ?? null;
}

/** Same-origin runtime module URL allowed in bindings and publish output. */
export const RUNTIME_MODULE_URL = /^\.\/runtime-modules\/[A-Za-z0-9][A-Za-z0-9._-]*\.(mjs|js)$/;

export function isValidRuntimeModuleUrl(url: string): boolean {
  return RUNTIME_MODULE_URL.test(url);
}

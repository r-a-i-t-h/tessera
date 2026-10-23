import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RecordKind } from "./kinds.js";
import { isRecordId } from "./kinds.js";
import {
  normalizeRuntimeModuleExt,
  parseRuntimeModuleRecord,
  publicRuntimeModuleUrl,
  RUNTIME_MODULE_RAW_MAX_BYTES,
  type RuntimeModuleRecord,
} from "./runtime-module.js";
import type { SiteStore, SnapshotRef } from "./store.js";

export type RuntimeModuleView = {
  id: string;
  ext: string;
  title?: string;
  url: string;
  bytes?: number;
  addedAt?: string;
};

export type RuntimeModuleListing = {
  modules: RuntimeModuleView[];
};

export type UploadRuntimeModuleFile = {
  filename: string;
  bytes: Uint8Array;
};

type MutationResult = { snapshot?: SnapshotRef };

export class RuntimeModuleLibrary {
  constructor(
    private readonly site: SiteStore,
    private readonly modulesDir: string,
  ) {}

  async list(): Promise<RuntimeModuleListing> {
    const modules: RuntimeModuleView[] = [];
    for (const id of await listRecordIds(this.site, "runtimeModules")) {
      const row = await this.site.read("runtimeModules", id);
      const record = parseRuntimeModuleRecord(row);
      if (!record) continue;
      const path = this.blobPath(record.id, record.ext);
      let bytes: number | undefined;
      try {
        bytes = (await stat(path)).size;
      } catch {
        bytes = undefined;
      }
      modules.push({
        id: record.id,
        ext: record.ext,
        url: publicRuntimeModuleUrl(record.id, record.ext),
        ...(record.title ? { title: record.title } : {}),
        ...(bytes !== undefined ? { bytes } : {}),
      });
    }
    modules.sort((a, b) => a.id.localeCompare(b.id));
    return { modules };
  }

  async readText(id: string): Promise<string> {
    const record = await this.requireRecord(id);
    const raw = await readFile(this.blobPath(record.id, record.ext));
    return new TextDecoder("utf-8", { fatal: false }).decode(raw);
  }

  async writeText(id: string, text: string): Promise<MutationResult> {
    const record = await this.requireRecord(id);
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > RUNTIME_MODULE_RAW_MAX_BYTES) {
      throw new Error(`Module file must be at most ${RUNTIME_MODULE_RAW_MAX_BYTES} bytes.`);
    }
    await mkdir(this.modulesDir, { recursive: true });
    await writeFile(this.blobPath(record.id, record.ext), bytes);
    const rebuilt = await this.site.rebuild();
    return { snapshot: rebuilt.snapshot };
  }

  async upload(file: UploadRuntimeModuleFile, opts?: { id?: string; title?: string }): Promise<{ id: string; snapshot?: SnapshotRef }> {
    const ext = normalizeRuntimeModuleExt(file.filename);
    if (!ext) throw new Error("Only .js and .mjs runtime modules can be added.");
    const baseId = opts?.id?.trim() || file.filename.replace(/\.[^.]+$/, "");
    const id = isRecordId(baseId) ? baseId : slugId(file.filename);
    if (!isRecordId(id)) throw new Error("Invalid module id.");
    const taken = new Set(await listRecordIds(this.site, "runtimeModules"));
    if (taken.has(id)) throw new Error(`A runtime module named "${id}" already exists.`);
    const record: RuntimeModuleRecord = { id, ext, ...(opts?.title?.trim() ? { title: opts.title.trim() } : {}) };
    await mkdir(this.modulesDir, { recursive: true });
    await writeFile(this.blobPath(id, ext), file.bytes);
    await this.site.write("runtimeModules", id, record);
    const rebuilt = await this.site.rebuild();
    return { id, snapshot: rebuilt.snapshot };
  }

  async replaceFile(id: string, file: UploadRuntimeModuleFile): Promise<MutationResult> {
    const record = await this.requireRecord(id);
    const ext = normalizeRuntimeModuleExt(file.filename);
    if (!ext) throw new Error("Only .js and .mjs runtime modules can be added.");
    const next: RuntimeModuleRecord = { ...record, ext };
    await writeFile(this.blobPath(id, ext), file.bytes);
    if (ext !== record.ext) {
      await unlink(this.blobPath(id, record.ext)).catch(() => undefined);
      await this.site.write("runtimeModules", id, next);
    }
    const rebuilt = await this.site.rebuild();
    return { snapshot: rebuilt.snapshot };
  }

  async patch(id: string, patch: { title?: string | null }): Promise<MutationResult> {
    const record = await this.requireRecord(id);
    const next: RuntimeModuleRecord = { ...record };
    if (patch.title === null || patch.title === "") delete next.title;
    else if (typeof patch.title === "string") next.title = patch.title.trim();
    await this.site.write("runtimeModules", id, next);
    const rebuilt = await this.site.rebuild();
    return { snapshot: rebuilt.snapshot };
  }

  async delete(id: string): Promise<MutationResult> {
    const record = await this.requireRecord(id);
    await unlink(this.blobPath(record.id, record.ext)).catch(() => undefined);
    await this.site.deleteRuntimeModule(id);
    const rebuilt = await this.site.rebuild();
    return { snapshot: rebuilt.snapshot };
  }

  async duplicate(sourceId: string, nextId: string): Promise<{ id: string; snapshot?: SnapshotRef }> {
    const id = nextId.trim();
    if (!isRecordId(id)) throw new Error("Invalid module id.");
    const taken = new Set(await listRecordIds(this.site, "runtimeModules"));
    if (taken.has(id)) throw new Error(`A runtime module named "${id}" already exists.`);
    const record = await this.requireRecord(sourceId);
    const bytes = await readFile(this.blobPath(record.id, record.ext));
    const copied: RuntimeModuleRecord = { id, ext: record.ext };
    await mkdir(this.modulesDir, { recursive: true });
    await writeFile(this.blobPath(id, copied.ext), bytes);
    await this.site.write("runtimeModules", id, copied);
    const rebuilt = await this.site.rebuild();
    return { id, snapshot: rebuilt.snapshot };
  }

  private blobPath(id: string, ext: string): string {
    return join(this.modulesDir, `${id}.${ext.replace(/^\./, "")}`);
  }

  private async requireRecord(id: string): Promise<RuntimeModuleRecord> {
    const raw = await this.site.read("runtimeModules", id);
    const record = parseRuntimeModuleRecord(raw);
    if (!record) throw new Error("Runtime module not found.");
    return record;
  }
}

async function listRecordIds(site: SiteStore, kind: RecordKind): Promise<string[]> {
  const listing = await site.list();
  return listing.filter((row) => row.kind === kind).map((row) => row.id);
}

function slugId(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  let slug = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/-+/g, "-")
    .replace(/-+$/g, "");
  if (!slug || !/^[a-z0-9]/i.test(slug)) slug = slug ? `module-${slug}` : "module";
  return slug.slice(0, 80);
}

export async function listOrphanRuntimeModuleBlobs(modulesDir: string, expected: Set<string>): Promise<string[]> {
  const orphans: string[] = [];
  try {
    const entries = await readdir(modulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(mjs|js)$/.test(entry.name)) continue;
      if (!expected.has(entry.name)) orphans.push(entry.name);
    }
  } catch {
    return [];
  }
  return orphans.sort();
}

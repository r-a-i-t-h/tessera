import { mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { collectDeclaredZones, resolvePageProfile, SITE_REVISION_FILE } from "@r-a-i-t-h/tessera-model";
import { readText, writeTextAtomic } from "../store/fs.js";
import {
  appendPageHistory,
  listPageHistory,
  pageHistoryPath,
  readPageHistoryEntry,
  type HistoryEntry,
  type HistorySummary,
} from "./history.js";
import { writeSnapshotFiles } from "./snapshot.js";
import type { DistReport, DistTarget } from "./dist.js";
import {
  assembleDocument,
  authoredPageToPage,
  fromYaml,
  recordToYaml,
  splitDocument,
  toYaml,
  type AuthoredPage,
  type LoadedSite,
  yamlToRecord,
} from "./document.js";
import { isRecordId, KIND_DIRS, RECORD_KINDS, type RecordKind } from "./kinds.js";

export type SnapshotRef = { hash: string; file: string };

export type SaveResult = {
  historyAppended: boolean;
  historyCount: number;
  snapshot?: SnapshotRef;
};

export type RecordFileRef = {
  /** Path relative to the site directory. */
  file: string;
  historyFile?: string;
};

export type RecordSummary = {
  kind: RecordKind | "site" | "nav";
  id: string;
  title?: string;
};

export type PageLayoutHint = {
  layoutId: string;
  layoutTitle?: string;
  layoutSource: "page" | "section" | "site";
  sectionId?: string;
  declaredZones: string[];
  offLayoutZones: string[];
  layouts: Record<string, { title?: string; zones: string[] }>;
};

export class SiteStore {
  /** Directory that contains `content/<id>.history`. Defaults to `<siteDir>/history`. */
  readonly historyDir: string;

  constructor(
    readonly siteDir: string,
    readonly flattenOut?: string,
    /** Authoring schema from `$TESSERA_DATA/meta.json`. Missing or non-numeric is 0. */
    private readonly schemaVersion: () => Promise<number> = async () => 0,
    historyDir?: string,
    readonly dist?: DistTarget,
  ) {
    this.historyDir = historyDir ?? join(siteDir, "history");
  }

  currentSchemaVersion(): Promise<number> {
    return this.schemaVersion();
  }

  fileRef(kind: RecordKind | "site" | "nav", id: string): RecordFileRef {
    if (kind === "site") return { file: "site.yaml" };
    if (kind === "nav") return { file: "nav.yaml" };
    const file = `${KIND_DIRS[kind]}/${id}.yaml`;
    if (kind !== "content") return { file };
    return { file, historyFile: `history/content/${id}.history` };
  }

  async list(): Promise<RecordSummary[]> {
    const out: RecordSummary[] = [];
    try {
      const site = fromYaml<{ id?: string; title?: string }>(await readText(this.siteFile()));
      out.push({ kind: "site", id: site.id ?? "site", title: site.title ?? "Site" });
    } catch {
      // first boot before deconstruct
    }
    try {
      await readText(this.navFile());
      out.push({ kind: "nav", id: "nav", title: "Navigation" });
    } catch {
      // optional until written
    }
    for (const kind of RECORD_KINDS) {
      for (const id of await this.listIds(kind)) {
        const data = await this.read(kind, id);
        out.push({
          kind,
          id,
          title: typeof data.title === "string" ? data.title : id,
        });
      }
    }
    return out;
  }

  async read(kind: RecordKind, id: string): Promise<Record<string, unknown>> {
    this.assertId(id);
    const text = await readText(this.recordFile(kind, id));
    const data = yamlToRecord(kind, text);
    if (data.id !== undefined && data.id !== id) {
      throw new Error(`File ${id}.yaml has id ${String(data.id)}.`);
    }
    return { ...data, id };
  }

  async pageLayoutHint(page: Record<string, unknown>): Promise<PageLayoutHint | undefined> {
    const doc = await this.tryDocument();
    if (!doc) return undefined;
    const authored = page as AuthoredPage;
    if (!authored.id || !authored.title) return undefined;
    const resolved = authoredPageToPage(authored);
    const profile = resolvePageProfile(doc, resolved);
    const layouts: PageLayoutHint["layouts"] = {};
    for (const layout of doc.layouts) {
      layouts[layout.id] = {
        title: layout.title,
        zones: [...collectDeclaredZones(layout.root)],
      };
    }
    const declaredZones = layouts[profile.layoutId]?.zones ?? [];
    const present = Object.keys(authored.zones ?? {});
    return {
      layoutId: profile.layoutId,
      layoutTitle: layouts[profile.layoutId]?.title,
      layoutSource: profile.layoutSource,
      sectionId: profile.sectionId,
      declaredZones,
      offLayoutZones: present.filter((id) => !declaredZones.includes(id)),
      layouts,
    };
  }

  async readRaw(kind: RecordKind | "site" | "nav", id: string): Promise<string> {
    if (kind === "site") return readText(this.siteFile());
    if (kind === "nav") return readText(this.navFile());
    this.assertId(id);
    return readText(this.recordFile(kind, id));
  }

  async write(kind: RecordKind, id: string, data: Record<string, unknown>): Promise<SaveResult> {
    this.assertId(id);
    const record = { ...data, id };
    return this.commitRecord(kind, id, recordToYaml(kind, record));
  }

  async writeRaw(kind: RecordKind | "site" | "nav", id: string, raw: string): Promise<SaveResult> {
    const text = normalizeRaw(raw);
    if (kind === "site") {
      const data = fromYaml<unknown>(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Site file must be a YAML mapping.");
      }
      const { snapshot } = await this.commitText(this.siteFile(), text);
      return { historyAppended: false, historyCount: 0, ...(snapshot ? { snapshot } : {}) };
    }
    if (kind === "nav") {
      fromYaml(text);
      const { snapshot } = await this.commitText(this.navFile(), text);
      return { historyAppended: false, historyCount: 0, ...(snapshot ? { snapshot } : {}) };
    }
    this.assertId(id);
    const data = yamlToRecord(kind, text);
    if (data.id === undefined || String(data.id) !== id) {
      throw new Error(`Raw file must include id: ${id}.`);
    }
    return this.commitRecord(kind, id, text);
  }

  async pageHistory(id: string): Promise<HistorySummary[]> {
    this.assertId(id);
    return listPageHistory(pageHistoryPath(dirname(this.historyDir), id));
  }

  async pageHistoryEntry(id: string, index: number): Promise<HistoryEntry | undefined> {
    this.assertId(id);
    return readPageHistoryEntry(pageHistoryPath(dirname(this.historyDir), id), index);
  }

  async publishedSnapshot(): Promise<SnapshotRef | undefined> {
    if (!this.flattenOut) return undefined;
    try {
      const parsed = JSON.parse(
        await readText(join(dirname(this.flattenOut), SITE_REVISION_FILE)),
      ) as { hash?: unknown; file?: unknown };
      if (typeof parsed.hash === "string" && typeof parsed.file === "string") {
        return { hash: parsed.hash, file: parsed.file };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  async readSite(): Promise<Record<string, unknown>> {
    return fromYaml<Record<string, unknown>>(await readText(this.siteFile()));
  }

  async writeSite(data: Record<string, unknown>): Promise<SaveResult> {
    const saved = await this.commitText(this.siteFile(), toYaml(data));
    return { historyAppended: false, historyCount: 0, ...outputFields(saved) };
  }

  async readNav(): Promise<unknown> {
    return fromYaml(await readText(this.navFile()));
  }

  async writeNav(data: unknown): Promise<SaveResult> {
    const saved = await this.commitText(this.navFile(), toYaml(data));
    return { historyAppended: false, historyCount: 0, ...outputFields(saved) };
  }

  async rebuild(): Promise<{
    doc?: SiteDocument;
    snapshot?: SnapshotRef;
  }> {
    const doc = await this.loadReadyDocument();
    if (!doc) return {};
    const outputs = await this.writeOutputs(doc);
    return { doc, ...outputs };
  }

  /** Write `publish/` from the current records. Does not refresh the preview. */
  async publish(): Promise<{ doc?: SiteDocument; dist: DistReport }> {
    if (!this.dist) throw new Error("No publish directory configured.");
    const doc = await this.loadReadyDocument();
    if (!doc) throw new Error("Nothing to publish yet. This site needs a layout and at least one page.");
    const { emitDist } = await import("./dist.js");
    return { doc, dist: await emitDist(doc, this.dist) };
  }

  async flatten(): Promise<SiteDocument | undefined> {
    return (await this.rebuild()).doc;
  }

  private async tryDocument(): Promise<SiteDocument | undefined> {
    try {
      return await this.loadReadyDocument();
    } catch {
      return undefined;
    }
  }

  async writeFromDocument(doc: SiteDocument): Promise<void> {
    const split = splitDocument(doc);
    await mkdir(this.siteDir, { recursive: true });
    await writeTextAtomic(this.siteFile(), toYaml(split.site));
    await writeTextAtomic(this.navFile(), toYaml(split.nav));
    for (const kind of RECORD_KINDS) {
      const dir = join(this.siteDir, KIND_DIRS[kind]);
      await mkdir(dir, { recursive: true });
      const keep = new Set<string>();
      const records = split[kind] as Array<{ id: string }>;
      const order: string[] = [];
      for (const record of records) {
        keep.add(record.id);
        order.push(record.id);
        await writeTextAtomic(this.recordFile(kind, record.id), toYaml(record));
      }
      await writeTextAtomic(this.orderFile(kind), toYaml(order));
      for (const id of await this.listIds(kind)) {
        if (!keep.has(id)) await unlink(this.recordFile(kind, id)).catch(() => undefined);
      }
    }
    await this.flatten();
  }

  private async commitRecord(kind: RecordKind, id: string, nextText: string): Promise<SaveResult> {
    const saved = await this.commitText(this.recordFile(kind, id), nextText);
    await this.ensureOrdered(kind, id);
    const historyAppended = await this.maybeAppendHistory(kind, id, saved.previous, nextText);
    const historyCount = kind === "content" ? (await this.pageHistory(id)).length : 0;
    return { historyAppended, historyCount, ...outputFields(saved) };
  }

  /**
   * Replace a file, then refresh the preview. A snapshot failure restores the
   * previous bytes (or removes a file that did not exist) so a bad edit is not
   * what the snapshot cache names. `publish/` is left as it was.
   */
  private async commitText(
    path: string,
    nextText: string,
  ): Promise<{ snapshot?: SnapshotRef; previous?: string }> {
    let previous: string | undefined;
    try {
      previous = await readText(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    await writeTextAtomic(path, nextText);
    try {
      const doc = await this.loadReadyDocument();
      if (!doc) return { previous };
      const outputs = await this.writeOutputs(doc);
      return { ...outputs, previous };
    } catch (err) {
      if (previous === undefined) await unlink(path).catch(() => undefined);
      else await writeTextAtomic(path, previous);
      throw err;
    }
  }

  private async maybeAppendHistory(
    kind: RecordKind,
    id: string,
    previous: string | undefined,
    nextText: string,
  ): Promise<boolean> {
    if (kind !== "content" || previous === undefined || previous === nextText) return false;
    await appendPageHistory(pageHistoryPath(dirname(this.historyDir), id), previous, await this.schemaVersion());
    return true;
  }

  private async writeOutputs(doc: SiteDocument): Promise<{ snapshot?: SnapshotRef }> {
    if (!this.flattenOut) return {};
    return { snapshot: await writeSnapshotFiles(this.flattenOut, documentBody(doc)) };
  }

  private async loadReadyDocument(): Promise<SiteDocument | undefined> {
    if (!(await this.hasSiteFile())) return undefined;
    if (!(await this.listIds("layouts")).length || !(await this.listIds("content")).length) {
      return undefined;
    }
    return assembleDocument(await this.loadParts());
  }

  private async ensureOrdered(kind: RecordKind, id: string): Promise<void> {
    const ids = await this.readOrder(kind);
    if (ids.includes(id)) return;
    const listed = await this.listIds(kind);
    await writeTextAtomic(this.orderFile(kind), toYaml(listed));
  }

  private siteFile(): string {
    return join(this.siteDir, "site.yaml");
  }

  private navFile(): string {
    return join(this.siteDir, "nav.yaml");
  }

  private recordFile(kind: RecordKind, id: string): string {
    return join(this.siteDir, KIND_DIRS[kind], `${id}.yaml`);
  }

  private async hasSiteFile(): Promise<boolean> {
    try {
      await readText(this.siteFile());
      return true;
    } catch {
      return false;
    }
  }

  private async listIds(kind: RecordKind): Promise<string[]> {
    try {
      const dir = join(this.siteDir, KIND_DIRS[kind]);
      const names = await readdir(dir);
      const found = names
        .filter((name) => name.endsWith(".yaml"))
        .map((name) => name.slice(0, -5))
        .filter(isRecordId);
      const ordered = await this.readOrder(kind);
      if (!ordered.length) return found.sort();
      const rest = found.filter((id) => !ordered.includes(id)).sort();
      return [...ordered.filter((id) => found.includes(id)), ...rest];
    } catch {
      return [];
    }
  }

  private async readOrder(kind: RecordKind): Promise<string[]> {
    try {
      const parsed = fromYaml<unknown>(await readText(this.orderFile(kind)));
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && isRecordId(id)) : [];
    } catch {
      return [];
    }
  }

  private orderFile(kind: RecordKind): string {
    return join(this.siteDir, KIND_DIRS[kind], "_order.yaml");
  }

  private async loadParts(): Promise<LoadedSite> {
    const site = fromYaml<LoadedSite["site"]>(await readText(this.siteFile()));
    let nav: LoadedSite["nav"] = [];
    try {
      const parsed = fromYaml<LoadedSite["nav"]>(await readText(this.navFile()));
      nav = Array.isArray(parsed) ? parsed : [];
    } catch {
      nav = [];
    }
    return {
      site,
      nav,
      content: await this.loadKind("content"),
      items: await this.loadKind("items"),
      layouts: await this.loadKind("layouts"),
      bindings: await this.loadKind("bindings"),
      sections: await this.loadKind("sections"),
      media: await this.loadKind("media"),
      folders: await this.loadKind("folders"),
    };
  }

  private async loadKind<T>(kind: RecordKind): Promise<T[]> {
    const ids = await this.listIds(kind);
    const rows: T[] = [];
    for (const id of ids) {
      rows.push((await this.read(kind, id)) as T);
    }
    return rows;
  }

  private assertId(id: string): void {
    if (!isRecordId(id)) throw new Error(`Invalid record id "${id}".`);
  }
}

function documentBody(doc: SiteDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function outputFields(saved: { snapshot?: SnapshotRef }): Pick<SaveResult, "snapshot"> {
  return saved.snapshot ? { snapshot: saved.snapshot } : {};
}

function normalizeRaw(raw: string): string {
  if (!raw.trim()) throw new Error("Raw file is empty.");
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}

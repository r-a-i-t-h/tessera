import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  collectDeclaredZones,
  layoutHasPageSlot,
  resolveMasterLayout,
  resolvePageProfile,
  SITE_REVISION_FILE,
} from "@r-a-i-t-h/tessera-model";
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
import { installPublish } from "./install-publish.js";
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
import { DOCUMENT_KINDS, isRecordId, KIND_DIRS, RECORD_KINDS, type RecordKind } from "./kinds.js";

export type SnapshotRef = { hash: string; file: string };

export type SaveResult = {
  historyAppended: boolean;
  historyCount: number;
  snapshot?: SnapshotRef;
};

type CommitOptions = {
  rebuild?: boolean;
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
  /** Content entries only. */
  type?: string;
  tags?: string[];
};

export type PageLayoutHint = {
  layoutId: string;
  layoutSource: "type" | "site";
  typeId?: string;
  fields: { id: string; required?: boolean }[];
  declaredZones: string[];
  offLayoutZones: string[];
  layouts: Record<string, { zones: string[] }>;
  /** Layout ids that contain a page slot. */
  frames: string[];
  /** Resolved frame, when the site or a page in the chain names one. */
  masterLayoutId?: string;
  masterSource?: "page" | "ancestor" | "site";
  /** Page that set the frame, when `masterSource` is `page` or `ancestor`. */
  masterFromPageId?: string;
};

/** These records are named by id. A title on them is not public content. */
const ID_NAMED_KINDS = new Set<RecordKind>(["templates", "items", "layouts", "types", "folders"]);

function dropPrivateTitle(kind: RecordKind, data: Record<string, unknown>): Record<string, unknown> {
  if (!ID_NAMED_KINDS.has(kind) || !Object.prototype.hasOwnProperty.call(data, "title")) return data;
  const next = { ...data };
  delete next.title;
  return next;
}

export class SiteStore {
  /** Directory that contains `content/<id>.history`. Defaults to `<siteDir>/history`. */
  readonly historyDir: string;

  /** True while this process is writing `publish/` or installing it. */
  private publishing = false;

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
      // site.yaml is absent until the site record is written
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
        const tags = Array.isArray(data.tags)
          ? data.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
          : [];
        out.push({
          kind,
          id,
          title: typeof data.title === "string" ? data.title : id,
          ...(kind === "content" && typeof data.type === "string" && data.type ? { type: data.type } : {}),
          ...(kind === "content" && tags.length ? { tags } : {}),
        });
      }
    }
    return out;
  }

  async read(kind: RecordKind, id: string): Promise<Record<string, unknown>> {
    this.assertId(id);
    const text = await readText(this.recordFile(kind, id));
    const data = dropPrivateTitle(kind, yamlToRecord(kind, text));
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
        zones: [...collectDeclaredZones(layout.root)],
      };
    }
    const declaredZones = layouts[profile.layoutId]?.zones ?? [];
    const present = Object.keys(authored.zones ?? {});
    const type = doc.types?.find((item) => item.id === profile.typeId);
    const master = resolveMasterLayout(doc, resolved);
    const frames = doc.layouts.filter((layout) => layoutHasPageSlot(layout.root)).map((layout) => layout.id);
    return {
      layoutId: profile.layoutId,
      layoutSource: profile.layoutSource,
      ...(profile.typeId ? { typeId: profile.typeId } : {}),
      fields: (type?.fields ?? []).map((field) => ({
        id: field.id,
        ...(field.required ? { required: true } : {}),
      })),
      declaredZones,
      offLayoutZones: present.filter((id) => !declaredZones.includes(id)),
      layouts,
      frames,
      ...(master.layoutId ? { masterLayoutId: master.layoutId } : {}),
      masterSource: master.source,
      ...(master.fromPageId ? { masterFromPageId: master.fromPageId } : {}),
    };
  }

  async readRaw(kind: RecordKind | "site" | "nav", id: string): Promise<string> {
    if (kind === "site") return readText(this.siteFile());
    if (kind === "nav") return readText(this.navFile());
    this.assertId(id);
    const text = await readText(this.recordFile(kind, id));
    if (!ID_NAMED_KINDS.has(kind)) return text;
    const parsed = yamlToRecord(kind, text);
    if (!Object.prototype.hasOwnProperty.call(parsed, "title")) return text;
    return recordToYaml(kind, { ...dropPrivateTitle(kind, parsed), id });
  }

  async write(kind: RecordKind, id: string, data: Record<string, unknown>): Promise<SaveResult> {
    this.assertId(id);
    const record = dropPrivateTitle(kind, { ...data, id });
    return this.commitRecord(kind, id, recordToYaml(kind, record));
  }

  async writeLibraryRecord(
    kind: "media" | "folders",
    id: string,
    data: Record<string, unknown>,
    options: CommitOptions = {},
  ): Promise<SaveResult> {
    this.assertId(id);
    return this.commitRecord(kind, id, recordToYaml(kind, { ...data, id }), options);
  }

  async deleteLibraryRecord(
    kind: "media" | "folders",
    id: string,
    sidecars: string[] = [],
    options: CommitOptions = {},
  ): Promise<SaveResult> {
    this.assertId(id);
    const path = this.recordFile(kind, id);
    const previous = await readText(path);
    const staged: { original: string; aside: string }[] = [];
    try {
      for (const original of sidecars) {
        const aside = `${original}.${process.pid}.${randomBytes(8).toString("hex")}.rollback`;
        try {
          await rename(original, aside);
          staged.push({ original, aside });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
      }
      await unlink(path);
      let snapshot: SnapshotRef | undefined;
      if (options.rebuild !== false) snapshot = (await this.rebuild()).snapshot;
      await Promise.all(staged.map(({ aside }) => unlink(aside).catch(() => undefined)));
      return {
        historyAppended: false,
        historyCount: 0,
        ...(snapshot ? { snapshot } : {}),
      };
    } catch (err) {
      await writeTextAtomic(path, previous).catch(() => undefined);
      for (const { original, aside } of staged.reverse()) {
        await rename(aside, original).catch(() => undefined);
      }
      throw err;
    }
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
    const parsed = yamlToRecord(kind, text);
    if (parsed.id === undefined || String(parsed.id) !== id) {
      throw new Error(`Raw file must include id: ${id}.`);
    }
    const data = dropPrivateTitle(kind, parsed);
    const body = Object.prototype.hasOwnProperty.call(parsed, "title") && !Object.prototype.hasOwnProperty.call(data, "title")
      ? recordToYaml(kind, { ...data, id })
      : text;
    return this.commitRecord(kind, id, body);
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

  /**
   * Write `publish/` from the current records. Does not refresh the preview.
   * When the site names `publishTo`, replace the files in that directory afterwards.
   * One publish runs at a time in this process.
   */
  async publish(): Promise<{ doc?: SiteDocument; dist: DistReport; installed?: string }> {
    if (this.publishing) throw new Error("A publish is already running.");
    this.publishing = true;
    try {
      if (!this.dist) throw new Error("No publish directory configured.");
      const doc = await this.loadReadyDocument();
      if (!doc) throw new Error("Nothing to publish yet. This site needs a layout and at least one page.");
      const { emitDist } = await import("./dist.js");
      const dist = await emitDist(doc, this.dist);
      const publishTo = doc.site.publishTo?.trim();
      if (!publishTo) return { doc, dist };
      const installed = await installPublish(this.dist.publishDir, publishTo, dirname(this.dist.publishDir));
      return { doc, dist, installed };
    } finally {
      this.publishing = false;
    }
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
    for (const kind of DOCUMENT_KINDS) {
      const dir = join(this.siteDir, KIND_DIRS[kind]);
      await mkdir(dir, { recursive: true });
      const keep = new Set<string>();
      const records = split[kind];
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

  private async commitRecord(
    kind: RecordKind,
    id: string,
    nextText: string,
    options: CommitOptions = {},
  ): Promise<SaveResult> {
    const saved = await this.commitText(this.recordFile(kind, id), nextText, options);
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
    options: CommitOptions = {},
  ): Promise<{ snapshot?: SnapshotRef; previous?: string }> {
    let previous: string | undefined;
    try {
      previous = await readText(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    await writeTextAtomic(path, nextText);
    if (options.rebuild === false) return { previous };
    try {
      const rebuilt = await this.rebuild();
      return { ...(rebuilt.snapshot ? { snapshot: rebuilt.snapshot } : {}), previous };
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
      types: await this.loadKind("types"),
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

import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  assertBlogTenants,
  collectDeclaredZones,
  layoutHasPageSlot,
  markBlogLinks,
  placeArticles,
  resolveMasterLayout,
  resolvePageProfile,
  SITE_REVISION_FILE,
  type NavEntry,
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
  type AuthoredPage,
  fromYaml,
  recordToYaml,
  splitDocument,
  toYaml,
  type LoadedSite,
  yamlToRecord,
} from "./document.js";
import { DOCUMENT_KINDS, isRecordId, KIND_DIRS, RECORD_KINDS, type RecordKind } from "./kinds.js";
import { validateAuthoredRecord } from "./authored-schema.js";

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
  date?: string;
  tenant?: string;
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
const ID_NAMED_KINDS = new Set<RecordKind>(["templates", "items", "layouts", "types", "folders", "tenants"]);

function dropPrivateTitle(kind: RecordKind, data: Record<string, unknown>): Record<string, unknown> {
  if (!ID_NAMED_KINDS.has(kind) || !Object.prototype.hasOwnProperty.call(data, "title")) return data;
  const next = { ...data };
  delete next.title;
  return next;
}

export class SiteStore {
  /** Directory that contains `content/<id>.history`. Defaults to `<recordsDir>/history`. */
  readonly historyDir: string;

  /** True while this process is writing `publish/` or installing it. */
  private publishing = false;

  constructor(
    readonly recordsDir: string,
    readonly flattenOut?: string,
    /** Authoring schema from `$TESSERA_DATA/meta.json`. Missing or non-numeric is 0. */
    private readonly schemaVersion: () => Promise<number> = async () => 0,
    historyDir?: string,
    readonly dist?: DistTarget,
  ) {
    this.historyDir = historyDir ?? join(recordsDir, "history");
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
        const fields =
          data.fields && typeof data.fields === "object" && !Array.isArray(data.fields)
            ? (data.fields as Record<string, unknown>)
            : {};
        const date = typeof fields.date === "string" ? fields.date : "";
        const tenant = typeof fields.tenant === "string" ? fields.tenant : "";
        out.push({
          kind,
          id,
          title: typeof data.title === "string" ? data.title : id,
          ...(kind === "content" && typeof data.type === "string" && data.type ? { type: data.type } : {}),
          ...(kind === "content" && tags.length ? { tags } : {}),
          ...(kind === "content" && date ? { date } : {}),
          ...(kind === "content" && tenant ? { tenant } : {}),
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
    let record = dropPrivateTitle(kind, { ...data, id });
    if (kind === "content") record = await this.finalizeContent(id, record);
    validateAuthoredRecord(kind, id, record);
    const createdIndex = kind === "content" ? await this.ensureBlogIndex(record) : undefined;
    try {
      return await this.commitRecord(kind, id, recordToYaml(kind, record));
    } catch (err) {
      if (createdIndex) await this.removeRecord("content", createdIndex);
      throw err;
    }
  }

  async writeLibraryRecord(
    kind: "media" | "folders",
    id: string,
    data: Record<string, unknown>,
    options: CommitOptions = {},
  ): Promise<SaveResult> {
    this.assertId(id);
    const record = { ...data, id };
    validateAuthoredRecord(kind, id, record);
    return this.commitRecord(kind, id, recordToYaml(kind, record), options);
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
      validateAuthoredRecord("site", id, data);
      const { snapshot } = await this.commitText(this.siteFile(), text);
      return { historyAppended: false, historyCount: 0, ...(snapshot ? { snapshot } : {}) };
    }
    if (kind === "nav") {
      const data = await this.navWithBlogSources(fromYaml(text));
      validateAuthoredRecord("nav", id, data);
      const { snapshot } = await this.commitText(this.navFile(), toYaml(data));
      return { historyAppended: false, historyCount: 0, ...(snapshot ? { snapshot } : {}) };
    }
    this.assertId(id);
    const parsed = yamlToRecord(kind, text);
    if (parsed.id === undefined || String(parsed.id) !== id) {
      throw new Error(`Raw file must include id: ${id}.`);
    }
    const data = dropPrivateTitle(kind, parsed);
    if (kind === "content") {
      const record = await this.finalizeContent(id, { ...data, id });
      validateAuthoredRecord(kind, id, record);
      const createdIndex = await this.ensureBlogIndex(record);
      try {
        return await this.commitRecord(kind, id, recordToYaml(kind, record));
      } catch (err) {
        if (createdIndex) await this.removeRecord("content", createdIndex);
        throw err;
      }
    }
    validateAuthoredRecord(kind, id, { ...data, id });
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
    validateAuthoredRecord("site", typeof data.id === "string" ? data.id : "site", data);
    const saved = await this.commitText(this.siteFile(), toYaml(data));
    return { historyAppended: false, historyCount: 0, ...outputFields(saved) };
  }

  async readNav(): Promise<unknown> {
    return fromYaml(await readText(this.navFile()));
  }

  async writeNav(data: unknown): Promise<SaveResult> {
    const stamped = await this.navWithBlogSources(data);
    validateAuthoredRecord("nav", "nav", stamped);
    const saved = await this.commitText(this.navFile(), toYaml(stamped));
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
    await mkdir(this.recordsDir, { recursive: true });
    await writeTextAtomic(this.siteFile(), toYaml(split.site));
    await writeTextAtomic(this.navFile(), toYaml(split.nav));
    for (const kind of DOCUMENT_KINDS) {
      const dir = join(this.recordsDir, KIND_DIRS[kind]);
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
    return join(this.recordsDir, "site.yaml");
  }

  private navFile(): string {
    return join(this.recordsDir, "nav.yaml");
  }

  private recordFile(kind: RecordKind, id: string): string {
    return join(this.recordsDir, KIND_DIRS[kind], `${id}.yaml`);
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
      const dir = join(this.recordsDir, KIND_DIRS[kind]);
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
    return join(this.recordsDir, KIND_DIRS[kind], "_order.yaml");
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
      tenants: await this.loadKind("tenants"),
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

  /**
   * Articles take a tenant and a parent blog. A blog gains its index.
   * The check runs against the site as it would be after this save.
   */
  private async finalizeContent(id: string, record: Record<string, unknown>): Promise<Record<string, unknown>> {
    const type = record.type;
    if (type !== "article" && type !== "blog" && type !== "blog-index") return record;
    const next: Record<string, unknown> = { ...record, id };
    if (type === "article") {
      delete next.includes;
      delete next.masterLayoutId;
      delete next.templateId;
      delete next.locked;
      const fields = stringFields(next.fields);
      const tenant = fields.tenant?.trim() ?? "";
      if (!tenant) throw new Error("An article must name a tenant.");
      fields.tenant = tenant;
      const date = fields.date?.trim() ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("An article date must be a calendar day, YYYY-MM-DD.");
      }
      fields.date = date;
      for (const key of ["author", "precis", "hero"]) {
        const value = fields[key]?.trim() ?? "";
        if (value) fields[key] = value;
        else delete fields[key];
      }
      next.fields = fields;
      const zones =
        next.zones && typeof next.zones === "object" && !Array.isArray(next.zones)
          ? { ...(next.zones as Record<string, unknown>) }
          : {};
      zones.title = { html: escapeText(typeof next.title === "string" ? next.title : "") };
      next.zones = zones;
    }
    if (type === "blog") {
      const fields = stringFields(next.fields);
      const tenant = fields.tenant?.trim() ?? "";
      if (tenant) fields.tenant = tenant;
      else delete fields.tenant;
      const pageSize = fields.pageSize?.trim() ?? "";
      if (pageSize) fields.pageSize = pageSize;
      else delete fields.pageSize;
      next.fields = fields;
    }
    if (type === "blog-index") {
      delete next.includes;
      delete next.masterLayoutId;
      next.slug = "index";
    }
    const others = (await this.contentRecords()).filter((page) => page.id !== id);
    const projected = [...others, next as AuthoredPage];
    const pages = placeArticles(projected.map((page) => authoredPageToPage(page)));
    assertBlogTenants(
      pages,
      await this.listIds("tenants"),
    );
    if (type === "article") {
      next.parentId = pages.find((page) => page.id === id)?.parentId;
    }
    return next;
  }

  private async contentRecords(): Promise<AuthoredPage[]> {
    const rows: AuthoredPage[] = [];
    for (const id of await this.listIds("content")) {
      rows.push((await this.read("content", id)) as AuthoredPage);
    }
    return rows;
  }

  /** Create the index page when a blog is saved and it does not have one yet. */
  private async ensureBlogIndex(record: Record<string, unknown>): Promise<string | undefined> {
    if (record.type !== "blog" || typeof record.id !== "string") return undefined;
    const pages = await this.contentRecords();
    if (pages.some((page) => page.type === "blog-index" && page.parentId === record.id)) return undefined;
    const indexId = `${record.id}-index`;
    if (!isRecordId(indexId)) throw new Error("This blog id cannot have an index filename.");
    if (pages.some((page) => page.id === indexId)) {
      throw new Error(`Cannot create index ${indexId}: that page already exists.`);
    }
    const index = {
      id: indexId,
      title: "Index",
      slug: "index",
      parentId: record.id,
      type: "blog-index",
    };
    await this.commitRecord("content", indexId, recordToYaml("content", index), { rebuild: false });
    return indexId;
  }

  private async removeRecord(kind: RecordKind, id: string): Promise<void> {
    await unlink(this.recordFile(kind, id)).catch(() => undefined);
    if (kind === "content") {
      await unlink(pageHistoryPath(dirname(this.historyDir), id)).catch(() => undefined);
    }
    const order = (await this.readOrder(kind)).filter((item) => item !== id);
    await writeTextAtomic(this.orderFile(kind), toYaml(order));
  }

  private async navWithBlogSources(data: unknown): Promise<unknown> {
    if (!Array.isArray(data)) return data;
    const blogIds = new Set<string>();
    for (const page of await this.contentRecords()) {
      if (page.type === "blog") blogIds.add(page.id);
    }
    return markBlogLinks(data as NavEntry[], blogIds);
  }

  /** Refused while an article or a blog still selects this tenant. */
  async deleteTenant(id: string): Promise<void> {
    this.assertId(id);
    await this.read("tenants", id);
    const users = (await this.contentRecords()).filter((page) => page.fields?.tenant === id);
    if (users.length) {
      throw new Error(`Tenant ${id} is still selected by ${users.map((page) => page.id).join(", ")}.`);
    }
    await this.removeRecord("tenants", id);
    await this.rebuild();
  }

  /**
   * Remove the tenant, every article and blog that selects it, that blog's index,
   * their history, and the nav row for that blog. Library files stay.
   */
  async cascadeTenant(id: string): Promise<void> {
    this.assertId(id);
    await this.read("tenants", id);
    const pages = await this.contentRecords();
    const articles = pages.filter((page) => page.type === "article" && page.fields?.tenant === id);
    const blog = pages.find((page) => page.type === "blog" && page.fields?.tenant === id);
    const index = blog
      ? pages.find((page) => page.type === "blog-index" && page.parentId === blog.id)
      : undefined;
    for (const page of [...articles, ...(blog ? [blog] : []), ...(index ? [index] : [])]) {
      await this.removeRecord("content", page.id);
    }
    await this.removeRecord("tenants", id);
    if (blog) {
      const nav = await this.readNav();
      if (Array.isArray(nav)) {
        await this.commitText(this.navFile(), toYaml(stripNavId(nav, blog.id)), { rebuild: false });
      }
    }
    await this.rebuild();
  }

  /** Rename a tenant id and rewrite every article and blog that selects it. */
  async renameTenant(id: string, nextId: string): Promise<void> {
    this.assertId(id);
    if (!isRecordId(nextId)) throw new Error(`Invalid record id "${nextId}".`);
    if (nextId === id) return;
    await this.read("tenants", id);
    const existing = await this.listIds("tenants");
    if (existing.includes(nextId)) throw new Error(`Tenant ${nextId} already exists.`);
    const pages = await this.contentRecords();
    for (const page of pages) {
      if (page.fields?.tenant !== id) continue;
      const fields = { ...page.fields, tenant: nextId };
      await this.commitRecord("content", page.id, recordToYaml("content", { ...page, fields }), { rebuild: false });
    }
    await this.commitRecord("tenants", nextId, recordToYaml("tenants", { id: nextId }), { rebuild: false });
    await this.removeRecord("tenants", id);
    await this.rebuild();
  }
}

function stringFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
    else if (typeof item === "number" && Number.isFinite(item)) out[key] = String(item);
  }
  return out;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripNavId(entries: unknown[], id: string): unknown[] {
  const out: unknown[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      out.push(entry);
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (row.id === id) continue;
    const next = { ...row };
    if (Array.isArray(row.children)) next.children = stripNavId(row.children, id);
    out.push(next);
  }
  return out;
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

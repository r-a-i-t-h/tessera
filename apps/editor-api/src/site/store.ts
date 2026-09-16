import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { collectDeclaredZones, resolvePageProfile } from "@r-a-i-t-h/tessera-model";
import { readText, writeJsonAtomic, writeTextAtomic } from "../store/fs.js";
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
  constructor(
    readonly siteDir: string,
    readonly flattenOut?: string,
  ) {}

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

  async write(kind: RecordKind, id: string, data: Record<string, unknown>): Promise<void> {
    this.assertId(id);
    const record = { ...data, id };
    await writeTextAtomic(this.recordFile(kind, id), recordToYaml(kind, record));
    const ids = await this.readOrder(kind);
    if (!ids.includes(id)) {
      const listed = await this.listIds(kind);
      await writeTextAtomic(this.orderFile(kind), toYaml(listed));
    }
    await this.flatten();
  }

  async readSite(): Promise<Record<string, unknown>> {
    return fromYaml<Record<string, unknown>>(await readText(this.siteFile()));
  }

  async writeSite(data: Record<string, unknown>): Promise<void> {
    await writeTextAtomic(this.siteFile(), toYaml(data));
    await this.flatten();
  }

  async readNav(): Promise<unknown> {
    return fromYaml(await readText(this.navFile()));
  }

  async writeNav(data: unknown): Promise<void> {
    await writeTextAtomic(this.navFile(), toYaml(data));
    await this.flatten();
  }

  async flatten(): Promise<SiteDocument | undefined> {
    if (!(await this.hasSiteFile())) return undefined;
    if (!(await this.listIds("layouts")).length || !(await this.listIds("content")).length) {
      return undefined;
    }
    const doc = assembleDocument(await this.loadParts());
    if (this.flattenOut) {
      await writeJsonAtomic(this.flattenOut, doc);
    }
    return doc;
  }

  private async tryDocument(): Promise<SiteDocument | undefined> {
    try {
      if (!(await this.hasSiteFile())) return undefined;
      if (!(await this.listIds("layouts")).length || !(await this.listIds("content")).length) {
        return undefined;
      }
      return assembleDocument(await this.loadParts());
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

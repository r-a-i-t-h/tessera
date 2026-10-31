import type { NavEntry } from "@r-a-i-t-h/tessera-model";
import type { DatasetSummary, RecordList, RecordSummary, RuntimeModuleAsset } from "./api.js";
import { getRecord } from "./api.js";
import { sortArticles, readArticleListOrder } from "./articles-list.js";
import { buildContentCreationRank, compareAlpha } from "./creation-rank.js";
import type { EntityOpenerItem } from "./entity-opener.js";
import {
  buildNavSortDocument,
  readPageListOrder,
  sortPages,
  type ListedPage,
  type PageListOrder,
} from "./pages-list.js";

function editHash(kind: string, id: string): string {
  return `#/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

function filterText(label: string, id: string, extra = ""): string {
  return `${label} ${id} ${extra}`.trim().toLowerCase();
}

function recordLabel(row: RecordSummary): string {
  const publicTitle = row.kind === "site" || row.kind === "content" || row.kind === "nav";
  return publicTitle ? (row.title ?? row.id) : row.id;
}

function toItem(row: RecordSummary, excludeId: string): EntityOpenerItem | undefined {
  if (row.id === excludeId) return undefined;
  const label = recordLabel(row);
  return {
    id: row.id,
    label,
    hash: editHash(row.kind, row.id),
    filterText: filterText(label, row.id, row.type ?? ""),
  };
}

function filterPageRows(listing: RecordList): RecordSummary[] {
  return listing.records.filter(
    (row) => row.kind === "content" && row.type !== "article" && row.type !== "blog" && row.type !== "blog-index",
  );
}

function asRecord(data: unknown): Record<string, unknown> | undefined {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : undefined;
}

async function loadSiteData(listing: RecordList): Promise<Record<string, unknown> | undefined> {
  const siteRow = listing.records.find((row) => row.kind === "site");
  if (!siteRow) return undefined;
  try {
    const sitePayload = await getRecord("site", siteRow.id);
    return asRecord(sitePayload.data);
  } catch {
    return undefined;
  }
}

async function loadNavSortDocument(listing: RecordList, siteData: Record<string, unknown>) {
  try {
    const navPayload = await getRecord("nav", "nav");
    const nav = Array.isArray(navPayload.data) ? (navPayload.data as NavEntry[]) : [];
    const contentForNav = listing.records.filter((row) => row.kind === "content" && row.type !== "article");
    const items = listing.records.filter((row) => row.kind === "items");
    return buildNavSortDocument(siteData, nav, contentForNav, items);
  } catch {
    return undefined;
  }
}

function listedHomePageId(siteData: Record<string, unknown> | undefined): string {
  return typeof siteData?.homePageId === "string" ? siteData.homePageId.trim() : "";
}

async function listedPages(listing: RecordList, order: PageListOrder): Promise<ListedPage[]> {
  const rows = filterPageRows(listing);
  const creationRank = buildContentCreationRank(listing.records);
  const siteData = await loadSiteData(listing);
  const homePageId = listedHomePageId(siteData);
  const navDocument = order === "nav" && siteData ? await loadNavSortDocument(listing, siteData) : undefined;
  return sortPages(rows, order, { creationRank, navDocument, homePageId });
}

function itemsFromRows(rows: RecordSummary[], excludeId: string): EntityOpenerItem[] {
  return rows
    .map((row) => toItem(row, excludeId))
    .filter((item): item is EntityOpenerItem => item !== undefined);
}

function blogArticles(listing: RecordList, blog: string, excludeId: string): EntityOpenerItem[] {
  const rows = listing.records.filter(
    (row) => row.kind === "content" && row.type === "article" && row.parentId === blog,
  );
  const order = readArticleListOrder();
  const sorted = sortArticles(rows, order, buildContentCreationRank(listing.records));
  return itemsFromRows(sorted, excludeId);
}

function blogItems(listing: RecordList, excludeId: string): EntityOpenerItem[] {
  const rows = listing.records
    .filter((row) => row.kind === "content" && row.type === "blog")
    .sort(compareAlpha);
  return itemsFromRows(rows, excludeId);
}

function kindItems(listing: RecordList, kind: string, excludeId: string): EntityOpenerItem[] {
  const rows = listing.records.filter((row) => row.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
  return itemsFromRows(rows, excludeId);
}

/** Entities in the same scope as the editor back link, excluding the current record. */
export async function buildEditEntityItems(
  kind: string,
  id: string,
  record: Record<string, unknown> | undefined,
  listing: RecordList,
): Promise<EntityOpenerItem[]> {
  if (kind === "content") {
    const type = record?.type;
    if (type === "article") {
      const parentId = typeof record?.parentId === "string" ? record.parentId.trim() : "";
      if (!parentId) return [];
      return blogArticles(listing, parentId, id);
    }
    if (type === "blog" || type === "blog-index") {
      return blogItems(listing, id);
    }
    const listed = await listedPages(listing, readPageListOrder());
    return listed
      .map(({ row }) => toItem(row, id))
      .filter((item): item is EntityOpenerItem => item !== undefined);
  }
  return kindItems(listing, kind, id);
}

export function buildDatasetEntityItems(
  datasets: DatasetSummary[],
  currentId: string,
): EntityOpenerItem[] {
  return datasets
    .filter((d) => d.id !== currentId)
    .map((d) => {
      const label = d.title.trim() || d.id;
      return {
        id: d.id,
        label,
        hash: `#/data/${encodeURIComponent(d.id)}`,
        filterText: filterText(label, d.id),
      };
    });
}

export function buildRuntimeModuleEntityItems(
  modules: RuntimeModuleAsset[],
  currentId: string,
): EntityOpenerItem[] {
  return modules
    .filter((mod) => mod.id !== currentId)
    .map((mod) => {
      const label = mod.title?.trim() || mod.id;
      return {
        id: mod.id,
        label,
        hash: `#/records/runtimeModules/${encodeURIComponent(mod.id)}`,
        filterText: filterText(label, mod.id),
      };
    });
}

export function buildUserEntityItems(usernames: string[], currentUsername: string): EntityOpenerItem[] {
  return usernames
    .filter((name) => name !== currentUsername)
    .sort((a, b) => a.localeCompare(b))
    .map((username) => ({
      id: username,
      label: username,
      hash: `#/users/${encodeURIComponent(username)}`,
      filterText: username.toLowerCase(),
    }));
}
